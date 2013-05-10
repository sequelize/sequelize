var Utils   = require("../../utils")
  , sqlite3 = require('sqlite3').verbose()
  , Query   = require("./query")

module.exports = (function() {
  var ConnectorManager = function(sequelize) {
    this.sequelize = sequelize
    this.database  = db = new sqlite3.Database(sequelize.options.storage || ':memory:', function(err) {
      if(!err && sequelize.options.foreignKeys !== false) {
        // Make it possible to define and use foreign key constraints unless
        // explicitly disallowed. It's still opt-in per relation
        db.run('PRAGMA FOREIGN_KEYS=ON')
      }
    })
  }
  Utils._.extend(ConnectorManager.prototype, require("../connector-manager").prototype)

  ConnectorManager.prototype.query = function(sql, callee, options) {
    return new Query(this.database, this.sequelize, callee, options).run(sql)
  }

  return ConnectorManager
})()
