var Utils         = require("../../utils")
  , AbstractQuery = require('../abstract/query')
  , DataTypes     = require('../../data-types')
  , hstore        = require('./hstore')
  , QueryTypes    = require('../../query-types')
  , Promise       = require('../../promise')

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
      this.sequelize.log('Executing (' + this.options.uuid + '): ' + this.sql)
    }

    return new Promise(function (resolve, reject) {
      var promise = this;

      query.on('row', function(row) {
        rows.push(row)
      })

      query.on('error', function(err) {
        receivedError = true
        err.sql = sql
        promise.emit('sql', sql, self.options.uuid)
        reject(err);
      })

      query.on('end', function(result) {
        if (receivedError) {
          return;
        }

        promise.emit('sql', self.sql, self.options.uuid)
        resolve([rows, sql, result]);
      })
    }).spread(function (rows, sql, result) {
      var results          = rows
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
        return results
      }

      if (self.send('isSelectQuery')) {
        if (self.sql.toLowerCase().indexOf('select c.column_name') === 0) {
          result = {}

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

          return result
        } else {
          // Postgres will treat tables as case-insensitive, so fix the case
          // of the returned values to match attributes
          if (self.options.raw === false && self.sequelize.options.quoteIdentifiers === false) {
            var attrsMap = Utils._.reduce(self.callee.attributes, function(m, v, k) { m[k.toLowerCase()] = k; return m}, {})
            rows.forEach(function(row) {
              Utils._.keys(row).forEach(function(key) {
                var targetAttr = attrsMap[key]
                if (targetAttr != key) {
                  row[targetAttr] = row[key]
                  delete row[key]
                }
              })
            })
          }

          // Parse hstore fields if the model has any hstore fields.
          // This cannot be done in the 'pg' lib because hstore is a UDT.
          if (!!self.callee && !!self.callee._hasHstoreAttributes) {
            rows.forEach(function(row) {
              Utils._.keys(row).forEach(function(key) {
                if (self.callee._isHstoreAttribute(key)) {
                  row[key] = hstore.parse(row[key])
                }
              })
            })
          }

          return  self.send('handleSelectQuery', rows)
        }
      } else if (self.send('isShowOrDescribeQuery')) {
        return results
      } else if ([QueryTypes.BULKUPDATE, QueryTypes.BULKDELETE].indexOf(self.options.type) !== -1) {
        return result.rowCount
      } else if (self.send('isInsertQuery') || self.send('isUpdateQuery')) {
        if (self.callee !== null) { // may happen for bulk inserts or bulk updates
          for (var key in rows[0]) {
            if (rows[0].hasOwnProperty(key)) {
              var record = rows[0][key]
              if (!!self.callee.Model && !!self.callee.Model.rawAttributes && !!self.callee.Model.rawAttributes[key] && !!self.callee.Model.rawAttributes[key].type && self.callee.Model.rawAttributes[key].type.toString() === DataTypes.HSTORE.toString()) {
                record = hstore.parse(record)
              }
              self.callee.dataValues[key] = record
            }
          }
        }

        return self.callee
      } else {
        return results
      }
    })

    return this
  }

  Query.prototype.getInsertIdField = function() {
    return 'id'
  }

  return Query
})()
