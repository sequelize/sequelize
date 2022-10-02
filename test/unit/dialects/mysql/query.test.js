'use strict';

const path = require('path');
const { MySqlQuery: Query } = require('@sequelize/core/_non-semver-use-at-your-own-risk_/dialects/mysql/query.js');

const Support = require(path.join(__dirname, './../../support'));
const chai = require('chai');
const sinon = require('sinon');

const current = Support.sequelize;
const dialect = Support.getTestDialect();
const expect = chai.expect;

describe('[MYSQL Specific] Query', () => {
  if (dialect !== 'mysql') {
    return;
  }

  describe('logWarnings', () => {
    beforeEach(() => {
      sinon.spy(console, 'debug');
    });

    afterEach(() => {
      console.debug.restore();
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
      expect(true).to.equal(console.debug.calledOnce);
    });
  });
});
