import type { InferAttributes, NonAttribute } from '@sequelize/core';
import { BelongsToManyAssociation, Model } from '@sequelize/core';
import { BelongsTo, BelongsToMany, HasMany, HasOne } from '@sequelize/core/decorators-legacy';
import { expect } from 'chai';
import assert from 'node:assert';
import { resetSequelizeInstance, sequelize, typeTest } from '../../support';

const CANNOT_INHERIT_ASSOCIATION_ERROR =
  /Models that use @HasOne, @HasMany, or @BelongsToMany associations cannot be inherited from/;
const CANNOT_USE_AS_ERROR =
  'The "as" option is not allowed when using association decorators. The name of the decorated field is used as the association name.';

describe('@BelongsTo', () => {
  beforeEach(() => {
    resetSequelizeInstance();
  });

  it('defines a belongsTo association', () => {
    class User extends Model<InferAttributes<User>> {}

    class Profile extends Model<InferAttributes<Profile>> {
      @BelongsTo(() => User, 'userId')
      declare user1: Profile;

      @BelongsTo(() => User, { foreignKey: 'userId' })
      declare user2: User;

      // Added in https://github.com/sequelize/sequelize-typescript/pull/1206 to help with circular dependencies.
      @BelongsTo(seq => seq.models.getOrThrow('User'), 'userId')
      declare user3: User;

      declare userId: number;
    }

    sequelize.addModels([User, Profile]);

    expect(Object.keys(Profile.associations)).to.deep.eq(['user1', 'user2', 'user3']);
    expect(Profile.associations.user1.associationType).to.eq('BelongsTo');
    expect(Profile.associations.user1.target).to.eq(User);
    expect(Profile.associations.user3.target).to.eq(User);
    expect(Profile.associations.user1.foreignKey).to.eq('userId');
    expect(Profile.modelDefinition.attributes.get('userId')!.references).to.deep.include({
      table: User.table,
      key: 'id',
    });
  });

  // This test is temporarily disabled until we find a solution that works with generics
  // typeTest('errors if the foreign key does not exist on the target model', () => {
  //   class User extends Model<InferAttributes<User>> {}
  //
  //   // eslint-disable-next-line @typescript-eslint/no-unused-vars
  //   class Profile extends Model<InferAttributes<Profile>> {
  //     // @ts-expect-error -- This must error, "usrId" does not exist on "Profile"
  //     @BelongsTo(() => User, 'usrId')
  //     declare user1: Profile;
  //
  //     // @ts-expect-error -- This must error, "usrId" does not exist on "Profile"
  //     @BelongsTo(() => User, { foreignKey: 'usrId' })
  //     declare user2: User;
  //
  //     declare userId: number;
  //   }
  // });

  typeTest('does not error when the model is generic (inheritance)', () => {
    class User extends Model<InferAttributes<User>> {}

    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    class Profile<T extends Profile<T> = Profile<any>> extends Model<InferAttributes<T>> {
      @BelongsTo(() => User, 'userId')
      declare user: Profile;

      declare userId: number;
    }
  });

  it('is inherited', () => {
    class DummyModel extends Model<InferAttributes<DummyModel>> {}

    class BaseUser extends Model<InferAttributes<BaseUser>> {
      @BelongsTo(() => DummyModel, {
        foreignKey: 'dummyId',
        scope: {
          deletedAt: null,
        },
      })
      declare dummy?: NonAttribute<DummyModel>;

      declare dummyId: number;
    }

    class User extends BaseUser {}

    sequelize.addModels([DummyModel, User]);
    // register in two steps to make sure you can register a model without registering its parent (when the parent is abstract)
    sequelize.addModels([BaseUser]);

    expect(Object.keys(User.associations)).to.deep.eq(['dummy']);
  });

  it('throws when inherited and uses the "inverse" option', () => {
    class DummyModel extends Model<InferAttributes<DummyModel>> {}

    class BaseUser extends Model<InferAttributes<BaseUser>> {
      @BelongsTo(() => DummyModel, {
        foreignKey: 'dummyId',
        inverse: {
          as: 'users',
          type: 'hasMany',
        },
      })
      declare dummy?: NonAttribute<DummyModel>;

      declare dummyId: number;
    }

    class User extends BaseUser {}

    expect(() => sequelize.addModels([User, DummyModel])).to.throw(
      /Models that use @BelongsTo associations with the "inverse" option cannot be inherited from/,
    );
  });

  it('throws if the same association is declared twice', () => {
    class DummyModel extends Model<InferAttributes<DummyModel>> {}

    class BaseUser extends Model<InferAttributes<BaseUser>> {
      @BelongsTo(() => DummyModel, 'dummyId')
      declare dummy?: NonAttribute<DummyModel>;

      declare dummyId: number;
    }

    class User extends BaseUser {
      @BelongsTo(() => DummyModel, 'dummyId')
      declare dummy?: NonAttribute<DummyModel>;
    }

    expect(() => sequelize.addModels([User, DummyModel])).to.throw(
      `You have defined two associations with the same name "dummy" on the model "User"`,
    );
  });

  it('throws if the "as" option is used', () => {
    class DummyModel extends Model<InferAttributes<DummyModel>> {}

    expect(() => {
      class User extends Model<InferAttributes<User>> {
        @BelongsTo(() => DummyModel, {
          foreignKey: 'dummyId',
          // @ts-expect-error -- forbidden option
          as: 'dummy',
        })
        declare dummy?: NonAttribute<DummyModel>;

        declare dummyId: number;
      }

      return User;
    }).to.throw(CANNOT_USE_AS_ERROR);
  });
});

