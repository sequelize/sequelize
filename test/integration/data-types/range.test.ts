import type { InferAttributes, Rangable } from '@sequelize/core';
import { DataTypes, Model } from '@sequelize/core';
import { beforeEach2, sequelize } from '../support';
import { testSimpleInOut } from './data-types.test';

// TODO: update these tests

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

  it('serialize/deserializes arrays', async () => {
    // https://github.com/sequelize/sequelize/issues/5747
    await testSimpleInOut(vars.User, 'intRange', [1, 2], [{ inclusive: true, value: 1 }, { inclusive: false, value: 2 }]);
    await testSimpleInOut(vars.User, 'bigintRange', [1n, 2n], [{ inclusive: true, value: '1' }, { inclusive: false, value: '2' }]);
    await testSimpleInOut(vars.User, 'decimalRange', [1.2, 1.3], [{ inclusive: true, value: '1.2' }, { inclusive: false, value: '1.3' }]);
    await testSimpleInOut(vars.User, 'datetimeRange', ['2022-01-01T00:00:00Z', new Date('2022-01-02T00:00:00Z')], [{ inclusive: true, value: new Date('2022-01-01T00:00:00Z') }, { inclusive: false, value: new Date('2022-01-02T00:00:00Z') }]);
    await testSimpleInOut(vars.User, 'dateOnlyRange', ['2022-01-01', '2022-01-02'], [{ inclusive: true, value: '2022-01-01' }, { inclusive: false, value: '2022-01-02' }]);
  });

  it('should allow date ranges to be generated with default bounds inclusion #8176', async function () {
    const Model = this.sequelize.define('M', {
      interval: {
        type: DataTypes.RANGE(DataTypes.DATE),
        allowNull: false,
        unique: true,
      },
    });
    const testDate1 = new Date();
    const testDate2 = new Date(testDate1.getTime() + 10_000);
    const testDateRange = [testDate1, testDate2];

    await Model.sync({ force: true });
    await Model.create({ interval: testDateRange });
    const m = await Model.findOne();
    expect(m).to.exist;
    expect(m.interval[0].value).to.be.eql(testDate1);
    expect(m.interval[1].value).to.be.eql(testDate2);
    expect(m.interval[0].inclusive).to.be.eql(true);
    expect(m.interval[1].inclusive).to.be.eql(false);
  });

  it('should allow date ranges to be generated using a single range expression to define bounds inclusion #8176', async function () {
    const Model = this.sequelize.define('M', {
      interval: {
        type: DataTypes.RANGE(DataTypes.DATE),
        allowNull: false,
        unique: true,
      },
    });
    const testDate1 = new Date();
    const testDate2 = new Date(testDate1.getTime() + 10_000);
    const testDateRange = [{ value: testDate1, inclusive: false }, { value: testDate2, inclusive: true }];

    await Model.sync({ force: true });
    await Model.create({ interval: testDateRange });
    const m = await Model.findOne();
    expect(m).to.exist;
    expect(m.interval[0].value).to.be.eql(testDate1);
    expect(m.interval[1].value).to.be.eql(testDate2);
    expect(m.interval[0].inclusive).to.be.eql(false);
    expect(m.interval[1].inclusive).to.be.eql(true);
  });

  it('should allow date ranges to be generated using a composite range expression #8176', async function () {
    const Model = this.sequelize.define('M', {
      interval: {
        type: DataTypes.RANGE(DataTypes.DATE),
        allowNull: false,
        unique: true,
      },
    });
    const testDate1 = new Date();
    const testDate2 = new Date(testDate1.getTime() + 10_000);
    const testDateRange = [testDate1, { value: testDate2, inclusive: true }];

    await Model.sync({ force: true });
    await Model.create({ interval: testDateRange });
    const m = await Model.findOne();
    expect(m).to.exist;
    expect(m.interval[0].value).to.be.eql(testDate1);
    expect(m.interval[1].value).to.be.eql(testDate2);
    expect(m.interval[0].inclusive).to.be.eql(true);
    expect(m.interval[1].inclusive).to.be.eql(true);
  });

  it('should correctly return ranges when using predicates that define bounds inclusion #8176', async function () {
    const Model = this.sequelize.define('M', {
      interval: {
        type: DataTypes.RANGE(DataTypes.DATE),
        allowNull: false,
        unique: true,
      },
    });
    const testDate1 = new Date();
    const testDate2 = new Date(testDate1.getTime() + 10_000);
    const testDateRange = [testDate1, testDate2];
    const dateRangePredicate = [{ value: testDate1, inclusive: true }, { value: testDate1, inclusive: true }];

    await Model.sync({ force: true });
    await Model.create({ interval: testDateRange });

    const m = await Model.findOne({
      where: {
        interval: { [Op.overlap]: dateRangePredicate },
      },
    });

    expect(m).to.exist;
  });
});
