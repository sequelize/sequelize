var Query   = require("./query")
  , Utils   = require("../../utils")

module.exports = (function() {
  var ConnectorManager = function(sequelize, config) {
    var pgModule = config.dialectModulePath || 'pg'

    this.sequelize = sequelize
    this.client       = null
    this.config       = config || {}
    this.config.port  = this.config.port || 5432
    this.pooling      = (!!this.config.poolCfg && (this.config.poolCfg.maxConnections > 0))
    this.pg           = this.config.native ? require(pgModule).native : require(pgModule)

    // Better support for BigInts
    // https://github.com/brianc/node-postgres/issues/166#issuecomment-9514935
    this.pg.types.setTypeParser(20, String);

    // set pooling parameters if specified
    if (this.pooling) {
      this.pg.defaults.poolSize        = this.config.pool.maxConnections
      this.pg.defaults.poolIdleTimeout = this.config.pool.maxIdleTime
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

    self.pendingQueries += 1

    return new Utils.CustomEventEmitter(function(emitter) {
      self.connect(function(err, client) {
        if (!!err) {
          return emitter.emit('error', err)
        }

        var query = new Query(client, self.sequelize, callee, options || {})

        return query.run(sql)
          .success(function() { self.endQuery.call(self) })
          .error(function() { self.endQuery.call(self) })
          .proxy(emitter)
      })
    }).run()
  }

  ConnectorManager.prototype.endQuery = function() {
    var self = this
    self.pendingQueries--
    if (self.pendingQueries === 0) {
      setTimeout(function() {
        self.pendingQueries === 0 && self.disconnect.call(self)
      }, 100)
    }
  }

  ConnectorManager.prototype.connect = function(callback) {
    var self = this

    // in case database is slow to connect, prevent orphaning the client
    if (this.isConnecting) {
      return callback(null)
    }

    this.isConnecting = true
    this.isConnected  = false

    var uri = this.sequelize.getQueryInterface().QueryGenerator.databaseConnectionUri(this.config)

    var connectCallback = function(err, client) {
      self.isConnecting = false

      if (!!err) {
        switch(err.code) {
        case 'ECONNREFUSED':
          return callback(new Error('Failed to authenticate for PostgresSQL. Please double check your settings.'))
          break
        case 'ENOTFOUND':
        case 'EHOSTUNREACH':
        case 'EINVAL':
          return callback(new Error('Failed to find PostgresSQL server. Please double check your settings.'))
          break
        default:
          return callback(err)
        }
      } else if (client) {
        client.query("SET TIME ZONE 'UTC'").on('end', function() {
          self.isConnected = true
          self.client = client
          callback(null, client)
        });
      } else {
        self.client = null
        callback(null)
      }
    }

    if (this.pooling) {
      // acquire client from pool
      this.pg.connect(uri, connectCallback)
    } else {
      //create one-off client
      if (this.client === null) {
        this.client = new this.pg.Client(uri)
        this.client.connect(connectCallback)
      } else {
        connectCallback(null, this.client)
      }
    }
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
