var Query   = require("./query")
  , Utils   = require("../../utils")
  , without = function(arr, elem) { return arr.filter(function(e) { return e != elem }) }
  , util    = require("util")
  , events  = require("events")

module.exports = (function() {
  var ConnectorManager = function(sequelize, config) {
    events.EventEmitter.call(this)
    this.sequelize = sequelize
    this.client = null
    this.config = config || {}
    this.disconnectTimeoutId = null
    this.pendingQueries = 0
    this.maxConcurrentQueries = (this.config.maxConcurrentQueries || 50)
  }
  Utils._.extend(ConnectorManager.prototype, require("../connector-manager").prototype)
  util.inherits(ConnectorManager, events.EventEmitter)

  var isConnecting = false
  var isConnected  = false

  ConnectorManager.prototype.query = function(sql, callee, options) {
    var self = this
    var query = new Query(this, callee, options || {})
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

  ConnectorManager.prototype.connect = function(done) {
    var self = this

    if (self.isConnected) {
      if (done)
        done()
      return
    }

    // in case database is slow to connect, prevent orphaning the client
    if (self.isConnecting) {
      setTimeout(function() {
        self.connect(done)
      }, 10)
      return
    }

    self.isConnecting = true
    self.isConnected  = false

    var conStr = 'tcp://<%= user %>:<%= password %>@<%= host %>:<%= port %>/<%= database %>'
    conStr = Utils._.template(conStr)({
      user: self.config.username,
      password: self.config.password,
      database: self.config.database,
      host: self.config.host,
      port: self.config.port
    })

    var pg = require("pg")
    self.client = new pg.Client(conStr)

    self.client.connect(function(err, client) {
      self.isConnecting = false

      if (err || !client) {
        self.client = null
        if (done)
          done(err ? err : 'Failed to create client.')
        return
      }

      if (self.config.utcoffset != null) {
        client.query("SET TIME ZONE INTERVAL '" + self.config.utcoffset + "' HOUR TO MINUTE")
          .on('end', function() {
            self.isConnected = true
            self.client = client
            self.emit('connect', this.client)
            if (done)
              done()
          }).on('error', function(error) {
            self.client = null;
            if (done)
              done(error)
          });
      } else {
        self.isConnected = true
        self.client = client
        self.emit('connect', this.client)
        if (done)
          done()
      }
    })
  }

  ConnectorManager.prototype.disconnect = function() {
    var self = this
    if (this.client) this.client.end()
    this.client = null
    this.isConnecting = false
    this.isConnected  = false
    this.emit('disconnect')
  }

  return ConnectorManager
})()
