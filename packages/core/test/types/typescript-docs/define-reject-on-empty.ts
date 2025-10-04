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

// Define a model with rejectOnEmpty: true at the model level
const UserModel = sequelize.define<IUserModel>(
  'User',
  {
    id: {
      primaryKey: true,
      type: DataTypes.INTEGER.UNSIGNED,
    },
    name: {
      type: DataTypes.STRING,
    },
  },
  {
    // This will make all find operations throw an error if no record is found
    rejectOnEmpty: true,
  },
);

async function doStuff() {
  // Since the model has rejectOnEmpty: true, this will throw an error if no record is found
  // TypeScript should infer that the return type is non-null
  const instance = await UserModel.findByPk(1);

  // The return type should be guaranteed to be non-null because of model-level rejectOnEmpty
  console.log(instance.id); // TypeScript should know this is not null

  // You can still override the model-level setting for individual queries
  const maybeInstance = await UserModel.findByPk(1, {
    rejectOnEmpty: false,
  });

  // Now TypeScript should know this could be null
  if (maybeInstance) {
    console.log(maybeInstance.id);
  }
}
