/**
 * Keep this file in sync with the code in the "Usage of `sequelize.define`"
 * section in /docs/manual/other-topics/typescript.md
 *
 * Don't include this comment in the md file.
 */
import { Sequelize, Model, DataTypes, CreationOptional, InferAttributes, InferCreationAttributes } from 'sequelize';

const sequelize = new Sequelize('mysql://root:asd123@localhost:3306/mydb');

// We recommend you declare an interface for the attributes, for stricter typechecking

interface UserModel extends Model<InferAttributes<UserModel>, InferCreationAttributes<UserModel>> {
  // Some fields are optional when calling UserModel.create() or UserModel.build()
  id: CreationOptional<number>;
  name: string;
}

const UserModel = sequelize.define<UserModel>('User', {
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
