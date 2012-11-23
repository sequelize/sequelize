var mysql   = require("mysql")
  , Pooling = require('generic-pool')
  , Query   = require("./query")
  , Utils   = require("../../utils")
  , without = function(arr, elem) { return arr.filter(function(e) { return e != elem }) }

module.exports = (function() {
  var ConnectorManager = function(sequelize, config) {
    this.sequelize = sequelize
    this.client = null
    this.config = config || {}
    this.disconnectTimeoutId = null
    this.queue = []
    this.activeQueue = []
    this.maxConcurrentQueries = (this.config.maxConcurrentQueries || 50)
    this.poolCfg = this.config.pool
    this.pendingQueries = 0;
    this.useQueue = config.queue !== undefined ? config.queue : true;

    var self = this

    if (this.poolCfg) {
      //the user has requested pooling, so create our connection pool
      if (!this.poolCfg.maxConnections) {
        this.poolCfg.maxConnections = 10
      }
      if (!this.poolCfg.minConnections) {
        this.poolCfg.minConnections = 0
      }
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
    if (!this.isConnected && !this.pool) this.connect();

    if (this.useQueue) {
      var queueItem = {
        query: new Query(this.client, this.sequelize, callee, options || {}),
        sql: sql
      };

      enqueue.call(this, queueItem);
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

    if (!this.pool) query.run(sql);
    else {
      this.pool.acquire(function(err, client) {
        if (err) return query.emit('error', err);

        query.client = client;
        query.run(sql);
        return;
      });
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
    if (!this.useQueue) this.client = null;
    client.end(function() {
      if (!self.useQueue) return client.destroy();

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

  var connect = function(done) {
    var connection = mysql.createConnection({
      host: this.config.host,
      port: this.config.port,
      user: this.config.username,
      password: this.config.password,
      database: this.config.database
    })
    // client.setMaxListeners(self.maxConcurrentQueries)
    this.isConnecting = false

    done(null, connection)
  }

  var enqueue = function(queueItem) {
    if(this.activeQueue.length < this.maxConcurrentQueries) {
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
        })
      }
      else
      {
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
      if(queueItem) {
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