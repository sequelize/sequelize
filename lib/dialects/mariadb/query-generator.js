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

    var resultSet = [];
 
    this.client.query(this.sql)
      .on('result', function(results) {

        results.on('row', function(row) {
            resultSet.push(row);
          })
          .on('error', function(err) {
            this.emit('error', err, this.callee)
          })  
          .on('end', function(info) {
            //console.log(info)
          });
        })
      .on('error', function(err) {
        console.log( stack )
        //this.emit('error', err, this.callee)
      })  
      .on('end', function() {
        this.emit('sql', this.sql)
        this.emit('success', this.formatResults(resultSet))
      }.bind(this))


    return this
  }

  return Query
})()


