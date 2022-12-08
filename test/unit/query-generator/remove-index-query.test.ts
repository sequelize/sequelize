import { buildInvalidOptionReceivedError } from '@sequelize/core/_non-semver-use-at-your-own-risk_/utils/check.js';
import { createSequelizeInstance, expectsql, sequelize } from '../../support';

const dialect = sequelize.dialect;

describe('QueryGenerator#removeIndexQuery', () => {
  const queryGenerator = sequelize.getQueryInterface().queryGenerator;

  it('produces a DROP INDEX query from a table', () => {
    expectsql(() => queryGenerator.removeIndexQuery('myTable', 'user_foo_bar'), {
      default: `DROP INDEX [user_foo_bar] ON [myTable]`,
      sqlite: 'DROP INDEX `user_foo_bar`',
      ibmi: `BEGIN DROP INDEX "user_foo_bar"; COMMIT; END`,
      'db2 postgres': `DROP INDEX "user_foo_bar"`,

    });
  });

  it('produces a DROP INDEX query from a table with attributes', () => {
    expectsql(() => queryGenerator.removeIndexQuery('myTable', ['foo', 'bar']), {
      default: `DROP INDEX [my_table_foo_bar] ON [myTable]`,
      sqlite: 'DROP INDEX `my_table_foo_bar`',
      ibmi: `BEGIN DROP INDEX "my_table_foo_bar"; COMMIT; END`,
      'db2 postgres': `DROP INDEX "my_table_foo_bar"`,

    });
  });

  it('produces a DROP INDEX with CONCURRENTLY query from a table', () => {
    expectsql(() => queryGenerator.removeIndexQuery('myTable', 'user_foo_bar', { concurrently: true }), {
      default: `DROP INDEX CONCURRENTLY [user_foo_bar] ON [myTable]`,
      postgres: `DROP INDEX CONCURRENTLY "user_foo_bar"`,
      'db2 ibmi mariadb mssql mysql snowflake sqlite': buildInvalidOptionReceivedError('removeIndexQuery', dialect.name, ['concurrently']),
    });
  });

  it('produces a DROP INDEX with IF EXISTS query from a table', () => {
    expectsql(() => queryGenerator.removeIndexQuery('myTable', 'user_foo_bar', { ifExists: true }), {
      default: `DROP INDEX IF EXISTS [user_foo_bar] ON [myTable]`,
      sqlite: 'DROP INDEX IF EXISTS `user_foo_bar`',
      postgres: `DROP INDEX IF EXISTS "user_foo_bar"`,
      ibmi: `BEGIN IF EXISTS (SELECT * FROM QSYS2.SYSINDEXES WHERE INDEX_NAME = 'user_foo_bar') THEN DROP INDEX "user_foo_bar"; COMMIT; END IF; END`,
      'db2 mysql snowflake': buildInvalidOptionReceivedError('removeIndexQuery', dialect.name, ['ifExists']),
    });
  });

  it('produces a DROP INDEX with CASCADE query from a table', () => {
    expectsql(() => queryGenerator.removeIndexQuery('myTable', 'user_foo_bar', { cascade: true }), {
      default: `DROP INDEX [user_foo_bar] ON [myTable] CASCADE`,
      postgres: `DROP INDEX "user_foo_bar" CASCADE`,
      'db2 ibmi mariadb mssql mysql snowflake sqlite': buildInvalidOptionReceivedError('removeIndexQuery', dialect.name, ['cascade']),
    });
  });

  it('produces a DROP INDEX with CASCADE and IF EXISTS query from a table', () => {
    expectsql(() => queryGenerator.removeIndexQuery('myTable', 'user_foo_bar', { cascade: true, ifExists: true }), {
      default: `DROP INDEX IF EXISTS [user_foo_bar] ON [myTable] CASCADE`,
      postgres: `DROP INDEX IF EXISTS "user_foo_bar" CASCADE`,
      'db2 mysql snowflake': buildInvalidOptionReceivedError('removeIndexQuery', dialect.name, ['cascade', 'ifExists']),
      'ibmi mariadb mssql sqlite': buildInvalidOptionReceivedError('removeIndexQuery', dialect.name, ['cascade']),
    });
  });

  it('produces a DROP INDEX with CONCURRENTLY and IF EXISTS query from a table', () => {
    expectsql(() => queryGenerator.removeIndexQuery('myTable', 'user_foo_bar', { concurrently: true, ifExists: true }), {
      default: `DROP INDEX CONCURRENTLY IF EXISTS [user_foo_bar] ON [myTable]`,
      postgres: `DROP INDEX CONCURRENTLY IF EXISTS "user_foo_bar"`,
      'db2 mysql snowflake': buildInvalidOptionReceivedError('removeIndexQuery', dialect.name, ['concurrently', 'ifExists']),
      'ibmi mariadb mssql sqlite': buildInvalidOptionReceivedError('removeIndexQuery', dialect.name, ['concurrently']),
    });
  });

  it('produces a DROP INDEX query from a model', () => {
    const MyModel = sequelize.define('myModel', {});

    expectsql(() => queryGenerator.removeIndexQuery(MyModel, 'user_foo_bar'), {
      default: `DROP INDEX [user_foo_bar] ON [myModels]`,
      sqlite: 'DROP INDEX `user_foo_bar`',
      ibmi: `BEGIN DROP INDEX "user_foo_bar"; COMMIT; END`,
      'db2 postgres': `DROP INDEX "user_foo_bar"`,
    });
  });

  it('produces a DROP INDEX query from a table and schema', () => {
    expectsql(() => queryGenerator.removeIndexQuery({ tableName: 'myTable', schema: 'mySchema' }, 'user_foo_bar'), {
      default: `DROP INDEX [user_foo_bar] ON [mySchema].[myTable]`,
      sqlite: 'DROP INDEX `user_foo_bar`',
      postgres: `DROP INDEX "mySchema"."user_foo_bar"`,
      ibmi: `BEGIN DROP INDEX "user_foo_bar"; COMMIT; END`,
      db2: `DROP INDEX "user_foo_bar"`,
    });
  });

  it('produces a DROP INDEX query from a table and default schema', () => {
    expectsql(() => queryGenerator.removeIndexQuery({ tableName: 'myTable', schema: dialect.getDefaultSchema() }, 'user_foo_bar'), {
      default: `DROP INDEX [user_foo_bar] ON [myTable]`,
      sqlite: 'DROP INDEX `user_foo_bar`',
      ibmi: `BEGIN DROP INDEX "user_foo_bar"; COMMIT; END`,
      'db2 postgres': `DROP INDEX "user_foo_bar"`,
    });
  });

  it('produces a DROP INDEX query from a table and globally set schema', () => {
    const sequelizeSchema = createSequelizeInstance({ schema: 'mySchema' });
    const queryGeneratorSchema = sequelizeSchema.getQueryInterface().queryGenerator;

    expectsql(() => queryGeneratorSchema.removeIndexQuery('myTable', 'user_foo_bar'), {
      default: `DROP INDEX [user_foo_bar] ON [mySchema].[myTable]`,
      sqlite: 'DROP INDEX `user_foo_bar`',
      postgres: `DROP INDEX "mySchema"."user_foo_bar"`,
      ibmi: `BEGIN DROP INDEX "user_foo_bar"; COMMIT; END`,
      db2: 'DROP INDEX "user_foo_bar"',
    });
  });
});
