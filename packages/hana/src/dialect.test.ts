import { Sequelize } from '@sequelize/core';
import type { HanaConnectionOptions } from '@sequelize/hana';
import { HanaDialect } from '@sequelize/hana';
import { expect } from 'chai';

describe('HanaDialect#parseConnectionUrl', () => {
  const dialect = new Sequelize({ dialect: HanaDialect }).dialect;

  it('parses connection URL', () => {
    const options: HanaConnectionOptions = dialect.parseConnectionUrl(
      'hana://user:password@localhost:1234?database=dbname&charset=UTF-8',
    );

    expect(options).to.deep.eq({
      host: 'localhost',
      port: 1234,
      user: 'user',
      password: 'password',
      database: 'dbname',
      charset: 'UTF-8',
    });
  });
});
