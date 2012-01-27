var Utils = require("../../utils")

module.exports = (function() {
  var Query = function(database, callee, options) {
    this.database = database
    this.callee = callee
    this.options = Utils._.extend({
      logging: true,
      plain: false,
      raw: false
    }, options || {})
  }
  Utils._.extend(Query.prototype, require("../query").prototype)

  Query.prototype.run = function(sql) {
    var self = this

    this.sql = sql

    if(this.options.logging)
      console.log('Executing: ' + this.sql)

    this.database.serialize(function() {
      var isInsertCommand = (self.sql.toLowerCase().indexOf('insert') == 0)
        , isUpdateCommand = (self.sql.toLowerCase().indexOf('update') == 0)
        , databaseMethod  = (isInsertCommand || isUpdateCommand) ? 'run' : 'all'

      self.database[databaseMethod](self.sql, function(err, results) {
         //allow clients to listen to sql to do their own logging or whatnot
        self.emit('sql', self.sql)
        err ? onFailure.call(self, err) : onSuccess.call(self, results, this)
      })
    })

    return this
  }

  //private

  var onSuccess = function(results, metaData) {
    var result = this.callee
      , self   = this

    // add the inserted row id to the instance
    if (this.callee && (this.sql.indexOf('INSERT INTO') == 0) && metaData.hasOwnProperty('lastID')) {
      var autoIncrementField = this.callee.__factory.autoIncrementField
      this.callee[autoIncrementField] = metaData.lastID
    }

    if (this.sql.indexOf('sqlite_master') != -1) {
      result = results.map(function(resultSet){ return resultSet.name })
    } else if (this.sql.indexOf('SELECT') == 0) {
      // transform results into real model instances
      // return the first real model instance if options.plain is set (e.g. Model.find)

      if(this.options.raw) {
        result = results
      } else {
        result = results.map(function(result) {
          return self.callee.build(result, { isNewRecord: false })
        })
      }

      if(this.options.plain)
        result = (result.length == 0) ? null : result[0]
    } else if((this.sql.indexOf('SHOW') == 0) || (this.sql.indexOf('DESCRIBE') == 0))
      result = results

    this.emit('success', result)
  }

  var onFailure = function(err) {
    this.emit('failure', err, this.callee)
  }

  return Query
})()
