'use strict';

const chai = require('chai');

const expect = chai.expect;
const Support = require('../../support');

const { Sequelize } = require('@sequelize/core');

const dialect = Support.getTestDialect();

if (dialect.startsWith('mssql')) {
  describe('[MSSQL Specific] Connection Manager', () => {
    describe('Errors', () => {
      // TODO [>=7.0.0-beta]: Refactor so this is the only connection it tries to connect with
      it.skip('ECONNREFUSED', async () => {
        const sequelize = Support.createSequelizeInstance({ host: '127.0.0.1', port: 34_237 });
        await expect(sequelize.connectionManager.getConnection()).to.have.been.rejectedWith(Sequelize.ConnectionRefusedError);
      });

      it('ENOTFOUND', async () => {
        const sequelize = Support.createSequelizeInstance({ host: 'http://wowow.example.com' });
        await expect(sequelize.connectionManager.getConnection()).to.have.been.rejectedWith(Sequelize.HostNotFoundError);
      });

      // TODO [>=7.0.0-beta]: Refactor so this is the only connection it tries to connect with
      it.skip('EHOSTUNREACH', async () => {
        const sequelize = Support.createSequelizeInstance({ host: '255.255.255.255' });
        await expect(sequelize.connectionManager.getConnection()).to.have.been.rejectedWith(Sequelize.HostNotReachableError);
      });

      it('ER_ACCESS_DENIED_ERROR | ELOGIN', async () => {
        const sequelize = Support.createSequelizeInstance({
          database: 'db',
          username: 'was',
          password: 'ddsd',
        });
        await expect(sequelize.connectionManager.getConnection()).to.have.been.rejectedWith(Sequelize.AccessDeniedError);
      });
    });
  });
}
