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
      return 'SELECT * FROM sys.Tables';
    },

    dropTableQuery: function(tableName, options) {
      options = options || {};

      var query = "IF OBJECT_ID('dbo.<%= tableName %>', 'U') IS NOT NULL DROP TABLE dbo.<%= tableName %>";

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
    }
  };

  return Utils._.extend(Utils._.clone(require('../mysql/query-generator')), QueryGenerator);
})();
