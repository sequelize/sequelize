import { expectsql, sequelize } from '../../support';

describe('QueryGenerator#dropTableQuery', () => {
  const queryGenerator = sequelize.getQueryInterface().queryGenerator;

  it('produces a DROP TABLE query', () => {
    // @ts-expect-error - dropTableQuery is not yet typed
    expectsql(() => queryGenerator.dropTableQuery('myTable'), {
      default: `DROP TABLE IF EXISTS [myTable];`,
      mssql: `IF OBJECT_ID('[myTable]', 'U') IS NOT NULL DROP TABLE [myTable];`,
      // TODO: Fix this
      ibmi: new Error(`Cannot read properties of undefined (reading 'schema')`),
    });
  });

  it('produces a DROP TABLE query with cascade', () => {
    // @ts-expect-error - dropTableQuery is not yet typed
    expectsql(() => queryGenerator.dropTableQuery('myTable', { cascade: true }), {
      // TODO: Throw an error for invalid options
      default: `DROP TABLE IF EXISTS [myTable];`,
      postgres: `DROP TABLE IF EXISTS "myTable" CASCADE;`,
      mssql: `IF OBJECT_ID('[myTable]', 'U') IS NOT NULL DROP TABLE [myTable];`,
    });
  });

  it('produces a DROP TABLE query with schema', () => {
    // @ts-expect-error - dropTableQuery is not yet typed
    expectsql(() => queryGenerator.dropTableQuery({ tableName: 'myTable', schema: 'mySchema' }), {
      default: `DROP TABLE IF EXISTS [mySchema].[myTable];`,
      mssql: `IF OBJECT_ID('[mySchema].[myTable]', 'U') IS NOT NULL DROP TABLE [mySchema].[myTable];`,
      sqlite: 'DROP TABLE IF EXISTS `mySchema.myTable`;',
      // TODO: Fix this
      ibmi: 'DROP TABLE IF EXISTS "mySchema"."undefined"',
    });
  });

  it('produces a DROP TABLE query with schema and cascade', () => {
    // @ts-expect-error - dropTableQuery is not yet typed
    expectsql(() => queryGenerator.dropTableQuery({ tableName: 'myTable', schema: 'mySchema' }, { cascade: true }), {
      // TODO: Throw an error for invalid options
      default: `DROP TABLE IF EXISTS [mySchema].[myTable];`,
      postgres: `DROP TABLE IF EXISTS "mySchema"."myTable" CASCADE;`,
      mssql: `IF OBJECT_ID('[mySchema].[myTable]', 'U') IS NOT NULL DROP TABLE [mySchema].[myTable];`,
      sqlite: 'DROP TABLE IF EXISTS `mySchema.myTable`;',
      // TODO: Fix this
      ibmi: 'DROP TABLE IF EXISTS "mySchema"."undefined"',
    });
  });
});
