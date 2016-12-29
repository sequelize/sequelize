'use strict';

const Utils = require('../../utils')
  , Promise = require('../../promise')
  , AbstractQuery = require('../abstract/query')
  , sequelizeErrors = require('../../errors.js')
  , parserStore = require('../parserStore')('oracle')
  , _ = require('lodash')
  , inherits = require('../../utils/inherits');

var Query = function (connection, sequelize, options) {
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

  this.outFormat = options.outFormat || this.sequelize.connectionManager.lib.OBJECT;
};

inherits(Query, AbstractQuery);

Query.prototype.getInsertIdField = function () {
  return 'id';
};

Query.formatBindParameters = AbstractQuery.formatBindParameters;
Query.prototype._run = function (connection, sql, parameters) {
  var self = this;

  //We set the oracledb 
  var oracledb = self.sequelize.connectionManager.lib;
  //Regexp for the bind params
  var regex = new RegExp('([$][:][a-zA-Z]+)[;]([a-zA-Z]+[$])');

  //We remove the / that escapes quotes
  if (sql.match(/^(SELECT|INSERT|DELETE)/)) {
    this.sql = sql.replace(/; *$/, '');
  } else {
    this.sql = sql;
  }

  //Method to generate the object for Oracle out bindings; format -> $:name;type$
  var result = regex.exec(this.sql);
  var outParameters = {};

  while (result != null) { //if we have multiple params

    //We extract the name of the parameter to bind, removes the $: at the beginning
    var parameterName = result[1].substring(2, result[1].length);
    //We extract the type, removes the $ at the end
    var type = result[2].substring(0, result[2].length - 1);
    
    //We bind the type passed as argument to the real type
    switch (type) {
      case 'INTEGER':
      case 'NUMBER':
        outParameters[parameterName] = { dir: oracledb.BIND_OUT, type: oracledb.NUMBER };
        break;
      case 'STRING':
        outParameters[parameterName] = { dir: oracledb.BIND_OUT, type: oracledb.STRING };
        break;
      default:
        //Default, we choose String 
        outParameters[parameterName] = { dir: oracledb.BIND_OUT, type: oracledb.STRING };
        break;
    }

    //Finally we replace the param in the sql by the correct format for Oracle:  $:name;type$ -> :name
    if(this.sql.indexOf(result[0]) > -1 && this.sql.indexOf("'" + result[0] + "'") > -1) {
      //if the parameters is between quotes
      this.sql = this.sql.replace("'" + result[0] + "'", `:${parameterName}`);
    } else {
      this.sql = this.sql.replace(result[0], `:${parameterName}`);
    }

    //We exec the regexp again to see if there are other parameters  
    result = regex.exec(this.sql);
  }

  this.outParameters = outParameters;

  //do we need benchmark for this query execution
  var benchmark = this.sequelize.options.benchmark || this.options.benchmark;

  if (benchmark) {
    var queryBegin = Date.now();
  } else {
    this.sequelize.log('Executing (' + (connection.uuid || 'default') + '): ' + this.sql, this.options);
  }

  var promise = new Promise(function (resolve, reject) {
    
    // TRANSACTION SUPPORT
    if (_.includes(self.sql, 'BEGIN TRANSACTION')) {
      self.autocommit = false;
      resolve();
    } else if (_.includes(self.sql, 'SET AUTOCOMMIT ON')) {
      self.autocommit = true;
      console.log('auto commit is set on');
      resolve();
    } else if (_.includes(self.sql, 'SET AUTOCOMMIT OFF')) {
      self.autocommit = false;
      console.log('auto commit is set off');
      resolve();
    } else if (_.includes(self.sql, 'BEGIN')) {

      //Call to stored procedures
      var autoCommit = connection.uuid !== undefined ? false : true;
      return connection.execute(self.sql, outParameters, {autoCommit : autoCommit})
        .then(result => {
          if (!Array.isArray(result.outBinds)) {
            resolve([result.outBinds]);
          }
          resolve(result.outBinds);
        })
        .catch(error => {
          console.error(error.message);
          reject(self.formatError(error));
        });
    } else if (_.includes(self.sql, 'COMMIT TRANSACTION')) {
      console.log('commit transaction');
      return connection.commit()
        .then(result => {
          resolve();
        })
        .catch(err => {
          reject(self.formatError(err));
        });
    } else if (_.includes(self.sql, 'ROLLBACK TRANSACTION')) {
      console.log('rollback transaction');
      return connection.rollback()
        .then(result => {
          resolve();
        })
        .catch(err => {
          reject(self.formatError(err));
        });
    } else if (_.includes(self.sql, 'SET TRANSACTION')) {
      resolve();
    } else {
      // QUERY SUPPORT
      if(Object.keys(self.outParameters).length > 0) {
        //If we have some mapping with parameters to do - INSERT queries 
        return connection.execute(self.sql, self.outParameters, { outFormat: self.outFormat, autoCommit: self.autoCommit })
        .then(result => {
          if (benchmark) {
            self.sequelize.log('Executed (' + (connection.uuid || 'default') + '): ' + self.sql, (Date.now() - queryBegin), self.options);
          }
          //Treating the outbinds parameters

          //Specific case for insert
           if(_.includes(self.sql, 'INSERT INTO')) {

            //For returning into oracle returns : {ID : [id]}, we need : [{ID : id}]
            //Treating the outbinds parameters
            var keys = Object.keys(self.outParameters);
            var key = keys[0];

            var row = {};
            row[key] = Array.isArray(result.outBinds[key]) ? result.outBinds[key][0] : result.outBinds[key]; 
            result = [row];

          } else if (!Array.isArray(result.outBinds)) {
              result = [result.outBinds];
          }

          var formatedResult = self.formatResults(result);

          resolve(formatedResult);
          // resolve(result.outBinds);
        })
        .catch(error => {
          console.error(error.message);
          reject(self.formatError(error));
        });
      } else {
        //Normal execution
        return connection.execute(self.sql, [], { outFormat: self.outFormat, autoCommit: self.autoCommit })
        .then(result => {
          if (benchmark) {
            self.sequelize.log('Executed (' + (connection.uuid || 'default') + '): ' + self.sql, (Date.now() - queryBegin), self.options);
          }
          //const startId = metaData[query.getInsertIdField()] - metaData.changes + 1;
          let formatedResult = self.formatResults(result);

          resolve(formatedResult);
        })
        .catch(error => {
          console.dir(error);
          reject(error);
        });
      }
    }
  });

  return promise;
};

