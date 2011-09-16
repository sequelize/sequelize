var ConnectorManager = module.exports = function(config) {
  this.client = null
  this.config = config
  this.clientRequests = 0
  this.disconnectTimeoutId = null
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

 this.client.setMaxListeners(999)
}

ConnectorManager.prototype.disconnect = function() {
  this.client.end()
}

ConnectorManager.prototype.reconnect = function() {
  this.clientRequests = 0
  this.disconnect()
  this.connect()
}

ConnectorManager.prototype.afterQuery = function() {
  this.clientRequests++

  this._reconnectIfTooManyConnections()
  this._disconnectIfNoConnections()
}

ConnectorManager.prototype.__defineGetter__('tooManyRequests', function() {
  return (this.clientRequests > 50)
})

ConnectorManager.prototype.__defineGetter__('hasNoConnections', function() {
  return this.client._queue && (this.client._queue.length == 0)
})

ConnectorManager.prototype.__defineGetter__('isConnected', function() {
  return this.client != null
})

// private

ConnectorManager.prototype._reconnectIfTooManyConnections = function() {
  this.tooManyRequests && this.reconnect()
}

ConnectorManager.prototype._disconnectIfNoConnections = function() {
  var self = this
  
  this.disconnectTimeoutId && clearTimeout(this.disconnectTimeoutId)
  this.disconnectTimeoutId = setTimeout(function() {
    self.isConnected && self.hasNoConnections && self.disconnect()
  }, 100)
}