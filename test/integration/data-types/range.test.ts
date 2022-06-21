import type { InferAttributes, Rangable } from '@sequelize/core';
import { DataTypes, Model, Op } from '@sequelize/core';
import { expect } from 'chai';
import { beforeEach2, sequelize } from '../support';
import { testSimpleInOut } from './data-types.test';

describe('DataTypes.RANGE', () => {
  const vars = beforeEach2(async () => {
    class User extends Model<InferAttributes<User>> {
      declare intRange: Rangable<number> | null;
      declare bigintRange: Rangable<bigint | string> | null;
      declare decimalRange: Rangable<string> | null;
      declare datetimeRange: Rangable<Date | string> | null;
      declare dateOnlyRange: Rangable<string> | null;
    }

    User.init({
      intRange: DataTypes.RANGE(DataTypes.INTEGER),
      bigintRange: DataTypes.RANGE(DataTypes.BIGINT),
      decimalRange: DataTypes.RANGE(DataTypes.DECIMAL),
      datetimeRange: DataTypes.RANGE(DataTypes.DATE),
      dateOnlyRange: DataTypes.RANGE(DataTypes.DATEONLY),
    }, { sequelize });

    await User.sync();

    return { User };
  });

  it('serialize/deserializes empty ranges', async () => {
    await testSimpleInOut(vars.User, 'intRange', [], []);
  });

  it('serialize/deserializes unbound ranges', async () => {
    await testSimpleInOut(vars.User, 'intRange', [null, 1], [{ inclusive: false, value: null }, { inclusive: false, value: 1 }]);
    await testSimpleInOut(vars.User, 'intRange', [1, null], [{ inclusive: true, value: 1 }, { inclusive: false, value: null }]);
    await testSimpleInOut(vars.User, 'intRange', [null, null], [{ inclusive: false, value: null }, { inclusive: false, value: null }]);
  });

  it('serialize/deserializes infinite values in ranges', async () => {
    // note: this is not the same as an unbound range. This is the 'infinite' value of the datetime DataType.
    await testSimpleInOut(vars.User, 'datetimeRange', [Number.NEGATIVE_INFINITY, '2022-06-01T00:00:00Z'], [{ inclusive: true, value: Number.NEGATIVE_INFINITY }, { inclusive: false, value: new Date('2022-06-01T00:00:00Z') }]);
    await testSimpleInOut(vars.User, 'datetimeRange', ['2022-06-01T00:00:00Z', Number.POSITIVE_INFINITY], [{ inclusive: true, value: new Date('2022-06-01T00:00:00Z') }, { inclusive: false, value: Number.POSITIVE_INFINITY }]);
    await testSimpleInOut(vars.User, 'datetimeRange', [Number.NEGATIVE_INFINITY, Number.POSITIVE_INFINITY], [{ inclusive: true, value: Number.NEGATIVE_INFINITY }, { inclusive: false, value: Number.POSITIVE_INFINITY }]);
  });

  it('serialize/deserializes simple range tuples', async () => {
    // https://github.com/sequelize/sequelize/issues/5747
    await testSimpleInOut(vars.User, 'intRange', [1, 2], [{ inclusive: true, value: 1 }, { inclusive: false, value: 2 }]);
    await testSimpleInOut(vars.User, 'bigintRange', [1n, 2n], [{ inclusive: true, value: '1' }, { inclusive: false, value: '2' }]);
    await testSimpleInOut(vars.User, 'decimalRange', [1.2, 1.3], [{ inclusive: true, value: '1.2' }, { inclusive: false, value: '1.3' }]);
    // https://github.com/sequelize/sequelize/issues/8176
    await testSimpleInOut(
      vars.User,
      'datetimeRange',
      ['2022-01-01T00:00:00Z', new Date('2022-01-02T00:00:00Z')],
      [{ inclusive: true, value: new Date('2022-01-01T00:00:00Z') }, { inclusive: false, value: new Date('2022-01-02T00:00:00Z') }],
    );

    const testDate1 = new Date();
    const testDate2 = new Date(testDate1.getTime() + 10_000);
    await testSimpleInOut(
      vars.User,
      'datetimeRange',
      [{ value: testDate1, inclusive: false }, { value: testDate2, inclusive: true }],
      [{ value: testDate1, inclusive: false }, { value: testDate2, inclusive: true }],
    );

    await testSimpleInOut(
      vars.User,
      'datetimeRange',
      [testDate1, { value: testDate2, inclusive: true }],
      [{ value: testDate1, inclusive: true }, { value: testDate2, inclusive: true }],
    );

    await testSimpleInOut(vars.User, 'dateOnlyRange', ['2022-01-01', '2022-01-02'], [{ inclusive: true, value: '2022-01-01' }, { inclusive: false, value: '2022-01-02' }]);
  });

  it('should correctly return ranges when using predicates that define bounds inclusion #8176', async () => {
    const testDate1 = new Date();
    const testDate2 = new Date(testDate1.getTime() + 10_000);

    await vars.User.create({ datetimeRange: [testDate1, testDate2] });

    const user = await vars.User.findOne({
      where: {
        datetimeRange: {
          [Op.overlap]: [
            { value: testDate1, inclusive: true },
            { value: testDate1, inclusive: true },
          ],
        },
      },
    });

    expect(user).to.exist;
  });
});
