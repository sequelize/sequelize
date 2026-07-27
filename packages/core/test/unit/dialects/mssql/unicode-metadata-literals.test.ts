import { DataTypes, Op } from '@sequelize/core';
import { MsSqlQueryGenerator as QueryGenerator } from '@sequelize/mssql';
import { expect } from 'chai';
import { expectPerDialect, expectsql, getTestDialect, sequelize } from '../../../support';

const dialectName = getTestDialect();
const queryGenerator = sequelize.queryGenerator;
const internals = queryGenerator.__TEST__getInternals();

/**
 * Isolated coverage for MSSQL metadata / DDL paths that must keep Unicode
 * (N'...') literals. Extracted from pre-existing suites to avoid training
 * conflicts with verifier patches.
 */
describe('[MSSQL Specific] Unicode metadata and DDL literals', () => {
  if (dialectName !== 'mssql') {
    return;
  }

  it('preserves Unicode CHECK literals in addConstraintQuery', () => {
    expectsql(
      () =>
        queryGenerator.addConstraintQuery('myTable', {
          name: 'check',
          type: 'CHECK',
          fields: ['role'],
          where: { role: ['plain', 'café'] },
        }),
      {
        mssql: `ALTER TABLE [myTable] ADD CONSTRAINT [check] CHECK ([role] IN (N'plain', N'café'))`,
      },
    );
  });

  it('preserves Unicode CHECK constraint snippets', () => {
    expectsql(
      () =>
        internals.getConstraintSnippet('myTable', {
          name: 'check',
          type: 'CHECK',
          fields: ['role'],
          where: { role: ['café'] },
        }),
      {
        mssql: `CONSTRAINT [check] CHECK ([role] IN (N'café'))`,
      },
    );
  });

  it('preserves Op.col identifiers in MSSQL CHECK constraints', () => {
    expectsql(
      () =>
        internals.getConstraintSnippet('myTable', {
          name: 'check',
          type: 'CHECK',
          fields: ['authorId'],
          where: { authorId: { [Op.col]: 'users.id' } },
        }),
      {
        mssql: 'CONSTRAINT [check] CHECK ([authorId] = [users].[id])',
      },
    );
  });

  it('preserves Unicode DEFAULT constraint literals', () => {
    expectsql(
      () =>
        internals.getConstraintSnippet('myTable', {
          name: 'default',
          type: 'DEFAULT',
          fields: ['role'],
          defaultValue: 'invité',
        }),
      {
        mssql: `CONSTRAINT [default] DEFAULT (N'invité') FOR [role]`,
      },
    );
  });

  it('preserves Unicode database metadata literals', () => {
    expectsql(() => queryGenerator.createDatabaseQuery('données'), {
      mssql: `IF NOT EXISTS (SELECT * FROM sys.databases WHERE name = N'données' ) CREATE DATABASE [données]`,
    });
  });

  it('preserves Unicode OBJECT_ID literals in createTableQuery', () => {
    expectsql(queryGenerator.createTableQuery('myTable', { myColumn: 'DATE' }), {
      mssql: `IF OBJECT_ID(N'[myTable]', 'U') IS NULL CREATE TABLE [myTable] ([myColumn] DATE);`,
    });
    expectsql(queryGenerator.createTableQuery('tábla', { myColumn: 'DATE' }), {
      mssql: `IF OBJECT_ID(N'[tábla]', 'U') IS NULL CREATE TABLE [tábla] ([myColumn] DATE);`,
    });
  });

  it('preserves Unicode for inline defaults and ENUM checks', () => {
    const ReviewDefaults = sequelize.define(
      'review_defaults_unicode_meta',
      {
        asciiDefault: {
          type: DataTypes.STRING,
          defaultValue: 'plain',
        },
        unicodeDefault: {
          type: DataTypes.STRING,
          defaultValue: 'café',
        },
        mood: DataTypes.ENUM('plain', 'café'),
      },
      {
        freezeTableName: true,
        timestamps: false,
        tableName: 'review_defaults',
      },
    );

    expectsql(
      queryGenerator.createTableQuery(
        ReviewDefaults.table,
        queryGenerator.attributesToSQL(ReviewDefaults.getAttributes()),
        {},
      ),
      {
        mssql: `IF OBJECT_ID(N'[review_defaults]', 'U') IS NULL CREATE TABLE [review_defaults] ([id] INTEGER NOT NULL IDENTITY(1,1) , [asciiDefault] NVARCHAR(255) DEFAULT N'plain', [unicodeDefault] NVARCHAR(255) DEFAULT N'café', [mood] NVARCHAR(255) CHECK ([mood] IN(N'plain', N'café')), PRIMARY KEY ([id]));`,
      },
    );
  });

  it('preserves Unicode table metadata literals in describeTableQuery', () => {
    expect(
      queryGenerator.describeTableQuery({ tableName: 'tábla', schema: 'mySchema' }),
    ).to.include(`WHERE t.TABLE_NAME = N'tábla' AND t.TABLE_SCHEMA = N'mySchema'`);
  });

  it('preserves Unicode JSON path literals', () => {
    expectPerDialect(
      () =>
        queryGenerator.jsonPathExtractionQuery(
          queryGenerator.quoteIdentifier('profile'),
          ['café'],
          true,
        ),
      {
        mssql: `JSON_VALUE([profile], N'$."café"')`,
      },
    );
  });

  it('preserves Unicode database filter literals', () => {
    expectsql(() => queryGenerator.listDatabasesQuery({ skip: ['données'] }), {
      mssql: `SELECT [name] FROM sys.databases WHERE [name] NOT IN (N'master', N'model', N'msdb', N'tempdb', N'données')`,
    });
  });

  it('preserves Unicode schema filter literals', () => {
    expectsql(() => queryGenerator.listSchemasQuery({ skip: ['schéma'] }), {
      mssql: `SELECT [name] AS [schema] FROM sys.schemas WHERE [name] NOT IN (N'dbo', N'guest', N'db_accessadmin', N'db_backupoperator', N'db_datareader', N'db_datawriter', N'db_ddladmin', N'db_denydatareader', N'db_denydatawriter', N'db_owner', N'db_securityadmin', N'INFORMATION_SCHEMA', N'sys', N'schéma')`,
    });
  });

  it('preserves Unicode schema literals in listTablesQuery', () => {
    expectsql(() => queryGenerator.listTablesQuery({ schema: 'mySchema' }), {
      mssql: `SELECT t.name AS [tableName], s.name AS [schema] FROM sys.tables t INNER JOIN sys.schemas s ON t.schema_id = s.schema_id WHERE t.type = 'U' AND s.name = N'mySchema' ORDER BY s.name, t.name`,
    });
    expectsql(() => queryGenerator.listTablesQuery({ schema: 'schéma' }), {
      mssql: `SELECT t.name AS [tableName], s.name AS [schema] FROM sys.tables t INNER JOIN sys.schemas s ON t.schema_id = s.schema_id WHERE t.type = 'U' AND s.name = N'schéma' ORDER BY s.name, t.name`,
    });
  });

  it('preserves Unicode rename metadata literals', () => {
    expectsql(() => queryGenerator.renameTableQuery('oldTable', 'newTable'), {
      mssql: `EXEC sp_rename '[oldTable]', N'newTable'`,
    });
    expectsql(() => queryGenerator.renameTableQuery('oldTable', 'nöuveau'), {
      mssql: `EXEC sp_rename '[oldTable]', N'nöuveau'`,
    });
  });

  it('preserves Unicode catalog filter literals in showConstraintsQuery', () => {
    const sql = queryGenerator.showConstraintsQuery(
      { tableName: 'tábla', schema: 'mySchema' },
      { columnName: 'cölumn', constraintName: 'contrainte_é' },
    );

    expect(sql).to.include(`s.name = N'mySchema'`);
    expect(sql).to.include(`t.name = N'tábla'`);
    expect(sql).to.include(`c.columnNames = N'cölumn'`);
    expect(sql).to.include(`c.constraintName = N'contrainte_é'`);
  });

  it('preserves Unicode OBJECT_ID literals in showIndexesQuery', () => {
    expect(queryGenerator.showIndexesQuery('myTable')).to.include(`OBJECT_ID(N'dbo.myTable')`);
    expect(queryGenerator.showIndexesQuery({ tableName: 'tábla', schema: 'schéma' })).to.include(
      `OBJECT_ID(N'schéma.tábla')`,
    );
  });

  it('preserves Unicode table and schema metadata literals in tableExistsQuery', () => {
    expectsql(() => queryGenerator.tableExistsQuery({ tableName: 'tábla', schema: 'schéma' }), {
      mssql: `SELECT TABLE_NAME FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_TYPE = 'BASE TABLE' AND TABLE_NAME = N'tábla' AND TABLE_SCHEMA = N'schéma'`,
    });
  });

  it('addColumnQuery preserves Unicode comments', () => {
    const mssqlQueryGenerator = new QueryGenerator(sequelize.dialect);

    expectsql(
      mssqlQueryGenerator.addColumnQuery('myTable', 'myColumn', {
        type: 'VARCHAR(255)',
        comment: 'Commentaire café',
      }),
      {
        mssql:
          'ALTER TABLE [myTable] ADD [myColumn] VARCHAR(255) NULL; EXEC sp_addextendedproperty ' +
          "@name = N'MS_Description', @value = N'Commentaire café', " +
          "@level0type = N'Schema', @level0name = N'dbo', " +
          "@level1type = N'Table', @level1name = [myTable], " +
          "@level2type = N'Column', @level2name = [myColumn];",
      },
    );
  });
});