describe('@HasOne', () => {
  beforeEach(() => {
    resetSequelizeInstance();
  });

  it('defines a hasOne association', () => {
    class User extends Model<InferAttributes<User>> {
      @HasOne(() => Profile, 'userId')
      declare profile1: Profile;

      @HasOne(() => Profile, { foreignKey: 'userId' })
      declare profile2: Profile;

      // Added in https://github.com/sequelize/sequelize-typescript/pull/1206 to help with circular dependencies.
      @HasOne(seq => seq.models.getOrThrow('Profile'), 'userId')
      declare profile3: Profile;
    }

    class Profile extends Model<InferAttributes<Profile>> {
      declare userId: number;
    }

    sequelize.addModels([User, Profile]);

    expect(Object.keys(User.associations)).to.deep.eq(['profile1', 'profile2', 'profile3']);
    expect(User.associations.profile1.associationType).to.eq('HasOne');
    expect(User.associations.profile1.target).to.eq(Profile);
    expect(User.associations.profile3.target).to.eq(Profile);
    expect(User.associations.profile1.foreignKey).to.eq('userId');
    expect(Profile.modelDefinition.attributes.get('userId')!.references).to.deep.include({
      table: User.table,
      key: 'id',
    });
  });

  typeTest('errors if the foreign key does not exist on the target model', () => {
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    class User extends Model<InferAttributes<User>> {
      // @ts-expect-error -- This must error, "usrId" does not exist on "Profile"
      @HasOne(() => Profile, 'usrId')
      declare profile1: Profile;

      // @ts-expect-error -- This must error, "usrId" does not exist on "Profile"
      @HasOne(() => Profile, { foreignKey: 'usrId' })
      declare profile2: Profile;
    }

    class Profile extends Model<InferAttributes<Profile>> {
      declare userId: number;
    }
  });

  it('throws when inherited', () => {
    class DummyModel extends Model<InferAttributes<DummyModel>> {
      declare dummyId: number;
    }

    class BaseUser extends Model<InferAttributes<BaseUser>> {
      @HasOne(() => DummyModel, 'dummyId')
      declare dummy?: NonAttribute<DummyModel>;
    }

    class User extends BaseUser {}

    expect(() => sequelize.addModels([DummyModel, User])).to.throw(
      CANNOT_INHERIT_ASSOCIATION_ERROR,
    );
  });

  it('throws if the "as" option is used', () => {
    class DummyModel extends Model<InferAttributes<DummyModel>> {
      declare dummyId: number;
    }

    expect(() => {
      class User extends Model<InferAttributes<User>> {
        @HasOne(() => DummyModel, {
          foreignKey: 'dummyId',
          // @ts-expect-error -- forbidden option
          as: 'dummy',
        })
        declare dummy?: NonAttribute<DummyModel>;
      }

      return User;
    }).to.throw(CANNOT_USE_AS_ERROR);
  });
});

