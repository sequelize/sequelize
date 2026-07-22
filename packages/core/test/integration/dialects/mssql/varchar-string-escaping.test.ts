import type { CreationOptional, InferAttributes, InferCreationAttributes } from '@sequelize/core';
import { DataTypes, Model, QueryTypes } from '@sequelize/core';
import { expect } from 'chai';
import { beforeAll2, sequelize, setResetMode } from '../../support';

const TABLE = 'mssql_varchar_string_escaping';
const INDEX = 'IX_mssql_varchar_string_escaping_value';

describe('[MSSQL Specific] VARCHAR-safe string escaping', () => {
  if (sequelize.dialect.name !== 'mssql') {
    return;
  }

  setResetMode('none');

  class StringRow extends Model<InferAttributes<StringRow>, InferCreationAttributes<StringRow>> {
    declare id: CreationOptional<number>;
    declare varcharValue: string;
    declare stringValue: string;
    declare textValue: string;
  }

  beforeAll2(async () => {
    await sequelize.query(`
      IF OBJECT_ID(N'[dbo].[sp_mssql_varchar_string_escaping]', 'P') IS NOT NULL
        DROP PROCEDURE [dbo].[sp_mssql_varchar_string_escaping];
    `);
    await sequelize.query(
      `IF OBJECT_ID(N'[dbo].[${TABLE}]', 'U') IS NOT NULL DROP TABLE [dbo].[${TABLE}]`,
    );
    await sequelize.query(`
      CREATE TABLE [dbo].[${TABLE}] (
        [id] INTEGER IDENTITY(1,1) PRIMARY KEY,
        [varchar_value] VARCHAR(100) COLLATE SQL_Latin1_General_CP1_CI_AS NOT NULL,
        [string_value] NVARCHAR(100) NOT NULL,
        [text_value] NVARCHAR(MAX) NOT NULL
      );
      CREATE INDEX [${INDEX}] ON [dbo].[${TABLE}] ([varchar_value]);
      INSERT INTO [dbo].[${TABLE}] ([varchar_value], [string_value], [text_value])
      VALUES
        ('seek-me', N'seek-me', N'seek-me'),
        ('café', N'café', N'café');
    `);
    await sequelize.query(`
      CREATE PROCEDURE [dbo].[sp_mssql_varchar_string_escaping]
        @input NVARCHAR(100)
      AS
        SELECT @input AS [value];
    `);

    StringRow.init(
      {
        id: { type: DataTypes.INTEGER, autoIncrement: true, primaryKey: true },
        varcharValue: { type: DataTypes.STRING(100), field: 'varchar_value' },
        stringValue: { type: DataTypes.STRING(100), field: 'string_value' },
        textValue: { type: DataTypes.TEXT, field: 'text_value' },
      },
      {
        sequelize,
        modelName: 'MssqlVarcharStringEscaping',
        tableName: TABLE,
        timestamps: false,
      },
    );
  });

  after(async () => {
    await sequelize.query(`
      IF OBJECT_ID(N'[dbo].[sp_mssql_varchar_string_escaping]', 'P') IS NOT NULL
        DROP PROCEDURE [dbo].[sp_mssql_varchar_string_escaping];
    `);
    await sequelize.query(
      `IF OBJECT_ID(N'[dbo].[${TABLE}]', 'U') IS NOT NULL DROP TABLE [dbo].[${TABLE}]`,
    );
  });

  it('emits VARCHAR replacement literals for ASCII user strings', async () => {
    const rows = await sequelize.query<{ baseType: string }>(
      `SELECT SQL_VARIANT_PROPERTY(:value, 'BaseType') AS [baseType]`,
      {
        replacements: { value: 'ascii' },
        type: QueryTypes.SELECT,
      },
    );

    expect(rows[0].baseType.toLowerCase()).to.equal('varchar');
  });

  it('keeps non-ASCII replacement literals Unicode', async () => {
    const rows = await sequelize.query<{ baseType: string }>(
      `SELECT SQL_VARIANT_PROPERTY(:value, 'BaseType') AS [baseType]`,
      {
        replacements: { value: 'café' },
        type: QueryTypes.SELECT,
      },
    );

    expect(rows[0].baseType.toLowerCase()).to.equal('nvarchar');
  });

  it('allows an ASCII replacement predicate to use the VARCHAR index', async () => {
    const rows = await sequelize.query<{ id: number }>(
      `SELECT [id] FROM [dbo].[${TABLE}] WITH (INDEX([${INDEX}]), FORCESEEK)
       WHERE [varchar_value] = :value`,
      {
        replacements: { value: 'seek-me' },
        type: QueryTypes.SELECT,
      },
    );

    expect(rows).to.have.length(1);
  });

  it('handles ASCII-only and mixed replacement IN lists per value', async () => {
    const asciiRows = await sequelize.query<{ id: number }>(
      `SELECT [id] FROM [dbo].[${TABLE}]
       WHERE [varchar_value] IN (:first, :second)`,
      {
        replacements: { first: 'seek-me', second: 'missing' },
        type: QueryTypes.SELECT,
      },
    );
    const mixedRows = await sequelize.query<{ id: number }>(
      `SELECT [id] FROM [dbo].[${TABLE}]
       WHERE [varchar_value] IN (:first, :second)`,
      {
        replacements: { first: 'seek-me', second: 'café' },
        type: QueryTypes.SELECT,
      },
    );

    expect(asciiRows).to.have.length(1);
    expect(mixedRows).to.have.length(2);
  });

  it('binds ASCII as VARCHAR and non-ASCII as NVARCHAR', async () => {
    const asciiRows = await sequelize.query<{ baseType: string }>(
      `SELECT SQL_VARIANT_PROPERTY($value, 'BaseType') AS [baseType]`,
      {
        bind: { value: 'ascii' },
        type: QueryTypes.SELECT,
      },
    );
    const unicodeRows = await sequelize.query<{ baseType: string }>(
      `SELECT SQL_VARIANT_PROPERTY($value, 'BaseType') AS [baseType]`,
      {
        bind: { value: 'café' },
        type: QueryTypes.SELECT,
      },
    );

    expect(asciiRows[0].baseType.toLowerCase()).to.equal('varchar');
    expect(unicodeRows[0].baseType.toLowerCase()).to.equal('nvarchar');
  });

  it('allows an ASCII bind predicate to use the VARCHAR index', async () => {
    const rows = await sequelize.query<{ id: number }>(
      `SELECT [id] FROM [dbo].[${TABLE}] WITH (INDEX([${INDEX}]), FORCESEEK)
       WHERE [varchar_value] = $value`,
      {
        bind: { value: 'seek-me' },
        type: QueryTypes.SELECT,
      },
    );

    expect(rows).to.have.length(1);
  });

  it('handles ASCII-only and mixed bind IN lists per value', async () => {
    const asciiRows = await sequelize.query<{ id: number }>(
      `SELECT [id] FROM [dbo].[${TABLE}]
       WHERE [varchar_value] IN ($first, $second)`,
      {
        bind: { first: 'seek-me', second: 'missing' },
        type: QueryTypes.SELECT,
      },
    );
    const mixedRows = await sequelize.query<{ id: number }>(
      `SELECT [id] FROM [dbo].[${TABLE}]
       WHERE [varchar_value] IN ($first, $second)`,
      {
        bind: { first: 'seek-me', second: 'café' },
        type: QueryTypes.SELECT,
      },
    );

    expect(asciiRows).to.have.length(1);
    expect(mixedRows).to.have.length(2);
  });

  it('round-trips control characters and long ASCII binds', async () => {
    const values = [
      'a\0b',
      'a\tb',
      'a\nb',
      'x'.repeat(8000),
      'x'.repeat(8001),
      'é'.repeat(4000),
      'é'.repeat(4001),
    ];
    const results = await Promise.all(
      values.map(async value => {
        const rows = await sequelize.query<{ value: string }>(`SELECT $value AS [value]`, {
          bind: { value },
          type: QueryTypes.SELECT,
        });

        return { rows, value };
      }),
    );

    for (const { rows, value } of results) {
      expect(rows[0].value).to.equal(value);
    }
  });

  it('classifies mixed, repeated, and positional binds independently', async () => {
    const mixedRows = await sequelize.query<{
      asciiType: string;
      unicodeType: string;
    }>(
      `SELECT
         SQL_VARIANT_PROPERTY($ascii, 'BaseType') AS [asciiType],
         SQL_VARIANT_PROPERTY($unicode, 'BaseType') AS [unicodeType]`,
      {
        bind: { ascii: 'plain', unicode: 'café' },
        type: QueryTypes.SELECT,
      },
    );
    const repeatedRows = await sequelize.query<{ value: string }>(
      `SELECT $value + $value AS [value]`,
      {
        bind: { value: 'plain' },
        type: QueryTypes.SELECT,
      },
    );
    const positionalRows = await sequelize.query<{ value: string }>(`SELECT $1 + $2 AS [value]`, {
      bind: ['plain', 'café'],
      type: QueryTypes.SELECT,
    });

    expect(mixedRows[0]).to.deep.equal({
      asciiType: 'varchar',
      unicodeType: 'nvarchar',
    });
    expect(repeatedRows[0].value).to.equal('plainplain');
    expect(positionalRows[0].value).to.equal('plaincafé');
  });

  it('converts ASCII and Unicode binds into declared NVARCHAR procedure parameters', async () => {
    const values = ['plain', 'café 😀'];
    const results = await Promise.all(
      values.map(async value => {
        const rows = await sequelize.query<{ value: string }>(
          `EXEC [dbo].[sp_mssql_varchar_string_escaping] @input = $value`,
          {
            bind: { value },
            type: QueryTypes.SELECT,
          },
        );

        return { rows, value };
      }),
    );

    for (const { rows, value } of results) {
      expect(rows[0].value).to.equal(value);
    }
  });

  it('round-trips ASCII and Unicode through NVARCHAR-mapped attributes', async () => {
    const row = await StringRow.create({
      varcharValue: 'plain',
      stringValue: 'café 😀',
      textValue: '中文 e\u0301',
    });
    const reloaded = await StringRow.findByPk(row.id);

    expect(reloaded?.get('stringValue')).to.equal('café 😀');
    expect(reloaded?.get('textValue')).to.equal('中文 e\u0301');
  });
});
