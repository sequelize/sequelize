'use strict';

const chai = require('chai');

const expect = chai.expect;
const Support = require('../../support');

const { Sequelize } = require('@sequelize/core');

const dialectName = Support.getTestDialect();

describe('[MSSQL Specific] Connection Manager', () => {
  if (dialectName !== 'mssql') {
    return;
  }

  describe('Errors', () => {
    // TODO [>=7.0.0-beta]: Refactor so this is the only connection it tries to connect with
    it.skip('ECONNREFUSED', async () => {
      const sequelize = Support.createSingleTestSequelizeInstance({ host: '127.0.0.1', port: 34_237 });
      await expect(sequelize.connectionManager.getConnection()).to.have.been.rejectedWith(Sequelize.ConnectionRefusedError);

      await sequelize.close();
    });

    it('ENOTFOUND', async () => {
      const sequelize = Support.createSingleTestSequelizeInstance({ host: 'http://wowow.example.com' });
      await expect(sequelize.connectionManager.getConnection()).to.have.been.rejectedWith(Sequelize.HostNotFoundError);

      await sequelize.close();
    });

    // TODO [>=7.0.0-beta]: Refactor so this is the only connection it tries to connect with
    it.skip('EHOSTUNREACH', async () => {
      const sequelize = Support.createSingleTestSequelizeInstance({ host: '255.255.255.255' });
      await expect(sequelize.connectionManager.getConnection()).to.have.been.rejectedWith(Sequelize.HostNotReachableError);

      await sequelize.close();
    });

    it('ER_ACCESS_DENIED_ERROR | ELOGIN', async () => {
      const sequelize = Support.createSingleTestSequelizeInstance({
        database: 'db',
        username: 'was',
        password: 'ddsd',
      });
      await expect(sequelize.connectionManager.getConnection()).to.have.been.rejectedWith(Sequelize.AccessDeniedError);

      await sequelize.close();
    });
  });
});
