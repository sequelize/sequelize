var Utils   = require("../../utils")
  , sqlite3 = require('sqlite3').verbose()
  , Query   = require("./query")

module.exports = (function() {
  var ConnectorManager = function(sequelize) {
    this.sequelize = sequelize
  }

  Utils._.extend(ConnectorManager.prototype, require("../connector-manager").prototype)

  ConnectorManager.prototype.connect = function() {
    var emitter = new (require('events').EventEmitter)()
      , self = this

    this.database = db = new sqlite3.Database(self.sequelize.options.storage || ':memory:', function(err) {
      if (err) {
        if (err.code === "SQLITE_CANTOPEN") {
          emitter.emit('error', new Error("Failed to find SQL server. Please double check your settings."))
        }
      }

      if(!err && self.sequelize.options.foreignKeys !== false) {
        // Make it possible to define and use foreign key constraints unless
        // explicitly disallowed. It's still opt-in per relation
        db.run('PRAGMA FOREIGN_KEYS=ON')
      }
    })
  }

  ConnectorManager.prototype.query = function(sql, callee, options) {
    if (!this.database) {
      this.connect()
    }

    return new Query(this.database, this.sequelize, callee, options).run(sql)
  }

  return ConnectorManager
})()
