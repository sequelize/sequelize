import { buildInvalidOptionReceivedError } from '@sequelize/core/_non-semver-use-at-your-own-risk_/utils/check.js';
import { createSequelizeInstance, expectsql, getTestDialect, sequelize } from '../../support';

const dialect = sequelize.dialect;
const dialectName = getTestDialect();
const notSupportedError = new Error(`removeColumnQuery is not supported in ${dialectName}.`);

describe('QueryGenerator#removeColumnQuery', () => {
  const queryGenerator = sequelize.getQueryInterface().queryGenerator;

  it('generates a query that drops a column', () => {
    expectsql(() => queryGenerator.removeColumnQuery('myTable', 'myColumn'), {
      default: 'ALTER TABLE [myTable] DROP COLUMN [myColumn];',
      'mariadb mysql snowflake': 'ALTER TABLE [myTable] DROP [myColumn];',
      sqlite: notSupportedError,
    });
  });

  it('produces a query that drops a column with ifExists', () => {
    expectsql(() => queryGenerator.removeColumnQuery('myTable', 'myColumn', { ifExists: true }), {
      default: buildInvalidOptionReceivedError('removeColumnQuery', dialectName, ['ifExists']),
      mariadb: 'ALTER TABLE `myTable` DROP IF EXISTS `myColumn`;',
      'postgres mssql': 'ALTER TABLE [myTable] DROP COLUMN IF EXISTS [myColumn];',
      sqlite: notSupportedError,
    });
  });

  it('generates a query that drops a column from a model', () => {
    const MyModel = sequelize.define('MyModel', {});

    expectsql(() => queryGenerator.removeColumnQuery(MyModel, 'myColumn'), {
      default: 'ALTER TABLE [MyModels] DROP COLUMN [myColumn];',
      'mariadb mysql snowflake': 'ALTER TABLE [MyModels] DROP [myColumn];',
      sqlite: notSupportedError,
    });
  });

  it('generates a query that drops a column with schema', () => {
    expectsql(() => queryGenerator.removeColumnQuery({ tableName: 'myTable', schema: 'mySchema' }, 'myColumn'), {
      default: 'ALTER TABLE [mySchema].[myTable] DROP COLUMN [myColumn];',
      'mariadb mysql snowflake': 'ALTER TABLE [mySchema].[myTable] DROP [myColumn];',
      sqlite: notSupportedError,
    });
  });

  it('generates a query that drops a column with default schema', () => {
    expectsql(() => queryGenerator.removeColumnQuery({ tableName: 'myTable', schema: dialect.getDefaultSchema() }, 'myColumn'), {
      default: 'ALTER TABLE [myTable] DROP COLUMN [myColumn];',
      'mariadb mysql snowflake': 'ALTER TABLE [myTable] DROP [myColumn];',
      sqlite: notSupportedError,
    });
  });

  it('generates a query that drops a column from a table and globally set schema', () => {
    const sequelizeSchema = createSequelizeInstance({ schema: 'mySchema' });
    const queryGeneratorSchema = sequelizeSchema.getQueryInterface().queryGenerator;

    expectsql(() => queryGeneratorSchema.removeColumnQuery('myTable', 'myColumn'), {
      default: 'ALTER TABLE [mySchema].[myTable] DROP COLUMN [myColumn];',
      'mariadb mysql snowflake': 'ALTER TABLE [mySchema].[myTable] DROP [myColumn];',
      sqlite: notSupportedError,
    });
  });

  it('generates a query that drops a column with schema and custom delimiter argument', () => {
    // This test is only relevant for dialects that do not support schemas
    if (dialect.supports.schemas) {
      return;
    }

    expectsql(() => queryGenerator.removeColumnQuery({ tableName: 'myTable', schema: 'mySchema', delimiter: 'custom' }, 'myColumn'), {
      sqlite: notSupportedError,
    });
  });
});
