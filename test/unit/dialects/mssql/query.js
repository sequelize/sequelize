'use strict';

const path = require('path');
const Query = require(path.resolve('./lib/dialects/mssql/query.js'));
const Support = require(path.resolve('./test/support'));
const sequelize = Support.sequelize;
const sinon = require('sinon');
const expect = require('chai').expect;
const tedious = require('tedious');
const tediousIsolationLevel = tedious.ISOLATION_LEVEL;
const connectionStub = { beginTransaction: () => {}, lib: tedious };

let sandbox, query;

describe('[MSSQL]', () => {
  describe('beginTransaction', () => {
    beforeEach(() => {
      sandbox = sinon.sandbox.create();
      const options = {
        transaction: { name: 'transactionName' },
        isolationLevel: 'REPEATABLE_READ',
        logging: false
      };
      sandbox.stub(connectionStub, 'beginTransaction').callsFake(cb => {
        cb();
      });
      query = new Query(connectionStub, sequelize, options);
    });

    it('should call beginTransaction with correct arguments', () => {
      return query._run(connectionStub, 'BEGIN TRANSACTION')
        .then(() => {
          expect(connectionStub.beginTransaction.called).to.equal(true);
          expect(connectionStub.beginTransaction.args[0][1]).to.equal('transactionName');
          expect(connectionStub.beginTransaction.args[0][2]).to.equal(tediousIsolationLevel.REPEATABLE_READ);
        });
    });

    afterEach(() => {
      sandbox.restore();
    });
  });
});
