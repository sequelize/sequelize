var Query   = require("./query")
  , Utils   = require("../../utils")

module.exports = (function() {
  var ConnectorManager = function(sequelize, config) {
    this.sequelize = sequelize
    this.client       = null
    this.config       = config || {}
    this.config.port  = this.config.port || 5432
    this.pooling      = (!!this.config.poolCfg && (this.config.poolCfg.maxConnections > 0))
    this.pg           = this.config.native ? require('pg').native : require('pg')

    // set pooling parameters if specified
    if (this.pooling) {
      this.pg.defaults.poolSize        = this.config.poolCfg.maxConnections
      this.pg.defaults.poolIdleTimeout = this.config.poolCfg.maxIdleTime
    }

    this.disconnectTimeoutId = null
    this.pendingQueries = 0
    this.maxConcurrentQueries = (this.config.maxConcurrentQueries || 50)
  }
  Utils._.extend(ConnectorManager.prototype, require("../connector-manager").prototype)

  var isConnecting = false
  var isConnected  = false

  ConnectorManager.prototype.query = function(sql, callee, options) {
    var self = this
    if (this.client == null) {
      this.connect()
    }

    var query = new Query(this.client, this.sequelize, callee, options || {})

    self.pendingQueries += 1

    return query.run(sql)
      .success(function() { self.endQuery.call(self) })
      .error(function() { self.endQuery.call(self) })
  }

  ConnectorManager.prototype.endQuery = function() {
    var self = this
    self.pendingQueries -= 1
    if (self.pendingQueries == 0) {
      setTimeout(function() {
        self.pendingQueries == 0 && self.disconnect.call(self)
      }, 100)
    }
  }

  ConnectorManager.prototype.connect = function() {
    var self = this
    var emitter = new (require('events').EventEmitter)()

    // in case database is slow to connect, prevent orphaning the client
    if (this.isConnecting) {
      return
    }

    this.isConnecting = true
    this.isConnected  = false

    var uri = this.sequelize.getQueryInterface().QueryGenerator.databaseConnectionUri(this.config)

    var connectCallback = function(err, client) {
      self.isConnecting = false

      if (!!err) {
        emitter.emit('error', err)
      } else if (client) {
        client.query("SET TIME ZONE 'UTC'")
          .on('end', function() {
            self.isConnected = true
            this.client = client
          });
      } else {
        this.client = null
      }
    }

    if (this.pooling) {
      // acquire client from pool
      this.pg.connect(uri, connectCallback)
    } else {
      //create one-off client
      this.client = new this.pg.Client(uri)
      this.client.connect(connectCallback)
    }

    return emitter
  }

  ConnectorManager.prototype.disconnect = function() {
    var self = this
    if (this.client) this.client.end()
    this.client = null
    this.isConnecting = false
    this.isConnected  = false
  }

  return ConnectorManager
})()
