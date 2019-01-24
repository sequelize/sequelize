'use strict';

const chai = require('chai'),
  expect = chai.expect,
  Sequelize = require('../../../../index'),
  Support = require('../../support'),
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
          authentication: {
            options: {
              domain: 'TEST.COM'
            }
          }
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

    it('connectionManager._connect() merges username, password, and config.dialectOptions.authentication into config.authentication', function() {
      this.connectionStub.returns({
        once(event, cb) {
          if (event === 'connect') {
            setTimeout(() => {
              cb();
            }, 500);
          }
        },
        removeListener: () => {},
        on: () => {}
      });

      return this.instance.dialect.connectionManager._connect(this.config).then(() => {
        const connectionConfig = this.connectionStub.args[0][0];
        expect(connectionConfig).to.have.property('authentication');
        expect(connectionConfig.authentication).to.have.property('options');

        const authOptions = connectionConfig.authentication.options;
        expect(authOptions).to.have.property('userName', this.config.username);
        expect(authOptions).to.have.property('password', this.config.password);
        expect(authOptions).to.have.property('domain', this.config.dialectOptions.authentication.options.domain);
      });
    });

    it('connectionManager._connect() does not delete `domain` from config.dialectOptions.authentication.options', function() {
      this.connectionStub.returns({
        once(event, cb) {
          if (event === 'connect') {
            setTimeout(() => {
              cb();
            }, 500);
          }
        },
        removeListener: () => {},
        on: () => {}
      });

      expect(this.config.dialectOptions.authentication.options.domain).to.equal('TEST.COM');
      return this.instance.dialect.connectionManager._connect(this.config).then(() => {
        expect(this.config.dialectOptions.authentication.options.domain).to.equal('TEST.COM');
      });
    });

    it('connectionManager._connect() should reject if end was called and connect was not', function() {
      this.connectionStub.returns({
        once(event, cb) {
          if (event === 'end') {
            setTimeout(() => {
              cb();
            }, 500);
          }
        },
        removeListener: () => {},
        on: () => {}
      });

      return this.instance.dialect.connectionManager._connect(this.config)
        .catch(err => {
          expect(err.name).to.equal('SequelizeConnectionError');
          expect(err.parent.message).to.equal('Connection was closed by remote server');
        });
    });
  });
}
