import { buildInvalidOptionReceivedError } from '@sequelize/core/_non-semver-use-at-your-own-risk_/utils/check.js';
import { createSequelizeInstance, expectsql, sequelize } from '../../support';

const dialect = sequelize.dialect;

const notImplementedError = new Error(
  `removeIndexQuery has not been implemented in ${dialect.name}.`,
);

describe('QueryGenerator#removeIndexQuery', () => {
  const queryGenerator = sequelize.queryGenerator;

  it('produces a DROP INDEX query from a table', () => {
    expectsql(() => queryGenerator.removeIndexQuery('myTable', 'user_foo_bar'), {
      default: `DROP INDEX [user_foo_bar] ON [myTable]`,
      sqlite3: 'DROP INDEX `user_foo_bar`',
      ibmi: `BEGIN DROP INDEX "user_foo_bar"; COMMIT; END`,
      db2: `DROP INDEX "user_foo_bar"`,
      postgres: `DROP INDEX "public"."user_foo_bar"`,
      snowflake: notImplementedError,
    });
  });

  it('produces a DROP INDEX query from a table with attributes', () => {
    expectsql(() => queryGenerator.removeIndexQuery('myTable', ['foo', 'bar']), {
      default: `DROP INDEX [my_table_foo_bar] ON [myTable]`,
      sqlite3: 'DROP INDEX `my_table_foo_bar`',
      ibmi: `BEGIN DROP INDEX "my_table_foo_bar"; COMMIT; END`,
      db2: `DROP INDEX "my_table_foo_bar"`,
      postgres: `DROP INDEX "public"."my_table_foo_bar"`,
      snowflake: notImplementedError,
    });
  });

  it('produces a DROP INDEX with CONCURRENTLY query from a table', () => {
    expectsql(
      () => queryGenerator.removeIndexQuery('myTable', 'user_foo_bar', { concurrently: true }),
      {
        default: buildInvalidOptionReceivedError('removeIndexQuery', dialect.name, [
          'concurrently',
        ]),
        postgres: `DROP INDEX CONCURRENTLY "public"."user_foo_bar"`,
        snowflake: notImplementedError,
      },
    );
  });

  it('produces a DROP INDEX with IF EXISTS query from a table', () => {
    expectsql(
      () => queryGenerator.removeIndexQuery('myTable', 'user_foo_bar', { ifExists: true }),
      {
        default: `DROP INDEX IF EXISTS [user_foo_bar] ON [myTable]`,
        sqlite3: 'DROP INDEX IF EXISTS `user_foo_bar`',
        postgres: `DROP INDEX IF EXISTS "public"."user_foo_bar"`,
        ibmi: `BEGIN IF EXISTS (SELECT * FROM QSYS2.SYSINDEXES WHERE INDEX_NAME = "user_foo_bar") THEN DROP INDEX "user_foo_bar"; COMMIT; END IF; END`,
        snowflake: notImplementedError,
        'db2 mysql': buildInvalidOptionReceivedError('removeIndexQuery', dialect.name, [
          'ifExists',
        ]),
      },
    );
  });

  it('produces a DROP INDEX with CASCADE query from a table', () => {
    expectsql(() => queryGenerator.removeIndexQuery('myTable', 'user_foo_bar', { cascade: true }), {
      default: buildInvalidOptionReceivedError('removeIndexQuery', dialect.name, ['cascade']),
      postgres: `DROP INDEX "public"."user_foo_bar" CASCADE`,
      snowflake: notImplementedError,
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
        default: `DROP INDEX IF EXISTS [user_foo_bar] ON [myTable] CASCADE`,
        postgres: `DROP INDEX IF EXISTS "public"."user_foo_bar" CASCADE`,
        snowflake: notImplementedError,
        'db2 mysql': buildInvalidOptionReceivedError('removeIndexQuery', dialect.name, [
          'cascade',
          'ifExists',
        ]),
        'ibmi mariadb mssql sqlite3': buildInvalidOptionReceivedError(
          'removeIndexQuery',
          dialect.name,
          ['cascade'],
        ),
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
        default: `DROP INDEX CONCURRENTLY IF EXISTS [user_foo_bar] ON [myTable]`,
        postgres: `DROP INDEX CONCURRENTLY IF EXISTS "public"."user_foo_bar"`,
        snowflake: notImplementedError,
        'db2 mysql': buildInvalidOptionReceivedError('removeIndexQuery', dialect.name, [
          'concurrently',
          'ifExists',
        ]),
        'ibmi mariadb mssql sqlite3': buildInvalidOptionReceivedError(
          'removeIndexQuery',
          dialect.name,
          ['concurrently'],
        ),
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
          `Cannot specify both concurrently and cascade options in removeIndexQuery for ${dialect.name} dialect`,
        ),
        snowflake: notImplementedError,
      },
    );
  });

  it('produces a DROP INDEX query from a model', () => {
    const MyModel = sequelize.define('MyModel', {});

    expectsql(() => queryGenerator.removeIndexQuery(MyModel, 'user_foo_bar'), {
      default: `DROP INDEX [user_foo_bar] ON [MyModels]`,
      sqlite3: 'DROP INDEX `user_foo_bar`',
      ibmi: `BEGIN DROP INDEX "user_foo_bar"; COMMIT; END`,
      db2: `DROP INDEX "user_foo_bar"`,
      postgres: `DROP INDEX "public"."user_foo_bar"`,
      snowflake: notImplementedError,
    });
  });

  it('produces a DROP INDEX query from a model definition', () => {
    const MyModel = sequelize.define('MyModel', {});
    const myDefinition = MyModel.modelDefinition;

    expectsql(() => queryGenerator.removeIndexQuery(myDefinition, 'user_foo_bar'), {
      default: `DROP INDEX [user_foo_bar] ON [MyModels]`,
      sqlite3: 'DROP INDEX `user_foo_bar`',
      ibmi: `BEGIN DROP INDEX "user_foo_bar"; COMMIT; END`,
      db2: `DROP INDEX "user_foo_bar"`,
      postgres: `DROP INDEX "public"."user_foo_bar"`,
      snowflake: notImplementedError,
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
        postgres: `DROP INDEX "mySchema"."user_foo_bar"`,
        ibmi: `BEGIN DROP INDEX "user_foo_bar"; COMMIT; END`,
        db2: `DROP INDEX "user_foo_bar"`,
        snowflake: notImplementedError,
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
        sqlite3: 'DROP INDEX `user_foo_bar`',
        ibmi: `BEGIN DROP INDEX "user_foo_bar"; COMMIT; END`,
        db2: `DROP INDEX "user_foo_bar"`,
        postgres: `DROP INDEX "public"."user_foo_bar"`,
        snowflake: notImplementedError,
      },
    );
  });

  it('produces a DROP INDEX query from a table and globally set schema', () => {
    const sequelizeSchema = createSequelizeInstance({ schema: 'mySchema' });
    const queryGeneratorSchema = sequelizeSchema.queryGenerator;

    expectsql(() => queryGeneratorSchema.removeIndexQuery('myTable', 'user_foo_bar'), {
      default: `DROP INDEX [user_foo_bar] ON [mySchema].[myTable]`,
      sqlite3: 'DROP INDEX `user_foo_bar`',
      postgres: `DROP INDEX "mySchema"."user_foo_bar"`,
      ibmi: `BEGIN DROP INDEX "user_foo_bar"; COMMIT; END`,
      db2: 'DROP INDEX "user_foo_bar"',
      snowflake: notImplementedError,
    });
  });
});
