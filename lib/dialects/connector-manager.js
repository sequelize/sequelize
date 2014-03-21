module.exports = (function(){
  var ConnectorManager = function(sequelize, config) {
    throw new Error('Define the constructor!')
  }

  ConnectorManager.prototype.query = function(sql, callee, options) {
    throw new Error('Define the query method!')
  }

  ConnectorManager.prototype.afterTransactionSetup = function(callback) {
    callback()
  }

  ConnectorManager.prototype.connect = function() {
    throw new Error('Define the connect method!')
  }

  ConnectorManager.prototype.disconnect = function() {
    throw new Error('Define the disconnect method!')
  }

  ConnectorManager.prototype.reconnect = function() {
    this.disconnect()
    this.connect()
  }

  ConnectorManager.prototype.cleanup = function() {
    if (this.onProcessExit) {
      process.removeListener('exit', this.onProcessExit)
    }
  }

  return ConnectorManager
})()
