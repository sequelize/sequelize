import { expectTypeOf } from 'expect-type';
import { User } from './models/user';

(async () => {
  const user = await User.create({
    id: 123,
    firstName: '<first-name>',
  }, {
    ignoreDuplicates: false,
    returning: true,
  });
  expectTypeOf(user).toEqualTypeOf<User>();

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

  // eslint-disable-next-line @typescript-eslint/no-invalid-void-type -- False positive :/
  expectTypeOf(voidUsers).toEqualTypeOf<[void, void, void, void, void]>();

  const emptyUsers = await Promise.all([
    User.create(),
    User.create(),
    User.create(),
  ]);
  expectTypeOf(emptyUsers).toEqualTypeOf<[User, User, User]>();

  const partialUser = await User.create({
    id: 123,
    firstName: '<first-name>',
    lastName: '<last-name>',
  }, {
    fields: ['firstName'],
    returning: ['id'],
  });
  expectTypeOf(partialUser).toEqualTypeOf<User>();

  // @ts-expect-error -- missing attribute
  await User.create({
    id: 123,
  });
  await User.create({
    id: 123,
    firstName: '<first-name>',
    // @ts-expect-error -- unknown attribute
    unknown: '<unknown>',
  });
})();
