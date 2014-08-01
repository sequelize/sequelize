'use strict';

var Utils = require('../../utils');

module.exports = (function() {
  var QueryGenerator = {
    dialect: 'mssql',

    showTablesQuery: function () {
      return 'SELECT * FROM sys.Tables';
    },

    dropTableQuery: function(tableName, options) {
      options = options || {};

      var query = "IF OBJECT_ID('dbo.<%= tableName %>', 'U') IS NOT NULL DROP TABLE dbo.<%= tableName %>";

      return Utils._.template(query)({
        tableName: tableName
      });
    }
  };

  return Utils._.extend(Utils._.clone(require('../mysql/query-generator')), QueryGenerator);
})();
