import { Sequelize } from '@sequelize/core';
import type { MySqlConnectionOptions } from '@sequelize/mysql';
import { MySqlDialect } from '@sequelize/mysql';
import { expect } from 'chai';

describe('MariaDbDialect#parseConnectionUrl', () => {
  const dialect = new Sequelize({ dialect: MySqlDialect }).dialect;

  it('parses connection URL', () => {
    const options: MySqlConnectionOptions = dialect.parseConnectionUrl(
      'mysql://user:password@localhost:1234/dbname?charset=utf8mb4',
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
