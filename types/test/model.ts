import { Association, HasOne, Model, Sequelize, DataTypes } from 'sequelize';

class MyModel extends Model {
  public static associations: {
    other: HasOne;
  };
  public static async customStuff() {
    return this.sequelize!.query('select 1');
  }
}

const assoc: Association = MyModel.associations.other;

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