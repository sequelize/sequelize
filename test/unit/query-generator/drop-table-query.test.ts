import { buildInvalidOptionReceivedError } from '@sequelize/core/_non-semver-use-at-your-own-risk_/utils/check.js';
import { createSequelizeInstance, expectsql, getTestDialect, sequelize } from '../../support';

const dialectName = getTestDialect();
const dialect = sequelize.dialect;

describe('QueryGenerator#dropTableQuery', () => {
  const queryGenerator = sequelize.getQueryInterface().queryGenerator;

  it('produces a DROP TABLE query', () => {
    expectsql(() => queryGenerator.dropTableQuery('myTable'), {
      default: `DROP TABLE IF EXISTS [myTable];`,
      mssql: `IF OBJECT_ID('[myTable]', 'U') IS NOT NULL DROP TABLE [myTable];`,
    });
  });

  it('produces a DROP TABLE query with cascade', () => {
    expectsql(() => queryGenerator.dropTableQuery('myTable', { cascade: true }), {
      default: buildInvalidOptionReceivedError('dropTableQuery', dialectName, ['cascade']),
      postgres: `DROP TABLE IF EXISTS "myTable" CASCADE;`,
    });
  });

  it('produces a DROP TABLE query with schema', () => {
    expectsql(() => queryGenerator.dropTableQuery({ tableName: 'myTable', schema: 'mySchema' }), {
      default: `DROP TABLE IF EXISTS [mySchema].[myTable];`,
      mssql: `IF OBJECT_ID('[mySchema].[myTable]', 'U') IS NOT NULL DROP TABLE [mySchema].[myTable];`,
      sqlite: 'DROP TABLE IF EXISTS `mySchema.myTable`;',
    });
  });

  it('produces a DROP TABLE query with default schema', () => {
    expectsql(() => queryGenerator.dropTableQuery({ tableName: 'myTable', schema: dialect.getDefaultSchema() }), {
      default: `DROP TABLE IF EXISTS [myTable];`,
      mssql: `IF OBJECT_ID('[myTable]', 'U') IS NOT NULL DROP TABLE [myTable];`,
    });
  });

  it('produces a DROP TABLE query from a table and globally set schema', () => {
    const sequelizeSchema = createSequelizeInstance({ schema: 'mySchema' });
    const queryGeneratorSchema = sequelizeSchema.getQueryInterface().queryGenerator;

    expectsql(() => queryGeneratorSchema.dropTableQuery('myTable'), {
      default: `DROP TABLE IF EXISTS [mySchema].[myTable];`,
      mssql: `IF OBJECT_ID('[mySchema].[myTable]', 'U') IS NOT NULL DROP TABLE [mySchema].[myTable];`,
      sqlite: 'DROP TABLE IF EXISTS `mySchema.myTable`;',
    });
  });

  it('produces a DROP TABLE query with schema and cascade', () => {
    expectsql(() => queryGenerator.dropTableQuery({ tableName: 'myTable', schema: 'mySchema' }, { cascade: true }), {
      default: buildInvalidOptionReceivedError('dropTableQuery', dialectName, ['cascade']),
      postgres: `DROP TABLE IF EXISTS "mySchema"."myTable" CASCADE;`,
    });
  });
});
