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

/**
 * Test for isUUID validation - should accept number or 'all'
 * See: https://github.com/sequelize/sequelize/issues/18171
 */
class UserWithUUID extends Model {}

UserWithUUID.init(
  {
    uuidV4: {
      type: DataTypes.STRING,
      validate: {
        isUUID: 4,
      },
    },
    uuidAny: {
      type: DataTypes.STRING,
      validate: {
        isUUID: 'all',
      },
    },
    uuidWithMessage: {
      type: DataTypes.STRING,
      validate: {
        isUUID: { msg: 'Must be a valid UUID', args: 'all' },
      },
    },
  },
  { sequelize },
);
