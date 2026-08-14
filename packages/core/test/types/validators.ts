import { DataTypes, Model, Sequelize } from '@sequelize/core';
import { MySqlDialect } from '@sequelize/mysql';

const sequelize = new Sequelize({ dialect: MySqlDialect });

/**
 * Tests for isIn/notIn and isUUID validation types.
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
    uuid: {
      type: DataTypes.UUID,
      validate: {
        isUUID: 'all',
      },
    },
    uuidWithMessage: {
      type: DataTypes.UUID,
      validate: {
        isUUID: { msg: 'must be a UUID', args: 'all' },
      },
    },
  },
  { sequelize },
);
