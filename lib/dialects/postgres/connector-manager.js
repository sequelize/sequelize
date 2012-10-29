var Query   = require("./query")
  , Utils   = require("../../utils")

module.exports = (function() {
  var ConnectorManager = function(sequelize, config) {
    this.sequelize = sequelize
    this.config = config || {}
    this.pooling = (this.config.pool != null && this.config.pool.maxConnections > 0)
    this.uri = this.config.uri || this.sequelize.getQueryInterface().QueryGenerator.databaseConnectionUri(this.config)
    if (this.pooling) {
      this.pg = require("pg").native;
      this.pg.defaults.poolSize = this.config.pool.maxConnections
      this.pg.defaults.poolIdleTimeout = this.config.pool.maxIdleTime
    } else {
      this.client = new require("pg").native.Client(this.uri);
    }

    if (this.client) {
      var connected;

      this.connect = function(callback) {
        if(connected) {
          return callback(null, this.client);
        }
        this.client.connect(function(err) {
          if(err) return callback(err);
          connected = true;
          return callback(null, this.client);
        }.bind(this));
      }.bind(this);
    } else {
      this.connect = function(callback) {
        this.pg.connect(this.uri, callback);
      }.bind(this);
    }
  }
  Utils._.extend(ConnectorManager.prototype, require("../connector-manager").prototype)

  ConnectorManager.prototype.query = function(sql, callee, options) {
    var query = new Query(this.connect, this.sequelize, callee, options || {})
    return query.run(sql)
  }

  return ConnectorManager
})()
