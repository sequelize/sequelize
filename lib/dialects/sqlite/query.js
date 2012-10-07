var Utils         = require("../../utils")
  , AbstractQuery = require('../abstract/query')

module.exports = (function() {
  var Query = function(database, sequelize, callee, options) {
    this.database = database
    this.sequelize = sequelize
    this.callee = callee
    this.options = Utils._.extend({
      logging: console.log,
      plain: false,
      raw: false
    }, options || {})

    this.checkLoggingOption()
  }
  Utils.inherit(Query, AbstractQuery)

  Query.prototype.run = function(sql) {
    var self = this

    this.sql = sql

    if(this.options.logging !== false) {
      this.options.logging('Executing: ' + this.sql)
    }

    var columnTypes = {};
    this.database.serialize(function() {
      var executeSql = function() {
        self.database[databaseMethod](self.sql, function(err, results) {
           //allow clients to listen to sql to do their own logging or whatnot
          self.emit('sql', self.sql)
          this.columnTypes = columnTypes;
          err ? onFailure.call(self, err) : onSuccess.call(self, results, this)
        })
      };

      var isInsertCommand = (self.sql.toLowerCase().indexOf('insert') == 0)
        , isUpdateCommand = (self.sql.toLowerCase().indexOf('update') == 0)
        , databaseMethod  = (isInsertCommand || isUpdateCommand) ? 'run' : 'all'

      if (databaseMethod === 'all' && /select\s.*?\sfrom\s+([^ ;]+)/i.test(self.sql)) {
        var tableName = RegExp.$1;
        if (tableName !== 'sqlite_master') {
          // get the column types
          self.database.all("PRAGMA table_info(" + tableName + ")", function(err, results) {
            if (!err) {
              for (var i=0, l=results.length; i<l; i++) {
                columnTypes[results[i].name] = results[i].type;
              }
            }
            executeSql();
          });
        } else {
          executeSql();
        }
      } else {
        executeSql();
      }
    })

    return this
  }

  //private

  var onSuccess = function(results, metaData) {
  var getDatabaseMethod = function() {
    if (this.send('isInsertQuery') || this.send('isUpdateQuery')) {
      return 'run'
    } else {
      return 'all'
    }
  }

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
          for (var name in result) {
            if (metaData.columnTypes[name] === 'DATETIME') {
              result[name] = new Date(result[name]);
            }
          }
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
    this.emit('error', err, this.callee)
  }

  return Query
})()
