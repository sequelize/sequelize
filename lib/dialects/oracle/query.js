'use strict';

var Utils = require('../../utils')
  , AbstractQuery = require('../abstract/query')
  , _ = require('lodash')
  , autocommit = true
  , sequelizeErrors = require('../../errors.js');

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

  this.sequelize.log('Executing (' + (this.connection.uuid || 'default') + '): ' + this.sql, this.options);

  var promise = new Utils.Promise(function(resolve, reject) {
    // TRANSACTION SUPPORT
    if (_.contains(self.sql, 'ROLLBACK;')) {
      console.log('should roll back');
      self.connection.rollback(function(err) {
        if (!!err) {
          reject(self.formatError(err, self.sql));
        } else {
          resolve(self);
        }
      });
    } else if (_.contains(self.sql, 'COMMIT;')) {
      console.log('should send commit');
      self.connection.commit(function(err) {
        if (!!err) {
          reject(self.formatError(err, self.sql));
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
      var variables = {};
      if (self.sql.match('RETURNING "(.*?)" INTO')) {
        variables[self.sql.match('RETURNING "(.*?)" INTO')[1]] = { type: self.connection.lib.NUMBER, dir: self.connection.lib.BIND_OUT };
      }
      self.connection.execute(self.sql, variables, {autoCommit: autocommit}, function(err, result) {
        if (err) {
          console.log('Auto commit:'+ autocommit + ' Exec: =====  ' + sql + '===== end of code');
          console.log('Got error: ' + err);
          reject(self.formatError(err, sql));
        } else {
          // console.log('Auto commit:'+ autocommit + ' Exec: =====  ' + sql + '===== end of code');
          // console.log('Result rows:', result.rows);
          // console.log('Meta data:', result.metaData);
          // console.log('Out Binds:', result.outBinds);
          resolve(self.formatResults(result));
        }
      });
    }
  });
  
  return promise;
};

Query.prototype.getInsertIdField = function() {
  return 'id';
};

Query.prototype.formatError = function (err) {
  var match;
  console.log(err);
  var errstr = err.toString();
  if (errstr.indexOf('ORA-02291') !== -1 || errstr.indexOf('ORA-02292') !== -1) {
    return new sequelizeErrors.ForeignKeyConstraintError({
      parent :err
    });
  }
  return err;
};

Query.prototype.formatResults = function(data) {
  var result = this.instance;
  if (this.isInsertQuery(data)) {
    this.handleInsertQuery(data);

    if (!this.instance) {
      if (this.options.plain) {
        var record = data[0];
        result = record[Object.keys(record)[0]];
      } else {
        result = data;
      }
    }

    if (data.outBinds) {
      for (var attrname in data.outBinds) { result.dataValues[attrname] = data.outBinds[attrname][0]; }
    }
  }

  if (this.isShowTablesQuery()) {
    result = this.handleShowTablesQuery(data.rows);
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
    result = data.rows;
  } else if (this.isSelectQuery()) {
    result = this.handleSelectQuery(data.rows);
  } else if (this.isCallQuery()) {
    result = data.rows[0];
  } else if (this.isBulkUpdateQuery()) {
    result = data.length;
  } else if (this.isBulkDeleteQuery()){
    result = data[0] && data[0].AFFECTEDROWS;
  } else if (this.isVersionQuery()) {
    result = data.version;
  } else if (this.isForeignKeysQuery()) {
    result = data.rows;
  } else if (this.isRawQuery()) {
    // MSSQL returns row data and metadata (affected rows etc) in a single object - let's standarize it, sorta
    result = [data.rows, data.metaData];
   }
  return result;
};

module.exports = Query;
