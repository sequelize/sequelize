import { buildInvalidOptionReceivedError } from '@sequelize/core/_non-semver-use-at-your-own-risk_/utils/check.js';
import { createSequelizeInstance, expectsql, sequelize } from '../../support';

const dialect = sequelize.dialect;

describe('QueryGenerator#removeIndexQuery', () => {
  const queryGenerator = sequelize.getQueryInterface().queryGenerator;

  it('produces a DROP INDEX query from a table', () => {
    expectsql(() => queryGenerator.removeIndexQuery('myTable', 'user_foo_bar'), {
      default: `DROP INDEX [user_foo_bar] ON [myTable]`,
      postgres: `DROP INDEX "public"."user_foo_bar"`,
      'sqlite db2': 'DROP INDEX [user_foo_bar]',
      snowflake: new Error(`removeIndexQuery has not been implemented in ${dialect.name}.`),
      ibmi: `BEGIN DROP INDEX "user_foo_bar"; COMMIT; END`,
    });
  });

  it('produces a DROP INDEX query from a table with attributes', () => {
    expectsql(() => queryGenerator.removeIndexQuery('myTable', ['foo', 'bar']), {
      default: `DROP INDEX [my_table_foo_bar] ON [myTable]`,
      postgres: `DROP INDEX "public"."my_table_foo_bar"`,
      'sqlite db2': 'DROP INDEX [my_table_foo_bar]',
      snowflake: new Error(`removeIndexQuery has not been implemented in ${dialect.name}.`),
      ibmi: `BEGIN DROP INDEX "my_table_foo_bar"; COMMIT; END`,
    });
  });

  it('produces a DROP INDEX with CONCURRENTLY query from a table', () => {
    expectsql(() => queryGenerator.removeIndexQuery('myTable', 'user_foo_bar', { concurrently: true }), {
      default: buildInvalidOptionReceivedError('removeIndexQuery', dialect.name, ['concurrently']),
      postgres: `DROP INDEX CONCURRENTLY "public"."user_foo_bar"`,
      snowflake: new Error(`removeIndexQuery has not been implemented in ${dialect.name}.`),
    });
  });

  it('produces a DROP INDEX with IF EXISTS query from a table', () => {
    expectsql(() => queryGenerator.removeIndexQuery('myTable', 'user_foo_bar', { ifExists: true }), {
      default: `DROP INDEX IF EXISTS [user_foo_bar] ON [myTable]`,
      'mysql db2': buildInvalidOptionReceivedError('removeIndexQuery', dialect.name, ['ifExists']),
      postgres: `DROP INDEX IF EXISTS "public"."user_foo_bar"`,
      sqlite: 'DROP INDEX IF EXISTS `user_foo_bar`',
      snowflake: new Error(`removeIndexQuery has not been implemented in ${dialect.name}.`),
      ibmi: `BEGIN IF EXISTS (SELECT * FROM QSYS2.SYSINDEXES WHERE INDEX_NAME = "user_foo_bar") THEN DROP INDEX "user_foo_bar"; COMMIT; END IF; END`,
    });
  });

  it('produces a DROP INDEX with CASCADE query from a table', () => {
    expectsql(() => queryGenerator.removeIndexQuery('myTable', 'user_foo_bar', { cascade: true }), {
      default: buildInvalidOptionReceivedError('removeIndexQuery', dialect.name, ['cascade']),
      postgres: `DROP INDEX "public"."user_foo_bar" CASCADE`,
      snowflake: new Error(`removeIndexQuery has not been implemented in ${dialect.name}.`),
    });
  });

  it('produces a DROP INDEX with CASCADE and IF EXISTS query from a table', () => {
    expectsql(() => queryGenerator.removeIndexQuery('myTable', 'user_foo_bar', { cascade: true, ifExists: true }), {
      default: buildInvalidOptionReceivedError('removeIndexQuery', dialect.name, ['cascade']),
      'mysql db2': buildInvalidOptionReceivedError('removeIndexQuery', dialect.name, ['cascade', 'ifExists']),
      postgres: `DROP INDEX IF EXISTS "public"."user_foo_bar" CASCADE`,
      snowflake: new Error(`removeIndexQuery has not been implemented in ${dialect.name}.`),
    });
  });

  it('produces a DROP INDEX with CONCURRENTLY and IF EXISTS query from a table', () => {
    expectsql(() => queryGenerator.removeIndexQuery('myTable', 'user_foo_bar', { concurrently: true, ifExists: true }), {
      default: buildInvalidOptionReceivedError('removeIndexQuery', dialect.name, ['concurrently']),
      'mysql db2': buildInvalidOptionReceivedError('removeIndexQuery', dialect.name, ['concurrently', 'ifExists']),
      postgres: `DROP INDEX CONCURRENTLY IF EXISTS "public"."user_foo_bar"`,
      snowflake: new Error(`removeIndexQuery has not been implemented in ${dialect.name}.`),
    });
  });

  it('throws an error for DROP INDEX with CASCADE and CONCURRENTLY query from a table', () => {
    expectsql(() => queryGenerator.removeIndexQuery('myTable', 'user_foo_bar', { cascade: true, concurrently: true }), {
      default: buildInvalidOptionReceivedError('removeIndexQuery', dialect.name, ['cascade', 'concurrently']),
      postgres: new Error(`Cannot specify both concurrently and cascade options in removeIndexQuery for ${dialect.name} dialect`),
      snowflake: new Error(`removeIndexQuery has not been implemented in ${dialect.name}.`),
    });
  });

  it('produces a DROP INDEX query from a model', () => {
    const MyModel = sequelize.define('myModel', {});

    expectsql(() => queryGenerator.removeIndexQuery(MyModel, 'user_foo_bar'), {
      default: `DROP INDEX [user_foo_bar] ON [myModels]`,
      postgres: `DROP INDEX "public"."user_foo_bar"`,
      'sqlite db2': 'DROP INDEX [user_foo_bar]',
      snowflake: new Error(`removeIndexQuery has not been implemented in ${dialect.name}.`),
      ibmi: `BEGIN DROP INDEX "user_foo_bar"; COMMIT; END`,
    });
  });

  it('produces a DROP INDEX query from a table and schema', () => {
    expectsql(() => queryGenerator.removeIndexQuery({ tableName: 'myTable', schema: 'mySchema' }, 'user_foo_bar'), {
      default: `DROP INDEX [user_foo_bar] ON [mySchema].[myTable]`,
      postgres: `DROP INDEX "mySchema"."user_foo_bar"`,
      'sqlite db2': 'DROP INDEX [user_foo_bar]',
      snowflake: new Error(`removeIndexQuery has not been implemented in ${dialect.name}.`),
      ibmi: `BEGIN DROP INDEX "user_foo_bar"; COMMIT; END`,
    });
  });

  it('produces a DROP INDEX query from a table and default schema', () => {
    expectsql(() => queryGenerator.removeIndexQuery({ tableName: 'myTable', schema: dialect.getDefaultSchema() }, 'user_foo_bar'), {
      default: `DROP INDEX [user_foo_bar] ON [myTable]`,
      postgres: `DROP INDEX "public"."user_foo_bar"`,
      'sqlite db2': 'DROP INDEX [user_foo_bar]',
      snowflake: new Error(`removeIndexQuery has not been implemented in ${dialect.name}.`),
      ibmi: `BEGIN DROP INDEX "user_foo_bar"; COMMIT; END`,
    });
  });

  it('produces a DROP INDEX query from a table and globally set schema', () => {
    const sequelizeSchema = createSequelizeInstance({ schema: 'mySchema' });
    const queryGeneratorSchema = sequelizeSchema.getQueryInterface().queryGenerator;

    expectsql(() => queryGeneratorSchema.removeIndexQuery('myTable', 'user_foo_bar'), {
      default: `DROP INDEX [user_foo_bar] ON [mySchema].[myTable]`,
      postgres: `DROP INDEX "mySchema"."user_foo_bar"`,
      'sqlite db2': 'DROP INDEX [user_foo_bar]',
      snowflake: new Error(`removeIndexQuery has not been implemented in ${dialect.name}.`),
      ibmi: `BEGIN DROP INDEX "user_foo_bar"; COMMIT; END`,
    });
  });
});
