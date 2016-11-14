'use strict';

var chai = require('chai')
  , expect = chai.expect
  , Sequelize = require(__dirname + '/../../../../index');


var tedious = require('tedious')
  , sinon = require('sinon')
  , connectionStub = sinon.stub(tedious, 'Connection');

connectionStub.returns({on: function () {}});

describe('[ORACLE] Connection Manager', function () {
  var instance
    , config;
  beforeEach(function () {
    config = {
      dialect: 'oracle',
      database: 'none',
      username: 'DEV_RD',
      password: 'DEV_RD',
      host: '',
      port: 1521,
      pool: {},
      connecString : 'vm2008ora12hot:1521/ORCL12HOT.kimdomain.local'
    };
    instance = new Sequelize(config.database
                             , config.username
                             , config.password
                             , config);    
  });
  
  it('connectionManager.$connect() Does not delete `domain` from config.dialectOptions',
     function () {
      //  expect(config.dialectOptions.domain).to.equal('TEST.COM');
       instance.dialect.connectionManager.$connect(config);
       expect(instance.getDialect()).to.equal('oracle');
     });
});
