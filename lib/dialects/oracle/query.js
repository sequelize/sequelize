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
Query.prototype._run = function(connection, sql, parameters) {
  var self = this;

  //We set the oracledb 
  var oracledb = self.sequelize.connectionManager.lib;
  //Regexp for the bind params
  var regex = new RegExp('([$][:][a-zA-Z_]+)[;]([a-zA-Z(0-9)[]+[$])');

  //We remove the / that escapes quotes
  if (sql.match(/^(SELECT|INSERT|DELETE)/)) {
    this.sql = sql.replace(/; *$/, '');
  } else {
    this.sql = sql;
  }

  //Method to generate the object for Oracle out bindings; format -> $:name;type$
  var regExResult = regex.exec(this.sql);
  var outParameters = {};

  while (regExResult != null) { //if we have multiple params

    //We extract the name of the parameter to bind, removes the $: at the beginning
    var parameterName = regExResult[1].substring(2, regExResult[1].length);
    //We extract the type, removes the $ at the end
    var type = regExResult[2].substring(0, regExResult[2].length - 1);
    
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
    if(this.sql.indexOf(regExResult[0]) > -1 && this.sql.indexOf("'" + regExResult[0] + "'") > -1) {
      //if the parameters is between quotes
      this.sql = this.sql.replace("'" + regExResult[0] + "'", `:${parameterName}`);
    } else {
      this.sql = this.sql.replace(regExResult[0], `:${parameterName}`);
    }

    //We exec the regexp again to see if there are other parameters  
    regExResult = regex.exec(this.sql);
  }

  this.outParameters = outParameters;

  //do we need benchmark for this query execution
  var benchmark = this.sequelize.options.benchmark || this.options.benchmark;

  console.log('Executing (' + (connection.uuid || 'default') + '): ' + this.sql);

  if (benchmark) {
    var queryBegin = Date.now();
  } else {
    this.sequelize.log('Executing (' + (connection.uuid || 'default') + '): ' + this.sql, this.options);
  }

    
    // TRANSACTION SUPPORT
    if (_.includes(self.sql, 'BEGIN TRANSACTION')) {
      self.autocommit = false;
      return Promise.resolve();
    } else if (_.includes(self.sql, 'SET AUTOCOMMIT ON')) {
      self.autocommit = true;
      console.log('auto commit is set on');
      return Promise.resolve();
    } else if (_.includes(self.sql, 'SET AUTOCOMMIT OFF')) {
      self.autocommit = false;
      console.log('auto commit is set off');
      return Promise.resolve();
    } else if (_.includes(self.sql, 'DECLARE x NUMBER')) {
      //Calling a stored procedure for bulkInsert with NO attributes, returns nothing
      let autoCommit = connection.uuid !== undefined ? false : true;
      return connection.execute(self.sql, outParameters, {autoCommit : autoCommit})
        .then(result => {
          return {};
        })
        .catch(error => {
          console.error(error.message);
          throw self.formatError(error);
        });
    } else if (_.includes(self.sql, 'BEGIN')) {
      //Call to stored procedures
      var autoCommit = connection.uuid !== undefined ? false : true;
      return connection.execute(self.sql, outParameters, {autoCommit : autoCommit})
        .then(result => {
          if (!Array.isArray(result.outBinds)) {
            return [result.outBinds];
          }
          return result.outBinds;
        })
        .catch(error => {
          console.error(error.message);
          throw self.formatError(error);
        });
    } else if (_.includes(self.sql, 'COMMIT TRANSACTION')) {
      console.log('commit transaction');
      return connection.commit()
        .then(() => {
          return {};
        })
        .catch(err => {
          throw self.formatError(err);
        });
    } else if (_.includes(self.sql, 'ROLLBACK TRANSACTION')) {
      console.log('rollback transaction');
      return connection.rollback()
        .then(() => {
          return {};
        })
        .catch(err => {
          throw self.formatError(err);
        });
    } else if (_.includes(self.sql, 'SET TRANSACTION')) {
      return Promise.resolve({});
    } else {
      // QUERY SUPPORT

      //As Oracle does everything in transaction, if autoCommit is not defined, we set this to true 
      if(self.autoCommit === undefined) {
        if(connection.uuid) {
          self.autoCommit = false;
        } else {
          self.autoCommit = true;
        }
      }
      if(Object.keys(self.outParameters).length > 0) {
        //If we have some mapping with parameters to do - INSERT queries 
        return connection.execute(self.sql, self.outParameters, { outFormat: self.outFormat, autoCommit: self.autoCommit })
        .then(result => {
          if (benchmark) {
            self.sequelize.log('Executed (' + (connection.uuid || 'default') + '): ' + self.sql, (Date.now() - queryBegin), self.options);
            // console.log('Executed (' + (connection.uuid || 'default') + '): ' + self.sql);
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

          return [formatedResult];
          // resolve(result.outBinds);
        })
        .catch(error => {
          console.error(error.message);
          throw self.formatError(error);
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

          if (self.sql.indexOf('UPDATE') > -1 && !Array.isArray(formatedResult)) {
            formatedResult = [formatedResult];
          }

          return formatedResult === undefined ? {} : formatedResult;
        })
        .catch(error => {
          console.dir(error);
          throw self.formatError(error);
        });
      }
    };

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
    result = this.handleShowTablesQuery(data.rows);
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
    let rows = data.rows;
    let keys = [];
    let attrs = {};
    if (rows.length > 0) {
      keys = Object.keys(rows[rows.length - 1]); //we get the keys

      //Since Oracle returns the column name uppercase, we have to transform it to match the model definition
      if(!this.model) {
        let rowKeys = Object.keys(rows[0]);
        if(rowKeys.length > 0) {
          let returnObject = {};
          rowKeys.forEach(rowKey => {
            returnObject[rowKey.toLowerCase()] = rows[0][rowKey];
          });
          return returnObject;
        }
        return rows;
      }
      let attrKeys = Object.keys(this.model.attributes);
      attrKeys.forEach(attrKey => {
        //We map the fieldName in lowerCase to the real fieldName
        let attribute = this.model.attributes[attrKey];
        //We generate an array like this : attribute(toLowerCase) : attribute(real case)
        attrs[attribute.fieldName.toLowerCase()] = attribute.fieldName;
      });
    }
    let finalRows = [];

    for(let rowsIdx = 0; rowsIdx < rows.length ; rowsIdx++) {
      let element = rows[rowsIdx];
      let newRow = {};
      for(var keysIdx = 0; keysIdx < keys.length; keysIdx++) {
        let key = keys[keysIdx];

        //Oracle returns everything in uppercase, so we have to transform this
        //As seen in development process, it only occurs for the first element, if it's foo.bar, bar will be in the good case
        if(key.indexOf('.') > -1) {
          //We have the value of an include
          if(this.options && this.options.includeMap) {
            let name = "";
            let parts = key.split('.');
            //we have some includes, we have to map the names in returned row to includeMap
            let includeKeys = Object.keys(this.options.includeMap);
            for(let i = 0 ; i <  includeKeys.length; i++) {
              if(parts[0].toUpperCase() ===  includeKeys[i].toUpperCase()) {
                parts.splice(0,1); //We remove the first part
                name = `${includeKeys[i]}.${parts.join('.')}`;
                break;
              }
            }
            //We reset the value with the "good" name
            newRow[name] = element[key];
          }
        } else {
          //We set the data with the real case
          if (attrs[key.toLowerCase()] === undefined) {
            //If we don't have a mapping name provided (from the model), we take it from sql
            let firstIdx = this.sql.toUpperCase().indexOf(key);
            let realKey = this.sql.substr(firstIdx, key.length);
            newRow[realKey] = element[key];
          } else {
            newRow[attrs[key.toLowerCase()]] = element[key];
          }
        }
      };
      finalRows.push(newRow);
    };

    data.rows = finalRows;

    result = this.handleSelectQuery(data.rows);
  } else if (this.isCallQuery()) {
    result = data.rows[0];
  } else if (this.isBulkUpdateQuery()) {
    result = data.length;
  } else if (this.isBulkDeleteQuery()) {
    result = data.rowsAffected;
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
  //ORA-00001: unique constraint (USER.XXXXXXX) violated
  match = err.message.match(/unique constraint (.*) violated/);
  if (match && match.length > 1) {
    match[1] = match[1].replace('(', '').replace(')', '').split('.')[1]; //As we get (SEQUELIZE.UNIQNAME), we replace to have UNIQNAME
    var fields = {}
      , message = 'Validation error'
      , errors = []
      , uniqueKey = null;

    let uniqueKeys = Object.keys(this.model.uniqueKeys);

    let currKey = uniqueKeys.find(key => {
      return key.toUpperCase() === match[1];
    });

    if(currKey) {
      uniqueKey = this.model.uniqueKeys[currKey];
      fields = uniqueKey.fields;
    }

    if (uniqueKey && !!uniqueKey.msg) {
      message = uniqueKey.msg;
    }

    fields.forEach(field => {
      errors.push(new sequelizeErrors.ValidationErrorItem(
      this.getUniqueConstraintErrorMessage(field), 'unique violation', field, null));
    });

    return new sequelizeErrors.UniqueConstraintError({
      message,
      errors,
      err,
      fields
    });
  }

  match = err.message.match(/ORA-02291/) ||
    err.message.match(/ORA-02292/);
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
  return this.sql.indexOf('SELECT i.index_name,i.table_name, i.column_name, u.uniqueness') > - 1;
};

Query.prototype.handleShowIndexesQuery = function (data) {
  // Group by index name, and collect all fields

  let acc = [];

  //We first treat the datas
  data.forEach(indexRecord => {
    
    //We create the object
    if (!acc[indexRecord.INDEX_NAME]) {
      acc[indexRecord.INDEX_NAME] = {
        unique : indexRecord.UNIQUENESS === 'UNIQUE' ? true : false,
        primary: (indexRecord.INDEX_NAME.toLowerCase().indexOf('pk') === 0),
        name: indexRecord.INDEX_NAME.toLowerCase(),
        tableName: indexRecord.TABLE_NAME.toLowerCase(),
        type: undefined
      };
      acc[indexRecord.INDEX_NAME]['fields'] = [];
    }

    //We create the fields
    acc[indexRecord.INDEX_NAME].fields.push({
      attribute: indexRecord.COLUMN_NAME,
      length: undefined,
      order: indexRecord.DESCEND,
      collate: undefined
    });

  });
  let returnIndexes = [];


  let accKeys = Object.keys(acc);
  accKeys.forEach(accKey => {
    returnIndexes.push(acc[accKey]);
  });

  return returnIndexes;
};

Query.prototype.handleInsertQuery = function (results, metaData) {
  if (this.instance && results.length > 0) {
    //The PK of the table is a reserved word, we have to change the name in the result for the model to find the value correctly
    if('pkReturnVal' in results[0]) {
      results[0][this.model.primaryKeyAttribute] = results[0]['pkReturnVal'];
      delete results[0]['pkReturnVal'];
    }
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
