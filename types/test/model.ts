import { Association, HasOne, Model } from 'sequelize';

class MyModel extends Model {
  public static associations: {
    other: HasOne;
  };
  public static async customStuff() {
    return this.sequelize!.query('select 1');
  }
}

const assoc: Association = MyModel.associations.other;
