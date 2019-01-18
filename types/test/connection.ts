import { QueryTypes, Sequelize, SyncOptions } from 'sequelize';

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
