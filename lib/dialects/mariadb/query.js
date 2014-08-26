'use strict';

var Utils = require('../../utils')
  , MysqlQuery = require('../mysql/query');

module.exports = (function() {
  var Query = function(client, sequelize, callee, options) {
    this.client = client;
    this.callee = callee;
    this.sequelize = sequelize;
    this.options = Utils._.extend({
      logging: console.log,
      plain: false,
      raw: false
    }, options || {});

    var self = this;
    this.checkLoggingOption();
    this.promise = new Utils.Promise(function(resolve, reject) {
      self.resolve = resolve;
      self.reject = reject;
    });
  };

  Utils.inherit(Query, MysqlQuery);
  Query.prototype.run = function(sql) {
    this.sql = sql;

    if (this.options.logging !== false) {
      this.sequelize.log('Executing (' + this.client.uuid + '): ' + this.sql);
    }

    var resultSet = [],
        errorDetected = false,
        alreadyEnded = false, // This is needed because CALL queries emit 'end' twice...
        self = this;

    this.client.query(this.sql)
      .on('result', function(results) {
        results
          .on('row', function(row, metadata) {
            var type;

            for (var prop in row) {
              if (row.hasOwnProperty(prop)) {
                if (row[prop] === null) {
                  continue;
                }

                type = metadata.types[prop];

                switch (type) {
                case 'TINYINT':
                case 'SMALLINT':
                case 'INTEGER':
                case 'MEDIUMINT':
                case 'BIGINT':
                case 'YEAR':
                  row[prop] = parseInt(row[prop], 10);
                  break;
                case 'DECIMAL':
                case 'FLOAT':
                case 'DOUBLE':
                  row[prop] = parseFloat(row[prop]);
                  break;
                case 'DATE':
                case 'TIMESTAMP':
                case 'DATETIME':
                  row[prop] = new Date(row[prop] + self.sequelize.options.timezone);
                  break;
                case 'BIT':
                case 'BLOB':
                case 'TINYBLOB':
                case 'MEDIUMBLOB':
                case 'LONGBLOB':
                  if (metadata.charsetNrs[prop] === 63) { // binary
                    row[prop] = new Buffer(row[prop]);
                  }
                  break;
                case 'TIME':
                case 'CHAR':
                case 'VARCHAR':
                case 'SET':
                case 'ENUM':
                case 'GEOMETRY':
                case 'NULL':
                  break;
                default:
                  // blank
                }
              }
            }
            resultSet.push(row);
          })
          .on('error', function(err) {
            errorDetected = true;
            self.promise.emit('sql', self.sql);
            err.sql = sql;
            self.reject(self.formatError(err));
          })
          .on('end', function(info) {
            if (alreadyEnded || errorDetected) {
              return;
            }
            alreadyEnded = true;

            self.promise.emit('sql', self.sql);
            // we need to figure out whether to send the result set
            // or info depending upon the type of query
            if (/^call/.test(self.sql.toLowerCase())) {
              self.resolve(resultSet);
            } else if (/^show/.test(self.sql.toLowerCase()) ||
                /^select/.test(self.sql.toLowerCase()) ||
              /^describe/.test(self.sql.toLowerCase())) {
              self.resolve(self.formatResults(resultSet));
            } else {
              self.resolve(self.formatResults(info));
            }
          });
      })
      .on('error', function(err) {
        if (errorDetected) {
          return;
        }
        errorDetected = true;
        self.promise.emit('sql', self.sql);
        self.reject(err);
      })
      .setMaxListeners(100);

    return this.promise;
  };

  return Query;
})();


