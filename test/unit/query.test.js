'use strict';

const chai = require('chai'),
  sinon = require('sinon'),
  expect = chai.expect,
  Support = require(__dirname + '/support'),
  Sequelize = Support.Sequelize,
  Promise = Sequelize.Promise,
  current = Support.sequelize;

describe('sequelize.query', () => {
  it('connection should be released only once when retry fails', () => {
    const getConnectionStub = sinon.stub(current.connectionManager, 'getConnection').callsFake(() => {
      return Promise.resolve({});
    });
    const releaseConnectionStub = sinon.stub(current.connectionManager, 'releaseConnection').callsFake(() => {
      return Promise.resolve();
    });
    const queryStub = sinon.stub(current.dialect.Query.prototype, 'run').callsFake(() => {
      return Promise.reject(new Error('wrong sql'));
    });
    return current.query('THIS IS A WRONG SQL', {
      retry: {
        max: 2,
        // retry for all errors
        match: null
      }
    })
      .catch(() => {})
      .finally(() => {
        expect(releaseConnectionStub).have.been.calledOnce;
        queryStub.restore();
        getConnectionStub.restore();
        releaseConnectionStub.restore();
      });
  });

  it('connection should be released when query timed out', () => {
    current.options.queryTimeout = 100;

    const getConnectionStub = sinon
      .stub(current.connectionManager, 'getConnection')
      .callsFake(() => Promise.resolve({}));
    const releaseConnectionStub = sinon
      .stub(current.connectionManager, 'releaseConnection')
      .callsFake(() => Promise.resolve());
    const queryStub = sinon
      .stub(current.dialect.Query.prototype, 'run')
      .callsFake(() => new Promise(resolve => setTimeout(resolve, 200)));

    return current.query('THIS IS A WRONG SQL', { queryTimeout: 100 })
      .catch(err => expect(err.message).to.equal('Query timed out'))
      .finally(() => {
        expect(releaseConnectionStub).have.been.calledOnce;

        queryStub.restore();
        getConnectionStub.restore();
        releaseConnectionStub.restore();

        delete current.options.queryTimeout;
      });
  });
});
