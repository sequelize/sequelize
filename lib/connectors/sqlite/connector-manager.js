var Utils   = require("../../utils")
  , sqlite3 = require('sqlite3').verbose()

module.exports = (function() {
  var ConnectorManager = function(sequelize, config) {
    this.sequelize = sequelize
  }
  Utils._.extend(ConnectorManager.prototype, require("../connector-manager").prototype)

  ConnectorManager.prototype.query = function(sql, callee, options) {
    return new Utils.CustomEventEmitter(function(emitter) {
      var db = new sqlite3.Database(':memory:')

      db.serialize(function() {
        db.run(sql, function(err, foo) {
          if(err)
            emitter.emit('failure', err)
          else
            emitter.emit('success', foo)
        })
      })

      db.close()
    }).run()
  }

  return ConnectorManager
})()





