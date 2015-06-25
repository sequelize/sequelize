'use strict';

var Utils = require('../../utils')
  , AbstractQuery = require('../abstract/query')
  , sequelizeErrors = require('../../errors.js');

var Query = function(connection, sequelize, options) {
  this.connection = connection;
  this.instance = options.instance;
  this.model = options.model;
  this.sequelize = sequelize;
  this.options = Utils._.extend({
    logging: console.log,
    plain: false,
    raw: false
  }, options || {});

  this.checkLoggingOption();
};

Utils.inherit(Query, AbstractQuery);

Query.prototype.getInsertIdField = function() {
  return 'id';
};

Query.prototype.run = function(sql) {
  var self = this;
  this.sql = sql;

  this.sequelize.log('Executing (' + (this.connection.uuid || 'default') + '): ' + this.sql, this.options);

  var promise = new Utils.Promise(function(resolve, reject) {
      // TRANSACTION SUPPORT
      if (Utils._.contains(self.sql, 'BEGIN TRANSACTION')) {
        self.connection.beginTransaction(function(err) {
          if (!!err) {
            reject(self.formatError(err));
          } else {
            resolve(self.formatResults());
          }
        } /* name, isolation_level */);
      } else if (Utils._.contains(self.sql, 'COMMIT TRANSACTION')) {
        self.connection.commitTransaction(function(err) {
          if (!!err) {
            reject(self.formatError(err));
          } else {
            resolve(self.formatResults());
          }
        });
      } else if (Utils._.contains(self.sql, 'ROLLBACK TRANSACTION')) {
        self.connection.rollbackTransaction(function(err) {
          if (!!err) {
            reject(self.formatError(err));
          } else {
            resolve(self.formatResults());
          }
        });
      } else {
        // QUERY SUPPORT
        var results = [];

        var request = new self.connection.lib.Request(self.sql, function(err) {
          if (err) {
            err.sql = sql;
            reject(self.formatError(err));
          } else {
            resolve(self.formatResults(results));
          }
        });

        request.on('row', function(columns) {
          var row = {};
          columns.forEach(function(column) {
            row[column.metadata.colName] = column.value;
          });

          results.push(row);
        });

        self.connection.execSql(request);
      }
  });

  return promise;
};

/**
 * High level function that handles the results of a query execution.
 *
 *
 * Example:
 *  query.formatResults([
 *    {
 *      id: 1,              // this is from the main table
 *      attr2: 'snafu',     // this is from the main table
 *      Tasks.id: 1,        // this is from the associated table
 *      Tasks.title: 'task' // this is from the associated table
 *    }
 *  ])
 *
 * @param {Array} data - The result of the query execution.
 */
