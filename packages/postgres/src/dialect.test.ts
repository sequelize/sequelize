import { Sequelize } from '@sequelize/core';
import type { PostgresConnectionOptions } from '@sequelize/postgres';
import { PostgresDialect } from '@sequelize/postgres';
import { expect } from 'chai';

describe('PostgresDialect#parseConnectionUrl', () => {
  const dialect = new Sequelize({ dialect: PostgresDialect }).dialect;

  it('parses connection URL', () => {
    const options: PostgresConnectionOptions = dialect.parseConnectionUrl(
      'postgres://user:password@localhost:1234/dbname?client_encoding=utf8mb4',
    );

    expect(options).to.deep.eq({
      host: 'localhost',
      port: 1234,
      user: 'user',
      password: 'password',
      database: 'dbname',
      client_encoding: 'utf8mb4',
    });
  });

  it('accepts the postgresql:// scheme', () => {
    const options: PostgresConnectionOptions =
      dialect.parseConnectionUrl('postgresql://@localhost');

    expect(options).to.deep.eq({
      host: 'localhost',
    });
  });
});
