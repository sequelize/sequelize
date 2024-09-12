import { expectTypeOf } from "expect-type";
import { QueryTypes, Sequelize, SyncOptions } from 'sequelize';
import { User } from './models/User';

export const sequelize = new Sequelize('uri');

sequelize.afterBulkSync((options: SyncOptions) => {
  console.log('synced');
});

async function test() {
  expectTypeOf(
    await sequelize.query('SELECT * FROM `test`', { type: QueryTypes.SELECT })
  ).toEqualTypeOf<object[]>();

  expectTypeOf(
    await sequelize.query('INSERT into test set test=1', { type: QueryTypes.INSERT })
  ).toEqualTypeOf<[number, number]>();
}

sequelize.transaction<void>(async transaction => {
  expectTypeOf(
    await sequelize.query('SELECT * FROM `user`', {
      retry: {
        max: 123,
      },
      model: User,
      transaction,
      logging: true,
    })
  ).toEqualTypeOf<User[]>();
});

sequelize.query(
  'SELECT * FROM `user` WHERE status = $1',
  { bind: ['active'], type: QueryTypes.SELECT }
);

sequelize.query(
  'SELECT * FROM `user` WHERE status = $status',
  { bind: { status: 'active' }, type: QueryTypes.SELECT }
);
