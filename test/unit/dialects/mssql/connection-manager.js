'use strict';

let chai = require('chai')
  , expect = chai.expect
  , Sequelize = require(__dirname + '/../../../../index');


let tedious = require('tedious')
  , sinon = require('sinon')
  , connectionStub = sinon.stub(tedious, 'Connection');

connectionStub.returns({on() {}});

describe('[MSSQL] Connection Manager', function() {
  let instance
    , config;
  beforeEach(function() {
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
     function() {
       expect(config.dialectOptions.domain).to.equal('TEST.COM');
       instance.dialect.connectionManager._connect(config);
       expect(config.dialectOptions.domain).to.equal('TEST.COM');
     });
});
