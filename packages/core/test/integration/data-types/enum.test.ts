import type { InferAttributes } from '@sequelize/core';
import { DataTypes, Model } from '@sequelize/core';
import { expect } from 'chai';
import { beforeEach2, sequelize, setResetMode } from '../support';
import { testSimpleInOut, testSimpleInOutRaw } from './data-types.test';

enum TestEnum {
  A = 'A',
  B = 'B',
  C = 'C',
}

describe('DataTypes.ENUM', () => {
  setResetMode('none');

  const vars = beforeEach2(async () => {
    class User extends Model<InferAttributes<User>> {
      declare attr: TestEnum;
    }

    User.init(
      {
        attr: {
          type: DataTypes.ENUM(Object.values(TestEnum)),
          allowNull: false,
        },
      },
      { sequelize },
    );

    await User.sync();

    return { User };
  });

  it('accepts values that are part of the enum', async () => {
    await testSimpleInOut(vars.User, 'attr', TestEnum.A, TestEnum.A);
  });

  it('accepts spaces in ENUM', async () => {
    interface ITestModel extends Model<InferAttributes<ITestModel>> {
      type: 'canon' | 'class s';
    }

    const TestModel = sequelize.define<ITestModel>('TestModel', {
      type: DataTypes.ENUM(['canon', 'class s']),
    });

    await TestModel.sync({ force: true });
    const record = await TestModel.create({ type: 'class s' });
    expect(record.type).to.be.eql('class s');
  });

  it('rejects values not part of the enum', async () => {
    // @ts-expect-error -- 'fail' is not a valid value for this enum.
    await expect(vars.User.create({ attr: 'fail' })).to.be.rejected;
  });

  it(`is deserialized as a string when DataType is not specified`, async () => {
    await testSimpleInOutRaw(vars.User, 'attr', TestEnum.A, TestEnum.A);
  });
});
