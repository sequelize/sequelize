var mariadb
  , Pooling = require('generic-pool')
  , Query   = require("./query")
  , Utils   = require("../../utils")
  , without = function(arr, elem) { return arr.filter(function(e) { return e != elem }) }

module.exports = (function() {
  var ConnectorManager = function(sequelize, config) {
    try {
      if (config.dialectModulePath) {
        mariadb = require(config.dialectModulePath)
      } else {
        mariadb = require('mariasql')
      }
    } catch (err) {
      console.log('You need to install mariasql package manually')
    }

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
      validate: function(client) {
        return client && client.connected
      }
    })
    this.pendingQueries = 0
    this.useReplicaton = !!config.replication
    this.useQueue = config.queue !== undefined ? config.queue : true

    var self = this

    if (this.useReplicaton) {
      var reads = 0
        , writes = 0

      // Init configs with options from config if not present
      for (var i in config.replication.read) {
        config.replication.read[i] = Utils._.defaults(config.replication.read[i], {
          host: this.config.host,
          port: this.config.port,
          username: this.config.username,
          password: this.config.password,
          database: this.config.database
        })
      }
      config.replication.write = Utils._.defaults(config.replication.write, {
        host: this.config.host,
        port: this.config.port,
        username: this.config.username,
        password: this.config.password,
        database: this.config.database
      })

      // I'll make my own pool, with blackjack and hookers!
      this.pool = {
        release: function (client) {
          if (client.queryType == 'read') {
            return this.read.release(client)
          } else {
            return this.write.release(client)
          }
        },
        acquire: function (callback, priority, queryType) {
          if (queryType == 'SELECT') {
            this.read.acquire(callback, priority)
          } else {
            this.write.acquire(callback, priority)
          }
        },
        drain: function () {
          this.read.drain()
          this.write.drain()
        },
        read: Pooling.Pool({
          name: 'sequelize-read',
          create: function (done) {
            if (reads >= self.config.replication.read.length) {
              reads = 0
            }
            var config = self.config.replication.read[reads++]

            connect.call(self, function (err, connection) {
              if (connection) {
                connection.queryType = 'read'
              }

              done(err, connection)
            }, config)
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
              if (connection) {
                connection.queryType = 'write'
              }

              done(err, connection)
            }, self.config.replication.write)
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
        name: 'sequelize-mariadb',
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

    this.onProcessExit = function () {
      //be nice & close our connections on exit
      if (self.pool) {
        self.pool.drain()
      } else if (self.client) {
        disconnect(self.client)
      }

      return
    }.bind(this);

    process.on('exit', this.onProcessExit)
  }

  Utils._.extend(ConnectorManager.prototype, require("../abstract/connector-manager").prototype)

  ConnectorManager.prototype.query = function(sql, callee, options) {
    var self = this

    options = options || {}

    if (this.useQueue) {
      // If queueing we'll let the execQueueItem method handle connecting
      var queueItem = {
        query: new Query(null, this.sequelize, callee, options),
        sql: sql
      };

      queueItem.query.options.uuid = this.config.uuid
      enqueue.call(this, queueItem, options)
      return queueItem.query.promise.finally(function () {
        afterQuery.call(self, queueItem)
      })
    }

    var query = new Query(null, this.sequelize, callee, options);
    this.pendingQueries++;

    query.options.uuid = this.config.uuid

    return this.getConnection(options).then(function (client) {
      query.client = client
      return query.run(sql).finally(function () {
        self.pendingQueries--;
        if (self.pool) {
          self.pool.release(query.client);
        } else {
          if (self.pendingQueries === 0) {
            setTimeout(function() {
              if (self.pendingQueries === 0){
                self.disconnect.call(self);
              }
            }, 100);
          }
        }
      });
    })
  };
  
  ConnectorManager.prototype.getConnection = function(options) {
    var self = this;

    options = options || {}

    return new Utils.Promise(function (resolve, reject) {
      if (!self.pool) {
        // Regular client caching
        if (self.client) {
          return resolve(self.client);
        } else {
          // Cache for concurrent queries
          if (self._getConnection) {
            return resolve(self._getConnection)
          }

          // Set cache and acquire connection
          self._getConnection = this;
          connect.call(self, function(err, client) {
            if (err) {
              return reject(err);
            }

            // Unset caching, should now be caught by the self.client check
            self._getConnection = null;
            self.client = client;
            resolve(client);
          });
        }
      } else {
        // Acquire from pool
        self.pool.acquire(function(err, client) {
          if (err) {
            return reject(err);
          }
          resolve(client);
        }, options.priority, options.type);
      }
    })
  };

  ConnectorManager.prototype.connect = function() {
    var self = this
    // in case database is slow to connect, prevent orphaning the client
    if (this.isConnecting || this.pool) {
      return
    }
    connect.call(self, function(err, client) {
      self.client = client
      return
    })
    return
  }

  ConnectorManager.prototype.disconnect = function() {
    if (this.client) {
      disconnect.call(this, this.client)
    }
    return
  }

  // private
  var disconnect = function(client) {
    if (!client) {
      return // TODO possible orphaning of clients?
    }

    var self = this
    if (!this.useQueue) {
      this.client = null
      client.end()
      return
    }

    var intervalObj = null
    var cleanup = function () {
      // make sure to let queued items be finish before calling end
      if (self && self.hasQueuedItems) {
        return
      }
      client.end()
      if (self && self.client) {
        self.client = null
      }
      clearInterval(intervalObj)
    }
    intervalObj = setInterval(cleanup, 10)
    cleanup()
  }

  var connect = function(done, config) {
    config = config || this.config
    
    var self = this
      , client

    this.isConnecting = true
    var connectionConfig = {
      host: config.host,
      port: config.port,
      user: config.username,
      password: config.password,
      db: config.database,
      metadata: true
    }

    if (config.dialectOptions) {
      Object.keys(config.dialectOptions).forEach(function (key) {
        connectionConfig[key] = config.dialectOptions[key];
      })
    }

    if (connectionConfig.unixSocket) {
      delete connectionConfig.host;
      delete connectionConfig.port;
    }

    client = new mariadb()
    client.connect(connectionConfig)
    client
      .on('error', function (err) {
        self.isConnecting = false

        done(err)
      })
      .on('connect', function () {
         client.setMaxListeners(self.maxConcurrentQueries)
         self.isConnecting = false
         if (config.pool.handleDisconnects) {
           handleDisconnect(self.pool, client)
         }
         done(null, client)
      })
      .on('close', function() {
        disconnect.call(self, client)
      })
  }

  var handleDisconnect = function(pool, client) {
    client.on('error', function(err) {
      if (err.code !== 'PROTOCOL_CONNECTION_LOST') {
        throw err
      }
      pool.destroy(client)
    })
  }

  var enqueue = function(queueItem, options) {
    options = options || {}
    if (this.activeQueue.length < this.maxConcurrentQueries) {
      this.activeQueue.push(queueItem)
      if (this.pool) {
        var self = this
        this.pool.acquire(function(err, client) {
          if (err) {
            queueItem.query.reject(err)
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
      var queueItem = this.queue.shift()
      if (queueItem) {
        enqueue.call(this, queueItem)
      }
    }
  }

  var afterQuery = function(queueItem) {
    dequeue.call(this, queueItem)
    transferQueuedItems.call(this, this.maxConcurrentQueries - this.activeQueue.length)
    disconnectIfNoConnections.call(this)
  }


  var execQueueItem = function(queueItem) {
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
