var Query   = require("./query")
  , Utils   = require("../../utils")

module.exports = (function() {
  var ConnectorManager = function(sequelize, config) {
    this.sequelize = sequelize
    this.config = config || {}
    this.pooling = (this.config.pool != null && this.config.pool.maxConnections > 0)
    this.uri = this.config.uri || this.sequelize.getQueryInterface().QueryGenerator.databaseConnectionUri(this.config)
    if(!this.client) {
      if (this.pooling) {
        this.pg = require("pg").native;
        this.pg.defaults.poolSize = this.config.pool.maxConnections
        this.pg.defaults.poolIdleTimeout = this.config.pool.maxIdleTime
      } else {
        this.client = new require("pg").native.Client(this.uri);
      }
    }
    var self = this;
    if (this.client) {
      this.connect = function(callback) {
        self.client.connect(function(err) {
          callback(err, self.client);
        });
      }
    } else {
      this.connect = function(callback) {
        self.pg.connect(self.uri, callback);
      }
    }
  }
  Utils._.extend(ConnectorManager.prototype, require("../connector-manager").prototype)

  ConnectorManager.prototype.query = function(sql, callee, options) {
    var query = new Query(this.connect, this.sequelize, callee, options || {})
    return query.run(sql)
  }

  return ConnectorManager
})()
