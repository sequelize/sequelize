import { createSequelizeInstance, expectsql, sequelize } from '../../support';

const dialect = sequelize.dialect;

describe('QueryGenerator#describeTableQuery', () => {
  const queryGenerator = sequelize.queryGenerator;

  it('produces a query to describe a table', () => {
    expectsql(() => queryGenerator.describeTableQuery('myTable'), {
      default: 'SHOW FULL COLUMNS FROM [myTable];',
      postgres: `SELECT
        pk.constraint_type as "Constraint",
        c.column_name as "Field",
        c.column_default as "Default",
        c.is_nullable as "Null",
        (CASE WHEN c.udt_name = 'hstore' THEN c.udt_name ELSE c.data_type END) || (CASE WHEN c.character_maximum_length IS NOT NULL THEN '(' || c.character_maximum_length || ')' ELSE '' END) as "Type",
        (SELECT array_agg(e.enumlabel) FROM pg_catalog.pg_type t JOIN pg_catalog.pg_enum e ON t.oid=e.enumtypid WHERE t.typname=c.udt_name) AS "special",
        (SELECT pgd.description FROM pg_catalog.pg_statio_all_tables AS st INNER JOIN pg_catalog.pg_description pgd on (pgd.objoid=st.relid) WHERE c.ordinal_position=pgd.objsubid AND c.table_name=st.relname) AS "Comment"
        FROM information_schema.columns c
        LEFT JOIN (SELECT tc.table_schema, tc.table_name,
        cu.column_name, tc.constraint_type
        FROM information_schema.TABLE_CONSTRAINTS tc
        JOIN information_schema.KEY_COLUMN_USAGE  cu
        ON tc.table_schema=cu.table_schema and tc.table_name=cu.table_name
        and tc.constraint_name=cu.constraint_name
        and tc.constraint_type='PRIMARY KEY') pk
        ON pk.table_schema=c.table_schema
        AND pk.table_name=c.table_name
        AND pk.column_name=c.column_name
        WHERE c.table_name = 'myTable' AND c.table_schema = 'public'`,
      mssql: `SELECT
        c.COLUMN_NAME AS 'Name',
        c.DATA_TYPE AS 'Type',
        c.CHARACTER_MAXIMUM_LENGTH AS 'Length',
        c.IS_NULLABLE as 'IsNull',
        COLUMN_DEFAULT AS 'Default',
        pk.CONSTRAINT_TYPE AS 'Constraint',
        COLUMNPROPERTY(OBJECT_ID('[' + c.TABLE_SCHEMA + '].[' + c.TABLE_NAME + ']'), c.COLUMN_NAME, 'IsIdentity') as 'IsIdentity',
        CAST(prop.value AS NVARCHAR) AS 'Comment'
        FROM
        INFORMATION_SCHEMA.TABLES t
        INNER JOIN
        INFORMATION_SCHEMA.COLUMNS c ON t.TABLE_NAME = c.TABLE_NAME AND t.TABLE_SCHEMA = c.TABLE_SCHEMA
        LEFT JOIN (SELECT tc.table_schema, tc.table_name,
        cu.column_name, tc.CONSTRAINT_TYPE
        FROM INFORMATION_SCHEMA.TABLE_CONSTRAINTS tc
        JOIN INFORMATION_SCHEMA.KEY_COLUMN_USAGE  cu
        ON tc.table_schema=cu.table_schema and tc.table_name=cu.table_name
        and tc.constraint_name=cu.constraint_name
        and tc.CONSTRAINT_TYPE='PRIMARY KEY') pk
        ON pk.table_schema=c.table_schema
        AND pk.table_name=c.table_name
        AND pk.column_name=c.column_name
        INNER JOIN sys.columns AS sc
        ON sc.object_id = object_id('[' + t.table_schema + '].[' + t.table_name + ']') AND sc.name = c.column_name
        LEFT JOIN sys.extended_properties prop ON prop.major_id = sc.object_id
        AND prop.minor_id = sc.column_id
        AND prop.name = 'MS_Description'
        WHERE t.TABLE_NAME = N'myTable' AND t.TABLE_SCHEMA = N'dbo'`,
      sqlite3: 'PRAGMA TABLE_INFO(`myTable`)',
      db2: `SELECT COLNAME AS "Name", TABNAME AS "Table", TABSCHEMA AS "Schema",
        TYPENAME AS "Type", LENGTH AS "Length", SCALE AS "Scale", NULLS AS "IsNull",
        DEFAULT AS "Default", COLNO AS "Colno", IDENTITY AS "IsIdentity", KEYSEQ AS "KeySeq",
        REMARKS AS "Comment" FROM SYSCAT.COLUMNS WHERE TABNAME = 'myTable' AND TABSCHEMA = 'DB2INST1'`,
      ibmi: `SELECT
        QSYS2.SYSCOLUMNS.*,
        QSYS2.SYSCST.CONSTRAINT_NAME,
        QSYS2.SYSCST.CONSTRAINT_TYPE
        FROM QSYS2.SYSCOLUMNS
        LEFT OUTER JOIN QSYS2.SYSCSTCOL
        ON QSYS2.SYSCOLUMNS.TABLE_SCHEMA = QSYS2.SYSCSTCOL.TABLE_SCHEMA
        AND QSYS2.SYSCOLUMNS.TABLE_NAME = QSYS2.SYSCSTCOL.TABLE_NAME
        AND QSYS2.SYSCOLUMNS.COLUMN_NAME = QSYS2.SYSCSTCOL.COLUMN_NAME
        LEFT JOIN QSYS2.SYSCST
        ON QSYS2.SYSCSTCOL.CONSTRAINT_NAME = QSYS2.SYSCST.CONSTRAINT_NAME
        WHERE QSYS2.SYSCOLUMNS.TABLE_SCHEMA = CURRENT SCHEMA
        AND QSYS2.SYSCOLUMNS.TABLE_NAME = 'myTable'`,
    });
  });

  it('produces a query to describe a table from a model', () => {
    const MyModel = sequelize.define('MyModel', {});

    expectsql(() => queryGenerator.describeTableQuery(MyModel), {
      default: 'SHOW FULL COLUMNS FROM [MyModels];',
      postgres: `SELECT
        pk.constraint_type as "Constraint",
        c.column_name as "Field",
        c.column_default as "Default",
        c.is_nullable as "Null",
        (CASE WHEN c.udt_name = 'hstore' THEN c.udt_name ELSE c.data_type END) || (CASE WHEN c.character_maximum_length IS NOT NULL THEN '(' || c.character_maximum_length || ')' ELSE '' END) as "Type",
        (SELECT array_agg(e.enumlabel) FROM pg_catalog.pg_type t JOIN pg_catalog.pg_enum e ON t.oid=e.enumtypid WHERE t.typname=c.udt_name) AS "special",
        (SELECT pgd.description FROM pg_catalog.pg_statio_all_tables AS st INNER JOIN pg_catalog.pg_description pgd on (pgd.objoid=st.relid) WHERE c.ordinal_position=pgd.objsubid AND c.table_name=st.relname) AS "Comment"
        FROM information_schema.columns c
        LEFT JOIN (SELECT tc.table_schema, tc.table_name,
        cu.column_name, tc.constraint_type
        FROM information_schema.TABLE_CONSTRAINTS tc
        JOIN information_schema.KEY_COLUMN_USAGE  cu
        ON tc.table_schema=cu.table_schema and tc.table_name=cu.table_name
        and tc.constraint_name=cu.constraint_name
        and tc.constraint_type='PRIMARY KEY') pk
        ON pk.table_schema=c.table_schema
        AND pk.table_name=c.table_name
        AND pk.column_name=c.column_name
        WHERE c.table_name = 'MyModels' AND c.table_schema = 'public'`,
      mssql: `SELECT
        c.COLUMN_NAME AS 'Name',
        c.DATA_TYPE AS 'Type',
        c.CHARACTER_MAXIMUM_LENGTH AS 'Length',
        c.IS_NULLABLE as 'IsNull',
        COLUMN_DEFAULT AS 'Default',
        pk.CONSTRAINT_TYPE AS 'Constraint',
        COLUMNPROPERTY(OBJECT_ID('[' + c.TABLE_SCHEMA + '].[' + c.TABLE_NAME + ']'), c.COLUMN_NAME, 'IsIdentity') as 'IsIdentity',
        CAST(prop.value AS NVARCHAR) AS 'Comment'
        FROM
        INFORMATION_SCHEMA.TABLES t
        INNER JOIN
        INFORMATION_SCHEMA.COLUMNS c ON t.TABLE_NAME = c.TABLE_NAME AND t.TABLE_SCHEMA = c.TABLE_SCHEMA
        LEFT JOIN (SELECT tc.table_schema, tc.table_name,
        cu.column_name, tc.CONSTRAINT_TYPE
        FROM INFORMATION_SCHEMA.TABLE_CONSTRAINTS tc
        JOIN INFORMATION_SCHEMA.KEY_COLUMN_USAGE  cu
        ON tc.table_schema=cu.table_schema and tc.table_name=cu.table_name
        and tc.constraint_name=cu.constraint_name
        and tc.CONSTRAINT_TYPE='PRIMARY KEY') pk
        ON pk.table_schema=c.table_schema
        AND pk.table_name=c.table_name
        AND pk.column_name=c.column_name
        INNER JOIN sys.columns AS sc
        ON sc.object_id = object_id('[' + t.table_schema + '].[' + t.table_name + ']') AND sc.name = c.column_name
        LEFT JOIN sys.extended_properties prop ON prop.major_id = sc.object_id
        AND prop.minor_id = sc.column_id
        AND prop.name = 'MS_Description'
        WHERE t.TABLE_NAME = N'MyModels' AND t.TABLE_SCHEMA = N'dbo'`,
      sqlite3: 'PRAGMA TABLE_INFO(`MyModels`)',
      db2: `SELECT COLNAME AS "Name", TABNAME AS "Table", TABSCHEMA AS "Schema",
        TYPENAME AS "Type", LENGTH AS "Length", SCALE AS "Scale", NULLS AS "IsNull",
        DEFAULT AS "Default", COLNO AS "Colno", IDENTITY AS "IsIdentity", KEYSEQ AS "KeySeq",
        REMARKS AS "Comment" FROM SYSCAT.COLUMNS WHERE TABNAME = 'MyModels' AND TABSCHEMA = 'DB2INST1'`,
      ibmi: `SELECT
        QSYS2.SYSCOLUMNS.*,
        QSYS2.SYSCST.CONSTRAINT_NAME,
        QSYS2.SYSCST.CONSTRAINT_TYPE
        FROM QSYS2.SYSCOLUMNS
        LEFT OUTER JOIN QSYS2.SYSCSTCOL
        ON QSYS2.SYSCOLUMNS.TABLE_SCHEMA = QSYS2.SYSCSTCOL.TABLE_SCHEMA
        AND QSYS2.SYSCOLUMNS.TABLE_NAME = QSYS2.SYSCSTCOL.TABLE_NAME
        AND QSYS2.SYSCOLUMNS.COLUMN_NAME = QSYS2.SYSCSTCOL.COLUMN_NAME
        LEFT JOIN QSYS2.SYSCST
        ON QSYS2.SYSCSTCOL.CONSTRAINT_NAME = QSYS2.SYSCST.CONSTRAINT_NAME
        WHERE QSYS2.SYSCOLUMNS.TABLE_SCHEMA = CURRENT SCHEMA
        AND QSYS2.SYSCOLUMNS.TABLE_NAME = 'MyModels'`,
    });
  });

  it('produces a query to describe a table from a model definition', () => {
    const MyModel = sequelize.define('MyModel', {});
    const myDefinition = MyModel.modelDefinition;

    expectsql(() => queryGenerator.describeTableQuery(myDefinition), {
      default: 'SHOW FULL COLUMNS FROM [MyModels];',
      postgres: `SELECT
        pk.constraint_type as "Constraint",
        c.column_name as "Field",
        c.column_default as "Default",
        c.is_nullable as "Null",
        (CASE WHEN c.udt_name = 'hstore' THEN c.udt_name ELSE c.data_type END) || (CASE WHEN c.character_maximum_length IS NOT NULL THEN '(' || c.character_maximum_length || ')' ELSE '' END) as "Type",
        (SELECT array_agg(e.enumlabel) FROM pg_catalog.pg_type t JOIN pg_catalog.pg_enum e ON t.oid=e.enumtypid WHERE t.typname=c.udt_name) AS "special",
        (SELECT pgd.description FROM pg_catalog.pg_statio_all_tables AS st INNER JOIN pg_catalog.pg_description pgd on (pgd.objoid=st.relid) WHERE c.ordinal_position=pgd.objsubid AND c.table_name=st.relname) AS "Comment"
        FROM information_schema.columns c
        LEFT JOIN (SELECT tc.table_schema, tc.table_name,
        cu.column_name, tc.constraint_type
        FROM information_schema.TABLE_CONSTRAINTS tc
        JOIN information_schema.KEY_COLUMN_USAGE  cu
        ON tc.table_schema=cu.table_schema and tc.table_name=cu.table_name
        and tc.constraint_name=cu.constraint_name
        and tc.constraint_type='PRIMARY KEY') pk
        ON pk.table_schema=c.table_schema
        AND pk.table_name=c.table_name
        AND pk.column_name=c.column_name
        WHERE c.table_name = 'MyModels' AND c.table_schema = 'public'`,
      mssql: `SELECT
        c.COLUMN_NAME AS 'Name',
        c.DATA_TYPE AS 'Type',
        c.CHARACTER_MAXIMUM_LENGTH AS 'Length',
        c.IS_NULLABLE as 'IsNull',
        COLUMN_DEFAULT AS 'Default',
        pk.CONSTRAINT_TYPE AS 'Constraint',
        COLUMNPROPERTY(OBJECT_ID('[' + c.TABLE_SCHEMA + '].[' + c.TABLE_NAME + ']'), c.COLUMN_NAME, 'IsIdentity') as 'IsIdentity',
        CAST(prop.value AS NVARCHAR) AS 'Comment'
        FROM
        INFORMATION_SCHEMA.TABLES t
        INNER JOIN
        INFORMATION_SCHEMA.COLUMNS c ON t.TABLE_NAME = c.TABLE_NAME AND t.TABLE_SCHEMA = c.TABLE_SCHEMA
        LEFT JOIN (SELECT tc.table_schema, tc.table_name,
        cu.column_name, tc.CONSTRAINT_TYPE
        FROM INFORMATION_SCHEMA.TABLE_CONSTRAINTS tc
        JOIN INFORMATION_SCHEMA.KEY_COLUMN_USAGE  cu
        ON tc.table_schema=cu.table_schema and tc.table_name=cu.table_name
        and tc.constraint_name=cu.constraint_name
        and tc.CONSTRAINT_TYPE='PRIMARY KEY') pk
        ON pk.table_schema=c.table_schema
        AND pk.table_name=c.table_name
        AND pk.column_name=c.column_name
        INNER JOIN sys.columns AS sc
        ON sc.object_id = object_id('[' + t.table_schema + '].[' + t.table_name + ']') AND sc.name = c.column_name
        LEFT JOIN sys.extended_properties prop ON prop.major_id = sc.object_id
        AND prop.minor_id = sc.column_id
        AND prop.name = 'MS_Description'
        WHERE t.TABLE_NAME = N'MyModels' AND t.TABLE_SCHEMA = N'dbo'`,
      sqlite3: 'PRAGMA TABLE_INFO(`MyModels`)',
      db2: `SELECT COLNAME AS "Name", TABNAME AS "Table", TABSCHEMA AS "Schema",
        TYPENAME AS "Type", LENGTH AS "Length", SCALE AS "Scale", NULLS AS "IsNull",
        DEFAULT AS "Default", COLNO AS "Colno", IDENTITY AS "IsIdentity", KEYSEQ AS "KeySeq",
        REMARKS AS "Comment" FROM SYSCAT.COLUMNS WHERE TABNAME = 'MyModels' AND TABSCHEMA = 'DB2INST1'`,
      ibmi: `SELECT
        QSYS2.SYSCOLUMNS.*,
        QSYS2.SYSCST.CONSTRAINT_NAME,
        QSYS2.SYSCST.CONSTRAINT_TYPE
        FROM QSYS2.SYSCOLUMNS
        LEFT OUTER JOIN QSYS2.SYSCSTCOL
        ON QSYS2.SYSCOLUMNS.TABLE_SCHEMA = QSYS2.SYSCSTCOL.TABLE_SCHEMA
        AND QSYS2.SYSCOLUMNS.TABLE_NAME = QSYS2.SYSCSTCOL.TABLE_NAME
        AND QSYS2.SYSCOLUMNS.COLUMN_NAME = QSYS2.SYSCSTCOL.COLUMN_NAME
        LEFT JOIN QSYS2.SYSCST
        ON QSYS2.SYSCSTCOL.CONSTRAINT_NAME = QSYS2.SYSCST.CONSTRAINT_NAME
        WHERE QSYS2.SYSCOLUMNS.TABLE_SCHEMA = CURRENT SCHEMA
        AND QSYS2.SYSCOLUMNS.TABLE_NAME = 'MyModels'`,
    });
  });

  it('produces a query to describe a table with schema in tableName object', () => {
    expectsql(
      () => queryGenerator.describeTableQuery({ tableName: 'myTable', schema: 'mySchema' }),
      {
        default: 'SHOW FULL COLUMNS FROM [mySchema].[myTable];',
        postgres: `SELECT
        pk.constraint_type as "Constraint",
        c.column_name as "Field",
        c.column_default as "Default",
        c.is_nullable as "Null",
        (CASE WHEN c.udt_name = 'hstore' THEN c.udt_name ELSE c.data_type END) || (CASE WHEN c.character_maximum_length IS NOT NULL THEN '(' || c.character_maximum_length || ')' ELSE '' END) as "Type",
        (SELECT array_agg(e.enumlabel) FROM pg_catalog.pg_type t JOIN pg_catalog.pg_enum e ON t.oid=e.enumtypid WHERE t.typname=c.udt_name) AS "special",
        (SELECT pgd.description FROM pg_catalog.pg_statio_all_tables AS st INNER JOIN pg_catalog.pg_description pgd on (pgd.objoid=st.relid) WHERE c.ordinal_position=pgd.objsubid AND c.table_name=st.relname) AS "Comment"
        FROM information_schema.columns c
        LEFT JOIN (SELECT tc.table_schema, tc.table_name,
        cu.column_name, tc.constraint_type
        FROM information_schema.TABLE_CONSTRAINTS tc
        JOIN information_schema.KEY_COLUMN_USAGE  cu
        ON tc.table_schema=cu.table_schema and tc.table_name=cu.table_name
        and tc.constraint_name=cu.constraint_name
        and tc.constraint_type='PRIMARY KEY') pk
        ON pk.table_schema=c.table_schema
        AND pk.table_name=c.table_name
        AND pk.column_name=c.column_name
        WHERE c.table_name = 'myTable' AND c.table_schema = 'mySchema'`,
        mssql: `SELECT
        c.COLUMN_NAME AS 'Name',
        c.DATA_TYPE AS 'Type',
        c.CHARACTER_MAXIMUM_LENGTH AS 'Length',
        c.IS_NULLABLE as 'IsNull',
        COLUMN_DEFAULT AS 'Default',
        pk.CONSTRAINT_TYPE AS 'Constraint',
        COLUMNPROPERTY(OBJECT_ID('[' + c.TABLE_SCHEMA + '].[' + c.TABLE_NAME + ']'), c.COLUMN_NAME, 'IsIdentity') as 'IsIdentity',
        CAST(prop.value AS NVARCHAR) AS 'Comment'
        FROM INFORMATION_SCHEMA.TABLES t
        INNER JOIN INFORMATION_SCHEMA.COLUMNS c ON t.TABLE_NAME = c.TABLE_NAME AND t.TABLE_SCHEMA = c.TABLE_SCHEMA
        LEFT JOIN (SELECT tc.table_schema, tc.table_name,
        cu.column_name, tc.CONSTRAINT_TYPE
        FROM INFORMATION_SCHEMA.TABLE_CONSTRAINTS tc
        JOIN INFORMATION_SCHEMA.KEY_COLUMN_USAGE  cu
        ON tc.table_schema=cu.table_schema and tc.table_name=cu.table_name
        and tc.constraint_name=cu.constraint_name
        and tc.CONSTRAINT_TYPE='PRIMARY KEY') pk
        ON pk.table_schema=c.table_schema
        AND pk.table_name=c.table_name
        AND pk.column_name=c.column_name
        INNER JOIN sys.columns AS sc
        ON sc.object_id = object_id('[' + t.table_schema + '].[' + t.table_name + ']') AND sc.name = c.column_name
        LEFT JOIN sys.extended_properties prop ON prop.major_id = sc.object_id
        AND prop.minor_id = sc.column_id
        AND prop.name = 'MS_Description'
        WHERE t.TABLE_NAME = N'myTable' AND t.TABLE_SCHEMA = N'mySchema'`,
        sqlite3: 'PRAGMA TABLE_INFO(`mySchema.myTable`)',
        db2: `SELECT COLNAME AS "Name", TABNAME AS "Table", TABSCHEMA AS "Schema",
        TYPENAME AS "Type", LENGTH AS "Length", SCALE AS "Scale", NULLS AS "IsNull",
        DEFAULT AS "Default", COLNO AS "Colno", IDENTITY AS "IsIdentity", KEYSEQ AS "KeySeq",
        REMARKS AS "Comment" FROM SYSCAT.COLUMNS WHERE TABNAME = 'myTable' AND TABSCHEMA = 'mySchema'`,
        ibmi: `SELECT
        QSYS2.SYSCOLUMNS.*,
        QSYS2.SYSCST.CONSTRAINT_NAME,
        QSYS2.SYSCST.CONSTRAINT_TYPE
        FROM QSYS2.SYSCOLUMNS
        LEFT OUTER JOIN QSYS2.SYSCSTCOL
        ON QSYS2.SYSCOLUMNS.TABLE_SCHEMA = QSYS2.SYSCSTCOL.TABLE_SCHEMA
        AND QSYS2.SYSCOLUMNS.TABLE_NAME = QSYS2.SYSCSTCOL.TABLE_NAME
        AND QSYS2.SYSCOLUMNS.COLUMN_NAME = QSYS2.SYSCSTCOL.COLUMN_NAME
        LEFT JOIN QSYS2.SYSCST
        ON QSYS2.SYSCSTCOL.CONSTRAINT_NAME = QSYS2.SYSCST.CONSTRAINT_NAME
        WHERE QSYS2.SYSCOLUMNS.TABLE_SCHEMA = 'mySchema'
        AND QSYS2.SYSCOLUMNS.TABLE_NAME = 'myTable'`,
      },
    );
  });

  it('produces a query to describe a table with default schema in tableName object', () => {
    expectsql(
      () =>
        queryGenerator.describeTableQuery({
          tableName: 'myTable',
          schema: dialect.getDefaultSchema(),
        }),
      {
        default: 'SHOW FULL COLUMNS FROM [myTable];',
        postgres: `SELECT
        pk.constraint_type as "Constraint",
        c.column_name as "Field",
        c.column_default as "Default",
        c.is_nullable as "Null",
        (CASE WHEN c.udt_name = 'hstore' THEN c.udt_name ELSE c.data_type END) || (CASE WHEN c.character_maximum_length IS NOT NULL THEN '(' || c.character_maximum_length || ')' ELSE '' END) as "Type",
        (SELECT array_agg(e.enumlabel) FROM pg_catalog.pg_type t JOIN pg_catalog.pg_enum e ON t.oid=e.enumtypid WHERE t.typname=c.udt_name) AS "special",
        (SELECT pgd.description FROM pg_catalog.pg_statio_all_tables AS st INNER JOIN pg_catalog.pg_description pgd on (pgd.objoid=st.relid) WHERE c.ordinal_position=pgd.objsubid AND c.table_name=st.relname) AS "Comment"
        FROM information_schema.columns c
        LEFT JOIN (SELECT tc.table_schema, tc.table_name,
        cu.column_name, tc.constraint_type
        FROM information_schema.TABLE_CONSTRAINTS tc
        JOIN information_schema.KEY_COLUMN_USAGE  cu
        ON tc.table_schema=cu.table_schema and tc.table_name=cu.table_name
        and tc.constraint_name=cu.constraint_name
        and tc.constraint_type='PRIMARY KEY') pk
        ON pk.table_schema=c.table_schema
        AND pk.table_name=c.table_name
        AND pk.column_name=c.column_name
        WHERE c.table_name = 'myTable' AND c.table_schema = 'public'`,
        mssql: `SELECT
        c.COLUMN_NAME AS 'Name',
        c.DATA_TYPE AS 'Type',
        c.CHARACTER_MAXIMUM_LENGTH AS 'Length',
        c.IS_NULLABLE as 'IsNull',
        COLUMN_DEFAULT AS 'Default',
        pk.CONSTRAINT_TYPE AS 'Constraint',
        COLUMNPROPERTY(OBJECT_ID('[' + c.TABLE_SCHEMA + '].[' + c.TABLE_NAME + ']'), c.COLUMN_NAME, 'IsIdentity') as 'IsIdentity',
        CAST(prop.value AS NVARCHAR) AS 'Comment'
        FROM INFORMATION_SCHEMA.TABLES t
        INNER JOIN
        INFORMATION_SCHEMA.COLUMNS c ON t.TABLE_NAME = c.TABLE_NAME AND t.TABLE_SCHEMA = c.TABLE_SCHEMA
        LEFT JOIN (SELECT tc.table_schema, tc.table_name,
        cu.column_name, tc.CONSTRAINT_TYPE
        FROM INFORMATION_SCHEMA.TABLE_CONSTRAINTS tc
        JOIN INFORMATION_SCHEMA.KEY_COLUMN_USAGE  cu
        ON tc.table_schema=cu.table_schema and tc.table_name=cu.table_name
        and tc.constraint_name=cu.constraint_name
        and tc.CONSTRAINT_TYPE='PRIMARY KEY') pk
        ON pk.table_schema=c.table_schema
        AND pk.table_name=c.table_name
        AND pk.column_name=c.column_name
        INNER JOIN sys.columns AS sc
        ON sc.object_id = object_id('[' + t.table_schema + '].[' + t.table_name + ']') AND sc.name = c.column_name
        LEFT JOIN sys.extended_properties prop ON prop.major_id = sc.object_id
        AND prop.minor_id = sc.column_id
        AND prop.name = 'MS_Description'
        WHERE t.TABLE_NAME = N'myTable' AND t.TABLE_SCHEMA = N'dbo'`,
        sqlite3: 'PRAGMA TABLE_INFO(`myTable`)',
        db2: `SELECT COLNAME AS "Name", TABNAME AS "Table", TABSCHEMA AS "Schema",
        TYPENAME AS "Type", LENGTH AS "Length", SCALE AS "Scale", NULLS AS "IsNull",
        DEFAULT AS "Default", COLNO AS "Colno", IDENTITY AS "IsIdentity", KEYSEQ AS "KeySeq",
        REMARKS AS "Comment" FROM SYSCAT.COLUMNS WHERE TABNAME = 'myTable' AND TABSCHEMA = 'DB2INST1'`,
        ibmi: `SELECT
        QSYS2.SYSCOLUMNS.*,
        QSYS2.SYSCST.CONSTRAINT_NAME,
        QSYS2.SYSCST.CONSTRAINT_TYPE
        FROM QSYS2.SYSCOLUMNS
        LEFT OUTER JOIN QSYS2.SYSCSTCOL
        ON QSYS2.SYSCOLUMNS.TABLE_SCHEMA = QSYS2.SYSCSTCOL.TABLE_SCHEMA
        AND QSYS2.SYSCOLUMNS.TABLE_NAME = QSYS2.SYSCSTCOL.TABLE_NAME
        AND QSYS2.SYSCOLUMNS.COLUMN_NAME = QSYS2.SYSCSTCOL.COLUMN_NAME
        LEFT JOIN QSYS2.SYSCST
        ON QSYS2.SYSCSTCOL.CONSTRAINT_NAME = QSYS2.SYSCST.CONSTRAINT_NAME
        WHERE QSYS2.SYSCOLUMNS.TABLE_SCHEMA = CURRENT SCHEMA
        AND QSYS2.SYSCOLUMNS.TABLE_NAME = 'myTable'`,
      },
    );
  });

  it('produces a query to describe a table from a table and globally set schema', () => {
    const sequelizeSchema = createSequelizeInstance({ schema: 'mySchema' });
    const queryGeneratorSchema = sequelizeSchema.queryGenerator;

    expectsql(() => queryGeneratorSchema.describeTableQuery('myTable'), {
      default: 'SHOW FULL COLUMNS FROM [mySchema].[myTable];',
      postgres: `SELECT
        pk.constraint_type as "Constraint",
        c.column_name as "Field",
        c.column_default as "Default",
        c.is_nullable as "Null",
        (CASE WHEN c.udt_name = 'hstore' THEN c.udt_name ELSE c.data_type END) || (CASE WHEN c.character_maximum_length IS NOT NULL THEN '(' || c.character_maximum_length || ')' ELSE '' END) as "Type",
        (SELECT array_agg(e.enumlabel) FROM pg_catalog.pg_type t JOIN pg_catalog.pg_enum e ON t.oid=e.enumtypid WHERE t.typname=c.udt_name) AS "special",
        (SELECT pgd.description FROM pg_catalog.pg_statio_all_tables AS st INNER JOIN pg_catalog.pg_description pgd on (pgd.objoid=st.relid) WHERE c.ordinal_position=pgd.objsubid AND c.table_name=st.relname) AS "Comment"
        FROM information_schema.columns c
        LEFT JOIN (SELECT tc.table_schema, tc.table_name,
        cu.column_name, tc.constraint_type
        FROM information_schema.TABLE_CONSTRAINTS tc
        JOIN information_schema.KEY_COLUMN_USAGE  cu
        ON tc.table_schema=cu.table_schema and tc.table_name=cu.table_name
        and tc.constraint_name=cu.constraint_name
        and tc.constraint_type='PRIMARY KEY') pk
        ON pk.table_schema=c.table_schema
        AND pk.table_name=c.table_name
        AND pk.column_name=c.column_name
        WHERE c.table_name = 'myTable' AND c.table_schema = 'mySchema'`,
      mssql: `SELECT
        c.COLUMN_NAME AS 'Name',
        c.DATA_TYPE AS 'Type',
        c.CHARACTER_MAXIMUM_LENGTH AS 'Length',
        c.IS_NULLABLE as 'IsNull',
        COLUMN_DEFAULT AS 'Default',
        pk.CONSTRAINT_TYPE AS 'Constraint',
        COLUMNPROPERTY(OBJECT_ID('[' + c.TABLE_SCHEMA + '].[' + c.TABLE_NAME + ']'), c.COLUMN_NAME, 'IsIdentity') as 'IsIdentity',
        CAST(prop.value AS NVARCHAR) AS 'Comment'
        FROM
        INFORMATION_SCHEMA.TABLES t
        INNER JOIN
        INFORMATION_SCHEMA.COLUMNS c ON t.TABLE_NAME = c.TABLE_NAME AND t.TABLE_SCHEMA = c.TABLE_SCHEMA
        LEFT JOIN (SELECT tc.table_schema, tc.table_name,
        cu.column_name, tc.CONSTRAINT_TYPE
        FROM INFORMATION_SCHEMA.TABLE_CONSTRAINTS tc
        JOIN INFORMATION_SCHEMA.KEY_COLUMN_USAGE  cu
        ON tc.table_schema=cu.table_schema and tc.table_name=cu.table_name
        and tc.constraint_name=cu.constraint_name
        and tc.CONSTRAINT_TYPE='PRIMARY KEY') pk
        ON pk.table_schema=c.table_schema
        AND pk.table_name=c.table_name
        AND pk.column_name=c.column_name
        INNER JOIN sys.columns AS sc
        ON sc.object_id = object_id('[' + t.table_schema + '].[' + t.table_name + ']') AND sc.name = c.column_name
        LEFT JOIN sys.extended_properties prop ON prop.major_id = sc.object_id
        AND prop.minor_id = sc.column_id
        AND prop.name = 'MS_Description'
        WHERE t.TABLE_NAME = N'myTable' AND t.TABLE_SCHEMA = N'mySchema'`,
      sqlite3: 'PRAGMA TABLE_INFO(`mySchema.myTable`)',
      db2: `SELECT COLNAME AS "Name", TABNAME AS "Table", TABSCHEMA AS "Schema",
        TYPENAME AS "Type", LENGTH AS "Length", SCALE AS "Scale", NULLS AS "IsNull",
        DEFAULT AS "Default", COLNO AS "Colno", IDENTITY AS "IsIdentity", KEYSEQ AS "KeySeq",
        REMARKS AS "Comment" FROM SYSCAT.COLUMNS WHERE TABNAME = 'myTable' AND TABSCHEMA = 'mySchema'`,
      ibmi: `SELECT
        QSYS2.SYSCOLUMNS.*,
        QSYS2.SYSCST.CONSTRAINT_NAME,
        QSYS2.SYSCST.CONSTRAINT_TYPE
        FROM QSYS2.SYSCOLUMNS
        LEFT OUTER JOIN QSYS2.SYSCSTCOL
        ON QSYS2.SYSCOLUMNS.TABLE_SCHEMA = QSYS2.SYSCSTCOL.TABLE_SCHEMA
        AND QSYS2.SYSCOLUMNS.TABLE_NAME = QSYS2.SYSCSTCOL.TABLE_NAME
        AND QSYS2.SYSCOLUMNS.COLUMN_NAME = QSYS2.SYSCSTCOL.COLUMN_NAME
        LEFT JOIN QSYS2.SYSCST
        ON QSYS2.SYSCSTCOL.CONSTRAINT_NAME = QSYS2.SYSCST.CONSTRAINT_NAME
        WHERE QSYS2.SYSCOLUMNS.TABLE_SCHEMA = 'mySchema'
        AND QSYS2.SYSCOLUMNS.TABLE_NAME = 'myTable'`,
    });
  });

  it('produces a query to describe a table with schema and custom delimiter argument', () => {
    // This test is only relevant for dialects that do not support schemas
    if (dialect.supports.schemas) {
      return;
    }

    expectsql(
      () =>
        queryGenerator.describeTableQuery({
          tableName: 'myTable',
          schema: 'mySchema',
          delimiter: 'custom',
        }),
      {
        sqlite3: 'PRAGMA TABLE_INFO(`mySchemacustommyTable`)',
      },
    );
  });
});
