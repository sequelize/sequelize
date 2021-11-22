'use strict';

const chai = require('chai'),
  expect = chai.expect,
  Sequelize = require('sequelize'),
  Support = require('../../support'),
  dialect = Support.getTestDialect(),
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
      this.Connection = {};
      const self = this;
      this.connectionStub = sinon.stub(this.instance.connectionManager, 'lib').value({
        Connection: function FakeConnection() {
          return self.Connection;
        }
      });
    });

    afterEach(function() {
      this.connectionStub.restore();
    });

    it('connectionManager._connect() does not delete `domain` from config.dialectOptions', async function() {
      this.Connection = {
        STATE: {},
        state: '',
        once(event, cb) {
          if (event === 'connect') {
            setTimeout(() => {
              cb();
            }, 500);
          }
        },
        removeListener: () => {},
        on: () => {}
      };

      expect(this.config.dialectOptions.domain).to.equal('TEST.COM');
      await this.instance.dialect.connectionManager._connect(this.config);
      expect(this.config.dialectOptions.domain).to.equal('TEST.COM');
    });

    it('connectionManager._connect() should reject if end was called and connect was not', async function() {
      this.Connection = {
        STATE: {},
        state: '',
        once(event, cb) {
          if (event === 'end') {
            setTimeout(() => {
              cb();
            }, 500);
          }
        },
        removeListener: () => {},
        on: () => {}
      };

      try {
        await this.instance.dialect.connectionManager._connect(this.config);
      } catch (err) {
        expect(err.name).to.equal('SequelizeConnectionError');
        expect(err.parent.message).to.equal('Connection was closed by remote server');
      }
    });

    it('connectionManager._connect() should call connect if state is initialized', async function() {
      const connectStub = sinon.stub();
      const INITIALIZED = { name: 'INITIALIZED' };
      this.Connection = {
        STATE: { INITIALIZED },
        state: INITIALIZED,
        connect: connectStub,
        once(event, cb) {
          if (event === 'connect') {
            setTimeout(() => {
              cb();
            }, 500);
          }
        },
        removeListener: () => {},
        on: () => {}
      };

      await this.instance.dialect.connectionManager._connect(this.config);
      expect(connectStub.called).to.equal(true);
    });
  });
}
