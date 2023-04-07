import type { ConnectionOptions, ModelStatic, Fn } from '@sequelize/core';
import { Sequelize, Model, QueryTypes, Op } from '@sequelize/core';

export const sequelize = new Sequelize({
  hooks: {
    afterConnect: (connection: unknown, config: ConnectionOptions) => {
      // noop
    },
  },
  retry: {
    max: 123,
    match: ['hurr'],
    timeout: 3000,
    backoffBase: 1000,
    backoffExponent: 1.2,
    report: (msg, options) => {},
    name: 'durr',
  },
  dialectModule: {},
  keepDefaultTimezone: false,
  pool: {
    evict: 1000,
  },
});

// static members
Sequelize.fn('max', Sequelize.col('age'));
Sequelize.literal('1-2');
Sequelize.cast('123', 'integer');
Sequelize.and();
Sequelize.or();
Sequelize.json('data.id');
Sequelize.where(Sequelize.col('ABS'), Op.is, null);

// instance members
sequelize.fn('max', sequelize.col('age'));
sequelize.literal('1-2');
sequelize.cast('123', 'integer');
sequelize.and();
sequelize.or();
sequelize.json('data.id');
sequelize.where(sequelize.col('ABS'), Op.is, null);

const databaseName = sequelize.getDatabaseName();

const conn = sequelize.connectionManager;

// hooks

sequelize.beforeCreate('test', () => {
  // noop
});

sequelize
  .addHook('beforeConnect', (config: ConnectionOptions) => {
    // noop
  })
  .addHook('beforeBulkSync', () => {
    // noop
  });

Sequelize.addHook('beforeInit', () => {
  // noop
}).addHook('afterInit', () => {
  // noop
});

sequelize.beforeConnect(() => {});

sequelize.afterConnect(() => {});

const rnd: Fn = sequelize.random();

class Model1 extends Model {}

class Model2 extends Model {}

const MyModel: ModelStatic<Model1> = sequelize.models.asd;
MyModel.hasOne(Model2);
MyModel.findAll();

async function test() {
  const [results, meta]: [unknown[], unknown] = await sequelize.query('SELECT * FROM `user`', { type: QueryTypes.RAW });

  const res2: { count: number } | null = await sequelize
    .query<{ count: number }>('SELECT COUNT(1) as count FROM `user`', {
      type: QueryTypes.SELECT,
      plain: true,
    });

  const res3: { [key: string]: unknown } | null = await sequelize
    .query('SELECT COUNT(1) as count FROM `user`', {
      plain: true,
    });

  const res4: { [key: string]: unknown } | null = await sequelize
    .query('SELECT COUNT(1) as count FROM `user` WHERE 1 = 2', {
      plain: true,
    });
}
