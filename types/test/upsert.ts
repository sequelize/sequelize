import { DataTypes, Model, Optional } from 'sequelize';
import { sequelize } from './connection';

interface ITestModel {
  testId: number;
  testString: string | null;
  testEnum: 'd' | 'e' | 'f' | null;
}

class TestModel extends Model<
  ITestModel,
  Optional<ITestModel, 'testString' | 'testEnum'>
> {}

TestModel.init(
  {
    testId: { type: DataTypes.NUMBER },
    testString: { type: DataTypes.STRING },
    testEnum: { type: DataTypes.STRING },
  },
  { sequelize }
);

sequelize.transaction(async (trx) => {
  const res1: [TestModel, boolean | null] = await TestModel.upsert(
    {},
    {
      benchmark: true,
      fields: ['testEnum'],
      hooks: true,
      logging: true,
      returning: true,
      searchPath: 'DEFAULT',
      transaction: trx,
      validate: true,
    }
  );

  const res2: [TestModel, boolean | null] = await TestModel.upsert(
    {},
    {
      benchmark: true,
      fields: ['testId'],
      hooks: true,
      logging: true,
      returning: false,
      searchPath: 'DEFAULT',
      transaction: trx,
      validate: true,
    }
  );

  const res3: [TestModel, boolean | null] = await TestModel.upsert(
    {},
    {
      benchmark: true,
      fields: ['testString'],
      hooks: true,
      logging: true,
      searchPath: 'DEFAULT',
      transaction: trx,
      validate: true,
    }
  );

  const res4: [TestModel, boolean | null] = await TestModel.upsert(
    {},
    {
      conflictWhere: {
        testEnum: null,
      },
      conflictFields: ['testId'],
    }
  );
});
