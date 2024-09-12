'use strict';

const Support = require('../support'),
  DataTypes   = require('sequelize/lib/data-types'),
  util        = require('util'),
  expectsql   = Support.expectsql,
  current     = Support.sequelize,
  sql         = current.dialect.queryGenerator;


describe(Support.getTestDialectTeaser('SQL'), () => {
  describe('group', () => {
    const testsql = function(options, expectation) {
      const model = options.model;

      it(util.inspect(options, { depth: 2 }), () => {
        return expectsql(
          sql.selectQuery(
            options.table || model && model.getTableName(),
            options,
            options.model
          ),
          expectation
        );
      });
    };

    const User = Support.sequelize.define('User', {
      name: {
        type: DataTypes.STRING,
        field: 'name',
        allowNull: false
      }
    });

    testsql({
      model: User,
      group: ['name']
    }, {
      default: 'SELECT * FROM `Users` AS `User` GROUP BY `name`;',
      postgres: 'SELECT * FROM "Users" AS "User" GROUP BY "name";',
      db2: 'SELECT * FROM "Users" AS "User" GROUP BY "name";',
      mssql: 'SELECT * FROM [Users] AS [User] GROUP BY [name];',
      oracle: 'SELECT * FROM "Users" "User" GROUP BY "name";',
      snowflake: 'SELECT * FROM "Users" AS "User" GROUP BY "name";'
    });

    testsql({
      model: User,
      group: []
    }, {
      default: 'SELECT * FROM `Users` AS `User`;',
      postgres: 'SELECT * FROM "Users" AS "User";',
      db2: 'SELECT * FROM "Users" AS "User";',
      mssql: 'SELECT * FROM [Users] AS [User];',
      oracle: 'SELECT * FROM "Users" "User";',
      snowflake: 'SELECT * FROM "Users" AS "User";'
    });
  });
});
