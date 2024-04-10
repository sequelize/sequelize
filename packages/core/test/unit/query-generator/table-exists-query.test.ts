import { createSequelizeInstance, expectsql, sequelize } from '../../support';

const dialect = sequelize.dialect;

describe('QueryGenerator#tableExistsQuery', () => {
  const queryGenerator = sequelize.queryGenerator;
  const defaultSchema = dialect.getDefaultSchema();

  it('produces a table exists query for a table', () => {
    expectsql(() => queryGenerator.tableExistsQuery('myTable'), {
      default: `SELECT TABLE_NAME FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_TYPE = 'BASE TABLE' AND TABLE_NAME = 'myTable' AND TABLE_SCHEMA = '${defaultSchema}'`,
      db2: `SELECT TABNAME FROM SYSCAT.TABLES WHERE TABNAME = 'myTable' AND TABSCHEMA = '${defaultSchema}'`,
      ibmi: `SELECT TABLE_NAME FROM QSYS2.SYSTABLES WHERE TABLE_NAME = 'myTable' AND TABLE_SCHEMA = CURRENT SCHEMA`,
      mssql: `SELECT TABLE_NAME FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_TYPE = 'BASE TABLE' AND TABLE_NAME = N'myTable' AND TABLE_SCHEMA = N'${defaultSchema}'`,
      sqlite3: `SELECT name FROM sqlite_master WHERE type = 'table' AND name = 'myTable'`,
    });
  });

  it('produces a table exists query for a model', () => {
    const MyModel = sequelize.define('MyModel', {});

    expectsql(() => queryGenerator.tableExistsQuery(MyModel), {
      default: `SELECT TABLE_NAME FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_TYPE = 'BASE TABLE' AND TABLE_NAME = 'MyModels' AND TABLE_SCHEMA = '${defaultSchema}'`,
      db2: `SELECT TABNAME FROM SYSCAT.TABLES WHERE TABNAME = 'MyModels' AND TABSCHEMA = '${defaultSchema}'`,
      ibmi: `SELECT TABLE_NAME FROM QSYS2.SYSTABLES WHERE TABLE_NAME = 'MyModels' AND TABLE_SCHEMA = CURRENT SCHEMA`,
      mssql: `SELECT TABLE_NAME FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_TYPE = 'BASE TABLE' AND TABLE_NAME = N'MyModels' AND TABLE_SCHEMA = N'${defaultSchema}'`,
      sqlite3: `SELECT name FROM sqlite_master WHERE type = 'table' AND name = 'MyModels'`,
    });
  });

  it('produces a table exists query for a model definition', () => {
    const MyModel = sequelize.define('MyModel', {});
    const myDefinition = MyModel.modelDefinition;

    expectsql(() => queryGenerator.tableExistsQuery(myDefinition), {
      default: `SELECT TABLE_NAME FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_TYPE = 'BASE TABLE' AND TABLE_NAME = 'MyModels' AND TABLE_SCHEMA = '${defaultSchema}'`,
      db2: `SELECT TABNAME FROM SYSCAT.TABLES WHERE TABNAME = 'MyModels' AND TABSCHEMA = '${defaultSchema}'`,
      ibmi: `SELECT TABLE_NAME FROM QSYS2.SYSTABLES WHERE TABLE_NAME = 'MyModels' AND TABLE_SCHEMA = CURRENT SCHEMA`,
      mssql: `SELECT TABLE_NAME FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_TYPE = 'BASE TABLE' AND TABLE_NAME = N'MyModels' AND TABLE_SCHEMA = N'${defaultSchema}'`,
      sqlite3: `SELECT name FROM sqlite_master WHERE type = 'table' AND name = 'MyModels'`,
    });
  });

  it('produces a table exists query for a table and schema', () => {
    expectsql(() => queryGenerator.tableExistsQuery({ tableName: 'myTable', schema: 'mySchema' }), {
      default: `SELECT TABLE_NAME FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_TYPE = 'BASE TABLE' AND TABLE_NAME = 'myTable' AND TABLE_SCHEMA = 'mySchema'`,
      db2: `SELECT TABNAME FROM SYSCAT.TABLES WHERE TABNAME = 'myTable' AND TABSCHEMA = 'mySchema'`,
      ibmi: `SELECT TABLE_NAME FROM QSYS2.SYSTABLES WHERE TABLE_NAME = 'myTable' AND TABLE_SCHEMA = 'mySchema'`,
      mssql: `SELECT TABLE_NAME FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_TYPE = 'BASE TABLE' AND TABLE_NAME = N'myTable' AND TABLE_SCHEMA = N'mySchema'`,
      sqlite3: `SELECT name FROM sqlite_master WHERE type = 'table' AND name = 'mySchema.myTable'`,
    });
  });

  it('produces a table exists query for a table and default schema', () => {
    expectsql(
      () =>
        queryGenerator.tableExistsQuery({
          tableName: 'myTable',
          schema: dialect.getDefaultSchema(),
        }),
      {
        default: `SELECT TABLE_NAME FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_TYPE = 'BASE TABLE' AND TABLE_NAME = 'myTable' AND TABLE_SCHEMA = '${defaultSchema}'`,
        db2: `SELECT TABNAME FROM SYSCAT.TABLES WHERE TABNAME = 'myTable' AND TABSCHEMA = '${defaultSchema}'`,
        ibmi: `SELECT TABLE_NAME FROM QSYS2.SYSTABLES WHERE TABLE_NAME = 'myTable' AND TABLE_SCHEMA = CURRENT SCHEMA`,
        mssql: `SELECT TABLE_NAME FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_TYPE = 'BASE TABLE' AND TABLE_NAME = N'myTable' AND TABLE_SCHEMA = N'${defaultSchema}'`,
        sqlite3: `SELECT name FROM sqlite_master WHERE type = 'table' AND name = 'myTable'`,
      },
    );
  });

  it('produces a table exists query for a table and globally set schema', () => {
    const sequelizeSchema = createSequelizeInstance({ schema: 'mySchema' });
    const queryGeneratorSchema = sequelizeSchema.queryGenerator;

    expectsql(() => queryGeneratorSchema.tableExistsQuery('myTable'), {
      default: `SELECT TABLE_NAME FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_TYPE = 'BASE TABLE' AND TABLE_NAME = 'myTable' AND TABLE_SCHEMA = 'mySchema'`,
      db2: `SELECT TABNAME FROM SYSCAT.TABLES WHERE TABNAME = 'myTable' AND TABSCHEMA = 'mySchema'`,
      ibmi: `SELECT TABLE_NAME FROM QSYS2.SYSTABLES WHERE TABLE_NAME = 'myTable' AND TABLE_SCHEMA = 'mySchema'`,
      mssql: `SELECT TABLE_NAME FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_TYPE = 'BASE TABLE' AND TABLE_NAME = N'myTable' AND TABLE_SCHEMA = N'mySchema'`,
      sqlite3: `SELECT name FROM sqlite_master WHERE type = 'table' AND name = 'mySchema.myTable'`,
    });
  });

  it('produces a table exists query for a table with schema and custom delimiter argument', () => {
    // This test is only relevant for dialects that do not support schemas
    if (dialect.supports.schemas) {
      return;
    }

    expectsql(
      () =>
        queryGenerator.tableExistsQuery({
          tableName: 'myTable',
          schema: 'mySchema',
          delimiter: 'custom',
        }),
      {
        sqlite3: `SELECT name FROM sqlite_master WHERE type = 'table' AND name = 'mySchemacustommyTable'`,
      },
    );
  });
});
