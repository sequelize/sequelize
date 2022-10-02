'use strict';

const Support   = require('../support');

const current   = Support.sequelize;
const expectsql = Support.expectsql;
const sql = current.dialect.queryGenerator;

describe('SQL', () => {
  if (!current.dialect.supports.constraints.dropConstraint) {
    return;
  }

  describe('removeConstraint', () => {
    it('naming', () => {
      expectsql(sql.removeConstraintQuery('myTable', 'constraint_name'), {
        default: 'ALTER TABLE [myTable] DROP CONSTRAINT [constraint_name]',
      });
    });

    if (current.dialect.supports.schemas) {
      it('schema', () => {
        expectsql(sql.removeConstraintQuery({
          tableName: 'myTable',
          schema: 'inspections',
        }, 'constraint_name'), {
          default: 'ALTER TABLE [inspections].[myTable] DROP CONSTRAINT [constraint_name]',
        });
      });
    }
  });
});
