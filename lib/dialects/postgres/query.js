'use strict';

var Utils = require('../../utils')
  , AbstractQuery = require('../abstract/query')
  , QueryTypes = require('../../query-types')
  , Promise = require('../../promise')
  , sequelizeErrors = require('../../errors.js')
  , _ = require('lodash');

var Query = function(client, sequelize, options) {
  this.client = client;
  this.sequelize = sequelize;
  this.instance = options.instance;
  this.model = options.model;
  this.options = _.extend({
    logging: console.log,
    plain: false,
    raw: false
  }, options || {});

  this.checkLoggingOption();
};
Utils.inherit(Query, AbstractQuery);

/**
 * rewrite query with parameters
 */
Query.formatBindParameters = function(sql, values, dialect) {
  var bindParam = [];
  if (Array.isArray(values)) {
    bindParam = values;
    sql = AbstractQuery.formatBindParameters(sql, values, dialect, { skipValueReplace: true })[0];
  } else {
    var i = 0;
    var seen = {};
    var replacementFunc = function(match, key, values, timeZone, dialect, options) {
      if (seen[key] !== undefined) {
        return seen[key];
      }
      if (values[key] !== undefined) {
        i = i + 1;
        bindParam.push(values[key]);
        seen[key] = '$'+i;
        return '$'+i;
      }
      return undefined;
    };
    sql = AbstractQuery.formatBindParameters(sql, values, dialect, replacementFunc)[0];
  }
  return [sql, bindParam];
};

