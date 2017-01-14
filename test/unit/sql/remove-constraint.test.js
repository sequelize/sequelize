'use strict';

/* jshint -W030, -W110 */
const Support   = require(__dirname + '/../support');
const current   = Support.sequelize;
const expectsql = Support.expectsql;
const sql = current.dialect.QueryGenerator;

describe(Support.getTestDialectTeaser('SQL'), function() {
  describe('removeConstraint', function () {
    it('naming', function () {
      expectsql(sql.removeConstraintQuery('myTable', 'constraint_name'), {
        default: 'ALTER TABLE [myTable] DROP CONSTRAINT [constraint_name]'
      });
    });
  });
});
