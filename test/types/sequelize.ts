import { Config, Sequelize, Model, QueryTypes, ModelCtor, Op, Utils } from 'sequelize';

Sequelize.useCLS({
});

export const sequelize = new Sequelize({
  hooks: {
    afterConnect: (connection: unknown, config: Config) => {
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

// static members
Sequelize.fn('max', Sequelize.col('age'))
Sequelize.literal('1-2')
Sequelize.cast('123', 'integer')
Sequelize.and()
Sequelize.or()
Sequelize.json('data.id')
Sequelize.where(Sequelize.col("ABS"), Op.is, null);
Sequelize.where(Sequelize.col("ABS"), '=', null);

// instance members
sequelize.fn('max', sequelize.col('age'))
sequelize.literal('1-2')
sequelize.cast('123', 'integer')
sequelize.and()
sequelize.or()
sequelize.json('data.id')
sequelize.where(sequelize.col("ABS"), Op.is, null);
sequelize.getQueryInterface();

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

const rnd: Utils.Fn = sequelize.random();

class Model1 extends Model{}
class Model2 extends Model{}
const myModel: ModelCtor<Model1> = sequelize.models.asd;
myModel.hasOne(Model2)
myModel.findAll();

async function test() {
  const [results, meta]: [unknown[], unknown] = await sequelize.query('SELECT * FROM `user`', { type: QueryTypes.RAW });

  const res2: { count: number } | null = await sequelize
    .query<{ count: number }>("SELECT COUNT(1) as count FROM `user`", {
      type: QueryTypes.SELECT,
      plain: true
    });

  const res3: { [key: string]: unknown; } | null = await sequelize
    .query("SELECT COUNT(1) as count FROM `user`", {
      plain: true
    })

  const res4: { [key: string]: unknown; } | null = await sequelize
    .query("SELECT COUNT(1) as count FROM `user` WHERE 1 = 2", {
      plain: true
    })
}
