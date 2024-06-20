import { Sequelize } from '@sequelize/core';
import type { MariaDbConnectionOptions } from '@sequelize/mariadb';
import { MariaDbDialect } from '@sequelize/mariadb';
import { expect } from 'chai';

describe('MariaDbDialect#parseConnectionUrl', () => {
  const dialect = new Sequelize({ dialect: MariaDbDialect }).dialect;

  it('parses connection URL', () => {
    const options: MariaDbConnectionOptions = dialect.parseConnectionUrl(
      'mariadb://user:password@localhost:1234/dbname?charset=utf8mb4',
    );

    expect(options).to.deep.eq({
      host: 'localhost',
      port: 1234,
      user: 'user',
      password: 'password',
      database: 'dbname',
      charset: 'utf8mb4',
    });
  });
});
