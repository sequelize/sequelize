import {
  Model,
  InferAttributes,
  CreationOptional,
  InferCreationAttributes,
} from '@sequelize/core';
import { sequelize } from './connection';
import type { MakeNullishOptional } from '@sequelize/core/types/utils';

class TestModel extends Model<
  InferAttributes<TestModel>,
  InferCreationAttributes<TestModel>
> {
  declare id: CreationOptional<number>;
  declare testString: CreationOptional<string | null>;
  declare testEnum: CreationOptional<'d' | 'e' | 'f' | null>;
}

type wat = InferCreationAttributes<TestModel>;

sequelize.transaction(async trx => {
  type B = InferCreationAttributes<TestModel>;

  type C = MakeNullishOptional<B>;
  const badItems: Array<
    MakeNullishOptional<InferCreationAttributes<TestModel>>
  > = [
    {
      // @ts-expect-error this isn't an enum value
      testEnum: 'eafe',
    },
    {
      // @ts-expect-error testString should be a string or null
      testString: 324,
    },
  ];

  const newItems: Array<
    MakeNullishOptional<InferCreationAttributes<TestModel>>
  > = [
    {
      testEnum: 'e',
      testString: 'abc',
    },
    {
      testEnum: null,
      testString: undefined,
    },
  ];

  const res1: Array<TestModel> = await TestModel.bulkCreate(newItems, {
    benchmark: true,
    fields: ['testEnum'],
    hooks: true,
    logging: true,
    returning: true,
    transaction: trx,
    validate: true,
    ignoreDuplicates: true,
  });

  const res2: Array<TestModel> = await TestModel.bulkCreate(newItems, {
    benchmark: true,
    fields: ['testEnum'],
    hooks: true,
    logging: true,
    returning: false,
    transaction: trx,
    validate: true,
    updateOnDuplicate: ['testEnum', 'testString'],
  });

  const res3: Array<TestModel> = await TestModel.bulkCreate(newItems, {
    conflictFields: ['testEnum', 'testString'],
  });
});
