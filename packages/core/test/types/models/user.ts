import type {
  BelongsToAssociation,
  BelongsToCreateAssociationMixin,
  BelongsToGetAssociationMixin,
  BelongsToSetAssociationMixin,
  CreationOptional,
  FindOptions,
  InferAttributes,
  InferCreationAttributes,
  ModelStatic,
} from '@sequelize/core';
import { DataTypes, Model, Op } from '@sequelize/core';
import { sequelize } from '../connection';
import { UserGroup } from './user-group';
import { UserPost } from './user-post';

type NonUserAttributes = 'group';

export class User extends Model<
  InferAttributes<User, { omit: NonUserAttributes }>,
  InferCreationAttributes<User, { omit: NonUserAttributes }>
> {
  static associations: {
    group: BelongsToAssociation<User, UserGroup>;
  };

  declare id: CreationOptional<number>;
  declare createdAt: CreationOptional<Date>;
  declare updatedAt: CreationOptional<Date>;

  declare username: CreationOptional<string | null>;
  declare firstName: string;
  declare lastName: CreationOptional<string | null>;
  declare groupId: CreationOptional<number | null>;

  // mixins for association (optional)
  declare group?: UserGroup;
  declare getGroup: BelongsToGetAssociationMixin<UserGroup>;
  declare setGroup: BelongsToSetAssociationMixin<UserGroup, number>;
  declare createGroup: BelongsToCreateAssociationMixin<UserGroup>;
}

User.init(
  {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
    },
    firstName: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    lastName: DataTypes.STRING,
    username: DataTypes.STRING,
    groupId: DataTypes.INTEGER,
    createdAt: DataTypes.DATE,
    updatedAt: DataTypes.DATE,
  },
  {
    version: true,
    scopes: {
      custom(a: number) {
        return {
          where: {
            firstName: a,
          },
        };
      },
      custom2() {
        return {};
      },
    },
    indexes: [
      {
        fields: ['firstName'],
        using: 'BTREE',
        name: 'firstNameIdx',
        concurrently: true,
      },
    ],
    sequelize,
  },
);

User.afterSync(() => {
  sequelize.queryInterface.addIndex(User.table, {
    fields: ['lastName'],
    using: 'BTREE',
    name: 'lastNameIdx',
    concurrently: true,
  });
});

// Hooks
User.afterFind((users, options) => {
  console.debug('found');
});

// TODO: VSCode shows the typing being correctly narrowed but doesn't do it correctly
User.addHook('beforeFind', 'test', (options: FindOptions<InferAttributes<User>>) => {});

User.addHook('afterDestroy', async (instance, options) => {
  // `options` from `afterDestroy` should be passable to `sequelize.transaction`
  await instance.sequelize.transaction(options, async () => {});
});

// Model#addScope
User.addScope('withoutLastName', {
  where: {
    lastName: {
      [Op.is]: null,
    },
  },
});

User.addScope('withFirstName', (firstName: string) => ({
  where: { firstName },
}));

// associate with a class-based model
export const Group = User.belongsTo(UserGroup, { as: 'group', foreignKey: 'groupId' });
// associate with a sequelize.define model
User.hasMany(UserPost, { as: 'posts', foreignKey: 'userId' });
UserPost.belongsTo(User, {
  foreignKey: 'userId',
  targetKey: 'id',
  as: 'user',
});

// associations refer to their Model
const userType: ModelStatic<User> = User.associations.group.source;
const groupType: ModelStatic<UserGroup> = User.associations.group.target;

// should associate correctly with both sequelize.define and class-based models
User.findOne({ include: [{ model: UserGroup }] });
User.findOne({ include: [{ model: UserPost }] });

User.scope(['custom2', { method: ['custom', 32] }]);
User.withScope(['custom2', { method: ['custom', 32] }]);

const instance = new User({ username: 'foo', firstName: 'bar', lastName: 'baz' });
instance.isSoftDeleted();
