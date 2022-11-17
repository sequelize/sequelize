import { buildInvalidOptionReceivedError } from '@sequelize/core/_non-semver-use-at-your-own-risk_/utils/check.js';
import { createSequelizeInstance, expectsql, getTestDialect, sequelize } from '../../support';

const dialectName = getTestDialect();

describe('QueryGenerator#removeIndexQuery', () => {
  const queryGenerator = sequelize.getQueryInterface().queryGenerator;

  it('produces a REMOVE INDEX query with index name', () => {
    expectsql(() => queryGenerator.removeIndexQuery('myTable', 'myTable_foo_bar'), {
      default: 'DROP INDEX IF EXISTS [myTable_foo_bar]',
      mariadb: 'DROP INDEX `myTable_foo_bar` ON `myTable`',
      mysql: 'DROP INDEX `myTable_foo_bar` ON `myTable`',
      mssql: 'DROP INDEX [myTable_foo_bar] ON [myTable]',
      snowflake: 'DROP INDEX "myTable_foo_bar" ON "myTable";',
      db2: 'DROP INDEX "myTable_foo_bar"',
      ibmi: `BEGIN IF EXISTS (SELECT * FROM QSYS2.SYSINDEXES WHERE INDEX_NAME = 'myTable_foo_bar') THEN DROP INDEX "myTable_foo_bar"; COMMIT; END IF; END`,
    });
  });

  // !TODO: schema is not used
  it.skip('produces a REMOVE INDEX query with index name and schema', () => {
    expectsql(() => queryGenerator.removeIndexQuery({ tableName: 'myTable', schema: 'mySchema' }, 'myTable_foo_bar'), {
      default: 'DROP INDEX IF EXISTS [mySchema].[myTable_foo_bar]',
      'mariadb mysql': 'DROP INDEX `myTable_foo_bar` ON `mySchema`.`myTable`',
      mssql: 'DROP INDEX [myTable_foo_bar] ON [mySchema].[myTable]',
      snowflake: 'DROP INDEX "myTable_foo_bar" ON "mySchema"."myTable";',
      sqlite: 'DROP INDEX IF EXISTS `mySchema.myTable_foo_bar`',
      db2: 'DROP INDEX "mySchema"."myTable_foo_bar"',
      ibmi: `BEGIN IF EXISTS (SELECT * FROM QSYS2.SYSINDEXES WHERE INDEX_NAME = 'myTable_foo_bar') THEN DROP INDEX "mySchema"."myTable_foo_bar"; COMMIT; END IF; END`,
    });
  });

  // !TODO: myTable_foo_bar is my_table_foo_bar
  it.skip('produces a REMOVE INDEX query with index attributes', () => {
    expectsql(() => queryGenerator.removeIndexQuery('myTable', ['foo', 'bar']), {
      default: 'DROP INDEX IF EXISTS [myTable_foo_bar]',
      'mariadb mysql': 'DROP INDEX `myTable_foo_bar` ON `myTable`',
      mssql: 'DROP INDEX [myTable_foo_bar] ON [myTable]',
      snowflake: 'DROP INDEX "my_table_foo_bar" ON "myTable";',
      db2: 'DROP INDEX "myTable_foo_bar"',
      ibmi: `BEGIN IF EXISTS (SELECT * FROM QSYS2.SYSINDEXES WHERE INDEX_NAME = 'myTable_foo_bar') THEN DROP INDEX "myTable_foo_bar"; COMMIT; END IF; END`,
    });
  });

  // FIXME: enable this test once fixed (in https://github.com/sequelize/sequelize/pull/14687)
  it.skip('produces a REMOVE INDEX query with index name from a table and globally set schema', () => {
    const sequelizeSchema = createSequelizeInstance({ schema: 'mySchema' });
    const queryGeneratorSchema = sequelizeSchema.getQueryInterface().queryGenerator;

    expectsql(() => queryGeneratorSchema.removeIndexQuery('myTable', 'myTable_foo_bar'), {
      default: 'DROP INDEX IF EXISTS [mySchema].[myTable_foo_bar]',
      'mariadb mysql': 'DROP INDEX `myTable_foo_bar` ON `mySchema`.`myTable`',
      mssql: 'DROP INDEX [myTable_foo_bar] ON [mySchema].[myTable]',
      snowflake: 'DROP INDEX "myTable_foo_bar" ON "mySchema"."myTable";',
      sqlite: 'DROP INDEX IF EXISTS `mySchema.myTable_foo_bar`',
      db2: 'DROP INDEX "mySchema"."myTable_foo_bar"',
      ibmi: `BEGIN IF EXISTS (SELECT * FROM QSYS2.SYSINDEXES WHERE INDEX_NAME = 'myTable_foo_bar') THEN DROP INDEX "mySchema"."myTable_foo_bar"; COMMIT; END IF; END`,
    });
  });

  // !TODO: rejectInvalidOptions
  it.skip('produces a REMOVE INDEX query with index name and concurrently', () => {
    expectsql(() => queryGenerator.removeIndexQuery('myTable', 'myTable_foo_bar', { concurrently: true }), {
      default: buildInvalidOptionReceivedError('removeIndexQuery', dialectName, ['concurrently']),
      postgres: 'DROP INDEX CONCURRENTLY IF EXISTS "myTable_foo_bar"',
    });
  });
});
