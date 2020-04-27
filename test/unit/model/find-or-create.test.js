'use strict';

const chai = require('chai'),
  expect = chai.expect,
  Support = require('../support'),
  current = Support.sequelize,
  cls = require('cls-hooked'),
  sinon = require('sinon'),
  stub = sinon.stub;

describe(Support.getTestDialectTeaser('Model'), () => {
  describe('method findOrCreate', () => {
    before(() => {
      current.constructor.useCLS(cls.createNamespace('sequelize'));
    });

    after(() => {
      cls.destroyNamespace('sequelize');
      delete current.constructor._cls;
    });

    beforeEach(function() {
      this.User = current.define('User', {}, {
        name: 'John'
      });

      this.transactionStub = stub(this.User.sequelize, 'transaction').rejects(new Error('abort'));

      this.clsStub = stub(current.constructor._cls, 'get').returns({ id: 123 });
    });

    afterEach(function() {
      this.transactionStub.restore();
      this.clsStub.restore();
    });

    it('should use transaction from cls if available', async function() {
      const options = {
        where: {
          name: 'John'
        }
      };

      try {
        await this.User.findOrCreate(options);
        expect.fail('expected to fail');
      } catch (err) {
        if (!/abort/.test(err.message)) throw err;
        expect(this.clsStub.calledOnce).to.equal(true, 'expected to ask for transaction');
      }
    });

    it('should not use transaction from cls if provided as argument', async function() {
      const options = {
        where: {
          name: 'John'
        },
        transaction: { id: 123 }
      };

      try {
        await this.User.findOrCreate(options);
        expect.fail('expected to fail');
      } catch (err) {
        if (!/abort/.test(err.message)) throw err;
        expect(this.clsStub.called).to.equal(false);
      }
    });
  });
});