Query.prototype.run = function (sql, parameters) {
  var self = this;

  // return Promise.using(this.connection.lock(), function (connection) {
  return self._run(this.connection, sql, parameters);
  // });
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
 * Oracle format : 
 * { rows: //All rows
   [ [ 'Oracle Database 11g Enterprise Edition Release 11.2.0.1.0 - 64bit Production' ],
     [ 'PL/SQL Release 11.2.0.1.0 - Production' ],
     [ 'CORE\t11.2.0.1.0\tProduction' ],
     [ 'TNS for 64-bit Windows: Version 11.2.0.1.0 - Production' ],
     [ 'NLSRTL Version 11.2.0.1.0 - Production' ] ],
  resultSet: undefined,
  outBinds: undefined, //Used for dbms_put.line
  rowsAffected: undefined, //Number of rows affecter
  metaData: [ { name: 'BANNER' } ] }
 *
 * @param {Array} data - The result of the query execution.
 */
Query.prototype.formatResults = function (data) {
  var result = this.instance;
  if (this.isInsertQuery(data)) {
    this.handleInsertQuery(data);

    if (!this.instance) {
      if (this.options.plain) {
        // NOTE: super contrived. This just passes the newly added query-interface
        //       test returning only the PK. There isn't a way in MSSQL to identify
        //       that a given return value is the PK, and we have no schema information
        //       because there was no calling Model.
        var record = data.rows[0];
        result = record[Object.keys(record)[0]];
      } else {
        result = data.rows;
      }
    }
  }

  if (this.isShowTablesQuery()) {
    result = this.handleShowTablesQuery(data);
  } else if (this.isDescribeQuery()) {
    result = {};
    data.rows.forEach(function (_result) {
      if (_result.Default) {
        _result.Default = _result.Default.replace("('", '').replace("')", '').replace(/'/g, ''); /* jshint ignore: line */
      }

      result[_result.Name] = {
        type: _result.Type.toUpperCase(),
        allowNull: (_result.IsNull === 'YES' ? true : false),
        defaultValue: _result.Default,
        primaryKey: _result.Constraint === 'PRIMARY KEY'
      };
    });
  } else if (this.isShowIndexesQuery()) {
    result = this.handleShowIndexesQuery(data.rows);
  } else if (this.isSelectQuery()) {
    //Since Oracle returns the column name uppercase, we have to transform it to lowercase to match the model definition
    var rows = data.rows;
    var keys = [];
    if (rows.length > 0) {
      keys = Object.keys(rows[rows.length - 1]); //we get the keys
    }
    var finalRows = [];

    rows.forEach(element => {
      var newRow = {};
      keys.forEach(key => {
        newRow[key.toLowerCase()] = element[key];
      });
      finalRows.push(newRow);
    });

    data.rows = finalRows;

    result = this.handleSelectQuery(data.rows);
  } else if (this.isCallQuery()) {
    result = data.rows[0];
  } else if (this.isBulkUpdateQuery()) {
    result = data.length;
  } else if (this.isBulkDeleteQuery()) {
    result = data.rows[0] && data.rowsAffected;
  } else if (this.isVersionQuery()) {
    result = data.rows[0].BANNER;
  } else if (this.isForeignKeysQuery()) {
    result = data.rows;
  } else if (this.isRawQuery()) {
    // MSSQL returns row data and metadata (affected rows etc) in a single object - let's standarize it, sorta
    result = [data, data];
  }

  return result;
};

Query.prototype.handleShowTablesQuery = function (results) {
  return results.map(function (resultSet) {
    return {
      tableName: resultSet.TABLE_NAME,
      schema: resultSet.TABLE_SCHEMA
    };
  });
};

Query.prototype.formatError = function (err) {
  var match;
  match = err.message.match(/Violation of UNIQUE KEY constraint '((.|\s)*)'. Cannot insert duplicate key in object '.*'.(:? The duplicate key value is \((.*)\).)?/);
  match = match || err.message.match(/Cannot insert duplicate key row in object .* with unique index '(.*)'/);
  if (match && match.length > 1) {
    var fields = {}
      , message = 'Validation error'
      , uniqueKey = this.model && this.model.uniqueKeys[match[1]];

    if (uniqueKey && !!uniqueKey.msg) {
      message = uniqueKey.msg;
    }
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
    Utils._.forOwn(fields, function (value, field) {
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

Query.prototype.isShowOrDescribeQuery = function () {
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
  data = _.reduce(data, function (acc, item) {
    if (!(item.index_name in acc)) {
      acc[item.index_name] = item;
      item.fields = [];
    }

    Utils._.forEach(item.index_keys.split(','), function (column) {
      var columnName = column.trim();
      if (columnName.indexOf('(-)') !== -1) {
        columnName = columnName.replace('(-)', '');
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

  return Utils._.map(data, function (item) {
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

Query.prototype.handleInsertQuery = function (results, metaData) {
  if (this.instance) {
    // add the inserted row id to the instance
    var autoIncrementField = this.model.autoIncrementField
      , autoIncrementFieldAlias = null
      , id = null;

    if (this.model.rawAttributes.hasOwnProperty(autoIncrementField) &&
      this.model.rawAttributes[autoIncrementField].field !== undefined)
      autoIncrementFieldAlias = this.model.rawAttributes[autoIncrementField].field;

    id = id || (results && results[0][this.getInsertIdField()]);
    id = id || (metaData && metaData[this.getInsertIdField()]);
    id = id || (results && results[0][autoIncrementField]);
    id = id || (autoIncrementFieldAlias && results && results[0][autoIncrementFieldAlias]);

    this.instance[autoIncrementField] = id;
  }
};

module.exports = Query;
