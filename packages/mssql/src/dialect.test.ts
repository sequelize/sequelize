import { Sequelize } from '@sequelize/core';
import type { MsSqlConnectionOptions } from '@sequelize/mssql';
import { MsSqlDialect } from '@sequelize/mssql';
import { expect } from 'chai';

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
