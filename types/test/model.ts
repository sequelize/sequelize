import { Association, BelongsToManyGetAssociationsMixin, DataTypes, HasOne, Model, Sequelize } from 'sequelize';

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

const assoc: Association = MyModel.associations.other;

const Instance: MyModel = new MyModel({ int: 10 });
const num: number = Instance.get('num');

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

MyModel.init({
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

const someInstance = new SomeModel()
someInstance.getOthers({
    joinTableAttributes: { include: [ 'id' ] }
})

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
})

Actor.belongsToMany(Film, {
  through: {
    model: 'FilmActors',
    paranoid: true
  }
})