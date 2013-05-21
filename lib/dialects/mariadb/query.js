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
  Query.prototype.run = function(sql) {
    this.sql = sql

    if (this.options.logging !== false) {
      this.options.logging('Executing: ' + this.sql)
    }

    var resultSet = [],
        errorDetected = false,
        self = this
 
    this.client.query(this.sql)
      .on('result', function(results) {

      results.on('row', function(row) {
          resultSet.push(row);
        })
        .on('error', function(err) {
          errorDetected = true
          self.emit('sql', this.sql)
          self.emit('error', err, this.callee)
        }.bind(this))  
        .on('end', function(info) {
          if(errorDetected) {
            return
          }
          self.emit('sql', this.sql)
          // we need to figure out whether to send the result set
          // or info depending upon the type of query
          if( /^show/.test(this.sql.toLowerCase()) ||
            /^select/.test(this.sql.toLowerCase()) ||
            /^describe/.test(this.sql.toLowerCase()) ||
            ( resultSet.length && /^call/.test(this.sql.toLowerCase()) ) ) {
            self.emit('success', this.formatResults(resultSet))         
          } else {
            self.emit('success', this.formatResults(info))
          }

        }.bind(this));
      }.bind(this))
      .on('error', function(err) {
        if(errorDetected) {
          return
        }
        errorDetected = true
        self.emit('sql', this.sql)
        self.emit('error', err, this.callee)
      }.bind(this))
      .on('end', function(info) {
        // nothing here (query info is returned during the 'result' event)

      }.bind(this)).setMaxListeners(100)

    return this
  }

  return Query
})()


