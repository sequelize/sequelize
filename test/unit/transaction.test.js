'use strict';

const chai = require('chai');
const expect = chai.expect;
const sinon = require('sinon');
const Support = require(__dirname + '/support');
const Sequelize = Support.Sequelize;
const dialect = Support.getTestDialect();
const current = Support.sequelize;

describe('Transaction', function() {
  before(() => {
    this.stub = sinon.stub(current, 'query').returns(Sequelize.Promise.resolve({}));

    this.stubConnection = sinon.stub(current.connectionManager, 'getConnection')
      .returns(Sequelize.Promise.resolve({
        uuid: 'ssfdjd-434fd-43dfg23-2d',
        close() {}
      }));

    this.stubRelease = sinon.stub(current.connectionManager, 'releaseConnection')
      .returns(Sequelize.Promise.resolve());
  });

  beforeEach(() => {
    this.stub.resetHistory();
    this.stubConnection.resetHistory();
    this.stubRelease.resetHistory();
  });

  after(() => {
    this.stub.restore();
    this.stubConnection.restore();
  });

  it('should run auto commit query only when needed', () => {
    const expectations = {
      all: [
        'START TRANSACTION;'
      ],
      sqlite: [
        'BEGIN DEFERRED TRANSACTION;'
      ],
      mssql: [
        'BEGIN TRANSACTION;'
      ]
    };
    return current.transaction(() => {
      expect(this.stub.args.map(arg => arg[0])).to.deep.equal(expectations[dialect] || expectations.all);
      return Sequelize.Promise.resolve();
    });
  });
});
