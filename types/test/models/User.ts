import {
  BelongsTo,
  BelongsToCreateAssociationMixin,
  BelongsToGetAssociationMixin,
  BelongsToSetAssociationMixin,
  DataTypes,
  FindOptions,
  Model,
  ModelCtor,
  Op,
  Optional
} from 'sequelize';
import { sequelize } from '../connection';

export interface UserAttributes {
  id: number;
  username: string;
  firstName: string;
  lastName: string;
  groupId: number;
}

/**
 * In this case, we make most fields optional. In real cases,
 * only fields that have default/autoincrement values should be made optional.
 */
export interface UserCreationAttributes extends Optional<UserAttributes, 'id' | 'username' | 'lastName' | 'groupId'> {}

export class User extends Model<UserAttributes, UserCreationAttributes> implements UserAttributes {
  public static associations: {
    group: BelongsTo<User, UserGroup>;
  };

  public id!: number;
  public username!: string;
  public firstName!: string;
  public lastName!: string;
  public groupId!: number;
  public createdAt!: Date;
  public updatedAt!: Date;

  // mixins for association (optional)
  public group?: UserGroup;
  public getGroup!: BelongsToGetAssociationMixin<UserGroup>;
  public setGroup!: BelongsToSetAssociationMixin<UserGroup, number>;
  public createGroup!: BelongsToCreateAssociationMixin<UserGroup>;
}

User.init(
  {
    id: {
      type: DataTypes.NUMBER,
      primaryKey: true,
    },
    firstName: DataTypes.STRING,
    lastName: DataTypes.STRING,
    username: DataTypes.STRING,
    groupId: DataTypes.NUMBER,
  },
  {
    version: true,
    getterMethods: {
    a() {
      return 1;
    },
    },
    setterMethods: {
      b(val: string) {
        this.username = val;
      },
    },
    scopes: {
      custom(a: number) {
        return {
          where: {
            firstName: a,
          },
        };
      },
      custom2() {
        return {}
      }
    },
    indexes: [{
      fields: ['firstName'],
      using: 'BTREE',
      name: 'firstNameIdx',
      concurrently: true,
    }],
    sequelize,
  }
);

User.afterSync(() => {
  sequelize.getQueryInterface().addIndex(User.tableName, {
      fields: ['lastName'],
      using: 'BTREE',
      name: 'lastNameIdx',
      concurrently: true,
  })
})

// Hooks
User.afterFind((users, options) => {
  console.log('found');
});

// TODO: VSCode shows the typing being correctly narrowed but doesn't do it correctly
User.addHook('beforeFind', 'test', (options: FindOptions<UserAttributes>) => {
  return undefined;
});

// Model#addScope
User.addScope('withoutFirstName', {
  where: {
    firstName: {
      [Op.is]: null,
    },
  },
});

User.addScope(
  'withFirstName',
  (firstName: string) => ({
    where: { firstName },
  }),
);

// associate
// it is important to import _after_ the model above is already exported so the circular reference works.
import { UserGroup } from './UserGroup';
export const Group = User.belongsTo(UserGroup, { as: 'group', foreignKey: 'groupId' });

// associations refer to their Model
const userType: ModelCtor<User> = User.associations.group.source;
const groupType: ModelCtor<UserGroup> = User.associations.group.target;

User.scope([
  'custom2',
  { method: [ 'custom', 32 ] }
])

const instance = new User({ username: 'foo', firstName: 'bar', lastName: 'baz' });
instance.isSoftDeleted()