describe('@HasMany', () => {
  beforeEach(() => {
    resetSequelizeInstance();
  });

  it('defines a hasMany association', () => {
    class User extends Model<InferAttributes<User>> {
      @HasMany(() => Profile, 'userId')
      declare profile1: Profile;

      @HasMany(() => Profile, { foreignKey: 'userId' })
      declare profile2: Profile;

      // Added in https://github.com/sequelize/sequelize-typescript/pull/1206 to help with circular dependencies.
      @HasMany(seq => seq.models.getOrThrow('Profile'), { foreignKey: 'userId' })
      declare profile3: Profile;
    }

    class Profile extends Model<InferAttributes<Profile>> {
      declare userId: number;
    }

    sequelize.addModels([User, Profile]);

    expect(Object.keys(User.associations)).to.deep.eq(['profile1', 'profile2', 'profile3']);
    expect(User.associations.profile1.associationType).to.eq('HasMany');
    expect(User.associations.profile1.target).to.eq(Profile);
    expect(User.associations.profile3.target).to.eq(Profile);
    expect(User.associations.profile1.foreignKey).to.eq('userId');
    expect(Profile.modelDefinition.attributes.get('userId')!.references).to.deep.include({
      table: User.table,
      key: 'id',
    });
  });

  typeTest('errors if the foreign key does not exist on the target model', () => {
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    class User extends Model<InferAttributes<User>> {
      // @ts-expect-error -- This must error, "usrId" does not exist on "Profile"
      @HasMany(() => Profile, 'usrId')
      declare profile1: Profile;

      // @ts-expect-error -- This must error, "usrId" does not exist on "Profile"
      @HasMany(() => Profile, { foreignKey: 'usrId' })
      declare profile2: Profile;
    }

    class Profile extends Model<InferAttributes<Profile>> {
      declare userId: number;
    }
  });

  it('throws when inherited', () => {
    class DummyModel extends Model<InferAttributes<DummyModel>> {
      declare dummyId: number;
    }

    class BaseUser extends Model<InferAttributes<BaseUser>> {
      @HasMany(() => DummyModel, 'dummyId')
      declare dummies?: NonAttribute<DummyModel[]>;
    }

    class User extends BaseUser {}

    expect(() => sequelize.addModels([DummyModel, User])).to.throw(
      CANNOT_INHERIT_ASSOCIATION_ERROR,
    );
  });

  it('throws if the "as" option is used', () => {
    class DummyModel extends Model<InferAttributes<DummyModel>> {
      declare dummyId: number;
    }

    expect(() => {
      class User extends Model<InferAttributes<User>> {
        @HasMany(() => DummyModel, {
          foreignKey: 'dummyId',
          // @ts-expect-error -- forbidden option
          as: 'dummy',
        })
        declare dummy?: NonAttribute<DummyModel>;
      }

      return User;
    }).to.throw(CANNOT_USE_AS_ERROR);
  });
});

describe('@BelongsToMany', () => {
  beforeEach(() => {
    resetSequelizeInstance();
  });

  it('defines a belongsToMany association', () => {
    class User extends Model<InferAttributes<User>> {
      @BelongsToMany(() => Role, {
        through: 'UserRole',
        inverse: { as: 'users' },
      })
      declare roles: Role[];
    }

    class Role extends Model<InferAttributes<Role>> {}

    sequelize.addModels([User, Role]);

    expect(Object.keys(User.associations)).to.deep.eq(['roles', 'rolesUsers', 'roleUser']);
    expect(Object.keys(Role.associations)).to.deep.eq(['users', 'usersRoles', 'userRole']);

    const userToRole = User.associations.roles;

    assert(userToRole instanceof BelongsToManyAssociation);

    expect(userToRole.associationType).to.eq('BelongsToMany');
    expect(Role.associations.users.associationType).to.eq('BelongsToMany');

    expect(userToRole.target).to.eq(Role);
    expect(userToRole.throughModel).to.eq(sequelize.models.getOrThrow('UserRole'));
  });

  it('supports lazy target & through', () => {
    class UserRole extends Model<InferAttributes<UserRole>> {}

    class User extends Model<InferAttributes<User>> {
      @BelongsToMany(seq => seq.models.getOrThrow('Role'), {
        through: seq => seq.models.getOrThrow('UserRole'),
        inverse: { as: 'users' },
      })
      declare roles: Role[];
    }

    class Role extends Model<InferAttributes<Role>> {}

    sequelize.addModels([User, UserRole, Role]);

    const userToRole = User.associations.roles;
    assert(userToRole instanceof BelongsToManyAssociation);
    expect(userToRole.throughModel).to.eq(UserRole);

    const roleToUser = Role.associations.users;
    assert(roleToUser instanceof BelongsToManyAssociation);
    expect(roleToUser.throughModel).to.eq(UserRole);
  });

  it('throws when inherited', () => {
    class DummyModel extends Model<InferAttributes<DummyModel>> {}

    class BaseUser extends Model<InferAttributes<BaseUser>> {
      @BelongsToMany(() => DummyModel, {
        through: 'DummyUser',
      })
      declare dummies?: NonAttribute<DummyModel[]>;
    }

    class User extends BaseUser {}

    expect(() => sequelize.addModels([DummyModel, User])).to.throw(
      CANNOT_INHERIT_ASSOCIATION_ERROR,
    );
  });

  it('throws if the "as" option is used', () => {
    class Role extends Model<InferAttributes<Role>> {}

    expect(() => {
      class User extends Model<InferAttributes<User>> {
        @BelongsToMany(() => Role, {
          // @ts-expect-error -- forbidden option
          as: 'roles',
          through: 'UserRole',
          inverse: { as: 'users' },
        })
        declare roles: Role[];
      }

      return User;
    }).to.throw(CANNOT_USE_AS_ERROR);
  });
});
