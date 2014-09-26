'use strict';

var Utils = require('../../utils')
  , DataTypes = require('./data-types')
  , SqlGenerator = require('./sql-generator')  
  , Model = require('../../model')  
  , _ = require('lodash')
  , util = require('util');



module.exports = (function() {
  var QueryGenerator = {
    get options(){
      return SqlGenerator.options;
    },
    set options (opt) {
      SqlGenerator.options = opt;
    },
    get dialect(){
      return SqlGenerator.dialect;
    },
    set dialect(dial) {
      SqlGenerator.dialect = dial;
    },
    get sequelize(){
      return SqlGenerator.sequelize;
    },
    set sequelize(seq) {    
      SqlGenerator.sequelize = seq;
    },

    addSchema: function(param) {
      var self = this
        , schema = (param.options && param.options.schema ? param.options.schema : undefined)
        , schemaDelimiter = (param.options && param.options.schemaDelimiter ? param.options.schemaDelimiter : undefined);

      if (!schema) return param.tableName || param;

      return {
        tableName: param.tableName || param,
        table: param.tableName || param,
        name: param.name || param,
        schema: schema,
        delimiter: schemaDelimiter || '.',
        toString: function() {
          return self.quoteTable(this);
        }
      };
    },

    /*
      Returns a query for creating a table.
      Parameters:
        - tableName: Name of the new table.
        - attributes: An object with containing attribute-attributeType-pairs.
                      Attributes should have the format:
                      {attributeName: type, attr2: type2}
                      --> e.g. {title: 'VARCHAR(255)'}
        - options: An object with options.
                   Defaults: { engine: 'InnoDB', charset: null }
    */
    /* istanbul ignore next */
    createTableQuery: function(tableName, attributes, options) {
      return SqlGenerator.getCreateTableSql(tableName, attributes, options);
    },
    

    renameTableQuery: function(before, after) {           
      throwMethodUndefined('renameTableQuery');
    },

    showTablesQuery: function () {
      return SqlGenerator.showTableSql();
    },

    /*
      Returns a rename table query.
      Parameters:
        - originalTableName: Name of the table before execution.
        - futureTableName: Name of the table after execution.
    */

    dropTableQuery: function(tableName, options) {
      return SqlGenerator.dropTableSql(tableName,options);
    },

    addColumnQuery: function(tableName, key, dataType) {
      var query = [
        SqlGenerator.alterTableSql(tableName),
        SqlGenerator.addColumnSql(key, dataType)
      ].join(' ') + ';';

      return query;
    },

    removeColumnQuery: function(tableName, attributeName) {
      var query = [
        SqlGenerator.alterTableSql(tableName),
        SqlGenerator.dropSql(attributeName)
      ].join(' ') + ';';
      return query;
    },

    changeColumnQuery: function(tableName, attributes) {
      var query = [
        SqlGenerator.alterTableSql(tableName),
        SqlGenerator.alterColumnSql(),
        SqlGenerator.alterAttributesSql(attributes)
      ].join(' ') + ';';

      return query;
    },

    renameColumnQuery: function(tableName, attrBefore, attributes) {
      var newColumnName;
      for (var attrName in attributes) {
        newColumnName = attrName;
      } 
      var query = [
        SqlGenerator.renameColumnSql(tableName, attrBefore, newColumnName),
        this.changeColumnQuery(tableName, attributes)
      ].join(' ');
      return query;
    },

    /*
      Returns an insert into command. Parameters: table name + hash of attribute-value-pairs.
    */
    insertQuery: function(table, valueHash, modelAttributes, options) {
      var modelAttributeMap = {};
      if (modelAttributes) {
        Utils._.each(modelAttributes, function(attribute, key) {
          modelAttributeMap[key] = attribute;
          if (attribute.field) {
            modelAttributeMap[attribute.field] = attribute;
          }
        });
      }
      return SqlGenerator.insertSql(table,valueHash,modelAttributeMap);
    },

    /*
      Returns an insert into command for multiple values.
      Parameters: table name + list of hashes of attribute-value-pairs.
    */
    /* istanbul ignore next */
    bulkInsertQuery: function(tableName, attrValueHashes) {
      throwMethodUndefined('bulkInsertQuery');
    },

    /*
      Returns an update query.
      Parameters:
        - tableName -> Name of the table
        - values -> A hash with attribute-value-pairs
        - where -> A hash with conditions (e.g. {name: 'foo'})
                   OR an ID as integer
                   OR a string with conditions (e.g. 'name="foo"').
                   If you use a string, you have to escape it on your own.
    */
    updateQuery: function(tableName, attrValueHash, where, options, attributes) {
      // if(where){
      //   throw new Error();
      // }
      console.log('here', where);
      var query = [
        SqlGenerator.updateSql(tableName, attrValueHash, attributes),
        this.getWhereConditions(where)
      ].join(' ') + ';';
      console.log(query);
      return query;
    },
    /*
      Returns a deletion query.
      Parameters:
        - tableName -> Name of the table
        - where -> A hash with conditions (e.g. {name: 'foo'})
                   OR an ID as integer
                   OR a string with conditions (e.g. 'name="foo"').
                   If you use a string, you have to escape it on your own.
      Options:
        - limit -> Maximaum count of lines to delete
        - truncate -> boolean - whether to use an 'optimized' mechanism (i.e. TRUNCATE) if available,
                                note that this should not be the default behaviour because TRUNCATE does not
                                always play nicely (e.g. InnoDB tables with FK constraints)
                                (@see http://dev.mysql.com/doc/refman/5.6/en/truncate-table.html).
                                Note that truncate must ignore limit and where
    */
    /* istanbul ignore next */
    deleteQuery: function(tableName, where, options) {
      throwMethodUndefined('deleteQuery');
    },

    /*
      Returns an update query.
      Parameters:
        - tableName -> Name of the table
        - values -> A hash with attribute-value-pairs
        - where -> A hash with conditions (e.g. {name: 'foo'})
                   OR an ID as integer
                   OR a string with conditions (e.g. 'name="foo"').
                   If you use a string, you have to escape it on your own.
    */
    incrementQuery: function(tableName, attrValueHash, where, options) {                 
      throwMethodUndefined('incrementQuery');
    },

    nameIndexes: function (indexes, rawTablename) {      
      return Utils._.map(indexes, function (index) {
        if (!index.hasOwnProperty('name')) {
          var onlyAttributeNames = index.fields.map(function(attribute) {
            return (typeof attribute === 'string') ? attribute : attribute.attribute;
          }.bind(this));

          index.name = Utils.inflection.underscore(rawTablename + '_' + onlyAttributeNames.join('_'));
        }

        return index;
      });
    },

    addIndexQuery: function(tableName, attributes, options, rawTablename) {
      return SqlGenerator.addIndexSql(tableName, attributes, options, rawTablename);
    },

    showIndexQuery: function(tableName, options) {
      return SqlGenerator.showIndexSql(tableName, options);
    },

    removeIndexQuery: function(tableName, indexNameOrAttributes) {
      return SqlGenerator.removeIndexSql(tableName, indexNameOrAttributes);
    },

    attributesToSQL: function(attributes, options) {
      var result = {}
        , key
        , attribute;

      for (key in attributes) {
        attribute = attributes[key];
        if(key && !attribute.field)
          attribute.field = key;
        result[attribute.field || key] = SqlGenerator.attributeToSQL(attribute, options);
      }

      return result;
    },

    /*
      Returns all auto increment fields of a factory.
    */
    /* istanbul ignore next */
    findAutoIncrementField: function(factory) {
      var fields = [];
      for (var name in factory.attributes) {
        if (factory.attributes.hasOwnProperty(name)) {
          var definition = factory.attributes[name];

          if (definition && definition.autoIncrement) {
            fields.push(name);
          }
        }
      }
      return fields;
    },
    quoteTable: function(param, as) {      
      throwMethodUndefined('quoteTable');
    },

    quote: function(obj, parent, force) {
      throwMethodUndefined('quote');
    },


    /*
     Create a trigger
     */
    /* istanbul ignore next */
    createTrigger: function(tableName, triggerName, timingType, fireOnArray, functionName, functionParams,
        optionsArray) {
      throwMethodUndefined('createTrigger');
    },

    /*
     Drop a trigger
     */
    /* istanbul ignore next */
    dropTrigger: function(tableName, triggerName) {
      throwMethodUndefined('dropTrigger');
    },

    /*
     Rename a trigger
    */
    /* istanbul ignore next */
    renameTrigger: function(tableName, oldTriggerName, newTriggerName) {
      throwMethodUndefined('renameTrigger');
    },

    /*
     Create a function
     */
    /* istanbul ignore next */
    createFunction: function(functionName, params, returnType, language, body, options) {
      throwMethodUndefined('createFunction');
    },

    describeTableQuery: function(tableName, schema, schemaDelimiter) {
      return SqlGenerator.describeTableSql(tableName, schema, schemaDelimiter);
    },    


    /*
     Drop a function
     */
    /* istanbul ignore next */
    dropFunction: function(functionName, params) {
      throwMethodUndefined('dropFunction');
    },

    /*
     Rename a function
     */
    /* istanbul ignore next */
    renameFunction: function(oldFunctionName, params, newFunctionName) {
      throwMethodUndefined('renameFunction');
    },

    /*
      Escape an identifier (e.g. a table or attribute name)
    */
    /* istanbul ignore next */
    quoteIdentifier: function(identifier, force) {
      throwMethodUndefined('quoteIdentifier');
    },

    /*
      Split an identifier into .-separated tokens and quote each part
    */
    quoteIdentifiers: function(identifiers, force) {
      throwMethodUndefined('quoteIdentifiers');
    },

    /*
      Escape a value (e.g. a string, number or date)
    */
    escape: function(value, field) {
      
      throwMethodUndefined('escape');
    },

    /**
     * Generates an SQL query that returns all foreign keys of a table.
     *
     * @param  {String} tableName  The name of the table.
     * @param  {String} schemaName The name of the schema.
     * @return {String}            The generated sql query.
     */
    getForeignKeysQuery: function(tableName, schemaName) {
      return SqlGenerator.getForeignKeysSql(tableName);
    },
    /**
     * Generates an SQL query that removes a foreign key from a table.
     *
     * @param  {String} tableName  The name of the table.
     * @param  {String} foreignKey The name of the foreign key constraint.
     * @return {String}            The generated sql query.
     */
    dropForeignKeyQuery: function(tableName, foreignKey) {
      return [
        SqlGenerator.alterTableSql(tableName),
        SqlGenerator.dropSql(foreignKey)
      ].join(' ') + ';';
    },
      /*
      Returns a query for selecting elements in the table <tableName>.
      Options:
        - attributes -> An array of attributes (e.g. ['name', 'birthday']). Default: *
        - where -> A hash with conditions (e.g. {name: 'foo'})
                   OR an ID as integer
                   OR a string with conditions (e.g. 'name="foo"').
                   If you use a string, you have to escape it on your own.
        - order -> e.g. 'id DESC'
        - group
        - limit -> The maximum count you want to get.
        - offset -> An offset value to start from. Only useable with limit!
    */

    selectQuery: function(tableName, options, model) {
      // Enter and change at your own peril -- Mick Hansen
      //console.log('tablename', tableName);
      //console.log('options', options);
      //console.log('model', model.name);
      //console.log(options.where);
      options = options || {};
      var query = [
        SqlGenerator.getSelectorClause(model,options),
        SqlGenerator.getFromClause(model.tableName, model.name)
      ];

      if(options.include){
        for(var i = 0; i < options.include.length; i ++){
          query.push(SqlGenerator.getJoinClause(model, options.include[i]));
        }
      }
      if(options.hasOwnProperty('where')){
        query.push(this.getWhereConditions(options.where, model.name, model, options));     
      }
      //console.log(query.join(' ') + ';');
      return query.join(' ') + ';';
    },    
    /**
     * Returns a query that starts a transaction.
     *
     * @param  {Boolean} value A boolean that states whether autocommit shall be done or not.
     * @return {String}        The generated sql query.
     */
    setAutocommitQuery: function(value) {
      return '';
      //return 'SET autocommit = ' + (!!value ? 1 : 0) + ';';
    },
    /**
     * Returns a query that sets the transaction isolation level.
     *
     * @param  {String} value   The isolation level.
     * @param  {Object} options An object with options.
     * @return {String}         The generated sql query.
     */
    setIsolationLevelQuery: function(value, options) {
      if (options.parent) {
        return;
      }
      return '';
      //return 'SET SESSION TRANSACTION ISOLATION LEVEL ' + value + ';';
    },
    /**
     * Returns a query that starts a transaction.
     *
     * @param  {Transaction} transaction
     * @param  {Object} options An object with options.
     * @return {String}         The generated sql query.
     */
    startTransactionQuery: function(transaction, options) {
      if (options.parent) {
        return 'SAVEPOINT ' + this.quoteIdentifier(transaction.name) + ';';
      }
      return '';
      //return 'BEGIN TRY\nBEGIN TRANSACTION';
    },
        /**
     * Returns a query that commits a transaction.
     *
     * @param  {Object} options An object with options.
     * @return {String}         The generated sql query.
     */
    commitTransactionQuery: function(options) {
      if (options.parent) {
        return;
      }

      return 'COMMIT;';
    },

    /**
     * Returns a query that rollbacks a transaction.
     *
     * @param  {Transaction} transaction
     * @param  {Object} options An object with options.
     * @return {String}         The generated sql query.
     */
    rollbackTransactionQuery: function(transaction, options) {
      if (options.parent) {
        return 'ROLLBACK TO SAVEPOINT ' + this.quoteIdentifier(transaction.name) + ';';
      }

      return 'ROLLBACK;';
    },

    addLimitAndOffset: function(options, query) {
      query = query || '';

      if (options.offset && !options.limit) {
        query += ' LIMIT ' + options.offset + ', ' + 10000000000000;
      } else if (options.limit) {
        if (options.offset) {
          query += ' LIMIT ' + options.offset + ', ' + options.limit;
        } else {
          query += ' LIMIT ' + options.limit;
        }
      }
      return query;
    },
    /*
      Takes something and transforms it into values of a where condition.
    */
        /*
      Takes something and transforms it into values of a where condition.
    */
    getWhereConditions: function(where, tableName, model, options, prepend) {
      //console.log('where:', model);

      //console.log('logic', where);
      //console.log('options', options);

      if(where){
        return SqlGenerator.getWhereClause(where, tableName);
      }else{
        return '';
      }
    },

    prependTableNameToHash: function(tableName, hash) {
      throwMethodUndefined('prependTableNameToHash');
    },

    findAssociation: function(attribute, dao) {
      throwMethodUndefined('findAssociation');
    },

    getAssociationFilterDAO: function(filterStr, dao) {
      throwMethodUndefined('getAssociationFilterDAO');
    },

    isAssociationFilter: function(filterStr, dao, options) {
      throwMethodUndefined('isAssociationFilter');
    },

    getAssociationFilterColumn: function(filterStr, dao, options) {
      throwMethodUndefined('getAssociationFilterColumn');
    },

    getConditionalJoins: function(options, originalDao) {
      throwMethodUndefined('getConditionalJoins');
    },

    arrayValue: function(value, key, _key, factory, logicResult) {
      throwMethodUndefined('arrayValue');
    },

    /*
      Takes a hash and transforms it into a mysql where condition: {key: value, key2: value2} ==> key=value AND key2=value2
      The values are transformed by the relevant datatype.
    */
    hashToWhereConditions: function(hash, dao, options) {
      throwMethodUndefined('hashToWhereConditions');
    },

    booleanValue: function(value) {
      return value;
    }
  };

  /* istanbul ignore next */
  var throwMethodUndefined = function(methodName) {
    throw new Error('The method "' + methodName + '" is not defined! Please add it to your sql dialect.');
  };

  return QueryGenerator;
})();
