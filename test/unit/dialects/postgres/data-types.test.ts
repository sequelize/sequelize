import type { Rangable } from '@sequelize/core';
import { DataTypes } from '@sequelize/core';
import type { StringifyOptions } from '@sequelize/core/_non-semver-use-at-your-own-risk_/dialects/abstract/data-types.js';
import { expect } from 'chai';
import { sequelize } from '../../../support';

const dialect = sequelize.dialect;
const stringifyOptions: StringifyOptions = {
  dialect,
  timezone: '+02:00',
};

if (dialect.name.startsWith('postgres')) {
  describe('[POSTGRES Specific] DataTypes', () => {
    describe('RANGE', () => {
      const integerRangeType = DataTypes.RANGE(DataTypes.INTEGER).toDialectDataType(dialect);
      const bigintRangeType = DataTypes.RANGE(DataTypes.BIGINT).toDialectDataType(dialect);
      const decimalRangeType = DataTypes.RANGE(DataTypes.DECIMAL).toDialectDataType(dialect);
      const dateRangeType = DataTypes.RANGE(DataTypes.DATE).toDialectDataType(dialect);
      const dateOnlyRangeType = DataTypes.RANGE(DataTypes.DATEONLY).toDialectDataType(dialect);

      describe('escape', () => {
        it('should handle empty objects correctly', () => {
          expect(integerRangeType.escape([], stringifyOptions)).to.equal(`'empty'`);
        });

        it('should handle null as empty bound', () => {
          expect(integerRangeType.escape([null, 1], stringifyOptions)).to.equal(`'[,1)'`);
          expect(integerRangeType.escape([1, null], stringifyOptions)).to.equal(`'[1,)'`);
          expect(integerRangeType.escape([null, null], stringifyOptions)).to.equal(`'[,)'`);
        });

        it('should handle Infinity/-Infinity as infinity/-infinity bounds', () => {
          expect(integerRangeType.escape([Number.POSITIVE_INFINITY, 1], stringifyOptions)).to.equal(`'[infinity,1)'`);
          expect(integerRangeType.escape([1, Number.POSITIVE_INFINITY], stringifyOptions)).to.equal(`'[1,infinity)'`);
          expect(integerRangeType.escape([Number.NEGATIVE_INFINITY, 1], stringifyOptions)).to.equal(`'[-infinity,1)'`);
          expect(integerRangeType.escape([1, Number.NEGATIVE_INFINITY], stringifyOptions)).to.equal(`'[1,-infinity)'`);
          expect(integerRangeType.escape([Number.NEGATIVE_INFINITY, Number.POSITIVE_INFINITY], stringifyOptions)).to.equal(`'[-infinity,infinity)'`);
        });

        it('should throw error when array length is not 0 or 2', () => {
          expect(() => {
            // @ts-expect-error
            integerRangeType.escape([1], stringifyOptions);
          }).to.throw();
          expect(() => {
            // @ts-expect-error
            integerRangeType.escape([1, 2, 3], stringifyOptions);
          }).to.throw();
        });

        it('should throw error when non-array parameter is passed', () => {
          expect(() => {
            // @ts-expect-error
            integerRangeType.escape({}, stringifyOptions);
          }).to.throw();
          expect(() => {
            integerRangeType.escape('test', stringifyOptions);
          }).to.throw();
          expect(() => {
            // @ts-expect-error
            integerRangeType.escape(undefined, stringifyOptions);
          }).to.throw();
        });

        it('should handle array of objects with `inclusive` and `value` properties', () => {
          expect(integerRangeType.escape([{ inclusive: true, value: 0 }, { value: 1 }], stringifyOptions)).to.equal(`'[0,1)'`);
          expect(integerRangeType.escape([{ inclusive: true, value: 0 }, { inclusive: true, value: 1 }], stringifyOptions)).to.equal(`'[0,1]'`);
          expect(integerRangeType.escape([{ inclusive: false, value: 0 }, 1], stringifyOptions)).to.equal(`'(0,1)'`);
          expect(integerRangeType.escape([0, { inclusive: true, value: 1 }], stringifyOptions)).to.equal(`'[0,1]'`);
        });

        it('should handle date values', () => {

          expect(dateRangeType.escape([
            new Date(Date.UTC(2000, 1, 1)),
            new Date(Date.UTC(2000, 1, 2)),
          ], stringifyOptions)).to.equal(`'[2000-02-01 02:00:00.000 +02:00,2000-02-02 02:00:00.000 +02:00)'`);
        });
      });

      describe('stringify value', () => {
        it('should stringify integer values with appropriate casting', () => {
          expect(integerRangeType.escape(1, stringifyOptions)).to.equal(`'1'::int4`);
        });

        it('should stringify bigint values with appropriate casting', () => {
          expect(bigintRangeType.escape(1, stringifyOptions)).to.equal(`'1'::int8`);
          expect(bigintRangeType.escape(1n, stringifyOptions)).to.equal(`'1'::int8`);
          expect(bigintRangeType.escape('1', stringifyOptions)).to.equal(`'1'::int8`);
        });

        it('should stringify numeric values with appropriate casting', () => {
          expect(decimalRangeType.escape(1.1, stringifyOptions)).to.equal(`'1.1'::numeric`);
          expect(decimalRangeType.escape('1.1', stringifyOptions)).to.equal(`'1.1'::numeric`);
        });

        it('should stringify dateonly values with appropriate casting', () => {
          expect(dateOnlyRangeType.escape(new Date(Date.UTC(2000, 1, 1)), stringifyOptions)).to.include('::date');
        });

        it('should stringify date values with appropriate casting', () => {
          expect(dateRangeType.escape(new Date(Date.UTC(2000, 1, 1)), stringifyOptions)).to.equal(`'2000-02-01 02:00:00.000 +02:00'::timestamptz`);
        });

        describe('with null range bounds', () => {
          const infiniteRange: Rangable<any> = [null, null];
          const infiniteRangeSQL = `'[,)'`;

          it('should stringify integer range to infinite range', () => {
            expect(integerRangeType.escape(infiniteRange, stringifyOptions)).to.equal(infiniteRangeSQL);
          });

          it('should stringify bigint range to infinite range', () => {
            expect(bigintRangeType.escape(infiniteRange, stringifyOptions)).to.equal(infiniteRangeSQL);
          });

          it('should stringify numeric range to infinite range', () => {
            expect(decimalRangeType.escape(infiniteRange, stringifyOptions)).to.equal(infiniteRangeSQL);
          });

          it('should stringify dateonly ranges to infinite range', () => {
            expect(dateOnlyRangeType.escape(infiniteRange, stringifyOptions)).to.equal(infiniteRangeSQL);
          });

          it('should stringify date ranges to infinite range', () => {
            expect(dateRangeType.escape(infiniteRange, stringifyOptions)).to.equal(infiniteRangeSQL);
          });
        });

        describe('with infinite range bounds', () => {
          const infiniteRange: Rangable<any> = [Number.NEGATIVE_INFINITY, Number.POSITIVE_INFINITY];
          const infiniteRangeSQL = '\'[-infinity,infinity)\'';

          it('should stringify integer range to infinite range', () => {
            expect(integerRangeType.escape(infiniteRange, stringifyOptions)).to.equal(infiniteRangeSQL);
          });

          it('should stringify bigint range to infinite range', () => {
            expect(bigintRangeType.escape(infiniteRange, stringifyOptions)).to.equal(infiniteRangeSQL);
          });

          it('should stringify numeric range to infinite range', () => {
            expect(decimalRangeType.escape(infiniteRange, stringifyOptions)).to.equal(infiniteRangeSQL);
          });

          it('should stringify dateonly ranges to infinite range', () => {
            expect(dateOnlyRangeType.escape(infiniteRange, stringifyOptions)).to.equal(infiniteRangeSQL);
          });

          it('should stringify date ranges to infinite range', () => {
            expect(dateRangeType.escape(infiniteRange, stringifyOptions)).to.equal(infiniteRangeSQL);
          });
        });
      });
    });
  });
}
