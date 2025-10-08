'use strict';

const { MySqlQuery } = require('@sequelize/mysql');

const Support = require('../../../support');
const chai = require('chai');
const sinon = require('sinon');

const current = Support.sequelize;
const expect = chai.expect;

describe('[MYSQL/MARIADB Specific] Query', () => {
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

      const query = new MySqlQuery({}, current, {});
      query.sql = 'SELECT 1'; // ensure sql is defined

      const stub = sinon.stub(query, 'run');
      stub.onFirstCall().resolves(warnings);

      const results = await query.logWarnings('dummy-results');
      expect(results).to.equal('dummy-results');
      expect(console.debug.calledOnce).to.equal(true);
    });
  });

  describe('formatResults', () => {
    let query;

    beforeEach(() => {
      query = new MySqlQuery({}, current, {});
      query.sql = 'INSERT INTO Users (id) VALUES (1)'; // ensure sql is defined
    });
    it('returns array of IDs for bulkInsert with model context', () => {
      query.model = {
        primaryKeyAttribute: 'id',
        modelDefinition: {
          autoIncrementAttributeName: 'id',
          getColumnName: () => 'id',
        },
      };

      const data = {
        constructor: { name: 'ResultSetHeader' },
        insertId: 10,
        affectedRows: 3,
      };

      const [result] = query.formatResults(data);

      expect(result).to.deep.equal([{ id: 10 }, { id: 11 }, { id: 12 }]);
    });

    it('returns array of IDs for bulkInsert without model context', () => {
      query.model = null;

      const data = {
        constructor: { name: 'ResultSetHeader' },
        insertId: 20,
        affectedRows: 2,
      };

      const [result] = query.formatResults(data);

      expect(result).to.deep.equal([{ id: 20 }, { id: 21 }]);
    });

    it('returns single ID when only one row inserted', () => {
      query.model = null;

      const data = {
        constructor: { name: 'ResultSetHeader' },
        insertId: 30,
        affectedRows: 1,
      };

      const [result] = query.formatResults(data);

      expect(result).to.deep.equal([{ id: 30 }]);
    });

    it('returns empty array when no rows were inserted', () => {
      query.model = null;

      const data = {
        constructor: { name: 'ResultSetHeader' },
        insertId: 40,
        affectedRows: 0,
      };

      const [result] = query.formatResults(data);
      expect(result).to.deep.equal([]);
    });

    it('handles string insertId values correctly', () => {
      query.model = null;

      const data = {
        constructor: { name: 'ResultSetHeader' },
        insertId: '50',
        affectedRows: 3,
      };

      const [result] = query.formatResults(data);
      expect(result).to.deep.equal([{ id: 50 }, { id: 51 }, { id: 52 }]);
    });

    it('handles BigInt insertId values safely', () => {
      query.model = null;

      const data = {
        constructor: { name: 'ResultSetHeader' },
        insertId: BigInt('9007199254740991'),
        affectedRows: 2,
      };

      const [result] = query.formatResults(data);
      expect(result).to.deep.equal([
        { id: 9_007_199_254_740_991n },
        { id: 9_007_199_254_740_992n },
      ]);
    });
  });
});
