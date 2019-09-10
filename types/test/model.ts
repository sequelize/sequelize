import { Association, HasOne, Model, Sequelize, DataTypes } from 'sequelize';

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
    { model: OtherModel, paranoid: true }
  ]
});

MyModel.hasOne(OtherModel, { as: 'OtherModelAlias' });

MyModel.findOne({ include: ['OtherModelAlias'] });

const sequelize = new Sequelize('mysql://user:user@localhost:3306/mydb');

MyModel.init({}, {
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

class ModelCompositePrimaryKey extends Model {}

ModelCompositePrimaryKey.init({
  uid: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
  primaryKeyOne: { type: DataTypes.STRING, primaryKey: true, allowNull: false },
  title: DataTypes.STRING,
  description: DataTypes.TEXT,
}, { sequelize, modelName: 'ModelCompositePrimaryKey' });

ModelCompositePrimaryKey
  .create({ primaryKeyOne: "Type 1", title: 'Test Record', description: 'Record created to test composite primary key' })
  .then(modelCompositePrimaryKey => {
    console.log(modelCompositePrimaryKey.get('title'));
    console.log(modelCompositePrimaryKey.get('description'));
    console.log(ModelCompositePrimaryKey.primaryKeyAttributes);
  })