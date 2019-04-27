import { Association, HasOne, Model, Sequelize } from 'sequelize';

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
  tableName: 'my_model'
});
