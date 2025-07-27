import { buildInvalidOptionReceivedError } from '@sequelize/core/_non-semver-use-at-your-own-risk_/utils/check.js';
import { createSequelizeInstance, expectPerDialect, sequelize } from '../../support';

const dialect = sequelize.dialect;

describe('QueryGenerator#truncateTableQuery', () => {
  const queryGenerator = sequelize.queryGenerator;

  it('produces a TRUNCATE TABLE query for a table', () => {
    expectPerDialect(() => queryGenerator.truncateTableQuery('myTable'), {
      mssql: 'TRUNCATE TABLE [myTable]',
      sqlite3: ['DELETE FROM `myTable`'],
      'db2 ibmi': 'TRUNCATE TABLE "myTable" IMMEDIATE',
      'mariadb mysql': 'TRUNCATE `myTable`',
      'postgres snowflake': 'TRUNCATE "myTable"',
    });
  });

  it('produces a TRUNCATE TABLE query with CASCADE for a table', () => {
    expectPerDialect(() => queryGenerator.truncateTableQuery('myTable', { cascade: true }), {
      default: buildInvalidOptionReceivedError('truncateTableQuery', dialect.name, ['cascade']),
      postgres: `TRUNCATE "myTable" CASCADE`,
    });
  });

  it('produces a TRUNCATE TABLE query with RESTART IDENTITY for a table', () => {
    expectPerDialect(
      () => queryGenerator.truncateTableQuery('myTable', { restartIdentity: true }),
      {
        default: buildInvalidOptionReceivedError('truncateTableQuery', dialect.name, [
          'restartIdentity',
        ]),
        sqlite3: [
          'DELETE FROM `myTable`',
          "DELETE FROM `sqlite_sequence` WHERE `name` = 'myTable'",
        ],
        postgres: `TRUNCATE "myTable" RESTART IDENTITY`,
      },
    );
  });

  it('produces a TRUNCATE TABLE query with CASCADE and RESTART IDENTITY query for a table', () => {
    expectPerDialect(
      () => queryGenerator.truncateTableQuery('myTable', { cascade: true, restartIdentity: true }),
      {
        default: buildInvalidOptionReceivedError('truncateTableQuery', dialect.name, [
          'cascade',
          'restartIdentity',
        ]),
        sqlite3: buildInvalidOptionReceivedError('truncateTableQuery', dialect.name, ['cascade']),
        postgres: `TRUNCATE "myTable" RESTART IDENTITY CASCADE`,
      },
    );
  });

  it('produces a TRUNCATE TABLE query for a model', () => {
    const MyModel = sequelize.define('MyModel', {});

    expectPerDialect(() => queryGenerator.truncateTableQuery(MyModel), {
      mssql: 'TRUNCATE TABLE [MyModels]',
      sqlite3: ['DELETE FROM `MyModels`'],
      'db2 ibmi': 'TRUNCATE TABLE "MyModels" IMMEDIATE',
      'mariadb mysql': 'TRUNCATE `MyModels`',
      'postgres snowflake': 'TRUNCATE "MyModels"',
    });
  });

  it('produces a TRUNCATE TABLE query for a model definition', () => {
    const MyModel = sequelize.define('MyModel', {});
    const myDefinition = MyModel.modelDefinition;

    expectPerDialect(() => queryGenerator.truncateTableQuery(myDefinition), {
      mssql: 'TRUNCATE TABLE [MyModels]',
      sqlite3: ['DELETE FROM `MyModels`'],
      'db2 ibmi': 'TRUNCATE TABLE "MyModels" IMMEDIATE',
      'mariadb mysql': 'TRUNCATE `MyModels`',
      'postgres snowflake': 'TRUNCATE "MyModels"',
    });
  });

  it('produces a TRUNCATE TABLE query from a table and schema', () => {
    expectPerDialect(
      () => queryGenerator.truncateTableQuery({ tableName: 'myTable', schema: 'mySchema' }),
      {
        mssql: 'TRUNCATE TABLE [mySchema].[myTable]',
        sqlite3: ['DELETE FROM `mySchema.myTable`'],
        'db2 ibmi': 'TRUNCATE TABLE "mySchema"."myTable" IMMEDIATE',
        'mariadb mysql': 'TRUNCATE `mySchema`.`myTable`',
        'postgres snowflake': 'TRUNCATE "mySchema"."myTable"',
      },
    );
  });

  it('produces a TRUNCATE TABLE query from a table and default schema', () => {
    expectPerDialect(
      () =>
        queryGenerator.truncateTableQuery({
          tableName: 'myTable',
          schema: dialect.getDefaultSchema(),
        }),
      {
        mssql: 'TRUNCATE TABLE [myTable]',
        sqlite3: ['DELETE FROM `myTable`'],
        'db2 ibmi': 'TRUNCATE TABLE "myTable" IMMEDIATE',
        'mariadb mysql': 'TRUNCATE `myTable`',
        'postgres snowflake': 'TRUNCATE "myTable"',
      },
    );
  });

  it('produces a TRUNCATE TABLE query from a table and globally set schema', () => {
    const sequelizeSchema = createSequelizeInstance({ schema: 'mySchema' });
    const queryGeneratorSchema = sequelizeSchema.queryGenerator;

    expectPerDialect(() => queryGeneratorSchema.truncateTableQuery('myTable'), {
      mssql: 'TRUNCATE TABLE [mySchema].[myTable]',
      sqlite3: ['DELETE FROM `mySchema.myTable`'],
      'db2 ibmi': 'TRUNCATE TABLE "mySchema"."myTable" IMMEDIATE',
      'mariadb mysql': 'TRUNCATE `mySchema`.`myTable`',
      'postgres snowflake': 'TRUNCATE "mySchema"."myTable"',
    });
  });

  it('produces a TRUNCATE TABLE query for a table with schema and custom delimiter argument', () => {
    // This test is only relevant for dialects that do not support schemas
    if (dialect.supports.schemas) {
      return;
    }

    expectPerDialect(
      () =>
        queryGenerator.truncateTableQuery({
          tableName: 'myTable',
          schema: 'mySchema',
          delimiter: 'custom',
        }),
      {
        sqlite3: ['DELETE FROM `mySchemacustommyTable`'],
      },
    );
  });

  it('produces a TRUNCATE TABLE query with RESTART IDENTITY for a table with schema and custom delimiter argument', () => {
    // This test is only relevant for dialects that do not support schemas
    if (dialect.supports.schemas) {
      return;
    }

    expectPerDialect(
      () =>
        queryGenerator.truncateTableQuery(
          { tableName: 'myTable', schema: 'mySchema', delimiter: 'custom' },
          { restartIdentity: true },
        ),
      {
        sqlite3: [
          'DELETE FROM `mySchemacustommyTable`',
          "DELETE FROM `sqlite_sequence` WHERE `name` = 'mySchemacustommyTable'",
        ],
      },
    );
  });
});
