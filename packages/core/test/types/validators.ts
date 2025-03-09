import { DataTypes, Model, Sequelize } from '@sequelize/core';
import { MySqlDialect } from '@sequelize/mysql';

const sequelize = new Sequelize({ dialect: MySqlDialect });

/**
 * Test for isIn/notIn validation - should accept any[]
 */
class ValidatedUser extends Model {}

ValidatedUser.init(
  {
    name: {
      type: DataTypes.STRING,
      validate: {
        isIn: [['first', 1, null]],
      },
    },
    email: {
      type: DataTypes.STRING,
      validate: {
        notIn: [['second', 2, null]],
      },
    },
  },
  { sequelize },
);
