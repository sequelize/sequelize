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

    var query = this.client.query(this.sql),
        resultSet = [],
        errorDetected = false,
        temp = 1
 
    query.on('result', function(results) {

      var resultStream = results;

      results.on('row', function(row) {
          resultSet.push(row);
        })
        .on('error', function(err) {
          //console.log('error in result-loop for: ' + self.sql)
          errorDetected = true
          this.emit('sql', this.sql)
          console.log('Failed query : ' + this.sql)
          console.log(err)
          resultStream.abort()
          this.emit('error', err, this.callee)
        }.bind(this))  
        .on('end', function(info) {
          //console.log(info)
          if(errorDetected)
            return
          //this.emit('sql', this.sql)
          //this.emit('success', this.formatResults(resultSet))
        }.bind(this));
      }.bind(this))
      .on('error', function(err) {
        //console.log( err )
        //console.log('error in query: ' + this.sql)
        // if(errorDetected)
        //   return
        // errorDetected = true
        // this.emit('sql', this.sql)
        // this.emit('error', err, this.callee)
        console.log('query error')
      }.bind(this))
      .on('end', function() {
        if(errorDetected)
          return
        this.emit('sql', this.sql)
        console.log('Successful query : ' + this.sql)
        console.log(resultSet)
        this.emit('success', this.formatResults(resultSet))
      }.bind(this)).setMaxListeners(100)

    return this
  }

  return Query
})()


