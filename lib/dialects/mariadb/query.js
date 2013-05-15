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

  Query = Utils.inherit(Query, AbstractQuery)
  Query.prototype.run = function(sql) {
    this.sql = sql

    if (this.options.logging !== false) {
      this.options.logging('Executing: ' + this.sql)
    }
 
    var query = this.client.query(this.sql)
      , rows = []
      , receivedError = false

    query.on('result', function(results) {
      results.on('row', function(row) {
          rows.push(row)
        })
/*        .on('error', function(err) {
          //console.log( err )
          //this.emit('sql', this.sql)
          receivedError = true
          this.emit('error', err, this.callee)
        }.bind(this))  */
        .on('end', function(info) {
          //console.log( info )
          //this.emit('sql', this.sql)
          //this.emit('success', this.prototype.formatResults(resultSet))
        });
    }.bind(this))

    query.on('error', function(err) {
      //console.log( err )
      //this.emit('sql', this.sql)
      receivedError = true
      this.emit('error', err, this.callee)
      //this.emit('error', err, this.callee)
    }.bind(this))  

    query.on('end', function() {
      this.emit('sql', this.sql)

      if (receivedError) {
        return
      }
      //console.log(resultSet)
      this.emit('success', this.formatResults(rows))
    }.bind(this)).setMaxListeners(100)


    return this
  }

  return Query
})()


