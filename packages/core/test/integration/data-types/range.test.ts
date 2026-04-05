import type {
  CreationOptional,
  InferAttributes,
  InferCreationAttributes,
  Rangable,
} from '@sequelize/core';
import { DataTypes, Model, Op } from '@sequelize/core';
import { expect } from 'chai';
import { beforeEach2, sequelize, setResetMode } from '../support';
import { testSimpleInOut } from './data-types.test';

const dialect = sequelize.dialect;

describe('DataTypes.RANGE', () => {
  if (!dialect.supports.dataTypes.RANGE) {
    return;
  }

  setResetMode('none');

  const vars = beforeEach2(async () => {
    class User extends Model<InferAttributes<User>, InferCreationAttributes<User>> {
      declare id: CreationOptional<number>;
      declare intRange: Rangable<number> | null;
      declare bigintRange: Rangable<bigint | string> | null;
      declare decimalRange: Rangable<string> | null;
      // TODO: plainDateRange -- https://github.com/sequelize/sequelize/issues/14295
      declare zonedDatetimeRange: Rangable<Date | string> | null;
      declare dateOnlyRange: Rangable<string> | null;
    }

    User.init(
      {
        id: {
          type: DataTypes.INTEGER,
          primaryKey: true,
          autoIncrement: true,
        },
        intRange: DataTypes.RANGE(DataTypes.INTEGER),
        bigintRange: DataTypes.RANGE(DataTypes.BIGINT),
        decimalRange: DataTypes.RANGE(DataTypes.DECIMAL),
        zonedDatetimeRange: DataTypes.RANGE(DataTypes.DATE),
        dateOnlyRange: DataTypes.RANGE(DataTypes.DATEONLY),
      },
      { sequelize },
    );

    await User.sync();

    return { User };
  });

  const boundsPerType = {
    intRange: { bounds: [1, 10], supportsInfinity: false },
    bigintRange: { bounds: ['1', '10'], supportsInfinity: false },
    decimalRange: { bounds: ['1', '10'], supportsInfinity: false },
    zonedDatetimeRange: {
      bounds: [new Date('2001-01-01T00:00:00Z'), new Date('2010-01-01T00:00:00Z')],
      supportsInfinity: true,
    },
    dateOnlyRange: { bounds: ['2001-01-01', '2010-01-01'], supportsInfinity: true },
  };

  for (const [rangeType, { bounds, supportsInfinity }] of Object.entries(boundsPerType) as any) {
    const [lower, higher] = bounds;

    it(`should handle empty bounds correctly for ${rangeType}`, async () => {
      await testSimpleInOut(vars.User, rangeType, [], [], `unbound range ${rangeType} mismatch`);

      const inclusiveLowUnboundHigh = [
        { value: lower, inclusive: true },
        { value: null, inclusive: false },
      ];
      await testSimpleInOut(
        vars.User,
        rangeType,
        inclusiveLowUnboundHigh,
        inclusiveLowUnboundHigh,
        `inclusive low & unbound high ${rangeType} mismatch`,
      );
      await testSimpleInOut(
        vars.User,
        rangeType,
        [lower, null],
        [
          { inclusive: true, value: lower },
          { inclusive: false, value: null },
        ],
      );

      const unboundLowInclusiveHigh = [
        { value: null, inclusive: false },
        { value: higher, inclusive: false },
      ];
      await testSimpleInOut(
        vars.User,
        rangeType,
        unboundLowInclusiveHigh,
        unboundLowInclusiveHigh,
        `unbound low & exclusive high ${rangeType} mismatch`,
      );
      await testSimpleInOut(
        vars.User,
        rangeType,
        [null, higher],
        [
          { inclusive: false, value: null },
          { inclusive: false, value: higher },
        ],
      );

      const unbound = [
        { value: null, inclusive: false },
        { value: null, inclusive: false },
      ];
      await testSimpleInOut(
        vars.User,
        rangeType,
        unbound,
        unbound,
        `unbound ${rangeType} mismatch`,
      );
      await testSimpleInOut(
        vars.User,
        rangeType,
        [null, null],
        [
          { inclusive: false, value: null },
          { inclusive: false, value: null },
        ],
      );
    });

    if (supportsInfinity) {
      /**
       * "infinity" is not a value that comes from the range (that would be unbound range, see above test).
       * Instead, it is a valid value of the subtype of the range (for those that support it)
       */
      it(`should handle infinity/-infinity bounds correctly for ${rangeType}`, async () => {
        const infiniteLow = [
          { value: Number.NEGATIVE_INFINITY, inclusive: false },
          { value: higher, inclusive: false },
        ];
        await testSimpleInOut(
          vars.User,
          rangeType,
          infiniteLow,
          infiniteLow,
          `infinite low & exclusive high ${rangeType} mismatch`,
        );

        const infiniteHigh = [
          { value: lower, inclusive: true },
          { value: Number.POSITIVE_INFINITY, inclusive: false },
        ];
        await testSimpleInOut(
          vars.User,
          rangeType,
          infiniteHigh,
          infiniteHigh,
          `inclusive low & infinite high ${rangeType} mismatch`,
        );

        const infiniteBoth = [
          { value: Number.NEGATIVE_INFINITY, inclusive: false },
          { value: Number.POSITIVE_INFINITY, inclusive: false },
        ];
        await testSimpleInOut(
          vars.User,
          rangeType,
          infiniteBoth,
          infiniteBoth,
          `infinite low & infinite high ${rangeType} mismatch`,
        );
      });
    }
  }

  it('serialize/deserializes simple range tuples', async () => {
    // https://github.com/sequelize/sequelize/issues/5747
    await testSimpleInOut(
      vars.User,
      'intRange',
      [1, 2],
      [
        { inclusive: true, value: 1 },
        { inclusive: false, value: 2 },
      ],
    );
    await testSimpleInOut(
      vars.User,
      'bigintRange',
      [1n, '2'],
      [
        { inclusive: true, value: '1' },
        { inclusive: false, value: '2' },
      ],
    );
    await testSimpleInOut(
      vars.User,
      'decimalRange',
      [1.2, 1.3],
      [
        { inclusive: true, value: '1.2' },
        { inclusive: false, value: '1.3' },
      ],
    );
    // https://github.com/sequelize/sequelize/issues/8176
    await testSimpleInOut(
      vars.User,
      'zonedDatetimeRange',
      ['2022-01-01T00:00:00Z', new Date('2022-01-02T00:00:00Z')],
      [
        { inclusive: true, value: new Date('2022-01-01T00:00:00Z') },
        { inclusive: false, value: new Date('2022-01-02T00:00:00Z') },
      ],
    );

    const testDate1 = new Date();
    const testDate2 = new Date(testDate1.getTime() + 10_000);
    await testSimpleInOut(
      vars.User,
      'zonedDatetimeRange',
      [
        { value: testDate1, inclusive: false },
        { value: testDate2, inclusive: true },
      ],
      [
        { value: testDate1, inclusive: false },
        { value: testDate2, inclusive: true },
      ],
    );

    await testSimpleInOut(
      vars.User,
      'zonedDatetimeRange',
      [testDate1, { value: testDate2, inclusive: true }],
      [
        { value: testDate1, inclusive: true },
        { value: testDate2, inclusive: true },
      ],
    );

    await testSimpleInOut(
      vars.User,
      'dateOnlyRange',
      ['2022-01-01', '2022-01-02'],
      [
        { inclusive: true, value: '2022-01-01' },
        { inclusive: false, value: '2022-01-02' },
      ],
    );
  });

  it('should correctly return ranges when using predicates that define bounds inclusion #8176', async () => {
    const testDate1 = new Date();
    const testDate2 = new Date(testDate1.getTime() + 10_000);

    await vars.User.create({ zonedDatetimeRange: [testDate1, testDate2] });

    const user = await vars.User.findOne({
      where: {
        zonedDatetimeRange: {
          [Op.overlap]: [
            { value: testDate1, inclusive: true },
            { value: testDate1, inclusive: true },
          ],
        },
      },
    });

    expect(user).to.exist;
  });

  it('does not fail when used in Model.findOrCreate', async () => {
    // node-postgres has a weird bug where, when using findOrCreate (which is a temporary SQL function in postgres),
    // node-postgres' type-based parser will not be called. As a result, the range is improperly parsed in raw queries.
    // This test ensures the range is properly parsed by the Sequelize DataType (as a workaround).
    // TODO: add this test to the other Data Types
    await vars.User.findOrCreate({
      where: { id: 13_456 },
      defaults: { decimalRange: [0.65, 1] },
    });
  });
});

