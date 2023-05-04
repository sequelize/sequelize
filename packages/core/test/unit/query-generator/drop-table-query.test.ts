import { buildInvalidOptionReceivedError } from '@sequelize/core/_non-semver-use-at-your-own-risk_/utils/check.js';
import { createSequelizeInstance, expectsql, getTestDialect, sequelize } from '../../support';

const dialectName = getTestDialect();
const dialect = sequelize.dialect;

describe('QueryGenerator#dropTableQuery', () => {
  const queryGenerator = sequelize.getQueryInterface().queryGenerator;

  it('produces a query that drops a table', () => {
    expectsql(() => queryGenerator.dropTableQuery('myTable'), {
      default: `DROP TABLE IF EXISTS [myTable];`,
      mssql: `IF OBJECT_ID('[myTable]', 'U') IS NOT NULL DROP TABLE [myTable];`,
    });
  });

  it('produces a query that drops a table with cascade', () => {
    expectsql(() => queryGenerator.dropTableQuery('myTable', { cascade: true }), {
      default: buildInvalidOptionReceivedError('dropTableQuery', dialectName, ['cascade']),
      postgres: `DROP TABLE IF EXISTS "myTable" CASCADE;`,
    });
  });

  it('produces a query that drops a table from a model', () => {
    const MyModel = sequelize.define('MyModel', {});

    expectsql(() => queryGenerator.dropTableQuery(MyModel), {
      default: `DROP TABLE IF EXISTS [MyModels];`,
      mssql: `IF OBJECT_ID('[MyModels]', 'U') IS NOT NULL DROP TABLE [MyModels];`,
    });
  });

  it('produces a query that drops a table with schema', () => {
    expectsql(() => queryGenerator.dropTableQuery({ tableName: 'myTable', schema: 'mySchema' }), {
      default: `DROP TABLE IF EXISTS [mySchema].[myTable];`,
      mssql: `IF OBJECT_ID('[mySchema].[myTable]', 'U') IS NOT NULL DROP TABLE [mySchema].[myTable];`,
      sqlite: 'DROP TABLE IF EXISTS `mySchema.myTable`;',
    });
  });

  it('produces a query that drops a table with default schema', () => {
    expectsql(() => queryGenerator.dropTableQuery({ tableName: 'myTable', schema: dialect.getDefaultSchema() }), {
      default: `DROP TABLE IF EXISTS [myTable];`,
      mssql: `IF OBJECT_ID('[myTable]', 'U') IS NOT NULL DROP TABLE [myTable];`,
    });
  });

  it('produces a query that drops a table from a table and globally set schema', () => {
    const sequelizeSchema = createSequelizeInstance({ schema: 'mySchema' });
    const queryGeneratorSchema = sequelizeSchema.getQueryInterface().queryGenerator;

    expectsql(() => queryGeneratorSchema.dropTableQuery('myTable'), {
      default: `DROP TABLE IF EXISTS [mySchema].[myTable];`,
      mssql: `IF OBJECT_ID('[mySchema].[myTable]', 'U') IS NOT NULL DROP TABLE [mySchema].[myTable];`,
      sqlite: 'DROP TABLE IF EXISTS `mySchema.myTable`;',
    });
  });

  it('produces a query that drops a table with schema and custom delimiter argument', () => {
    // This test is only relevant for dialects that do not support schemas
    if (dialect.supports.schemas) {
      return;
    }

    expectsql(() => queryGenerator.dropTableQuery({ tableName: 'myTable', schema: 'mySchema', delimiter: 'custom' }), {
      sqlite: 'DROP TABLE IF EXISTS `mySchemacustommyTable`;',
    });
  });
});
