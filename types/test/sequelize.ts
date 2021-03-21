import { expectTypeOf } from 'expect-type';
import { Config, Sequelize, Model, QueryTypes, ModelCtor, DataTypes, Optional } from 'sequelize';
import { ModelDefined } from '../lib/model';
import { Fn } from '../lib/utils';

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
const myModel: ModelCtor<Model1> = sequelize.models.asd;
myModel.hasOne(Model2)
myModel.findAll();

// expect type tests
/// implicitly specifying attributes
const myModel2 = sequelize.define("myModel2", {
  column: DataTypes.STRING,
});

expectTypeOf(myModel2).toEqualTypeOf<
  ModelDefined<
    | Record<string, unknown>
    | ({
        column: unknown;
      } & Record<string, unknown>),
    {
      column: unknown;
    } & Record<string, unknown>
  >
>();

/// explicitly specifying attributes
interface ModelAttributes {
  id: number;
  column: string;
}

interface CreationAttributes extends Optional<ModelAttributes, "id"> {}

const myModel3 = sequelize.define<ModelAttributes, CreationAttributes>(
  "myModel3",
  {
    column: DataTypes.STRING,
  }
);

expectTypeOf(myModel3).toEqualTypeOf<
  ModelDefined<
    | (CreationAttributes & Record<string, unknown>)
    | (ModelAttributes & Record<string, unknown>),
    CreationAttributes & Record<string, unknown>
  >
>();

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
