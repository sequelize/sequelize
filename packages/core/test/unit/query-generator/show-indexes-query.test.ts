import { createSequelizeInstance, expectsql, sequelize } from '../../support';

const dialect = sequelize.dialect;
const notSupportedError = new Error(`Indexes are not supported by the ${dialect.name} dialect.`);

describe('QueryGenerator#showIndexesQuery', () => {
  const queryGenerator = sequelize.queryGenerator;

  it('produces a SHOW INDEX query from a table', () => {
    expectsql(() => queryGenerator.showIndexesQuery('myTable'), {
      default: `SHOW INDEX FROM [myTable]`,
      postgres: `SELECT n.nspname AS table_schema, t.relname AS table_name, i.indexname AS index_name, am.amname AS index_method,
        pg_index.indisprimary AS is_primary_key, pg_index.indisunique AS is_unique,
        pg_get_expr(pg_index.indpred, t.oid, true) AS where_clause,
        pg_get_expr(pg_index.indexprs, t.oid, true) AS index_expression,
        a.attname AS column_name, coll.collname AS column_collate,
        op.opcname AS column_operator, array_position(pg_index.indkey, a.attnum) AS position_in_index,
        CASE WHEN (pg_index.indoption[array_position(pg_index.indkey, a.attnum)] & 1) = 1 THEN 'DESC' ELSE 'ASC' END AS column_sort_order,
        CASE WHEN (pg_index.indoption[array_position(pg_index.indkey, a.attnum)] & 2) = 2 THEN 'FIRST' ELSE 'LAST' END AS column_nulls_order,
        CASE WHEN array_position(pg_index.indkey, a.attnum) < pg_index.indnkeyatts THEN true ELSE false END AS is_attribute_column,
        CASE WHEN array_position(pg_index.indkey, a.attnum, indnkeyatts) >= pg_index.indnkeyatts THEN true ELSE false END AS is_included_column,
        i.indexdef AS definition
        FROM pg_indexes i
        JOIN pg_namespace n ON i.schemaname = n.nspname
        JOIN pg_class t ON i.tablename = t.relname AND t.relnamespace = n.oid
        JOIN pg_class idx ON idx.relname = i.indexname AND idx.relnamespace = n.oid
        JOIN pg_am am ON idx.relam = am.oid
        JOIN pg_index ON pg_index.indexrelid = idx.oid
        LEFT JOIN pg_attribute a ON a.attrelid = t.oid AND a.attnum = ANY(pg_index.indkey)
        LEFT JOIN pg_opclass op ON op.oid = pg_index.indclass[array_position(pg_index.indkey, a.attnum)]
        LEFT JOIN pg_collation coll ON coll.oid = pg_index.indcollation[array_position(pg_index.indkey, a.attnum)]
        WHERE i.tablename = 'myTable' AND i.schemaname = 'public'
        ORDER BY i.indexname, position_in_index`,
      mssql: `SELECT S.[name] AS [table_schema], T.[name] AS [table_name], I.[name] AS [index_name],
        I.[type_desc] AS [index_type], I.[is_unique], I.[is_primary_key], I.[is_unique_constraint],
        I.[has_filter], I.[filter_definition], C.[name] AS [column_name],
        IC.[is_descending_key], IC.[is_included_column]
        FROM sys.indexes I
        INNER JOIN sys.tables T ON I.object_id = T.object_id
        INNER JOIN sys.schemas S ON s.schema_id = T.schema_id
        INNER JOIN sys.index_columns IC ON IC.index_id = I.index_id AND IC.object_id = I.object_id
        INNER JOIN sys.columns C ON IC.object_id = C.object_id AND IC.column_id = C.column_id
        WHERE S.[name] = N'dbo' AND T.[name] = N'myTable'
        ORDER BY I.[name], IC.[key_ordinal]`,
      sqlite3: `SELECT tbl_name, name, sql FROM sqlite_master WHERE tbl_name = 'myTable' AND type = 'index' ORDER BY rootpage`,
      snowflake: notSupportedError,
      db2: `SELECT i.TABNAME AS "tableName", i.TABSCHEMA AS "schema", i.INDNAME AS "name",
        TRIM(i.INDEXTYPE) AS "type", i.UNIQUERULE AS "keyType",
        c.COLNAME AS "columnName", c.COLORDER AS "columnOrder",
        c.TEXT AS "expression"
        FROM SYSCAT.INDEXES i
        INNER JOIN SYSCAT.INDEXCOLUSE c ON i.INDNAME = c.INDNAME AND i.INDSCHEMA = c.INDSCHEMA
        WHERE TABNAME = 'myTable' AND TABSCHEMA = 'DB2INST1'
        ORDER BY i.INDNAME, c.COLSEQ`,
      ibmi: `SELECT i.TABLE_NAME AS "tableName", i.TABLE_SCHEMA AS "schema",
        i.INDEX_NAME AS "name", c.CONSTRAINT_TYPE AS "keyType",
        i.INCLUDE_EXPRESSION AS "include", k.COLUMN_NAME AS "columnName",
        k.ORDERING AS "columnOrder", k.COLUMN_IS_EXPRESSION AS "is_expression",
        k.KEY_EXPRESSION AS "expression"
        FROM QSYS2.SYSINDEXES i
        INNER JOIN QSYS2.SYSKEYS k ON i.INDEX_NAME = k.INDEX_NAME AND i.INDEX_SCHEMA = k.INDEX_SCHEMA
        LEFT JOIN QSYS2.SYSCST c ON i.INDEX_NAME = c.CONSTRAINT_NAME AND i.INDEX_SCHEMA = c.CONSTRAINT_SCHEMA
        WHERE i.TABLE_NAME = 'myTable' AND i.TABLE_SCHEMA = CURRENT SCHEMA
        ORDER BY i.INDEX_NAME, k.ORDINAL_POSITION`,
    });
  });

  it('produces a SHOW INDEX query from a model', () => {
    const MyModel = sequelize.define('MyModel', {});

    expectsql(() => queryGenerator.showIndexesQuery(MyModel), {
      default: `SHOW INDEX FROM [MyModels]`,
      postgres: `SELECT n.nspname AS table_schema, t.relname AS table_name, i.indexname AS index_name, am.amname AS index_method,
        pg_index.indisprimary AS is_primary_key, pg_index.indisunique AS is_unique,
        pg_get_expr(pg_index.indpred, t.oid, true) AS where_clause,
        pg_get_expr(pg_index.indexprs, t.oid, true) AS index_expression,
        a.attname AS column_name, coll.collname AS column_collate,
        op.opcname AS column_operator, array_position(pg_index.indkey, a.attnum) AS position_in_index,
        CASE WHEN (pg_index.indoption[array_position(pg_index.indkey, a.attnum)] & 1) = 1 THEN 'DESC' ELSE 'ASC' END AS column_sort_order,
        CASE WHEN (pg_index.indoption[array_position(pg_index.indkey, a.attnum)] & 2) = 2 THEN 'FIRST' ELSE 'LAST' END AS column_nulls_order,
        CASE WHEN array_position(pg_index.indkey, a.attnum) < pg_index.indnkeyatts THEN true ELSE false END AS is_attribute_column,
        CASE WHEN array_position(pg_index.indkey, a.attnum, indnkeyatts) >= pg_index.indnkeyatts THEN true ELSE false END AS is_included_column,
        i.indexdef AS definition
        FROM pg_indexes i
        JOIN pg_namespace n ON i.schemaname = n.nspname
        JOIN pg_class t ON i.tablename = t.relname AND t.relnamespace = n.oid
        JOIN pg_class idx ON idx.relname = i.indexname AND idx.relnamespace = n.oid
        JOIN pg_am am ON idx.relam = am.oid
        JOIN pg_index ON pg_index.indexrelid = idx.oid
        LEFT JOIN pg_attribute a ON a.attrelid = t.oid AND a.attnum = ANY(pg_index.indkey)
        LEFT JOIN pg_opclass op ON op.oid = pg_index.indclass[array_position(pg_index.indkey, a.attnum)]
        LEFT JOIN pg_collation coll ON coll.oid = pg_index.indcollation[array_position(pg_index.indkey, a.attnum)]
        WHERE i.tablename = 'MyModels' AND i.schemaname = 'public'
        ORDER BY i.indexname, position_in_index`,
      mssql: `SELECT S.[name] AS [table_schema], T.[name] AS [table_name], I.[name] AS [index_name],
        I.[type_desc] AS [index_type], I.[is_unique], I.[is_primary_key], I.[is_unique_constraint],
        I.[has_filter], I.[filter_definition], C.[name] AS [column_name],
        IC.[is_descending_key], IC.[is_included_column]
        FROM sys.indexes I
        INNER JOIN sys.tables T ON I.object_id = T.object_id
        INNER JOIN sys.schemas S ON s.schema_id = T.schema_id
        INNER JOIN sys.index_columns IC ON IC.index_id = I.index_id AND IC.object_id = I.object_id
        INNER JOIN sys.columns C ON IC.object_id = C.object_id AND IC.column_id = C.column_id
        WHERE S.[name] = N'dbo' AND T.[name] = N'MyModels'
        ORDER BY I.[name], IC.[key_ordinal]`,
      sqlite3: `SELECT tbl_name, name, sql FROM sqlite_master WHERE tbl_name = 'MyModels' AND type = 'index' ORDER BY rootpage`,
      snowflake: notSupportedError,
      db2: `SELECT i.TABNAME AS "tableName", i.TABSCHEMA AS "schema", i.INDNAME AS "name",
        TRIM(i.INDEXTYPE) AS "type", i.UNIQUERULE AS "keyType",
        c.COLNAME AS "columnName", c.COLORDER AS "columnOrder",
        c.TEXT AS "expression"
        FROM SYSCAT.INDEXES i
        INNER JOIN SYSCAT.INDEXCOLUSE c ON i.INDNAME = c.INDNAME AND i.INDSCHEMA = c.INDSCHEMA
        WHERE TABNAME = 'MyModels' AND TABSCHEMA = 'DB2INST1'
        ORDER BY i.INDNAME, c.COLSEQ`,
      ibmi: `SELECT i.TABLE_NAME AS "tableName", i.TABLE_SCHEMA AS "schema",
        i.INDEX_NAME AS "name", c.CONSTRAINT_TYPE AS "keyType",
        i.INCLUDE_EXPRESSION AS "include", k.COLUMN_NAME AS "columnName",
        k.ORDERING AS "columnOrder", k.COLUMN_IS_EXPRESSION AS "is_expression",
        k.KEY_EXPRESSION AS "expression"
        FROM QSYS2.SYSINDEXES i
        INNER JOIN QSYS2.SYSKEYS k ON i.INDEX_NAME = k.INDEX_NAME AND i.INDEX_SCHEMA = k.INDEX_SCHEMA
        LEFT JOIN QSYS2.SYSCST c ON i.INDEX_NAME = c.CONSTRAINT_NAME AND i.INDEX_SCHEMA = c.CONSTRAINT_SCHEMA
        WHERE i.TABLE_NAME = 'MyModels' AND i.TABLE_SCHEMA = CURRENT SCHEMA
        ORDER BY i.INDEX_NAME, k.ORDINAL_POSITION`,
    });
  });

  it('produces a SHOW INDEX query from a model definition', () => {
    const MyModel = sequelize.define('MyModel', {});
    const myDefinition = MyModel.modelDefinition;

    expectsql(() => queryGenerator.showIndexesQuery(myDefinition), {
      default: `SHOW INDEX FROM [MyModels]`,
      postgres: `SELECT n.nspname AS table_schema, t.relname AS table_name, i.indexname AS index_name, am.amname AS index_method,
        pg_index.indisprimary AS is_primary_key, pg_index.indisunique AS is_unique,
        pg_get_expr(pg_index.indpred, t.oid, true) AS where_clause,
        pg_get_expr(pg_index.indexprs, t.oid, true) AS index_expression,
        a.attname AS column_name, coll.collname AS column_collate,
        op.opcname AS column_operator, array_position(pg_index.indkey, a.attnum) AS position_in_index,
        CASE WHEN (pg_index.indoption[array_position(pg_index.indkey, a.attnum)] & 1) = 1 THEN 'DESC' ELSE 'ASC' END AS column_sort_order,
        CASE WHEN (pg_index.indoption[array_position(pg_index.indkey, a.attnum)] & 2) = 2 THEN 'FIRST' ELSE 'LAST' END AS column_nulls_order,
        CASE WHEN array_position(pg_index.indkey, a.attnum) < pg_index.indnkeyatts THEN true ELSE false END AS is_attribute_column,
        CASE WHEN array_position(pg_index.indkey, a.attnum, indnkeyatts) >= pg_index.indnkeyatts THEN true ELSE false END AS is_included_column,
        i.indexdef AS definition
        FROM pg_indexes i
        JOIN pg_namespace n ON i.schemaname = n.nspname
        JOIN pg_class t ON i.tablename = t.relname AND t.relnamespace = n.oid
        JOIN pg_class idx ON idx.relname = i.indexname AND idx.relnamespace = n.oid
        JOIN pg_am am ON idx.relam = am.oid
        JOIN pg_index ON pg_index.indexrelid = idx.oid
        LEFT JOIN pg_attribute a ON a.attrelid = t.oid AND a.attnum = ANY(pg_index.indkey)
        LEFT JOIN pg_opclass op ON op.oid = pg_index.indclass[array_position(pg_index.indkey, a.attnum)]
        LEFT JOIN pg_collation coll ON coll.oid = pg_index.indcollation[array_position(pg_index.indkey, a.attnum)]
        WHERE i.tablename = 'MyModels' AND i.schemaname = 'public'
        ORDER BY i.indexname, position_in_index`,
      mssql: `SELECT S.[name] AS [table_schema], T.[name] AS [table_name], I.[name] AS [index_name],
        I.[type_desc] AS [index_type], I.[is_unique], I.[is_primary_key], I.[is_unique_constraint],
        I.[has_filter], I.[filter_definition], C.[name] AS [column_name],
        IC.[is_descending_key], IC.[is_included_column]
        FROM sys.indexes I
        INNER JOIN sys.tables T ON I.object_id = T.object_id
        INNER JOIN sys.schemas S ON s.schema_id = T.schema_id
        INNER JOIN sys.index_columns IC ON IC.index_id = I.index_id AND IC.object_id = I.object_id
        INNER JOIN sys.columns C ON IC.object_id = C.object_id AND IC.column_id = C.column_id
        WHERE S.[name] = N'dbo' AND T.[name] = N'MyModels'
        ORDER BY I.[name], IC.[key_ordinal]`,
      sqlite3: `SELECT tbl_name, name, sql FROM sqlite_master WHERE tbl_name = 'MyModels' AND type = 'index' ORDER BY rootpage`,
      snowflake: notSupportedError,
      db2: `SELECT i.TABNAME AS "tableName", i.TABSCHEMA AS "schema", i.INDNAME AS "name",
        TRIM(i.INDEXTYPE) AS "type", i.UNIQUERULE AS "keyType",
        c.COLNAME AS "columnName", c.COLORDER AS "columnOrder",
        c.TEXT AS "expression"
        FROM SYSCAT.INDEXES i
        INNER JOIN SYSCAT.INDEXCOLUSE c ON i.INDNAME = c.INDNAME AND i.INDSCHEMA = c.INDSCHEMA
        WHERE TABNAME = 'MyModels' AND TABSCHEMA = 'DB2INST1'
        ORDER BY i.INDNAME, c.COLSEQ`,
      ibmi: `SELECT i.TABLE_NAME AS "tableName", i.TABLE_SCHEMA AS "schema",
        i.INDEX_NAME AS "name", c.CONSTRAINT_TYPE AS "keyType",
        i.INCLUDE_EXPRESSION AS "include", k.COLUMN_NAME AS "columnName",
        k.ORDERING AS "columnOrder", k.COLUMN_IS_EXPRESSION AS "is_expression",
        k.KEY_EXPRESSION AS "expression"
        FROM QSYS2.SYSINDEXES i
        INNER JOIN QSYS2.SYSKEYS k ON i.INDEX_NAME = k.INDEX_NAME AND i.INDEX_SCHEMA = k.INDEX_SCHEMA
        LEFT JOIN QSYS2.SYSCST c ON i.INDEX_NAME = c.CONSTRAINT_NAME AND i.INDEX_SCHEMA = c.CONSTRAINT_SCHEMA
        WHERE i.TABLE_NAME = 'MyModels' AND i.TABLE_SCHEMA = CURRENT SCHEMA
        ORDER BY i.INDEX_NAME, k.ORDINAL_POSITION`,
    });
  });

  it('produces a SHOW INDEX query from a table and schema', () => {
    expectsql(() => queryGenerator.showIndexesQuery({ tableName: 'myTable', schema: 'mySchema' }), {
      default: `SHOW INDEX FROM [mySchema].[myTable]`,
      postgres: `SELECT n.nspname AS table_schema, t.relname AS table_name, i.indexname AS index_name, am.amname AS index_method,
        pg_index.indisprimary AS is_primary_key, pg_index.indisunique AS is_unique,
        pg_get_expr(pg_index.indpred, t.oid, true) AS where_clause,
        pg_get_expr(pg_index.indexprs, t.oid, true) AS index_expression,
        a.attname AS column_name, coll.collname AS column_collate,
        op.opcname AS column_operator, array_position(pg_index.indkey, a.attnum) AS position_in_index,
        CASE WHEN (pg_index.indoption[array_position(pg_index.indkey, a.attnum)] & 1) = 1 THEN 'DESC' ELSE 'ASC' END AS column_sort_order,
        CASE WHEN (pg_index.indoption[array_position(pg_index.indkey, a.attnum)] & 2) = 2 THEN 'FIRST' ELSE 'LAST' END AS column_nulls_order,
        CASE WHEN array_position(pg_index.indkey, a.attnum) < pg_index.indnkeyatts THEN true ELSE false END AS is_attribute_column,
        CASE WHEN array_position(pg_index.indkey, a.attnum, indnkeyatts) >= pg_index.indnkeyatts THEN true ELSE false END AS is_included_column,
        i.indexdef AS definition
        FROM pg_indexes i
        JOIN pg_namespace n ON i.schemaname = n.nspname
        JOIN pg_class t ON i.tablename = t.relname AND t.relnamespace = n.oid
        JOIN pg_class idx ON idx.relname = i.indexname AND idx.relnamespace = n.oid
        JOIN pg_am am ON idx.relam = am.oid
        JOIN pg_index ON pg_index.indexrelid = idx.oid
        LEFT JOIN pg_attribute a ON a.attrelid = t.oid AND a.attnum = ANY(pg_index.indkey)
        LEFT JOIN pg_opclass op ON op.oid = pg_index.indclass[array_position(pg_index.indkey, a.attnum)]
        LEFT JOIN pg_collation coll ON coll.oid = pg_index.indcollation[array_position(pg_index.indkey, a.attnum)]
        WHERE i.tablename = 'myTable' AND i.schemaname = 'mySchema'
        ORDER BY i.indexname, position_in_index`,
      mssql: `SELECT S.[name] AS [table_schema], T.[name] AS [table_name], I.[name] AS [index_name],
        I.[type_desc] AS [index_type], I.[is_unique], I.[is_primary_key], I.[is_unique_constraint],
        I.[has_filter], I.[filter_definition], C.[name] AS [column_name],
        IC.[is_descending_key], IC.[is_included_column]
        FROM sys.indexes I
        INNER JOIN sys.tables T ON I.object_id = T.object_id
        INNER JOIN sys.schemas S ON s.schema_id = T.schema_id
        INNER JOIN sys.index_columns IC ON IC.index_id = I.index_id AND IC.object_id = I.object_id
        INNER JOIN sys.columns C ON IC.object_id = C.object_id AND IC.column_id = C.column_id
        WHERE S.[name] = N'mySchema' AND T.[name] = N'myTable'
        ORDER BY I.[name], IC.[key_ordinal]`,
      sqlite3: `SELECT tbl_name, name, sql FROM sqlite_master WHERE tbl_name = 'mySchema.myTable' AND type = 'index' ORDER BY rootpage`,
      snowflake: notSupportedError,
      db2: `SELECT i.TABNAME AS "tableName", i.TABSCHEMA AS "schema", i.INDNAME AS "name",
        TRIM(i.INDEXTYPE) AS "type", i.UNIQUERULE AS "keyType",
        c.COLNAME AS "columnName", c.COLORDER AS "columnOrder",
        c.TEXT AS "expression"
        FROM SYSCAT.INDEXES i
        INNER JOIN SYSCAT.INDEXCOLUSE c ON i.INDNAME = c.INDNAME AND i.INDSCHEMA = c.INDSCHEMA
        WHERE TABNAME = 'myTable' AND TABSCHEMA = 'mySchema'
        ORDER BY i.INDNAME, c.COLSEQ`,
      ibmi: `SELECT i.TABLE_NAME AS "tableName", i.TABLE_SCHEMA AS "schema",
        i.INDEX_NAME AS "name", c.CONSTRAINT_TYPE AS "keyType",
        i.INCLUDE_EXPRESSION AS "include", k.COLUMN_NAME AS "columnName",
        k.ORDERING AS "columnOrder", k.COLUMN_IS_EXPRESSION AS "is_expression",
        k.KEY_EXPRESSION AS "expression"
        FROM QSYS2.SYSINDEXES i
        INNER JOIN QSYS2.SYSKEYS k ON i.INDEX_NAME = k.INDEX_NAME AND i.INDEX_SCHEMA = k.INDEX_SCHEMA
        LEFT JOIN QSYS2.SYSCST c ON i.INDEX_NAME = c.CONSTRAINT_NAME AND i.INDEX_SCHEMA = c.CONSTRAINT_SCHEMA
        WHERE i.TABLE_NAME = 'myTable' AND i.TABLE_SCHEMA = 'mySchema'
        ORDER BY i.INDEX_NAME, k.ORDINAL_POSITION`,
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
        postgres: `SELECT n.nspname AS table_schema, t.relname AS table_name, i.indexname AS index_name, am.amname AS index_method,
        pg_index.indisprimary AS is_primary_key, pg_index.indisunique AS is_unique,
        pg_get_expr(pg_index.indpred, t.oid, true) AS where_clause,
        pg_get_expr(pg_index.indexprs, t.oid, true) AS index_expression,
        a.attname AS column_name, coll.collname AS column_collate,
        op.opcname AS column_operator, array_position(pg_index.indkey, a.attnum) AS position_in_index,
        CASE WHEN (pg_index.indoption[array_position(pg_index.indkey, a.attnum)] & 1) = 1 THEN 'DESC' ELSE 'ASC' END AS column_sort_order,
        CASE WHEN (pg_index.indoption[array_position(pg_index.indkey, a.attnum)] & 2) = 2 THEN 'FIRST' ELSE 'LAST' END AS column_nulls_order,
        CASE WHEN array_position(pg_index.indkey, a.attnum) < pg_index.indnkeyatts THEN true ELSE false END AS is_attribute_column,
        CASE WHEN array_position(pg_index.indkey, a.attnum, indnkeyatts) >= pg_index.indnkeyatts THEN true ELSE false END AS is_included_column,
        i.indexdef AS definition
        FROM pg_indexes i
        JOIN pg_namespace n ON i.schemaname = n.nspname
        JOIN pg_class t ON i.tablename = t.relname AND t.relnamespace = n.oid
        JOIN pg_class idx ON idx.relname = i.indexname AND idx.relnamespace = n.oid
        JOIN pg_am am ON idx.relam = am.oid
        JOIN pg_index ON pg_index.indexrelid = idx.oid
        LEFT JOIN pg_attribute a ON a.attrelid = t.oid AND a.attnum = ANY(pg_index.indkey)
        LEFT JOIN pg_opclass op ON op.oid = pg_index.indclass[array_position(pg_index.indkey, a.attnum)]
        LEFT JOIN pg_collation coll ON coll.oid = pg_index.indcollation[array_position(pg_index.indkey, a.attnum)]
        WHERE i.tablename = 'myTable' AND i.schemaname = 'public'
        ORDER BY i.indexname, position_in_index`,
        mssql: `SELECT S.[name] AS [table_schema], T.[name] AS [table_name], I.[name] AS [index_name],
        I.[type_desc] AS [index_type], I.[is_unique], I.[is_primary_key], I.[is_unique_constraint],
        I.[has_filter], I.[filter_definition], C.[name] AS [column_name],
        IC.[is_descending_key], IC.[is_included_column]
        FROM sys.indexes I
        INNER JOIN sys.tables T ON I.object_id = T.object_id
        INNER JOIN sys.schemas S ON s.schema_id = T.schema_id
        INNER JOIN sys.index_columns IC ON IC.index_id = I.index_id AND IC.object_id = I.object_id
        INNER JOIN sys.columns C ON IC.object_id = C.object_id AND IC.column_id = C.column_id
        WHERE S.[name] = N'dbo' AND T.[name] = N'myTable'
        ORDER BY I.[name], IC.[key_ordinal]`,
        sqlite3: `SELECT tbl_name, name, sql FROM sqlite_master WHERE tbl_name = 'myTable' AND type = 'index' ORDER BY rootpage`,
        snowflake: notSupportedError,
        db2: `SELECT i.TABNAME AS "tableName", i.TABSCHEMA AS "schema", i.INDNAME AS "name",
        TRIM(i.INDEXTYPE) AS "type", i.UNIQUERULE AS "keyType",
        c.COLNAME AS "columnName", c.COLORDER AS "columnOrder",
        c.TEXT AS "expression"
        FROM SYSCAT.INDEXES i
        INNER JOIN SYSCAT.INDEXCOLUSE c ON i.INDNAME = c.INDNAME AND i.INDSCHEMA = c.INDSCHEMA
        WHERE TABNAME = 'myTable' AND TABSCHEMA = 'DB2INST1'
        ORDER BY i.INDNAME, c.COLSEQ`,
        ibmi: `SELECT i.TABLE_NAME AS "tableName", i.TABLE_SCHEMA AS "schema",
        i.INDEX_NAME AS "name", c.CONSTRAINT_TYPE AS "keyType",
        i.INCLUDE_EXPRESSION AS "include", k.COLUMN_NAME AS "columnName",
        k.ORDERING AS "columnOrder", k.COLUMN_IS_EXPRESSION AS "is_expression",
        k.KEY_EXPRESSION AS "expression"
        FROM QSYS2.SYSINDEXES i
        INNER JOIN QSYS2.SYSKEYS k ON i.INDEX_NAME = k.INDEX_NAME AND i.INDEX_SCHEMA = k.INDEX_SCHEMA
        LEFT JOIN QSYS2.SYSCST c ON i.INDEX_NAME = c.CONSTRAINT_NAME AND i.INDEX_SCHEMA = c.CONSTRAINT_SCHEMA
        WHERE i.TABLE_NAME = 'myTable' AND i.TABLE_SCHEMA = CURRENT SCHEMA
        ORDER BY i.INDEX_NAME, k.ORDINAL_POSITION`,
      },
    );
  });

  it('produces a SHOW INDEX query from a table and globally set schema', () => {
    const sequelizeSchema = createSequelizeInstance({ schema: 'mySchema' });
    const queryGeneratorSchema = sequelizeSchema.queryGenerator;

    expectsql(() => queryGeneratorSchema.showIndexesQuery('myTable'), {
      default: `SHOW INDEX FROM [mySchema].[myTable]`,
      postgres: `SELECT n.nspname AS table_schema, t.relname AS table_name, i.indexname AS index_name, am.amname AS index_method,
        pg_index.indisprimary AS is_primary_key, pg_index.indisunique AS is_unique,
        pg_get_expr(pg_index.indpred, t.oid, true) AS where_clause,
        pg_get_expr(pg_index.indexprs, t.oid, true) AS index_expression,
        a.attname AS column_name, coll.collname AS column_collate,
        op.opcname AS column_operator, array_position(pg_index.indkey, a.attnum) AS position_in_index,
        CASE WHEN (pg_index.indoption[array_position(pg_index.indkey, a.attnum)] & 1) = 1 THEN 'DESC' ELSE 'ASC' END AS column_sort_order,
        CASE WHEN (pg_index.indoption[array_position(pg_index.indkey, a.attnum)] & 2) = 2 THEN 'FIRST' ELSE 'LAST' END AS column_nulls_order,
        CASE WHEN array_position(pg_index.indkey, a.attnum) < pg_index.indnkeyatts THEN true ELSE false END AS is_attribute_column,
        CASE WHEN array_position(pg_index.indkey, a.attnum, indnkeyatts) >= pg_index.indnkeyatts THEN true ELSE false END AS is_included_column,
        i.indexdef AS definition
        FROM pg_indexes i
        JOIN pg_namespace n ON i.schemaname = n.nspname
        JOIN pg_class t ON i.tablename = t.relname AND t.relnamespace = n.oid
        JOIN pg_class idx ON idx.relname = i.indexname AND idx.relnamespace = n.oid
        JOIN pg_am am ON idx.relam = am.oid
        JOIN pg_index ON pg_index.indexrelid = idx.oid
        LEFT JOIN pg_attribute a ON a.attrelid = t.oid AND a.attnum = ANY(pg_index.indkey)
        LEFT JOIN pg_opclass op ON op.oid = pg_index.indclass[array_position(pg_index.indkey, a.attnum)]
        LEFT JOIN pg_collation coll ON coll.oid = pg_index.indcollation[array_position(pg_index.indkey, a.attnum)]
        WHERE i.tablename = 'myTable' AND i.schemaname = 'mySchema'
        ORDER BY i.indexname, position_in_index`,
      mssql: `SELECT S.[name] AS [table_schema], T.[name] AS [table_name], I.[name] AS [index_name],
        I.[type_desc] AS [index_type], I.[is_unique], I.[is_primary_key], I.[is_unique_constraint],
        I.[has_filter], I.[filter_definition], C.[name] AS [column_name],
        IC.[is_descending_key], IC.[is_included_column]
        FROM sys.indexes I
        INNER JOIN sys.tables T ON I.object_id = T.object_id
        INNER JOIN sys.schemas S ON s.schema_id = T.schema_id
        INNER JOIN sys.index_columns IC ON IC.index_id = I.index_id AND IC.object_id = I.object_id
        INNER JOIN sys.columns C ON IC.object_id = C.object_id AND IC.column_id = C.column_id
        WHERE S.[name] = N'mySchema' AND T.[name] = N'myTable'
        ORDER BY I.[name], IC.[key_ordinal]`,
      sqlite3: `SELECT tbl_name, name, sql FROM sqlite_master WHERE tbl_name = 'mySchema.myTable' AND type = 'index' ORDER BY rootpage`,
      snowflake: notSupportedError,
      db2: `SELECT i.TABNAME AS "tableName", i.TABSCHEMA AS "schema", i.INDNAME AS "name",
        TRIM(i.INDEXTYPE) AS "type", i.UNIQUERULE AS "keyType",
        c.COLNAME AS "columnName", c.COLORDER AS "columnOrder",
        c.TEXT AS "expression"
        FROM SYSCAT.INDEXES i
        INNER JOIN SYSCAT.INDEXCOLUSE c ON i.INDNAME = c.INDNAME AND i.INDSCHEMA = c.INDSCHEMA
        WHERE TABNAME = 'myTable' AND TABSCHEMA = 'mySchema'
        ORDER BY i.INDNAME, c.COLSEQ`,
      ibmi: `SELECT i.TABLE_NAME AS "tableName", i.TABLE_SCHEMA AS "schema",
        i.INDEX_NAME AS "name", c.CONSTRAINT_TYPE AS "keyType",
        i.INCLUDE_EXPRESSION AS "include", k.COLUMN_NAME AS "columnName",
        k.ORDERING AS "columnOrder", k.COLUMN_IS_EXPRESSION AS "is_expression",
        k.KEY_EXPRESSION AS "expression"
        FROM QSYS2.SYSINDEXES i
        INNER JOIN QSYS2.SYSKEYS k ON i.INDEX_NAME = k.INDEX_NAME AND i.INDEX_SCHEMA = k.INDEX_SCHEMA
        LEFT JOIN QSYS2.SYSCST c ON i.INDEX_NAME = c.CONSTRAINT_NAME AND i.INDEX_SCHEMA = c.CONSTRAINT_SCHEMA
        WHERE i.TABLE_NAME = 'myTable' AND i.TABLE_SCHEMA = 'mySchema'
        ORDER BY i.INDEX_NAME, k.ORDINAL_POSITION`,
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
        sqlite3:
          "SELECT tbl_name, name, sql FROM sqlite_master WHERE tbl_name = 'mySchemacustommyTable' AND type = 'index' ORDER BY rootpage",
      },
    );
  });
});
