import { createSequelizeInstance, expectsql, sequelize } from '../../support';

const dialect = sequelize.dialect;

const notImplementedError = new Error(`getForeignKeyQuery has not been implemented in ${dialect.name}.`);
const notSupportedError = new Error(`Providing a columnName in getForeignKeyQuery is not supported by ${dialect.name}.`);

describe('QueryGenerator#getForeignKeyQuery', () => {
  const queryGenerator = sequelize.getQueryInterface().queryGenerator;

  it('produces a query to get all foreign keys of a table', () => {
    expectsql(() => queryGenerator.getForeignKeyQuery('myTable'), {
      default: notImplementedError,
      'mariadb mysql': `SELECT CONSTRAINT_NAME as constraintName,
        CONSTRAINT_SCHEMA as constraintSchema,
        TABLE_NAME as tableName,
        TABLE_SCHEMA as tableSchema,
        COLUMN_NAME as columnName,
        REFERENCED_TABLE_SCHEMA as referencedTableSchema,
        REFERENCED_TABLE_NAME as referencedTableName,
        REFERENCED_COLUMN_NAME as referencedColumnName
        FROM INFORMATION_SCHEMA.KEY_COLUMN_USAGE
        WHERE TABLE_NAME = 'myTable'
        AND TABLE_SCHEMA = 'sequelize_test'
        AND REFERENCED_TABLE_NAME IS NOT NULL`,
      postgres: `WITH unnested_pg_constraint AS (
        SELECT conname, confrelid, connamespace, conrelid, contype, oid,
        unnest(conkey) AS conkey, unnest(confkey) AS confkey
        FROM pg_constraint)
        SELECT "constraint".conname as "constraintName",
        constraint_schema.nspname as "constraintSchema",
        current_database() as "constraintCatalog",
        "table".relname as "tableName",
        table_schema.nspname as "tableSchema",
        current_database() as "tableCatalog",
        "column".attname as "columnName",
        referenced_table.relname as "referencedTableName",
        referenced_schema.nspname as "referencedTableSchema",
        current_database() as "referencedTableCatalog",
        "referenced_column".attname as "referencedColumnName"
        FROM unnested_pg_constraint "constraint"
        INNER JOIN pg_catalog.pg_class referenced_table ON
        referenced_table.oid = "constraint".confrelid
        INNER JOIN pg_catalog.pg_namespace referenced_schema ON
        referenced_schema.oid = referenced_table.relnamespace
        INNER JOIN pg_catalog.pg_namespace constraint_schema ON
        "constraint".connamespace = constraint_schema.oid
        INNER JOIN pg_catalog.pg_class "table" ON "constraint".conrelid = "table".oid
        INNER JOIN pg_catalog.pg_namespace table_schema ON "table".relnamespace = table_schema.oid
        INNER JOIN pg_catalog.pg_attribute "column" ON
        "column".attnum = "constraint".conkey AND "column".attrelid = "constraint".conrelid
        INNER JOIN pg_catalog.pg_attribute "referenced_column" ON
        "referenced_column".attnum = "constraint".confkey AND
        "referenced_column".attrelid = "constraint".confrelid
        WHERE "constraint".contype = 'f'
        AND "table".relname = 'myTable'
        AND table_schema.nspname = 'public'`,
      mssql: `SELECT OBJ.NAME AS 'constraintName',
        N'sequelize_test' AS 'constraintCatalog',
        SCHEMA_NAME(OBJ.SCHEMA_ID) AS 'constraintSchema',
        TB.NAME AS 'tableName',
        SCHEMA_NAME(TB.SCHEMA_ID) AS 'tableSchema',
        N'sequelize_test' AS 'tableCatalog',
        COL.NAME AS 'columnName',
        SCHEMA_NAME(RTB.SCHEMA_ID) AS 'referencedTableSchema',
        N'sequelize_test' AS 'referencedTableCatalog',
        RTB.NAME AS 'referencedTableName',
        RCOL.NAME AS 'referencedColumnName'
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
      sqlite: `SELECT id as \`constraintName\`,
        'myTable' as \`tableName\`,
        pragma.\`from\` AS \`columnName\`,
        pragma.\`table\` AS \`referencedTableName\`,
        pragma.\`to\` AS \`referencedColumnName\`,
        pragma.\`on_update\`,
        pragma.\`on_delete\`
        FROM pragma_foreign_key_list('myTable') AS pragma;`,
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
        AND R.TABSCHEMA = CURRENT SCHEMA
        GROUP BY R.REFTABSCHEMA,
        R.REFTABNAME, R.TABSCHEMA, R.TABNAME, R.CONSTNAME, R.PK_COLNAMES`,
      ibmi: `SELECT FK_CAT AS "constraintCatalog",
        FK_SCHEM AS "constraintSchema",
        FK_NAME AS "constraintName",
        PKTABLE_CAT AS "referencedTableCatalog",
        PKTABLE_SCHEM AS "referencedTableSchema",
        PKTABLE_NAME AS "referencedTableName",
        PKCOLUMN_NAME AS "referencedColumnName",
        FKTABLE_CAT AS "tableCatalog",
        FKTABLE_SCHEM AS "tableSchema",
        FKTABLE_NAME AS "tableName",
        FKCOLUMN_NAME AS "columnName"
        FROM SYSIBM.SQLFOREIGNKEYS
        WHERE FKTABLE_SCHEM = CURRENT SCHEMA
        AND FKTABLE_NAME = 'myTable'`,
    });
  });

  it('produces a query to get all foreign keys of a table from a model', () => {
    const MyModel = sequelize.define('MyModel', {});

    expectsql(() => queryGenerator.getForeignKeyQuery(MyModel), {
      default: notImplementedError,
      'mariadb mysql': `SELECT CONSTRAINT_NAME as constraintName,
        CONSTRAINT_SCHEMA as constraintSchema,
        TABLE_NAME as tableName,
        TABLE_SCHEMA as tableSchema,
        COLUMN_NAME as columnName,
        REFERENCED_TABLE_SCHEMA as referencedTableSchema,
        REFERENCED_TABLE_NAME as referencedTableName,
        REFERENCED_COLUMN_NAME as referencedColumnName
        FROM INFORMATION_SCHEMA.KEY_COLUMN_USAGE
        WHERE TABLE_NAME = 'MyModels'
        AND TABLE_SCHEMA = 'sequelize_test'
        AND REFERENCED_TABLE_NAME IS NOT NULL`,
      postgres: `WITH unnested_pg_constraint AS (
        SELECT conname, confrelid, connamespace, conrelid, contype, oid,
        unnest(conkey) AS conkey, unnest(confkey) AS confkey
        FROM pg_constraint)
        SELECT "constraint".conname as "constraintName",
        constraint_schema.nspname as "constraintSchema",
        current_database() as "constraintCatalog",
        "table".relname as "tableName",
        table_schema.nspname as "tableSchema",
        current_database() as "tableCatalog",
        "column".attname as "columnName",
        referenced_table.relname as "referencedTableName",
        referenced_schema.nspname as "referencedTableSchema",
        current_database() as "referencedTableCatalog",
        "referenced_column".attname as "referencedColumnName"
        FROM unnested_pg_constraint "constraint"
        INNER JOIN pg_catalog.pg_class referenced_table ON
        referenced_table.oid = "constraint".confrelid
        INNER JOIN pg_catalog.pg_namespace referenced_schema ON
        referenced_schema.oid = referenced_table.relnamespace
        INNER JOIN pg_catalog.pg_namespace constraint_schema ON
        "constraint".connamespace = constraint_schema.oid
        INNER JOIN pg_catalog.pg_class "table" ON "constraint".conrelid = "table".oid
        INNER JOIN pg_catalog.pg_namespace table_schema ON "table".relnamespace = table_schema.oid
        INNER JOIN pg_catalog.pg_attribute "column" ON
        "column".attnum = "constraint".conkey AND "column".attrelid = "constraint".conrelid
        INNER JOIN pg_catalog.pg_attribute "referenced_column" ON
        "referenced_column".attnum = "constraint".confkey AND
        "referenced_column".attrelid = "constraint".confrelid
        WHERE "constraint".contype = 'f'
        AND "table".relname = 'MyModels'
        AND table_schema.nspname = 'public'`,
      mssql: `SELECT OBJ.NAME AS 'constraintName',
        N'sequelize_test' AS 'constraintCatalog',
        SCHEMA_NAME(OBJ.SCHEMA_ID) AS 'constraintSchema',
        TB.NAME AS 'tableName',
        SCHEMA_NAME(TB.SCHEMA_ID) AS 'tableSchema',
        N'sequelize_test' AS 'tableCatalog',
        COL.NAME AS 'columnName',
        SCHEMA_NAME(RTB.SCHEMA_ID) AS 'referencedTableSchema',
        N'sequelize_test' AS 'referencedTableCatalog',
        RTB.NAME AS 'referencedTableName',
        RCOL.NAME AS 'referencedColumnName'
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
        WHERE TB.NAME = N'MyModels'
        AND SCHEMA_NAME(TB.SCHEMA_ID) = N'dbo'`,
      sqlite: `SELECT id as \`constraintName\`,
        'MyModels' as \`tableName\`,
        pragma.\`from\` AS \`columnName\`,
        pragma.\`table\` AS \`referencedTableName\`,
        pragma.\`to\` AS \`referencedColumnName\`,
        pragma.\`on_update\`,
        pragma.\`on_delete\`
        FROM pragma_foreign_key_list('MyModels') AS pragma;`,
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
        AND R.TABNAME = 'MyModels'
        AND R.TABSCHEMA = CURRENT SCHEMA
        GROUP BY R.REFTABSCHEMA,
        R.REFTABNAME, R.TABSCHEMA, R.TABNAME, R.CONSTNAME, R.PK_COLNAMES`,
      ibmi: `SELECT FK_CAT AS "constraintCatalog",
        FK_SCHEM AS "constraintSchema",
        FK_NAME AS "constraintName",
        PKTABLE_CAT AS "referencedTableCatalog",
        PKTABLE_SCHEM AS "referencedTableSchema",
        PKTABLE_NAME AS "referencedTableName",
        PKCOLUMN_NAME AS "referencedColumnName",
        FKTABLE_CAT AS "tableCatalog",
        FKTABLE_SCHEM AS "tableSchema",
        FKTABLE_NAME AS "tableName",
        FKCOLUMN_NAME AS "columnName"
        FROM SYSIBM.SQLFOREIGNKEYS
        WHERE FKTABLE_SCHEM = CURRENT SCHEMA
        AND FKTABLE_NAME = 'MyModels'`,
    });
  });

  it('produces a query to get all foreign keys of a table with schema in tableName object', () => {
    expectsql(() => queryGenerator.getForeignKeyQuery({ tableName: 'myTable', schema: 'mySchema' }), {
      default: notImplementedError,
      'mariadb mysql': `SELECT CONSTRAINT_NAME as constraintName,
        CONSTRAINT_SCHEMA as constraintSchema,
        TABLE_NAME as tableName,
        TABLE_SCHEMA as tableSchema,
        COLUMN_NAME as columnName,
        REFERENCED_TABLE_SCHEMA as referencedTableSchema,
        REFERENCED_TABLE_NAME as referencedTableName,
        REFERENCED_COLUMN_NAME as referencedColumnName
        FROM INFORMATION_SCHEMA.KEY_COLUMN_USAGE
        WHERE TABLE_NAME = 'myTable'
        AND TABLE_SCHEMA = 'mySchema'
        AND REFERENCED_TABLE_NAME IS NOT NULL`,
      postgres: `WITH unnested_pg_constraint AS (
        SELECT conname, confrelid, connamespace, conrelid, contype, oid,
        unnest(conkey) AS conkey, unnest(confkey) AS confkey
        FROM pg_constraint)
        SELECT "constraint".conname as "constraintName",
        constraint_schema.nspname as "constraintSchema",
        current_database() as "constraintCatalog",
        "table".relname as "tableName",
        table_schema.nspname as "tableSchema",
        current_database() as "tableCatalog",
        "column".attname as "columnName",
        referenced_table.relname as "referencedTableName",
        referenced_schema.nspname as "referencedTableSchema",
        current_database() as "referencedTableCatalog",
        "referenced_column".attname as "referencedColumnName"
        FROM unnested_pg_constraint "constraint"
        INNER JOIN pg_catalog.pg_class referenced_table ON
        referenced_table.oid = "constraint".confrelid
        INNER JOIN pg_catalog.pg_namespace referenced_schema ON
        referenced_schema.oid = referenced_table.relnamespace
        INNER JOIN pg_catalog.pg_namespace constraint_schema ON
        "constraint".connamespace = constraint_schema.oid
        INNER JOIN pg_catalog.pg_class "table" ON "constraint".conrelid = "table".oid
        INNER JOIN pg_catalog.pg_namespace table_schema ON "table".relnamespace = table_schema.oid
        INNER JOIN pg_catalog.pg_attribute "column" ON
        "column".attnum = "constraint".conkey AND "column".attrelid = "constraint".conrelid
        INNER JOIN pg_catalog.pg_attribute "referenced_column" ON
        "referenced_column".attnum = "constraint".confkey AND
        "referenced_column".attrelid = "constraint".confrelid
        WHERE "constraint".contype = 'f'
        AND "table".relname = 'myTable'
        AND table_schema.nspname = 'mySchema'`,
      mssql: `SELECT OBJ.NAME AS 'constraintName',
        N'sequelize_test' AS 'constraintCatalog',
        SCHEMA_NAME(OBJ.SCHEMA_ID) AS 'constraintSchema',
        TB.NAME AS 'tableName',
        SCHEMA_NAME(TB.SCHEMA_ID) AS 'tableSchema',
        N'sequelize_test' AS 'tableCatalog',
        COL.NAME AS 'columnName',
        SCHEMA_NAME(RTB.SCHEMA_ID) AS 'referencedTableSchema',
        N'sequelize_test' AS 'referencedTableCatalog',
        RTB.NAME AS 'referencedTableName',
        RCOL.NAME AS 'referencedColumnName'
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
      sqlite: `SELECT id as \`constraintName\`,
        'mySchema.myTable' as \`tableName\`,
        pragma.\`from\` AS \`columnName\`,
        pragma.\`table\` AS \`referencedTableName\`,
        pragma.\`to\` AS \`referencedColumnName\`,
        pragma.\`on_update\`,
        pragma.\`on_delete\`
        FROM pragma_foreign_key_list('mySchema.myTable') AS pragma;`,
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
      ibmi: `SELECT FK_CAT AS "constraintCatalog",
        FK_SCHEM AS "constraintSchema",
        FK_NAME AS "constraintName",
        PKTABLE_CAT AS "referencedTableCatalog",
        PKTABLE_SCHEM AS "referencedTableSchema",
        PKTABLE_NAME AS "referencedTableName",
        PKCOLUMN_NAME AS "referencedColumnName",
        FKTABLE_CAT AS "tableCatalog",
        FKTABLE_SCHEM AS "tableSchema",
        FKTABLE_NAME AS "tableName",
        FKCOLUMN_NAME AS "columnName"
        FROM SYSIBM.SQLFOREIGNKEYS
        WHERE FKTABLE_SCHEM = 'mySchema'
        AND FKTABLE_NAME = 'myTable'`,
    });
  });

  it('produces a query to get all foreign keys of a table with default schema in tableName object', () => {
    expectsql(() => queryGenerator.getForeignKeyQuery({ tableName: 'myTable', schema: dialect.getDefaultSchema() }), {
      default: notImplementedError,
      'mariadb mysql': `SELECT CONSTRAINT_NAME as constraintName,
        CONSTRAINT_SCHEMA as constraintSchema,
        TABLE_NAME as tableName,
        TABLE_SCHEMA as tableSchema,
        COLUMN_NAME as columnName,
        REFERENCED_TABLE_SCHEMA as referencedTableSchema,
        REFERENCED_TABLE_NAME as referencedTableName,
        REFERENCED_COLUMN_NAME as referencedColumnName
        FROM INFORMATION_SCHEMA.KEY_COLUMN_USAGE
        WHERE TABLE_NAME = 'myTable'
        AND TABLE_SCHEMA = 'sequelize_test'
        AND REFERENCED_TABLE_NAME IS NOT NULL`,
      postgres: `WITH unnested_pg_constraint AS (
        SELECT conname, confrelid, connamespace, conrelid, contype, oid,
        unnest(conkey) AS conkey, unnest(confkey) AS confkey
        FROM pg_constraint)
        SELECT "constraint".conname as "constraintName",
        constraint_schema.nspname as "constraintSchema",
        current_database() as "constraintCatalog",
        "table".relname as "tableName",
        table_schema.nspname as "tableSchema",
        current_database() as "tableCatalog",
        "column".attname as "columnName",
        referenced_table.relname as "referencedTableName",
        referenced_schema.nspname as "referencedTableSchema",
        current_database() as "referencedTableCatalog",
        "referenced_column".attname as "referencedColumnName"
        FROM unnested_pg_constraint "constraint"
        INNER JOIN pg_catalog.pg_class referenced_table ON
        referenced_table.oid = "constraint".confrelid
        INNER JOIN pg_catalog.pg_namespace referenced_schema ON
        referenced_schema.oid = referenced_table.relnamespace
        INNER JOIN pg_catalog.pg_namespace constraint_schema ON
        "constraint".connamespace = constraint_schema.oid
        INNER JOIN pg_catalog.pg_class "table" ON "constraint".conrelid = "table".oid
        INNER JOIN pg_catalog.pg_namespace table_schema ON "table".relnamespace = table_schema.oid
        INNER JOIN pg_catalog.pg_attribute "column" ON
        "column".attnum = "constraint".conkey AND "column".attrelid = "constraint".conrelid
        INNER JOIN pg_catalog.pg_attribute "referenced_column" ON
        "referenced_column".attnum = "constraint".confkey AND
        "referenced_column".attrelid = "constraint".confrelid
        WHERE "constraint".contype = 'f'
        AND "table".relname = 'myTable'
        AND table_schema.nspname = 'public'`,
      mssql: `SELECT OBJ.NAME AS 'constraintName',
        N'sequelize_test' AS 'constraintCatalog',
        SCHEMA_NAME(OBJ.SCHEMA_ID) AS 'constraintSchema',
        TB.NAME AS 'tableName',
        SCHEMA_NAME(TB.SCHEMA_ID) AS 'tableSchema',
        N'sequelize_test' AS 'tableCatalog',
        COL.NAME AS 'columnName',
        SCHEMA_NAME(RTB.SCHEMA_ID) AS 'referencedTableSchema',
        N'sequelize_test' AS 'referencedTableCatalog',
        RTB.NAME AS 'referencedTableName',
        RCOL.NAME AS 'referencedColumnName'
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
      sqlite: `SELECT id as \`constraintName\`,
        'myTable' as \`tableName\`,
        pragma.\`from\` AS \`columnName\`,
        pragma.\`table\` AS \`referencedTableName\`,
        pragma.\`to\` AS \`referencedColumnName\`,
        pragma.\`on_update\`,
        pragma.\`on_delete\`
        FROM pragma_foreign_key_list('myTable') AS pragma;`,
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
        AND R.TABSCHEMA = CURRENT SCHEMA
        GROUP BY R.REFTABSCHEMA,
        R.REFTABNAME, R.TABSCHEMA, R.TABNAME, R.CONSTNAME, R.PK_COLNAMES`,
      ibmi: `SELECT FK_CAT AS "constraintCatalog",
        FK_SCHEM AS "constraintSchema",
        FK_NAME AS "constraintName",
        PKTABLE_CAT AS "referencedTableCatalog",
        PKTABLE_SCHEM AS "referencedTableSchema",
        PKTABLE_NAME AS "referencedTableName",
        PKCOLUMN_NAME AS "referencedColumnName",
        FKTABLE_CAT AS "tableCatalog",
        FKTABLE_SCHEM AS "tableSchema",
        FKTABLE_NAME AS "tableName",
        FKCOLUMN_NAME AS "columnName"
        FROM SYSIBM.SQLFOREIGNKEYS
        WHERE FKTABLE_SCHEM = CURRENT SCHEMA
        AND FKTABLE_NAME = 'myTable'`,
    });
  });

  it('produces a query to get all foreign keys of a table with globally set schema', () => {
    const sequelizeSchema = createSequelizeInstance({ schema: 'mySchema' });
    const queryGeneratorSchema = sequelizeSchema.getQueryInterface().queryGenerator;

    expectsql(() => queryGeneratorSchema.getForeignKeyQuery('myTable'), {
      default: notImplementedError,
      'mariadb mysql': `SELECT CONSTRAINT_NAME as constraintName,
        CONSTRAINT_SCHEMA as constraintSchema,
        TABLE_NAME as tableName,
        TABLE_SCHEMA as tableSchema,
        COLUMN_NAME as columnName,
        REFERENCED_TABLE_SCHEMA as referencedTableSchema,
        REFERENCED_TABLE_NAME as referencedTableName,
        REFERENCED_COLUMN_NAME as referencedColumnName
        FROM INFORMATION_SCHEMA.KEY_COLUMN_USAGE
        WHERE TABLE_NAME = 'myTable'
        AND TABLE_SCHEMA = 'mySchema'
        AND REFERENCED_TABLE_NAME IS NOT NULL`,
      postgres: `WITH unnested_pg_constraint AS (
        SELECT conname, confrelid, connamespace, conrelid, contype, oid,
        unnest(conkey) AS conkey, unnest(confkey) AS confkey
        FROM pg_constraint)
        SELECT "constraint".conname as "constraintName",
        constraint_schema.nspname as "constraintSchema",
        current_database() as "constraintCatalog",
        "table".relname as "tableName",
        table_schema.nspname as "tableSchema",
        current_database() as "tableCatalog",
        "column".attname as "columnName",
        referenced_table.relname as "referencedTableName",
        referenced_schema.nspname as "referencedTableSchema",
        current_database() as "referencedTableCatalog",
        "referenced_column".attname as "referencedColumnName"
        FROM unnested_pg_constraint "constraint"
        INNER JOIN pg_catalog.pg_class referenced_table ON
        referenced_table.oid = "constraint".confrelid
        INNER JOIN pg_catalog.pg_namespace referenced_schema ON
        referenced_schema.oid = referenced_table.relnamespace
        INNER JOIN pg_catalog.pg_namespace constraint_schema ON
        "constraint".connamespace = constraint_schema.oid
        INNER JOIN pg_catalog.pg_class "table" ON "constraint".conrelid = "table".oid
        INNER JOIN pg_catalog.pg_namespace table_schema ON "table".relnamespace = table_schema.oid
        INNER JOIN pg_catalog.pg_attribute "column" ON
        "column".attnum = "constraint".conkey AND "column".attrelid = "constraint".conrelid
        INNER JOIN pg_catalog.pg_attribute "referenced_column" ON
        "referenced_column".attnum = "constraint".confkey AND
        "referenced_column".attrelid = "constraint".confrelid
        WHERE "constraint".contype = 'f'
        AND "table".relname = 'myTable'
        AND table_schema.nspname = 'mySchema'`,
      mssql: `SELECT OBJ.NAME AS 'constraintName',
        N'sequelize_test' AS 'constraintCatalog',
        SCHEMA_NAME(OBJ.SCHEMA_ID) AS 'constraintSchema',
        TB.NAME AS 'tableName',
        SCHEMA_NAME(TB.SCHEMA_ID) AS 'tableSchema',
        N'sequelize_test' AS 'tableCatalog',
        COL.NAME AS 'columnName',
        SCHEMA_NAME(RTB.SCHEMA_ID) AS 'referencedTableSchema',
        N'sequelize_test' AS 'referencedTableCatalog',
        RTB.NAME AS 'referencedTableName',
        RCOL.NAME AS 'referencedColumnName'
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
      sqlite: `SELECT id as \`constraintName\`,
        'mySchema.myTable' as \`tableName\`,
        pragma.\`from\` AS \`columnName\`,
        pragma.\`table\` AS \`referencedTableName\`,
        pragma.\`to\` AS \`referencedColumnName\`,
        pragma.\`on_update\`,
        pragma.\`on_delete\`
        FROM pragma_foreign_key_list('mySchema.myTable') AS pragma;`,
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
      ibmi: `SELECT FK_CAT AS "constraintCatalog",
        FK_SCHEM AS "constraintSchema",
        FK_NAME AS "constraintName",
        PKTABLE_CAT AS "referencedTableCatalog",
        PKTABLE_SCHEM AS "referencedTableSchema",
        PKTABLE_NAME AS "referencedTableName",
        PKCOLUMN_NAME AS "referencedColumnName",
        FKTABLE_CAT AS "tableCatalog",
        FKTABLE_SCHEM AS "tableSchema",
        FKTABLE_NAME AS "tableName",
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

    expectsql(() => queryGenerator.getForeignKeyQuery({ tableName: 'myTable', schema: 'mySchema', delimiter: 'custom' }), {
      sqlite: `SELECT id as \`constraintName\`,
        'mySchemacustommyTable' as \`tableName\`,
        pragma.\`from\` AS \`columnName\`,
        pragma.\`table\` AS \`referencedTableName\`,
        pragma.\`to\` AS \`referencedColumnName\`,
        pragma.\`on_update\`,
        pragma.\`on_delete\`
        FROM pragma_foreign_key_list('mySchemacustommyTable') AS pragma;`,
    });
  });

  it('produces a query to get the foreign key constraint of a given column', () => {
    expectsql(() => queryGenerator.getForeignKeyQuery('myTable', 'myColumn'), {
      default: notImplementedError,
      'mariadb mysql': `SELECT CONSTRAINT_NAME as constraintName,
        CONSTRAINT_SCHEMA as constraintSchema,
        TABLE_NAME as tableName,
        TABLE_SCHEMA as tableSchema,
        COLUMN_NAME as columnName,
        REFERENCED_TABLE_SCHEMA as referencedTableSchema,
        REFERENCED_TABLE_NAME as referencedTableName,
        REFERENCED_COLUMN_NAME as referencedColumnName
        FROM INFORMATION_SCHEMA.KEY_COLUMN_USAGE
        WHERE TABLE_NAME = 'myTable'
        AND TABLE_SCHEMA = 'sequelize_test'
        AND COLUMN_NAME = 'myColumn'
        AND REFERENCED_TABLE_NAME IS NOT NULL`,
      postgres: `WITH unnested_pg_constraint AS (
        SELECT conname, confrelid, connamespace, conrelid, contype, oid,
        unnest(conkey) AS conkey, unnest(confkey) AS confkey
        FROM pg_constraint)
        SELECT "constraint".conname as "constraintName",
        constraint_schema.nspname as "constraintSchema",
        current_database() as "constraintCatalog",
        "table".relname as "tableName",
        table_schema.nspname as "tableSchema",
        current_database() as "tableCatalog",
        "column".attname as "columnName",
        referenced_table.relname as "referencedTableName",
        referenced_schema.nspname as "referencedTableSchema",
        current_database() as "referencedTableCatalog",
        "referenced_column".attname as "referencedColumnName"
        FROM unnested_pg_constraint "constraint"
        INNER JOIN pg_catalog.pg_class referenced_table ON
        referenced_table.oid = "constraint".confrelid
        INNER JOIN pg_catalog.pg_namespace referenced_schema ON
        referenced_schema.oid = referenced_table.relnamespace
        INNER JOIN pg_catalog.pg_namespace constraint_schema ON
        "constraint".connamespace = constraint_schema.oid
        INNER JOIN pg_catalog.pg_class "table" ON "constraint".conrelid = "table".oid
        INNER JOIN pg_catalog.pg_namespace table_schema ON "table".relnamespace = table_schema.oid
        INNER JOIN pg_catalog.pg_attribute "column" ON
        "column".attnum = "constraint".conkey AND "column".attrelid = "constraint".conrelid
        INNER JOIN pg_catalog.pg_attribute "referenced_column" ON
        "referenced_column".attnum = "constraint".confkey AND
        "referenced_column".attrelid = "constraint".confrelid
        WHERE "constraint".contype = 'f'
        AND "table".relname = 'myTable'
        AND table_schema.nspname = 'public'
        AND "column".attname = 'myColumn';`,
      mssql: `SELECT OBJ.NAME AS 'constraintName',
        N'sequelize_test' AS 'constraintCatalog',
        SCHEMA_NAME(OBJ.SCHEMA_ID) AS 'constraintSchema',
        TB.NAME AS 'tableName',
        SCHEMA_NAME(TB.SCHEMA_ID) AS 'tableSchema',
        N'sequelize_test' AS 'tableCatalog',
        COL.NAME AS 'columnName',
        SCHEMA_NAME(RTB.SCHEMA_ID) AS 'referencedTableSchema',
        N'sequelize_test' AS 'referencedTableCatalog',
        RTB.NAME AS 'referencedTableName',
        RCOL.NAME AS 'referencedColumnName'
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
        AND COL.NAME = N'myColumn'
        AND SCHEMA_NAME(TB.SCHEMA_ID) = N'dbo'`,
      sqlite: notSupportedError,
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
        AND R.TABSCHEMA = CURRENT SCHEMA
        AND C.COLNAME = 'myColumn'
        GROUP BY R.REFTABSCHEMA,
        R.REFTABNAME, R.TABSCHEMA, R.TABNAME, R.CONSTNAME, R.PK_COLNAMES`,
      ibmi: `SELECT FK_CAT AS "constraintCatalog",
        FK_SCHEM AS "constraintSchema",
        FK_NAME AS "constraintName",
        PKTABLE_CAT AS "referencedTableCatalog",
        PKTABLE_SCHEM AS "referencedTableSchema",
        PKTABLE_NAME AS "referencedTableName",
        PKCOLUMN_NAME AS "referencedColumnName",
        FKTABLE_CAT AS "tableCatalog",
        FKTABLE_SCHEM AS "tableSchema",
        FKTABLE_NAME AS "tableName",
        FKCOLUMN_NAME AS "columnName"
        FROM SYSIBM.SQLFOREIGNKEYS
        WHERE FKTABLE_SCHEM = CURRENT SCHEMA
        AND FKTABLE_NAME = 'myTable'
        AND FKCOLUMN_NAME = 'myColumn'`,
    });
  });
});
