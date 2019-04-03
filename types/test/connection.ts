import { QueryTypes, Sequelize, SyncOptions } from 'sequelize';
import { User } from 'models/User';

export const sequelize = new Sequelize('uri');

sequelize.afterBulkSync((options: SyncOptions) => {
  console.log('synced');
});

sequelize
  .query('SELECT * FROM `test`', {
    type: QueryTypes.SELECT,
  })
  .then(rows => {
    rows.forEach(row => {
      console.log(row);
    });
  });

sequelize
.query('INSERT into test set test=1', {
  type: QueryTypes.INSERT,
})
.then(([aiId, affected]) => {
  console.log(aiId, affected);
});

sequelize.transaction<void>(async transaction => {
  const rows = await sequelize
    .query('SELECT * FROM `user`', {
      retry: {
        max: 123,
      },
      model: User,
      transaction,
      logging: true,
    })
});

sequelize.query('SELECT * FROM `user` WHERE status = $1',
  { bind: ['active'], type: QueryTypes.SELECT }
);

sequelize.query('SELECT * FROM `user` WHERE status = $status',
  { bind: { status: 'active' }, type: QueryTypes.SELECT }
);
