import { expectTypeOf } from 'expect-type'
import { User } from './models/User';
import { Model } from 'sequelize';
import { UserGroup } from './models/UserGroup.js';

(async () => {
    const user = await User.create({
        id: 123,
        firstName: '<first-name>',
    }, {
        ignoreDuplicates: false,
        returning: true,
    });
    expectTypeOf(user).toEqualTypeOf<User>()

    const voidUsers = await Promise.all([
        User.create({
            id: 123,
            firstName: '<first-name>',
        }, {
            ignoreDuplicates: true,
            returning: false,
        }),
        User.create({
            id: 123,
            firstName: '<first-name>',
        }, {
            ignoreDuplicates: true,
            returning: true,
        }),
        User.create({
            id: 123,
            firstName: '<first-name>',
        }, {
            ignoreDuplicates: false,
            returning: false,
        }),
        User.create({
            id: 123,
            firstName: '<first-name>',
        }, { returning: false }),
        User.create({
            id: 123,
            firstName: '<first-name>',
        }, { ignoreDuplicates: true }),
    ]);
    expectTypeOf(voidUsers).toEqualTypeOf<[void, void, void, void, void]>()

    const emptyUsers = await Promise.all([
        User.create(),
        User.create(undefined),
        User.create(undefined, undefined),
    ]);
    expectTypeOf(emptyUsers).toEqualTypeOf<[User, User, User]>()

    const partialUser = await User.create({
        id: 123,
        firstName: '<first-name>',
        lastName: '<last-name>',
    }, {
        fields: ['firstName'],
        returning: ['id'],
    });
    expectTypeOf(partialUser).toEqualTypeOf<User>()

    // @ts-expect-error missing attribute
    await User.create({
        id: 123,
    });
    await User.create({
        id: 123,
        firstName: '<first-name>',
        // @ts-expect-error unknown attribute
        unknown: '<unknown>',
    });
})();

// reasons for this test: https://github.com/sequelize/sequelize/issues/14129
(async () => {
  interface User2Attributes {
    groupId: number;
  }

  type User2CreationAttributes = { id: number } & (
    | { groupId: number }
    | { group: { id: number } }
  );

  class User2 extends Model<User2Attributes, User2CreationAttributes> {
    declare groupId: number;
    declare group?: UserGroup;
  }

  await User2.create({
    id: 1,
    groupId: 1,
  });

  await User2.create({
    id: 2,
    group: { id: 1 },
  }, { include: [User2.associations.group] });
})();
