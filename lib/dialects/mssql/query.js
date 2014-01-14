var Utils          = require("../../utils")
  , AbstractQuery  = require('../abstract/query')
  , QueryGenerator = require("./query-generator")
  , tedious        = require('tedious')
  , isoLevels      = tedious.ISOLATION_LEVEL
  , Request        = tedious.Request

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
    console.log(this.sql)

    if (this.options.logging !== false) {
      this.options.logging('Executing (' + this.options.uuid.slice(0, 31) + '): ' + this.sql)
    }

    if (this.sql === QueryGenerator.setIsolationLevelQuery()) {
      var isolationLevel = this.options.transaction.options.isolationLevel.replace(/\s/g, '_')

      this.client.beginTransaction(
        function(err) {
          if (err) {
            self.emit('error', new Error(err))
          } else {
            self.emit('success')
          }
        },
        this.options.uuid.slice(0, 31),
        isoLevels[isolationLevel]
      )

      return this
    } else if (this.sql === QueryGenerator.startTransactionQuery()) {
      Utils.tick(function() { self.emit('success') })
      return this
    } else if (this.sql === QueryGenerator.commitTransactionQuery()) {
      this.client.commitTransaction(function(err) {
        if (err) {
          self.emit('error', new Error(err))
        } else {
          self.emit('success')
        }
      })
    } else if (this.sql === QueryGenerator.rollbackTransactionQuery()) {
      this.client.rollbackTransaction(function(err) {
        if (err) {
          self.emit('error', new Error(err))
        } else {
          self.emit('success')
        }
      })
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
    var results           = this.callee
      , isSelectTableName = (this.sql.indexOf("SELECT TABLE_NAME") === 0)

    if (isSelectTableName) {
      results = this.rows.map(function(row) { return Utils._.values(row) })
    } else if (this.sql.indexOf(QueryGenerator.showIndexQuery('table').slice(0, 20)) === 0) {
      results = Utils._.uniq(this.rows.map(function(row) {
        return {
          name:       row.Key_name,
          tableName:  row.table_name,
          unique:     (row.is_unique === true)
        }
      }), false, function(row) {
        return row.name
      })
    } else if (this.send('isSelectQuery')) {
      results = this.send('handleSelectQuery', this.rows)
    } else if(this.send('isInsertQuery')) {
      this.send('handleInsertQuery', this.rows[0])
    }

    return results
  }

  return Query
})()


