import { createSequelizeInstance, expectsql, sequelize } from '../../support';

const dialect = sequelize.dialect;

describe('QueryGenerator#showIndexesQuery', () => {
  const queryGenerator = sequelize.queryGenerator;

  it('produces a SHOW INDEX query from a table', () => {
    expectsql(() => queryGenerator.showIndexesQuery('myTable'), {
      default: `SHOW INDEX FROM [myTable]`,
      postgres: `SELECT i.relname AS name, ix.indisprimary AS primary, ix.indisunique AS unique, ix.indkey[:ix.indnkeyatts-1] AS index_fields,
        ix.indkey[ix.indnkeyatts:] AS include_fields, array_agg(a.attnum) as column_indexes, array_agg(a.attname) AS column_names,
        pg_get_indexdef(ix.indexrelid) AS definition FROM pg_class t, pg_class i, pg_index ix, pg_attribute a, pg_namespace s
        WHERE t.oid = ix.indrelid AND i.oid = ix.indexrelid AND a.attrelid = t.oid AND
        t.relkind = 'r' and t.relname = 'myTable' AND s.oid = t.relnamespace AND s.nspname = 'public'
        GROUP BY i.relname, ix.indexrelid, ix.indisprimary, ix.indisunique, ix.indkey, ix.indnkeyatts ORDER BY i.relname;`,
      mssql: `SELECT I.[name] AS [index_name], I.[type_desc] AS [index_type], C.[name] AS [column_name], IC.[is_descending_key], IC.[is_included_column], I.[is_unique], I.[is_primary_key], I.[is_unique_constraint]
        FROM sys.indexes I
        INNER JOIN sys.index_columns IC ON IC.index_id = I.index_id AND IC.object_id = I.object_id
        INNER JOIN sys.columns C ON IC.object_id = C.object_id AND IC.column_id = C.column_id
        WHERE I.[object_id] = OBJECT_ID(N'dbo.myTable') ORDER BY I.[name];`,
      sqlite3: 'PRAGMA INDEX_LIST(`myTable`)',
      snowflake: `SELECT '' FROM DUAL`,
      db2: `SELECT i.INDNAME AS "name", i.TABNAME AS "tableName", i.UNIQUERULE AS "keyType", i.INDEXTYPE AS "type", c.COLNAME AS "columnName", c.COLORDER AS "columnOrder" FROM SYSCAT.INDEXES i INNER JOIN SYSCAT.INDEXCOLUSE c ON i.INDNAME = c.INDNAME AND i.INDSCHEMA = c.INDSCHEMA WHERE TABNAME = 'myTable' AND TABSCHEMA = 'DB2INST1' ORDER BY i.INDNAME, c.COLSEQ;`,
      ibmi: `select QSYS2.SYSCSTCOL.CONSTRAINT_NAME as NAME, QSYS2.SYSCSTCOL.COLUMN_NAME, QSYS2.SYSCST.CONSTRAINT_TYPE, QSYS2.SYSCST.TABLE_SCHEMA,
        QSYS2.SYSCST.TABLE_NAME from QSYS2.SYSCSTCOL left outer join QSYS2.SYSCST on QSYS2.SYSCSTCOL.TABLE_SCHEMA = QSYS2.SYSCST.TABLE_SCHEMA and
        QSYS2.SYSCSTCOL.TABLE_NAME = QSYS2.SYSCST.TABLE_NAME and QSYS2.SYSCSTCOL.CONSTRAINT_NAME = QSYS2.SYSCST.CONSTRAINT_NAME where
        QSYS2.SYSCSTCOL.TABLE_SCHEMA = CURRENT SCHEMA and QSYS2.SYSCSTCOL.TABLE_NAME = 'myTable' union select QSYS2.SYSKEYS.INDEX_NAME AS NAME,
        QSYS2.SYSKEYS.COLUMN_NAME, CAST('INDEX' AS VARCHAR(11)), QSYS2.SYSINDEXES.TABLE_SCHEMA, QSYS2.SYSINDEXES.TABLE_NAME from QSYS2.SYSKEYS
        left outer join QSYS2.SYSINDEXES on QSYS2.SYSKEYS.INDEX_NAME = QSYS2.SYSINDEXES.INDEX_NAME where QSYS2.SYSINDEXES.TABLE_SCHEMA = CURRENT SCHEMA
        and QSYS2.SYSINDEXES.TABLE_NAME = 'myTable'`,
    });
  });

  it('produces a SHOW INDEX query from a model', () => {
    const MyModel = sequelize.define('MyModel', {});

    expectsql(() => queryGenerator.showIndexesQuery(MyModel), {
      default: `SHOW INDEX FROM [MyModels]`,
      postgres: `SELECT i.relname AS name, ix.indisprimary AS primary, ix.indisunique AS unique, ix.indkey[:ix.indnkeyatts-1] AS index_fields,
        ix.indkey[ix.indnkeyatts:] AS include_fields, array_agg(a.attnum) as column_indexes, array_agg(a.attname) AS column_names,
        pg_get_indexdef(ix.indexrelid) AS definition FROM pg_class t, pg_class i, pg_index ix, pg_attribute a, pg_namespace s
        WHERE t.oid = ix.indrelid AND i.oid = ix.indexrelid AND a.attrelid = t.oid AND
        t.relkind = 'r' and t.relname = 'MyModels' AND s.oid = t.relnamespace AND s.nspname = 'public'
        GROUP BY i.relname, ix.indexrelid, ix.indisprimary, ix.indisunique, ix.indkey, ix.indnkeyatts ORDER BY i.relname;`,
      mssql: `SELECT I.[name] AS [index_name], I.[type_desc] AS [index_type], C.[name] AS [column_name], IC.[is_descending_key], IC.[is_included_column], I.[is_unique], I.[is_primary_key], I.[is_unique_constraint]
        FROM sys.indexes I
        INNER JOIN sys.index_columns IC ON IC.index_id = I.index_id AND IC.object_id = I.object_id
        INNER JOIN sys.columns C ON IC.object_id = C.object_id AND IC.column_id = C.column_id
        WHERE I.[object_id] = OBJECT_ID(N'dbo.MyModels') ORDER BY I.[name];`,
      sqlite3: 'PRAGMA INDEX_LIST(`MyModels`)',
      snowflake: `SELECT '' FROM DUAL`,
      db2: `SELECT i.INDNAME AS "name", i.TABNAME AS "tableName", i.UNIQUERULE AS "keyType", i.INDEXTYPE AS "type", c.COLNAME AS "columnName", c.COLORDER AS "columnOrder" FROM SYSCAT.INDEXES i INNER JOIN SYSCAT.INDEXCOLUSE c ON i.INDNAME = c.INDNAME AND i.INDSCHEMA = c.INDSCHEMA WHERE TABNAME = 'MyModels' AND TABSCHEMA = 'DB2INST1' ORDER BY i.INDNAME, c.COLSEQ;`,
      ibmi: `select QSYS2.SYSCSTCOL.CONSTRAINT_NAME as NAME, QSYS2.SYSCSTCOL.COLUMN_NAME, QSYS2.SYSCST.CONSTRAINT_TYPE, QSYS2.SYSCST.TABLE_SCHEMA,
        QSYS2.SYSCST.TABLE_NAME from QSYS2.SYSCSTCOL left outer join QSYS2.SYSCST on QSYS2.SYSCSTCOL.TABLE_SCHEMA = QSYS2.SYSCST.TABLE_SCHEMA and
        QSYS2.SYSCSTCOL.TABLE_NAME = QSYS2.SYSCST.TABLE_NAME and QSYS2.SYSCSTCOL.CONSTRAINT_NAME = QSYS2.SYSCST.CONSTRAINT_NAME where
        QSYS2.SYSCSTCOL.TABLE_SCHEMA = CURRENT SCHEMA and QSYS2.SYSCSTCOL.TABLE_NAME = 'MyModels' union select QSYS2.SYSKEYS.INDEX_NAME AS NAME,
        QSYS2.SYSKEYS.COLUMN_NAME, CAST('INDEX' AS VARCHAR(11)), QSYS2.SYSINDEXES.TABLE_SCHEMA, QSYS2.SYSINDEXES.TABLE_NAME from QSYS2.SYSKEYS
        left outer join QSYS2.SYSINDEXES on QSYS2.SYSKEYS.INDEX_NAME = QSYS2.SYSINDEXES.INDEX_NAME where QSYS2.SYSINDEXES.TABLE_SCHEMA = CURRENT SCHEMA
        and QSYS2.SYSINDEXES.TABLE_NAME = 'MyModels'`,
    });
  });

  it('produces a SHOW INDEX query from a model definition', () => {
    const MyModel = sequelize.define('MyModel', {});
    const myDefinition = MyModel.modelDefinition;

    expectsql(() => queryGenerator.showIndexesQuery(myDefinition), {
      default: `SHOW INDEX FROM [MyModels]`,
      postgres: `SELECT i.relname AS name, ix.indisprimary AS primary, ix.indisunique AS unique, ix.indkey[:ix.indnkeyatts-1] AS index_fields,
        ix.indkey[ix.indnkeyatts:] AS include_fields, array_agg(a.attnum) as column_indexes, array_agg(a.attname) AS column_names,
        pg_get_indexdef(ix.indexrelid) AS definition FROM pg_class t, pg_class i, pg_index ix, pg_attribute a, pg_namespace s
        WHERE t.oid = ix.indrelid AND i.oid = ix.indexrelid AND a.attrelid = t.oid AND
        t.relkind = 'r' and t.relname = 'MyModels' AND s.oid = t.relnamespace AND s.nspname = 'public'
        GROUP BY i.relname, ix.indexrelid, ix.indisprimary, ix.indisunique, ix.indkey, ix.indnkeyatts ORDER BY i.relname;`,
      mssql: `SELECT I.[name] AS [index_name], I.[type_desc] AS [index_type], C.[name] AS [column_name], IC.[is_descending_key], IC.[is_included_column], I.[is_unique], I.[is_primary_key], I.[is_unique_constraint]
        FROM sys.indexes I
        INNER JOIN sys.index_columns IC ON IC.index_id = I.index_id AND IC.object_id = I.object_id
        INNER JOIN sys.columns C ON IC.object_id = C.object_id AND IC.column_id = C.column_id
        WHERE I.[object_id] = OBJECT_ID(N'dbo.MyModels') ORDER BY I.[name];`,
      sqlite3: 'PRAGMA INDEX_LIST(`MyModels`)',
      snowflake: `SELECT '' FROM DUAL`,
      db2: `SELECT i.INDNAME AS "name", i.TABNAME AS "tableName", i.UNIQUERULE AS "keyType", i.INDEXTYPE AS "type", c.COLNAME AS "columnName", c.COLORDER AS "columnOrder" FROM SYSCAT.INDEXES i INNER JOIN SYSCAT.INDEXCOLUSE c ON i.INDNAME = c.INDNAME AND i.INDSCHEMA = c.INDSCHEMA WHERE TABNAME = 'MyModels' AND TABSCHEMA = 'DB2INST1' ORDER BY i.INDNAME, c.COLSEQ;`,
      ibmi: `select QSYS2.SYSCSTCOL.CONSTRAINT_NAME as NAME, QSYS2.SYSCSTCOL.COLUMN_NAME, QSYS2.SYSCST.CONSTRAINT_TYPE, QSYS2.SYSCST.TABLE_SCHEMA,
        QSYS2.SYSCST.TABLE_NAME from QSYS2.SYSCSTCOL left outer join QSYS2.SYSCST on QSYS2.SYSCSTCOL.TABLE_SCHEMA = QSYS2.SYSCST.TABLE_SCHEMA and
        QSYS2.SYSCSTCOL.TABLE_NAME = QSYS2.SYSCST.TABLE_NAME and QSYS2.SYSCSTCOL.CONSTRAINT_NAME = QSYS2.SYSCST.CONSTRAINT_NAME where
        QSYS2.SYSCSTCOL.TABLE_SCHEMA = CURRENT SCHEMA and QSYS2.SYSCSTCOL.TABLE_NAME = 'MyModels' union select QSYS2.SYSKEYS.INDEX_NAME AS NAME,
        QSYS2.SYSKEYS.COLUMN_NAME, CAST('INDEX' AS VARCHAR(11)), QSYS2.SYSINDEXES.TABLE_SCHEMA, QSYS2.SYSINDEXES.TABLE_NAME from QSYS2.SYSKEYS
        left outer join QSYS2.SYSINDEXES on QSYS2.SYSKEYS.INDEX_NAME = QSYS2.SYSINDEXES.INDEX_NAME where QSYS2.SYSINDEXES.TABLE_SCHEMA = CURRENT SCHEMA
        and QSYS2.SYSINDEXES.TABLE_NAME = 'MyModels'`,
    });
  });

  it('produces a SHOW INDEX query from a table and schema', () => {
    expectsql(() => queryGenerator.showIndexesQuery({ tableName: 'myTable', schema: 'mySchema' }), {
      default: `SHOW INDEX FROM [mySchema].[myTable]`,
      postgres: `SELECT i.relname AS name, ix.indisprimary AS primary, ix.indisunique AS unique, ix.indkey[:ix.indnkeyatts-1] AS index_fields,
        ix.indkey[ix.indnkeyatts:] AS include_fields, array_agg(a.attnum) as column_indexes, array_agg(a.attname) AS column_names,
        pg_get_indexdef(ix.indexrelid) AS definition FROM pg_class t, pg_class i, pg_index ix, pg_attribute a, pg_namespace s
        WHERE t.oid = ix.indrelid AND i.oid = ix.indexrelid AND a.attrelid = t.oid AND
        t.relkind = 'r' and t.relname = 'myTable' AND s.oid = t.relnamespace AND s.nspname = 'mySchema'
        GROUP BY i.relname, ix.indexrelid, ix.indisprimary, ix.indisunique, ix.indkey, ix.indnkeyatts ORDER BY i.relname;`,
      mssql: `SELECT I.[name] AS [index_name], I.[type_desc] AS [index_type], C.[name] AS [column_name], IC.[is_descending_key], IC.[is_included_column], I.[is_unique], I.[is_primary_key], I.[is_unique_constraint]
        FROM sys.indexes I
        INNER JOIN sys.index_columns IC ON IC.index_id = I.index_id AND IC.object_id = I.object_id
        INNER JOIN sys.columns C ON IC.object_id = C.object_id AND IC.column_id = C.column_id
        WHERE I.[object_id] = OBJECT_ID(N'mySchema.myTable') ORDER BY I.[name];`,
      sqlite3: 'PRAGMA INDEX_LIST(`mySchema.myTable`)',
      snowflake: `SELECT '' FROM DUAL`,
      db2: `SELECT i.INDNAME AS "name", i.TABNAME AS "tableName", i.UNIQUERULE AS "keyType", i.INDEXTYPE AS "type", c.COLNAME AS "columnName", c.COLORDER AS "columnOrder" FROM SYSCAT.INDEXES i INNER JOIN SYSCAT.INDEXCOLUSE c ON i.INDNAME = c.INDNAME AND i.INDSCHEMA = c.INDSCHEMA WHERE TABNAME = 'myTable' AND TABSCHEMA = 'mySchema' ORDER BY i.INDNAME, c.COLSEQ;`,
      ibmi: `select QSYS2.SYSCSTCOL.CONSTRAINT_NAME as NAME, QSYS2.SYSCSTCOL.COLUMN_NAME, QSYS2.SYSCST.CONSTRAINT_TYPE, QSYS2.SYSCST.TABLE_SCHEMA,
        QSYS2.SYSCST.TABLE_NAME from QSYS2.SYSCSTCOL left outer join QSYS2.SYSCST on QSYS2.SYSCSTCOL.TABLE_SCHEMA = QSYS2.SYSCST.TABLE_SCHEMA and
        QSYS2.SYSCSTCOL.TABLE_NAME = QSYS2.SYSCST.TABLE_NAME and QSYS2.SYSCSTCOL.CONSTRAINT_NAME = QSYS2.SYSCST.CONSTRAINT_NAME where
        QSYS2.SYSCSTCOL.TABLE_SCHEMA = 'mySchema' and QSYS2.SYSCSTCOL.TABLE_NAME = 'myTable' union select QSYS2.SYSKEYS.INDEX_NAME AS NAME,
        QSYS2.SYSKEYS.COLUMN_NAME, CAST('INDEX' AS VARCHAR(11)), QSYS2.SYSINDEXES.TABLE_SCHEMA, QSYS2.SYSINDEXES.TABLE_NAME from QSYS2.SYSKEYS
        left outer join QSYS2.SYSINDEXES on QSYS2.SYSKEYS.INDEX_NAME = QSYS2.SYSINDEXES.INDEX_NAME where QSYS2.SYSINDEXES.TABLE_SCHEMA = 'mySchema'
        and QSYS2.SYSINDEXES.TABLE_NAME = 'myTable'`,
    });
  });

  it('produces a SHOW INDEX query from a table and default schema', () => {
    expectsql(
      () =>
        queryGenerator.showIndexesQuery({
          tableName: 'myTable',
          schema: dialect.getDefaultSchema(),
        }),
      {
        default: `SHOW INDEX FROM [myTable]`,
        postgres: `SELECT i.relname AS name, ix.indisprimary AS primary, ix.indisunique AS unique, ix.indkey[:ix.indnkeyatts-1] AS index_fields,
        ix.indkey[ix.indnkeyatts:] AS include_fields, array_agg(a.attnum) as column_indexes, array_agg(a.attname) AS column_names,
        pg_get_indexdef(ix.indexrelid) AS definition FROM pg_class t, pg_class i, pg_index ix, pg_attribute a, pg_namespace s
        WHERE t.oid = ix.indrelid AND i.oid = ix.indexrelid AND a.attrelid = t.oid AND
        t.relkind = 'r' and t.relname = 'myTable' AND s.oid = t.relnamespace AND s.nspname = 'public'
        GROUP BY i.relname, ix.indexrelid, ix.indisprimary, ix.indisunique, ix.indkey, ix.indnkeyatts ORDER BY i.relname;`,
        mssql: `SELECT I.[name] AS [index_name], I.[type_desc] AS [index_type], C.[name] AS [column_name], IC.[is_descending_key], IC.[is_included_column], I.[is_unique], I.[is_primary_key], I.[is_unique_constraint]
        FROM sys.indexes I
        INNER JOIN sys.index_columns IC ON IC.index_id = I.index_id AND IC.object_id = I.object_id
        INNER JOIN sys.columns C ON IC.object_id = C.object_id AND IC.column_id = C.column_id
        WHERE I.[object_id] = OBJECT_ID(N'dbo.myTable') ORDER BY I.[name];`,
        sqlite3: 'PRAGMA INDEX_LIST(`myTable`)',
        snowflake: `SELECT '' FROM DUAL`,
        db2: `SELECT i.INDNAME AS "name", i.TABNAME AS "tableName", i.UNIQUERULE AS "keyType", i.INDEXTYPE AS "type", c.COLNAME AS "columnName", c.COLORDER AS "columnOrder" FROM SYSCAT.INDEXES i INNER JOIN SYSCAT.INDEXCOLUSE c ON i.INDNAME = c.INDNAME AND i.INDSCHEMA = c.INDSCHEMA WHERE TABNAME = 'myTable' AND TABSCHEMA = 'DB2INST1' ORDER BY i.INDNAME, c.COLSEQ;`,
        ibmi: `select QSYS2.SYSCSTCOL.CONSTRAINT_NAME as NAME, QSYS2.SYSCSTCOL.COLUMN_NAME, QSYS2.SYSCST.CONSTRAINT_TYPE, QSYS2.SYSCST.TABLE_SCHEMA,
        QSYS2.SYSCST.TABLE_NAME from QSYS2.SYSCSTCOL left outer join QSYS2.SYSCST on QSYS2.SYSCSTCOL.TABLE_SCHEMA = QSYS2.SYSCST.TABLE_SCHEMA and
        QSYS2.SYSCSTCOL.TABLE_NAME = QSYS2.SYSCST.TABLE_NAME and QSYS2.SYSCSTCOL.CONSTRAINT_NAME = QSYS2.SYSCST.CONSTRAINT_NAME where
        QSYS2.SYSCSTCOL.TABLE_SCHEMA = CURRENT SCHEMA and QSYS2.SYSCSTCOL.TABLE_NAME = 'myTable' union select QSYS2.SYSKEYS.INDEX_NAME AS NAME,
        QSYS2.SYSKEYS.COLUMN_NAME, CAST('INDEX' AS VARCHAR(11)), QSYS2.SYSINDEXES.TABLE_SCHEMA, QSYS2.SYSINDEXES.TABLE_NAME from QSYS2.SYSKEYS
        left outer join QSYS2.SYSINDEXES on QSYS2.SYSKEYS.INDEX_NAME = QSYS2.SYSINDEXES.INDEX_NAME where QSYS2.SYSINDEXES.TABLE_SCHEMA = CURRENT SCHEMA
        and QSYS2.SYSINDEXES.TABLE_NAME = 'myTable'`,
      },
    );
  });

  it('produces a SHOW INDEX query from a table and globally set schema', () => {
    const sequelizeSchema = createSequelizeInstance({ schema: 'mySchema' });
    const queryGeneratorSchema = sequelizeSchema.queryGenerator;

    expectsql(() => queryGeneratorSchema.showIndexesQuery('myTable'), {
      default: `SHOW INDEX FROM [mySchema].[myTable]`,
      postgres: `SELECT i.relname AS name, ix.indisprimary AS primary, ix.indisunique AS unique, ix.indkey[:ix.indnkeyatts-1] AS index_fields,
        ix.indkey[ix.indnkeyatts:] AS include_fields, array_agg(a.attnum) as column_indexes, array_agg(a.attname) AS column_names,
        pg_get_indexdef(ix.indexrelid) AS definition FROM pg_class t, pg_class i, pg_index ix, pg_attribute a, pg_namespace s
        WHERE t.oid = ix.indrelid AND i.oid = ix.indexrelid AND a.attrelid = t.oid AND
        t.relkind = 'r' and t.relname = 'myTable' AND s.oid = t.relnamespace AND s.nspname = 'mySchema'
        GROUP BY i.relname, ix.indexrelid, ix.indisprimary, ix.indisunique, ix.indkey, ix.indnkeyatts ORDER BY i.relname;`,
      mssql: `SELECT I.[name] AS [index_name], I.[type_desc] AS [index_type], C.[name] AS [column_name], IC.[is_descending_key], IC.[is_included_column], I.[is_unique], I.[is_primary_key], I.[is_unique_constraint]
        FROM sys.indexes I
        INNER JOIN sys.index_columns IC ON IC.index_id = I.index_id AND IC.object_id = I.object_id
        INNER JOIN sys.columns C ON IC.object_id = C.object_id AND IC.column_id = C.column_id
        WHERE I.[object_id] = OBJECT_ID(N'mySchema.myTable') ORDER BY I.[name];`,
      sqlite3: 'PRAGMA INDEX_LIST(`mySchema.myTable`)',
      snowflake: `SELECT '' FROM DUAL`,
      db2: `SELECT i.INDNAME AS "name", i.TABNAME AS "tableName", i.UNIQUERULE AS "keyType", i.INDEXTYPE AS "type", c.COLNAME AS "columnName", c.COLORDER AS "columnOrder" FROM SYSCAT.INDEXES i INNER JOIN SYSCAT.INDEXCOLUSE c ON i.INDNAME = c.INDNAME AND i.INDSCHEMA = c.INDSCHEMA WHERE TABNAME = 'myTable' AND TABSCHEMA = 'mySchema' ORDER BY i.INDNAME, c.COLSEQ;`,
      ibmi: `select QSYS2.SYSCSTCOL.CONSTRAINT_NAME as NAME, QSYS2.SYSCSTCOL.COLUMN_NAME, QSYS2.SYSCST.CONSTRAINT_TYPE, QSYS2.SYSCST.TABLE_SCHEMA,
        QSYS2.SYSCST.TABLE_NAME from QSYS2.SYSCSTCOL left outer join QSYS2.SYSCST on QSYS2.SYSCSTCOL.TABLE_SCHEMA = QSYS2.SYSCST.TABLE_SCHEMA and
        QSYS2.SYSCSTCOL.TABLE_NAME = QSYS2.SYSCST.TABLE_NAME and QSYS2.SYSCSTCOL.CONSTRAINT_NAME = QSYS2.SYSCST.CONSTRAINT_NAME where
        QSYS2.SYSCSTCOL.TABLE_SCHEMA = 'mySchema' and QSYS2.SYSCSTCOL.TABLE_NAME = 'myTable' union select QSYS2.SYSKEYS.INDEX_NAME AS NAME,
        QSYS2.SYSKEYS.COLUMN_NAME, CAST('INDEX' AS VARCHAR(11)), QSYS2.SYSINDEXES.TABLE_SCHEMA, QSYS2.SYSINDEXES.TABLE_NAME from QSYS2.SYSKEYS
        left outer join QSYS2.SYSINDEXES on QSYS2.SYSKEYS.INDEX_NAME = QSYS2.SYSINDEXES.INDEX_NAME where QSYS2.SYSINDEXES.TABLE_SCHEMA = 'mySchema'
        and QSYS2.SYSINDEXES.TABLE_NAME = 'myTable'`,
    });
  });

  it('produces a SHOW INDEX query with schema and custom delimiter argument', () => {
    // This test is only relevant for dialects that do not support schemas
    if (dialect.supports.schemas) {
      return;
    }

    expectsql(
      () =>
        queryGenerator.showIndexesQuery({
          tableName: 'myTable',
          schema: 'mySchema',
          delimiter: 'custom',
        }),
      {
        sqlite3: 'PRAGMA INDEX_LIST(`mySchemacustommyTable`)',
      },
    );
  });
});
