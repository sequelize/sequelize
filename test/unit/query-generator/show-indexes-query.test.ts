import { createSequelizeInstance, expectsql, sequelize } from '../../support';

const dialect = sequelize.dialect;

describe('QueryGenerator#showIndexesQuery', () => {
  const queryGenerator = sequelize.getQueryInterface().queryGenerator;

  it('produces a SHOW INDEX query from a table', () => {
    expectsql(() => queryGenerator.showIndexesQuery('myTable'), {
      default: `SHOW INDEX FROM [myTable]`,
      postgres: `SELECT i.relname AS name, ix.indisprimary AS primary, ix.indisunique AS unique, ix.indkey AS indkey, `
        + `array_agg(a.attnum) as column_indexes, array_agg(a.attname) AS column_names, pg_get_indexdef(ix.indexrelid) `
        + `AS definition FROM pg_class t, pg_class i, pg_index ix, pg_attribute a, pg_namespace s `
        + `WHERE t.oid = ix.indrelid AND i.oid = ix.indexrelid AND a.attrelid = t.oid AND `
        + `t.relkind = 'r' and t.relname = 'myTable' AND s.oid = t.relnamespace AND s.nspname = 'public' `
        + 'GROUP BY i.relname, ix.indexrelid, ix.indisprimary, ix.indisunique, ix.indkey ORDER BY i.relname;',
      mssql: `EXEC sys.sp_helpindex @objname = N'[myTable]';`,
      sqlite: 'PRAGMA INDEX_LIST(`myTable`)',
      snowflake: `SELECT '' FROM DUAL`,
      db2: `SELECT NAME AS "name", TBNAME AS "tableName", UNIQUERULE AS "keyType", COLNAMES, INDEXTYPE AS "type" FROM SYSIBM.SYSINDEXES WHERE TBNAME = 'myTable' AND TBCREATOR = USER ORDER BY NAME;`,
      ibmi: `select QSYS2.SYSCSTCOL.CONSTRAINT_NAME as NAME, QSYS2.SYSCSTCOL.COLUMN_NAME, QSYS2.SYSCST.CONSTRAINT_TYPE, QSYS2.SYSCST.TABLE_SCHEMA, `
        + `QSYS2.SYSCST.TABLE_NAME from QSYS2.SYSCSTCOL left outer join QSYS2.SYSCST on QSYS2.SYSCSTCOL.TABLE_SCHEMA = QSYS2.SYSCST.TABLE_SCHEMA and `
        + `QSYS2.SYSCSTCOL.TABLE_NAME = QSYS2.SYSCST.TABLE_NAME and QSYS2.SYSCSTCOL.CONSTRAINT_NAME = QSYS2.SYSCST.CONSTRAINT_NAME where `
        + `QSYS2.SYSCSTCOL.TABLE_SCHEMA = CURRENT SCHEMA and QSYS2.SYSCSTCOL.TABLE_NAME = 'myTable' union select QSYS2.SYSKEYS.INDEX_NAME AS NAME, `
        + `QSYS2.SYSKEYS.COLUMN_NAME, CAST('INDEX' AS VARCHAR(11)), QSYS2.SYSINDEXES.TABLE_SCHEMA, QSYS2.SYSINDEXES.TABLE_NAME from QSYS2.SYSKEYS `
        + `left outer join QSYS2.SYSINDEXES on QSYS2.SYSKEYS.INDEX_NAME = QSYS2.SYSINDEXES.INDEX_NAME where QSYS2.SYSINDEXES.TABLE_SCHEMA = CURRENT SCHEMA `
        + `and QSYS2.SYSINDEXES.TABLE_NAME = 'myTable'`,
    });
  });

  it('produces a SHOW INDEX query from a model', () => {
    const MyModel = sequelize.define('myModel', {});

    expectsql(() => queryGenerator.showIndexesQuery(MyModel), {
      default: `SHOW INDEX FROM [myModels]`,
      postgres: `SELECT i.relname AS name, ix.indisprimary AS primary, ix.indisunique AS unique, ix.indkey AS indkey, `
        + `array_agg(a.attnum) as column_indexes, array_agg(a.attname) AS column_names, pg_get_indexdef(ix.indexrelid) `
        + `AS definition FROM pg_class t, pg_class i, pg_index ix, pg_attribute a, pg_namespace s `
        + `WHERE t.oid = ix.indrelid AND i.oid = ix.indexrelid AND a.attrelid = t.oid AND `
        + `t.relkind = 'r' and t.relname = 'myModels' AND s.oid = t.relnamespace AND s.nspname = 'public' `
        + 'GROUP BY i.relname, ix.indexrelid, ix.indisprimary, ix.indisunique, ix.indkey ORDER BY i.relname;',
      mssql: `EXEC sys.sp_helpindex @objname = N'[myModels]';`,
      sqlite: 'PRAGMA INDEX_LIST(`myModels`)',
      snowflake: `SELECT '' FROM DUAL`,
      db2: `SELECT NAME AS "name", TBNAME AS "tableName", UNIQUERULE AS "keyType", COLNAMES, INDEXTYPE AS "type" FROM SYSIBM.SYSINDEXES WHERE TBNAME = 'myModels' AND TBCREATOR = USER ORDER BY NAME;`,
      ibmi: `select QSYS2.SYSCSTCOL.CONSTRAINT_NAME as NAME, QSYS2.SYSCSTCOL.COLUMN_NAME, QSYS2.SYSCST.CONSTRAINT_TYPE, QSYS2.SYSCST.TABLE_SCHEMA, `
        + `QSYS2.SYSCST.TABLE_NAME from QSYS2.SYSCSTCOL left outer join QSYS2.SYSCST on QSYS2.SYSCSTCOL.TABLE_SCHEMA = QSYS2.SYSCST.TABLE_SCHEMA and `
        + `QSYS2.SYSCSTCOL.TABLE_NAME = QSYS2.SYSCST.TABLE_NAME and QSYS2.SYSCSTCOL.CONSTRAINT_NAME = QSYS2.SYSCST.CONSTRAINT_NAME where `
        + `QSYS2.SYSCSTCOL.TABLE_SCHEMA = CURRENT SCHEMA and QSYS2.SYSCSTCOL.TABLE_NAME = 'myModels' union select QSYS2.SYSKEYS.INDEX_NAME AS NAME, `
        + `QSYS2.SYSKEYS.COLUMN_NAME, CAST('INDEX' AS VARCHAR(11)), QSYS2.SYSINDEXES.TABLE_SCHEMA, QSYS2.SYSINDEXES.TABLE_NAME from QSYS2.SYSKEYS `
        + `left outer join QSYS2.SYSINDEXES on QSYS2.SYSKEYS.INDEX_NAME = QSYS2.SYSINDEXES.INDEX_NAME where QSYS2.SYSINDEXES.TABLE_SCHEMA = CURRENT SCHEMA `
        + `and QSYS2.SYSINDEXES.TABLE_NAME = 'myModels'`,
    });
  });

  it('produces a SHOW INDEX query from a table and schema', () => {
    expectsql(() => queryGenerator.showIndexesQuery({ tableName: 'myTable', schema: 'mySchema' }), {
      default: `SHOW INDEX FROM [mySchema].[myTable]`,
      postgres: `SELECT i.relname AS name, ix.indisprimary AS primary, ix.indisunique AS unique, ix.indkey AS indkey,
        array_agg(a.attnum) as column_indexes, array_agg(a.attname) AS column_names, pg_get_indexdef(ix.indexrelid)
        AS definition FROM pg_class t, pg_class i, pg_index ix, pg_attribute a, pg_namespace s
        WHERE t.oid = ix.indrelid AND i.oid = ix.indexrelid AND a.attrelid = t.oid AND
        t.relkind = 'r' and t.relname = 'myTable' AND s.oid = t.relnamespace AND s.nspname = 'mySchema'
        GROUP BY i.relname, ix.indexrelid, ix.indisprimary, ix.indisunique, ix.indkey ORDER BY i.relname;`,
      mssql: `EXEC sys.sp_helpindex @objname = N'[mySchema].[myTable]';`,
      sqlite: 'PRAGMA INDEX_LIST(`mySchema.myTable`)',
      snowflake: `SELECT '' FROM DUAL`,
      db2: `SELECT NAME AS "name", TBNAME AS "tableName", UNIQUERULE AS "keyType", COLNAMES, INDEXTYPE AS "type" FROM SYSIBM.SYSINDEXES WHERE TBNAME = 'myTable' AND TBCREATOR = 'mySchema' ORDER BY NAME;`,
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
    expectsql(() => queryGenerator.showIndexesQuery({ tableName: 'myTable', schema: dialect.getDefaultSchema() }), {
      default: `SHOW INDEX FROM [myTable]`,
      postgres: `SELECT i.relname AS name, ix.indisprimary AS primary, ix.indisunique AS unique, ix.indkey AS indkey,
        array_agg(a.attnum) as column_indexes, array_agg(a.attname) AS column_names, pg_get_indexdef(ix.indexrelid)
        AS definition FROM pg_class t, pg_class i, pg_index ix, pg_attribute a, pg_namespace s
        WHERE t.oid = ix.indrelid AND i.oid = ix.indexrelid AND a.attrelid = t.oid AND
        t.relkind = 'r' and t.relname = 'myTable' AND s.oid = t.relnamespace AND s.nspname = 'public'
        GROUP BY i.relname, ix.indexrelid, ix.indisprimary, ix.indisunique, ix.indkey ORDER BY i.relname;`,
      mssql: `EXEC sys.sp_helpindex @objname = N'[myTable]';`,
      sqlite: 'PRAGMA INDEX_LIST(`myTable`)',
      snowflake: `SELECT '' FROM DUAL`,
      db2: `SELECT NAME AS "name", TBNAME AS "tableName", UNIQUERULE AS "keyType", COLNAMES, INDEXTYPE AS "type" FROM SYSIBM.SYSINDEXES WHERE TBNAME = 'myTable' AND TBCREATOR = USER ORDER BY NAME;`,
      ibmi: `select QSYS2.SYSCSTCOL.CONSTRAINT_NAME as NAME, QSYS2.SYSCSTCOL.COLUMN_NAME, QSYS2.SYSCST.CONSTRAINT_TYPE, QSYS2.SYSCST.TABLE_SCHEMA,
        QSYS2.SYSCST.TABLE_NAME from QSYS2.SYSCSTCOL left outer join QSYS2.SYSCST on QSYS2.SYSCSTCOL.TABLE_SCHEMA = QSYS2.SYSCST.TABLE_SCHEMA and
        QSYS2.SYSCSTCOL.TABLE_NAME = QSYS2.SYSCST.TABLE_NAME and QSYS2.SYSCSTCOL.CONSTRAINT_NAME = QSYS2.SYSCST.CONSTRAINT_NAME where
        QSYS2.SYSCSTCOL.TABLE_SCHEMA = CURRENT SCHEMA and QSYS2.SYSCSTCOL.TABLE_NAME = 'myTable' union select QSYS2.SYSKEYS.INDEX_NAME AS NAME,
        QSYS2.SYSKEYS.COLUMN_NAME, CAST('INDEX' AS VARCHAR(11)), QSYS2.SYSINDEXES.TABLE_SCHEMA, QSYS2.SYSINDEXES.TABLE_NAME from QSYS2.SYSKEYS
        left outer join QSYS2.SYSINDEXES on QSYS2.SYSKEYS.INDEX_NAME = QSYS2.SYSINDEXES.INDEX_NAME where QSYS2.SYSINDEXES.TABLE_SCHEMA = CURRENT SCHEMA
        and QSYS2.SYSINDEXES.TABLE_NAME = 'myTable'`,
    });
  });

  it('produces a SHOW INDEX query from a table and globally set schema', () => {
    const sequelizeSchema = createSequelizeInstance({ schema: 'mySchema' });
    const queryGeneratorSchema = sequelizeSchema.getQueryInterface().queryGenerator;

    expectsql(() => queryGeneratorSchema.showIndexesQuery('myTable'), {
      default: `SHOW INDEX FROM [mySchema].[myTable]`,
      postgres: 'SELECT i.relname AS name, ix.indisprimary AS primary, ix.indisunique AS unique, ix.indkey AS indkey, '
        + 'array_agg(a.attnum) as column_indexes, array_agg(a.attname) AS column_names, pg_get_indexdef(ix.indexrelid) '
        + 'AS definition FROM pg_class t, pg_class i, pg_index ix, pg_attribute a, pg_namespace s '
        + 'WHERE t.oid = ix.indrelid AND i.oid = ix.indexrelid AND a.attrelid = t.oid AND '
        + `t.relkind = 'r' and t.relname = 'myTable' AND s.oid = t.relnamespace AND s.nspname = 'mySchema' `
        + 'GROUP BY i.relname, ix.indexrelid, ix.indisprimary, ix.indisunique, ix.indkey ORDER BY i.relname;',
      mssql: `EXEC sys.sp_helpindex @objname = N'[mySchema].[myTable]';`,
      sqlite: 'PRAGMA INDEX_LIST(`mySchema.myTable`)',
      snowflake: `SELECT '' FROM DUAL`,
      db2: `SELECT NAME AS "name", TBNAME AS "tableName", UNIQUERULE AS "keyType", COLNAMES, INDEXTYPE AS "type" FROM SYSIBM.SYSINDEXES WHERE TBNAME = 'myTable' AND TBCREATOR = 'mySchema' ORDER BY NAME;`,
      ibmi: `select QSYS2.SYSCSTCOL.CONSTRAINT_NAME as NAME, QSYS2.SYSCSTCOL.COLUMN_NAME, QSYS2.SYSCST.CONSTRAINT_TYPE, QSYS2.SYSCST.TABLE_SCHEMA, `
        + `QSYS2.SYSCST.TABLE_NAME from QSYS2.SYSCSTCOL left outer join QSYS2.SYSCST on QSYS2.SYSCSTCOL.TABLE_SCHEMA = QSYS2.SYSCST.TABLE_SCHEMA and `
        + `QSYS2.SYSCSTCOL.TABLE_NAME = QSYS2.SYSCST.TABLE_NAME and QSYS2.SYSCSTCOL.CONSTRAINT_NAME = QSYS2.SYSCST.CONSTRAINT_NAME where `
        + `QSYS2.SYSCSTCOL.TABLE_SCHEMA = 'mySchema' and QSYS2.SYSCSTCOL.TABLE_NAME = 'myTable' union select QSYS2.SYSKEYS.INDEX_NAME AS NAME, `
        + `QSYS2.SYSKEYS.COLUMN_NAME, CAST('INDEX' AS VARCHAR(11)), QSYS2.SYSINDEXES.TABLE_SCHEMA, QSYS2.SYSINDEXES.TABLE_NAME from QSYS2.SYSKEYS `
        + `left outer join QSYS2.SYSINDEXES on QSYS2.SYSKEYS.INDEX_NAME = QSYS2.SYSINDEXES.INDEX_NAME where QSYS2.SYSINDEXES.TABLE_SCHEMA = 'mySchema' `
        + `and QSYS2.SYSINDEXES.TABLE_NAME = 'myTable'`,
    });
  });
});
