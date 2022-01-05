import { Model, Optional, DataTypes } from 'sequelize';
import { sequelize } from '../connection';

export interface UserPostAttributes {
  id: number;
  userId: number;
  text: string;
}

export interface UserPostCreationAttributes
  extends Optional<UserPostAttributes, 'id'> {}

export interface UserPostInstance
  extends Model<UserPostAttributes, UserPostCreationAttributes>,
    UserPostAttributes {}

/**
 * This is a component defined using `sequelize.define` to ensure that various
 * functions also work with non-class models, which were the default before
 * Sequelize v5.
 */
export const UserPost = sequelize.define<UserPostInstance>(
  'UserPost',
  {
    id: {
      type: DataTypes.INTEGER.UNSIGNED,
      primaryKey: true,
      autoIncrement: true,
    },
    userId: {
      type: DataTypes.INTEGER.UNSIGNED,
      allowNull: false,
    },
    text: {
      type: DataTypes.STRING(255),
      allowNull: false,
    },
  },
  {
    indexes: [
      {
        name: 'userId',
        fields: ['userId'],
      },
    ],
  },
);

UserPost.findOne({ where: { id: 1 }});
