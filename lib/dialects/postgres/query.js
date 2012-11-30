var Utils         = require("../../utils")
  , AbstractQuery = require('../abstract/query')

module.exports = (function() {
  var Query = function(connect, sequelize, callee, options) {
    this.connect = connect
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
    this.sql = sql
    var self = this

    if(this.options.logging !== false) {
      this.options.logging('Executing: ' + sql)
    }

    this.connect(function(err, client) {
      if(err) return self.emit('error', err, this.callee)

      var receivedError = false
        , query         = client.query(sql)
        , rows          = []

      query.on('row', function(row) {
        rows.push(row)
      })

      query.on('error', function(err) {
        receivedError = true
        self.emit('error', err, this.callee)
      })

      query.on('end', function() {
        self.emit('sql', sql)

        if (receivedError) {
          return
        }

        onSuccess.call(self, rows, sql)
      })
    });

    return this
  }

  Query.prototype.getInsertIdField = function() {
    return 'id'
  }

  var onSuccess = function(rows, sql) {
    var results          = []
      , isTableNameQuery = (sql.indexOf('SELECT table_name FROM information_schema.tables') === 0)
      , isRelNameQuery   = (sql.indexOf('SELECT relname FROM pg_class WHERE oid IN') === 0)

    if (isTableNameQuery || isRelNameQuery) {
      return this.emit('success', rows.map(function(row) { return Utils._.values(row) }))
    }

    if (this.send('isSelectQuery')) {
      this.emit('success', this.send('handleSelectQuery', rows))
    } else if (this.send('isShowOrDescribeQuery')) {
      this.emit('success', results)
    } else if (this.send('isInsertQuery')) {
      for (var key in rows[0]) {
        if (rows[0].hasOwnProperty(key)) {
          this.callee[key] = rows[0][key]
        }
      }

      this.emit('success', this.callee)
    } else if (this.send('isUpdateQuery')) {
      for (var key in rows[0]) {
        if (rows[0].hasOwnProperty(key)) {
          this.callee[key] = rows[0][key]
        }
      }

      this.emit('success', this.callee)
    } else {
      this.emit('success', results)
    }
  }

  return Query
})()
