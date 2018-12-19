import {
    BelongsTo,
    BelongsToCreateAssociationMixin,
    BelongsToGetAssociationMixin,
    BelongsToSetAssociationMixin,
    DataTypes,
    FindOptions,
    Model,
} from 'sequelize';
import { sequelize } from '../connection';

export class User extends Model {
    public static associations: {
        group: BelongsTo
    };

    public id: number;
    public username: string;
    public firstName: string;
    public lastName: string;
    public createdAt: Date;
    public updatedAt: Date;

    // mixins for association (optional)
    public groupId: number;
    public group: UserGroup;
    public getGroup: BelongsToGetAssociationMixin<UserGroup>;
    public setGroup: BelongsToSetAssociationMixin<UserGroup, number>;
    public createGroup: BelongsToCreateAssociationMixin<UserGroup>;
}

User.init(
    {
        firstName: DataTypes.STRING,
        lastName: DataTypes.STRING,
        username: DataTypes.STRING,
    },
    {
        scopes: {
            custom(a: number) {
                return {
                    where: {
                        firstName: a,
                    },
                };
            }
        },
        sequelize,
    }
);

// Hooks
User.afterFind((users, options) => {
    console.log('found');
});

// TODO: VSCode shows the typing being correctly narrowed but doesn't do it correctly
User.addHook('beforeFind', 'test', (options: FindOptions) => {
    return undefined;
});
// associate
// it is important to import _after_ the model above is already exported so the circular reference works.
import { UserGroup } from './UserGroup';
export const Group = User.belongsTo(UserGroup, { as: 'group', foreignKey: 'groupId' });
