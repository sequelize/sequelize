'use strict';

/* jshint -W030 */
var chai = require('chai')
, expect = chai.expect
, sinon = require('sinon')
, Support = require(__dirname + '/support')
, Sequelize = Support.Sequelize
, Promise = Sequelize.Promise;

describe('sequelize.query', function() {
  let sandbox, sequelize;
  beforeEach(function () {
    sequelize = Support.createSequelizeInstance();
    sandbox = sinon.sandbox.create();
    sandbox.stub(sequelize.connectionManager, 'getConnection', () => ({
      close: sandbox.stub(),
    })),
    sandbox.stub(sequelize.dialect, 'Query', () => ({
      run: sinon.stub().returns(Promise.resolve(null)),
    }));
  });

  afterEach(function () {
    sandbox.restore();
  });

  describe('with noImplicitTransactions', () => {
    beforeEach(() => {
      sequelize.options.noImplicitTransactions = true;
    });

    it('does not explode query() with a transaction', () => {
      return sequelize.transaction(transaction => {
        return expect(sequelize.query('SELECT 1;', { transaction })).to.eventually.be.fulfilled;
      });
    });

    it('explodes query() without a transaction', () => {
      expect(() => sequelize.query('SELECT 1;')).to.throw(Sequelize.NoTransactionError);
    });
  });

});
