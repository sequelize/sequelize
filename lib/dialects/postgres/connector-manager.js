var Query                = require("./query")
  , Utils                = require("../../utils")
  , ConnectionParameters = require('pg/lib/connection-parameters')

module.exports = (function() {
  var ConnectorManager = function(sequelize, config) {
    var pgModule = config.dialectModulePath || 'pg'

    this.sequelize = sequelize
    this.client         = null
    this.config         = config || {}
    this.config.port    = this.config.port || 5432
    this.pooling        = (!!this.config.pool && (this.config.pool.maxConnections > 0))
    this.pg             = this.config.native ? require(pgModule).native : require(pgModule)
    // Better support for BigInts
    // https://github.com/brianc/node-postgres/issues/166#issuecomment-9514935
    this.pg.types.setTypeParser(20, String);

    this.disconnectTimeoutId = null
    this.pendingQueries = 0
    this.clientDrained = true
    this.maxConcurrentQueries = (this.config.maxConcurrentQueries || 50)

    this.onProcessExit = function () {
      this.disconnect()
    }.bind(this);

    process.on('exit', this.onProcessExit)
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
    self.clientDrained = false

    return new Utils.CustomEventEmitter(function(emitter) {
      self.connect()
      .on('error', function(err) {
        emitter.emit('error', err)
      })
      .on('success', function(done) {
        var query = new Query(self.client, self.sequelize, callee, options || {})

        return query.run(sql)
          .complete(function(err) {
            self.endQuery.call(self)
            done && done(err) })
          .proxy(emitter)
      })
    }).run()
  }

  ConnectorManager.prototype.afterTransactionSetup = function(callback) {
    this.setTimezone(this.client, 'UTC', callback)
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

    var uri    = this.sequelize.getQueryInterface().QueryGenerator.databaseConnectionUri(this.config)
      , config = new ConnectionParameters(uri)

    // set pooling parameters if specified
    if (this.pooling) {
      config.poolSize           = this.config.pool.maxConnections || 10
      config.poolIdleTimeout    = this.config.pool.maxIdleTime    || 30000
      config.reapIntervalMillis = this.config.pool.reapInterval   || 1000
      config.uuid               = this.config.uuid
    }

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
        } else {
          emitter.emit('error', new Error(err.message))
        }
      } else if (client) {
        var timezoneCallback = function() {
          self.isConnected = true
          self.client = client
          emitter.emit('success', done)
        }

        if (self.config.keepDefaultTimezone) {
          Utils.tick(timezoneCallback)
        } else {
          self.setTimezone(client, 'UTC', timezoneCallback)
        }
      } else if (self.config.native) {
        self.setTimezone(self.client, 'UTC', function() {
          self.isConnected = true
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
      this.pg.connect(config, connectCallback)
    } else {
      if (!!this.client) {
        connectCallback(null, this.client)
      } else {
        //create one-off client

        var responded = false

        this.client = new this.pg.Client(config)
        this.client.connect(function(err, client, done) {
          responded = true
          connectCallback(err, client || self.client, done)
        })

        // If we didn't ever hear from the client.connect() callback the connection timeout, node-postgres does not treat this as an error since no active query was ever emitted
        this.client.on('end', function () {
          if (!responded) {
            connectCallback(new Error('Connection timed out'))
          }
        })

        // Closes a client correctly even if we have backed up queries
        // https://github.com/brianc/node-postgres/pull/346
        this.client.on('drain', function() {
          self.clientDrained = true
        })
      }
    }

    return emitter
  }

  ConnectorManager.prototype.setTimezone = function(client, timezone, callback) {
    client.query("SET TIME ZONE '" + (timezone || "UTC") + "'").on('end', callback)
  }

  ConnectorManager.prototype.disconnect = function() {
    if (this.client) {
      if (this.clientDrained) {
        this.client.end()
      }
      this.client = null
    }

    this.isConnecting = false
    this.isConnected  = false
  }

  return ConnectorManager
})()