Query.prototype.formatResults = function(data) {
  var result = this.instance;
  if (this.isInsertQuery(data)) {
    this.handleInsertQuery(data);

    if (!this.instance) {
      if (this.options.plain) {
        // NOTE: super contrived. This just passes the newly added query-interface
        //       test returning only the PK. There isn't a way in MSSQL to identify
        //       that a given return value is the PK, and we have no schema information
        //       because there was no calling Model.
        var record = data[0];
        result = record[Object.keys(record)[0]];
      } else {
        result = data;
      }
    }
  }

  if (this.isShowTablesQuery()) {
    result = this.handleShowTablesQuery(data);
  } else if (this.isDescribeQuery()) {
    result = {};
    data.forEach(function(_result) {
      if (_result.Default)
        _result.Default = _result.Default.replace("('",'').replace("')",'').replace(/'/g,''); /* jshint ignore: line */

      result[_result.Name] = {
        type: _result.Type.toUpperCase(),
        allowNull: (_result.IsNull === 'YES' ? true : false),
        defaultValue: _result.Default
      };
    });
  } else if (this.isShowIndexesQuery()) {
    result = this.handleShowIndexesQuery(data);
  } else if (this.isSelectQuery()) {
    result = this.handleSelectQuery(data);
  } else if (this.isCallQuery()) {
    result = data[0];
  } else if (this.isBulkUpdateQuery()) {
    result = data.length;
  } else if (this.isBulkDeleteQuery()){
    result = data[0] && data[0].AFFECTEDROWS;
  } else if (this.isVersionQuery()) {
    result = data[0].version;
  } else if (this.isForeignKeysQuery()) {
    result = data;
  } else if (this.isRawQuery()) {
    // MSSQL returns row data and metadata (affected rows etc) in a single object - let's standarize it, sorta
    result = [data, data];
   }

  return result;
};

Query.prototype.handleShowTablesQuery = function(results) {
  return results.map(function(resultSet) {
    return {
      tableName: resultSet.TABLE_NAME,
      schema: resultSet.TABLE_SCHEMA
    };
  });
};

Query.prototype.formatError = function (err) {
  var match;
  match = err.message.match(/Violation of UNIQUE KEY constraint '((.|\s)*)'. Cannot insert duplicate key in object '.*'. The duplicate key value is \((.*)\)./);
  match = match || err.message.match(/Cannot insert duplicate key row in object .* with unique index '(.*)'/);
  if (match && match.length > 1) {
    var fields = {}
      , message = 'Validation error'
      , uniqueKey = this.model.uniqueKeys[match[1]];

    if (!!uniqueKey.msg) message = uniqueKey.msg;
    if (!!match[2]) {
      var values = match[2].split(',').map(Function.prototype.call, String.prototype.trim);
      if (!!uniqueKey) {
        fields = Utils._.zipObject(uniqueKey.fields, values);
      } else {
        fields[match[1]] = match[2];
      }
    }

    var errors = [];
    var self = this;
    Utils._.forOwn(fields, function(value, field) {
      errors.push(new sequelizeErrors.ValidationErrorItem(
        self.getUniqueConstraintErrorMessage(field),
        'unique violation', field, value));
    });

    return new sequelizeErrors.UniqueConstraintError({
      message: message,
      errors: errors,
      parent: err,
      fields: fields
    });
  }

  match = err.message.match(/Failed on step '(.*)'.Could not create constraint. See previous errors./) ||
          err.message.match(/The DELETE statement conflicted with the REFERENCE constraint "(.*)". The conflict occurred in database "(.*)", table "(.*)", column '(.*)'./) ||
          err.message.match(/The INSERT statement conflicted with the FOREIGN KEY constraint "(.*)". The conflict occurred in database "(.*)", table "(.*)", column '(.*)'./) ||
          err.message.match(/The UPDATE statement conflicted with the FOREIGN KEY constraint "(.*)". The conflict occurred in database "(.*)", table "(.*)", column '(.*)'./);
  if (match && match.length > 0) {
    return new sequelizeErrors.ForeignKeyConstraintError({
      fields: null,
      index: match[1],
      parent: err
    });
  }

  return new sequelizeErrors.DatabaseError(err);
};

Query.prototype.isShowOrDescribeQuery = function() {
  var result = false;

  result = result || (this.sql.toLowerCase().indexOf("select c.column_name as 'name', c.data_type as 'type', c.is_nullable as 'isnull'") === 0); /* jshint ignore: line */
  result = result || (this.sql.toLowerCase().indexOf('select tablename = t.name, name = ind.name,') === 0);
  result = result || (this.sql.toLowerCase().indexOf('exec sys.sp_helpindex @objname') === 0);

  return result;
};

Query.prototype.isShowIndexesQuery = function () {
  return this.sql.toLowerCase().indexOf('exec sys.sp_helpindex @objname') === 0;
};

Query.prototype.handleShowIndexesQuery = function (data) {
  // Group by index name, and collect all fields
  data = Utils._.foldl(data, function (acc, item) {
    if (!(item.index_name in acc)) {
      acc[item.index_name] = item;
      item.fields = [];
    }

    Utils._.forEach(item.index_keys.split(','), function(column) {
      var columnName = column.trim();
      if (columnName.indexOf('(-)') !== -1) {
        columnName = columnName.replace('(-)','');
      }

      acc[item.index_name].fields.push({
        attribute: columnName,
        length: undefined,
        order: (column.indexOf('(-)') !== -1 ? 'DESC' : 'ASC'),
        collate: undefined
      });
    });
    delete item.index_keys;
    return acc;
  }, {});

  return Utils._.map(data, function(item) {
    return {
      primary: (item.index_name.toLowerCase().indexOf('pk') === 0),
      fields: item.fields,
      name: item.index_name,
      tableName: undefined,
      unique: (item.index_description.toLowerCase().indexOf('unique') !== -1),
      type: undefined,
    };
  });
};

Query.prototype.handleInsertQuery = function(results, metaData) {
  if (this.instance) {
    // add the inserted row id to the instance
    var autoIncrementField = this.model.autoIncrementField
      , autoIncrementFieldAlias = null
      , id = null;

    if (this.model.rawAttributes.hasOwnProperty(autoIncrementField) &&
        this.model.rawAttributes[autoIncrementField].field !== undefined)
      autoIncrementFieldAlias = this.model.rawAttributes[autoIncrementField].field ;

    id = id || (results && results[0][this.getInsertIdField()]);
    id = id || (metaData && metaData[this.getInsertIdField()]);
    id = id || (results && results[0][autoIncrementField]);
    id = id || (autoIncrementFieldAlias && results && results[0][autoIncrementFieldAlias]);

    this.instance[autoIncrementField] = id;
  }
};

module.exports = Query;
