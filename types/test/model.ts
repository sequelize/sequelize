import { expectTypeOf } from "expect-type";
import { Association, BelongsToManyGetAssociationsMixin, DataTypes, HasOne, Model, Optional, Sequelize } from 'sequelize';
import { ModelDefined } from '../lib/model';

expectTypeOf<HasOne>().toMatchTypeOf<Association>();
class MyModel extends Model {
  public num!: number;
  public static associations: {
    other: HasOne;
  };
  public static async customStuff() {
    return this.sequelize!.query('select 1');
  }
}

class OtherModel extends Model {}

const Instance: MyModel = new MyModel({ int: 10 });

expectTypeOf(Instance.get('num')).toEqualTypeOf<number>();

MyModel.findOne({
  include: [
    {
      through: {
        as: "OtherModel",
        attributes: ['num']
      }
    }
  ]
});

MyModel.findOne({
  include: [
    { model: OtherModel, paranoid: true }
  ]
});

MyModel.hasOne(OtherModel, { as: 'OtherModelAlias' });

MyModel.findOne({ include: ['OtherModelAlias'] });

MyModel.findOne({ include: OtherModel });

MyModel.count({ include: OtherModel });

MyModel.build({ int: 10 }, { include: OtherModel });

MyModel.bulkCreate([{ int: 10 }], { include: OtherModel });

MyModel.update({}, { where: { foo: 'bar' }, paranoid: false});

const sequelize = new Sequelize('mysql://user:user@localhost:3306/mydb');

const model: typeof MyModel = MyModel.init({
  virtual: {
    type: new DataTypes.VIRTUAL(DataTypes.BOOLEAN, ['num']),
    get() {
      return this.getDataValue('num') + 2;
    },
    set(value: number) {
      this.setDataValue('num', value - 2);
    }
  }
}, {
  indexes: [
    {
      fields: ['foo'],
      using: 'gin',
      operator: 'jsonb_path_ops',
    }
  ],
  sequelize,
  tableName: 'my_model',
  getterMethods: {
    multiply: function() {
      return this.num * 2;
    }
  }
});

/**
 * Tests for findCreateFind() type.
 */
class UserModel extends Model {}

UserModel.init({
  username: { type: DataTypes.STRING, allowNull: false },
  beta_user: { type: DataTypes.BOOLEAN, allowNull: false }
}, {
  sequelize: sequelize
})

UserModel.findCreateFind({
  where: {
    username: "new user username"
  },
  defaults: {
    beta_user: true
  }
})

/**
 * Tests for findOrCreate() type.
 */

UserModel.findOrCreate({
  fields: [ "jane.doe" ],
  where: {
    username: "jane.doe"
  },
  defaults: {
    username: "jane.doe"
  }
})

/**
 * Test for primaryKeyAttributes.
 */
class TestModel extends Model {};
TestModel.primaryKeyAttributes;

/**
 * Test for joinTableAttributes on BelongsToManyGetAssociationsMixin
 */
class SomeModel extends Model {
  public getOthers!: BelongsToManyGetAssociationsMixin<OtherModel>
}

const someInstance = new SomeModel();
someInstance.getOthers({
  joinTableAttributes: { include: ['id'] }
});

/**
 * Test for through options in creating a BelongsToMany association
 */
class Film extends Model {}

class Actor extends Model {}

Film.belongsToMany(Actor, {
  through: {
    model: 'FilmActors',
    paranoid: true
  }
});

Actor.belongsToMany(Film, {
  through: {
    model: 'FilmActors',
    paranoid: true
  }
});

interface ModelAttributes {
  id: number;
  name: string;
}

interface CreationAttributes extends Optional<ModelAttributes, 'id'> {}

const ModelWithAttributes: ModelDefined<
  ModelAttributes,
  CreationAttributes
> = sequelize.define('efs', {
  name: DataTypes.STRING
});

const modelWithAttributes = ModelWithAttributes.build();

/**
 * Tests for set() type
 */
expectTypeOf(modelWithAttributes.set).toBeFunction();
expectTypeOf(modelWithAttributes.set).parameter(0).toEqualTypeOf<Partial<ModelAttributes>>();

/**
 * Tests for previous() type
 */
expectTypeOf(modelWithAttributes.previous).toBeFunction();
expectTypeOf(modelWithAttributes.previous).toBeCallableWith('name');
expectTypeOf(modelWithAttributes.previous).parameter(0).toEqualTypeOf<keyof ModelAttributes>();
expectTypeOf(modelWithAttributes.previous).parameter(0).not.toEqualTypeOf<'unreferencedAttribute'>();
expectTypeOf(modelWithAttributes.previous).returns.toEqualTypeOf<string | number | undefined>();
expectTypeOf(modelWithAttributes.previous('name')).toEqualTypeOf<string | undefined>();
expectTypeOf(modelWithAttributes.previous()).toEqualTypeOf<Partial<CreationAttributes>>();
