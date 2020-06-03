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

const databaseName = sequelize.getDatabaseName();

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

async function test() {
  const [results, meta]: [unknown[], unknown] = await sequelize.query('SELECT * FROM `user`', { type: QueryTypes.RAW });

  const res2: { count: number } = await sequelize
    .query<{ count: number }>("SELECT COUNT(1) as count FROM `user`", {
      type: QueryTypes.SELECT,
      plain: true
    });

  const res3: { [key: string]: unknown; } = await sequelize
    .query("SELECT COUNT(1) as count FROM `user`", {
      plain: true
    })
}
