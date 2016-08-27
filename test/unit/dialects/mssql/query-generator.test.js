'use strict';

/* jshint -W110 */
let Support = require(__dirname + '/../../support')
  , expectsql = Support.expectsql
  , current = Support.sequelize
  , QueryGenerator = require('../../../../lib/dialects/mssql/query-generator')
  , _ = require('lodash');

if (current.dialect.name === 'mssql') {
  suite('[MSSQL Specific] QueryGenerator', function() {
    // Dialect would normally be set by the query interface that instantiates the query-generator, but here we specify it explicitly
    QueryGenerator._dialect = current.dialect;

    test('getDefaultConstraintQuery', function() {
      expectsql(QueryGenerator.getDefaultConstraintQuery({tableName: 'myTable', schema: 'mySchema'}, 'myColumn'), {
        mssql: "SELECT name FROM SYS.DEFAULT_CONSTRAINTS WHERE PARENT_OBJECT_ID = OBJECT_ID('[mySchema].[myTable]', 'U') AND PARENT_COLUMN_ID = (SELECT column_id FROM sys.columns WHERE NAME = ('myColumn') AND object_id = OBJECT_ID('[mySchema].[myTable]', 'U'));"
      });
    });

    test('dropConstraintQuery', function() {
      expectsql(QueryGenerator.dropConstraintQuery({tableName: 'myTable', schema: 'mySchema'}, 'myConstraint'), {
        mssql: 'ALTER TABLE [mySchema].[myTable] DROP CONSTRAINT [myConstraint];'
      });
    });

    test('selectFromTableFragment', function() {
      const modifiedGen = _.clone(QueryGenerator);
      // Test newer versions first
      // Should be all the same since handling is done in addLimitAndOffset
      // for SQL Server 2012 and higher (>= v11.0.0)
      modifiedGen.sequelize = {
        options: {
          databaseVersion: '11.0.0'
        }
      };

      // Base case
      expectsql(modifiedGen.selectFromTableFragment({}, { primaryKeyField: 'id' }, ['id', 'name'], 'myTable', 'myOtherName', 'WHERE id=1'), {
        mssql: 'SELECT id, name FROM myTable AS myOtherName'
      });

      // With limit
      expectsql(modifiedGen.selectFromTableFragment({ limit: 10 }, { primaryKeyField: 'id' }, ['id', 'name'], 'myTable', 'myOtherName'), {
        mssql: 'SELECT id, name FROM myTable AS myOtherName'
      });

      // With offset
      expectsql(modifiedGen.selectFromTableFragment({ offset: 10 }, { primaryKeyField: 'id' }, ['id', 'name'], 'myTable', 'myOtherName'), {
        mssql: 'SELECT id, name FROM myTable AS myOtherName'
      });

      // With both limit and offset
      expectsql(modifiedGen.selectFromTableFragment({ limit: 10, offset: 10 }, { primaryKeyField: 'id' }, ['id', 'name'], 'myTable', 'myOtherName'), {
        mssql: 'SELECT id, name FROM myTable AS myOtherName'
      });

      // Test older version (< v11.0.0)
      modifiedGen.sequelize.options.databaseVersion = '10.0.0';

      // Base case
      expectsql(modifiedGen.selectFromTableFragment({}, { primaryKeyField: 'id' }, ['id', 'name'], 'myTable', 'myOtherName', 'WHERE id=1'), {
        mssql: 'SELECT id, name FROM myTable AS myOtherName'
      });

      // With limit
      expectsql(modifiedGen.selectFromTableFragment({ limit: 10 }, { primaryKeyField: 'id' }, ['id', 'name'], 'myTable', 'myOtherName'), {
        mssql: 'SELECT TOP 10 id, name FROM myTable AS myOtherName'
      });

      // With offset
      expectsql(modifiedGen.selectFromTableFragment({ offset: 10 }, { primaryKeyField: 'id' }, ['id', 'name'], 'myTable', 'myOtherName'), {
        mssql: 'SELECT TOP 100 PERCENT id, name FROM (SELECT * FROM (SELECT ROW_NUMBER() OVER (ORDER BY [id]) as row_num, *  FROM myTable AS myOtherName) AS myOtherName WHERE row_num > 10) AS myOtherName'
      });

      // With both limit and offset
      expectsql(modifiedGen.selectFromTableFragment({ limit: 10, offset: 10 }, { primaryKeyField: 'id' }, ['id', 'name'], 'myTable', 'myOtherName'), {
        mssql: 'SELECT TOP 100 PERCENT id, name FROM (SELECT TOP 10 * FROM (SELECT ROW_NUMBER() OVER (ORDER BY [id]) as row_num, *  FROM myTable AS myOtherName) AS myOtherName WHERE row_num > 10) AS myOtherName'
      });
    });
  });
}
