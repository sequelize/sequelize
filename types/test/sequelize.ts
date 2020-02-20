import { Config, Sequelize, Model, QueryTypes } from 'sequelize';
import { Fn } from '../lib/utils';

Sequelize.useCLS({
});

export const sequelize = new Sequelize({
  hooks: {
    afterConnect: (connection, config: Config) => {
      // noop
    }
  },
  retry: {
    max: 123,
    match: ['hurr'],
  },
  dialectModule: {},
  pool: {
    evict: 1000,
  }
});

const conn = sequelize.connectionManager;

// hooks

sequelize.beforeCreate('test', () => {
    // noop
});

sequelize
    .addHook('beforeConnect', (config: Config) => {
        // noop
    })
    .addHook('beforeBulkSync', () => {
        // noop
    });

Sequelize.addHook('beforeCreate', () => {
    // noop
}).addHook('beforeBulkCreate', () => {
    // noop
});

Sequelize.beforeConnect(() => {

});

Sequelize.afterConnect(() => {

});

const rnd: Fn = sequelize.random();

class Model1 extends Model{}
class Model2 extends Model{}
const myModel: typeof Model1 = sequelize.models.asd;
myModel.hasOne(Model2)
myModel.findAll();

sequelize.query('SELECT * FROM `user`', { type: QueryTypes.RAW }).then(result => {
  const data = result[0];
  const arraysOnly = (a: any[]) => a;
  arraysOnly(data);
});

sequelize
  .query<{ count: number }>("SELECT COUNT(1) as count FROM `user`", {
    type: QueryTypes.SELECT,
    plain: true
  })
  .then(result => {
    result.count.toExponential(); // is a number!
  });

sequelize
  .query("SELECT COUNT(1) as count FROM `user`", {
    plain: true
  })
  .then(result => {
    console.log(result.count);
  });
