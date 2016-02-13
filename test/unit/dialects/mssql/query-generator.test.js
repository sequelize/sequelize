'use strict';

/* jshint -W110 */
var Support = require(__dirname + '/../../support')
  , expectsql = Support.expectsql
  , current = Support.sequelize
  , QueryGenerator = require('../../../../lib/dialects/mssql/query-generator');

if (current.dialect.name === 'mssql') {
  suite('[MSSQL Specific] QueryGenerator', function () {
    // Dialect would normally be set by the query interface that instantiates the query-generator, but here we specify it explicitly
    QueryGenerator._dialect = current.dialect;

    test('getDefaultConstraintQuery', function () {
      expectsql(QueryGenerator.getDefaultConstraintQuery({tableName: 'myTable', schema: 'mySchema'}, 'myColumn'), {
        mssql: "SELECT name FROM SYS.DEFAULT_CONSTRAINTS WHERE PARENT_OBJECT_ID = OBJECT_ID('[mySchema].[myTable]', 'U') AND PARENT_COLUMN_ID = (SELECT column_id FROM sys.columns WHERE NAME = ('myColumn') AND object_id = OBJECT_ID('[mySchema].[myTable]', 'U'));"
      });
    });

    test('dropConstraintQuery', function () {
      expectsql(QueryGenerator.dropConstraintQuery({tableName: 'myTable', schema: 'mySchema'}, 'myConstraint'), {
        mssql: "ALTER TABLE [mySchema].[myTable] DROP CONSTRAINT [myConstraint];"
      });
    });
  });
}
