'use strict';

const chai = require('chai'),
  expect = chai.expect,
  Sequelize = require(__dirname + '/../../../../index'),
  Support = require(__dirname + '/../../support'),
  dialect = Support.getTestDialect(),
  tedious = require('tedious'),
  sinon = require('sinon');

if (dialect === 'mssql') {
  describe('[MSSQL Specific] Connection Manager', () => {
    beforeEach(function() {
      this.config = {
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
      this.instance = new Sequelize(
        this.config.database,
        this.config.username,
        this.config.password,
        this.config
      );

      this.connectionStub = sinon.stub(tedious, 'Connection');
    });

    afterEach(function() {
      this.connectionStub.restore();
    });

    it('connectionManager._connect() does not delete `domain` from config.dialectOptions', function() {
      this.connectionStub.returns({on(event, cb) {
        if (event === 'connect') {
          setTimeout(() => {
            cb();
          }, 500);
        }
      }});

      expect(this.config.dialectOptions.domain).to.equal('TEST.COM');
      return this.instance.dialect.connectionManager._connect(this.config).then(() => {
        expect(this.config.dialectOptions.domain).to.equal('TEST.COM');
      });
    });

    it('connectionManager._connect() should reject if end was called and connect was not', function() {
      this.connectionStub.returns({ on(event, cb) {
        if (event === 'end') {
          setTimeout(() => {
            cb();
          }, 500);
        }
      } });

      return this.instance.dialect.connectionManager._connect(this.config)
        .catch(err => {
          expect(err.name).to.equal('SequelizeConnectionError');
          expect(err.parent).to.equal('Connection was closed by remote server');
        });
    });
  });
}
