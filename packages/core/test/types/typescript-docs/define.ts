import type {
  CreationOptional,
  InferAttributes,
  InferCreationAttributes,
  Model,
} from '@sequelize/core';
import { DataTypes, Sequelize } from '@sequelize/core';
import { MySqlDialect } from '@sequelize/mysql';

const sequelize = new Sequelize({
  dialect: MySqlDialect,
  url: 'mysql://root:asd123@localhost:3306/mydb',
});

// We recommend you declare an interface for the attributes, for stricter typechecking

interface IUserModel
  extends Model<InferAttributes<IUserModel>, InferCreationAttributes<IUserModel>> {
  // Some fields are optional when calling UserModel.create() or UserModel.build()
  id: CreationOptional<number>;
  name: string;
}

const UserModel = sequelize.define<IUserModel>('User', {
  id: {
    primaryKey: true,
    type: DataTypes.INTEGER.UNSIGNED,
  },
  name: {
    type: DataTypes.STRING,
  },
});

async function doStuff() {
  const instance = await UserModel.findByPk(1, {
    rejectOnEmpty: true,
  });

  console.log(instance.id);
}
