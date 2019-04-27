import {
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
} from 'sequelize';
import { sequelize } from '../connection';

export class UserGroup extends Model {
    public static associations: {
        users: HasMany<UserGroup, User>
    };

    public id!: number;
    public name!: string;

    // mixins for association (optional)
    public users!: User[];
    public getUsers!: HasManyGetAssociationsMixin<User>;
    public setUsers!: HasManySetAssociationsMixin<User, number>;
    public addUser!: HasManyAddAssociationMixin<User, number>;
    public addUsers!: HasManyAddAssociationsMixin<User, number>;
    public createUser!: HasManyCreateAssociationMixin<number>;
    public countUsers!: HasManyCountAssociationsMixin;
    public hasUser!: HasManyHasAssociationMixin<User, number>;
    public removeUser!: HasManyRemoveAssociationMixin<User, number>;
    public removeUsers!: HasManyRemoveAssociationsMixin<User, number>;
}

// attach all the metadata to the model
// instead of this, you could also use decorators
UserGroup.init({ name: DataTypes.STRING }, { sequelize });

// associate
// it is important to import _after_ the model above is already exported so the circular reference works.
import { User } from './User';
export const Users = UserGroup.hasMany(User, { as: 'users', foreignKey: 'groupId' });
