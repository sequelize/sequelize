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

  it('has existing init SQL', () => {
    const sequelize = Support.createSequelizeInstance(
      { dialectOptions: { initSql: 'SET @myUserVariable=\'myValue\'' } });
    return sequelize.query('SELECT @myUserVariable')
      .then(res => {
        expect(res[0]).to.deep.equal([{ '@myUserVariable': 'myValue' }]);
        sequelize.close();
      });
  });

  it('has existing init SQL array', () => {
    const sequelize = Support.createSequelizeInstance(
      {
        dialectOptions: {
          initSql: ['SET @myUserVariable1=\'myValue\'',
            'SET @myUserVariable2=\'myValue\'']
        }
      });
    return sequelize.query('SELECT @myUserVariable1, @myUserVariable2')
      .then(res => {
        expect(res[0]).to.deep.equal(
          [{ '@myUserVariable1': 'myValue', '@myUserVariable2': 'myValue' }]);
        sequelize.close();
      });
  });



  describe('Errors', () => {
    const testHost = env.MARIADB_PORT_3306_TCP_ADDR || env.SEQ_MARIADB_HOST || env.SEQ_HOST || '127.0.0.1';

    it('Connection timeout', () => {
      const sequelize = Support.createSequelizeInstance({ host: testHost, port: 65535, dialectOptions: { connectTimeout: 500 } });
      return expect(sequelize.connectionManager.getConnection()).to.have.been.rejectedWith(Sequelize.SequelizeConnectionError);
    });

    it('ECONNREFUSED', () => {
      const sequelize = Support.createSequelizeInstance({ host: testHost, port: 65535 });
      return expect(sequelize.connectionManager.getConnection()).to.have.been.rejectedWith(Sequelize.ConnectionRefusedError);
    });

    it('ENOTFOUND', () => {
      const sequelize = Support.createSequelizeInstance({ host: 'http://wowow.example.com' });
      return expect(sequelize.connectionManager.getConnection()).to.have.been.rejectedWith(Sequelize.HostNotFoundError);
    });

    it('EHOSTUNREACH', () => {
      const sequelize = Support.createSequelizeInstance({ host: '255.255.255.255' });
      return expect(sequelize.connectionManager.getConnection()).to.have.been.rejectedWith(Sequelize.HostNotReachableError);
    });

    it('ER_ACCESS_DENIED_ERROR | ELOGIN', () => {
      const sequelize = new Support.Sequelize('localhost', 'was', 'ddsd', Support.sequelize.options);
      return expect(sequelize.connectionManager.getConnection()).to.have.been.rejectedWith(Sequelize.AccessDeniedError);
    });
  });

});

