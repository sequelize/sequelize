/**
 * Keep this file in sync with the code in the "Usage without strict types for
 * attributes" section in /docs/manual/other-topics/typescript.md
 *
 * Don't include this comment in the md file.
 */
import { Sequelize, Model, DataTypes } from 'sequelize';

const sequelize = new Sequelize('mysql://root:asd123@localhost:3306/mydb');

class User extends Model {
  declare id: number;
  declare name: string;
  declare preferredName: string | null;
}

User.init(
  {
    id: {
      type: DataTypes.INTEGER.UNSIGNED,
      autoIncrement: true,
      primaryKey: true,
    },
    name: {
      type: new DataTypes.STRING(128),
      allowNull: false,
    },
    preferredName: {
      type: new DataTypes.STRING(128),
      allowNull: true,
    },
  },
  {
    tableName: 'users',
    sequelize, // passing the `sequelize` instance is required
  },
);

async function doStuffWithUserModel() {
  const newUser = await User.create({
    name: 'Johnny',
    preferredName: 'John',
  });
  console.log(newUser.id, newUser.name, newUser.preferredName);

  const foundUser = await User.findOne({ where: { name: 'Johnny' } });
  if (foundUser === null) return;
  console.log(foundUser.name);
}
