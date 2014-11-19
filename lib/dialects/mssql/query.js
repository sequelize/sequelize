'use strict';

var Utils = require('../../utils')
  , AbstractQuery = require('../abstract/query')
  , sequelizeErrors = require('../../errors.js');

module.exports = (function() {
  var Query = function(connection, sequelize, callee, options) {
    this.connection = connection;
    this.callee = callee;
    this.sequelize = sequelize;
    this.options = Utils._.extend({
      logging: console.log,
      plain: false,
      raw: false
    }, options || {});

    var self = this;
    this.checkLoggingOption();
  };

  Utils.inherit(Query, AbstractQuery);

  Query.prototype.getInsertIdField = function() {
    return 'id';
  };

  Query.prototype.run = function(sql) {
    var self = this;
    this.sql = sql;

    if (this.options.logging !== false) {
      this.sequelize.log('Executing (' + (this.connection.uuid || 'default') + '): ' + this.sql);
    }

    var promise = new Utils.Promise(function(resolve, reject) {
      if (!sql) {
        resolve(self.formatResults());
        return promise;
      }

      if (self.sql === 'BEGIN TRANSACTION') {
        var trans = new self.connection.lib.Transaction(self.connection.context);
        trans.begin(function(err){
          if (err) {
            this.sequelize.log(err.message);
            reject(self.formatError(err));
          } else {
            self.connection.lib._transaction = trans;
            resolve();
          }
        });
      } else {
        var request, transCommand;
        if (self.connection.lib._transaction && self.connection.uuid) {
          request = new self.connection.lib.Request(self.connection.lib._transaction);

          if (self.sql === 'COMMIT TRANSACTION;') {
            transCommand = 'commit';
          } else if (self.sql === 'ROLLBACK TRANSACTION;') {
            transCommand = 'rollback';
          }

          if (self.sql === 'COMMIT TRANSACTION;' || self.sql === 'ROLLBACK TRANSACTION;') {
            self.connection.lib._transaction[transCommand](function (err, result) {
              if (err) {
                self.sequelize.log(err.message);
                reject(self.formatError(err));
              } else {
                resolve(self.formatResults(result));
              }
            });

            return promise;
          }
        } else {
          request = new self.connection.lib.Request(self.connection.context);
        }

        request.query(self.sql, function(err, recordset) {
          if (promise) {
            promise.emit('sql', self.sql, self.connection.uuid);
          }

          if (err) {
            self.sequelize.log(err.message);
            reject(self.formatError(err));
          } else {
            resolve(self.formatResults(recordset));
          }
        });
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
    var result = this.callee;
    if (this.isInsertQuery(data)) {
      this.handleInsertQuery(data);
    }

    if (this.isShowTableQuery()) {
      result = this.handleShowTableQuery(data);
    } else if (this.isShowOrDescribeQuery()) {
      result = data;
      if (this.sql.toLowerCase().indexOf("select c.column_name as 'name', c.data_type as 'type', c.is_nullable as 'isnull'") === 0) {
        result = {};
        data.forEach(function(_result) {
          if (_result.Default)
            _result.Default = _result.Default.replace('(\'','').replace('\')','').replace(/'/g,'');

          result[_result.Name] = {
            type: _result.Type.toUpperCase(),
            allowNull: (_result.IsNull === 'YES' ? true : false),
            defaultValue: _result.Default
          };
        });
      } else if (this.isShowIndexesQuery()) {
        result = this.handleShowIndexesQuery(data);
      }
    } else if (this.isSelectQuery()) {
      result = this.handleSelectQuery(data);
    } else if (this.isCallQuery()) {
      result = data[0];
    } else if (this.isBulkUpdateQuery()) {
      result = data.length;
    } else if (this.isBulkDeleteQuery()){
      result = data[0].AFFECTEDROWS;
    }

    return result;
  };

  Query.prototype.formatError = function (err) {
    var match;
    match = err.message.match(/Violation of UNIQUE KEY constraint '(.*)'. Cannot insert duplicate key in object '?(.*?)$/);
    if (match && match.length > 1) {
      return new sequelizeErrors.UniqueConstraintError({
        name: 'SequelizeUniqueConstraintError',
        fields: null,
        index: 0,
        value: match[2],
        parent: err
      });
    }

    match = err.message.match(/Failed on step '(.*)'.Could not create constraint. See previous errors./);
    match = err.message.match(/The DELETE statement conflicted with the REFERENCE constraint "(.*)". The conflict occurred in database "(.*)", table "(.*)", column '(.*)'./);
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

    result = result || (this.sql.toLowerCase().indexOf("select c.column_name as 'name', c.data_type as 'type', c.is_nullable as 'isnull'") === 0);
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
    if (this.callee) {
      // add the inserted row id to the instance
      var autoIncrementField = this.callee.Model.autoIncrementField
        , autoIncrementFieldAlias = null
        , id = null;

      if (this.callee.Model.rawAttributes.hasOwnProperty(autoIncrementField) &&
          this.callee.Model.rawAttributes[autoIncrementField].field !== undefined)
        autoIncrementFieldAlias = this.callee.Model.rawAttributes[autoIncrementField].field ;

      id = id || (results && results[0][this.getInsertIdField()]);
      id = id || (metaData && metaData[this.getInsertIdField()]);
      id = id || (results && results[0][autoIncrementField]);
      id = id || (autoIncrementFieldAlias && results && results[0][autoIncrementFieldAlias]);

      this.callee[autoIncrementField] = id;
    }
  };

  return Query;
})();
