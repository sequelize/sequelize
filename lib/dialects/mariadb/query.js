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
          //console.log('error in result-loop for: ' + self.sql)
          errorDetected = true
          self.emit('sql', this.sql)
          console.log('Failed query : ' + this.sql)
          console.log(err)
          self.emit('error', err, this.callee)
        }.bind(this))  
        .on('end', function(info) {
          // nothing needs to be done at this point

          if(errorDetected) {
            return
          }
          self.emit('sql', this.sql)
          console.log('Successful query : ' + this.sql)

          // we need to figure out whether to send the result set
          // or info depending upon the type of query
          if( /^show/.test(this.sql.toLowerCase()) ||
            /^select/.test(this.sql.toLowerCase()) ||
            /^describe/.test(this.sql.toLowerCase()) ) {
            console.log('results : ')
            console.log(resultSet)
            //console.log('formatted resultset: ' + JSON.stringify(this.formatResults(resultSet)))
            self.emit('success', this.formatResults(resultSet))         
          } else {
            console.log('results : ')
            info = JSON.parse(JSON.stringify(info)) 
            console.log(info)
            //console.log('formatted resultset: ' + JSON.stringify(this.formatResults(info)))
            self.emit('success', this.formatResults(info))
          }

        }.bind(this));
      }.bind(this))
      .on('error', function(err) {
        //console.log( err )
        //console.log('error in query: ' + this.sql)
        if(errorDetected) {
          return
        }
        errorDetected = true
        self.emit('sql', this.sql)
        self.emit('error', err, this.callee)
        console.log('query error')
      }.bind(this))
      .on('end', function(info) {
        // nothing here yet
      }.bind(this)).setMaxListeners(100)

    return this
  }

  return Query
})()


