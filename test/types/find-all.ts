import type { Attributes } from '@sequelize/core';
import { col } from '@sequelize/core';
import { expectTypeOf } from 'expect-type';
import { User } from './models/user';

(async () => {
  const users = await User.findAll({ raw: false });
  expectTypeOf(users).toEqualTypeOf<User[]>();

  const rawUsers = await User.findAll({ raw: true });
  expectTypeOf(rawUsers).toEqualTypeOf<Array<Attributes<User>>>();

  interface CustomUser {
    foo: 'bar';
  }

  const customUsers = await User.findAll<User, CustomUser>({
    attributes: [
      ['bar', 'foo'],
      'ignored',
      [col('table.id'), 'xyz'],
    ],
    raw: true,
  });
  expectTypeOf(customUsers).toEqualTypeOf<CustomUser[]>();

  // @ts-expect-error
  customUsers[0].id = 123; // not an instance
})();
