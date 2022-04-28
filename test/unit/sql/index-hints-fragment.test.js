'use strict';

const Support   = require('../support');

const current   = Support.sequelize;
const expectsql = Support.expectsql;
const sql = current.dialect.queryGenerator;
const { IndexHints } = require('@sequelize/core');

if (current.dialect.supports.indexHints) {
  describe(Support.getTestDialectTeaser('SQL'), () => {
    describe('indexHintsFragment', () => {
      it('correctly formats the index hints', () => {
        expectsql(sql.indexHintsFragment([{ type: IndexHints.USE, values: ['index_project_on_name'] }]), {
          default: 'USE INDEX (`index_project_on_name`)',
          snowflake: 'USE INDEX ("index_project_on_name")',
        });

        expectsql(sql.indexHintsFragment([{ type: IndexHints.FORCE, values: ['index_project_on_name'] }]), {
          default: 'FORCE INDEX (`index_project_on_name`)',
          snowflake: 'FORCE INDEX ("index_project_on_name")',
        });

        expectsql(sql.indexHintsFragment([{ type: IndexHints.IGNORE, values: ['index_project_on_name'] }]), {
          default: 'IGNORE INDEX (`index_project_on_name`)',
          snowflake: 'IGNORE INDEX ("index_project_on_name")',
        });

        expectsql(sql.indexHintsFragment([{ type: IndexHints.USE, values: ['index_project_on_name', 'index_project_on_name_and_foo'] }]), {
          default: 'USE INDEX (`index_project_on_name`,`index_project_on_name_and_foo`)',
          snowflake: 'USE INDEX ("index_project_on_name","index_project_on_name_and_foo")',
        });

        expectsql(sql.indexHintsFragment([{ indexHints: [{ type: 'FOO', values: ['index_project_on_name'] }] }]), {
          default: '',
        });

        expectsql(sql.indexHintsFragment([{ indexHints: [{ type: 'FOO', values: ['index_project_on_name'] }] }, { indexHints: [{ type: 'BAR', values: ['index_project_on_name'] }] }]), {
          default: '',
        });
      });
    });
  });
}
