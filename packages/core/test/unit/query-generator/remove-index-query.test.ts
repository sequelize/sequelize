import { buildInvalidOptionReceivedError } from '@sequelize/core/_non-semver-use-at-your-own-risk_/utils/check.js';
import { createSequelizeInstance, expectsql, sequelize } from '../../support';

const dialect = sequelize.dialect;
const notSupportedError = new Error(`Indexes are not supported by the ${dialect.name} dialect.`);

describe('QueryGenerator#removeIndexQuery', () => {
  const queryGenerator = sequelize.queryGenerator;

  it('produces a DROP INDEX query from a table', () => {
    expectsql(() => queryGenerator.removeIndexQuery('myTable', 'user_foo_bar'), {
      default: `DROP INDEX [user_foo_bar] ON [myTable]`,
      snowflake: notSupportedError,
      'db2 ibmi postgres sqlite3': `DROP INDEX [user_foo_bar]`,
    });
  });

  it('produces a DROP INDEX query from a table with attributes', () => {
    expectsql(() => queryGenerator.removeIndexQuery('myTable', ['foo', 'bar']), {
      default: `DROP INDEX [my_table_foo_bar] ON [myTable]`,
      snowflake: notSupportedError,
      'db2 ibmi postgres sqlite3': `DROP INDEX [my_table_foo_bar]`,
    });
  });

  it('produces a DROP INDEX with CONCURRENTLY query from a table', () => {
    expectsql(
      () => queryGenerator.removeIndexQuery('myTable', 'user_foo_bar', { concurrently: true }),
      {
        default: buildInvalidOptionReceivedError('removeIndexQuery', dialect.name, [
          'concurrently',
        ]),
        postgres: `DROP INDEX CONCURRENTLY "user_foo_bar"`,
        snowflake: notSupportedError,
      },
    );
  });

  it('produces a DROP INDEX with IF EXISTS query from a table', () => {
    expectsql(
      () => queryGenerator.removeIndexQuery('myTable', 'user_foo_bar', { ifExists: true }),
      {
        default: `DROP INDEX IF EXISTS [user_foo_bar] ON [myTable]`,
        snowflake: notSupportedError,
        'db2 mysql': buildInvalidOptionReceivedError('removeIndexQuery', dialect.name, [
          'ifExists',
        ]),
        'ibmi postgres sqlite3': `DROP INDEX IF EXISTS [user_foo_bar]`,
      },
    );
  });

  it('produces a DROP INDEX with CASCADE query from a table', () => {
    expectsql(() => queryGenerator.removeIndexQuery('myTable', 'user_foo_bar', { cascade: true }), {
      default: buildInvalidOptionReceivedError('removeIndexQuery', dialect.name, ['cascade']),
      postgres: `DROP INDEX "user_foo_bar" CASCADE`,
      snowflake: notSupportedError,
    });
  });

  it('produces a DROP INDEX with CASCADE and IF EXISTS query from a table', () => {
    expectsql(
      () =>
        queryGenerator.removeIndexQuery('myTable', 'user_foo_bar', {
          cascade: true,
          ifExists: true,
        }),
      {
        default: buildInvalidOptionReceivedError('removeIndexQuery', dialect.name, ['cascade']),
        postgres: `DROP INDEX IF EXISTS "user_foo_bar" CASCADE`,
        snowflake: notSupportedError,
        'db2 mysql': buildInvalidOptionReceivedError('removeIndexQuery', dialect.name, [
          'cascade',
          'ifExists',
        ]),
      },
    );
  });

  it('produces a DROP INDEX with CONCURRENTLY and IF EXISTS query from a table', () => {
    expectsql(
      () =>
        queryGenerator.removeIndexQuery('myTable', 'user_foo_bar', {
          concurrently: true,
          ifExists: true,
        }),
      {
        default: buildInvalidOptionReceivedError('removeIndexQuery', dialect.name, [
          'concurrently',
        ]),
        postgres: `DROP INDEX CONCURRENTLY IF EXISTS "user_foo_bar"`,
        snowflake: notSupportedError,
        'db2 mysql': buildInvalidOptionReceivedError('removeIndexQuery', dialect.name, [
          'concurrently',
          'ifExists',
        ]),
      },
    );
  });

  it('throws an error for DROP INDEX with CASCADE and CONCURRENTLY query from a table', () => {
    expectsql(
      () =>
        queryGenerator.removeIndexQuery('myTable', 'user_foo_bar', {
          cascade: true,
          concurrently: true,
        }),
      {
        default: buildInvalidOptionReceivedError('removeIndexQuery', dialect.name, [
          'cascade',
          'concurrently',
        ]),
        postgres: new Error(
          'Cannot specify both concurrently and cascade options in removeIndexQuery.',
        ),
        snowflake: notSupportedError,
      },
    );
  });

  it('produces a DROP INDEX query from a model', () => {
    const MyModel = sequelize.define('MyModel', {});

    expectsql(() => queryGenerator.removeIndexQuery(MyModel, 'user_foo_bar'), {
      default: `DROP INDEX [user_foo_bar] ON [MyModels]`,
      snowflake: notSupportedError,
      'db2 ibmi postgres sqlite3': `DROP INDEX [user_foo_bar]`,
    });
  });

  it('produces a DROP INDEX query from a model definition', () => {
    const MyModel = sequelize.define('MyModel', {});
    const myDefinition = MyModel.modelDefinition;

    expectsql(() => queryGenerator.removeIndexQuery(myDefinition, 'user_foo_bar'), {
      default: `DROP INDEX [user_foo_bar] ON [MyModels]`,
      snowflake: notSupportedError,
      'db2 ibmi postgres sqlite3': `DROP INDEX [user_foo_bar]`,
    });
  });

  it('produces a DROP INDEX query from a table and schema', () => {
    expectsql(
      () =>
        queryGenerator.removeIndexQuery(
          { tableName: 'myTable', schema: 'mySchema' },
          'user_foo_bar',
        ),
      {
        default: `DROP INDEX [user_foo_bar] ON [mySchema].[myTable]`,
        sqlite3: 'DROP INDEX `user_foo_bar`',
        snowflake: notSupportedError,
        'db2 ibmi postgres': `DROP INDEX "mySchema"."user_foo_bar"`,
      },
    );
  });

  it('produces a DROP INDEX query from a table and default schema', () => {
    expectsql(
      () =>
        queryGenerator.removeIndexQuery(
          { tableName: 'myTable', schema: dialect.getDefaultSchema() },
          'user_foo_bar',
        ),
      {
        default: `DROP INDEX [user_foo_bar] ON [myTable]`,
        snowflake: notSupportedError,
        'db2 ibmi postgres sqlite3': `DROP INDEX [user_foo_bar]`,
      },
    );
  });

  it('produces a DROP INDEX query from a table and globally set schema', () => {
    const sequelizeSchema = createSequelizeInstance({ schema: 'mySchema' });
    const queryGeneratorSchema = sequelizeSchema.queryGenerator;

    expectsql(() => queryGeneratorSchema.removeIndexQuery('myTable', 'user_foo_bar'), {
      default: `DROP INDEX [user_foo_bar] ON [mySchema].[myTable]`,
      sqlite3: 'DROP INDEX `user_foo_bar`',
      snowflake: notSupportedError,
      'db2 ibmi postgres': `DROP INDEX "mySchema"."user_foo_bar"`,
    });
  });
});
