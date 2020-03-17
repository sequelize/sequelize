'use strict';

const path = require('path');
const Query = require(path.resolve('./lib/dialects/mssql/query.js'));
const Support = require('../../support');
const dialect = Support.getTestDialect();
const sequelize = Support.sequelize;
const sinon = require('sinon');
const expect = require('chai').expect;
const tedious = require('tedious');
const tediousIsolationLevel = tedious.ISOLATION_LEVEL;
const connectionStub = { beginTransaction: () => {}, lib: tedious };

let sandbox, query;

if (dialect === 'mssql') {
  describe('[MSSQL Specific] Query', () => {
    beforeEach(() => {
      sandbox = sinon.createSandbox();
      const options = {
        transaction: { name: 'transactionName' },
        isolationLevel: 'REPEATABLE_READ',
        logging: false
      };
      sandbox.stub(connectionStub, 'beginTransaction').callsArg(0);
      query = new Query(connectionStub, sequelize, options);
    });

    afterEach(() => {
      sandbox.restore();
    });

    describe('beginTransaction', () => {
      it('should call beginTransaction with correct arguments', () => {
        return query._run(connectionStub, 'BEGIN TRANSACTION')
          .then(() => {
            expect(connectionStub.beginTransaction.called).to.equal(true);
            expect(connectionStub.beginTransaction.args[0][1]).to.equal('transactionName');
            expect(connectionStub.beginTransaction.args[0][2]).to.equal(tediousIsolationLevel.REPEATABLE_READ);
          });
      });
    });

    describe('formatBindParameters', () => {
      it('should convert Sequelize named binding format to MSSQL format', () => {
        const sql = 'select $one as a, $two as b, $one as c, $three as d, $one as e';
        const values = { one: 1, two: 2, three: 3 };

        const expected = 'select @one as a, @two as b, @one as c, @three as d, @one as e';

        const result = Query.formatBindParameters(sql, values, dialect);
        expect(result[0]).to.be.a('string');
        expect(result[0]).to.equal(expected);
      });

      it('should convert Sequelize numbered binding format to MSSQL format', () => {
        const sql = 'select $1 as a, $2 as b, $1 as c, $3 as d, $1 as e';
        const values = [1, 2, 3];

        const expected = 'select @0 as a, @1 as b, @0 as c, @2 as d, @0 as e';

        const result = Query.formatBindParameters(sql, values, dialect);
        expect(result[0]).to.be.a('string');
        expect(result[0]).to.equal(expected);
      });
    });

    describe('getSQLTypeFromJsType', () => {
      const TYPES = tedious.TYPES;
      it('should return correct parameter type', () => {
        expect(query.getSQLTypeFromJsType(2147483647, TYPES)).to.eql({ type: TYPES.Int, typeOptions: {} });
        expect(query.getSQLTypeFromJsType(-2147483648, TYPES)).to.eql({ type: TYPES.Int, typeOptions: {} });

        expect(query.getSQLTypeFromJsType(2147483648, TYPES)).to.eql({ type: TYPES.BigInt, typeOptions: {} });
        expect(query.getSQLTypeFromJsType(-2147483649, TYPES)).to.eql({ type: TYPES.BigInt, typeOptions: {} });

        expect(query.getSQLTypeFromJsType(Buffer.from('abc'), TYPES)).to.eql({ type: TYPES.VarBinary, typeOptions: {} });
      });

      it('should return parameter type correct scale for float', () => {
        expect(query.getSQLTypeFromJsType(1.23, TYPES)).to.eql({ type: TYPES.Numeric, typeOptions: { precision: 30, scale: 2 } });
        expect(query.getSQLTypeFromJsType(0.30000000000000004, TYPES)).to.eql({ type: TYPES.Numeric, typeOptions: { precision: 30, scale: 17 } });
        expect(query.getSQLTypeFromJsType(2.5e-15, TYPES)).to.eql({ type: TYPES.Numeric, typeOptions: { precision: 30, scale: 16 } });
      });
    });

  });
}
