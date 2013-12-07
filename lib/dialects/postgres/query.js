var Utils         = require("../../utils")
  , AbstractQuery = require('../abstract/query')
  , DataTypes     = require('../../data-types')
  , hstore        = require('./hstore')

module.exports = (function() {
  var Query = function(client, sequelize, callee, options) {
    this.client = client
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

    var self          = this
      , receivedError = false
      , query         = this.client.query(sql)
      , rows          = []

    if (this.options.logging !== false) {
      this.options.logging('Executing (' + this.options.uuid + '): ' + this.sql)
    }

    query.on('row', function(row) {
      rows.push(row)
    })

    query.on('error', function(err) {
      receivedError = true
      self.emit('error', err, self.callee)
    })

    query.on('end', function() {
      self.emit('sql', self.sql)

      if (receivedError) {
        return
      }

      onSuccess.call(self, rows, sql)
    })

    return this
  }

  Query.prototype.getInsertIdField = function() {
    return 'id'
  }

  var onSuccess = function(rows, sql) {
    var results          = rows
      , self             = this
      , isTableNameQuery = (sql.indexOf('SELECT table_name FROM information_schema.tables') === 0)
      , isRelNameQuery   = (sql.indexOf('SELECT relname FROM pg_class WHERE oid IN') === 0)

    if (isTableNameQuery || isRelNameQuery) {
      if (isRelNameQuery) {
        results = rows.map(function(row) {
          return {
            name:       row.relname,
            tableName:  row.relname.split('_')[0]
          }
        })
      } else {
        results = rows.map(function(row) { return Utils._.values(row) })
      }
      return this.emit('success', results)
    }

    if (this.send('isSelectQuery')) {
      if (this.sql.toLowerCase().indexOf('select c.column_name') === 0) {
        var result = {}

        rows.forEach(function(_result) {
          result[_result.Field] = {
            type:         _result.Type.toUpperCase(),
            allowNull:    (_result.Null === 'YES'),
            defaultValue: _result.Default,
            special: (!!_result.special ? self.sequelize.queryInterface.QueryGenerator.fromArray(_result.special) : [])
          }

          if (result[_result.Field].type === 'BOOLEAN') {
            result[_result.Field].defaultValue = { 'false': false, 'true': true }[result[_result.Field].defaultValue]

            if (result[_result.Field].defaultValue === undefined) {
              result[_result.Field].defaultValue = null
            }
          }

          if (typeof result[_result.Field].defaultValue === 'string') {
            result[_result.Field].defaultValue = result[_result.Field].defaultValue.replace(/'/g, "")

            if (result[_result.Field].defaultValue.indexOf('::') > -1) {
              var split = result[_result.Field].defaultValue.split('::')
              if (split[1].toLowerCase() !== "regclass)") {
                result[_result.Field].defaultValue = split[0]
              }
            }
          }
        })

        this.emit('success', result)
      } else {
        // Postgres will treat tables as case-insensitive, so fix the case
        // of the returned values to match attributes
        if(this.options.raw === false && this.sequelize.options.quoteIdentifiers === false) {
          var attrsMap = Utils._.reduce(this.callee.attributes, function(m, v, k) { m[k.toLowerCase()] = k; return m}, {})
          rows.forEach(function(row) {
            Utils._.keys(row).forEach(function(key) {
              var targetAttr = attrsMap[key]
              if(targetAttr != key) {
                row[targetAttr] = row[key]
                delete row[key]
              }
            })
          })
        }
        this.emit('success', this.send('handleSelectQuery', rows))
      }
    } else if (this.send('isShowOrDescribeQuery')) {
      this.emit('success', results)
    } else if (this.send('isInsertQuery')) {
      if(this.callee !== null) { // may happen for bulk inserts
        for (var key in rows[0]) {
          if (rows[0].hasOwnProperty(key)) {
            var record = rows[0][key]
            if (!!this.callee.daoFactory && !!this.callee.daoFactory.rawAttributes && !!this.callee.daoFactory.rawAttributes[key] && !!this.callee.daoFactory.rawAttributes[key].type && !!this.callee.daoFactory.rawAttributes[key].type.type && this.callee.daoFactory.rawAttributes[key].type.type === DataTypes.HSTORE.type) {
              record = hstore.parse(record)
            }
            this.callee[key] = record
          }
        }
      }

      this.emit('success', this.callee)
    } else if (this.send('isUpdateQuery')) {
      if(this.callee !== null) { // may happen for bulk updates
        for (var key in rows[0]) {
          if (rows[0].hasOwnProperty(key)) {
            var record = rows[0][key]
            if (!!this.callee.daoFactory && !!this.callee.daoFactory.rawAttributes && !!this.callee.daoFactory.rawAttributes[key] && !!this.callee.daoFactory.rawAttributes[key].type && !!this.callee.daoFactory.rawAttributes[key].type.type && this.callee.daoFactory.rawAttributes[key].type.type === DataTypes.HSTORE.type) {
              record = hstore.parse(record)
            }
            this.callee[key] = record
          }
        }
      }

      this.emit('success', this.callee)
    } else {
      this.emit('success', results)
    }
  }

  return Query
})()
