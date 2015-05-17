'use strict';

var Utils = require('../../utils')
  , AbstractQuery = require('../abstract/query')
  , QueryTypes = require('../../query-types')
  , sequelizeErrors = require('../../errors.js');

module.exports = (function() {
  var Query = function(database, sequelize, options) {
    this.database = database;
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

  Query.prototype.getInsertIdField = function() {
    return 'lastID';
  };

  Query.prototype.run = function(sql) {
    var self = this
      , promise;

    this.sql = sql;

    this.sequelize.log('Executing (' + (this.database.uuid || 'default') + '): ' + this.sql, this.options);

    promise = new Utils.Promise(function(resolve) {
      var columnTypes = {};

      self.database.serialize(function() {
        var executeSql = function() {
          if (self.sql.indexOf('-- ') === 0) {
            return resolve();
          } else {
            resolve(new Utils.Promise(function(resolve, reject) {
              self.database[self.getDatabaseMethod()](self.sql, function(err, results) {
                if (err) {
                  err.sql = self.sql;
                  reject(self.formatError(err));
                } else {
                  var metaData = this;
                  metaData.columnTypes = columnTypes;

                  var result = self.instance;

                  // add the inserted row id to the instance
                  if (self.isInsertQuery(results, metaData)) {
                    self.handleInsertQuery(results, metaData);

                    if (!self.instance) {
                      result = metaData[self.getInsertIdField()];
                    }
                  }

                  if (self.sql.indexOf('sqlite_master') !== -1) {
                    result = results.map(function(resultSet) { return resultSet.name; });
                  } else if (self.isSelectQuery()) {
                    if (!self.options.raw) {
                      results = results.map(function(result) {
                        for (var name in result) {
                          if (result.hasOwnProperty(name) && metaData.columnTypes[name]) {
                            if (metaData.columnTypes[name] === 'DATETIME') {
                              // we need to convert the timestamps into actual date objects
                              var val = result[name];

                              if (val !== null) {
                                if (val.indexOf('+') === -1) {
                                  // For backwards compat. Dates inserted by sequelize < 2.0dev12 will not have a timestamp set
                                  result[name] = new Date(val + self.sequelize.options.timezone);
                                } else {
                                  result[name] = new Date(val); // We already have a timezone stored in the string
                                }
                              }
                            } else if (metaData.columnTypes[name].lastIndexOf('BLOB') !== -1) {
                              if (result[name]) {
                                result[name] = new Buffer(result[name]);
                              }
                            }
                          }
                        }
                        return result;
                      });
                    }

                    result = self.handleSelectQuery(results);
                  } else if (self.isShowOrDescribeQuery()) {
                    result = results;
                  } else if (self.sql.indexOf('PRAGMA INDEX_LIST') !== -1) {
                    result = self.handleShowIndexesQuery(results);
                  } else if (self.sql.indexOf('PRAGMA INDEX_INFO') !== -1) {
                    result = results;
                  } else if (self.sql.indexOf('PRAGMA TABLE_INFO') !== -1) {
                    // this is the sqlite way of getting the metadata of a table
                    result = {};

                    results.forEach(function(_result) {
                      result[_result.name] = {
                        type: _result.type,
                        allowNull: (_result.notnull === 0),
                        defaultValue: _result.dflt_value,
                        primaryKey : (_result.pk === 1)
                      };

                      if (result[_result.name].type === 'TINYINT(1)') {
                        result[_result.name].defaultValue = { '0': false, '1': true }[result[_result.name].defaultValue];
                      }

                      if (result[_result.name].defaultValue === undefined) {
                        result[_result.name].defaultValue = null;
                      }

                      if (typeof result[_result.name].defaultValue === 'string') {
                        result[_result.name].defaultValue = result[_result.name].defaultValue.replace(/'/g, '');
                      }
                    });
                  } else if (self.sql.indexOf('PRAGMA foreign_keys;') !== -1) {
                    result = results[0];
                  } else if (self.sql.indexOf('PRAGMA foreign_keys') !== -1) {
                    result = results;
                  } else if (self.sql.indexOf('PRAGMA foreign_key_list') !== -1) {
                    result = results;
                  } else if ([QueryTypes.BULKUPDATE, QueryTypes.BULKDELETE].indexOf(self.options.type) !== -1) {
                    result = metaData.changes;
                  } else if (self.options.type === QueryTypes.UPSERT) {
                    result = undefined;
                  } else if (self.options.type === QueryTypes.VERSION) {
                    result = results[0].version;
                  } else if (self.options.type === QueryTypes.RAW) {
                    result = [results, metaData];
                  }

                  resolve(result);
                }
              });
            }));
          }
        };

        if ((self.getDatabaseMethod() === 'all')) {
          var tableNames = [];
          if (self.options && self.options.tableNames) {
            tableNames = self.options.tableNames;
          } else if (/FROM `(.*?)`/i.exec(self.sql)) {
            tableNames.push(/FROM `(.*?)`/i.exec(self.sql)[1]);
          }

          if (!tableNames.length) {
            return executeSql();
          } else {
            return Utils.Promise.map(tableNames, function(tableName) {
              if (tableName !== 'sqlite_master') {
                return new Utils.Promise(function(resolve) {
                  // get the column types
                  self.database.all('PRAGMA table_info(`' + tableName + '`)', function(err, results) {
                    if (!err) {
                      for (var i = 0, l = results.length; i < l; i++) {
                        columnTypes[tableName + '.' + results[i].name] = columnTypes[results[i].name] = results[i].type;
                      }
                    }
                    resolve();
                  });
                });
              }
            }).then(executeSql);
          }
        } else {
          return executeSql();
        }
      });
    });

    return promise;
  };

  Query.prototype.formatError = function (err) {
    var match;

    switch (err.code) {
      case 'SQLITE_CONSTRAINT':
        match = err.message.match(/FOREIGN KEY constraint failed/);
        if (match !== null) {
          return new sequelizeErrors.ForeignKeyConstraintError({
            parent :err
          });
        }

        var fields = [];

        // Sqlite pre 2.2 behavior - Error: SQLITE_CONSTRAINT: columns x, y are not unique
        match = err.message.match(/columns (.*?) are/);
        if (match !== null && match.length >= 2) {
          fields = match[1].split(', ');
        } else {

          // Sqlite post 2.2 behavior - Error: SQLITE_CONSTRAINT: UNIQUE constraint failed: table.x, table.y
          match = err.message.match(/UNIQUE constraint failed: (.*)/);
          if (match !== null && match.length >= 2) {
            fields = match[1].split(', ').map(function (columnWithTable) {
              return columnWithTable.split('.')[1];
            });
          }
        }

        var errors = []
          , self = this
          , message = 'Validation error';

        fields.forEach(function(field) {
          errors.push(new sequelizeErrors.ValidationErrorItem(
            field + ' must be unique', 'unique violation', field, self.instance && self.instance[field]));
        });

        if (this.model) {
          Utils._.forOwn(this.model.uniqueKeys, function(constraint) {
            if (Utils._.isEqual(constraint.fields, fields) && !!constraint.msg) {
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

      case 'SQLITE_BUSY':
        return new sequelizeErrors.TimeoutError(err);

      default:
        return new sequelizeErrors.DatabaseError(err);
    }
  };

  Query.prototype.handleShowIndexesQuery = function (data) {
    var self = this;

    // Sqlite returns indexes so the one that was defined last is returned first. Lets reverse that!
    return this.sequelize.Promise.map(data.reverse(), function (item) {
      item.fields = [];
      item.primary = false;
      item.unique = !!item.unique;

      return self.run('PRAGMA INDEX_INFO(`' + item.name + '`)').then(function (columns) {
        columns.forEach(function (column) {
          item.fields[column.seqno] = {
            attribute: column.name,
            length: undefined,
            order: undefined,
          };
        });

        return item;
      });
    });
  };

  Query.prototype.getDatabaseMethod = function() {
    if (this.isUpsertQuery()) {
      return 'exec'; // Needed to run multiple queries in one
    } else if (this.isInsertQuery() || this.isUpdateQuery() || (this.sql.toLowerCase().indexOf('CREATE TEMPORARY TABLE'.toLowerCase()) !== -1) || this.options.type === QueryTypes.BULKDELETE) {
      return 'run';
    } else {
      return 'all';
    }
  };

  return Query;
})();
