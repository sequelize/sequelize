import type { Attributes } from '@sequelize/core';
import { TemporalTimeQueryType, cast, col } from '@sequelize/core';
import { expectTypeOf } from 'expect-type';
import { User } from './models/user';

(async () => {
  {
    const users = await User.findAll();
    expectTypeOf(users).toEqualTypeOf<User[]>();
  }

  {
    const users = await User.findAll({ raw: false });
    expectTypeOf(users).toEqualTypeOf<User[]>();
  }

  const rawUsers = await User.findAll({ raw: true });
  expectTypeOf(rawUsers).toEqualTypeOf<Array<Attributes<User>>>();

  const changedUsers = await User.findAll({
    temporalTime: {
      type: 'SYSTEM_TIME',
      period: TemporalTimeQueryType.CONTAINED_IN,
      endDate: new Date(2022, 11, 1),
      startDate: new Date(2022, 0, 1),
    },
  });

  interface CustomUser {
    foo: 'bar';
  }

  const customUsers = await User.findAll<User, CustomUser>({
    attributes: [
      ['bar', 'foo'],
      'firstName',
      [col('table.id'), 'xyz'],
      [cast(col('createdAt'), 'varchar'), 'abc'],
    ],
    raw: true,
  });
  expectTypeOf(customUsers).toEqualTypeOf<CustomUser[]>();

  // @ts-expect-error -- this should error, if this doesn't error, there is a bug!
  customUsers[0].id = 123; // not an instance
})();
