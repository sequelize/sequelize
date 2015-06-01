'use strict';

var Utils = require('../../utils')
  , AbstractQuery = require('../abstract/query')
  , uuid = require('node-uuid')
  , sequelizeErrors = require('../../errors.js')
  ;

module.exports = (function() {
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
    // this.sql = sql;
    if(sql.match(/^(SELECT|INSERT|DELETE)/)){
      this.sql = sql.replace(/; *$/,'');
    }else{
      this.sql = sql;
    }

    this.sequelize.log('Executing (' + (this.connection.uuid || 'default') + '): ' + this.sql, this.options);

    var promise = new Utils.Promise(function(resolve, reject) {

      if( self.sql==='START TRANSACTION;' 
        || self.sql==='SET SESSION TRANSACTION ISOLATION LEVEL REPEATABLE READ;'
      ){
        self.connection.autoCommit=false;
        resolve();
        return;
      }else if( self.sql==='SET autocommit = 1;'){
        // self.connection.autoCommit=true;
        resolve();
        return;
      }else if( self.sql==='COMMIT;'){
        self.connection.commit(function(err, results, fields) {
          if (err) {
            reject(err);
          } else {
            resolve();
          }
        });
        return;
      }else if( self.sql==='ROLLBACK;'){
        self.connection.rollback(function(err, results, fields) {
          if (err) {
            reject(err);
          } else {
            resolve();
          }
        });
        return;
      }else{
        if(self.connection.autoCommit !==  false ){
          self.connection.autoCommit=true;
        } 
        
        self.options.bind = self.options.bind || [];

        self.connection.execute(self.sql, self.options.bind, { autoCommit : self.connection.autoCommit }, function(err, results, fields) {
          if (err) {
            console.log(self.sql);
            console.error(err.message);
            err.sql = self.sql;

            reject(self.formatError(err));
          } else {
            resolve(self.formatResults(results));
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
    var result = this.instance;

    if (data && typeof data.rows === 'object' && typeof data.metaData === 'object' ) {
      var rows=[];
      data.rows.forEach(function(_result) {
        var obj={};
        data.metaData.forEach(function(col,i) {
          obj[col.name]=_result[i];
          
        });
        rows.push(obj);
      });

      
      data={
        metaData: data.metaData,
        outBinds: data.outBinds,
        rows: rows,
        rowsAffected: data.rowsAffected
      };
    }

    if (this.isInsertQuery(data)) {
      this.handleInsertQuery(data);

      if (!this.instance && data && data.outBinds && data.outBinds[this.getInsertIdField()] && data.outBinds[this.getInsertIdField()][0]) {
        result = data.outBinds[this.getInsertIdField()][0];
      }
    }

    if (this.isSelectQuery()) {
      result = this.handleSelectQuery(data.rows);
      
    } else if (this.isShowTablesQuery()) {
       result = this.handleShowTablesQuery(data.rows);
    // } else if (this.isDescribeQuery()) {
    //   result = {};

    //   data.forEach(function(_result) {
    //     result[_result.Field] = {
    //       type: _result.Type.toUpperCase(),
    //       allowNull: (_result.Null === 'YES'),
    //       defaultValue: _result.Default
    //     };
    //   });
    // } else if (this.isShowIndexesQuery()) {
    //   result = this.handleShowIndexesQuery(data);

    // } else if (this.isCallQuery()) {
    //   result = data[0];
    // } else if (this.isBulkUpdateQuery() || this.isBulkDeleteQuery() || this.isUpsertQuery()) {
    //   result = data.affectedRows;
    } else if (this.isVersionQuery()) {
       data.rows.forEach(function(e){
         if(e.PRODUCT.indexOf('Database')>=0){
           result='PRODUCT=' + e.PRODUCT + ', VERSION=' + e.VERSION + ', STATUS='+e.STATUS;
         }
       });
    // } else if (this.isForeignKeysQuery()) {
    //   result = data;
    } else if (this.isRawQuery()) {
      // MySQL returns row data and metadata (affected rows etc) in a single object - let's standarize it, sorta
      result = [data.rows, data];
    }

    return result;
  };


  Query.prototype.formatError = function (err) {

    // 00942
    return new sequelizeErrors.DatabaseError(err);
  };

  AbstractQuery.prototype.handleInsertQuery = function(results, metaData) {
    if (this.instance) {
      // add the inserted row id to the instance
      var autoIncrementField = this.model.autoIncrementField
        , id = null;
      
      if (results && results.outBinds && results.outBinds[this.getInsertIdField()] && results.outBinds[this.getInsertIdField()][0]) {
        id = results.outBinds[this.getInsertIdField()][0];
      }

      this.instance[autoIncrementField] = id;
    }
  };

  Query.prototype.getInsertIdField = function() {
    return 'rid';
  };

  return Query;
})();
