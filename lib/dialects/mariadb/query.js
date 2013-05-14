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
 
    var resultSet = [];

    this.client.query(this.sql)
      .on('result', function(results) {


        results.on('row', function(row) {
            resultSet.push(row);
          })
          .on('error', function(err) {
            //console.log( err )
            this.emit('sql', this.sql)
            this.emit('error', err, this.callee)
          })  
          .on('end', function(info) {
            //console.log( info )
            //this.emit('sql', this.sql)
            //this.emit('success', this.prototype.formatResults(resultSet))
          });
        })
      .on('error', function(err) {
        //console.log( err )
        this.emit('sql', this.sql)
        this.emit('error', err, this.callee)
        //this.emit('error', err, this.callee)
      })  
      .on('end', function() {
        this.emit('sql', this.sql)
        //console.log(resultSet)
        this.emit('success', this.formatResults(resultSet))
      }.bind(this)).setMaxListeners(100)


    return this
  }

  return Query
})()


