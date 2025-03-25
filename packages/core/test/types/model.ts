import type {
  Association,
  BelongsToManyGetAssociationsMixin,
  CreationOptional,
  HasOneAssociation,
  InferAttributes,
  InferCreationAttributes,
  ModelDefined,
} from '@sequelize/core';
import { DataTypes, Model, Sequelize } from '@sequelize/core';
import { MySqlDialect } from '@sequelize/mysql';
import { expectTypeOf } from 'expect-type';
import type { SetOptional } from 'type-fest';

expectTypeOf<HasOneAssociation>().toMatchTypeOf<Association>();

class MyModel extends Model<InferAttributes<MyModel>, InferCreationAttributes<MyModel>> {
  declare int: number;
  declare str: string | null;
  declare virtual: boolean | null;

  static associations: {
    other: HasOneAssociation;
  };

  static async customStuff() {
    return this.sequelize.query('select 1');
  }
}

class OtherModel extends Model {}

const Instance: MyModel = new MyModel({ int: 10 });

expectTypeOf(Instance.get('int')).toEqualTypeOf<number>();

MyModel.findOne({
  include: [
    {
      through: {
        as: 'OtherModel',
        attributes: ['int'],
      },
    },
  ],
});

MyModel.findOne({
  include: [{ through: { paranoid: true } }],
});

MyModel.findOne({
  include: [{ model: OtherModel, paranoid: true }],
});

MyModel.hasOne(OtherModel, { as: 'OtherModelAlias' });

MyModel.findOne({ include: ['OtherModelAlias'] });

MyModel.findOne({ include: OtherModel });

MyModel.findAndCountAll({ include: OtherModel }).then(({ count, rows }) => {
  expectTypeOf(count).toEqualTypeOf<number>();
  expectTypeOf(rows).toEqualTypeOf<MyModel[]>();
});

MyModel.findAndCountAll({ include: OtherModel, group: ['MyModel.int'] }).then(({ count, rows }) => {
  expectTypeOf(count).toEqualTypeOf<Array<{ [key: string]: unknown; count: number }>>();
  expectTypeOf(rows).toEqualTypeOf<MyModel[]>();
});

MyModel.findAndCountAll({
  include: OtherModel,
  group: ['MyModel.int'],
  countGroupedRows: true,
}).then(({ count, rows }) => {
  expectTypeOf(count).toEqualTypeOf<Array<{ [key: string]: unknown; count: number }>>();
  expectTypeOf(rows).toEqualTypeOf<MyModel[]>();
});

MyModel.count({ include: OtherModel }).then(count => {
  expectTypeOf(count).toEqualTypeOf<number>();
});

MyModel.count({ include: [MyModel], where: { $int$: [10, 120] } }).then(count => {
  expectTypeOf(count).toEqualTypeOf<number>();
});

MyModel.count({ group: 'type' }).then(result => {
  expectTypeOf(result).toEqualTypeOf<Array<{ [key: string]: unknown; count: number }>>();
  expectTypeOf(result[0]).toMatchTypeOf<{ count: number }>();
});

MyModel.increment('int', { by: 1 }).then(result => {
  expectTypeOf(result).toEqualTypeOf<[affectedRows: MyModel[], affectedCount?: number]>();
});

MyModel.increment({ int: 2 }, {}).then(result => {
  expectTypeOf(result).toEqualTypeOf<[affectedRows: MyModel[], affectedCount?: number]>();
});

MyModel.increment(['int'], { by: 3 }).then(result => {
  expectTypeOf(result).toEqualTypeOf<[affectedRows: MyModel[], affectedCount?: number]>();
});

MyModel.decrement('int', { by: 1 }).then(result => {
  expectTypeOf(result).toEqualTypeOf<[affectedRows: MyModel[], affectedCount?: number]>();
});

MyModel.decrement({ int: 2 }, {}).then(result => {
  expectTypeOf(result).toEqualTypeOf<[affectedRows: MyModel[], affectedCount?: number]>();
});

MyModel.decrement(['int'], { by: 3 }).then(result => {
  expectTypeOf(result).toEqualTypeOf<[affectedRows: MyModel[], affectedCount?: number]>();
});

MyModel.build({ int: 10 }, { include: OtherModel });

MyModel.bulkCreate([{ int: 10 }], { include: OtherModel, searchPath: 'public' });

MyModel.update({}, { where: { str: 'bar' }, paranoid: false }).then(result => {
  expectTypeOf(result).toEqualTypeOf<[affectedCount: number]>();
});

MyModel.update({}, { where: { str: 'bar' }, returning: false }).then(result => {
  expectTypeOf(result).toEqualTypeOf<[affectedCount: number]>();
});

MyModel.update({}, { where: { str: 'bar' }, returning: true }).then(result => {
  expectTypeOf(result).toEqualTypeOf<[affectedCount: number, affectedRows: MyModel[]]>();
});

MyModel.update({}, { where: { str: 'bar' }, returning: ['str'] }).then(result => {
  expectTypeOf(result).toEqualTypeOf<[affectedCount: number, affectedRows: MyModel[]]>();
});

const sequelize = new Sequelize({ dialect: MySqlDialect });

