'use strict';

const { MySqlQuery } = require('@sequelize/mysql');
const { MariaDbQuery } = require('@sequelize/mariadb');
const { DataTypes, QueryTypes } = require('@sequelize/core');

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
      const stub = sinon.stub(query, 'run');
      stub.onFirstCall().resolves(warnings);

      const results = await query.logWarnings('dummy-results');
      expect('dummy-results').to.equal(results);
      expect(true).to.equal(console.debug.calledOnce);
    });
  });

  describe('formatResults primary keys for bulkCreate', () => {
    // `ResultSetHeader` is the name MySQL's driver gives its metadata object; the MySQL
    // formatResults path only synthesises ids for objects with that constructor name.
    class ResultSetHeader {}

    // A dedicated instance keeps this model out of the shared `sequelize`, whose models
    // other suites reset via `resetSequelizeInstance`.
    let model;
    before(() => {
      model = Support.createSequelizeInstance().define(
        'formatResultsBulkCreate',
        {
          id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
          name: DataTypes.STRING,
        },
        { timestamps: false },
      );
    });

    // MariaDB's driver returns insertId as a BigInt (the range arithmetic depends on it);
    // MySQL's returns a plain number. Otherwise the two paths behave identically.
    const dialects = [
      { name: 'MySqlQuery', Query: MySqlQuery, insertId: 10, id: n => n },
      { name: 'MariaDbQuery', Query: MariaDbQuery, insertId: 10n, id: n => BigInt(n) },
    ];

    for (const { id, insertId, name, Query } of dialects) {
      describe(name, () => {
        const header = affectedRows =>
          Object.assign(new ResultSetHeader(), { insertId, affectedRows });

        it('synthesises a contiguous id range for a plain bulkCreate', () => {
          const query = new Query({}, current, { type: QueryTypes.INSERT, model });

          expect(query.formatResults(header(3))).to.deep.equal([
            [{ id: id(10) }, { id: id(11) }, { id: id(12) }],
            3,
          ]);
        });

        it('does not fabricate ids when updateOnDuplicate is set', () => {
          const query = new Query({}, current, {
            type: QueryTypes.INSERT,
            model,
            updateOnDuplicate: ['name'],
          });

          // affectedRows is weighted (2 per updated row) under updateOnDuplicate, so the
          // synthesised range would be wrong; the raw insertId is returned instead. #18281
          expect(query.formatResults(header(3))).to.deep.equal([insertId, 3]);
        });

        it('does not fabricate ids when ignoreDuplicates is set', () => {
          const query = new Query({}, current, {
            type: QueryTypes.INSERT,
            model,
            ignoreDuplicates: true,
          });

          expect(query.formatResults(header(3))).to.deep.equal([insertId, 3]);
        });
      });
    }
  });
});
