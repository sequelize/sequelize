var Utils   = require("../../utils")
  , sqlite3 = require('sqlite3').verbose()
  , Query   = require("./query")

module.exports = (function() {
  var ConnectorManager = function(sequelize) {
    this.sequelize = sequelize
    this.database  = new sqlite3.Database(sequelize.options.storage || ':memory:')
    this.opened    = false
  }
  Utils._.extend(ConnectorManager.prototype, require("../connector-manager").prototype)

  ConnectorManager.prototype.query = function(sql, callee, options) {
    var self = this
    // Turn on foreign key checking (if the database has any) unless explicitly
    // disallowed globally.
    if(!this.opened && this.sequelize.options.foreignKeys !== false) {
      this.database.serialize(function() {
        self.database.run("PRAGMA FOREIGN_KEYS = ON")
        self.opened = true
      })
    }

    return new Query(this.database, this.sequelize, callee, options).run(sql)
  }

  return ConnectorManager
})()
