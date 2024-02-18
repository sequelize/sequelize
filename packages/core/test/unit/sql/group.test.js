'use strict';

const { DataTypes } = require('@sequelize/core');
const { beforeAll2, expectsql, sequelize } = require('../../support');

const sql = sequelize.dialect.queryGenerator;

describe('QueryGenerator#selectQuery with "group"', () => {
  function expectSelect(options, expectation) {
    const model = options.model;

    return expectsql(
      sql.selectQuery(options.table || (model && model.table), options, options.model),
      expectation,
    );
  }

  const vars = beforeAll2(() => {
    const User = sequelize.define('User', {
      name: {
        type: DataTypes.STRING,
        field: 'name',
        allowNull: false,
      },
    });

    return { User };
  });

  it('supports simple GROUP BY', () => {
    const { User } = vars;

    expectSelect(
      {
        model: User,
        group: ['name'],
      },
      {
        default: 'SELECT * FROM `Users` AS `User` GROUP BY `name`;',
        postgres: 'SELECT * FROM "Users" AS "User" GROUP BY "name";',
        db2: 'SELECT * FROM "Users" AS "User" GROUP BY "name";',
        ibmi: 'SELECT * FROM "Users" AS "User" GROUP BY "name"',
        mssql: 'SELECT * FROM [Users] AS [User] GROUP BY [name];',
        snowflake: 'SELECT * FROM "Users" AS "User" GROUP BY "name";',
      },
    );
  });

  it('does not add GROUP BY if it is empty', () => {
    const { User } = vars;

    expectSelect(
      {
        model: User,
        group: [],
      },
      {
        default: 'SELECT * FROM `Users` AS `User`;',
        postgres: 'SELECT * FROM "Users" AS "User";',
        db2: 'SELECT * FROM "Users" AS "User";',
        ibmi: 'SELECT * FROM "Users" AS "User"',
        mssql: 'SELECT * FROM [Users] AS [User];',
        snowflake: 'SELECT * FROM "Users" AS "User";',
      },
    );
  });
});