MyModel.init(
  {
    int: DataTypes.INTEGER,
    str: DataTypes.STRING,
    virtual: {
      type: new DataTypes.VIRTUAL(DataTypes.BOOLEAN, ['int']),
      get() {
        const int: number = this.getDataValue('int');

        return int + 2;
      },
      set(value: number) {
        this.setDataValue('int', value - 2);
      },
    },
  },
  {
    indexes: [
      {
        fields: ['foo'],
        using: 'gin',
        operator: 'jsonb_path_ops',
      },
    ],
    sequelize,
    tableName: 'my_model',
  },
);

/**
 * Tests for findCreateFind() type.
 */
class UserModel extends Model<InferAttributes<UserModel>, InferCreationAttributes<UserModel>> {
  declare username: string;
  declare beta_user: CreationOptional<boolean>;
}

UserModel.init(
  {
    username: { type: DataTypes.STRING, allowNull: false },
    beta_user: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: false },
  },
  {
    sequelize,
  },
);

UserModel.findCreateFind({
  where: {
    username: 'new user username',
  },
  defaults: {
    beta_user: true,
    username: 'new user username',
  },
});

const rawAttributes = UserModel.getAttributes();
expectTypeOf(rawAttributes).toHaveProperty('username');
expectTypeOf(rawAttributes).toHaveProperty('beta_user');
expectTypeOf(rawAttributes).not.toHaveProperty('non_attribute');

/**
 * Tests for findOrCreate() type.
 */

UserModel.findOrCreate({
  // 'create' options
  hooks: true,
  fields: ['username'],
  ignoreDuplicates: true,
  returning: true,
  validate: true,
  raw: true,
  isNewRecord: true,
  include: [],

  // 'find' options
  paranoid: true,
  where: {
    username: 'jane.doe',
  },

  // 'findOrCreate' options
  defaults: {
    username: 'jane.doe',
  },
});

/**
 * Tests for findOrBuild() type.
 */

UserModel.findOrBuild({
  // 'build' options
  raw: true,
  isNewRecord: true,
  include: [],

  // 'find' options
  paranoid: true,
  where: {
    username: 'jane.doe',
  },

  // 'findOrCreate' options
  defaults: {
    username: 'jane.doe',
  },
});

/**
 * Test for primaryKeyAttributes.
 */
class TestModel extends Model {}

TestModel.primaryKeyAttributes;

/**
 * Test for joinTableAttributes on BelongsToManyGetAssociationsMixin
 */
class SomeModel extends Model {
  getOthers!: BelongsToManyGetAssociationsMixin<OtherModel>;
}

const someInstance = new SomeModel();
someInstance.getOthers({
  joinTableAttributes: { include: ['id'] },
});

/**
 * Test for through options in creating a BelongsToMany association
 */
class Film extends Model {}

class Actor extends Model {}

Film.belongsToMany(Actor, {
  through: {
    model: 'FilmActors',
    paranoid: true,
  },
});

Actor.belongsToMany(Film, {
  through: {
    model: 'FilmActors',
    paranoid: true,
  },
});

interface MyModelAttributes {
  id: number;
  name: string;
}

interface CreationAttributes extends SetOptional<MyModelAttributes, 'id'> {}

const ModelWithAttributes: ModelDefined<MyModelAttributes, CreationAttributes> = sequelize.define(
  'efs',
  {
    name: DataTypes.STRING,
  },
);

const modelWithAttributes = ModelWithAttributes.build();

/**
 * Tests for set() type
 */
expectTypeOf(modelWithAttributes.set).toBeFunction();
expectTypeOf(modelWithAttributes.set).parameter(0).toEqualTypeOf<Partial<MyModelAttributes>>();

/**
 * Tests for previous() type
 */
expectTypeOf(modelWithAttributes.previous).toBeFunction();
expectTypeOf(modelWithAttributes.previous).toBeCallableWith('name');
expectTypeOf(modelWithAttributes.previous).parameter(0).toEqualTypeOf<keyof MyModelAttributes>();
expectTypeOf(modelWithAttributes.previous)
  .parameter(0)
  .not.toEqualTypeOf<'unreferencedAttribute'>();
expectTypeOf(modelWithAttributes.previous).returns.toEqualTypeOf<string | number | undefined>();
expectTypeOf(modelWithAttributes.previous('name')).toEqualTypeOf<string | undefined>();
expectTypeOf(modelWithAttributes.previous()).toEqualTypeOf<Partial<CreationAttributes>>();

/**
 * Tests for toJson() type
 */
interface FilmToJson {
  id: number;
  name?: string;
}

class FilmModelToJson extends Model<FilmToJson> implements FilmToJson {
  id!: number;
  name?: string;
}

const film = FilmModelToJson.build();

class FilmModelExtendToJson extends Model<FilmToJson> implements FilmToJson {
  id!: number;
  name?: string;

  toJSON() {
    return { id: this.id };
  }
}

const filmOverrideToJson = FilmModelExtendToJson.build();

const result = film.toJSON();
expectTypeOf(result).toEqualTypeOf<FilmToJson>();

type FilmNoNameToJson = Omit<FilmToJson, 'name'>;
const resultDerived = film.toJSON<FilmNoNameToJson>();
expectTypeOf(resultDerived).toEqualTypeOf<FilmNoNameToJson>();

const resultOverrideToJson = filmOverrideToJson.toJSON();
expectTypeOf(resultOverrideToJson).toEqualTypeOf<FilmNoNameToJson>();
