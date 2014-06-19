'use strict';

var Utils = require('../../utils')
  , AbstractQuery = require('../abstract/query')
  , QueryTypes = require('../../query-types');

module.exports = (function() {
  var Query = function(database, sequelize, callee, options) {
    this.database = database;
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

  Query.prototype.getInsertIdField = function() {
    return 'lastID';
  };

  Query.prototype.run = function(sql) {
    var self = this
      , promise;

    this.sql = sql;

    if (this.options.logging !== false) {
      this.sequelize.log('Executing (' + this.database.uuid + '): ' + this.sql);
    }

    return new Utils.Promise(function(resolve) {
      var columnTypes = {};
      promise = this;

      self.database.serialize(function() {
        var executeSql = function() {
          if (self.sql.indexOf('-- ') === 0) {
            // the sql query starts with a comment. don't bother the server with that ...
            promise.emit('sql', self.sql, self.options.uuid);
            return resolve();
          } else {
            resolve(new Utils.Promise(function(resolve, reject) {
              self.database[getDatabaseMethod.call(self)](self.sql, function(err, results) {
                // allow clients to listen to sql to do their own logging or whatnot
                promise.emit('sql', self.sql, self.options.uuid);

                if (err) {
                  err.sql = self.sql;
                  reject(err);
                } else {
                  var metaData = this;
                  metaData.columnTypes = columnTypes;

                  var result = self.callee;

                  // add the inserted row id to the instance
                  if (self.send('isInsertQuery', results, metaData)) {
                    self.send('handleInsertQuery', results, metaData);
                  }

                  if (self.sql.indexOf('sqlite_master') !== -1) {
                    result = results.map(function(resultSet) { return resultSet.name; });
                  } else if (self.send('isSelectQuery')) {
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
                                  result[name] = new Date(val + 'Z'); // Z means UTC
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

                    result = self.send('handleSelectQuery', results);
                  } else if (self.send('isShowOrDescribeQuery')) {
                    result = results;
                  } else if (self.sql.indexOf('PRAGMA INDEX_LIST') !== -1) {
                    // this is the sqlite way of getting the indexes of a table
                    result = results.map(function(result) {
                      return {
                        name: result.name,
                        tableName: result.name.split('_')[0],
                        unique: (result.unique === 0)
                      };
                    });
                  } else if (self.sql.indexOf('PRAGMA TABLE_INFO') !== -1) {
                    // this is the sqlite way of getting the metadata of a table
                    result = {};

                    results.forEach(function(_result) {
                      result[_result.name] = {
                        type: _result.type,
                        allowNull: (_result.notnull === 0),
                        defaultValue: _result.dflt_value
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
                  } else if ([QueryTypes.BULKUPDATE, QueryTypes.BULKDELETE].indexOf(self.options.type) !== -1) {
                    result = metaData.changes;
                  }

                  resolve(result);
                }
              });
            }));
          }
        };

        if ((getDatabaseMethod.call(self) === 'all')) {
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
                  self.database.all('PRAGMA table_info(' + tableName + ')', function(err, results) {
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
  };

  //private
  var getDatabaseMethod = function() {
    if (this.send('isInsertQuery') || this.send('isUpdateQuery') || (this.sql.toLowerCase().indexOf('CREATE TEMPORARY TABLE'.toLowerCase()) !== -1) || this.options.type === QueryTypes.BULKDELETE) {
      return 'run';
    } else {
      return 'all';
    }
  };

  return Query;
})();
