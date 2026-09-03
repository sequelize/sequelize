import { Sequelize } from '@sequelize/core';
import type { MsSqlConnectionOptions } from '@sequelize/mssql';
import { MsSqlDialect, MsSqlQuery } from '@sequelize/mssql';
import { expect } from 'chai';
import { TYPES } from 'tedious';

type TestableMsSqlQuery = MsSqlQuery & {
  getSQLTypeFromJsType(value: unknown, types: typeof TYPES): unknown;
};

describe('MsSqlDialect#parseConnectionUrl', () => {
  const dialect = new Sequelize({ dialect: MsSqlDialect }).dialect;

  it('parses connection URL', () => {
    const options: MsSqlConnectionOptions = dialect.parseConnectionUrl(
      'sqlserver://user:password@localhost:1234/dbname?language=en',
    );

    expect(options).to.deep.eq({
      server: 'localhost',
      port: 1234,
      database: 'dbname',
      language: 'en',
      authentication: {
        type: 'default',
        options: {
          userName: 'user',
          password: 'password',
        },
      },
    });
  });
});

describe('MsSqlDialect#escapeString', () => {
  it('uses Unicode string literals by default', () => {
    const dialect = new Sequelize({ dialect: MsSqlDialect }).dialect;

    expect(dialect.escapeString("O'Brien")).to.equal("N'O''Brien'");
  });

  it('uses non-Unicode string literals when useUnicodeStrings is disabled', () => {
    const dialect = new Sequelize({
      dialect: MsSqlDialect,
      useUnicodeStrings: false,
    }).dialect;

    expect(dialect.escapeString("O'Brien")).to.equal("'O''Brien'");
  });
});

describe('MsSqlQuery#getSQLTypeFromJsType', () => {
  it('uses NVarChar for strings by default', () => {
    const sequelize = new Sequelize({ dialect: MsSqlDialect });
    const query = new MsSqlQuery({} as never, sequelize, {
      logging: false,
      plain: false,
      raw: false,
    }) as TestableMsSqlQuery;

    expect(query.getSQLTypeFromJsType('a string', TYPES)).to.deep.equal({
      type: TYPES.NVarChar,
      typeOptions: {},
      value: 'a string',
    });
  });

  it('uses VarChar for strings when useUnicodeStrings is disabled', () => {
    const sequelize = new Sequelize({
      dialect: MsSqlDialect,
      useUnicodeStrings: false,
    });
    const query = new MsSqlQuery({} as never, sequelize, {
      logging: false,
      plain: false,
      raw: false,
    }) as TestableMsSqlQuery;

    expect(query.getSQLTypeFromJsType('a string', TYPES)).to.deep.equal({
      type: TYPES.VarChar,
      typeOptions: {},
      value: 'a string',
    });
  });
});
