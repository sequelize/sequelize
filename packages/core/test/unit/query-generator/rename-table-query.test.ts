import { createSequelizeInstance, expectsql, sequelize } from '../../support';

const dialect = sequelize.dialect;

describe('QueryGenerator#renameTableQuery', () => {
  const queryGenerator = sequelize.queryGenerator;

  it('produces a query that renames the table', () => {
    expectsql(() => queryGenerator.renameTableQuery('oldTable', 'newTable'), {
      default: 'ALTER TABLE [oldTable] RENAME TO [newTable];',
      mssql: 'EXEC sp_rename [oldTable], [newTable];',
      'db2 ibmi': 'RENAME TABLE "oldTable" TO "newTable";',
    });
  });

  it('produces a query that renames the table from a model', () => {
    const OldModel = sequelize.define('oldModel', {});
    const NewModel = sequelize.define('newModel', {});

    expectsql(() => queryGenerator.renameTableQuery(OldModel, NewModel), {
      default: 'ALTER TABLE [oldModels] RENAME TO [newModels];',
      mssql: 'EXEC sp_rename [oldModels], [newModels];',
      'db2 ibmi': 'RENAME TABLE "oldModels" TO "newModels";',
    });
  });

  it('produces a query that renames the table with schema', () => {
    expectsql(() => queryGenerator.renameTableQuery({ tableName: 'oldTable', schema: 'oldSchema' }, { tableName: 'newTable', schema: 'newSchema' }), {
      default: 'ALTER TABLE [oldSchema].[oldTable] RENAME TO [newSchema].[newTable];',
      mssql: 'EXEC sp_rename [oldSchema].[oldTable], [newSchema].[newTable];',
      sqlite: 'ALTER TABLE `oldSchema.oldTable` RENAME TO `newSchema.newTable`;',
      'db2 ibmi': 'RENAME TABLE "oldSchema"."oldTable" TO "newSchema"."newTable";',
    });
  });

  it('produces a query that renames the table with default schema', () => {
    expectsql(() => queryGenerator.renameTableQuery({ tableName: 'oldTable', schema: dialect.getDefaultSchema() }, { tableName: 'newTable', schema: dialect.getDefaultSchema() }), {
      default: 'ALTER TABLE [oldTable] RENAME TO [newTable];',
      mssql: 'EXEC sp_rename [oldTable], [newTable];',
      'db2 ibmi': 'RENAME TABLE "oldTable" TO "newTable";',
    });
  });

  it('produces a query that renames the table from a table and globally set schema', () => {
    const sequelizeSchema = createSequelizeInstance({ schema: 'mySchema' });
    const queryGeneratorSchema = sequelizeSchema.queryGenerator;

    expectsql(() => queryGeneratorSchema.renameTableQuery('oldTable', 'newTable'), {
      default: 'ALTER TABLE [mySchema].[oldTable] RENAME TO [mySchema].[newTable];',
      mssql: 'EXEC sp_rename [mySchema].[oldTable], [mySchema].[newTable];',
      sqlite: 'ALTER TABLE `mySchema.oldTable` RENAME TO `mySchema.newTable`;',
      'db2 ibmi': 'RENAME TABLE "mySchema"."oldTable" TO "mySchema"."newTable";',
    });
  });

  it('produces a query that renames the table with schema and custom delimiter argument', () => {
    // This test is only relevant for dialects that do not support schemas
    if (dialect.supports.schemas) {
      return;
    }

    expectsql(() => queryGenerator.renameTableQuery({ tableName: 'oldTable', schema: 'oldSchema', delimiter: 'custom' }, { tableName: 'newTable', schema: 'newSchema', delimiter: 'custom' }), {
      sqlite: 'ALTER TABLE `oldSchemacustomoldTable` RENAME TO `newSchemacustomnewTable`;',
    });
  });
});
