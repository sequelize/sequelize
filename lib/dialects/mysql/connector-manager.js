var mysql
  , Pooling = require('generic-pool')
  , Query   = require("./query")
  , Utils   = require("../../utils")
  , without = function(arr, elem) { return arr.filter(function(e) { return e != elem }) }

try { mysql = require("mysql") } catch (err) {
  console.log("You need to install mysql package manually"); }

module.exports = (function() {
  var ConnectorManager = function(sequelize, config) {
    this.sequelize = sequelize
    this.client = null
    this.config = config || {}
    this.config.port = this.config.port || 3306
    this.disconnectTimeoutId = null
    this.queue = []
    this.activeQueue = []
    this.maxConcurrentQueries = (this.config.maxConcurrentQueries || 50)
    this.poolCfg = Utils._.defaults(this.config.pool, {
      maxConnections: 10,
      minConnections: 0,
      maxIdleTime: 1000,
      handleDisconnects: false,
      validate: validateConnection
    });
    this.pendingQueries = 0;
    this.useReplicaton = !!config.replication;
    this.useQueue = config.queue !== undefined ? config.queue : true;

    var self = this

    if (this.useReplicaton) {
      var reads = 0,
        writes = 0;

      // Init configs with options from config if not present
      for (var i in config.replication.read) {
        config.replication.read[i] = Utils._.defaults(config.replication.read[i], {
          host: this.config.host,
          port: this.config.port,
          username: this.config.username,
          password: this.config.password,
          database: this.config.database
        });
      }
      config.replication.write = Utils._.defaults(config.replication.write, {
        host: this.config.host,
        port: this.config.port,
        username: this.config.username,
        password: this.config.password,
        database: this.config.database
      });

      // I'll make my own pool, with blackjack and hookers!
      this.pool = {
        release: function (client) {
          if (client.queryType == 'read') {
            return this.read.release(client);
          } else {
            return this.write.release(client);
          }
        },
        acquire: function (callback, priority, queryType) {
          if (queryType == 'SELECT') {
            this.read.acquire(callback, priority);
          } else {
            this.write.acquire(callback, priority);
          }
        },
        drain: function () {
          this.read.drain();
          this.write.drain();
        },
        read: Pooling.Pool({
          name: 'sequelize-read',
          create: function (done) {
            if (reads >= self.config.replication.read.length) reads = 0;
            var config = self.config.replication.read[reads++];

            connect.call(self, function (err, connection) {
              connection.queryType = 'read'
              done(null, connection)
            }, config);
          },
          destroy: function(client) {
            disconnect.call(self, client)
          },
          validate: self.poolCfg.validate,
          max: self.poolCfg.maxConnections,
          min: self.poolCfg.minConnections,
          idleTimeoutMillis: self.poolCfg.maxIdleTime
        }),
        write: Pooling.Pool({
          name: 'sequelize-write',
          create: function (done) {
            connect.call(self, function (err, connection) {
              connection.queryType = 'write'
              done(null, connection)
            }, self.config.replication.write);
          },
          destroy: function(client) {
            disconnect.call(self, client)
          },
          validate: self.poolCfg.validate,
          max: self.poolCfg.maxConnections,
          min: self.poolCfg.minConnections,
          idleTimeoutMillis: self.poolCfg.maxIdleTime
        })
      };
    } else if (this.poolCfg) {
      //the user has requested pooling, so create our connection pool
      this.pool = Pooling.Pool({
        name: 'sequelize-mysql',
        create: function (done) {
          connect.call(self, done)
        },
        destroy: function(client) {
          disconnect.call(self, client)
        },
        max: self.poolCfg.maxConnections,
        min: self.poolCfg.minConnections,
        validate: self.poolCfg.validate,
        idleTimeoutMillis: self.poolCfg.maxIdleTime
      })
    }

    process.on('exit', function () {
      //be nice & close our connections on exit
      if (self.pool) {
        self.pool.drain()
      } else if (self.client) {
        disconnect(self.client)
      }

      return
    })
  }

  Utils._.extend(ConnectorManager.prototype, require("../connector-manager").prototype);

  var isConnecting = false;

  ConnectorManager.prototype.query = function(sql, callee, options) {
    if (!this.isConnected && !this.pool) {
      this.connect()
    }

    if (this.useQueue) {
      var queueItem = {
        query: new Query(this.client, this.sequelize, callee, options || {}),
        sql: sql
      };

      enqueue.call(this, queueItem, options);
      return queueItem.query;
    }

    var self = this, query = new Query(this.client, this.sequelize, callee, options || {});
    this.pendingQueries++;

    query.done(function() {
      self.pendingQueries--;
      if (self.pool) self.pool.release(query.client);
      else {
        if (self.pendingQueries === 0) {
          setTimeout(function() {
            self.pendingQueries === 0 && self.disconnect.call(self);
          }, 100);
        }
      }
    });

    if (!this.pool) {
      query.run(sql);
    }

    else {
      this.pool.acquire(function(err, client) {
        if (err) return query.emit('error', err);

        query.client = client;
        query.run(sql);
        return;
      }, undefined, options.type);
    }

    return query;
  };

  ConnectorManager.prototype.connect = function() {
    var self = this;
    // in case database is slow to connect, prevent orphaning the client
    if (this.isConnecting || this.pool) {
      return;
    }
    connect.call(self, function(err, client) {
      self.client = client;
      return;
    });
    return;
  };

  ConnectorManager.prototype.disconnect = function() {
    if (this.client) disconnect.call(this, this.client);
    return;
  };


  // private

  var disconnect = function(client) {
    var self = this;
    if (!this.useQueue) {
      this.client = null;
    }

    client.end(function() {
      if (!self.useQueue) {
        return client.destroy();
      }

      var intervalObj = null
      var cleanup = function () {
        var retryCt = 0
        // make sure to let client finish before calling destroy
        if (self && self.hasQueuedItems) {
          return
        }
        // needed to prevent mysql connection leak
        client.destroy()
        if (self && self.client) {
          self.client = null
        }
        clearInterval(intervalObj)
      }
      intervalObj = setInterval(cleanup, 10)
      cleanup()
      return
    })
  }

  var connect = function(done, config) {
    config = config || this.config
    var connection = mysql.createConnection({
      host: config.host,
      port: config.port,
      user: config.username,
      password: config.password,
      database: config.database,
      timezone: 'Z'
    })
    connection.query("SET time_zone = '+0:00'");
    // client.setMaxListeners(self.maxConcurrentQueries)
    this.isConnecting = false
    if (config.pool.handleDisconnects) {
      handleDisconnect(this.pool, connection)
    }
    done(null, connection)
  }

  var handleDisconnect = function(pool, client) {
    client.on('error', function(err) {
      if (err.code !== 'PROTOCOL_CONNECTION_LOST') {
        throw err
      }
      pool.destroy(client)
    })
  }

  var validateConnection = function(client) {
    return client && client.state != 'disconnected'
  }

  var enqueue = function(queueItem, options) {
    options = options || {}
    if (this.activeQueue.length < this.maxConcurrentQueries) {
      this.activeQueue.push(queueItem)
      if (this.pool) {
        var self = this
        this.pool.acquire(function(err, client) {
          if (err) {
            queueItem.query.emit('error', err)
            return
          }
          //we set the client here, asynchronously, when getting a pooled connection
          //allowing the ConnectorManager.query method to remain synchronous
          queueItem.query.client = client
          queueItem.client = client
          execQueueItem.call(self, queueItem)
          return
        }, undefined, options.type)
      } else {
        execQueueItem.call(this, queueItem)
      }
    } else {
      this.queue.push(queueItem)
    }
  }

  var dequeue = function(queueItem) {
    //return the item's connection to the pool
    if (this.pool) {
      this.pool.release(queueItem.client)
    }
    this.activeQueue = without(this.activeQueue, queueItem)
  }

  var transferQueuedItems = function(count) {
    for(var i = 0; i < count; i++) {
      var queueItem = this.queue.shift();
      if (queueItem) {
        enqueue.call(this, queueItem)
      }
    }
  }

  var afterQuery = function(queueItem) {
    var self = this

    dequeue.call(this, queueItem)
    transferQueuedItems.call(this, this.maxConcurrentQueries - this.activeQueue.length)
    disconnectIfNoConnections.call(this)
  }


  var execQueueItem = function(queueItem) {
    var self = this

    queueItem.query
      .success(function(){ afterQuery.call(self, queueItem) })
      .error(function(){ afterQuery.call(self, queueItem) })

    queueItem.query.run(queueItem.sql, queueItem.client)
  }

  ConnectorManager.prototype.__defineGetter__('hasQueuedItems', function() {
    return (this.queue.length > 0) || (this.activeQueue.length > 0) || (this.client && this.client._queue && (this.client._queue.length > 0))
  })

  // legacy
  ConnectorManager.prototype.__defineGetter__('hasNoConnections', function() {
    return !this.hasQueuedItems
  })

  ConnectorManager.prototype.__defineGetter__('isConnected', function() {
    return this.client != null
  })

  var disconnectIfNoConnections = function() {
    var self = this

    this.disconnectTimeoutId && clearTimeout(this.disconnectTimeoutId)
    this.disconnectTimeoutId = setTimeout(function() {
      self.isConnected && !self.hasQueuedItems && self.disconnect()
    }, 100)
  }

  return ConnectorManager
})()
