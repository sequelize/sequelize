var Utils         = require("../../utils")
  , AbstractQuery = require('../abstract/query')
  , Request = require('tedious').Request

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
    this.rows = []

    this.checkLoggingOption()
  }

  Utils.inherit(Query, AbstractQuery)
  Query.prototype.run = function(sql) {
    var self = this

    this.sql = sql

    if (this.options.logging !== false) {
      this.options.logging('Executing: ' + this.sql)
    }

    var request = new Request(this.sql, function(err, rowCount) {
      if (err) {
        self.emit('error', new Error(err), self.callee)
      } else {
        var results = null

        if (isShowTableQuery.call(self)) {
          results = self.send('handleShowTableQuery', self.rows)
        } else {
          results = self.options.raw ? self.rows : getResults.call(self)
        }

        self.emit('success', results)
      }
    })

    request.on('row', function(columns){
      var row = {}

      Utils._.forEach(columns, function(col){
        row[col.metadata.colName] = col.value
      })

      self.rows.push(row)
    })

    this.client.execSql(request);
    return this
  }

  var isShowTableQuery = function() {
    return (this.sql.toLowerCase().indexOf('SELECT TABLE_NAME FROM INFORMATION_SCHEMA.TABLES'.toLowerCase()) === 0)
  }

  var getResults = function(){
    var results = this.callee
      , isSelectTableName = (this.sql.indexOf("SELECT TABLE_NAME") === 0)

    if(isSelectTableName){
      results = this.rows.map(function(row) { return Utils._.values(row) })
    }
    else if(this.send('isSelectQuery')){
      results = this.send('handleSelectQuery', this.rows)
    }
    else if(this.send('isInsertQuery')){
      this.send('handleInsertQuery', this.rows[0])
    }

    return results
  }

  return Query
})()


