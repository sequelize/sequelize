import { Association, HasOne, Model } from 'sequelize';

class MyModel extends Model {
  public static associations: {
    other: HasOne;
  };
  public static async customStuff() {
    return this.sequelize!.query('select 1');
  }
}

class OtherModel extends Model {}

const assoc: Association = MyModel.associations.other;

MyModel.findOne({
  include: [
    { model: OtherModel, paranoid: true }
  ]
});