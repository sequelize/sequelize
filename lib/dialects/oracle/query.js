'use strict';

var Utils = require('../../utils')
  , AbstractQuery = require('../abstract/query')
  , _ = require('lodash')
  , autocommit = true;

var Query = function(connection, sequelize, options) {
  this.connection = connection;
  this.instance = options.instance;
  this.model = options.model;
  this.sequelize = sequelize;
  this.options = _.extend({
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

  var promise = new Utils.Promise(function(resolve, reject) {
    // TRANSACTION SUPPORT
    if (_.contains(self.sql, 'ROLLBACK;')) {
      console.log('should roll back');
      self.connection.rollback(function(err) {
        if (!!err) {
          reject(self);
        } else {
          resolve(self);
        }
      });
    } else if (_.contains(self.sql, 'COMMIT;')) {
      console.log('should send commit');
      self.connection.commit(function(err) {
        if (!!err) {
          reject(self);
        } else {
          resolve(self);
        }
      });
    } else if (_.contains(self.sql, 'SET AUTOCOMMIT ON')) {
      autocommit = true;
      console.log('auto commit is set on');
    } else if (_.contains(self.sql, 'SET AUTOCOMMIT OFF')) {
      autocommit = false;
      console.log('auto commit is set off');
    } else {
      // QUERY SUPPORT
      console.log('Auto commit:'+ autocommit + ' Exec: =====  ' + sql + '===== end of code');
      self.connection.execute(self.sql, {}, {autoCommit: autocommit}, function(err, result) {
        if (err) {
          err.sql = sql;
          console.log('Got error: ' + err);
          reject(err);
        } else {
          resolve(self.formatResults(result));
        }
      });
    }
  });
  
  return promise;
};

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
    result = data;
  } else if (this.isDescribeQuery()) {
    result = {};
    data.forEach(function(_result) {
      if (_result.Default) {
        _result.Default = _result.Default.replace("('",'').replace("')",'').replace(/'/g,''); /* jshint ignore: line */
      }

      result[_result.Name] = {
        type: _result.Type.toUpperCase(),
        allowNull: (_result.IsNull === 'YES' ? true : false),
        defaultValue: _result.Default,
        primaryKey: _result.Constraint === 'PRIMARY KEY'
      };
    });
  } else if (this.isShowIndexesQuery()) {
    result = data;
  } else if (this.isSelectQuery()) {
    result = this.handleSelectQuery(data);
  } else if (this.isCallQuery()) {
    result = data[0];
  } else if (this.isBulkUpdateQuery()) {
    result = data.length;
  } else if (this.isBulkDeleteQuery()){
    result = data[0] && data[0].AFFECTEDROWS;
  } else if (this.isVersionQuery()) {
    result = data.version;
  } else if (this.isForeignKeysQuery()) {
    result = data;
  } else if (this.isRawQuery()) {
    // MSSQL returns row data and metadata (affected rows etc) in a single object - let's standarize it, sorta
    result = [data, data];
   }

  return result;
};

module.exports = Query;
