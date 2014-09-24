'use strict';

module.exports = (function() {
  var QueryGenerator = {
    get options(){      
      throwMethodUndefined('get options');
    },
    set options (opt) {      
      throwMethodUndefined('set options');
    },
    get dialect(){      
      throwMethodUndefined('get dialect');
    },
    set dialect(dial) {      
      throwMethodUndefined('set dialect');
    },
    get sequelize(){      
      throwMethodUndefined('get sequelize');
    },
    set sequelize(seq) {    
      throwMethodUndefined('set sequelize');
    },
    addSchema: function(param) {      
      throwMethodUndefined('addSchema');
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
      throwMethodUndefined('createTableQuery');
    },

    describeTableQuery: function(tableName, schema, schemaDelimiter) {      
      throwMethodUndefined('describeTableQuery');
    },

    /*
      Returns a query for dropping a table.
    */
    dropTableQuery: function(tableName, options) {      
      throwMethodUndefined('dropTableQuery');
    },

    /*
      Returns a rename table query.
      Parameters:
        - originalTableName: Name of the table before execution.
        - futureTableName: Name of the table after execution.
    */
    renameTableQuery: function(before, after) {           
      throwMethodUndefined('renameTableQuery');
    },

    /*
      Returns a query, which gets all available table names in the database.
    */
    /* istanbul ignore next */
    showTablesQuery: function() {
      throwMethodUndefined('showTablesQuery');
    },

    /*
      Returns a query, which adds an attribute to an existing table.
      Parameters:
        - tableName: Name of the existing table.
        - attributes: A hash with attribute-attributeOptions-pairs.
          - key: attributeName
          - value: A hash with attribute specific options:
            - type: DataType
            - defaultValue: A String with the default value
            - allowNull: Boolean
    */
    /* istanbul ignore next */
    addColumnQuery: function(tableName, attributes) {
      throwMethodUndefined('addColumnQuery');
    },

    /*
      Returns a query, which removes an attribute from an existing table.
      Parameters:
        - tableName: Name of the existing table
        - attributeName: Name of the obsolete attribute.
    */
    /* istanbul ignore next */
    removeColumnQuery: function(tableName, attributeName) {
      throwMethodUndefined('removeColumnQuery');
    },

    /*
      Returns a query, which modifies an existing attribute from a table.
      Parameters:
        - tableName: Name of the existing table.
        - attributes: A hash with attribute-attributeOptions-pairs.
          - key: attributeName
          - value: A hash with attribute specific options:
            - type: DataType
            - defaultValue: A String with the default value
            - allowNull: Boolean
    */
    /* istanbul ignore next */
    changeColumnQuery: function(tableName, attributes) {
      throwMethodUndefined('changeColumnQuery');
    },

    /*
      Returns a query, which renames an existing attribute.
      Parameters:
        - tableName: Name of an existing table.
        - attrNameBefore: The name of the attribute, which shall be renamed.
        - attrNameAfter: The name of the attribute, after renaming.
    */
    /* istanbul ignore next */
    renameColumnQuery: function(tableName, attrNameBefore, attrNameAfter) {
      throwMethodUndefined('renameColumnQuery');
    },

    /*
      Returns an insert into command. Parameters: table name + hash of attribute-value-pairs.
    */
    insertQuery: function(table, valueHash, modelAttributes, options) {
      throwMethodUndefined('insertQuery');
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
      throwMethodUndefined('updateQuery');
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
      throwMethodUndefined('nameIndexes');
    },

    /*
      Returns an add index query.
      Parameters:
        - tableName -> Name of an existing table, possibly with schema.
        - attributes:
            An array of attributes as string or as hash.
            If the attribute is a hash, it must have the following content:
              - attribute: The name of the attribute/column
              - length: An integer. Optional
              - order: 'ASC' or 'DESC'. Optional
        - options:
          - indicesType: UNIQUE|FULLTEXT|SPATIAL
          - indexName: The name of the index. Default is <tableName>_<attrName1>_<attrName2>
          - parser
        - rawTablename, the name of the table, without schema. Used to create the name of the index
    */
    addIndexQuery: function(tableName, attributes, options, rawTablename) {      
      throwMethodUndefined('addIndexQuery');
    },

    /*
      Returns an show index query.
      Parameters:
        - tableName: Name of an existing table.
        - options:
          - database: Name of the database.
    */
    /* istanbul ignore next */
    showIndexQuery: function(tableName, options) {
      throwMethodUndefined('showIndexQuery');
    },

    /*
      Returns a remove index query.
      Parameters:
        - tableName: Name of an existing table.
        - indexNameOrAttributes: The name of the index as string or an array of attribute names.
    */
    /* istanbul ignore next */
    removeIndexQuery: function(tableName, indexNameOrAttributes) {
      throwMethodUndefined('removeIndexQuery');
    },

    /*
      This method transforms an array of attribute hashes into equivalent
      sql attribute definition.
    */
    /* istanbul ignore next */
    attributesToSQL: function(attributes) {
      throwMethodUndefined('attributesToSQL');
    },

    /*
      Returns all auto increment fields of a factory.
    */
    /* istanbul ignore next */
    findAutoIncrementField: function(factory) {
      throwMethodUndefined('findAutoIncrementField');
    },


    quoteTable: function(param, as) {      
      throwMethodUndefined('quoteTable');
    },

    /*
      Quote an object based on its type. This is a more general version of quoteIdentifiers
      Strings: should proxy to quoteIdentifiers
      Arrays:
        * Expects array in the form: [<model> (optional), <model> (optional),... String, String (optional)]
          Each <model> can be a model or an object {model: Model, as: String}, matching include
        * Zero or more models can be included in the array and are used to trace a path through the tree of
          included nested associations. This produces the correct table name for the ORDER BY/GROUP BY SQL
          and quotes it.
        * If a single string is appended to end of array, it is quoted.
          If two strings appended, the 1st string is quoted, the 2nd string unquoted.
      Objects:
        * If raw is set, that value should be returned verbatim, without quoting
        * If fn is set, the string should start with the value of fn, starting paren, followed by
          the values of cols (which is assumed to be an array), quoted and joined with ', ',
          unless they are themselves objects
        * If direction is set, should be prepended

      Currently this function is only used for ordering / grouping columns and Sequelize.col(), but it could
      potentially also be used for other places where we want to be able to call SQL functions (e.g. as default values)
    */
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
    /* istanbul ignore next */
    getForeignKeysQuery: function(tableName, schemaName) {
      throwMethodUndefined('getForeignKeysQuery');
    },

    /**
     * Generates an SQL query that removes a foreign key from a table.
     *
     * @param  {String} tableName  The name of the table.
     * @param  {String} foreignKey The name of the foreign key constraint.
     * @return {String}            The generated sql query.
     */
    /* istanbul ignore next */
    dropForeignKeyQuery: function(tableName, foreignKey) {
      throwMethodUndefined('dropForeignKeyQuery');
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
      throwMethodUndefined('selectQuery');
    },

    /**
     * Returns a query that starts a transaction.
     *
     * @param  {Boolean} value A boolean that states whether autocommit shall be done or not.
     * @return {String}        The generated sql query.
     */
    setAutocommitQuery: function(value) {
      throwMethodUndefined('setAutocommitQuery');
    },

    /**
     * Returns a query that sets the transaction isolation level.
     *
     * @param  {String} value   The isolation level.
     * @param  {Object} options An object with options.
     * @return {String}         The generated sql query.
     */
    setIsolationLevelQuery: function(value, options) {
      throwMethodUndefined('setIsolationLevelQuery');
    },

    /**
     * Returns a query that starts a transaction.
     *
     * @param  {Transaction} transaction
     * @param  {Object} options An object with options.
     * @return {String}         The generated sql query.
     */
    startTransactionQuery: function(transaction, options) {
      throwMethodUndefined('startTransactionQuery');
    },

    /**
     * Returns a query that commits a transaction.
     *
     * @param  {Object} options An object with options.
     * @return {String}         The generated sql query.
     */
    commitTransactionQuery: function(options) {
      throwMethodUndefined('commitTransactionQuery');
    },

    /**
     * Returns a query that rollbacks a transaction.
     *
     * @param  {Transaction} transaction
     * @param  {Object} options An object with options.
     * @return {String}         The generated sql query.
     */
    rollbackTransactionQuery: function(transaction, options) {
      throwMethodUndefined('rollbackTransactionQuery');
    },

    addLimitAndOffset: function(options, query) {
      throwMethodUndefined('addLimitAndOffset');
    },

    /*
      Takes something and transforms it into values of a where condition.
    */
    getWhereConditions: function(smth, tableName, factory, options, prepend) {      
      throwMethodUndefined('getWhereConditions');
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

