'use strict';

var Utils = require('../../utils')
  , AbstractQuery = require('../abstract/query')
  , uuid = require('node-uuid')
  , sequelizeErrors = require('../../errors.js')
  , _ = require('lodash');

var Query = function(connection, sequelize, options) {
  this.connection = connection;
  this.instance = options.instance;
  this.model = options.model;
  this.sequelize = sequelize;
  this.uuid = uuid.v4();
  this.options = Utils._.extend({
    logging: console.log,
    plain: false,
    raw: false,
    showWarnings: false
  }, options || {});

  this.checkLoggingOption();
};

Utils.inherit(Query, AbstractQuery);
Query.formatBindParameters = AbstractQuery.formatBindParameters;
Query.prototype.run = function(sql, parameters) {
  var self = this;
  this.sql = sql;
  
  //do we need benchmark for this query execution
  var benchmark = this.sequelize.options.benchmark || this.options.benchmark;
  var showWarnings = this.sequelize.options.showWarnings || this.options.showWarnings;

  if (benchmark) {
    var queryBegin = Date.now();
  } else {
    this.sequelize.log('Executing (' + (this.connection.uuid || 'default') + '): ' + this.sql, this.options);
  }

  var promise = new Utils.Promise(function(resolve, reject) {
    self.connection.query(self.sql, function(err, results) {

      if (benchmark) {
        self.sequelize.log('Executed (' + (self.connection.uuid || 'default') + '): ' + self.sql, (Date.now() - queryBegin), self.options);
      }

      if (err) {
        err.sql = sql;

        reject(self.formatError(err));
      } else {
        resolve(results);
      }
    }).setMaxListeners(100);
  })
  // Log warnings if we've got them.
  .then(function(results){
    if (showWarnings && results && results.warningCount > 0) {
      return self.logWarnings(results);
    }
    return results;
  })
  // Return formatted results...
  .then(function(results){
    return self.formatResults(results);
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
      result = data[this.getInsertIdField()];
    }
  }

  if (this.isSelectQuery()) {
    result = this.handleSelectQuery(data);
  } else if (this.isShowTablesQuery()) {
    result = this.handleShowTablesQuery(data);
  } else if (this.isDescribeQuery()) {
    result = {};

    data.forEach(function(_result) {
      var enumRegex = /^enum/i;
      result[_result.Field] = {
        type: enumRegex.test(_result.Type) ? _result.Type.replace(enumRegex, 'ENUM') : _result.Type.toUpperCase(),
        allowNull: (_result.Null === 'YES'),
        defaultValue: _result.Default,
        primaryKey: _result.Key === 'PRI'
      };
    });
  } else if (this.isShowIndexesQuery()) {
    result = this.handleShowIndexesQuery(data);

  } else if (this.isCallQuery()) {
    result = data[0];
  } else if (this.isBulkUpdateQuery() || this.isBulkDeleteQuery() || this.isUpsertQuery()) {
    result = data.affectedRows;
  } else if (this.isVersionQuery()) {
    result = data[0].version;
  } else if (this.isForeignKeysQuery()) {
    result = data;
  } else if (this.isRawQuery()) {
    // MySQL returns row data and metadata (affected rows etc) in a single object - let's standarize it, sorta
    result = [data, data];
  }

  return result;
};

Query.prototype.logWarnings = function (results) {
  var self = this;
  return this.run('SHOW WARNINGS').then(function(warningResults) {
    var warningMessage = 'MySQL Warnings (' + (self.connection.uuid||'default') + '): ';
    var messages = [];
        
    warningResults.forEach(function(_warningRow){
      _warningRow.forEach(function(_warningResult) {
        if (_warningResult.hasOwnProperty('Message')) {
          messages.push(_warningResult.Message);
        } else {
          _warningResult.keys().forEach( function(_objectKey) {
            messages.push([_objectKey, _warningResult[_objectKey]].join(': '));
          });
        }
      });
  });
    
    self.sequelize.log(warningMessage + messages.join('; '), self.options);
    
    return results;
  });
};

Query.prototype.formatError = function (err) {
  var match;

  switch (err.errno || err.code) {
    case 1062:
      match = err.message.match(/Duplicate entry '(.*)' for key '?((.|\s)*?)'?$/);

      var values = match ? match[1].split('-') : undefined
        , fields = {}
        , message = 'Validation error'
        , uniqueKey = this.model && this.model.uniqueKeys[match[2]];

      if (!!uniqueKey) {
        if (!!uniqueKey.msg) message = uniqueKey.msg;
        fields = Utils._.zipObject(uniqueKey.fields, values);
      } else {
        fields[match[2]] = match[1];
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

    case 1451:
      match = err.message.match(/FOREIGN KEY \(`(.*)`\) REFERENCES `(.*)` \(`(.*)`\)(?: ON .*)?\)$/);

      return new sequelizeErrors.ForeignKeyConstraintError({
        fields: null,
        index: match ? match[3] : undefined,
        parent: err
      });

    case 1452:
      match = err.message.match(/FOREIGN KEY \(`(.*)`\) REFERENCES `(.*)` \(`(.*)`\)(.*)\)$/);

      return new sequelizeErrors.ForeignKeyConstraintError({
        fields: null,
        index: match ? match[1] : undefined,
        parent: err
      });

    default:
      return new sequelizeErrors.DatabaseError(err);
  }
};

Query.prototype.handleShowIndexesQuery = function (data) {
  // Group by index name, and collect all fields
  data = _.reduce(data, function (acc, item) {
    if (!(item.Key_name in acc)) {
      acc[item.Key_name] = item;
      item.fields = [];
    }

    acc[item.Key_name].fields[item.Seq_in_index - 1] = {
      attribute: item.Column_name,
      length: item.Sub_part || undefined,
      order: item.Collation === 'A' ? 'ASC' : undefined
    };
    delete item.column_name;

    return acc;
  }, {});

  return Utils._.map(data, function(item) {
    return {
      primary: item.Key_name === 'PRIMARY',
      fields: item.fields,
      name: item.Key_name,
      tableName: item.Table,
      unique: (item.Non_unique !== 1),
      type: item.Index_type,
    };
  });
};

module.exports = Query;
