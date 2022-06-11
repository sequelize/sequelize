'use strict';

const chai = require('chai');

const expect = chai.expect;
const Support = require('./support');
const { DataTypes } = require('@sequelize/core');

const dialect = Support.getTestDialect();
const sinon = require('sinon');

describe(Support.getTestDialectTeaser('Replication'), () => {
  if (['sqlite', 'ibmi'].includes(dialect)) {
    return;
  }

  describe('connection objects', () => {
    let sandbox;
    let readSpy;
    let writeSpy;

    beforeEach(async function () {
      sandbox = sinon.createSandbox();
      this.sequelize = Support.getSequelizeInstance(null, null, null, {
        replication: {
          write: Support.getConnectionOptionsWithoutPool(),
          read: [Support.getConnectionOptionsWithoutPool()],
        },
      });

      expect(this.sequelize.connectionManager.pool.write).to.be.ok;
      expect(this.sequelize.connectionManager.pool.read).to.be.ok;

      this.User = this.sequelize.define('User', {
        firstName: {
          type: DataTypes.STRING,
          field: 'first_name',
        },
      });

      await this.User.sync({ force: true });
      readSpy = sandbox.spy(this.sequelize.connectionManager.pool.read, 'acquire');
      writeSpy = sandbox.spy(this.sequelize.connectionManager.pool.write, 'acquire');
    });

    afterEach(() => {
      sandbox.restore();
    });

    function expectReadCalls() {
      chai.expect(readSpy.callCount).least(1);
      chai.expect(writeSpy.notCalled).eql(true);
    }

    function expectWriteCalls() {
      chai.expect(writeSpy.callCount).least(1);
      chai.expect(readSpy.notCalled).eql(true);
    }

    it('should be able to make a write', async function () {
      await expectWriteCalls(await this.User.create({
        firstName: Math.random().toString(),
      }));
    });

    it('should be able to make a read', async function () {
      await expectReadCalls(await this.User.findAll());
    });

    it('should run read-only transactions on the replica', async function () {
      await expectReadCalls(await this.sequelize.transaction({ readOnly: true }, transaction => {
        return this.User.findAll({ transaction });
      }));
    });

    it('should run non-read-only transactions on the primary', async function () {
      await expectWriteCalls(await this.sequelize.transaction(transaction => {
        return this.User.findAll({ transaction });
      }));
    });
  });

  describe('connection strings', () => {
    let sandbox;
    let readSpy;
    let writeSpy;

    beforeEach(async function () {
      sandbox = sinon.createSandbox();

      const db = Support.getConnectionOptionsWithoutPool();
      const connectionString = new URL('protocol://username:password@host/database');
      connectionString.protocol = dialect;
      connectionString.host = db.host;
      connectionString.port = db.port;
      connectionString.username = db.username;
      connectionString.password = db.password;
      connectionString.pathname = `/${db.database}`;
      this.sequelize = Support.getSequelizeInstance(null, null, null, {
        replication: {
          write: connectionString.toString(),
          read: [connectionString.toString()],
        },
      });

      expect(this.sequelize.connectionManager.pool.write).to.be.ok;
      expect(this.sequelize.connectionManager.pool.read).to.be.ok;

      this.User = this.sequelize.define('User', {
        firstName: {
          type: DataTypes.STRING,
          field: 'first_name',
        },
      });

      await this.User.sync({ force: true });
      readSpy = sandbox.spy(this.sequelize.connectionManager.pool.read, 'acquire');
      writeSpy = sandbox.spy(this.sequelize.connectionManager.pool.write, 'acquire');
    });

    afterEach(() => {
      sandbox.restore();
    });

    function expectReadCalls() {
      chai.expect(readSpy.callCount).least(1);
      chai.expect(writeSpy.notCalled).eql(true);
    }

    function expectWriteCalls() {
      chai.expect(writeSpy.callCount).least(1);
      chai.expect(readSpy.notCalled).eql(true);
    }

    it('should be able to make a write', async function () {
      await expectWriteCalls(await this.User.create({
        firstName: Math.random().toString(),
      }));
    });

    it('should be able to make a read', async function () {
      await expectReadCalls(await this.User.findAll());
    });

    it('should run read-only transactions on the replica', async function () {
      await expectReadCalls(await this.sequelize.transaction({ readOnly: true }, transaction => {
        return this.User.findAll({ transaction });
      }));
    });

    it('should run non-read-only transactions on the primary', async function () {
      await expectWriteCalls(await this.sequelize.transaction(transaction => {
        return this.User.findAll({ transaction });
      }));
    });
  });
});
