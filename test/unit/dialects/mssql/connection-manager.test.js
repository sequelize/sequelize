'use strict';

const chai = require('chai'),
  expect = chai.expect,
  Sequelize = require(__dirname + '/../../../../index'),
  Support = require(__dirname + '/../../support'),
  dialect = Support.getTestDialect(),
  tedious = require('tedious'),
  sinon = require('sinon'),
  connectionStub = sinon.stub(tedious, 'Connection');

let endCb = null;

connectionStub.returns({
  on(name, cb) {
    switch (name) {
      case 'end':
        endCb = cb;
        break;
    }
  }
});

if (dialect === 'mssql') {
  describe('[MSSQL Specific] Connection Manager', () => {
    let instance,
      config;
    beforeEach(() => {
      config = {
        dialect: 'mssql',
        database: 'none',
        username: 'none',
        password: 'none',
        host: 'localhost',
        port: 2433,
        pool: {},
        dialectOptions: {
          domain: 'TEST.COM'
        }
      };
      endCb = null;
      instance = new Sequelize(config.database
        , config.username
        , config.password
        , config);
    });

    it('connectionManager._connect() Does not delete `domain` from config.dialectOptions',
      () => {
        expect(config.dialectOptions.domain).to.equal('TEST.COM');
        instance.dialect.connectionManager._connect(config);
        expect(config.dialectOptions.domain).to.equal('TEST.COM');
      });

    it('connectionManager._connect() should reject if end was called and connect was not',
      done => {
        instance.dialect.connectionManager._connect(config)
          .catch(err => {
            expect(err.name).to.equal('SequelizeConnectionError');
            done();
          });

        setTimeout(() => {
          endCb();
        }, 1000);
      });
  });
}
