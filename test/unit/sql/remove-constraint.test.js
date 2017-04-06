'use strict';

const Support   = require(__dirname + '/../support');
const current   = Support.sequelize;
const expectsql = Support.expectsql;
const sql = current.dialect.QueryGenerator;

if (current.dialect.supports.constraints.dropConstraint) {
  describe(Support.getTestDialectTeaser('SQL'), () => {
    describe('removeConstraint', () => {
      it('naming', () => {
        expectsql(sql.removeConstraintQuery('myTable', 'constraint_name'), {
          default: 'ALTER TABLE [myTable] DROP CONSTRAINT [constraint_name]'
        });
      });
    });
  });
}
