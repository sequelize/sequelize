module.exports = (function() {
  var QueryGenerator = {
    /*
      Returns a query for creating a table.
      Attributes should have the format: {attributeName: type, attr2: type2} --> {title: 'VARCHAR(255)'}
    */
    createTableQuery: function(tableName, attributes, options) {
      throw new Error('Define the method createTableQuery!')
    },

    /*
      Returns a query for dropping a table.
    */
    dropTableQuery: function(tableName, options) {
      throw new Error('Define the method dropTableQuery!')
    },

    /*
      Returns a rename table query.
      Parameters:
        - originalTableName: Name of the table before execution.
        - futureTableName: Name of the table after execution.
    */
    renameTableQuery: function(originalTableName, futureTableName) {
      throw new Error('Define the method renameQuery!')
    },

    /*
      Returns a query, which adds an attribute to an existing table.
      Parameters:
        - tableName: Name of the existing table.
        - attributeName: Name of the new attribute.
        - options: A hash with attribute specific options:
          - type: DataType
          - defaultValue: A String with the default value
          - allowNull: Boolean
    */
    addColumnQuery: function(tableName, attributeName, options) {
      throw new Error('Define the method addColumnQuery!')
    },

    /*
      Returns a query, which removes an attribute from an existing table.
      Parameters:
        - tableName: Name of the existing table
        - attributeName: Name of the obsolete attribute.
    */
    removeColumnQuery: function(tableName, attributeName) {
      throw new Error('Define the method removeColumnQuery!')
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
      throw new Error('Define the method selectQuery!')
    },

    /*
      Returns an insert into command. Parameters: table name + hash of attribute-value-pairs.
    */
    insertQuery: function(tableName, attrValueHash) {
      throw new Error('Define the method insertQuery!')
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
      throw new Error('Define the method updateQuery!')
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
      throw new Error('Define the method deleteQuery!')
    },

    /*
      Takes something and transforms it into values of a where condition.
    */
    getWhereConditions: function(smth) {
      throw new Error('Define the method getWhereConditions!')
    },

    /*
      Takes a hash and transforms it into a mysql where condition: {key: value, key2: value2} ==> key=value AND key2=value2
      The values are transformed by the relevant datatype.
    */
    hashToWhereConditions: function(hash) {
      throw new Error('Define the method hashToWhereConditions!')
    }
  }

  return QueryGenerator
})()

