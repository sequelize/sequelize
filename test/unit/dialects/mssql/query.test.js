'use strict';

const { MsSqlQuery: Query } = require('@sequelize/core/_non-semver-use-at-your-own-risk_/dialects/mssql/query.js');
const Support = require('../../support');

const dialect = Support.getTestDialect();
const sequelize = Support.sequelize;
const sinon = require('sinon');
const expect = require('chai').expect;
const tedious = require('tedious');

const tediousIsolationLevel = tedious.ISOLATION_LEVEL;
const connectionStub = { beginTransaction: () => {}, lib: tedious };

let sandbox;
let query;

if (dialect === 'mssql') {
  describe('[MSSQL Specific] Query', () => {
    beforeEach(() => {
      sandbox = sinon.createSandbox();
      const options = {
        transaction: { name: 'transactionName' },
        isolationLevel: 'REPEATABLE_READ',
        logging: false,
      };
      sandbox.stub(connectionStub, 'beginTransaction').callsArg(0);
      query = new Query(connectionStub, sequelize, options);
    });

    afterEach(() => {
      sandbox.restore();
    });

    describe('beginTransaction', () => {
      it('should call beginTransaction with correct arguments', async () => {
        await query._run(connectionStub, 'BEGIN TRANSACTION');
        expect(connectionStub.beginTransaction.called).to.equal(true);
        expect(connectionStub.beginTransaction.args[0][1]).to.equal('transactionName');
        expect(connectionStub.beginTransaction.args[0][2]).to.equal(tediousIsolationLevel.REPEATABLE_READ);
      });
    });

    describe('getSQLTypeFromJsType', () => {
      const TYPES = tedious.TYPES;
      it('should return correct parameter type', () => {
        expect(query.getSQLTypeFromJsType(2_147_483_647, TYPES)).to.eql({ type: TYPES.Int, typeOptions: {} });
        expect(query.getSQLTypeFromJsType(-2_147_483_648, TYPES)).to.eql({ type: TYPES.Int, typeOptions: {} });

        expect(query.getSQLTypeFromJsType(2_147_483_648, TYPES)).to.eql({ type: TYPES.BigInt, typeOptions: {} });
        expect(query.getSQLTypeFromJsType(-2_147_483_649, TYPES)).to.eql({ type: TYPES.BigInt, typeOptions: {} });

        expect(query.getSQLTypeFromJsType(Buffer.from('abc'), TYPES)).to.eql({ type: TYPES.VarBinary, typeOptions: {} });
      });

      it('should return parameter type correct scale for float', () => {
        expect(query.getSQLTypeFromJsType(1.23, TYPES)).to.eql({ type: TYPES.Numeric, typeOptions: { precision: 30, scale: 2 } });
        expect(query.getSQLTypeFromJsType(0.300_000_000_000_000_04, TYPES)).to.eql({ type: TYPES.Numeric, typeOptions: { precision: 30, scale: 17 } });
        expect(query.getSQLTypeFromJsType(2.5e-15, TYPES)).to.eql({ type: TYPES.Numeric, typeOptions: { precision: 30, scale: 16 } });
      });
    });

  });
}
