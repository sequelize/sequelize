var Utils         = require("../../utils")
  , AbstractQuery = require('../abstract/query')

module.exports = (function() {
  var Query = function(client, sequelize, callee, options) {
    this.client    = client
    this.callee    = callee
    this.sequelize = sequelize
    this.options   = Utils._.extend({
      logging: console.log,
      plain: false,
      raw: false
    }, options || {})

    this.checkLoggingOption()
  }

  Utils.inherit(Query, AbstractQuery)
  var tk = require('timekit');
  Query.prototype.run = function(sql) {
    var start = tk.time();
    this.sql = sql

    if(this.options.logging !== false) {
      this.options.logging('Executing: ' + this.sql)
    }

    this.client.query(this.sql, function(err, results, fields) {
      this.sequelize._metric('SQL', tk.time() - start);
      this.emit('sql', this.sql)
      
      if (err) {
        this.emit('error', err, this.callee)
      } else {
        this.emit('success', this.formatResults(results))
      }
    }.bind(this)).setMaxListeners(100)

    this.sequelize._metric('Query.run', tk.time() - start);
    return this
  }

  return Query
})()
