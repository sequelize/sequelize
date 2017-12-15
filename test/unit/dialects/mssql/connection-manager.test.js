'use strict';

const chai = require('chai'),
  expect = chai.expect,
  Sequelize = require(__dirname + '/../../../../index'),
  Support = require(__dirname + '/../../support'),
  dialect = Support.getTestDialect(),
  tedious = require('tedious'),
  sinon = require('sinon'),
  connectionStub = sinon.stub(tedious, 'Connection');

if (dialect !== 'mssql') { return; }

connectionStub.returns({on() {}});

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
});
