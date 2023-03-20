import { buildInvalidOptionReceivedError } from '@sequelize/core/_non-semver-use-at-your-own-risk_/utils/check.js';
import { createSequelizeInstance, expectsql, getTestDialect, sequelize } from '../../support';

const dialect = sequelize.dialect;
const dialectName = getTestDialect();

// TODO: add additional tests and type altered behaviour for sqlite

describe('QueryGenerator#removeColumnQuery', () => {
  const queryGenerator = sequelize.getQueryInterface().queryGenerator;

  it('generates a query that drops a column', () => {
    expectsql(() => queryGenerator.removeColumnQuery('myTable', 'myColumn'), {
      default: 'ALTER TABLE [myTable] DROP COLUMN [myColumn];',
      'mariadb mysql snowflake': 'ALTER TABLE [myTable] DROP [myColumn];',
      sqlite: 'CREATE TABLE IF NOT EXISTS `myTable_backup` (`0` m, `1` y, `2` C, `3` o, `4` l, `5` u, `6` m, `7` n);INSERT INTO `myTable_backup` SELECT `0`, `1`, `2`, `3`, `4`, `5`, `6`, `7` FROM `myTable`;DROP TABLE `myTable`;ALTER TABLE `myTable_backup` RENAME TO `myTable`;',
    });
  });

  it('produces a query that drops a column with ifExists', () => {
    expectsql(() => queryGenerator.removeColumnQuery('myTable', 'myColumn', { ifExists: true }), {
      default: buildInvalidOptionReceivedError('removeColumnQuery', dialectName, ['ifExists']),
      mariadb: 'ALTER TABLE `myTable` DROP IF EXISTS `myColumn`;',
      'postgres mssql': 'ALTER TABLE [myTable] DROP COLUMN IF EXISTS [myColumn];',
    });
  });

  it('generates a query that drops a column from a model', () => {
    const MyModel = sequelize.define('myModel', {});

    expectsql(() => queryGenerator.removeColumnQuery(MyModel, 'myColumn'), {
      default: 'ALTER TABLE [myModels] DROP COLUMN [myColumn];',
      'mariadb mysql snowflake': 'ALTER TABLE [myModels] DROP [myColumn];',
      sqlite: 'CREATE TABLE IF NOT EXISTS `myModels_backup` (`0` m, `1` y, `2` C, `3` o, `4` l, `5` u, `6` m, `7` n);INSERT INTO `myModels_backup` SELECT `0`, `1`, `2`, `3`, `4`, `5`, `6`, `7` FROM `myModels`;DROP TABLE `myModels`;ALTER TABLE `myModels_backup` RENAME TO `myModels`;',
    });
  });

  it('generates a query that drops a column with schems', () => {
    expectsql(() => queryGenerator.removeColumnQuery({ tableName: 'myTable', schema: 'mySchema' }, 'myColumn'), {
      default: 'ALTER TABLE [mySchema].[myTable] DROP COLUMN [myColumn];',
      'mariadb mysql snowflake': 'ALTER TABLE [mySchema].[myTable] DROP [myColumn];',
      sqlite: 'CREATE TABLE IF NOT EXISTS `mySchema.myTable_backup` (`0` m, `1` y, `2` C, `3` o, `4` l, `5` u, `6` m, `7` n);INSERT INTO `mySchema.myTable_backup` SELECT `0`, `1`, `2`, `3`, `4`, `5`, `6`, `7` FROM `mySchema.myTable`;DROP TABLE `mySchema.myTable`;ALTER TABLE `mySchema.myTable_backup` RENAME TO `mySchema.myTable`;',
    });
  });

  it('generates a query that drops a column with default schema', () => {
    expectsql(() => queryGenerator.removeColumnQuery({ tableName: 'myTable', schema: dialect.getDefaultSchema() }, 'myColumn'), {
      default: 'ALTER TABLE [myTable] DROP COLUMN [myColumn];',
      'mariadb mysql snowflake': 'ALTER TABLE [myTable] DROP [myColumn];',
      sqlite: 'CREATE TABLE IF NOT EXISTS `myTable_backup` (`0` m, `1` y, `2` C, `3` o, `4` l, `5` u, `6` m, `7` n);INSERT INTO `myTable_backup` SELECT `0`, `1`, `2`, `3`, `4`, `5`, `6`, `7` FROM `myTable`;DROP TABLE `myTable`;ALTER TABLE `myTable_backup` RENAME TO `myTable`;',
    });
  });

  it('generates a query that drops a column from a table and globally set schema', () => {
    const sequelizeSchema = createSequelizeInstance({ schema: 'mySchema' });
    const queryGeneratorSchema = sequelizeSchema.getQueryInterface().queryGenerator;

    expectsql(() => queryGeneratorSchema.removeColumnQuery('myTable', 'myColumn'), {
      default: 'ALTER TABLE [mySchema].[myTable] DROP COLUMN [myColumn];',
      'mariadb mysql snowflake': 'ALTER TABLE [mySchema].[myTable] DROP [myColumn];',
      sqlite: 'CREATE TABLE IF NOT EXISTS `mySchema.myTable_backup` (`0` m, `1` y, `2` C, `3` o, `4` l, `5` u, `6` m, `7` n);INSERT INTO `mySchema.myTable_backup` SELECT `0`, `1`, `2`, `3`, `4`, `5`, `6`, `7` FROM `mySchema.myTable`;DROP TABLE `mySchema.myTable`;ALTER TABLE `mySchema.myTable_backup` RENAME TO `mySchema.myTable`;',
    });
  });

  it('generates a query that drops a column with schema and custom delimiter argument', () => {
    // This test is only relevant for dialects that do not support schemas
    if (dialect.supports.schemas) {
      return;
    }

    expectsql(() => queryGenerator.removeColumnQuery({ tableName: 'myTable', schema: 'mySchema', delimiter: 'custom' }, 'myColumn'), {
      sqlite: 'CREATE TABLE IF NOT EXISTS `mySchema.myTable_backup` (`0` m, `1` y, `2` C, `3` o, `4` l, `5` u, `6` m, `7` n);INSERT INTO `mySchema.myTable_backup` SELECT `0`, `1`, `2`, `3`, `4`, `5`, `6`, `7` FROM `mySchemacustommyTable`;DROP TABLE `mySchemacustommyTable`;ALTER TABLE `mySchema.myTable_backup` RENAME TO `mySchemacustommyTable`;',
    });
  });
});
