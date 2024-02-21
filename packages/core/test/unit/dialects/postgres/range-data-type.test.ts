import type { Rangable } from '@sequelize/core';
import { DataTypes } from '@sequelize/core';
import { expect } from 'chai';
import { createSequelizeInstance, sequelize } from '../../../support';

const dialectName = sequelize.dialect.name;

describe('[POSTGRES Specific] RANGE DataType', () => {
  if (!dialectName.startsWith('postgres')) {
    return;
  }

  const sequelizeWithTzOffset = createSequelizeInstance({
    timezone: '+02:00',
  });

  const dialect = sequelizeWithTzOffset.dialect;

  const integerRangeType = DataTypes.RANGE(DataTypes.INTEGER).toDialectDataType(dialect);
  const bigintRangeType = DataTypes.RANGE(DataTypes.BIGINT).toDialectDataType(dialect);
  const decimalRangeType = DataTypes.RANGE(DataTypes.DECIMAL).toDialectDataType(dialect);
  const dateRangeType = DataTypes.RANGE(DataTypes.DATE).toDialectDataType(dialect);
  const dateOnlyRangeType = DataTypes.RANGE(DataTypes.DATEONLY).toDialectDataType(dialect);

  describe('escape', () => {
    it('should handle empty objects correctly', () => {
      expect(integerRangeType.escape([])).to.equal(`'empty'::int4range`);
    });

    it('should handle null as empty bound', () => {
      expect(integerRangeType.escape([null, 1])).to.equal(`'[,1)'::int4range`);
      expect(integerRangeType.escape([1, null])).to.equal(`'[1,)'::int4range`);
      expect(integerRangeType.escape([null, null])).to.equal(`'[,)'::int4range`);
    });

    it('should handle Infinity/-Infinity as infinity/-infinity bounds', () => {
      expect(integerRangeType.escape([Number.POSITIVE_INFINITY, 1])).to.equal(
        `'[infinity,1)'::int4range`,
      );
      expect(integerRangeType.escape([1, Number.POSITIVE_INFINITY])).to.equal(
        `'[1,infinity)'::int4range`,
      );
      expect(integerRangeType.escape([Number.NEGATIVE_INFINITY, 1])).to.equal(
        `'[-infinity,1)'::int4range`,
      );
      expect(integerRangeType.escape([1, Number.NEGATIVE_INFINITY])).to.equal(
        `'[1,-infinity)'::int4range`,
      );
      expect(
        integerRangeType.escape([Number.NEGATIVE_INFINITY, Number.POSITIVE_INFINITY]),
      ).to.equal(`'[-infinity,infinity)'::int4range`);
    });

    it('should throw error when array length is not 0 or 2', () => {
      expect(() => {
        // @ts-expect-error -- testing that invalid input throws
        integerRangeType.escape([1]);
      }).to.throw();
      expect(() => {
        // @ts-expect-error -- testing that invalid input throws
        integerRangeType.escape([1, 2, 3]);
      }).to.throw();
    });

    it('should throw error when non-array parameter is passed', () => {
      expect(() => {
        // @ts-expect-error -- testing that invalid input throws
        integerRangeType.escape({});
      }).to.throw();
      expect(() => {
        integerRangeType.escape('test');
      }).to.throw();
      expect(() => {
        // @ts-expect-error -- testing that invalid input throws
        integerRangeType.escape();
      }).to.throw();
    });

    it('should handle array of objects with `inclusive` and `value` properties', () => {
      expect(integerRangeType.escape([{ inclusive: true, value: 0 }, { value: 1 }])).to.equal(
        `'[0,1)'::int4range`,
      );
      expect(
        integerRangeType.escape([
          { inclusive: true, value: 0 },
          { inclusive: true, value: 1 },
        ]),
      ).to.equal(`'[0,1]'::int4range`);
      expect(integerRangeType.escape([{ inclusive: false, value: 0 }, 1])).to.equal(
        `'(0,1)'::int4range`,
      );
      expect(integerRangeType.escape([0, { inclusive: true, value: 1 }])).to.equal(
        `'[0,1]'::int4range`,
      );
    });

    it('should handle date values', () => {
      expect(
        dateRangeType.escape([new Date(Date.UTC(2000, 1, 1)), new Date(Date.UTC(2000, 1, 2))]),
      ).to.equal(`'[2000-02-01 02:00:00.000 +02:00,2000-02-02 02:00:00.000 +02:00)'::tstzrange`);
    });
  });

  describe('stringify value', () => {
    describe('with null range bounds', () => {
      const infiniteRange: Rangable<any> = [null, null];
      const infiniteRangeSQL = `'[,)'`;

      it('should stringify integer range to infinite range', () => {
        expect(integerRangeType.escape(infiniteRange)).to.equal(`${infiniteRangeSQL}::int4range`);
      });

      it('should stringify bigint range to infinite range', () => {
        expect(bigintRangeType.escape(infiniteRange)).to.equal(`${infiniteRangeSQL}::int8range`);
      });

      it('should stringify numeric range to infinite range', () => {
        expect(decimalRangeType.escape(infiniteRange)).to.equal(`${infiniteRangeSQL}::numrange`);
      });

      it('should stringify dateonly ranges to infinite range', () => {
        expect(dateOnlyRangeType.escape(infiniteRange)).to.equal(`${infiniteRangeSQL}::daterange`);
      });

      it('should stringify date ranges to infinite range', () => {
        expect(dateRangeType.escape(infiniteRange)).to.equal(`${infiniteRangeSQL}::tstzrange`);
      });
    });

    describe('with infinite range bounds', () => {
      const infiniteRange: Rangable<any> = [Number.NEGATIVE_INFINITY, Number.POSITIVE_INFINITY];
      const infiniteRangeSQL = "'[-infinity,infinity)'";

      it('should stringify integer range to infinite range', () => {
        expect(integerRangeType.escape(infiniteRange)).to.equal(`${infiniteRangeSQL}::int4range`);
      });

      it('should stringify bigint range to infinite range', () => {
        expect(bigintRangeType.escape(infiniteRange)).to.equal(`${infiniteRangeSQL}::int8range`);
      });

      it('should stringify numeric range to infinite range', () => {
        expect(decimalRangeType.escape(infiniteRange)).to.equal(`${infiniteRangeSQL}::numrange`);
      });

      it('should stringify dateonly ranges to infinite range', () => {
        expect(dateOnlyRangeType.escape(infiniteRange)).to.equal(`${infiniteRangeSQL}::daterange`);
      });

      it('should stringify date ranges to infinite range', () => {
        expect(dateRangeType.escape(infiniteRange)).to.equal(`${infiniteRangeSQL}::tstzrange`);
      });
    });
  });
});
