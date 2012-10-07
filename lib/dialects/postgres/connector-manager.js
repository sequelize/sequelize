var Query   = require("./query")
  , Utils   = require("../../utils")
  , pg  = require("pg")
  , pooling = require("generic-pool")
  , without = function(arr, elem) { return arr.filter(function(e) { return e != elem })}

module.exports = (function() {
  var ConnectorManager = function(sequelize, config) {
    this.sequelize = sequelize
    this.client = null
    this.config = config || {}
    this.disconnectTimeoutId = null
    this.queue = []
    this.activeQueue = []
    this.maxConcurrentQueries = (this.config.maxConcurrentQueries || 50)
    this.pooling = (this.config.pool != null && this.config.pool.maxConnections > 0)
    var self = this
    //create pool if specified
    if (this.pooling) {
      pg.defaults.poolSize = this.config.pool.maxConnections
      pg.defaults.poolIdleTimeout = this.config.pool.maxIdleTime

      this.pool = pooling.Pool({
        name     : 'postgres',
        create   : function(callback) {
          var Client = pg.Client
          var c = new Client()
          c.user     = self.config.username
          c.password = self.config.password
          c.port     = self.config.port
          c.database = self.config.database
          c.connect()
          callback(null, c)
        },
        destroy  : function(client) { client.end() },
        max      : 10,
        // specifies how long a resource can stay idle in pool before being removed
        idleTimeoutMillis : 30000,
        // if true, logs via console.log - can also be a function
        log : self.config.pool.log || false
      })
    }
    this.disconnectTimeoutId = null
    this.pendingQueries = 0
    this.maxConcurrentQueries = (this.config.maxConcurrentQueries || 50)
  }
  Utils._.extend(ConnectorManager.prototype, require("../connector-manager").prototype)

  var isConnecting = false
  var isConnected  = false

  ConnectorManager.prototype.query = function(sql, callee, options) {
    var self = this
    if (this.client == null) this.connect()
    var queueItem = {
      query: new Query(this.client, callee, options || {}),
      sql: sql
    }
    enqueue.call(this, queueItem)
    return queueItem.query
  }

  var dequeue = function(queueItem) {
    if (this.pool) {
      this.pool.release(queueItem.client)
    }
    this.activeQueue = without(this.activeQueue, queueItem)
  }

  var transferQueuedItems = function(count) {
    for(var i = 0; i < count; i++) {
      var queueItem = this.queue[0]
      if(queueItem) {
        enqueue.call(this, queueItem)
        this.queue = without(this.queue, queueItem)
      }
    }
  }

  var execQueueItem = function(queueItem) {
    var self = this
    queueItem.query
      .success(function(){ afterQuery.call(self, queueItem) })
      .error(function(){ afterQuery.call(self, queueItem) })
    queueItem.query.run(queueItem.sql, queueItem.client)
  }

  var afterQuery = function(queueItem) {
    var self = this
    dequeue.call(this, queueItem)
    transferQueuedItems.call(this, this.maxConcurrentQueries - this.activeQueue.length)
    disconnectIfNoConnections.call(this)
  }

  var disconnectIfNoConnections = function() {
    var self = this
    this.disconnectTimeoutId && clearTimeout(this.disconnectTimeoutId)
    this.disconnectTimeoutId = setTimeout(function() {
        self.isConnected && !self.hasQueuedItems && self.disconnect()
    }, 100)
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

  ConnectorManager.prototype.connect = function() {
    var self = this

    // in case database is slow to connect, prevent orphaning the client
    if (this.isConnecting) return
    this.isConnecting = true
    this.isConnected  = false

    var uri = this.sequelize.getQueryInterface().QueryGenerator.databaseConnectionUri(this.config)

    var connectCallback = function(err, client) {
      self.isConnecting = false
      if (!err && client) {
        client.query("SET TIME ZONE 'UTC'")
          .on('end', function() {
            self.isConnected = true
            this.client = client
          })
      } else {
        this.client = null
      }
    }

    if (this.pooling) {
      self.pool.acquire(function(err, client) {
        if (err) {
          console.log("Error init pool object")
          return
        }
        else {
          self.client = client
        }
      })

    } else {
      //create one-off client
      this.client = new pg.Client(uri)
      this.client.connect(connectCallback)
    }
  }

  ConnectorManager.prototype.disconnect = function() {
    var self = this
    if (this.client) this.client.end()
    this.client = null
    this.isConnecting = false
    this.isConnected  = false
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

  return ConnectorManager
})()
