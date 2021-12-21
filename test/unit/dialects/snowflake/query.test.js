'use strict';

const path = require('path');
const Query = require('sequelize/lib/dialects/snowflake/query');
const Support = require(path.join(__dirname, './../../support'));
const chai = require('chai');
const sinon = require('sinon');

const current = Support.sequelize;
const expect = chai.expect;

describe('[SNOWFLAKE Specific] Query', () => {
  describe('logWarnings', () => {
    beforeEach(() => {
      sinon.spy(console, 'log');
    });

    afterEach(() => {
      console.log.restore();
    });

    it('check iterable', async () => {
      const validWarning = [];
      const invalidWarning = {};
      const warnings = [validWarning, undefined, invalidWarning];

      const query = new Query({}, current, {});
      const stub = sinon.stub(query, 'run');
      stub.onFirstCall().resolves(warnings);

      const results = await query.logWarnings('dummy-results');
      expect('dummy-results').to.equal(results);
      expect(true).to.equal(console.log.calledOnce);
    });
  });
});
