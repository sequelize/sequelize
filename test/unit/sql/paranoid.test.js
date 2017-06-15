'use strict';

const Support   = require(__dirname + '/../support'),
  DataTypes = require(__dirname + '/../../../lib/data-types'),
  util = require('util'),
  expectsql = Support.expectsql,
  current   = Support.sequelize,
  sql       = current.dialect.QueryGenerator;

// Notice: [] will be replaced by dialect specific tick/quote character when there is not dialect specific expectation but only a default expectation

suite(Support.getTestDialectTeaser('SQL'), () => {
  suite('paranoid', () => {
    const testsql = function(options, expectation) {
      const model = options.model;

      test(util.inspect(options, {depth: 2}), () => {
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

    (function() {
      const User = Support.sequelize.define('user', {
        username: DataTypes.STRING
      }, {
        paranoid: true,
        timestamp: true
      });

      testsql({
        table: User.getTableName(),
        model: User,
        attributes: [
          'username'
        ],
        where: {}
      }, {
        default: 'SELECT [username] FROM [users] as [user] WHERE (([user].[deletedAt] > CURRENT_TIMESTAMP OR [user].[deletedAt] IS NULL);',
        mssql: 'SELECT [username] FROM [users] as [user] WHERE (([user].[deletedAt] > SYSDATETIMEOFFSET() OR [user].[deletedAt] IS NULL);'
      });
    }());
  });
});
