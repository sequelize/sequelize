import type { CreationAttributes } from '@sequelize/core';
import { Model } from '@sequelize/core';
import { sequelize } from './connection';

class TestModel extends Model {
  declare id: number;
  declare testString: string | null;
  declare testEnum: 'd' | 'e' | 'f' | null;
}

sequelize.transaction(async trx => {
  const newItems: Array<CreationAttributes<TestModel>> = [
    {
      testEnum: 'e',
      testString: 'abc',
    },
    {
      testEnum: null,
      testString: undefined,
    },
  ];

  const res1: TestModel[] = await TestModel.bulkCreate(newItems, {
    benchmark: true,
    fields: ['testEnum'],
    hooks: true,
    logging: console.debug,
    returning: true,
    transaction: trx,
    validate: true,
    ignoreDuplicates: true,
  });

  const res2: TestModel[] = await TestModel.bulkCreate(newItems, {
    benchmark: true,
    fields: ['testEnum'],
    hooks: true,
    logging: console.debug,
    returning: false,
    transaction: trx,
    validate: true,
    updateOnDuplicate: ['testEnum', 'testString'],
  });

  const res3: TestModel[] = await TestModel.bulkCreate(newItems, {
    conflictAttributes: ['testEnum', 'testString'],
  });
});
