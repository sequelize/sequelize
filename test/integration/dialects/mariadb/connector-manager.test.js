'use strict';

const chai = require('chai'),
  expect = chai.expect,
  Support = require('../../support'),
  dialect = Support.getTestDialect(),
  env = process.env,
  Sequelize = Support.Sequelize;

if (dialect !== 'mariadb') {
  return;
}

describe('[MARIADB Specific] Connection Manager', () => {

  it('has existing init SQL', async () => {
    const sequelize = Support.createSequelizeInstance(
      { dialectOptions: { initSql: 'SET @myUserVariable=\'myValue\'' } });
    const res = await sequelize.query('SELECT @myUserVariable');
    expect(res[0]).to.deep.equal([{ '@myUserVariable': 'myValue' }]);
    sequelize.close();
  });

  it('has existing init SQL array', async () => {
    const sequelize = Support.createSequelizeInstance(
      {
        dialectOptions: {
          initSql: ['SET @myUserVariable1=\'myValue\'',
            'SET @myUserVariable2=\'myValue\'']
        }
      });
    const res = await sequelize.query('SELECT @myUserVariable1, @myUserVariable2');
    expect(res[0]).to.deep.equal(
      [{ '@myUserVariable1': 'myValue', '@myUserVariable2': 'myValue' }]);
    sequelize.close();
  });



  describe('Errors', () => {
    const testHost = env.MARIADB_PORT_3306_TCP_ADDR || env.SEQ_MARIADB_HOST || env.SEQ_HOST || '127.0.0.1';

    it('Connection timeout', async () => {
      const sequelize = Support.createSequelizeInstance({ host: testHost, port: 65535, dialectOptions: { connectTimeout: 500 } });
      await expect(sequelize.connectionManager.getConnection()).to.have.been.rejectedWith(Sequelize.SequelizeConnectionError);
    });

    it('ECONNREFUSED', async () => {
      const sequelize = Support.createSequelizeInstance({ host: testHost, port: 65535 });
      await expect(sequelize.connectionManager.getConnection()).to.have.been.rejectedWith(Sequelize.ConnectionRefusedError);
    });

    it('ENOTFOUND', async () => {
      const sequelize = Support.createSequelizeInstance({ host: 'http://wowow.example.com' });
      await expect(sequelize.connectionManager.getConnection()).to.have.been.rejectedWith(Sequelize.HostNotFoundError);
    });

    it('EHOSTUNREACH', async () => {
      const sequelize = Support.createSequelizeInstance({ host: '255.255.255.255' });
      await expect(sequelize.connectionManager.getConnection()).to.have.been.rejectedWith(Sequelize.HostNotReachableError);
    });

    it('ER_ACCESS_DENIED_ERROR | ELOGIN', async () => {
      const sequelize = new Support.Sequelize('localhost', 'was', 'ddsd', Support.sequelize.options);
      await expect(sequelize.connectionManager.getConnection()).to.have.been.rejectedWith(Sequelize.AccessDeniedError);
    });
  });

});

