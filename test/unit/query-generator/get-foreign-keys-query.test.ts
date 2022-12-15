import { createSequelizeInstance, expectsql, sequelize } from '../../support';

const dialect = sequelize.dialect;

const notImplementedError = new Error(`getForeignKeysQuery has not been implemented in ${dialect.name}.`);

describe('QueryGenerator#getForeignKeysQuery', () => {
  const queryGenerator = sequelize.getQueryInterface().queryGenerator;

  it('produces a query to get all foreign keys of a table', () => {
    expectsql(() => queryGenerator.getForeignKeysQuery('myTable'), {
      default: notImplementedError,
      'mariadb mysql': `SELECT CONSTRAINT_NAME as constraint_name,
        CONSTRAINT_NAME as constraintName,
        CONSTRAINT_SCHEMA as constraintSchema,
        CONSTRAINT_SCHEMA as constraintCatalog,
        TABLE_NAME as tableName,
        TABLE_SCHEMA as tableSchema,
        TABLE_SCHEMA as tableCatalog,
        COLUMN_NAME as columnName,
        REFERENCED_TABLE_SCHEMA as referencedTableSchema,
        REFERENCED_TABLE_SCHEMA as referencedTableCatalog,
        REFERENCED_TABLE_NAME as referencedTableName,
        REFERENCED_COLUMN_NAME as referencedColumnName
        FROM INFORMATION_SCHEMA.KEY_COLUMN_USAGE
        where TABLE_NAME = 'myTable'
        AND CONSTRAINT_NAME != 'PRIMARY'
        AND CONSTRAINT_SCHEMA = 'sequelize_test'
        AND REFERENCED_TABLE_NAME IS NOT NULL`,
      postgres: `SELECT conname as constraint_name,
        pg_catalog.pg_get_constraintdef(r.oid, true) as condef
        FROM pg_catalog.pg_constraint r
        WHERE r.conrelid =
        (SELECT oid FROM pg_class
        WHERE relname = 'myTable'
        LIMIT 1)
        AND r.contype = 'f' ORDER BY 1;`,
      mssql: `SELECT constraint_name = OBJ.NAME,
        constraintName = OBJ.NAME,
        constraintCatalog = N'sequelize_test',
        constraintSchema = SCHEMA_NAME(OBJ.SCHEMA_ID),
        tableName = TB.NAME,
        tableSchema = SCHEMA_NAME(TB.SCHEMA_ID),
        tableCatalog = N'sequelize_test',
        columnName = COL.NAME,
        referencedTableSchema = SCHEMA_NAME(RTB.SCHEMA_ID),
        referencedCatalog = N'sequelize_test',
        referencedTableName = RTB.NAME,
        referencedColumnName = RCOL.NAME
        FROM sys.foreign_key_columns FKC
        INNER JOIN sys.objects OBJ
        ON OBJ.OBJECT_ID = FKC.CONSTRAINT_OBJECT_ID
        INNER JOIN sys.tables TB
        ON TB.OBJECT_ID = FKC.PARENT_OBJECT_ID
        INNER JOIN sys.columns COL
        ON COL.COLUMN_ID = PARENT_COLUMN_ID
        AND COL.OBJECT_ID = TB.OBJECT_ID
        INNER JOIN sys.tables RTB
        ON RTB.OBJECT_ID = FKC.REFERENCED_OBJECT_ID
        INNER JOIN sys.columns RCOL
        ON RCOL.COLUMN_ID = REFERENCED_COLUMN_ID
        AND RCOL.OBJECT_ID = RTB.OBJECT_ID
        WHERE TB.NAME = N'myTable'
        AND SCHEMA_NAME(TB.SCHEMA_ID) = N'dbo'`,
      sqlite: 'PRAGMA foreign_key_list(`myTable`)',
      db2: `SELECT R.CONSTNAME AS "constraintName",
        TRIM(R.TABSCHEMA) AS "constraintSchema",
        R.TABNAME AS "tableName",
        TRIM(R.TABSCHEMA) AS "tableSchema", LISTAGG(C.COLNAME,', ')
        WITHIN GROUP (ORDER BY C.COLNAME) AS "columnName",
        TRIM(R.REFTABSCHEMA) AS "referencedTableSchema",
        R.REFTABNAME AS "referencedTableName",
        TRIM(R.PK_COLNAMES) AS "referencedColumnName"
        FROM SYSCAT.REFERENCES R, SYSCAT.KEYCOLUSE C
        WHERE R.CONSTNAME = C.CONSTNAME AND R.TABSCHEMA = C.TABSCHEMA
        AND R.TABNAME = C.TABNAME
        AND R.TABNAME = 'myTable'
        GROUP BY R.REFTABSCHEMA,
        R.REFTABNAME, R.TABSCHEMA, R.TABNAME, R.CONSTNAME, R.PK_COLNAMES`,
      ibmi: `SELECT FK_NAME AS "constraintName",
        PKTABLE_CAT AS "referencedTableCatalog",
        PKTABLE_SCHEM AS "referencedTableSchema",
        PKTABLE_NAME AS "referencedTableName",
        PKCOLUMN_NAME AS "referencedColumnName",
        FKTABLE_CAT AS "tableCatalog",
        FKTABLE_SCHEM AS "tableSchema",
        FKTABLE_NAME AS "tableName",
        FKTABLE_SCHEM AS "tableSchema",
        FKCOLUMN_NAME AS "columnName"
        FROM SYSIBM.SQLFOREIGNKEYS
        WHERE FKTABLE_SCHEM = CURRENT SCHEMA
        AND FKTABLE_NAME = 'myTable'`,
    });
  });

  it('produces a query to get all foreign keys of a table from a model', () => {
    const MyModel = sequelize.define('myModel', {});

    expectsql(() => queryGenerator.getForeignKeysQuery(MyModel), {
      default: notImplementedError,
      'mariadb mysql': `SELECT CONSTRAINT_NAME as constraint_name,
        CONSTRAINT_NAME as constraintName,
        CONSTRAINT_SCHEMA as constraintSchema,
        CONSTRAINT_SCHEMA as constraintCatalog,
        TABLE_NAME as tableName,
        TABLE_SCHEMA as tableSchema,
        TABLE_SCHEMA as tableCatalog,
        COLUMN_NAME as columnName,
        REFERENCED_TABLE_SCHEMA as referencedTableSchema,
        REFERENCED_TABLE_SCHEMA as referencedTableCatalog,
        REFERENCED_TABLE_NAME as referencedTableName,
        REFERENCED_COLUMN_NAME as referencedColumnName
        FROM INFORMATION_SCHEMA.KEY_COLUMN_USAGE
        where TABLE_NAME = 'myModels'
        AND CONSTRAINT_NAME != 'PRIMARY'
        AND CONSTRAINT_SCHEMA = 'sequelize_test'
        AND REFERENCED_TABLE_NAME IS NOT NULL`,
      postgres: `SELECT conname as constraint_name,
        pg_catalog.pg_get_constraintdef(r.oid, true) as condef
        FROM pg_catalog.pg_constraint r
        WHERE r.conrelid =
        (SELECT oid FROM pg_class
        WHERE relname = 'myModels'
        LIMIT 1)
        AND r.contype = 'f' ORDER BY 1;`,
      mssql: `SELECT constraint_name = OBJ.NAME,
        constraintName = OBJ.NAME,
        constraintCatalog = N'sequelize_test',
        constraintSchema = SCHEMA_NAME(OBJ.SCHEMA_ID),
        tableName = TB.NAME,
        tableSchema = SCHEMA_NAME(TB.SCHEMA_ID),
        tableCatalog = N'sequelize_test',
        columnName = COL.NAME,
        referencedTableSchema = SCHEMA_NAME(RTB.SCHEMA_ID),
        referencedCatalog = N'sequelize_test',
        referencedTableName = RTB.NAME,
        referencedColumnName = RCOL.NAME
        FROM sys.foreign_key_columns FKC
        INNER JOIN sys.objects OBJ
        ON OBJ.OBJECT_ID = FKC.CONSTRAINT_OBJECT_ID
        INNER JOIN sys.tables TB
        ON TB.OBJECT_ID = FKC.PARENT_OBJECT_ID
        INNER JOIN sys.columns COL
        ON COL.COLUMN_ID = PARENT_COLUMN_ID
        AND COL.OBJECT_ID = TB.OBJECT_ID
        INNER JOIN sys.tables RTB
        ON RTB.OBJECT_ID = FKC.REFERENCED_OBJECT_ID
        INNER JOIN sys.columns RCOL
        ON RCOL.COLUMN_ID = REFERENCED_COLUMN_ID
        AND RCOL.OBJECT_ID = RTB.OBJECT_ID
        WHERE TB.NAME = N'myModels'
        AND SCHEMA_NAME(TB.SCHEMA_ID) = N'dbo'`,
      sqlite: 'PRAGMA foreign_key_list(`myModels`)',
      db2: `SELECT R.CONSTNAME AS "constraintName",
        TRIM(R.TABSCHEMA) AS "constraintSchema",
        R.TABNAME AS "tableName",
        TRIM(R.TABSCHEMA) AS "tableSchema", LISTAGG(C.COLNAME,', ')
        WITHIN GROUP (ORDER BY C.COLNAME) AS "columnName",
        TRIM(R.REFTABSCHEMA) AS "referencedTableSchema",
        R.REFTABNAME AS "referencedTableName",
        TRIM(R.PK_COLNAMES) AS "referencedColumnName"
        FROM SYSCAT.REFERENCES R, SYSCAT.KEYCOLUSE C
        WHERE R.CONSTNAME = C.CONSTNAME AND R.TABSCHEMA = C.TABSCHEMA
        AND R.TABNAME = C.TABNAME
        AND R.TABNAME = 'myModels'
        GROUP BY R.REFTABSCHEMA,
        R.REFTABNAME, R.TABSCHEMA, R.TABNAME, R.CONSTNAME, R.PK_COLNAMES`,
      ibmi: `SELECT FK_NAME AS "constraintName",
        PKTABLE_CAT AS "referencedTableCatalog",
        PKTABLE_SCHEM AS "referencedTableSchema",
        PKTABLE_NAME AS "referencedTableName",
        PKCOLUMN_NAME AS "referencedColumnName",
        FKTABLE_CAT AS "tableCatalog",
        FKTABLE_SCHEM AS "tableSchema",
        FKTABLE_NAME AS "tableName",
        FKTABLE_SCHEM AS "tableSchema",
        FKCOLUMN_NAME AS "columnName"
        FROM SYSIBM.SQLFOREIGNKEYS
        WHERE FKTABLE_SCHEM = CURRENT SCHEMA
        AND FKTABLE_NAME = 'myModels'`,
    });
  });

  it('produces a query to get all foreign keys of a table with schema in tableName object', () => {
    expectsql(() => queryGenerator.getForeignKeysQuery({ tableName: 'myTable', schema: 'mySchema' }), {
      default: notImplementedError,
      'mariadb mysql': `SELECT CONSTRAINT_NAME as constraint_name,
        CONSTRAINT_NAME as constraintName,
        CONSTRAINT_SCHEMA as constraintSchema,
        CONSTRAINT_SCHEMA as constraintCatalog,
        TABLE_NAME as tableName,
        TABLE_SCHEMA as tableSchema,
        TABLE_SCHEMA as tableCatalog,
        COLUMN_NAME as columnName,
        REFERENCED_TABLE_SCHEMA as referencedTableSchema,
        REFERENCED_TABLE_SCHEMA as referencedTableCatalog,
        REFERENCED_TABLE_NAME as referencedTableName,
        REFERENCED_COLUMN_NAME as referencedColumnName
        FROM INFORMATION_SCHEMA.KEY_COLUMN_USAGE
        where TABLE_NAME = 'myTable'
        AND CONSTRAINT_NAME != 'PRIMARY'
        AND CONSTRAINT_SCHEMA = 'mySchema'
        AND REFERENCED_TABLE_NAME IS NOT NULL`,
      postgres: `SELECT conname as constraint_name,
        pg_catalog.pg_get_constraintdef(r.oid, true) as condef
        FROM pg_catalog.pg_constraint r
        WHERE r.conrelid =
        (SELECT oid FROM pg_class
        WHERE relname = 'myTable'
        LIMIT 1)
        AND r.contype = 'f' ORDER BY 1;`,
      mssql: `SELECT constraint_name = OBJ.NAME,
        constraintName = OBJ.NAME,
        constraintCatalog = N'sequelize_test',
        constraintSchema = SCHEMA_NAME(OBJ.SCHEMA_ID),
        tableName = TB.NAME,
        tableSchema = SCHEMA_NAME(TB.SCHEMA_ID),
        tableCatalog = N'sequelize_test',
        columnName = COL.NAME,
        referencedTableSchema = SCHEMA_NAME(RTB.SCHEMA_ID),
        referencedCatalog = N'sequelize_test',
        referencedTableName = RTB.NAME,
        referencedColumnName = RCOL.NAME
        FROM sys.foreign_key_columns FKC
        INNER JOIN sys.objects OBJ
        ON OBJ.OBJECT_ID = FKC.CONSTRAINT_OBJECT_ID
        INNER JOIN sys.tables TB
        ON TB.OBJECT_ID = FKC.PARENT_OBJECT_ID
        INNER JOIN sys.columns COL
        ON COL.COLUMN_ID = PARENT_COLUMN_ID
        AND COL.OBJECT_ID = TB.OBJECT_ID
        INNER JOIN sys.tables RTB
        ON RTB.OBJECT_ID = FKC.REFERENCED_OBJECT_ID
        INNER JOIN sys.columns RCOL
        ON RCOL.COLUMN_ID = REFERENCED_COLUMN_ID
        AND RCOL.OBJECT_ID = RTB.OBJECT_ID
        WHERE TB.NAME = N'myTable'
        AND SCHEMA_NAME(TB.SCHEMA_ID) = N'mySchema'`,
      sqlite: 'PRAGMA foreign_key_list(`mySchema.myTable`)',
      db2: `SELECT R.CONSTNAME AS "constraintName",
        TRIM(R.TABSCHEMA) AS "constraintSchema",
        R.TABNAME AS "tableName",
        TRIM(R.TABSCHEMA) AS "tableSchema", LISTAGG(C.COLNAME,', ')
        WITHIN GROUP (ORDER BY C.COLNAME) AS "columnName",
        TRIM(R.REFTABSCHEMA) AS "referencedTableSchema",
        R.REFTABNAME AS "referencedTableName",
        TRIM(R.PK_COLNAMES) AS "referencedColumnName"
        FROM SYSCAT.REFERENCES R, SYSCAT.KEYCOLUSE C
        WHERE R.CONSTNAME = C.CONSTNAME AND R.TABSCHEMA = C.TABSCHEMA
        AND R.TABNAME = C.TABNAME
        AND R.TABNAME = 'myTable'
        AND R.TABSCHEMA = 'mySchema'
        GROUP BY R.REFTABSCHEMA,
        R.REFTABNAME, R.TABSCHEMA, R.TABNAME, R.CONSTNAME, R.PK_COLNAMES`,
      ibmi: `SELECT FK_NAME AS "constraintName",
        PKTABLE_CAT AS "referencedTableCatalog",
        PKTABLE_SCHEM AS "referencedTableSchema",
        PKTABLE_NAME AS "referencedTableName",
        PKCOLUMN_NAME AS "referencedColumnName",
        FKTABLE_CAT AS "tableCatalog",
        FKTABLE_SCHEM AS "tableSchema",
        FKTABLE_NAME AS "tableName",
        FKTABLE_SCHEM AS "tableSchema",
        FKCOLUMN_NAME AS "columnName"
        FROM SYSIBM.SQLFOREIGNKEYS
        WHERE FKTABLE_SCHEM = 'mySchema'
        AND FKTABLE_NAME = 'myTable'`,
    });
  });

  it('produces a query to get all foreign keys of a table with default schema in tableName object', () => {
    expectsql(() => queryGenerator.getForeignKeysQuery({ tableName: 'myTable', schema: dialect.getDefaultSchema() }), {
      default: notImplementedError,
      'mariadb mysql': `SELECT CONSTRAINT_NAME as constraint_name,
        CONSTRAINT_NAME as constraintName,
        CONSTRAINT_SCHEMA as constraintSchema,
        CONSTRAINT_SCHEMA as constraintCatalog,
        TABLE_NAME as tableName,
        TABLE_SCHEMA as tableSchema,
        TABLE_SCHEMA as tableCatalog,
        COLUMN_NAME as columnName,
        REFERENCED_TABLE_SCHEMA as referencedTableSchema,
        REFERENCED_TABLE_SCHEMA as referencedTableCatalog,
        REFERENCED_TABLE_NAME as referencedTableName,
        REFERENCED_COLUMN_NAME as referencedColumnName
        FROM INFORMATION_SCHEMA.KEY_COLUMN_USAGE
        where TABLE_NAME = 'myTable'
        AND CONSTRAINT_NAME != 'PRIMARY'
        AND CONSTRAINT_SCHEMA = 'sequelize_test'
        AND REFERENCED_TABLE_NAME IS NOT NULL`,
      postgres: `SELECT conname as constraint_name,
        pg_catalog.pg_get_constraintdef(r.oid, true) as condef
        FROM pg_catalog.pg_constraint r
        WHERE r.conrelid =
        (SELECT oid FROM pg_class
        WHERE relname = 'myTable'
        LIMIT 1)
        AND r.contype = 'f' ORDER BY 1;`,
      mssql: `SELECT constraint_name = OBJ.NAME,
        constraintName = OBJ.NAME,
        constraintCatalog = N'sequelize_test',
        constraintSchema = SCHEMA_NAME(OBJ.SCHEMA_ID),
        tableName = TB.NAME,
        tableSchema = SCHEMA_NAME(TB.SCHEMA_ID),
        tableCatalog = N'sequelize_test',
        columnName = COL.NAME,
        referencedTableSchema = SCHEMA_NAME(RTB.SCHEMA_ID),
        referencedCatalog = N'sequelize_test',
        referencedTableName = RTB.NAME,
        referencedColumnName = RCOL.NAME
        FROM sys.foreign_key_columns FKC
        INNER JOIN sys.objects OBJ
        ON OBJ.OBJECT_ID = FKC.CONSTRAINT_OBJECT_ID
        INNER JOIN sys.tables TB
        ON TB.OBJECT_ID = FKC.PARENT_OBJECT_ID
        INNER JOIN sys.columns COL
        ON COL.COLUMN_ID = PARENT_COLUMN_ID
        AND COL.OBJECT_ID = TB.OBJECT_ID
        INNER JOIN sys.tables RTB
        ON RTB.OBJECT_ID = FKC.REFERENCED_OBJECT_ID
        INNER JOIN sys.columns RCOL
        ON RCOL.COLUMN_ID = REFERENCED_COLUMN_ID
        AND RCOL.OBJECT_ID = RTB.OBJECT_ID
        WHERE TB.NAME = N'myTable'
        AND SCHEMA_NAME(TB.SCHEMA_ID) = N'dbo'`,
      sqlite: 'PRAGMA foreign_key_list(`myTable`)',
      db2: `SELECT R.CONSTNAME AS "constraintName",
        TRIM(R.TABSCHEMA) AS "constraintSchema",
        R.TABNAME AS "tableName",
        TRIM(R.TABSCHEMA) AS "tableSchema", LISTAGG(C.COLNAME,', ')
        WITHIN GROUP (ORDER BY C.COLNAME) AS "columnName",
        TRIM(R.REFTABSCHEMA) AS "referencedTableSchema",
        R.REFTABNAME AS "referencedTableName",
        TRIM(R.PK_COLNAMES) AS "referencedColumnName"
        FROM SYSCAT.REFERENCES R, SYSCAT.KEYCOLUSE C
        WHERE R.CONSTNAME = C.CONSTNAME AND R.TABSCHEMA = C.TABSCHEMA
        AND R.TABNAME = C.TABNAME
        AND R.TABNAME = 'myTable'
        GROUP BY R.REFTABSCHEMA,
        R.REFTABNAME, R.TABSCHEMA, R.TABNAME, R.CONSTNAME, R.PK_COLNAMES`,
      ibmi: `SELECT FK_NAME AS "constraintName",
        PKTABLE_CAT AS "referencedTableCatalog",
        PKTABLE_SCHEM AS "referencedTableSchema",
        PKTABLE_NAME AS "referencedTableName",
        PKCOLUMN_NAME AS "referencedColumnName",
        FKTABLE_CAT AS "tableCatalog",
        FKTABLE_SCHEM AS "tableSchema",
        FKTABLE_NAME AS "tableName",
        FKTABLE_SCHEM AS "tableSchema",
        FKCOLUMN_NAME AS "columnName"
        FROM SYSIBM.SQLFOREIGNKEYS
        WHERE FKTABLE_SCHEM = CURRENT SCHEMA
        AND FKTABLE_NAME = 'myTable'`,
    });
  });

  it('produces a query to get all foreign keys of a table with globally set schema', () => {
    const sequelizeSchema = createSequelizeInstance({ schema: 'mySchema' });
    const queryGeneratorSchema = sequelizeSchema.getQueryInterface().queryGenerator;

    expectsql(() => queryGeneratorSchema.getForeignKeysQuery('myTable'), {
      default: notImplementedError,
      'mariadb mysql': `SELECT CONSTRAINT_NAME as constraint_name,
        CONSTRAINT_NAME as constraintName,
        CONSTRAINT_SCHEMA as constraintSchema,
        CONSTRAINT_SCHEMA as constraintCatalog,
        TABLE_NAME as tableName,
        TABLE_SCHEMA as tableSchema,
        TABLE_SCHEMA as tableCatalog,
        COLUMN_NAME as columnName,
        REFERENCED_TABLE_SCHEMA as referencedTableSchema,
        REFERENCED_TABLE_SCHEMA as referencedTableCatalog,
        REFERENCED_TABLE_NAME as referencedTableName,
        REFERENCED_COLUMN_NAME as referencedColumnName
        FROM INFORMATION_SCHEMA.KEY_COLUMN_USAGE
        where TABLE_NAME = 'myTable'
        AND CONSTRAINT_NAME != 'PRIMARY'
        AND CONSTRAINT_SCHEMA = 'mySchema'
        AND REFERENCED_TABLE_NAME IS NOT NULL`,
      postgres: `SELECT conname as constraint_name,
        pg_catalog.pg_get_constraintdef(r.oid, true) as condef
        FROM pg_catalog.pg_constraint r
        WHERE r.conrelid =
        (SELECT oid FROM pg_class
        WHERE relname = 'myTable'
        LIMIT 1)
        AND r.contype = 'f' ORDER BY 1;`,
      mssql: `SELECT constraint_name = OBJ.NAME,
        constraintName = OBJ.NAME,
        constraintCatalog = N'sequelize_test',
        constraintSchema = SCHEMA_NAME(OBJ.SCHEMA_ID),
        tableName = TB.NAME,
        tableSchema = SCHEMA_NAME(TB.SCHEMA_ID),
        tableCatalog = N'sequelize_test',
        columnName = COL.NAME,
        referencedTableSchema = SCHEMA_NAME(RTB.SCHEMA_ID),
        referencedCatalog = N'sequelize_test',
        referencedTableName = RTB.NAME,
        referencedColumnName = RCOL.NAME
        FROM sys.foreign_key_columns FKC
        INNER JOIN sys.objects OBJ
        ON OBJ.OBJECT_ID = FKC.CONSTRAINT_OBJECT_ID
        INNER JOIN sys.tables TB
        ON TB.OBJECT_ID = FKC.PARENT_OBJECT_ID
        INNER JOIN sys.columns COL
        ON COL.COLUMN_ID = PARENT_COLUMN_ID
        AND COL.OBJECT_ID = TB.OBJECT_ID
        INNER JOIN sys.tables RTB
        ON RTB.OBJECT_ID = FKC.REFERENCED_OBJECT_ID
        INNER JOIN sys.columns RCOL
        ON RCOL.COLUMN_ID = REFERENCED_COLUMN_ID
        AND RCOL.OBJECT_ID = RTB.OBJECT_ID
        WHERE TB.NAME = N'myTable'
        AND SCHEMA_NAME(TB.SCHEMA_ID) = N'mySchema'`,
      sqlite: 'PRAGMA foreign_key_list(`mySchema.myTable`)',
      db2: `SELECT R.CONSTNAME AS "constraintName",
        TRIM(R.TABSCHEMA) AS "constraintSchema",
        R.TABNAME AS "tableName",
        TRIM(R.TABSCHEMA) AS "tableSchema", LISTAGG(C.COLNAME,', ')
        WITHIN GROUP (ORDER BY C.COLNAME) AS "columnName",
        TRIM(R.REFTABSCHEMA) AS "referencedTableSchema",
        R.REFTABNAME AS "referencedTableName",
        TRIM(R.PK_COLNAMES) AS "referencedColumnName"
        FROM SYSCAT.REFERENCES R, SYSCAT.KEYCOLUSE C
        WHERE R.CONSTNAME = C.CONSTNAME AND R.TABSCHEMA = C.TABSCHEMA
        AND R.TABNAME = C.TABNAME
        AND R.TABNAME = 'myTable'
        AND R.TABSCHEMA = 'mySchema'
        GROUP BY R.REFTABSCHEMA,
        R.REFTABNAME, R.TABSCHEMA, R.TABNAME, R.CONSTNAME, R.PK_COLNAMES`,
      ibmi: `SELECT FK_NAME AS "constraintName",
        PKTABLE_CAT AS "referencedTableCatalog",
        PKTABLE_SCHEM AS "referencedTableSchema",
        PKTABLE_NAME AS "referencedTableName",
        PKCOLUMN_NAME AS "referencedColumnName",
        FKTABLE_CAT AS "tableCatalog",
        FKTABLE_SCHEM AS "tableSchema",
        FKTABLE_NAME AS "tableName",
        FKTABLE_SCHEM AS "tableSchema",
        FKCOLUMN_NAME AS "columnName"
        FROM SYSIBM.SQLFOREIGNKEYS
        WHERE FKTABLE_SCHEM = 'mySchema'
        AND FKTABLE_NAME = 'myTable'`,
    });
  });

  it('produces a query to get all foreign keys of a table with schema and delimiter in tableName object', () => {
    // This test is only relevant for dialects that do not support schemas
    if (dialect.supports.schemas) {
      return;
    }

    expectsql(() => queryGenerator.getForeignKeysQuery({ tableName: 'myTable', schema: 'mySchema', delimiter: 'custom' }), {
      sqlite: 'PRAGMA foreign_key_list(`mySchemacustommyTable`)',
    });
  });
});
