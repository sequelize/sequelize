import { Sequelize } from '@sequelize/core';
import type { OracleConnectionOptions } from '@sequelize/oracle';
import { OracleDialect } from '@sequelize/oracle';
import { expect } from 'chai';

describe('OracleDialect#parseConnectionUrl', () => {
  const dialect = new Sequelize({ dialect: OracleDialect }).dialect;

  it('parses connection URL', () => {
    const options: OracleConnectionOptions = dialect.parseConnectionUrl(
      'oracle://user:password@localhost:1234/dbname',
    );

    expect(options).to.deep.eq({
      host: 'localhost',
      port: 1234,
      database: 'dbname',
      user: 'user',
      password: 'password',
    });
  });
});