import { createSequelizeInstance, expectsql, sequelize } from '../../support';

const dialect = sequelize.dialect;

const notImplementedError = new Error(`getForeignKeyQuery has not been implemented in ${dialect.name}.`);

describe('QueryGenerator#getForeignKeyQuery', () => {
  const queryGenerator = sequelize.getQueryInterface().queryGenerator;

  it('produces a query to get all foreign keys of a table', () => {
    expectsql(() => queryGenerator.getForeignKeyQuery('myTable', 'myColumn'), {
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
        WHERE (REFERENCED_TABLE_NAME = 'myTable'
        AND REFERENCED_TABLE_SCHEMA = 'sequelize_test'
        AND REFERENCED_COLUMN_NAME = \`myColumn\`)
        OR (TABLE_NAME = 'myTable'
        AND TABLE_SCHEMA = 'sequelize_test'
        AND COLUMN_NAME = \`myColumn\`
        AND REFERENCED_TABLE_NAME IS NOT NULL)`,
      mssql: `SELECT constraint_name = OBJ.NAME,
        constraintName = OBJ.NAME,
        constraintSchema = SCHEMA_NAME(OBJ.SCHEMA_ID),
        tableName = TB.NAME,
        tableSchema = SCHEMA_NAME(TB.SCHEMA_ID),
        columnName = COL.NAME,
        referencedTableSchema = SCHEMA_NAME(RTB.SCHEMA_ID),
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
        WHERE TB.NAME = [myTable]
        AND COL.NAME = [myColumn]
        AND SCHEMA_NAME(TB.SCHEMA_ID) = [dbo]`,
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
        AND R.TABNAME = "myTable"
        AND C.COLNAME = "myColumn"
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
        AND FKTABLE_NAME = "myTable"
        AND FKCOLUMN_NAME = "myColumn"`,
    });
  });

  it('produces a query to get all foreign keys of a table from a model', () => {
    const MyModel = sequelize.define('myModel', {});

    expectsql(() => queryGenerator.getForeignKeyQuery(MyModel, 'myColumn'), {
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
        WHERE (REFERENCED_TABLE_NAME = 'myModels'
        AND REFERENCED_TABLE_SCHEMA = 'sequelize_test'
        AND REFERENCED_COLUMN_NAME = \`myColumn\`)
        OR (TABLE_NAME = 'myModels'
        AND TABLE_SCHEMA = 'sequelize_test'
        AND COLUMN_NAME = \`myColumn\`
        AND REFERENCED_TABLE_NAME IS NOT NULL)`,
      mssql: `SELECT constraint_name = OBJ.NAME,
        constraintName = OBJ.NAME,
        constraintSchema = SCHEMA_NAME(OBJ.SCHEMA_ID),
        tableName = TB.NAME,
        tableSchema = SCHEMA_NAME(TB.SCHEMA_ID),
        columnName = COL.NAME,
        referencedTableSchema = SCHEMA_NAME(RTB.SCHEMA_ID),
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
        WHERE TB.NAME = [myModels]
        AND COL.NAME = [myColumn]
        AND SCHEMA_NAME(TB.SCHEMA_ID) = [dbo]`,
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
        AND R.TABNAME = "myModels"
        AND C.COLNAME = "myColumn"
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
        AND FKTABLE_NAME = "myModels"
        AND FKCOLUMN_NAME = "myColumn"`,
    });
  });

  it('produces a query to get all foreign keys of a table with schema in tableName object', () => {
    expectsql(() => queryGenerator.getForeignKeyQuery({ tableName: 'myTable', schema: 'mySchema' }, 'myColumn'), {
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
        WHERE (REFERENCED_TABLE_NAME = 'myTable'
        AND REFERENCED_TABLE_SCHEMA = 'mySchema'
        AND REFERENCED_COLUMN_NAME = \`myColumn\`)
        OR (TABLE_NAME = 'myTable'
        AND TABLE_SCHEMA = 'mySchema'
        AND COLUMN_NAME = \`myColumn\`
        AND REFERENCED_TABLE_NAME IS NOT NULL)`,
      mssql: `SELECT constraint_name = OBJ.NAME,
        constraintName = OBJ.NAME,
        constraintSchema = SCHEMA_NAME(OBJ.SCHEMA_ID),
        tableName = TB.NAME,
        tableSchema = SCHEMA_NAME(TB.SCHEMA_ID),
        columnName = COL.NAME,
        referencedTableSchema = SCHEMA_NAME(RTB.SCHEMA_ID),
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
        WHERE TB.NAME = [myTable]
        AND COL.NAME = [myColumn]
        AND SCHEMA_NAME(TB.SCHEMA_ID) = [mySchema]`,
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
        AND R.TABNAME = "myTable"
        AND R.TABSCHEMA = "mySchema"
        AND C.COLNAME = "myColumn"
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
        WHERE FKTABLE_SCHEM = "mySchema"
        AND FKTABLE_NAME = "myTable"
        AND FKCOLUMN_NAME = "myColumn"`,
    });
  });

  it('produces a query to get all foreign keys of a table with default schema in tableName object', () => {
    expectsql(() => queryGenerator.getForeignKeyQuery({ tableName: 'myTable', schema: dialect.getDefaultSchema() }, 'myColumn'), {
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
        WHERE (REFERENCED_TABLE_NAME = 'myTable'
        AND REFERENCED_TABLE_SCHEMA = 'sequelize_test'
        AND REFERENCED_COLUMN_NAME = \`myColumn\`)
        OR (TABLE_NAME = 'myTable'
        AND TABLE_SCHEMA = 'sequelize_test'
        AND COLUMN_NAME = \`myColumn\`
        AND REFERENCED_TABLE_NAME IS NOT NULL)`,
      mssql: `SELECT constraint_name = OBJ.NAME,
        constraintName = OBJ.NAME,
        constraintSchema = SCHEMA_NAME(OBJ.SCHEMA_ID),
        tableName = TB.NAME,
        tableSchema = SCHEMA_NAME(TB.SCHEMA_ID),
        columnName = COL.NAME,
        referencedTableSchema = SCHEMA_NAME(RTB.SCHEMA_ID),
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
        WHERE TB.NAME = [myTable]
        AND COL.NAME = [myColumn]
        AND SCHEMA_NAME(TB.SCHEMA_ID) = [dbo]`,
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
        AND R.TABNAME = "myTable"
        AND C.COLNAME = "myColumn"
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
        AND FKTABLE_NAME = "myTable"
        AND FKCOLUMN_NAME = "myColumn"`,
    });
  });

  it('produces a query to get all foreign keys of a table with globally set schema', () => {
    const sequelizeSchema = createSequelizeInstance({ schema: 'mySchema' });
    const queryGeneratorSchema = sequelizeSchema.getQueryInterface().queryGenerator;

    expectsql(() => queryGeneratorSchema.getForeignKeyQuery('myTable', 'myColumn'), {
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
        WHERE (REFERENCED_TABLE_NAME = 'myTable'
        AND REFERENCED_TABLE_SCHEMA = 'mySchema'
        AND REFERENCED_COLUMN_NAME = \`myColumn\`)
        OR (TABLE_NAME = 'myTable'
        AND TABLE_SCHEMA = 'mySchema'
        AND COLUMN_NAME = \`myColumn\`
        AND REFERENCED_TABLE_NAME IS NOT NULL)`,
      mssql: `SELECT constraint_name = OBJ.NAME,
        constraintName = OBJ.NAME,
        constraintSchema = SCHEMA_NAME(OBJ.SCHEMA_ID),
        tableName = TB.NAME,
        tableSchema = SCHEMA_NAME(TB.SCHEMA_ID),
        columnName = COL.NAME,
        referencedTableSchema = SCHEMA_NAME(RTB.SCHEMA_ID),
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
        WHERE TB.NAME = [myTable]
        AND COL.NAME = [myColumn]
        AND SCHEMA_NAME(TB.SCHEMA_ID) = [mySchema]`,
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
        AND R.TABNAME = "myTable"
        AND R.TABSCHEMA = "mySchema"
        AND C.COLNAME = "myColumn"
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
        WHERE FKTABLE_SCHEM = "mySchema"
        AND FKTABLE_NAME = "myTable"
        AND FKCOLUMN_NAME = "myColumn"`,
    });
  });

  it('produces a query to get all foreign keys of a table with schema and delimiter in tableName object', () => {
    // This test is only relevant for dialects that do not support schemas
    if (dialect.supports.schemas) {
      return;
    }

    expectsql(() => queryGenerator.getForeignKeyQuery({ tableName: 'myTable', schema: 'mySchema', delimiter: 'custom' }, 'myColumn'), {
      sqlite: notImplementedError,
    });
  });
});
