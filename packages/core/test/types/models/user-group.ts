import type {
  CreationOptional,
  HasManyAddAssociationMixin,
  HasManyAddAssociationsMixin,
  HasManyAssociation,
  HasManyCountAssociationsMixin,
  HasManyCreateAssociationMixin,
  HasManyGetAssociationsMixin,
  HasManyHasAssociationMixin,
  HasManyRemoveAssociationMixin,
  HasManyRemoveAssociationsMixin,
  HasManySetAssociationsMixin,
  InferAttributes,
  InferCreationAttributes,
  NonAttribute,
} from '@sequelize/core';
import { DataTypes, Model } from '@sequelize/core';
import { sequelize } from '../connection';
import { User } from './user';

// This class doesn't extend the generic Model<TAttributes>, but should still
// function just fine, with a bit less safe type-checking
export class UserGroup extends Model<
  InferAttributes<UserGroup>,
  InferCreationAttributes<UserGroup>
> {
  static associations: {
    users: HasManyAssociation<UserGroup, User>;
  };

  declare id: CreationOptional<number>;
  declare name: string;

  // mixins for association (optional)
  declare users?: NonAttribute<User[]>;
  declare getUsers: HasManyGetAssociationsMixin<User>;
  declare setUsers: HasManySetAssociationsMixin<User, number>;
  declare addUser: HasManyAddAssociationMixin<User, number>;
  declare addUsers: HasManyAddAssociationsMixin<User, number>;
  declare createUser: HasManyCreateAssociationMixin<User, 'groupId'>;
  declare countUsers: HasManyCountAssociationsMixin<User>;
  declare hasUser: HasManyHasAssociationMixin<User, number>;
  declare removeUser: HasManyRemoveAssociationMixin<User, number>;
  declare removeUsers: HasManyRemoveAssociationsMixin<User, number>;
}

// attach all the metadata to the model
// instead of this, you could also use decorators
UserGroup.init(
  {
    name: DataTypes.STRING,
    id: {
      type: DataTypes.INTEGER,
      allowNull: false,
      primaryKey: true,
      autoIncrement: true,
    },
  },
  { sequelize },
);

export const Users = UserGroup.hasMany(User, { as: 'users', foreignKey: 'groupId' });
