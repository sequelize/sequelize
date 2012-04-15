var Query   = require("./query")
  , Utils   = require("../../utils")
  , without = function(arr, elem) { return arr.filter(function(e) { return e != elem }) }

module.exports = (function() {
  var ConnectorManager = function(sequelize, config) {
    this.sequelize = sequelize
    this.client = null
    this.config = config || {}
    this.disconnectTimeoutId = null
    this.pendingQueries = 0
    this.maxConcurrentQueries = (this.config.maxConcurrentQueries || 50)
  }
  Utils._.extend(ConnectorManager.prototype, require("../connector-manager").prototype)

  var isConnecting = false
  var isConnected  = false

  ConnectorManager.prototype.query = function(sql, callee, options) {
    var self = this
    if (this.client == null) this.connect()
    var query = new Query(this.client, callee, options || {})
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

    // in case database is slow to connect, prevent orphaning the client
    if (this.isConnecting) return
    this.isConnecting = true
    this.isConnected  = false

    var conStr = 'tcp://<%= user %>:<%= password %>@<%= host %>:<%= port %>/<%= database %>'
    conStr = Utils._.template(conStr)({
      user: this.config.username,
      password: this.config.password,
      database: this.config.database,
      host: this.config.host,
      port: this.config.port
    })

    var pg = require("pg")
    this.client = new pg.Client(conStr)

    this.client.connect(function(err, client) {
      self.isConnecting = false
      if (!err && client) {
        client.query("SET TIME ZONE 'UTC'")
          .on('end', function() {
            self.isConnected = true
            this.client = client
          });
      } else {
        this.client = null
      }
    })
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
