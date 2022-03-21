'use strict';

const chai = require('chai');
const expect = chai.expect;
const sinon = require('sinon');
const Support = require('./support');
const Sequelize = Support.Sequelize;
const dialect = Support.getTestDialect();
const current = Support.sequelize;

describe('Transaction', () => {
  before(function() {
    this.stub = sinon.stub(current, 'query').resolves({});

    this.stubConnection = sinon.stub(current.connectionManager, 'getConnection')
      .resolves({
        uuid: 'ssfdjd-434fd-43dfg23-2d',
        close() {}
      });

    this.stubRelease = sinon.stub(current.connectionManager, 'releaseConnection')
      .resolves();
  });

  beforeEach(function() {
    this.stub.resetHistory();
    this.stubConnection.resetHistory();
    this.stubRelease.resetHistory();
  });

  after(function() {
    this.stub.restore();
    this.stubConnection.restore();
  });

  it('should run auto commit query only when needed', async function() {
    const expectations = {
      all: [
        'START TRANSACTION;'
      ],
      sqlite: [
        'BEGIN DEFERRED TRANSACTION;'
      ],
      db2: [
        'BEGIN TRANSACTION;'
      ],
      mssql: [
        'BEGIN TRANSACTION;'
      ],
      oracle: [
        'BEGIN TRANSACTION'
      ]
    };

    await current.transaction(async () => {
      expect(this.stub.args.map(arg => arg[0])).to.deep.equal(expectations[dialect] || expectations.all);
    });
  });

  it('should set isolation level correctly', async function() {
    const expectations = {
      all: [
        'SET TRANSACTION ISOLATION LEVEL READ UNCOMMITTED;',
        'START TRANSACTION;'
      ],
      postgres: [
        'START TRANSACTION;',
        'SET TRANSACTION ISOLATION LEVEL READ UNCOMMITTED;'
      ],
      sqlite: [
        'BEGIN DEFERRED TRANSACTION;',
        'PRAGMA read_uncommitted = ON;'
      ],
      db2: [
        'BEGIN TRANSACTION;'
      ],
      mssql: [
        'BEGIN TRANSACTION;'
      ],
      oracle: [
        'BEGIN TRANSACTION',
        'SET TRANSACTION ISOLATION LEVEL READ COMMITTED;'
      ]
    };

    await current.transaction({ isolationLevel: Sequelize.Transaction.ISOLATION_LEVELS.READ_UNCOMMITTED }, async () => {
      expect(this.stub.args.map(arg => arg[0])).to.deep.equal(expectations[dialect] || expectations.all);
    });
  });
});
