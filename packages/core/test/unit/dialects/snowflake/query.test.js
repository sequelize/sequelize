'use strict';

const { SnowflakeQuery: Query } = require('@sequelize/snowflake');

const Support = require('../../../support');
const chai = require('chai');
const sinon = require('sinon');

const current = Support.sequelize;
const expect = chai.expect;

describe('[SNOWFLAKE Specific] Query', () => {
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

  if (current.dialect.name === 'snowflake') {
    describe('run', () => {
      it('parses result columns using their Snowflake data type', async () => {
        const sequelize = Support.createSequelizeInstance({ timezone: 'America/New_York' });
        const ntz = new Date('2022-07-15T10:20:30.123Z');
        const ltz = new Date('2022-07-15T10:20:30.123Z');
        const connection = {
          execute({ complete }) {
            complete(
              null,
              {
                getColumns: () => [
                  { getName: () => 'ntz', getType: () => 'timestamp_ntz' },
                  { getName: () => 'ltz', getType: () => 'timestamp_ltz' },
                ],
              },
              [{ ntz, ltz }],
            );
          },
        };

        const query = new Query(connection, sequelize, {
          type: sequelize.QueryTypes.SELECT,
          raw: true,
        });
        const [row] = await query.run('SELECT 1');

        expect(row.ntz.toISOString()).to.equal('2022-07-15T14:20:30.123Z');
        expect(row.ltz).to.equal(ltz);
      });
    });
  }
});
