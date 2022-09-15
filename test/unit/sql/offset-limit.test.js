'use strict';

const Support   = require('../support'),
  util = require('util'),
  expectsql = Support.expectsql,
  current   = Support.sequelize,
  sql       = current.dialect.queryGenerator;

// Notice: [] will be replaced by dialect specific tick/quote character when there is not dialect specific expectation but only a default expectation

describe(Support.getTestDialectTeaser('SQL'), () => {
  describe('offset/limit', () => {
    const testsql = function(options, expectation) {
      const model = options.model;

      it(util.inspect(options, { depth: 2 }), () => {
        return expectsql(
          sql.addLimitAndOffset(
            options,
            model
          ),
          expectation
        );
      });
    };

    testsql({
      limit: 10, //when no order by present, one is automagically prepended, test its existence
      model: { primaryKeyField: 'id', name: 'tableRef' }
    }, {
      default: ' LIMIT 10',
      db2: ' FETCH NEXT 10 ROWS ONLY',
      oracle: ' ORDER BY "tableRef"."id" OFFSET 0 ROWS FETCH NEXT 10 ROWS ONLY',
      mssql: ' ORDER BY [tableRef].[id] OFFSET 0 ROWS FETCH NEXT 10 ROWS ONLY'
    });

    testsql({
      limit: 10,
      order: [
        ['email', 'DESC'] // for MSSQL
      ]
    }, {
      default: ' LIMIT 10',
      db2: ' FETCH NEXT 10 ROWS ONLY',
      oracle: ' OFFSET 0 ROWS FETCH NEXT 10 ROWS ONLY',
      mssql: ' OFFSET 0 ROWS FETCH NEXT 10 ROWS ONLY'
    });

    testsql({
      limit: 10,
      offset: 20,
      order: [
        ['email', 'DESC'] // for MSSQL
      ]
    }, {
      default: ' LIMIT 20, 10',
      snowflake: ' LIMIT 10 OFFSET 20',
      postgres: ' LIMIT 10 OFFSET 20',
      db2: ' OFFSET 20 ROWS FETCH NEXT 10 ROWS ONLY',
      oracle: ' OFFSET 20 ROWS FETCH NEXT 10 ROWS ONLY',
      mssql: ' OFFSET 20 ROWS FETCH NEXT 10 ROWS ONLY'
    });

    testsql({
      limit: "';DELETE FROM user",
      order: [
        ['email', 'DESC'] // for MSSQL
      ]
    }, {
      default: " LIMIT ''';DELETE FROM user'",
      mariadb: " LIMIT '\\';DELETE FROM user'",
      snowflake: " LIMIT ''';DELETE FROM user'",
      mysql: " LIMIT '\\';DELETE FROM user'",
      db2: " FETCH NEXT ''';DELETE FROM user' ROWS ONLY",
      oracle: " OFFSET 0 ROWS FETCH NEXT ''';DELETE FROM user' ROWS ONLY",
      mssql: " OFFSET 0 ROWS FETCH NEXT N''';DELETE FROM user' ROWS ONLY"
    });

    testsql({
      limit: 10,
      offset: "';DELETE FROM user",
      order: [
        ['email', 'DESC'] // for MSSQL
      ]
    }, {
      sqlite: " LIMIT ''';DELETE FROM user', 10",
      postgres: " LIMIT 10 OFFSET ''';DELETE FROM user'",
      mariadb: " LIMIT '\\';DELETE FROM user', 10",
      snowflake: " LIMIT 10 OFFSET ''';DELETE FROM user'",
      mysql: " LIMIT '\\';DELETE FROM user', 10",
      db2: ' FETCH NEXT 10 ROWS ONLY',
      oracle: " OFFSET ''';DELETE FROM user' ROWS FETCH NEXT 10 ROWS ONLY",
      mssql: " OFFSET N''';DELETE FROM user' ROWS FETCH NEXT 10 ROWS ONLY"
    });

    testsql({
      limit: 10,
      order: [], // When the order is an empty array, one is automagically prepended
      model: { primaryKeyField: 'id', name: 'tableRef' }
    }, {
      db2: ' FETCH NEXT 10 ROWS ONLY',
      default: ' LIMIT 10',
      oracle: ' ORDER BY "tableRef"."id" OFFSET 0 ROWS FETCH NEXT 10 ROWS ONLY',
      mssql: ' ORDER BY [tableRef].[id] OFFSET 0 ROWS FETCH NEXT 10 ROWS ONLY'
    });
  });
});
