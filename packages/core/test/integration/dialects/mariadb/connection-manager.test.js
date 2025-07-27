'use strict';

const chai = require('chai');

const expect = chai.expect;
const Support = require('../../support');

const dialect = Support.getTestDialect();
const env = process.env;
const { Sequelize } = require('@sequelize/core');

describe('[MARIADB Specific] Connection Manager', () => {
  if (dialect !== 'mariadb') {
    return;
  }

  it('has existing init SQL', async () => {
    const sequelize = Support.createSingleTestSequelizeInstance({
      initSql: `SET @myUserVariable='myValue'`,
    });
    const res = await sequelize.query('SELECT @myUserVariable');
    expect(res[0]).to.deep.equal([{ '@myUserVariable': 'myValue' }]);
    sequelize.close();
  });

  it('has existing init SQL array', async () => {
    const sequelize = Support.createSingleTestSequelizeInstance({
      initSql: [`SET @myUserVariable1='myValue'`, `SET @myUserVariable2='myValue'`],
    });
    const res = await sequelize.query('SELECT @myUserVariable1, @myUserVariable2');
    expect(res[0]).to.deep.equal([
      { '@myUserVariable1': 'myValue', '@myUserVariable2': 'myValue' },
    ]);
    sequelize.close();
  });

  describe('Errors', () => {
    const testHost =
      env.MARIADB_PORT_3306_TCP_ADDR || env.SEQ_MARIADB_HOST || env.SEQ_HOST || '127.0.0.1';

    it('Connection timeout', async () => {
      const sequelize = Support.createSingleTestSequelizeInstance({
        host: testHost,
        port: 65_535,
        connectTimeout: 500,
      });
      await expect(sequelize.pool.acquire()).to.have.been.rejectedWith(
        Sequelize.SequelizeConnectionError,
      );

      await sequelize.close();
    });

    it('ECONNREFUSED', async () => {
      const sequelize = Support.createSingleTestSequelizeInstance({ host: testHost, port: 65_535 });
      await expect(sequelize.pool.acquire()).to.have.been.rejectedWith(
        Sequelize.ConnectionRefusedError,
      );

      await sequelize.close();
    });

    it('ENOTFOUND', async () => {
      const sequelize = Support.createSingleTestSequelizeInstance({
        host: 'http://wowow.example.com',
      });
      await expect(sequelize.pool.acquire()).to.have.been.rejectedWith(Sequelize.HostNotFoundError);

      await sequelize.close();
    });

    it('EHOSTUNREACH', async () => {
      const sequelize = Support.createSingleTestSequelizeInstance({ host: '255.255.255.255' });
      await expect(sequelize.pool.acquire()).to.have.been.rejectedWith(
        Sequelize.HostNotReachableError,
      );

      await sequelize.close();
    });

    it('ER_ACCESS_DENIED_ERROR | ELOGIN', async () => {
      const sequelize = Support.createSingleTestSequelizeInstance({
        database: 'db',
        user: 'was',
        password: 'ddsd',
      });

      await expect(sequelize.pool.acquire()).to.have.been.rejectedWith(Sequelize.AccessDeniedError);

      await sequelize.close();
    });
  });
});
