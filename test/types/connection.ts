import type { SyncOptions } from '@sequelize/core';
import { QueryTypes, Sequelize } from '@sequelize/core';
import { expectTypeOf } from 'expect-type';
import { User } from './models/user';

export const sequelize = new Sequelize('uri');

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

// eslint-disable-next-line @typescript-eslint/no-invalid-void-type -- false positive :/
sequelize.transaction<void>(async transaction => {
  expectTypeOf(
    await sequelize.query('SELECT * FROM `user`', {
      retry: {
        max: 123,
      },
      model: User,
      transaction,
      logging: true,
    }),
  ).toEqualTypeOf<User[]>();
});

sequelize.query(
  'SELECT * FROM `user` WHERE status = $1',
  { bind: ['active'], type: QueryTypes.SELECT },
);

sequelize.query(
  'SELECT * FROM `user` WHERE status = $status',
  { bind: { status: 'active' }, type: QueryTypes.SELECT },
);
