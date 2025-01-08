import { buildInvalidOptionReceivedError } from '@sequelize/core/_non-semver-use-at-your-own-risk_/utils/check.js';
import { createSequelizeInstance, expectsql, getTestDialect, sequelize } from '../../support';

const dialectName = getTestDialect();
const dialect = sequelize.dialect;

describe('QueryGenerator#dropTableQuery', () => {
  const queryGenerator = sequelize.queryGenerator;

  const hanaIfExistsWrapper = (sql: string, tableName: string, schema: string) => `
    DO BEGIN DECLARE table_count INTEGER;
      SELECT COUNT(*) INTO table_count FROM TABLES WHERE TABLE_NAME = '${tableName}' AND SCHEMA_NAME = '${schema}';
      IF :table_count > 0 THEN
        ${sql};
      END IF;
    END;
  `;

  it('produces a query that drops a table', () => {
    expectsql(() => queryGenerator.dropTableQuery('myTable'), {
      default: `DROP TABLE IF EXISTS [myTable]`,
      hana: hanaIfExistsWrapper(
        'DROP TABLE "myTable"',
        'myTable', 'SYSTEM',
      ),
    });
  });

  it('produces a query that drops a table with cascade', () => {
    expectsql(() => queryGenerator.dropTableQuery('myTable', { cascade: true }), {
      default: buildInvalidOptionReceivedError('dropTableQuery', dialectName, ['cascade']),
      'postgres snowflake': `DROP TABLE IF EXISTS "myTable" CASCADE`,
      hana: hanaIfExistsWrapper(
        'DROP TABLE "myTable" CASCADE',
        'myTable', 'SYSTEM',
      ),
    });
  });

  it('produces a query that drops a table from a model', () => {
    const MyModel = sequelize.define('MyModel', {});

    expectsql(() => queryGenerator.dropTableQuery(MyModel), {
      default: `DROP TABLE IF EXISTS [MyModels]`,
      hana: hanaIfExistsWrapper(
        'DROP TABLE "MyModels"',
        'MyModels', 'SYSTEM',
      ),
    });
  });

  it('produces a query that drops a table from a model definition', () => {
    const MyModel = sequelize.define('MyModel', {});
    const myDefinition = MyModel.modelDefinition;

    expectsql(() => queryGenerator.dropTableQuery(myDefinition), {
      default: `DROP TABLE IF EXISTS [MyModels]`,
      hana: hanaIfExistsWrapper(
        'DROP TABLE "MyModels"',
        'MyModels', 'SYSTEM',
      ),
    });
  });

  it('produces a query that drops a table with schema', () => {
    expectsql(() => queryGenerator.dropTableQuery({ tableName: 'myTable', schema: 'mySchema' }), {
      default: `DROP TABLE IF EXISTS [mySchema].[myTable]`,
      sqlite3: 'DROP TABLE IF EXISTS `mySchema.myTable`',
      hana: hanaIfExistsWrapper(
        'DROP TABLE "mySchema"."myTable"',
        'myTable', 'mySchema',
      ),
    });
  });

  it('produces a query that drops a table with default schema', () => {
    expectsql(
      () =>
        queryGenerator.dropTableQuery({ tableName: 'myTable', schema: dialect.getDefaultSchema() }),
      {
        default: `DROP TABLE IF EXISTS [myTable]`,
        hana: hanaIfExistsWrapper(
          'DROP TABLE "myTable"',
          'myTable', 'SYSTEM',
        ),
      },
    );
  });

  it('produces a query that drops a table from a table and globally set schema', () => {
    const sequelizeSchema = createSequelizeInstance({ schema: 'mySchema' });
    const queryGeneratorSchema = sequelizeSchema.queryGenerator;

    expectsql(() => queryGeneratorSchema.dropTableQuery('myTable'), {
      default: `DROP TABLE IF EXISTS [mySchema].[myTable]`,
      sqlite3: 'DROP TABLE IF EXISTS `mySchema.myTable`',
      hana: hanaIfExistsWrapper(
        'DROP TABLE "mySchema"."myTable"',
        'myTable', 'mySchema',
      ),
    });
  });

  it('produces a query that drops a table with schema and custom delimiter argument', () => {
    // This test is only relevant for dialects that do not support schemas
    if (dialect.supports.schemas) {
      return;
    }

    expectsql(
      () =>
        queryGenerator.dropTableQuery({
          tableName: 'myTable',
          schema: 'mySchema',
          delimiter: 'custom',
        }),
      {
        sqlite3: 'DROP TABLE IF EXISTS `mySchemacustommyTable`',
      },
    );
  });
});
