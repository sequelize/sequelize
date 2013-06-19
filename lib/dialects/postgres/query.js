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

    if (this.options.logging !== false) {
      this.options.logging('Executing: ' + this.sql)
    }

    var receivedError = false
      , query         = this.client.query(sql)
      , rows          = []

    query.on('row', function(row) {
      rows.push(row)
    })

    query.on('error', function(err) {
      receivedError = true
      this.emit('error', err, this.callee)
    }.bind(this))

    query.on('end', function() {
      this.emit('sql', this.sql)

      if (receivedError) {
        return
      }

      onSuccess.call(this, rows)
    }.bind(this))

    return this
  }

  Query.prototype.getInsertIdField = function() {
    return 'id'
  }

  var onSuccess = function(rows) {
    var results          = []
      , self             = this
      , isTableNameQuery = (this.sql.indexOf('SELECT table_name FROM information_schema.tables') === 0)
      , isRelNameQuery   = (this.sql.indexOf('SELECT relname FROM pg_class WHERE oid IN') === 0)
      , insertSelect     = (this.sql.indexOf('INSERT') === 0 && this.sql.match(/ returning /i) !== null && this.options.raw === true)

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

    if (this.send('isSelectQuery') || insertSelect === true) {
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
              var split = result[_result.Field].defaultValue.split('::');
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
        if(this.sequelize.options.quoteIdentifiers == false) {
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

        if (insertSelect === true && !this.callee) {
          var tableMatch = this.sql.match(/INSERT\s+INTO\s([".\w]+)\s+/i)
          if (tableMatch !== null) {
            // It's safe to split by period here, since it's not allowed in an identifier's name
            // http://www.postgresql.org/docs/9.2/static/sql-syntax-lexical.html
            // FTA: SQL identifiers and key words must begin with a letter (a-z, but also letters...
            // ...with diacritical marks and non-Latin letters) or an underscore (_)...
            // ...Subsequent characters in an identifier or key word can be letters, underscores, digits (0-9), or dollar signs ($).

            // The slicing, joining, and replacing are all part of being compatible with schemas and non public tables.
            this.tableName = tableMatch[1].split('.').slice(-1).join('').replace(/(^"|"$)/g, '')
          }
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
    }
    else if (insertSelect === true) {
      this.emit('success', rows)
    } else {
      this.emit('success', results)
    }
  }

  return Query
})()
