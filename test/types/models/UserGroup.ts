import {
  InferAttributes,
  InferCreationAttributes,
  CreationOptional,
  DataTypes,
  HasMany,
  HasManyAddAssociationMixin,
  HasManyAddAssociationsMixin,
  HasManyCountAssociationsMixin,
  HasManyCreateAssociationMixin,
  HasManyGetAssociationsMixin,
  HasManyHasAssociationMixin,
  HasManyRemoveAssociationMixin,
  HasManyRemoveAssociationsMixin,
  HasManySetAssociationsMixin,
  Model,
  NonAttribute,
} from 'sequelize';
import { sequelize } from '../connection';
// associate
// it is important to import _after_ the model above is already exported so the circular reference works.
import { User } from './User';

// This class doesn't extend the generic Model<TAttributes>, but should still
// function just fine, with a bit less safe type-checking
export class UserGroup extends Model<
  InferAttributes<UserGroup>,
  InferCreationAttributes<UserGroup>
> {
  public static associations: {
    users: HasMany<UserGroup, User>
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
  declare countUsers: HasManyCountAssociationsMixin;
  declare hasUser: HasManyHasAssociationMixin<User, number>;
  declare removeUser: HasManyRemoveAssociationMixin<User, number>;
  declare removeUsers: HasManyRemoveAssociationsMixin<User, number>;
}

// attach all the metadata to the model
// instead of this, you could also use decorators
UserGroup.init({
  name: DataTypes.STRING,
  id: {
    type: DataTypes.INTEGER,
    allowNull: false,
    primaryKey: true,
    autoIncrement: true
  }
}, { sequelize });

export const Users = UserGroup.hasMany(User, { as: 'users', foreignKey: 'groupId' });
