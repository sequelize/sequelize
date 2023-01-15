import { expectTypeOf } from 'expect-type';
import { Model, Op } from '@sequelize/core';

class MyModel extends Model {}

expectTypeOf(MyModel.count()).toEqualTypeOf<Promise<number>>();
expectTypeOf(MyModel.count({ group: 'tag' })).toEqualTypeOf<Promise<Array<{ [key: string]: unknown, count: number }>>>();
expectTypeOf(MyModel.count({ col: 'tag', distinct: true })).toEqualTypeOf<Promise<number>>();
expectTypeOf(MyModel.count({
  where: {
    updatedAt: {
      [Op.gte]: new Date(),
    },
  },
  useMaster: false,
})).toEqualTypeOf<Promise<number>>();
