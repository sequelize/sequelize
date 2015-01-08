'use strict';

var Utils = require('../../utils')
  , AbstractQuery = require('../abstract/query')
  , DataTypes = require('../../data-types')
  , hstore = require('./hstore')
  , QueryTypes = require('../../query-types')
  , Promise = require('../../promise')
  , sequelizeErrors = require('../../errors.js');

// Parses hstore fields if the model has any hstore fields.
// This cannot be done in the 'pg' lib because hstore is a UDT.
var parseHstoreFields = function(model, row) {
  Utils._.forEach(row, function(value, key) {
    if(value === null) return row[key] = null;

    if (model._isHstoreAttribute(key)) {
      row[key] = hstore.parse(value);
    }else if(model.attributes[key] && model.attributes[key].type === DataTypes.ARRAY(DataTypes.HSTORE)) {
      var array = JSON.parse('[' + value.slice(1).slice(0,-1) + ']');
      row[key] = Utils._.map(array, function(v){return hstore.parse(v);});
    }else{
      row[key] = value;
    }
  });
};


module.exports = (function() {
  var Query = function(client, sequelize, callee, options) {
    this.client = client;
    this.sequelize = sequelize;
    this.callee = callee;
    this.options = Utils._.extend({
      logging: console.log,
      plain: false,
      raw: false
    }, options || {});

    this.checkLoggingOption();
  };
  Utils.inherit(Query, AbstractQuery);

  Query.prototype.run = function(sql) {
    /* jshint -W027 */
    this.sql = sql;

    var self = this
      , receivedError = false
      , query = this.client.query(sql)
      , rows = [];

    this.sequelize.log('Executing (' + (this.client.uuid || 'default') + '): ' + this.sql, this.options);

    var promise = new Promise(function(resolve, reject) {
      query.on('row', function(row) {
        rows.push(row);
      });

      query.on('error', function(err) {
        receivedError = true;
        err.sql = sql;
        promise.emit('sql', sql, self.client.uuid);
        reject(self.formatError(err));
      });

      query.on('end', function(result) {
        if (receivedError) {
          return;
        }

        promise.emit('sql', self.sql, self.client.uuid);
        resolve([rows, sql, result]);
      });
    }).spread(function(rows, sql, result) {
      var results = rows
        , isTableNameQuery = (sql.indexOf('SELECT table_name FROM information_schema.tables') === 0)
        , isRelNameQuery = (sql.indexOf('SELECT relname FROM pg_class WHERE oid IN') === 0);

      if (isTableNameQuery || isRelNameQuery) {
        if (isRelNameQuery) {
          results = rows.map(function(row) {
            return {
              name: row.relname,
              tableName: row.relname.split('_')[0]
            };
          });
        } else {
          results = rows.map(function(row) { return Utils._.values(row); });
        }
        return results;
      }

      if (self.isShowIndexesQuery()) {
        results.forEach(function (result) {
          var attributes = /ON .*? (?:USING .*?\s)?\((.*)\)/gi.exec(result.definition)[1].split(',')
            , field
            , attribute
            , columns;

          // Map column index in table to column name
          columns = Utils._.zipObject(
            result.column_indexes,
            self.sequelize.queryInterface.QueryGenerator.fromArray(result.column_names)
          );
          delete result.column_indexes;
          delete result.column_names;

          // Indkey is the order of attributes in the index, specified by a string of attribute indexes
          result.fields = result.indkey.split(' ').map(function (indKey, index) {
            field = columns[indKey];
            attribute = attributes[index];
            return {
              attribute: field,
              collate: attribute.match(/COLLATE "(.*?)"/) ? /COLLATE "(.*?)"/.exec(attribute)[1] : undefined,
              order: attribute.indexOf('DESC') !== -1 ? 'DESC' : attribute.indexOf('ASC') !== -1 ? 'ASC': undefined,
              length: undefined,
            };
          });
          delete result.columns;
        });
        return results;
      } else if (self.isForeignKeysQuery()) {
        result = [];
        rows.forEach(function(row) {
          var defParts;
          if (row.condef !== undefined && (defParts = row.condef.match(/FOREIGN KEY \((.+)\) REFERENCES (.+)\((.+)\)( ON (UPDATE|DELETE) (CASCADE|RESTRICT))?( ON (UPDATE|DELETE) (CASCADE|RESTRICT))?/))) {
            row.id = row.constraint_name;
            row.table = defParts[2];
            row.from = defParts[1];
            row.to = defParts[3];
            var i;
            for (i=5;i<=8;i+=3) {
              if (/(UPDATE|DELETE)/.test(defParts[i])) {
                row['on_'+defParts[i].toLowerCase()] = defParts[i+1];
              }
            }
          }
          result.push(row);
        });
        return result;
      } else if (self.isSelectQuery()) {
        if (self.sql.toLowerCase().indexOf('select c.column_name') === 0) {
          result = {};

          rows.forEach(function(_result) {
            result[_result.Field] = {
              type: _result.Type.toUpperCase(),
              allowNull: (_result.Null === 'YES'),
              defaultValue: _result.Default,
              special: (!!_result.special ? self.sequelize.queryInterface.QueryGenerator.fromArray(_result.special) : [])
            };

            if (result[_result.Field].type === 'BOOLEAN') {
              result[_result.Field].defaultValue = { 'false': false, 'true': true }[result[_result.Field].defaultValue];

              if (result[_result.Field].defaultValue === undefined) {
                result[_result.Field].defaultValue = null;
              }
            }

            if (typeof result[_result.Field].defaultValue === 'string') {
              result[_result.Field].defaultValue = result[_result.Field].defaultValue.replace(/'/g, '');

              if (result[_result.Field].defaultValue.indexOf('::') > -1) {
                var split = result[_result.Field].defaultValue.split('::');
                if (split[1].toLowerCase() !== 'regclass)') {
                  result[_result.Field].defaultValue = split[0];
                }
              }
            }
          });

          return result;
        } else {
          // Postgres will treat tables as case-insensitive, so fix the case
          // of the returned values to match attributes
          if (self.options.raw === false && self.sequelize.options.quoteIdentifiers === false) {
            var attrsMap = Utils._.reduce(self.callee.attributes, function(m, v, k) { m[k.toLowerCase()] = k; return m; }, {});
            rows.forEach(function(row) {
              Utils._.keys(row).forEach(function(key) {
                var targetAttr = attrsMap[key];
                if (targetAttr !== key) {
                  row[targetAttr] = row[key];
                  delete row[key];
                }
              });
            });
          }

          if (!!self.callee && !!self.callee._hasHstoreAttributes) {
            rows.forEach(function(row) {
              parseHstoreFields(self.callee, row);
            });
          }

          return self.handleSelectQuery(rows);
        }
      } else if (self.isShowOrDescribeQuery()) {
        return results;
      } else if (QueryTypes.BULKUPDATE === self.options.type) {
        if (!self.options.returning) {
          return result.rowCount;
        }

        if (!!self.callee && !!self.callee._hasHstoreAttributes) {
          rows.forEach(function(row) {
            parseHstoreFields(self.callee, row);
          });
        }

        return self.handleSelectQuery(rows);
      } else if (QueryTypes.BULKDELETE === self.options.type) {
        return result.rowCount;
      } else if (self.isUpsertQuery()) {
        return rows[0].sequelize_upsert;
      } else if (self.isInsertQuery() || self.isUpdateQuery()) {
        if (!!self.callee && self.callee.dataValues) {
          if (!!self.callee.Model && !!self.callee.Model._hasHstoreAttributes) {
            parseHstoreFields(self.callee.Model, rows[0]);
          }

          for (var key in rows[0]) {
            if (rows[0].hasOwnProperty(key)) {
              var record = rows[0][key];

              var attr = Utils._.find(self.callee.Model.rawAttributes, function (attribute) {
                return attribute.fieldName === key || attribute.field === key;
              });

              self.callee.dataValues[attr && attr.fieldName || key] = record;
            }
          }
        }

        return self.callee || (rows && ((self.options.plain && rows[0]) || rows)) || undefined;
      } else if (self.isVersionQuery()) {
        return results[0].version;
      } else {
        return results;
      }
    });

    return promise;
  };

  Query.prototype.formatError = function (err) {
    var match
      , table
      , index;

    switch (err.code) {
      case '23503':
        index = err.message.match(/violates foreign key constraint \"(.+?)\"/)[1];
        table = err.message.match(/on table \"(.+?)\"/)[1];

        return new sequelizeErrors.ForeignKeyConstraintError({
          fields: null,
          index: index,
          table: table,
          parent: err
        });
      case '23505':
        // there are multiple different formats of error messages for this error code
        // this regex should check at least two
        match = err.detail.match(/Key \((.*?)\)=\((.*?)\)/);

        if (match) {
          var fields = Utils._.zipObject(match[1].split(', '), match[2].split(', '))
            , errors = []
            , message = 'Validation error';

          Utils._.forOwn(fields, function(value, field) {
            errors.push(new sequelizeErrors.ValidationErrorItem(
              field + ' must be unique', 'unique violation', field, value));
          });

          if (this.callee && this.callee.__options && this.callee.__options.uniqueKeys) {
            Utils._.forOwn(this.callee.__options.uniqueKeys, function(constraint) {
              if (Utils._.isEqual(constraint.fields, Object.keys(fields)) && !!constraint.msg) {
                message = constraint.msg;
                return false;
              }
            });
          }

          return new sequelizeErrors.UniqueConstraintError({
            message: message,
            errors: errors,
            parent: err,
            fields: fields
          });
        } else {
          return new sequelizeErrors.UniqueConstraintError({
            message: err.message,
            parent: err
          });
        }

        break;
      default:
        return new sequelizeErrors.DatabaseError(err);
    }
  };

  Query.prototype.isShowIndexesQuery = function () {
    return this.sql.indexOf('pg_get_indexdef') !== -1;
  };

  Query.prototype.isForeignKeysQuery = function() {
    return /SELECT conname as constraint_name, pg_catalog\.pg_get_constraintdef\(r\.oid, true\) as condef FROM pg_catalog\.pg_constraint r WHERE r\.conrelid = \(SELECT oid FROM pg_class WHERE relname = '.*' LIMIT 1\) AND r\.contype = 'f' ORDER BY 1;/.test(this.sql);
  };

  Query.prototype.getInsertIdField = function() {
    return 'id';
  };

  return Query;
})();
