'use strict';

const Support = require('../../support');
const { DataTypes } = require('@sequelize/core');
const util        = require('node:util');

const expectsql   = Support.expectsql;
const current     = Support.sequelize;
const sql         = current.dialect.queryGenerator;

describe(Support.getTestDialectTeaser('SQL'), () => {
  describe('group', () => {
    const testsql = function (options, expectation) {
      const model = options.model;

      it(util.inspect(options, { depth: 2 }), () => {
        return expectsql(
          sql.selectQuery(
            options.table || model && model.getTableName(),
            options,
            options.model,
          ),
          expectation,
        );
      });
    };

    const User = Support.sequelize.define('User', {
      name: {
        type: DataTypes.STRING,
        field: 'name',
        allowNull: false,
      },
    });

    testsql({
      model: User,
      group: ['name'],
    }, {
      default: 'SELECT * FROM [Users] AS [User] GROUP BY [name];',
    });

    testsql({
      model: User,
      group: [],
    }, {
      default: 'SELECT * FROM [Users] AS [User];',
    });
  });
});
