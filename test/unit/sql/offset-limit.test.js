'use strict';

const Support = require(__dirname + '/../support'),
  util = require('util'),
  expectsql = Support.expectsql,
  current = Support.sequelize,
  sql = current.dialect.QueryGenerator;

// Notice: [] will be replaced by dialect specific tick/quote character when there is not dialect specific expectation but only a default expectation

describe(Support.getTestDialectTeaser('SQL'), () => {
  describe('offset/limit', () => {
    const testsql = function (options, expectation) {
      const model = options.model;

      it(util.inspect(options, { depth: 0, maxArrayLength: 5, breakLength: Infinity }), () => {
        return expectsql(sql.addLimitAndOffset(options, model), expectation);
      });
    };

    testsql(
      {
        limit: 10, //when no order by present, one is automagically prepended, test its existence
        model: { primaryKeyField: 'id', name: 'tableRef' }
      },
      {
        default: ' LIMIT 10'
      }
    );

    testsql(
      {
        limit: 10,
        order: [
          ['email', 'DESC'] // for MSSQL
        ]
      },
      {
        default: ' LIMIT 10'
      }
    );

    testsql(
      {
        limit: 10,
        offset: 20,
        order: [
          ['email', 'DESC'] // for MSSQL
        ]
      },
      {
        default: ' LIMIT 20, 10',
        postgres: ' LIMIT 10 OFFSET 20'
      }
    );

    testsql(
      {
        limit: "';DELETE FROM user",
        order: [
          ['email', 'DESC'] // for MSSQL
        ]
      },
      {
        default: " LIMIT ''';DELETE FROM user'"
      }
    );

    testsql(
      {
        limit: 10,
        offset: "';DELETE FROM user",
        order: [
          ['email', 'DESC'] // for MSSQL
        ]
      },
      {
        postgres: " LIMIT 10 OFFSET ''';DELETE FROM user'"
      }
    );
  });
});
