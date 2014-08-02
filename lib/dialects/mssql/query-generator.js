'use strict';

var Utils = require('../../utils');

module.exports = (function() {
  var QueryGenerator = {
    dialect: 'mssql',

    quoteIdentifier: function(identifier, force) {
      if (identifier === '*') return identifier;
      return Utils.addTicks(identifier, '"');
    },

    showTablesQuery: function () {
      return 'SELECT name FROM sys.Tables';
    },

    dropTableQuery: function(tableName, options) {
      options = options || {};

      var query = "IF OBJECT_ID('dbo.<%= tableName %>', 'U') IS NOT NULL DROP TABLE dbo.\"<%= tableName %>\"";

      return Utils._.template(query)({
        tableName: tableName
      });
    },

    createTableQuery: function(tableName, attributes, options) {
      var query       = "IF OBJECT_ID('<%= unquotedTable %>', N'U') IS NULL CREATE TABLE <%= table %> (<%= attributes%>)"
        , attrStr     = []
        , self        = this
        , primaryKeys = Utils._.keys(Utils._.pick(attributes, function(dataType){
          return dataType.indexOf('PRIMARY KEY') >= 0;
        }));

      for (var attr in attributes) {
        if (attributes.hasOwnProperty(attr)) {
          var dataType = attributes[attr];
          if (primaryKeys.length > 1){
            dataType = dataType.replace(/ PRIMARY KEY/, '');
          }
          attrStr.push(self.quote(attr) + " " + dataType);
        }
      }

      if (primaryKeys.length > 1) {
        attrStr.push('PRIMARY KEY(' + primaryKeys.map(function(column){
          return self.quote(column);
        }).join(', ') + ')');
      }

      var values = {
          unquotedTable: tableName,
          table: self.quote(tableName),
          attributes: attrStr.join(", ")
        };

      return Utils._.template(query)(values).trim() + ";";
    },

    /**
     * Generates an SQL query that returns all foreign keys of a table.
     *
     * @param  {String} tableName  The name of the table.
     * @param  {String} schemaName The name of the schema.
     * @return {String}            The generated sql query.
     */
    getForeignKeysQuery: function(tableName, schemaName) {
      return [
        "SELECT",
          "K_Table = FK.TABLE_NAME, FK_Column = CU.COLUMN_NAME, PK_Table = PK.TABLE_NAME, PK_Column = PT.COLUMN_NAME, Constraint_Name = C.CONSTRAINT_NAME",
        "FROM",
          "INFORMATION_SCHEMA.REFERENTIAL_CONSTRAINTS C",
        "INNER JOIN INFORMATION_SCHEMA.TABLE_CONSTRAINTS FK ON C.CONSTRAINT_NAME = FK.CONSTRAINT_NAME",
        "INNER JOIN INFORMATION_SCHEMA.TABLE_CONSTRAINTS PK ON C.UNIQUE_CONSTRAINT_NAME = PK.CONSTRAINT_NAME",
        "INNER JOIN INFORMATION_SCHEMA.KEY_COLUMN_USAGE CU ON C.CONSTRAINT_NAME = CU.CONSTRAINT_NAME",
        "INNER JOIN (",
          "SELECT",
              "i1.TABLE_NAME,",
              "i2.COLUMN_NAME",
          "FROM",
              "INFORMATION_SCHEMA.TABLE_CONSTRAINTS i1",
          "INNER JOIN INFORMATION_SCHEMA.KEY_COLUMN_USAGE i2",
              "ON i1.CONSTRAINT_NAME = i2.CONSTRAINT_NAME",
          "WHERE",
              "i1.CONSTRAINT_TYPE = 'PRIMARY KEY'",
        ") PT ON PT.TABLE_NAME = PK.TABLE_NAME"
      ].join(" ");
    }
  };

  return Utils._.extend(Utils._.clone(require('../mysql/query-generator')), QueryGenerator);
})();
