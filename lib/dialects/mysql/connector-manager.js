var  Pooling = require('generic-pool')
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
    if (this.poolCfg) {
      //the user has requested pooling, so create our connection pool
      if (!this.poolCfg.maxConnections) {
        this.poolCfg.maxConnections = 10
      }
      var self = this
      this.pool = Pooling.Pool({
        name: 'sequelize-mysql',
        create: function (done) {
            connect(self, done)
        },
        destroy: function(client) {
            disconnect(null, client)
        },
        max: self.poolCfg.maxConnections,
        idleTimeoutMillis: self.poolCfg.maxIdleTime
      })
    }
  }
  Utils._.extend(ConnectorManager.prototype, require("../connector-manager").prototype)

  var isConnecting = false

  ConnectorManager.prototype.query = function(sql, callee, options) {

    if(!this.isConnected && !this.pool) this.connect()

    var queueItem = {
      query: new Query(this.client, callee, options || {}),
      sql: sql
    }

    enqueue.call(this, queueItem)

    return queueItem.query
  }

  ConnectorManager.prototype.connect = function() {
    var self = this
    // in case database is slow to connect, prevent orphaning the client
    if (this.isConnecting || this.pool) {
      return
    }
    connect(self, function(err, client) {
      self.client = client
      return
    })
    return
  }

  ConnectorManager.prototype.disconnect = function() {
    if (this.client)
      disconnect(this, this.client)
  }

  // private

  var disconnect = function(self, client) {
    client.end(function() {
      var intervalObj = null
      var cleanup = function () {
        var retryCt = 0
        // make sure to let client finish before calling destroy
        if (self && !self.hasNoConnections) {
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

  var connect = function(self, done) {
    var client = require("mysql").createClient({
      user: self.config.username,
      password: self.config.password,
      host: self.config.host,
      port: self.config.port,
      database: self.config.database
    })
    client.setMaxListeners(self.maxConcurrentQueries)
    self.isConnecting = false
    done(null, client)
    return
  }

  var enqueue = function(queueItem) {
    if(this.activeQueue.length < this.maxConcurrentQueries) {
      this.activeQueue.push(queueItem)
      if (this.pool) {
        var self = this
        this.pool.acquire(function(err, client) {
          if (err) {
            queueItem.query.emit('failure', err)
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
      var queueItem = this.queue[0]
      if(queueItem) {
        enqueue.call(this, queueItem)
        this.queue = without(this.queue, queueItem)
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

  ConnectorManager.prototype.__defineGetter__('hasNoConnections', function() {
    return (this.queue.length == 0) && (this.activeQueue.length == 0) && this.client._queue && (this.client._queue.length == 0)
  })

  ConnectorManager.prototype.__defineGetter__('isConnected', function() {
    return this.client != null
  })

  var disconnectIfNoConnections = function() {
    var self = this

    this.disconnectTimeoutId && clearTimeout(this.disconnectTimeoutId)
    this.disconnectTimeoutId = setTimeout(function() {
      self.isConnected && self.hasNoConnections && self.disconnect()
    }, 100)
  }

  return ConnectorManager
})()
