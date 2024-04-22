import { buildInvalidOptionReceivedError } from '@sequelize/core/_non-semver-use-at-your-own-risk_/utils/check.js';
import { createSequelizeInstance, expectsql, getTestDialect, sequelize } from '../../support';

const dialect = sequelize.dialect;
const dialectName = getTestDialect();
const notSupportedError = new Error(`removeColumnQuery is not supported in ${dialectName}.`);

describe('QueryGenerator#removeColumnQuery', () => {
  const queryGenerator = sequelize.queryGenerator;

  it('generates a query that drops a column', () => {
    expectsql(() => queryGenerator.removeColumnQuery('myTable', 'myColumn'), {
      default: 'ALTER TABLE [myTable] DROP COLUMN [myColumn]',
      sqlite3: notSupportedError,
    });
  });

  it('generates a query that drops a column with cascade', () => {
    expectsql(() => queryGenerator.removeColumnQuery('myTable', 'myColumn', { cascade: true }), {
      default: buildInvalidOptionReceivedError('removeColumnQuery', dialectName, ['cascade']),
      'db2 ibmi postgres': 'ALTER TABLE [myTable] DROP COLUMN [myColumn] CASCADE',
      sqlite3: notSupportedError,
    });
  });

  it('generates a query that drops a column with ifExists', () => {
    expectsql(() => queryGenerator.removeColumnQuery('myTable', 'myColumn', { ifExists: true }), {
      default: buildInvalidOptionReceivedError('removeColumnQuery', dialectName, ['ifExists']),
      'mariadb mssql postgres': 'ALTER TABLE [myTable] DROP COLUMN IF EXISTS [myColumn]',
      sqlite3: notSupportedError,
    });
  });

  it('generates a query that drops a column from a model', () => {
    const MyModel = sequelize.define('MyModel', {});

    expectsql(() => queryGenerator.removeColumnQuery(MyModel, 'myColumn'), {
      default: 'ALTER TABLE [MyModels] DROP COLUMN [myColumn]',
      sqlite3: notSupportedError,
    });
  });

  it('generates a query that drops a column from a model definition', () => {
    const MyModel = sequelize.define('MyModel', {});
    const myDefinition = MyModel.modelDefinition;

    expectsql(() => queryGenerator.removeColumnQuery(myDefinition, 'myColumn'), {
      default: 'ALTER TABLE [MyModels] DROP COLUMN [myColumn]',
      sqlite3: notSupportedError,
    });
  });

  it('generates a query that drops a column with schema', () => {
    expectsql(
      () =>
        queryGenerator.removeColumnQuery({ tableName: 'myTable', schema: 'mySchema' }, 'myColumn'),
      {
        default: 'ALTER TABLE [mySchema].[myTable] DROP COLUMN [myColumn]',
        sqlite3: notSupportedError,
      },
    );
  });

  it('generates a query that drops a column with default schema', () => {
    expectsql(
      () =>
        queryGenerator.removeColumnQuery(
          { tableName: 'myTable', schema: dialect.getDefaultSchema() },
          'myColumn',
        ),
      {
        default: 'ALTER TABLE [myTable] DROP COLUMN [myColumn]',
        sqlite3: notSupportedError,
      },
    );
  });

  it('generates a query that drops a column from a table and globally set schema', () => {
    const sequelizeSchema = createSequelizeInstance({ schema: 'mySchema' });
    const queryGeneratorSchema = sequelizeSchema.queryGenerator;

    expectsql(() => queryGeneratorSchema.removeColumnQuery('myTable', 'myColumn'), {
      default: 'ALTER TABLE [mySchema].[myTable] DROP COLUMN [myColumn]',
      sqlite3: notSupportedError,
    });
  });

  it('generates a query that drops a column with schema and custom delimiter argument', () => {
    // This test is only relevant for dialects that do not support schemas
    if (dialect.supports.schemas) {
      return;
    }

    expectsql(
      () =>
        queryGenerator.removeColumnQuery(
          { tableName: 'myTable', schema: 'mySchema', delimiter: 'custom' },
          'myColumn',
        ),
      {
        sqlite3: notSupportedError,
      },
    );
  });
});
