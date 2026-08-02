import * as chai from 'chai';
import sinon from 'sinon';
import Support from './support.js';

const expect = chai.expect;

const dialect = Support.getTestDialect();
const current = Support.sequelize;

describe('Transaction', function () {
  before(function () {
    this.stub = sinon.stub(current, 'query').returns(Promise.resolve({}));

    this.stubConnection = sinon.stub(current.connectionManager, 'getConnection').returns(
      Promise.resolve({
        uuid: 'ssfdjd-434fd-43dfg23-2d',
        close() {}
      })
    );

    this.stubRelease = sinon.stub(current.connectionManager, 'releaseConnection').returns(Promise.resolve());
  });

  beforeEach(function () {
    this.stub.resetHistory();
    this.stubConnection.resetHistory();
    this.stubRelease.resetHistory();
  });

  after(function () {
    this.stub.restore();
    this.stubConnection.restore();
  });

  it('should run auto commit query only when needed', function () {
    const expectations = {
      all: ['START TRANSACTION;']
    };
    return current.transaction(() => {
      expect(this.stub.args.map((arg) => arg[0])).to.deep.equal(expectations[dialect] || expectations.all);
      return Promise.resolve();
    });
  });
});
