var Query   = require("./query")
  , Utils   = require("../../utils")
  , pg  = require("pg")
  , without = function(arr, elem) { return arr.filter(function(e) { return e != elem }) }

module.exports = (function() {
  var ConnectorManager = function(sequelize, config) {
    this.sequelize = sequelize
    this.client = null
    this.config = config || {}
    this.pooling = (this.config.pool != undefined && this.config.pool.maxConnections > 0)
    // set pooling parameters if specified
    if (this.pooling) {
      pg.defaults.poolSize = this.config.pool.maxConnections || 10
      pg.defaults.poolIdleTimeout = this.config.pool.maxIdleTime || 30000
    }
    this.disconnectTimeoutId = null
    this.pendingQueries = 0
    this.queue = [];
    this.activeQueue = [];
    this.maxConcurrentQueries = (this.config.maxConcurrentQueries || 50)
    var self = this;

    this.uri = this.sequelize.getQueryInterface().QueryGenerator.databaseConnectionUri(this.config)

    process.on('exit', function() {
      if (self.pooling) {
        pg.end(self.uri); //Disconnect all connections in pool
      } else {
        self.disconnect();
      }
    });
  }

  Utils._.extend(ConnectorManager.prototype, require("../connector-manager").prototype)

  var isConnecting = false
  var isConnected  = false

  ConnectorManager.prototype.query = function(sql, callee, options) {
    var self = this

    if (!this.isConnected && !this.pooling) {
      this.connect();
    }

    var queueItem = {
      query: new Query(this.client, callee, options || {}),
      sql: sql
    };

    enqueue.call(this, queueItem);

    return queueItem.query;
  }

  ConnectorManager.prototype.connect = function() {
    var self = this

    // in case database is slow to connect, prevent orphaning the client
    if (this.isConnecting || this.pooling) return
    this.isConnecting = true
    this.isConnected  = false

    this.client = new pg.Client(this.uri);

    var connectCallback = function(err, client) {
      self.isConnecting = false
      if (!err && client) {
        client.query("SET TIME ZONE 'UTC'")
          .on('end', function() {
            self.isConnected = true
            this.client = client
          });
      } else {
        this.client = null
      }
    }

    //create one-off client
    this.client = new pg.Client(this.uri)
    this.client.connect(connectCallback)
  }

  ConnectorManager.prototype.disconnect = function() {
    if (this.client) this.client.end()
    this.client = null
    this.isConnecting = false
    this.isConnected  = false
  }

  var enqueue = function(queueItem) {
    var self = this;

    if (this.activeQueue.length < this.maxConcurrentQueries) {
      this.activeQueue.push(queueItem);
      if (this.pooling) {
        //Get connection from pg pool
        pg.connect(this.uri, function(err, client) {
          if (err) {
            queueItem.query.emit('error', err);
            return;
          }

          queueItem.query.client = client;
          execQueueItem.call(self, queueItem);
        });
      } else {
        execQueueItem.call(this, queueItem);
      }
    } else {
      this.queue.push(queueItem);
    }
  };

  var dequeue = function(queueItem) {
    //Pooled connections are automatically returned
    this.activeQueue = without(this.activeQueue, queueItem);
  };

  var transferQueuedItems = function(count) {
    for (var i = 0; i < count; i++) {
      var queueItem = this.queue[0];
      if (queueItem) {
        enqueue.call(this, queueItem);
        this.queue = without(this.queue, queueItem)
      }
    }
  };

  var execQueueItem = function(queueItem) {
    var self = this;

    queueItem.query
      .success(function() { afterQuery.call(self, queueItem); })
      .error(function() { afterQuery.call(self, queueItem); });

    queueItem.query.run(queueItem.sql);
  };

  var afterQuery = function(queueItem) {
    dequeue.call(this, queueItem);
    transferQueuedItems.call(this, this.maxConcurrentQueries - this.activeQueue.length);
    disconnectIfNoConnections.call(this);
  };

  ConnectorManager.prototype.__defineGetter__('hasQueuedItems', function() {
    return (this.queue.length > 0) || (this.activeQueue.length > 0) || (this.client && this.client._queue && (this.client._queue.length > 0))
  });

  var disconnectIfNoConnections = function() {
    var self = this;

    this.disconnectTimeoutId && clearTimeout(this.disconnectTimeoutId);
    this.disconnectTimeoutId = setTimeout(function() {
      self.isConnected && !self.hasQueuedItems && self.disconnect()
    }, 100);
  };

  return ConnectorManager
})()