describe('DataTypes.ARRAY(DataTypes.RANGE)', () => {
  if (!dialect.supports.dataTypes.ARRAY) {
    return;
  }

  setResetMode('none');

  const vars = beforeEach2(async () => {
    class User extends Model<InferAttributes<User>> {
      declare intRangeArray: Array<Rangable<number>> | null;
      declare zonedDatetimeRangeArray: Array<Rangable<Date | string>> | null;
    }

    User.init(
      {
        intRangeArray: DataTypes.ARRAY(DataTypes.RANGE(DataTypes.INTEGER)),
        zonedDatetimeRangeArray: DataTypes.ARRAY(DataTypes.RANGE(DataTypes.DATE)),
      },
      { sequelize },
    );

    await User.sync();

    return { User };
  });

  it('serialize/deserializes range arrays', async () => {
    await testSimpleInOut(
      vars.User,
      'intRangeArray',
      [
        [1, 2],
        [3, 4],
      ],
      [
        [
          { inclusive: true, value: 1 },
          { inclusive: false, value: 2 },
        ],
        [
          { inclusive: true, value: 3 },
          { inclusive: false, value: 4 },
        ],
      ],
    );

    await testSimpleInOut(
      vars.User,
      'zonedDatetimeRangeArray',
      [['2022-01-01T00:00:00Z', new Date('2022-01-02T00:00:00Z')]],
      [
        [
          { inclusive: true, value: new Date('2022-01-01T00:00:00Z') },
          { inclusive: false, value: new Date('2022-01-02T00:00:00Z') },
        ],
      ],
    );
  });
});
