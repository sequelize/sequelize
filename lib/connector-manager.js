var Query   = require("./query")
  , without = function(arr, elem) { return arr.filter(function(e) { return e != elem }) }

var ConnectorManager = module.exports = function(config) {
  this.client = null
  this.config = config
  this.disconnectTimeoutId = null
  this.queue = []
  this.activeQueue = []
  this.maxConcurrentQueries = (this.config.maxConcurrentQueries || 50)
}

ConnectorManager.prototype.query = function(sql, callee, options) {
  if(!this.isConnected) this.connect()

  var queueItem = {
    query: new Query(this.client, callee, options || {}),
    sql: sql
  }

  this._enqueue(queueItem)

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

ConnectorManager.prototype.reconnect = function() {
  this.disconnect()
  this.connect()
}

// private

ConnectorManager.prototype._enqueue = function(queueItem) {
  if(this.activeQueue.length < this.maxConcurrentQueries) {
    this.activeQueue.push(queueItem)
    this._execQueueItem(queueItem)
  } else {
    this.queue.push(queueItem)
  }
}

ConnectorManager.prototype._dequeue = function(queueItem) {
  this.activeQueue = without(this.activeQueue, queueItem)
}

ConnectorManager.prototype._transferQueuedItems = function(count) {
  for(var i = 0; i < count; i++) {
    var queueItem = this.queue[0]
    if(queueItem) {
      this._enqueue(queueItem)
      this.queue = without(this.queue, queueItem)
    }
  }
}

ConnectorManager.prototype._afterQuery = function(queueItem) {
  var self = this

  this._dequeue(queueItem)
  this._transferQueuedItems(this.maxConcurrentQueries - this.activeQueue.length)
  this._disconnectIfNoConnections()
}


ConnectorManager.prototype._execQueueItem = function(queueItem) {
  var self = this

  queueItem.query
    .on('success', function(){ self._afterQuery(queueItem) })
    .on('failure', function(){ self._afterQuery(queueItem) })

  queueItem.query.run(queueItem.sql)
}

ConnectorManager.prototype.__defineGetter__('hasNoConnections', function() {
  return (this.queue.length == 0) && (this.activeQueue.length == 0) && this.client._queue && (this.client._queue.length == 0)
})

ConnectorManager.prototype.__defineGetter__('isConnected', function() {
  return this.client != null
})

ConnectorManager.prototype._disconnectIfNoConnections = function() {
  var self = this

  this.disconnectTimeoutId && clearTimeout(this.disconnectTimeoutId)
  this.disconnectTimeoutId = setTimeout(function() {
    self.isConnected && self.hasNoConnections && self.disconnect()
  }, 100)
}
