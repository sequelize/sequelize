'use strict';

const chai = require('chai');
const expect = chai.expect;
const Support = require('./support');
const DataTypes = require('../../lib/data-types');
const dialect = Support.getTestDialect();
const sinon = require('sinon');

describe(Support.getTestDialectTeaser('Replication'), () => {
  if (dialect === 'sqlite') return;

  let sandbox;
  let readSpy, writeSpy;

  beforeEach(async function() {
    sandbox = sinon.createSandbox();

    this.sequelize = Support.getSequelizeInstance(null, null, null, {
      replication: {
        write: Support.getConnectionOptionsWithoutPool(),
        read: [Support.getConnectionOptionsWithoutPool()]
      }
    });

    expect(this.sequelize.connectionManager.pool.write).to.be.ok;
    expect(this.sequelize.connectionManager.pool.read).to.be.ok;

    this.User = this.sequelize.define('User', {
      firstName: {
        type: DataTypes.STRING,
        field: 'first_name'
      }
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

  it('should be able to make a write', async function() {
    await expectWriteCalls(await this.User.create({
      firstName: Math.random().toString()
    }));
  });

  it('should be able to make a read', async function() {
    await expectReadCalls(await this.User.findAll());
  });

  it('should run read-only transactions on the replica', async function() {
    await expectReadCalls(await this.sequelize.transaction({ readOnly: true }, transaction => {
      return this.User.findAll({ transaction });
    }));
  });

  it('should run non-read-only transactions on the primary', async function() {
    await expectWriteCalls(await this.sequelize.transaction(transaction => {
      return this.User.findAll({ transaction });
    }));
  });
});
