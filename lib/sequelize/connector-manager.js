var ConnectorManager = module.exports = function(config) {
  this.connectorCheckTimeoutId = null
  this.client = null
  this.config = config
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
  this.client.setMaxListeners(100)
}

ConnectorManager.prototype.disconnect = function() {
  var self = this
  this.client.end(function() {
    self.client = null
    self.connectorCheckTimeoutId = null
  })
}

ConnectorManager.prototype.check = function() {
  var self = this

  this.connectorCheckTimeoutId && clearTimeout(this.connectorCheckTimeoutId)
  this.connectorCheckTimeoutId = setTimeout(function() {
    if(self.client && self.client._queue && (self.client._queue.length === 0))
      self.disconnect()
  }, 100)
}

ConnectorManager.prototype.__defineGetter__('isConnected', function() {
  return (this.client !== null)
})