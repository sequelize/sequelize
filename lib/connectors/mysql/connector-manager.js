var Query   = require("../../query")
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
  }
  Utils._.extend(ConnectorManager.prototype, require("../connector-manager").prototype)

  ConnectorManager.prototype.query = function(sql, callee, options) {
    if(!this.isConnected) this.connect()

    var queueItem = {
      query: new Query(this.client, callee, options || {}),
      sql: sql
    }

    enqueue.call(this, queueItem)

    return queueItem.query
  }

  ConnectorManager.prototype.connect = function() {
    var self = this

    this.client = require("mysql").createClient({
      user: this.config.username,
      password: this.config.password,
      host: this.config.host,
      port: this.config.port,
      database: this.config.database
    })

   this.client.setMaxListeners(this.maxConcurrentQueries)
  }

  ConnectorManager.prototype.disconnect = function() {
    var self = this
    this.client.end(function() { self.client = null })
  }

  // private

  var enqueue = function(queueItem) {
    if(this.activeQueue.length < this.maxConcurrentQueries) {
      this.activeQueue.push(queueItem)
      execQueueItem.call(this, queueItem)
    } else {
      this.queue.push(queueItem)
    }
  }

  var dequeue = function(queueItem) {
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
      .on('success', function(){ afterQuery.call(self, queueItem) })
      .on('failure', function(){ afterQuery.call(self, queueItem) })

    queueItem.query.run(queueItem.sql)
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
