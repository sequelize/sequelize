'use strict';

var chai = require('chai')
  , expect = chai.expect
  , Sequelize = require(__dirname + '/../../../../index');


var tedious = require('tedious')
  , sinon = require('sinon')
  , connectionStub = sinon.stub(tedious, 'Connection');

connectionStub.returns({ on: function () { } });

describe('[ORACLE] Connection Manager', function () {
  var instance
    , config;

  this.timeout(50000);

  it('full database, should connect to Oracle', function (done) {
    //  expect(config.dialectOptions.domain).to.equal('TEST.COM');
    config = {
      dialect: 'oracle',
      host : 'vm2008ora12hot',
      database: 'vm2008ora12hot:1521/ORCL12HOT.kimdomain.local',
      username: 'DEV_RD',
      password: 'DEV_RD'
    };
    instance = new Sequelize(config.database, config.username, config.password, config);

    instance.dialect.connectionManager.$connect(config)
      .then(result => {
        expect(instance.getDialect()).to.equal('oracle');
        instance.dialect.connectionManager.$disconnect(result)
          .then(result => {
            done();
          })
      })
      .catch(error => {
        done(error);
      });
  });

  it('database with only service_name, should connect to Oracle', function (done) {
    //  expect(config.dialectOptions.domain).to.equal('TEST.COM');
    config = {
      dialect: 'oracle',
      host: 'vm2008ora12hot',
      username: 'DEV_RD',
      password: 'DEV_RD',
      database: 'ORCL12HOT.kimdomain.local'
    };
    instance = new Sequelize(config.database, config.username, config.password, config);

    instance.dialect.connectionManager.$connect(config)
      .then(result => {
        expect(instance.getDialect()).to.equal('oracle');
        instance.dialect.connectionManager.$disconnect(result)
          .then(result => {
            done();
          })
      })
      .catch(error => {
        done(error);
      });
  });

  it('database with only service_name no host, should fail', function (done) {
    //  expect(config.dialectOptions.domain).to.equal('TEST.COM');
    config = {
      dialect: 'oracle',
      host: '',
      username: 'DEV_RD',
      password: 'DEV_RD',
      database: 'ORCL12HOT.kimdomain.local'
    };
    instance = new Sequelize(config.database, config.username, config.password, config);

    instance.dialect.connectionManager.$connect(config)
      .then(result => {
        done("You shall not pass");
        expect(instance.getDialect()).to.equal('oracle');
        instance.dialect.connectionManager.$disconnect(result)
          .then(result => {
            done("You shall not pass");
          })
      })
      .catch(error => {
        done();
      });
  });

  it('database empty, should fail', function (done) {
    //  expect(config.dialectOptions.domain).to.equal('TEST.COM');
    config = {
      dialect: 'oracle',
      host: 'vm2008ora12hot',
      username: 'DEV_RD',
      password: 'DEV_RD',
      database: ''
    };
    instance = new Sequelize(config.database, config.username, config.password, config);

    instance.dialect.connectionManager.$connect(config)
      .then(result => {
        done("You shall not pass");
        expect(instance.getDialect()).to.equal('oracle');
        instance.dialect.connectionManager.$disconnect(result)
          .then(result => {
            done("You shall not pass");
          })
      })
      .catch(error => {
        done();
      });
  });
});
