Utils = require('./utils')

var TransactionManager = module.exports = function(sequelize) {
  this.sequelize         = sequelize
  this.connectorManagers = {}

  try {
    this.ConnectorManager = require("./dialects/" + sequelize.getDialect() + "/connector-manager")
  } catch(err) {
    throw new Error("The dialect " + sequelize.getDialect() + " is not supported.")
  }
}

TransactionManager.prototype.getConnectorManager = function(uuid) {
  uuid = uuid || 'default'

  if (!this.connectorManagers.hasOwnProperty(uuid)) {
    var config = Utils._.extend({ uuid: uuid }, this.sequelize.config)

    if (uuid !== 'default') {
      config.pool = { maxConnections: 1, useReplicaton: false }
    }

    this.connectorManagers[uuid] = new this.ConnectorManager(this.sequelize, config)
  }

  return this.connectorManagers[uuid]
}

TransactionManager.prototype.query = function(sql, callee, options) {
  var uuid = 'default'

  if (options && options.transaction) {
    uuid = options.transaction.id
  }

  return this.getConnectorManager(uuid).query(sql, callee, options)
}
