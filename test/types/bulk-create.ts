import {
  Model,
  InferAttributes,
  CreationOptional,
  InferCreationAttributes,
} from 'sequelize';
import { sequelize } from './connection';
import type { MakeNullishOptional } from 'sequelize/types/utils';

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
    conflictAttributes: ['testEnum', 'testString'],
  });
});
