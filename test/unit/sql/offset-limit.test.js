'use strict';

const Support   = require('../support'),
  util = require('util'),
  expectsql = Support.expectsql,
  current   = Support.sequelize,
  sql       = current.dialect.QueryGenerator;

const { Composition } = require('../../../lib/dialects/abstract/query-generator/composition');

// Notice: [] will be replaced by dialect specific tick/quote character when there is not dialect specific expectation but only a default expectation
// Some dialects require order for pagination, therefore include order

describe(Support.getTestDialectTeaser('SQL'), () => {
  describe('offset/limit', () => {
    const testsql = function(options, expectation) {
      const model = options.model;

      it(util.inspect(options, { depth: 2 }), () => {
        const items = new Composition();

        const order = sql.getQueryOrders(options, model).mainQueryOrder;
        if (order.length) items.add('ORDER BY ', order);
        if (items.length) items.add(' ');
        items.add(sql.addLimitAndOffset(options, model));

        const query = sql.composeQuery(items);

        return expectsql(query, expectation);
      });
    };

    testsql({
      limit: 10, //when no order by present, one is automagically prepended, test its existence
      model: { primaryKeyField: 'id', name: 'tableRef' }
    }, {
      query: {
        default: 'LIMIT $1;',
        mssql: 'ORDER BY [tableRef].[id] OFFSET 0 ROWS FETCH NEXT @0 ROWS ONLY;'
      },
      bind: {
        default: [10]
      }
    });

    testsql({
      limit: 10,
      order: [
        ['email', 'DESC'] // for MSSQL
      ]
    }, {
      query: {
        default: 'ORDER BY [email] DESC LIMIT $1;',
        mssql: 'ORDER BY [email] DESC OFFSET 0 ROWS FETCH NEXT @0 ROWS ONLY;'
      },
      bind: {
        default: [10]
      }
    });

    testsql({
      limit: 10,
      offset: 20,
      order: [
        ['email', 'DESC'] // for MSSQL
      ]
    }, {
      query: {
        default: 'ORDER BY [email] DESC LIMIT $1, $2;',
        postgres: 'ORDER BY "email" DESC LIMIT $1 OFFSET $2;',
        mssql: 'ORDER BY [email] DESC OFFSET @0 ROWS FETCH NEXT @1 ROWS ONLY;'
      },
      bind: {
        default: [20, 10],
        postgres: [10, 20]
      }
    });

    testsql({
      limit: "';DELETE FROM user",
      order: [
        ['email', 'DESC'] // for MSSQL
      ]
    }, {
      query: {
        default: 'ORDER BY [email] DESC LIMIT $1;',
        mssql: 'ORDER BY [email] DESC OFFSET 0 ROWS FETCH NEXT @0 ROWS ONLY;'
      },
      bind: {
        default: ["';DELETE FROM user"]
      }
    });

    testsql({
      limit: 10,
      offset: "';DELETE FROM user",
      order: [
        ['email', 'DESC'] // for MSSQL
      ]
    }, {
      query: {
        default: 'ORDER BY [email] DESC LIMIT $1, $2;',
        postgres: 'ORDER BY "email" DESC LIMIT $1 OFFSET $2;',
        mssql: 'ORDER BY [email] DESC OFFSET @0 ROWS FETCH NEXT @1 ROWS ONLY;'
      },
      bind: {
        default: ["';DELETE FROM user", 10],
        postgres: [10, "';DELETE FROM user"]
      }
    });
  });
});
