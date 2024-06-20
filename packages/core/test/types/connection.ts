import type { SyncOptions } from '@sequelize/core';
import { QueryTypes, Sequelize } from '@sequelize/core';
import { MySqlDialect } from '@sequelize/mysql';
import { expectTypeOf } from 'expect-type';
import { User } from './models/user';

export const sequelize = new Sequelize({ dialect: MySqlDialect });

sequelize.afterBulkSync((options: SyncOptions) => {
  console.info('synced!');
});

async function test() {
  expectTypeOf(
    await sequelize.query('SELECT * FROM `test`', { type: QueryTypes.SELECT }),
  ).toEqualTypeOf<object[]>();

  expectTypeOf(
    await sequelize.query('INSERT into test set test=1', { type: QueryTypes.INSERT }),
  ).toEqualTypeOf<[number, number]>();
}

sequelize.transaction<void>(async transaction => {
  expectTypeOf(
    await sequelize.query('SELECT * FROM `user`', {
      retry: {
        max: 123,
        report: (msg, options) => {},
      },
      model: User,
      transaction,
      logging: console.debug,
    }),
  ).toEqualTypeOf<User[]>();
});

sequelize.query('SELECT * FROM `user` WHERE status = $1', {
  bind: ['active'],
  type: QueryTypes.SELECT,
});

sequelize.query('SELECT * FROM `user` WHERE status = $status', {
  bind: { status: 'active' },
  type: QueryTypes.SELECT,
});