Query.prototype.run = function(sql, parameters) {
  this.sql = sql;

  if(!Utils._.isEmpty(this.options.searchPath)){
    this.sql = this.sequelize.queryInterface.QueryGenerator.setSearchPath(this.options.searchPath) + sql;
  }

  var self = this
    , receivedError = false
    , query = ((parameters && parameters.length) ? this.client.query(this.sql, parameters) : this.client.query(this.sql))
    , rows = [];

  //do we need benchmark for this query execution
  var benchmark = this.sequelize.options.benchmark || this.options.benchmark;
  
  if (!benchmark) {
    this.sequelize.log('Executing (' + (this.client.uuid || 'default') + '): ' + this.sql, this.options);
  } else {
    var queryBegin = Date.now();
  }

  var promise = new Promise(function(resolve, reject) {
    query.on('row', function(row) {
      rows.push(row);
    });

    query.on('error', function(err) {

      // set the client so that it will be reaped if the connection resets while executing
      if(err.code === 'ECONNRESET') {
        self.client._invalid = true;
      }

      receivedError = true;
      err.sql = sql;
      reject(self.formatError(err));
    });

    query.on('end', function(result) {

      if (benchmark) {
        self.sequelize.log('Executed (' + (self.client.uuid || 'default') + '): ' + self.sql + ' in ' + (Date.now() - queryBegin) + 'ms', self.options);
      }

      if (receivedError) {
        return;
      }

      resolve([rows, sql, result]);
    });
  }).spread(function(rows, sql, result) {
    var results = rows
      , isTableNameQuery = (sql.indexOf('SELECT table_name FROM information_schema.tables') === 0)
      , isRelNameQuery = (sql.indexOf('SELECT relname FROM pg_class WHERE oid IN') === 0);

    if (isRelNameQuery) {
      return rows.map(function(row) {
        return {
          name: row.relname,
          tableName: row.relname.split('_')[0]
        };
      });
    } else if (isTableNameQuery) {
      return rows.map(function(row) { return _.values(row); });
    }

    if (rows[0] && rows[0].sequelize_caught_exception !== undefined) {
      if (rows[0].sequelize_caught_exception !== null) {
        var err = self.formatError({
          code: '23505',
          detail: rows[0].sequelize_caught_exception
        });
        throw err;
      } else {
        rows = rows.map(function (row) {
          delete row.sequelize_caught_exception;
          return row;
        });
      }
    }

    if (self.isShowIndexesQuery()) {
      results.forEach(function (result) {
        var attributes = /ON .*? (?:USING .*?\s)?\((.*)\)/gi.exec(result.definition)[1].split(',')
          , field
          , attribute
          , columns;

        // Map column index in table to column name
        columns = _.zipObject(
          result.column_indexes,
          self.sequelize.queryInterface.QueryGenerator.fromArray(result.column_names)
        );
        delete result.column_indexes;
        delete result.column_names;

        // Indkey is the order of attributes in the index, specified by a string of attribute indexes
        result.fields = result.indkey.split(' ').map(function (indKey, index) {
          field = columns[indKey];
          // for functional indices indKey = 0
          if(!field) {
            return null;
          }
          attribute = attributes[index];
          return {
            attribute: field,
            collate: attribute.match(/COLLATE "(.*?)"/) ? /COLLATE "(.*?)"/.exec(attribute)[1] : undefined,
            order: attribute.indexOf('DESC') !== -1 ? 'DESC' : attribute.indexOf('ASC') !== -1 ? 'ASC': undefined,
            length: undefined
          };
        }).filter(function(n){ return n !== null; });
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
      // Postgres will treat tables as case-insensitive, so fix the case
      // of the returned values to match attributes
      if (self.options.raw === false && self.sequelize.options.quoteIdentifiers === false) {
        var attrsMap = _.reduce(self.model.attributes, function(m, v, k) { m[k.toLowerCase()] = k; return m; }, {});
        rows.forEach(function(row) {
          _.keys(row).forEach(function(key) {
            var targetAttr = attrsMap[key];
            if (typeof targetAttr === 'string' && targetAttr !== key) {
              row[targetAttr] = row[key];
              delete row[key];
            }
          });
        });
      }

      return self.handleSelectQuery(rows);
    } else if (QueryTypes.DESCRIBE === self.options.type) {
      result = {};

      rows.forEach(function(_result) {
        result[_result.Field] = {
          type: _result.Type.toUpperCase(),
          allowNull: (_result.Null === 'YES'),
          defaultValue: _result.Default,
          special: (!!_result.special ? self.sequelize.queryInterface.QueryGenerator.fromArray(_result.special) : []),
          primaryKey: _result.Constraint === 'PRIMARY KEY'
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
    } else if (self.isVersionQuery()) {
      return results[0].server_version;
    } else if (self.isShowOrDescribeQuery()) {
      return results;
    } else if (QueryTypes.BULKUPDATE === self.options.type) {
      if (!self.options.returning) {
        return parseInt(result.rowCount, 10);
      }

      return self.handleSelectQuery(rows);
    } else if (QueryTypes.BULKDELETE === self.options.type) {
      return parseInt(result.rowCount, 10);
    } else if (self.isUpsertQuery()) {
      return rows[0].sequelize_upsert;
    } else if (self.isInsertQuery() || self.isUpdateQuery()) {
      if (self.instance && self.instance.dataValues) {
        for (var key in rows[0]) {
          if (rows[0].hasOwnProperty(key)) {
            var record = rows[0][key];

            var attr = _.find(self.model.rawAttributes, function (attribute) {
              return attribute.fieldName === key || attribute.field === key;
            });

            self.instance.dataValues[attr && attr.fieldName || key] = record;
          }
        }
      }

      return self.instance || (rows && ((self.options.plain && rows[0]) || rows)) || undefined;
    } else if (self.isRawQuery()) {
      return [rows, result];
    } else {
      return results;
    }
  });

  return promise;
};

Query.prototype.formatError = function (err) {
  var match
    , table
    , index
    , fields
    , errors
    , message
    , self = this;

  var code = err.code || err.sqlState
    , errMessage = err.message || err.messagePrimary
    , errDetail = err.detail || err.messageDetail;

  switch (code) {
    case '23503':
      index = errMessage.match(/violates foreign key constraint \"(.+?)\"/);
      index = index ? index[1] : undefined;
      table = errMessage.match(/on table \"(.+?)\"/);
      table = table ? table[1] : undefined;

      return new sequelizeErrors.ForeignKeyConstraintError({
        message: errMessage,
        fields: null,
        index: index,
        table: table,
        parent: err
      });
    case '23505':
      // there are multiple different formats of error messages for this error code
      // this regex should check at least two
      if (errDetail && (match = errDetail.replace(/"/g, '').match(/Key \((.*?)\)=\((.*?)\)/))) {
        fields = _.zipObject(match[1].split(', '), match[2].split(', '));
        errors = [];
        message = 'Validation error';

        _.forOwn(fields, function(value, field) {
          errors.push(new sequelizeErrors.ValidationErrorItem(
            self.getUniqueConstraintErrorMessage(field),
            'unique violation', field, value));
        });

        if (this.model && this.model.uniqueKeys) {
          _.forOwn(this.model.uniqueKeys, function(constraint) {
            if (_.isEqual(constraint.fields, Object.keys(fields)) && !!constraint.msg) {
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
          message: errMessage,
          parent: err
        });
      }

      break;
    case '23P01':
      match = errDetail.match(/Key \((.*?)\)=\((.*?)\)/);

      if (match) {
        fields = _.zipObject(match[1].split(', '), match[2].split(', '));
      }
      message = 'Exclusion constraint error';

      return new sequelizeErrors.ExclusionConstraintError({
        message: message,
        constraint: err.constraint,
        fields: fields,
        table: err.table,
        parent: err
      });

    default:
      return new sequelizeErrors.DatabaseError(err);
  }
};

Query.prototype.isForeignKeysQuery = function() {
  return /SELECT conname as constraint_name, pg_catalog\.pg_get_constraintdef\(r\.oid, true\) as condef FROM pg_catalog\.pg_constraint r WHERE r\.conrelid = \(SELECT oid FROM pg_class WHERE relname = '.*' LIMIT 1\) AND r\.contype = 'f' ORDER BY 1;/.test(this.sql);
};

Query.prototype.getInsertIdField = function() {
  return 'id';
};

module.exports = Query;
