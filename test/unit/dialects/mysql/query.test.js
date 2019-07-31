'use strict';

const path = require('path');
const Query = require(path.resolve('./lib/dialects/mysql/query.js'));
const Support = require(path.join(__dirname, './../../support'));
const chai = require('chai');
const sinon = require('sinon');

const current = Support.sequelize;
const expect = chai.expect;

describe('[MYSQL/MARIADB Specific] Query', () => {
  describe('logWarnings', () => {
    beforeEach(() => {
      sinon.spy(console, 'log');
    });

    afterEach(() => {
      console.log.restore();
    });

    it('check iterable', () => {
      const validWarning = [];
      const invalidWarning = {};
      const warnings = [validWarning, undefined, invalidWarning];

      const query = new Query({}, current, {});
      const stub = sinon.stub(query, 'run');
      stub.onFirstCall().resolves(warnings);

      return query.logWarnings('dummy-results').then(results => {
        expect('dummy-results').to.equal(results);
        expect(true).to.equal(console.log.calledOnce);
      });
    });
  });
});
