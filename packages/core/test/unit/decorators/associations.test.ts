import assert from 'node:assert';
import { expect } from 'chai';
import { Model, BelongsToMany as BelongsToManyAssociation } from '@sequelize/core';
import type { InferAttributes } from '@sequelize/core';
import { HasOne, BelongsTo, HasMany, BelongsToMany } from '@sequelize/core/decorators-legacy';
import { sequelize, typeTest } from '../../support';

describe('@BelongsTo', () => {
  it('defines a belongsTo association', () => {
    class User extends Model<InferAttributes<User>> {}

    class Profile extends Model<InferAttributes<Profile>> {
      @BelongsTo(() => User, 'userId')
      declare user1: Profile;

      @BelongsTo(() => User, { foreignKey: 'userId' })
      declare user2: User;

      // Added in https://github.com/sequelize/sequelize-typescript/pull/1206 to help with circular dependencies.
      @BelongsTo(seq => seq.model('User'), 'userId')
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

  typeTest('errors if the foreign key does not exist on the target model', () => {
    class User extends Model<InferAttributes<User>> {}

    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    class Profile extends Model<InferAttributes<Profile>> {
      // @ts-expect-error -- This must error, "usrId" does not exist on "Profile"
      @BelongsTo(() => User, 'usrId')
      declare user1: Profile;

      // @ts-expect-error -- This must error, "usrId" does not exist on "Profile"
      @BelongsTo(() => User, { foreignKey: 'usrId' })
      declare user2: User;

      declare userId: number;
    }
  });
});

describe('@HasOne', () => {
  it('defines a hasOne association', () => {
    class User extends Model<InferAttributes<User>> {
      @HasOne(() => Profile, 'userId')
      declare profile1: Profile;

      @HasOne(() => Profile, { foreignKey: 'userId' })
      declare profile2: Profile;

      // Added in https://github.com/sequelize/sequelize-typescript/pull/1206 to help with circular dependencies.
      @HasOne(seq => seq.model('Profile'), 'userId')
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
});

describe('@HasMany', () => {
  it('defines a hasMany association', () => {
    class User extends Model<InferAttributes<User>> {
      @HasMany(() => Profile, 'userId')
      declare profile1: Profile;

      @HasMany(() => Profile, { foreignKey: 'userId' })
      declare profile2: Profile;

      // Added in https://github.com/sequelize/sequelize-typescript/pull/1206 to help with circular dependencies.
      @HasMany(seq => seq.model('Profile'), { foreignKey: 'userId' })
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
});

describe('@BelongsToMany', () => {
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
    expect(userToRole.throughModel).to.eq(sequelize.model('UserRole'));
  });

  it('supports lazy target & through', () => {
    class UserRole extends Model<InferAttributes<UserRole>> {}

    class User extends Model<InferAttributes<User>> {
      @BelongsToMany(seq => seq.model('Role'), {
        through: seq => seq.model('UserRole'),
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
});
