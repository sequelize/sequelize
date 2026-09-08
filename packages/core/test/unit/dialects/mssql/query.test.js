'use strict';

const { MsSqlQuery: Query } = require('@sequelize/mssql');
const Support = require('../../../support');

const dialect = Support.getTestDialect();
const sequelize = Support.sequelize;
const expect = require('chai').expect;
const tedious = require('tedious');

const connectionStub = { lib: tedious };

let query;

if (dialect === 'mssql') {
  describe('[MSSQL Specific] Query', () => {
    beforeEach(() => {
      const options = {
        transaction: { name: 'transactionName' },
        isolationLevel: 'REPEATABLE_READ',
        logging: false,
      };
      query = new Query(connectionStub, sequelize, options);
    });

    describe('getSQLTypeFromJsType', () => {
      const TYPES = tedious.TYPES;
      it('should return correct parameter type', () => {
        expect(query.getSQLTypeFromJsType(2_147_483_647, TYPES)).to.eql({
          type: TYPES.Int,
          typeOptions: {},
          value: 2_147_483_647,
        });
        expect(query.getSQLTypeFromJsType(-2_147_483_648, TYPES)).to.eql({
          type: TYPES.Int,
          typeOptions: {},
          value: -2_147_483_648,
        });

        expect(query.getSQLTypeFromJsType(2_147_483_648, TYPES)).to.eql({
          type: TYPES.BigInt,
          typeOptions: {},
          value: 2_147_483_648,
        });
        expect(query.getSQLTypeFromJsType(-2_147_483_649, TYPES)).to.eql({
          type: TYPES.BigInt,
          typeOptions: {},
          value: -2_147_483_649,
        });

        expect(query.getSQLTypeFromJsType(2_147_483_647n, TYPES)).to.eql({
          type: TYPES.Int,
          typeOptions: {},
          value: 2_147_483_647,
        });
        expect(query.getSQLTypeFromJsType(-2_147_483_648n, TYPES)).to.eql({
          type: TYPES.Int,
          typeOptions: {},
          value: -2_147_483_648,
        });

        expect(query.getSQLTypeFromJsType(BigInt(Number.MAX_SAFE_INTEGER), TYPES)).to.eql({
          type: TYPES.BigInt,
          typeOptions: {},
          value: Number.MAX_SAFE_INTEGER,
        });
        expect(query.getSQLTypeFromJsType(BigInt(Number.MIN_SAFE_INTEGER), TYPES)).to.eql({
          type: TYPES.BigInt,
          typeOptions: {},
          value: Number.MIN_SAFE_INTEGER,
        });

        const overMaxSafe = BigInt(Number.MAX_SAFE_INTEGER) + 1n;
        expect(query.getSQLTypeFromJsType(overMaxSafe, TYPES)).to.eql({
          type: TYPES.VarChar,
          typeOptions: {},
          value: overMaxSafe.toString(),
        });
        const underMinSafe = BigInt(Number.MIN_SAFE_INTEGER) - 1n;
        expect(query.getSQLTypeFromJsType(underMinSafe, TYPES)).to.eql({
          type: TYPES.VarChar,
          typeOptions: {},
          value: underMinSafe.toString(),
        });

        const buffer = Buffer.from('abc');
        expect(query.getSQLTypeFromJsType(buffer, TYPES)).to.eql({
          type: TYPES.VarBinary,
          typeOptions: {},
          value: buffer,
        });
      });

      it('should return parameter type correct scale for float', () => {
        expect(query.getSQLTypeFromJsType(1.23, TYPES)).to.eql({
          type: TYPES.Numeric,
          typeOptions: { precision: 30, scale: 2 },
          value: 1.23,
        });
        expect(query.getSQLTypeFromJsType(0.300_000_000_000_000_04, TYPES)).to.eql({
          type: TYPES.Numeric,
          typeOptions: { precision: 30, scale: 16 },
          value: 0.300_000_000_000_000_04,
        });
        expect(query.getSQLTypeFromJsType(2.5e-15, TYPES)).to.eql({
          type: TYPES.Numeric,
          typeOptions: { precision: 30, scale: 16 },
          value: 2.5e-15,
        });
      });

      it('should not compute an inflated scale for values with floating-point noise (#16463)', () => {
        expect(query.getSQLTypeFromJsType(31.958_508_000_000_002, TYPES)).to.eql({
          type: TYPES.Numeric,
          typeOptions: { precision: 30, scale: 14 },
          value: 31.958_508_000_000_002,
        });

        // 20.95 - 20 === 0.9499999999999993
        const value = 20.95 - 20;
        expect(query.getSQLTypeFromJsType(value, TYPES)).to.eql({
          type: TYPES.Numeric,
          typeOptions: { precision: 30, scale: 15 },
          value,
        });
      });

      it('computes the scale of the exponential-notation branch correctly', () => {
        expect(query.getSQLTypeFromJsType(1e-7, TYPES)).to.eql({
          type: TYPES.Numeric,
          typeOptions: { precision: 30, scale: 7 },
          value: 1e-7,
        });

        expect(query.getSQLTypeFromJsType(1.23e-7, TYPES)).to.eql({
          type: TYPES.Numeric,
          typeOptions: { precision: 30, scale: 9 },
          value: 1.23e-7,
        });
      });

      it('should never exceed the precision, nor a scale the value cannot be encoded with', () => {
        // Would be 31 and 324 respectively without the clamp, which SQL Server rejects.
        expect(query.getSQLTypeFromJsType(Number.EPSILON, TYPES)).to.eql({
          type: TYPES.Numeric,
          typeOptions: { precision: 30, scale: 30 },
          value: Number.EPSILON,
        });

        expect(query.getSQLTypeFromJsType(5e-324, TYPES)).to.eql({
          type: TYPES.Numeric,
          typeOptions: { precision: 30, scale: 30 },
          value: 5e-324,
        });

        // 0.1 + 0.2 === 0.30000000000000004, whose 17 digits would scale past
        // Number.MAX_SAFE_INTEGER, past which tedious can no longer encode the value exactly.
        const value = 0.1 + 0.2;
        const { scale } = query.getSQLTypeFromJsType(value, TYPES).typeOptions;
        expect(scale).to.equal(16);
        expect(Math.round(value * 10 ** scale)).to.be.at.most(Number.MAX_SAFE_INTEGER);
      });
    });
  });
}
