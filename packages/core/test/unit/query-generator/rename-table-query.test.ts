import { buildInvalidOptionReceivedError } from '@sequelize/core/_non-semver-use-at-your-own-risk_/utils/check.js';
import { createSequelizeInstance, expectsql, sequelize } from '../../support';

const dialect = sequelize.dialect;
const changeSchemaNotSetError = new Error(
  'To move a table between schemas, you must set `options.changeSchema` to true.',
);
const moveSchemaNotSupportedError = new Error(
  `Moving tables between schemas is not supported by ${dialect.name} dialect.`,
);
const moveSchemaWithRenameNotSupportedError = new Error(
  `Renaming a table and moving it to a different schema is not supported by ${dialect.name}.`,
);

describe('QueryGenerator#renameTableQuery', () => {
  const queryGenerator = sequelize.queryGenerator;

  it('produces a query that renames the table', () => {
    expectsql(() => queryGenerator.renameTableQuery('oldTable', 'newTable'), {
      default: 'ALTER TABLE [oldTable] RENAME TO [newTable]',
      mssql: `EXEC sp_rename '[oldTable]', N'newTable'`,
      'db2 ibmi': 'RENAME TABLE "oldTable" TO "newTable"',
    });
  });

  it('produces a query that renames the table from a model', () => {
    const OldModel = sequelize.define('oldModel', {});
    const NewModel = sequelize.define('newModel', {});

    expectsql(() => queryGenerator.renameTableQuery(OldModel, NewModel), {
      default: 'ALTER TABLE [oldModels] RENAME TO [newModels]',
      mssql: `EXEC sp_rename '[oldModels]', N'newModels'`,
      'db2 ibmi': 'RENAME TABLE "oldModels" TO "newModels"',
    });
  });

  it('produces a query that renames the table from a model definition', () => {
    const OldModel = sequelize.define('oldModel', {});
    const oldDefinition = OldModel.modelDefinition;
    const NewModel = sequelize.define('newModel', {});
    const newDefinition = NewModel.modelDefinition;

    expectsql(() => queryGenerator.renameTableQuery(oldDefinition, newDefinition), {
      default: 'ALTER TABLE [oldModels] RENAME TO [newModels]',
      mssql: `EXEC sp_rename '[oldModels]', N'newModels'`,
      'db2 ibmi': 'RENAME TABLE "oldModels" TO "newModels"',
    });
  });

  it('throws an error if `options.changeSchema` is not set when moving table to another schema', () => {
    expectsql(
      () =>
        queryGenerator.renameTableQuery(
          { tableName: 'oldTable', schema: 'oldSchema' },
          { tableName: 'newTable', schema: 'newSchema' },
        ),
      {
        default: changeSchemaNotSetError,
        'db2 ibmi': moveSchemaNotSupportedError,
      },
    );
  });

  it('produces a query that moves a table to a different schema', () => {
    expectsql(
      () =>
        queryGenerator.renameTableQuery(
          { tableName: 'oldTable', schema: 'oldSchema' },
          { tableName: 'oldTable', schema: 'newSchema' },
          { changeSchema: true },
        ),
      {
        default: 'ALTER TABLE [oldSchema].[oldTable] RENAME TO [newSchema].[oldTable]',
        mssql: `ALTER SCHEMA [newSchema] TRANSFER [oldSchema].[oldTable]`,
        sqlite3: 'ALTER TABLE `oldSchema.oldTable` RENAME TO `newSchema.oldTable`',
        postgres: `ALTER TABLE "oldSchema"."oldTable" SET SCHEMA "newSchema"`,
        'db2 ibmi': buildInvalidOptionReceivedError('renameTableQuery', dialect.name, [
          'changeSchema',
        ]),
      },
    );
  });

  it('produces a query that moves a table to a different schema with a different name', () => {
    expectsql(
      () =>
        queryGenerator.renameTableQuery(
          { tableName: 'oldTable', schema: 'oldSchema' },
          { tableName: 'newTable', schema: 'newSchema' },
          { changeSchema: true },
        ),
      {
        default: 'ALTER TABLE [oldSchema].[oldTable] RENAME TO [newSchema].[newTable]',
        sqlite3: 'ALTER TABLE `oldSchema.oldTable` RENAME TO `newSchema.newTable`',
        'db2 ibmi': buildInvalidOptionReceivedError('renameTableQuery', dialect.name, [
          'changeSchema',
        ]),
        'mssql postgres': moveSchemaWithRenameNotSupportedError,
      },
    );
  });

  it('produces a query that renames the table with default schema', () => {
    expectsql(
      () =>
        queryGenerator.renameTableQuery(
          { tableName: 'oldTable', schema: dialect.getDefaultSchema() },
          { tableName: 'newTable', schema: dialect.getDefaultSchema() },
        ),
      {
        default: 'ALTER TABLE [oldTable] RENAME TO [newTable]',
        mssql: `EXEC sp_rename '[oldTable]', N'newTable'`,
        'db2 ibmi': 'RENAME TABLE "oldTable" TO "newTable"',
      },
    );
  });

  it('produces a query that renames the table from a table and globally set schema', () => {
    const sequelizeSchema = createSequelizeInstance({ schema: 'mySchema' });
    const queryGeneratorSchema = sequelizeSchema.queryGenerator;

    expectsql(() => queryGeneratorSchema.renameTableQuery('oldTable', 'newTable'), {
      default: 'ALTER TABLE [mySchema].[oldTable] RENAME TO [mySchema].[newTable]',
      mssql: `EXEC sp_rename '[mySchema].[oldTable]', N'newTable'`,
      sqlite3: 'ALTER TABLE `mySchema.oldTable` RENAME TO `mySchema.newTable`',
      postgres: `ALTER TABLE "mySchema"."oldTable" RENAME TO "newTable"`,
      'db2 ibmi': 'RENAME TABLE "mySchema"."oldTable" TO "newTable"',
    });
  });

  it('produces a query that renames the table with schema and custom delimiter argument', () => {
    // This test is only relevant for dialects that do not support schemas
    if (dialect.supports.schemas) {
      return;
    }

    expectsql(
      () =>
        queryGenerator.renameTableQuery(
          { tableName: 'oldTable', schema: 'oldSchema', delimiter: 'custom' },
          { tableName: 'newTable', schema: 'newSchema', delimiter: 'custom' },
          { changeSchema: true },
        ),
      {
        sqlite3: 'ALTER TABLE `oldSchemacustomoldTable` RENAME TO `newSchemacustomnewTable`',
      },
    );
  });
});
