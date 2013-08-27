var Query   = require("./query")
  , Utils   = require("../../utils")

module.exports = (function() {
  var ConnectorManager = function(sequelize, config) {
    var pgModule = config.dialectModulePath || 'pg'

    this.sequelize = sequelize
    this.client         = null
    this.config         = config || {}
    this.config.port    = this.config.port || 5432
    this.pooling        = (!!this.config.pool && (this.config.pool.maxConnections > 0))
    this.pg             = this.config.native ? require(pgModule).native : require(pgModule)
    this.poolIdentifier = null

    // Better support for BigInts
    // https://github.com/brianc/node-postgres/issues/166#issuecomment-9514935
    this.pg.types.setTypeParser(20, String);

    // set pooling parameters if specified
    if (this.pooling) {
      this.pg.defaults.poolSize           = this.config.pool.maxConnections
      this.pg.defaults.poolIdleTimeout    = this.config.pool.maxIdleTime
      this.pg.defaults.reapIntervalMillis = this.config.pool.reapInterval || 1000
    }

    this.disconnectTimeoutId = null
    this.pendingQueries = 0
    this.maxConcurrentQueries = (this.config.maxConcurrentQueries || 50)

    process.on('exit', function() {
      this.disconnect()
    }.bind(this))
  }
  Utils._.extend(ConnectorManager.prototype, require("../connector-manager").prototype)

  ConnectorManager.prototype.endQuery = function() {
    var self = this

    self.pendingQueries--

    if (!self.pooling && self.pendingQueries === 0) {
      setTimeout(function() {
        self.pendingQueries === 0 && self.disconnect.call(self)
      }, 100)
    }
  }

  ConnectorManager.prototype.query = function(sql, callee, options) {
    var self = this

    self.pendingQueries++

    return new Utils.CustomEventEmitter(function(emitter) {
      self.connect()
      .on('error', function(err) {
        emitter.emit('error', err)
      })
      .on('success', function(done) {
        var query = new Query(self.client, self.sequelize, callee, options || {})

        return query.run(sql)
          .complete(function(err) { done && done(err) })
          .success(function(results) { self.endQuery.call(self) })
          .error(function(err) { self.endQuery.call(self) })
          .proxy(emitter)
      })
    }).run()
  }

  ConnectorManager.prototype.connect = function(callback) {
    var self = this
    var emitter = new (require('events').EventEmitter)()

    // in case database is slow to connect, prevent orphaning the client
    // TODO: We really need some sort of queue/flush/drain mechanism
    if (this.isConnecting && !this.pooling && this.client === null) {
      emitter.emit('success', null)
      return emitter
    }

    this.isConnecting = true
    this.isConnected  = false

    var uri = this.sequelize.getQueryInterface().QueryGenerator.databaseConnectionUri(this.config)

    var connectCallback = function(err, client, done) {
      self.isConnecting = false

      if (!!err) {
        // release the pool immediately, very important.
        done && done(err)
        self.client = null

        if (err.code) {
          switch(err.code) {
          case 'ECONNREFUSED':
            emitter.emit('error', new Error("Failed to authenticate for PostgresSQL. Please double check your settings."))
            break
          case 'ENOTFOUND':
          case 'EHOSTUNREACH':
          case 'EINVAL':
            emitter.emit('error', new Error("Failed to find PostgresSQL server. Please double check your settings."))
            break
          default:
            emitter.emit('error', err)
            break
          }
        }
      } else if (client) {
        client.query("SET TIME ZONE 'UTC'").on('end', function() {
          self.isConnected = true
          self.client = client
          emitter.emit('success', done)
        })
      } else {
        done && done()
        self.client = null
        emitter.emit('success')
      }
    }

    if (this.pooling) {
      // acquire client from pool
      this.pg.connect(uri, connectCallback)
    } else {
      if (!!this.client) {
        connectCallback(null, this.client)
      } else {
        //create one-off client
        this.client = new this.pg.Client(uri)
        this.client.connect(connectCallback)
      }
    }

    return emitter
  }

  ConnectorManager.prototype.disconnect = function() {
    if (this.poolIdentifier) {
      this.poolIdentifier.destroyAllNow()
    }

    if (this.client) {
      this.client.end.bind(this.client)
    }

    this.isConnecting = false
    this.isConnected  = false
  }

  return ConnectorManager
})()