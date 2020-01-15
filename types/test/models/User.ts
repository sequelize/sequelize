import {
  BelongsTo,
  BelongsToCreateAssociationMixin,
  BelongsToGetAssociationMixin,
  BelongsToSetAssociationMixin,
  DataTypes,
  FindOptions,
  Model,
  ModelCtor,
  Op
} from 'sequelize';
import { sequelize } from '../connection';

export class User extends Model {
  public static associations: {
    group: BelongsTo<User, UserGroup>;
  };

  public id!: number;
  public username!: string;
  public firstName!: string;
  public lastName!: string;
  public createdAt!: Date;
  public updatedAt!: Date;

  // mixins for association (optional)
  public groupId!: number;
  public group?: UserGroup;
  public getGroup!: BelongsToGetAssociationMixin<UserGroup>;
  public setGroup!: BelongsToSetAssociationMixin<UserGroup, number>;
  public createGroup!: BelongsToCreateAssociationMixin<UserGroup>;
}

User.init(
  {
    firstName: DataTypes.STRING,
    lastName: DataTypes.STRING,
    username: DataTypes.STRING,
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
        (<User>this).username = val;
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
User.addHook('beforeFind', 'test', (options: FindOptions) => {
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
