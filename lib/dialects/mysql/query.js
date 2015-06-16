'use strict';

var Utils = require('../../utils')
  , AbstractQuery = require('../abstract/query')
  , uuid = require('node-uuid')
  , sequelizeErrors = require('../../errors.js');

var Query = function(connection, sequelize, options) {
  this.connection = connection;
  this.instance = options.instance;
  this.model = options.model;
  this.sequelize = sequelize;
  this.uuid = uuid.v4();
  this.options = Utils._.extend({
    logging: console.log,
    plain: false,
    raw: false
  }, options || {});

  this.checkLoggingOption();
};

Utils.inherit(Query, AbstractQuery);
Query.prototype.run = function(sql) {
  var self = this;
  this.sql = sql;

  this.sequelize.log('Executing (' + (this.connection.uuid || 'default') + '): ' + this.sql, this.options);

  var promise = new Utils.Promise(function(resolve, reject) {
    self.connection.query(self.sql, function(err, results) {
      if (err) {
        err.sql = sql;

        reject(self.formatError(err));
      } else {
        resolve(self.formatResults(results));
      }
    }).setMaxListeners(100);
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
      result[_result.Field] = {
        type: _result.Type.toUpperCase(),
        allowNull: (_result.Null === 'YES'),
        defaultValue: _result.Default
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
  data = Utils._.foldl(data, function (acc, item) {
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
