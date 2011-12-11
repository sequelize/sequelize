module.exports = (function() {
  var QueryGenerator = {
    /*
      Returns a query for creating a table.
      Attributes should have the format: {attributeName: type, attr2: type2} --> {title: 'VARCHAR(255)'}
    */
    createTableQuery: function(tableName, attributes, options) {
      throwMethodUndefined.call('createTableQuery')
    },

    /*
      Returns a query for dropping a table.
    */
    dropTableQuery: function(tableName, options) {
      throwMethodUndefined.call('dropTableQuery')
    },

    /*
      Returns a rename table query.
      Parameters:
        - originalTableName: Name of the table before execution.
        - futureTableName: Name of the table after execution.
    */
    renameTableQuery: function(originalTableName, futureTableName) {
      throwMethodUndefined.call('renameTableQuery')
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
    addColumnQuery: function(tableName, attributes) {
      throwMethodUndefined.call('addColumnQuery')
    },

    /*
      Returns a query, which removes an attribute from an existing table.
      Parameters:
        - tableName: Name of the existing table
        - attributeName: Name of the obsolete attribute.
    */
    removeColumnQuery: function(tableName, attributeName) {
      throwMethodUndefined.call('removeColumnQuery')
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
    changeColumnQuery: function(tableName, attribute) {
      throwMethodUndefined.call('changeColumnQuery')
    },

    /*
      Returns a query, which renames an existing attribute.
      Parameters:
        - tableName: Name of an existing table.
        - attrNameBefore: The name of the attribute, which shall be renamed.
        - attrNameAfter: The name of the attribute, after renaming.
    */
    renameColumnQuery: function(tableName, attrNameBefore, attrNameAfter) {
      throwMethodUndefined.call('renameColumnQuery')
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
    selectQuery: function(tableName, options) {
      throwMethodUndefined.call('selectQuery')
    },

    /*
      Returns an insert into command. Parameters: table name + hash of attribute-value-pairs.
    */
    insertQuery: function(tableName, attrValueHash) {
      throwMethodUndefined.call('insertQuery')
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
    updateQuery: function(tableName, values, where) {
      throwMethodUndefined.call('updateQuery')
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
    */
    deleteQuery: function(tableName, where, options) {
      throwMethodUndefined.call('deleteQuery')
    },

    /*
      Returns an add index query.
      Parameters:
        - tableName -> Name of an existing table.
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
    */
    addIndexQuery: function(tableName, attributes, options) {
      throwMethodUndefined.call('addIndexQuery')
    },

    showIndexQuery: function(tableName, options) {
      throwMethodUndefined.call('showIndexQuery')
    },

    removeIndexQuery: function(tableName, options) {
      throwMethodUndefined.call('removeIndexQuery')
    },

    /*
      Takes something and transforms it into values of a where condition.
    */
    getWhereConditions: function(smth) {
      throwMethodUndefined.call('getWhereConditions')
    },

    /*
      Takes a hash and transforms it into a mysql where condition: {key: value, key2: value2} ==> key=value AND key2=value2
      The values are transformed by the relevant datatype.
    */
    hashToWhereConditions: function(hash) {
      throwMethodUndefined.call('hashToWhereConditions')
    }
  }

  var throwMethodUndefined = function(methodName) {
    throw new Error('The method "' + methodName + '" was not defined!')
  }

  return QueryGenerator
})()

