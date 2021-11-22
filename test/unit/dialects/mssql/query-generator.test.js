'use strict';

const Support = require('../../support');
const expectsql = Support.expectsql;
const current = Support.sequelize;
const DataTypes = require('sequelize/lib/data-types');
const Op = require('sequelize/lib/operators');
const TableHints = require('sequelize/lib/table-hints');
const QueryGenerator = require('sequelize/lib/dialects/mssql/query-generator');

if (current.dialect.name === 'mssql') {
  describe('[MSSQL Specific] QueryGenerator', () => {
    before(function() {
      this.queryGenerator = new QueryGenerator({
        sequelize: this.sequelize,
        _dialect: this.sequelize.dialect
      });
    });

    it('createDatabaseQuery', function() {
      expectsql(this.queryGenerator.createDatabaseQuery('myDatabase'), {
        mssql: "IF NOT EXISTS (SELECT * FROM sys.databases WHERE name = 'myDatabase' ) BEGIN CREATE DATABASE [myDatabase] ; END;"
      });
    });

    it('upsertQuery with falsey values', function() {
      const testTable = this.sequelize.define(
        'test_table',
        {
          Name: {
            type: DataTypes.STRING,
            primaryKey: true
          },
          Age: {
            type: DataTypes.INTEGER
          },
          IsOnline: {
            type: DataTypes.BOOLEAN,
            primaryKey: true
          }
        },
        {
          freezeTableName: true,
          timestamps: false
        }
      );

      const insertValues = {
        Name: 'Charlie',
        Age: 24,
        IsOnline: false
      };

      const updateValues = {
        Age: 24
      };

      const whereValues = [
        {
          Name: 'Charlie',
          IsOnline: false
        }
      ];

      const where = {
        [Op.or]: whereValues
      };

      // the main purpose of this test is to validate this does not throw
      expectsql(this.queryGenerator.upsertQuery('test_table', updateValues, insertValues, where, testTable), {
        mssql:
          "MERGE INTO [test_table] WITH(HOLDLOCK) AS [test_table_target] USING (VALUES(24)) AS [test_table_source]([Age]) ON [test_table_target].[Name] = [test_table_source].[Name] AND [test_table_target].[IsOnline] = [test_table_source].[IsOnline] WHEN MATCHED THEN UPDATE SET [test_table_target].[Name] = N'Charlie', [test_table_target].[Age] = 24, [test_table_target].[IsOnline] = 0 WHEN NOT MATCHED THEN INSERT ([Age]) VALUES(24) OUTPUT $action, INSERTED.*;"
      });
    });

    it('createDatabaseQuery with collate', function() {
      expectsql(this.queryGenerator.createDatabaseQuery('myDatabase', { collate: 'Latin1_General_CS_AS_KS_WS' }), {
        mssql: "IF NOT EXISTS (SELECT * FROM sys.databases WHERE name = 'myDatabase' ) BEGIN CREATE DATABASE [myDatabase] COLLATE N'Latin1_General_CS_AS_KS_WS'; END;"
      });
    });

    it('dropDatabaseQuery', function() {
      expectsql(this.queryGenerator.dropDatabaseQuery('myDatabase'), {
        mssql: "IF EXISTS (SELECT * FROM sys.databases WHERE name = 'myDatabase' ) BEGIN DROP DATABASE [myDatabase] ; END;"
      });
    });

    it('createTableQuery', function() {
      expectsql(this.queryGenerator.createTableQuery('myTable', { int: 'INTEGER' }, {}), {
        mssql: "IF OBJECT_ID('[myTable]', 'U') IS NULL CREATE TABLE [myTable] ([int] INTEGER);"
      });
    });

    it('createTableQuery with comments', function() {
      expectsql(this.queryGenerator.createTableQuery('myTable', { int: 'INTEGER COMMENT Foo Bar', varchar: 'VARCHAR(50) UNIQUE COMMENT Bar Foo' }, {}), {
        mssql: "IF OBJECT_ID('[myTable]', 'U') IS NULL CREATE TABLE [myTable] ([int] INTEGER, [varchar] VARCHAR(50) UNIQUE); EXEC sp_addextendedproperty @name = N'MS_Description', @value = N'Foo Bar', @level0type = N'Schema', @level0name = 'dbo', @level1type = N'Table', @level1name = [myTable], @level2type = N'Column', @level2name = [int]; EXEC sp_addextendedproperty @name = N'MS_Description', @value = N'Bar Foo', @level0type = N'Schema', @level0name = 'dbo', @level1type = N'Table', @level1name = [myTable], @level2type = N'Column', @level2name = [varchar];" });
    });

    it('getDefaultConstraintQuery', function() {
      expectsql(this.queryGenerator.getDefaultConstraintQuery({ tableName: 'myTable', schema: 'mySchema' }, 'myColumn'), {
        mssql: "SELECT name FROM sys.default_constraints WHERE PARENT_OBJECT_ID = OBJECT_ID('[mySchema].[myTable]', 'U') AND PARENT_COLUMN_ID = (SELECT column_id FROM sys.columns WHERE NAME = ('myColumn') AND object_id = OBJECT_ID('[mySchema].[myTable]', 'U'));"
      });
    });

    it('dropConstraintQuery', function() {
      expectsql(this.queryGenerator.dropConstraintQuery({ tableName: 'myTable', schema: 'mySchema' }, 'myConstraint'), {
        mssql: 'ALTER TABLE [mySchema].[myTable] DROP CONSTRAINT [myConstraint];'
      });
    });

    it('bulkInsertQuery', function() {
      //normal cases
      expectsql(this.queryGenerator.bulkInsertQuery('myTable', [{ name: 'foo' }, { name: 'bar' }]), {
        mssql: "INSERT INTO [myTable] ([name]) VALUES (N'foo'),(N'bar');"
      });

      expectsql(this.queryGenerator.bulkInsertQuery('myTable', [{ username: 'username', firstName: 'firstName', lastName: 'lastName' }, { firstName: 'user1FirstName', lastName: 'user1LastName' }]), {
        mssql: "INSERT INTO [myTable] ([username],[firstName],[lastName]) VALUES (N'username',N'firstName',N'lastName'),(NULL,N'user1FirstName',N'user1LastName');"
      });

      expectsql(this.queryGenerator.bulkInsertQuery('myTable', [{ firstName: 'firstName', lastName: 'lastName' }, { firstName: 'user1FirstName', lastName: 'user1LastName' }]), {
        mssql: "INSERT INTO [myTable] ([firstName],[lastName]) VALUES (N'firstName',N'lastName'),(N'user1FirstName',N'user1LastName');"
      });

      //Bulk Insert With autogenerated primary key
      const attributes = { id: { autoIncrement: true } };
      expectsql(this.queryGenerator.bulkInsertQuery('myTable', [{ id: null }], {}, attributes), {
        mssql: 'INSERT INTO [myTable] DEFAULT VALUES'
      });
    });

    it('selectFromTableFragment', function() {
      const modifiedGen = new QueryGenerator({
        sequelize: this.sequelize,
        _dialect: this.sequelize.dialect
      });
      // Test newer versions first
      // Should be all the same since handling is done in addLimitAndOffset
      // for SQL Server 2012 and higher (>= v11.0.0)
      modifiedGen.sequelize = {
        options: {
          databaseVersion: '11.0.0'
        }
      };

      // Base case
      expectsql(modifiedGen.selectFromTableFragment({}, { primaryKeyField: 'id' }, ['id', 'name'], 'myTable', 'myOtherName', 'WHERE id=1'), {
        mssql: 'SELECT id, name FROM myTable AS myOtherName'
      });

      // With tableHint - nolock
      expectsql(modifiedGen.selectFromTableFragment({ tableHint: TableHints.NOLOCK }, { primaryKeyField: 'id' }, ['id', 'name'], 'myTable', 'myOtherName'), {
        mssql: 'SELECT id, name FROM myTable AS myOtherName WITH (NOLOCK)'
      });

      // With tableHint - NOWAIT
      expectsql(modifiedGen.selectFromTableFragment({ tableHint: TableHints.NOWAIT }, { primaryKeyField: 'id' }, ['id', 'name'], 'myTable', 'myOtherName'), {
        mssql: 'SELECT id, name FROM myTable AS myOtherName WITH (NOWAIT)'
      });

      // With limit
      expectsql(modifiedGen.selectFromTableFragment({ limit: 10 }, { primaryKeyField: 'id' }, ['id', 'name'], 'myTable', 'myOtherName'), {
        mssql: 'SELECT id, name FROM myTable AS myOtherName'
      });

      // With offset
      expectsql(modifiedGen.selectFromTableFragment({ offset: 10 }, { primaryKeyField: 'id' }, ['id', 'name'], 'myTable', 'myOtherName'), {
        mssql: 'SELECT id, name FROM myTable AS myOtherName'
      });

      // With both limit and offset
      expectsql(modifiedGen.selectFromTableFragment({ limit: 10, offset: 10 }, { primaryKeyField: 'id' }, ['id', 'name'], 'myTable', 'myOtherName'), {
        mssql: 'SELECT id, name FROM myTable AS myOtherName'
      });

      // Test older version (< v11.0.0)
      modifiedGen.sequelize.options.databaseVersion = '10.0.0';

      // Base case
      expectsql(modifiedGen.selectFromTableFragment({}, { primaryKeyField: 'id' }, ['id', 'name'], 'myTable', 'myOtherName', 'WHERE id=1'), {
        mssql: 'SELECT id, name FROM myTable AS myOtherName'
      });

      // With limit
      expectsql(modifiedGen.selectFromTableFragment({ limit: 10 }, { primaryKeyField: 'id' }, ['id', 'name'], 'myTable', 'myOtherName'), {
        mssql: 'SELECT TOP 10 id, name FROM myTable AS myOtherName'
      });

      // With offset
      expectsql(modifiedGen.selectFromTableFragment({ offset: 10 }, { primaryKeyField: 'id' }, ['id', 'name'], 'myTable', 'myOtherName'), {
        mssql: 'SELECT TOP 100 PERCENT id, name FROM (SELECT * FROM (SELECT ROW_NUMBER() OVER (ORDER BY [id]) as row_num, * FROM myTable AS myOtherName) AS myOtherName WHERE row_num > 10) AS myOtherName'
      });

      // With both limit and offset
      expectsql(modifiedGen.selectFromTableFragment({ limit: 10, offset: 10 }, { primaryKeyField: 'id' }, ['id', 'name'], 'myTable', 'myOtherName'), {
        mssql: 'SELECT TOP 100 PERCENT id, name FROM (SELECT TOP 10 * FROM (SELECT ROW_NUMBER() OVER (ORDER BY [id]) as row_num, * FROM myTable AS myOtherName) AS myOtherName WHERE row_num > 10) AS myOtherName'
      });

      // With limit, offset, include, and where
      const foo = this.sequelize.define('Foo', {
        id: {
          type: DataTypes.INTEGER,
          field: 'id',
          primaryKey: true
        }
      }, {
        tableName: 'Foos'
      });
      const bar = this.sequelize.define('Bar', {
        id: {
          type: DataTypes.INTEGER,
          field: 'id',
          primaryKey: true
        }
      }, {
        tableName: 'Bars'
      });
      foo.Bar = foo.belongsTo(bar, { foreignKey: 'barId' });
      let options = { limit: 10, offset: 10,
        include: [
          {
            model: bar,
            association: foo.Bar,
            as: 'Bars',
            required: true
          }
        ]
      };
      foo._conformIncludes(options);
      options = foo._validateIncludedElements(options);
      expectsql(modifiedGen.selectFromTableFragment(options, foo, ['[Foo].[id]', '[Foo].[barId]'], foo.tableName, 'Foo', '[Bar].[id] = 12'), {
        mssql: 'SELECT TOP 100 PERCENT [Foo].[id], [Foo].[barId] FROM (SELECT TOP 10 * FROM (SELECT ROW_NUMBER() OVER (ORDER BY [id]) as row_num, Foo.* FROM (SELECT DISTINCT Foo.* FROM Foos AS Foo INNER JOIN [Bars] AS [Bar] ON [Foo].[barId] = [Bar].[id] WHERE [Bar].[id] = 12) AS Foo) AS Foo WHERE row_num > 10) AS Foo'
      });
    });

    it('getPrimaryKeyConstraintQuery', function() {
      expectsql(this.queryGenerator.getPrimaryKeyConstraintQuery('myTable', 'myColumnName'), {
        mssql: 'SELECT K.TABLE_NAME AS tableName, K.COLUMN_NAME AS columnName, K.CONSTRAINT_NAME AS constraintName FROM INFORMATION_SCHEMA.TABLE_CONSTRAINTS AS C JOIN INFORMATION_SCHEMA.KEY_COLUMN_USAGE AS K ON C.TABLE_NAME = K.TABLE_NAME AND C.CONSTRAINT_CATALOG = K.CONSTRAINT_CATALOG AND C.CONSTRAINT_SCHEMA = K.CONSTRAINT_SCHEMA AND C.CONSTRAINT_NAME = K.CONSTRAINT_NAME WHERE C.CONSTRAINT_TYPE = \'PRIMARY KEY\' AND K.COLUMN_NAME = \'myColumnName\' AND K.TABLE_NAME = \'myTable\';'
      });
    });

    it('createSchema', function() {
      expectsql(this.queryGenerator.createSchema('mySchema'), {
        mssql: 'IF NOT EXISTS (SELECT schema_name FROM information_schema.schemata WHERE schema_name = \'mySchema\' ) BEGIN EXEC sp_executesql N\'CREATE SCHEMA [mySchema] ;\' END;'
      });
    });

    it('dropSchema', function() {
      expectsql(this.queryGenerator.dropSchema('mySchema'), {
        mssql: 'IF EXISTS (SELECT schema_name FROM information_schema.schemata WHERE schema_name = \'mySchema\' ) BEGIN DECLARE @id INT, @ms_sql NVARCHAR(2000); DECLARE @cascade TABLE ( id INT NOT NULL IDENTITY PRIMARY KEY, ms_sql NVARCHAR(2000) NOT NULL ); INSERT INTO @cascade ( ms_sql ) SELECT CASE WHEN o.type IN (\'F\',\'PK\') THEN N\'ALTER TABLE [\'+ s.name + N\'].[\' + p.name + N\'] DROP CONSTRAINT [\' + o.name + N\']\' ELSE N\'DROP TABLE [\'+ s.name + N\'].[\' + o.name + N\']\' END FROM sys.objects o JOIN sys.schemas s on o.schema_id = s.schema_id LEFT OUTER JOIN sys.objects p on o.parent_object_id = p.object_id WHERE o.type IN (\'F\', \'PK\', \'U\') AND s.name =  \'mySchema\' ORDER BY o.type ASC; SELECT TOP 1 @id = id, @ms_sql = ms_sql FROM @cascade ORDER BY id; WHILE @id IS NOT NULL BEGIN BEGIN TRY EXEC sp_executesql @ms_sql; END TRY BEGIN CATCH BREAK; THROW; END CATCH; DELETE FROM @cascade WHERE id = @id; SELECT @id = NULL, @ms_sql = NULL; SELECT TOP 1 @id = id, @ms_sql = ms_sql FROM @cascade ORDER BY id; END EXEC sp_executesql N\'DROP SCHEMA [mySchema] ;\' END;'
      });
    });

    it('showSchemasQuery', function() {
      expectsql(this.queryGenerator.showSchemasQuery(), {
        mssql: 'SELECT "name" as "schema_name" FROM sys.schemas as s WHERE "s"."name" NOT IN ( \'INFORMATION_SCHEMA\', \'dbo\', \'guest\', \'sys\', \'archive\' ) AND "s"."name" NOT LIKE \'db_%\''
      });
    });

    it('versionQuery', function() {
      expectsql(this.queryGenerator.versionQuery(), {
        mssql: "DECLARE @ms_ver NVARCHAR(20); SET @ms_ver = REVERSE(CONVERT(NVARCHAR(20), SERVERPROPERTY('ProductVersion'))); SELECT REVERSE(SUBSTRING(@ms_ver, CHARINDEX('.', @ms_ver)+1, 20)) AS 'version'"
      });
    });

    it('renameTableQuery', function() {
      expectsql(this.queryGenerator.renameTableQuery('oldTableName', 'newTableName'), {
        mssql: 'EXEC sp_rename [oldTableName], [newTableName];'
      });
    });

    it('showTablesQuery', function() {
      expectsql(this.queryGenerator.showTablesQuery(), {
        mssql: "SELECT TABLE_NAME, TABLE_SCHEMA FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_TYPE = 'BASE TABLE';"
      });
    });

    it('dropTableQuery', function() {
      expectsql(this.queryGenerator.dropTableQuery('dirtyTable'), {
        mssql: "IF OBJECT_ID('[dirtyTable]', 'U') IS NOT NULL DROP TABLE [dirtyTable];"
      });
    });

    it('addColumnQuery', function() {
      expectsql(this.queryGenerator.addColumnQuery('myTable', 'myColumn', { type: 'VARCHAR(255)' }), {
        mssql: 'ALTER TABLE [myTable] ADD [myColumn] VARCHAR(255) NULL;'
      });
    });

    it('addColumnQuery with comment', function() {
      expectsql(this.queryGenerator.addColumnQuery('myTable', 'myColumn', { type: 'VARCHAR(255)', comment: 'This is a comment' }), {
        mssql: 'ALTER TABLE [myTable] ADD [myColumn] VARCHAR(255) NULL; EXEC sp_addextendedproperty ' +
        '@name = N\'MS_Description\', @value = N\'This is a comment\', ' +
        '@level0type = N\'Schema\', @level0name = \'dbo\', ' +
        '@level1type = N\'Table\', @level1name = [myTable], ' +
        '@level2type = N\'Column\', @level2name = [myColumn];'
      });
    });

    it('removeColumnQuery', function() {
      expectsql(this.queryGenerator.removeColumnQuery('myTable', 'myColumn'), {
        mssql: 'ALTER TABLE [myTable] DROP COLUMN [myColumn];'
      });
    });

    it('quoteIdentifier', function() {
      expectsql(this.queryGenerator.quoteIdentifier("'myTable'.'Test'"), {
        mssql: '[myTable.Test]'
      });
    });

    it('getForeignKeysQuery', function() {
      expectsql(this.queryGenerator.getForeignKeysQuery('myTable'), {
        mssql: "SELECT constraint_name = OBJ.NAME, constraintName = OBJ.NAME, constraintSchema = SCHEMA_NAME(OBJ.SCHEMA_ID), tableName = TB.NAME, tableSchema = SCHEMA_NAME(TB.SCHEMA_ID), columnName = COL.NAME, referencedTableSchema = SCHEMA_NAME(RTB.SCHEMA_ID), referencedTableName = RTB.NAME, referencedColumnName = RCOL.NAME FROM sys.foreign_key_columns FKC INNER JOIN sys.objects OBJ ON OBJ.OBJECT_ID = FKC.CONSTRAINT_OBJECT_ID INNER JOIN sys.tables TB ON TB.OBJECT_ID = FKC.PARENT_OBJECT_ID INNER JOIN sys.columns COL ON COL.COLUMN_ID = PARENT_COLUMN_ID AND COL.OBJECT_ID = TB.OBJECT_ID INNER JOIN sys.tables RTB ON RTB.OBJECT_ID = FKC.REFERENCED_OBJECT_ID INNER JOIN sys.columns RCOL ON RCOL.COLUMN_ID = REFERENCED_COLUMN_ID AND RCOL.OBJECT_ID = RTB.OBJECT_ID WHERE TB.NAME ='myTable'"
      });

      expectsql(this.queryGenerator.getForeignKeysQuery('myTable', 'myDatabase'), {
        mssql: "SELECT constraint_name = OBJ.NAME, constraintName = OBJ.NAME, constraintCatalog = 'myDatabase', constraintSchema = SCHEMA_NAME(OBJ.SCHEMA_ID), tableName = TB.NAME, tableSchema = SCHEMA_NAME(TB.SCHEMA_ID), tableCatalog = 'myDatabase', columnName = COL.NAME, referencedTableSchema = SCHEMA_NAME(RTB.SCHEMA_ID), referencedCatalog = 'myDatabase', referencedTableName = RTB.NAME, referencedColumnName = RCOL.NAME FROM sys.foreign_key_columns FKC INNER JOIN sys.objects OBJ ON OBJ.OBJECT_ID = FKC.CONSTRAINT_OBJECT_ID INNER JOIN sys.tables TB ON TB.OBJECT_ID = FKC.PARENT_OBJECT_ID INNER JOIN sys.columns COL ON COL.COLUMN_ID = PARENT_COLUMN_ID AND COL.OBJECT_ID = TB.OBJECT_ID INNER JOIN sys.tables RTB ON RTB.OBJECT_ID = FKC.REFERENCED_OBJECT_ID INNER JOIN sys.columns RCOL ON RCOL.COLUMN_ID = REFERENCED_COLUMN_ID AND RCOL.OBJECT_ID = RTB.OBJECT_ID WHERE TB.NAME ='myTable'"
      });

      expectsql(this.queryGenerator.getForeignKeysQuery({
        tableName: 'myTable',
        schema: 'mySchema'
      }, 'myDatabase'), {
        mssql: "SELECT constraint_name = OBJ.NAME, constraintName = OBJ.NAME, constraintCatalog = 'myDatabase', constraintSchema = SCHEMA_NAME(OBJ.SCHEMA_ID), tableName = TB.NAME, tableSchema = SCHEMA_NAME(TB.SCHEMA_ID), tableCatalog = 'myDatabase', columnName = COL.NAME, referencedTableSchema = SCHEMA_NAME(RTB.SCHEMA_ID), referencedCatalog = 'myDatabase', referencedTableName = RTB.NAME, referencedColumnName = RCOL.NAME FROM sys.foreign_key_columns FKC INNER JOIN sys.objects OBJ ON OBJ.OBJECT_ID = FKC.CONSTRAINT_OBJECT_ID INNER JOIN sys.tables TB ON TB.OBJECT_ID = FKC.PARENT_OBJECT_ID INNER JOIN sys.columns COL ON COL.COLUMN_ID = PARENT_COLUMN_ID AND COL.OBJECT_ID = TB.OBJECT_ID INNER JOIN sys.tables RTB ON RTB.OBJECT_ID = FKC.REFERENCED_OBJECT_ID INNER JOIN sys.columns RCOL ON RCOL.COLUMN_ID = REFERENCED_COLUMN_ID AND RCOL.OBJECT_ID = RTB.OBJECT_ID WHERE TB.NAME ='myTable' AND SCHEMA_NAME(TB.SCHEMA_ID) ='mySchema'"
      });
    });

    it('getForeignKeyQuery', function() {
      expectsql(this.queryGenerator.getForeignKeyQuery('myTable', 'myColumn'), {
        mssql: "SELECT constraint_name = OBJ.NAME, constraintName = OBJ.NAME, constraintSchema = SCHEMA_NAME(OBJ.SCHEMA_ID), tableName = TB.NAME, tableSchema = SCHEMA_NAME(TB.SCHEMA_ID), columnName = COL.NAME, referencedTableSchema = SCHEMA_NAME(RTB.SCHEMA_ID), referencedTableName = RTB.NAME, referencedColumnName = RCOL.NAME FROM sys.foreign_key_columns FKC INNER JOIN sys.objects OBJ ON OBJ.OBJECT_ID = FKC.CONSTRAINT_OBJECT_ID INNER JOIN sys.tables TB ON TB.OBJECT_ID = FKC.PARENT_OBJECT_ID INNER JOIN sys.columns COL ON COL.COLUMN_ID = PARENT_COLUMN_ID AND COL.OBJECT_ID = TB.OBJECT_ID INNER JOIN sys.tables RTB ON RTB.OBJECT_ID = FKC.REFERENCED_OBJECT_ID INNER JOIN sys.columns RCOL ON RCOL.COLUMN_ID = REFERENCED_COLUMN_ID AND RCOL.OBJECT_ID = RTB.OBJECT_ID WHERE TB.NAME ='myTable' AND COL.NAME ='myColumn'"
      });
      expectsql(this.queryGenerator.getForeignKeyQuery({
        tableName: 'myTable',
        schema: 'mySchema'
      }, 'myColumn'), {
        mssql: "SELECT constraint_name = OBJ.NAME, constraintName = OBJ.NAME, constraintSchema = SCHEMA_NAME(OBJ.SCHEMA_ID), tableName = TB.NAME, tableSchema = SCHEMA_NAME(TB.SCHEMA_ID), columnName = COL.NAME, referencedTableSchema = SCHEMA_NAME(RTB.SCHEMA_ID), referencedTableName = RTB.NAME, referencedColumnName = RCOL.NAME FROM sys.foreign_key_columns FKC INNER JOIN sys.objects OBJ ON OBJ.OBJECT_ID = FKC.CONSTRAINT_OBJECT_ID INNER JOIN sys.tables TB ON TB.OBJECT_ID = FKC.PARENT_OBJECT_ID INNER JOIN sys.columns COL ON COL.COLUMN_ID = PARENT_COLUMN_ID AND COL.OBJECT_ID = TB.OBJECT_ID INNER JOIN sys.tables RTB ON RTB.OBJECT_ID = FKC.REFERENCED_OBJECT_ID INNER JOIN sys.columns RCOL ON RCOL.COLUMN_ID = REFERENCED_COLUMN_ID AND RCOL.OBJECT_ID = RTB.OBJECT_ID WHERE TB.NAME ='myTable' AND COL.NAME ='myColumn' AND SCHEMA_NAME(TB.SCHEMA_ID) ='mySchema'"
      });
    });

    it('dropForeignKeyQuery', function() {
      expectsql(this.queryGenerator.dropForeignKeyQuery('myTable', 'myColumnKey'), {
        mssql: 'ALTER TABLE [myTable] DROP [myColumnKey]'
      });
    });

    describe('arithmeticQuery', () => {
      [
        {
          title: 'Should use the plus operator',
          arguments: ['+', 'myTable', {}, { foo: 'bar' }, {}, {}],
          expectation: 'UPDATE [myTable] SET [foo]=[foo]+ N\'bar\' OUTPUT INSERTED.*'
        },
        {
          title: 'Should use the plus operator with where clause',
          arguments: ['+', 'myTable', { bar: 'biz' }, { foo: 'bar' }, {}, {}],
          expectation: 'UPDATE [myTable] SET [foo]=[foo]+ N\'bar\' OUTPUT INSERTED.* WHERE [bar] = N\'biz\''
        },
        {
          title: 'Should use the plus operator without returning clause',
          arguments: ['+', 'myTable', {}, { foo: 'bar' }, {}, { returning: false }],
          expectation: 'UPDATE [myTable] SET [foo]=[foo]+ N\'bar\''
        },
        {
          title: 'Should use the minus operator',
          arguments: ['-', 'myTable', {}, { foo: 'bar' }, {}, {}],
          expectation: 'UPDATE [myTable] SET [foo]=[foo]- N\'bar\' OUTPUT INSERTED.*'
        },
        {
          title: 'Should use the minus operator with negative value',
          arguments: ['-', 'myTable', {}, { foo: -1 }, {}, {}],
          expectation: 'UPDATE [myTable] SET [foo]=[foo]- -1 OUTPUT INSERTED.*'
        },
        {
          title: 'Should use the minus operator with where clause',
          arguments: ['-', 'myTable', { bar: 'biz' }, { foo: 'bar' }, {}, {}],
          expectation: 'UPDATE [myTable] SET [foo]=[foo]- N\'bar\' OUTPUT INSERTED.* WHERE [bar] = N\'biz\''
        },
        {
          title: 'Should use the minus operator without returning clause',
          arguments: ['-', 'myTable', {}, { foo: 'bar' }, {}, { returning: false }],
          expectation: 'UPDATE [myTable] SET [foo]=[foo]- N\'bar\''
        }
      ].forEach(test => {
        it(test.title, function() {
          expectsql(this.queryGenerator.arithmeticQuery(...test.arguments), {
            mssql: test.expectation
          });
        });
      });
    });
  });
}
