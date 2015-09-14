'use strict';

var Utils = require('../../utils')
  , AbstractQuery = require('../abstract/query')
  , DataTypes = require('../../data-types')
  , hstore = require('./hstore')
  , range = require('./range')
  , QueryTypes = require('../../query-types')
  , Promise = require('../../promise')
  , sequelizeErrors = require('../../errors.js');

var parseDialectSpecificFields,
    dialectSpecificTypes;

parseDialectSpecificFields = {
  // Parses hstore fields if the model has any hstore fields.
  // This cannot be done in the 'pg' lib because hstore is a UDT.
  hstore: function (value, options) {
    if (value === null) return null;

    return DataTypes.ARRAY.is(options.dataType, DataTypes.HSTORE) ?
      this.lib.types.arrayParser.create(value, hstore.parse).parse() : hstore.parse(value);
  },
  range:  function (value, options) {
    if (value === null) return null;

    return DataTypes.ARRAY.is(options.dataType, DataTypes.RANGE) ?
      this.lib.types.arrayParser.create(value, function (v) {
        return range.parse(v, options.dataType.type);
      }).parse() : range.parse(value, options.dataType);
  },
  geometry: function (value, options) {
    if (value === null) return null;
    return options.dataType.parse(value);
  }
};

dialectSpecificTypes = Utils._.keys(parseDialectSpecificFields);

function dialectSpecificFieldDatatypeMap (options, prefix) {
  if (!Utils._.isArray(options.types))
    return [];

  prefix = prefix || '';

  var fields = {};
  if (options.callee) {
    if (options.as)
      prefix += options.as + '.';

    Utils._.each(options.types, function (type) {
      Utils._.each(options.callee['_' + type + 'Attributes'], function (attrName) {
        fields[prefix + attrName] = {
          dataType: options.callee.attributes[attrName].type || null,
          type:     type
        };
      });
    });
  }

  Utils._.each(options.include, function (include) {
    fields = Utils._.merge(fields, dialectSpecificFieldDatatypeMap({
      callee:  include.model,
      as:      include.as,
      include: include.include,
      types:   options.types
    }, prefix));
  });

  return fields;
}

var Query = function(client, sequelize, options) {
  this.client = client;
  this.sequelize = sequelize;
  this.instance = options.instance;
  this.model = options.model;
  this.options = Utils._.extend({
    logging: console.log,
    plain: false,
    raw: false
  }, options || {});

  this.checkLoggingOption();
};
Utils.inherit(Query, AbstractQuery);

Query.prototype.parseDialectSpecificFields = parseDialectSpecificFields;

Query.prototype.run = function(sql) {
  this.sql = sql;

  if(!Utils._.isEmpty(this.options.searchPath)){
    this.sql = this.sequelize.queryInterface.QueryGenerator.setSearchPath(this.options.searchPath) + sql;
  }

  var self = this
    , receivedError = false
    , query = this.client.query(this.sql)
    , rows = [];

  this.sequelize.log('Executing (' + (this.client.uuid || 'default') + '): ' + this.sql, this.options);

  var promise = new Promise(function(resolve, reject) {
    query.on('row', function(row) {
      rows.push(row);
    });

    query.on('error', function(err) {
      receivedError = true;
      err.sql = sql;
      reject(self.formatError(err));
    });

    query.on('end', function(result) {
      if (receivedError) {
        return;
      }

      resolve([rows, sql, result]);
    });
  }).spread(function(rows, sql, result) {
    var results = rows
      , isTableNameQuery = (sql.indexOf('SELECT table_name FROM information_schema.tables') === 0)
      , isRelNameQuery = (sql.indexOf('SELECT relname FROM pg_class WHERE oid IN') === 0)
      , dialectSpecificFields
      , isDialectSpecificField = Utils._.memoize(function (key) { return dialectSpecificFields.hasOwnProperty(key); });

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
        columns = Utils._.zipObject(
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
        var attrsMap = Utils._.reduce(self.model.attributes, function(m, v, k) { m[k.toLowerCase()] = k; return m; }, {});
        rows.forEach(function(row) {
          Utils._.keys(row).forEach(function(key) {
            var targetAttr = attrsMap[key];
            if (typeof targetAttr === 'string' && targetAttr !== key) {
              row[targetAttr] = row[key];
              delete row[key];
            }
          });
        });
      }

      if (!!self.model && rows.length > 0) {
        dialectSpecificFields = dialectSpecificFieldDatatypeMap({
          callee:  self.model,
          include: self.options.include,
          types:   dialectSpecificTypes
        });

        // check whether custom fields exist in responses model
        if (!Utils._.isEmpty(dialectSpecificFields)) {
          rows.forEach(function (row, rowId, rows) {
            Utils._.each(row, function (value, key) {
              if (isDialectSpecificField(key))
                rows[rowId][key] =
                parseDialectSpecificFields[dialectSpecificFields[key].type](value, { dataType: dialectSpecificFields[key].dataType });
            });
          });
        }
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

      if (!!self.model && rows.length > 0) {
        dialectSpecificFields = dialectSpecificFieldDatatypeMap({
          callee:  self.model,
          types:   dialectSpecificTypes
        });

        // check whether custom fields exist in responses model
        if (!Utils._.isEmpty(dialectSpecificFields)) {
          rows.forEach(function (row, rowId, rows) {
            Utils._.each(row, function (value, key) {
              if (isDialectSpecificField(key))
                rows[rowId][key] =
                parseDialectSpecificFields[dialectSpecificFields[key].type](value, { dataType: dialectSpecificFields[key].dataType });
            });
          });
        }
      }

      return self.handleSelectQuery(rows);
    } else if (QueryTypes.BULKDELETE === self.options.type) {
      return parseInt(result.rowCount, 10);
    } else if (self.isUpsertQuery()) {
      return rows[0].sequelize_upsert;
    } else if (self.isInsertQuery() || self.isUpdateQuery()) {
      if (self.instance && self.instance.dataValues) {
        if (self.model) {
          dialectSpecificFields = dialectSpecificFieldDatatypeMap({
            callee:  self.model,
            types:   dialectSpecificTypes
          });

          // check whether custom fields exist in responses model
          if (!Utils._.isEmpty(dialectSpecificFields)) {
            Utils._.each(rows[0], function (value, key) {
              if (isDialectSpecificField(key))
                rows[0][key] =
                parseDialectSpecificFields[dialectSpecificFields[key].type](value, { dataType: dialectSpecificFields[key].dataType });
            });
          }
        }

        for (var key in rows[0]) {
          if (rows[0].hasOwnProperty(key)) {
            var record = rows[0][key];

            var attr = Utils._.find(self.model.rawAttributes, function (attribute) {
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
      match = errDetail.replace(/"/g, '').match(/Key \((.*?)\)=\((.*?)\)/);

      if (match) {
        fields = Utils._.zipObject(match[1].split(', '), match[2].split(', '));
        errors = [];
        message = 'Validation error';

        Utils._.forOwn(fields, function(value, field) {
          errors.push(new sequelizeErrors.ValidationErrorItem(
            self.getUniqueConstraintErrorMessage(field),
            'unique violation', field, value));
        });

        if (this.model && this.model.uniqueKeys) {
          Utils._.forOwn(this.model.uniqueKeys, function(constraint) {
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
          message: errMessage,
          parent: err
        });
      }

      break;
    case '23P01':
      match = errDetail.match(/Key \((.*?)\)=\((.*?)\)/);

      if (match) {
        fields = Utils._.zipObject(match[1].split(', '), match[2].split(', '));
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
