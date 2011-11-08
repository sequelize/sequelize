var ConnectorManager = module.exports = function(sequelize, config) {
  throw new Error('Define the constructor!')
}

ConnectorManager.prototype.getQueryGenerator = function() {
  this.__QueryGenerator = this.__QueryGenerator || require(__dirname + '/' + this.sequelize.options.connector + '/query-generator')
  return this.__QueryGenerator
}

ConnectorManager.prototype.query = function(sql, callee, options) {
  throw new Error('Define the query method!')
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
