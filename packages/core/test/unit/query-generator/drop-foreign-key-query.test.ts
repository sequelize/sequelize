import { createSequelizeInstance, expectsql, sequelize } from '../../support';

const dialect = sequelize.dialect;

describe('QueryGenerator#dropForeignKeyQuery', () => {
  const queryGenerator = sequelize.getQueryInterface().queryGenerator;

  it('produces a query to drop a foreign key', () => {
    expectsql(() => queryGenerator.dropForeignKeyQuery('myTable', 'myColumnKey'), {
      default: 'ALTER TABLE [myTable] DROP FOREIGN KEY [myColumnKey];',
      postgres: 'ALTER TABLE "myTable" DROP CONSTRAINT "myColumnKey";',
      mssql: 'ALTER TABLE [myTable] DROP [myColumnKey]',
    });
  });

  it('produces a query to drop a foreign key from a model', () => {
    const MyModel = sequelize.define('MyModel', {});

    expectsql(() => queryGenerator.dropForeignKeyQuery(MyModel, 'myColumnKey'), {
      default: 'ALTER TABLE [MyModels] DROP FOREIGN KEY [myColumnKey];',
      postgres: 'ALTER TABLE "MyModels" DROP CONSTRAINT "myColumnKey";',
      mssql: 'ALTER TABLE [MyModels] DROP [myColumnKey]',
    });
  });

  it('produces a query to drop a foreign key with schema in tableName object', () => {
    expectsql(() => queryGenerator.dropForeignKeyQuery({ tableName: 'myTable', schema: 'mySchema' }, 'myColumnKey'), {
      default: 'ALTER TABLE [mySchema].[myTable] DROP FOREIGN KEY [myColumnKey];',
      postgres: 'ALTER TABLE "mySchema"."myTable" DROP CONSTRAINT "myColumnKey";',
      mssql: 'ALTER TABLE [mySchema].[myTable] DROP [myColumnKey]',
      sqlite: 'ALTER TABLE `mySchema.myTable` DROP FOREIGN KEY `myColumnKey`;',
    });
  });

  it('produces a query to drop a foreign key with default schema in tableName object', () => {
    expectsql(() => queryGenerator.dropForeignKeyQuery({ tableName: 'myTable', schema: dialect.getDefaultSchema() }, 'myColumnKey'), {
      default: 'ALTER TABLE [myTable] DROP FOREIGN KEY [myColumnKey];',
      postgres: 'ALTER TABLE "myTable" DROP CONSTRAINT "myColumnKey";',
      mssql: 'ALTER TABLE [myTable] DROP [myColumnKey]',
    });
  });

  it('produces a query to drop a foreign key from a table and globally set schema', () => {
    const sequelizeSchema = createSequelizeInstance({ schema: 'mySchema' });
    const queryGeneratorSchema = sequelizeSchema.getQueryInterface().queryGenerator;

    expectsql(() => queryGeneratorSchema.dropForeignKeyQuery('myTable', 'myColumnKey'), {
      default: 'ALTER TABLE [mySchema].[myTable] DROP FOREIGN KEY [myColumnKey];',
      postgres: 'ALTER TABLE "mySchema"."myTable" DROP CONSTRAINT "myColumnKey";',
      mssql: 'ALTER TABLE [mySchema].[myTable] DROP [myColumnKey]',
      sqlite: 'ALTER TABLE `mySchema.myTable` DROP FOREIGN KEY `myColumnKey`;',
    });
  });

  it('produces a query to drop a foreign key with schema and custom schemaDelimiter argument', () => {
    // This test is only relevant for dialects that do not support schemas
    if (dialect.supports.schemas) {
      return;
    }

    expectsql(() => queryGenerator.dropForeignKeyQuery({ tableName: 'myTable', schema: 'mySchema', delimiter: 'custom' }, 'myColumnKey'), {
      sqlite: 'ALTER TABLE `mySchemacustommyTable` DROP FOREIGN KEY `myColumnKey`;',
    });
  });
});
