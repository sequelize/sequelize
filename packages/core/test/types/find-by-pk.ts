import type { Attributes, FindByPkOptions } from '@sequelize/core';
import { expectTypeOf } from 'expect-type';
import { User } from './models/user';

(async () => {
  expectTypeOf(await User.findByPk(Buffer.from('asdf'))).toEqualTypeOf<User | null>();

  // rejectOnEmpty

  expectTypeOf(
    await User.findByPk(Buffer.from('asdf'), {
      rejectOnEmpty: undefined,
    }),
  ).toEqualTypeOf<User | null>();

  expectTypeOf(
    await User.findByPk(Buffer.from('asdf'), {
      rejectOnEmpty: false,
    }),
  ).toEqualTypeOf<User | null>();

  expectTypeOf(
    await User.findByPk(Buffer.from('asdf'), {
      rejectOnEmpty: true,
    }),
  ).toEqualTypeOf<User>();

  expectTypeOf(
    await User.findByPk(Buffer.from('asdf'), {
      rejectOnEmpty: new Error('error'),
    }),
  ).toEqualTypeOf<User>();

  // raw

  expectTypeOf(
    await User.findByPk(Buffer.from('asdf'), {
      raw: true,
    }),
  ).toEqualTypeOf<Attributes<User> | null>();

  expectTypeOf(
    await User.findByPk(Buffer.from('asdf'), {
      raw: false,
    }),
  ).toEqualTypeOf<User | null>();

  expectTypeOf(
    await User.findByPk(Buffer.from('asdf'), {
      raw: undefined,
    }),
  ).toEqualTypeOf<User | null>();

  // combination

  expectTypeOf(
    await User.findByPk(Buffer.from('asdf'), {
      raw: false,
      rejectOnEmpty: false,
    }),
  ).toEqualTypeOf<User | null>();

  expectTypeOf(
    await User.findByPk(Buffer.from('asdf'), {
      raw: false,
      rejectOnEmpty: true,
    }),
  ).toEqualTypeOf<User>();

  expectTypeOf(
    await User.findByPk(Buffer.from('asdf'), {
      raw: false,
      rejectOnEmpty: undefined,
    }),
  ).toEqualTypeOf<User | null>();

  expectTypeOf(
    await User.findByPk(Buffer.from('asdf'), {
      raw: true,
      rejectOnEmpty: false,
    }),
  ).toEqualTypeOf<Attributes<User> | null>();

  expectTypeOf(
    await User.findByPk(Buffer.from('asdf'), {
      raw: true,
      rejectOnEmpty: true,
    }),
  ).toEqualTypeOf<Attributes<User>>();

  expectTypeOf(
    await User.findByPk(Buffer.from('asdf'), {
      raw: true,
      rejectOnEmpty: undefined,
    }),
  ).toEqualTypeOf<Attributes<User> | null>();

  expectTypeOf(
    await User.findByPk(Buffer.from('asdf'), {
      raw: undefined,
      rejectOnEmpty: false,
    }),
  ).toEqualTypeOf<User | null>();

  expectTypeOf(
    await User.findByPk(Buffer.from('asdf'), {
      raw: undefined,
      rejectOnEmpty: true,
    }),
  ).toEqualTypeOf<User>();

  expectTypeOf(
    await User.findByPk(Buffer.from('asdf'), {
      raw: undefined,
      rejectOnEmpty: undefined,
    }),
  ).toEqualTypeOf<User | null>();

  // custom parameter

  interface CustomUser {
    foo: 'bar';
  }

  expectTypeOf(
    await User.findByPk<User, CustomUser>(Buffer.from('asdf'), {
      raw: true,
    }),
  ).toEqualTypeOf<CustomUser | null>();

  expectTypeOf(
    await User.findByPk<User, CustomUser>(Buffer.from('asdf'), {
      attributes: [['bar', 'foo']],
      rejectOnEmpty: false,
      raw: true,
    }),
  ).toEqualTypeOf<CustomUser | null>();

  expectTypeOf(
    await User.findByPk<User, CustomUser>(Buffer.from('asdf'), {
      attributes: [['bar', 'foo']],
      rejectOnEmpty: true,
      raw: true,
    }),
  ).toEqualTypeOf<CustomUser>();

  async function passDown(params: FindByPkOptions<User>) {
    // Unknown ahead of time
    // We can't what 'rejectOnEmpty' and 'raw' are set to, so we default to these types:
    expectTypeOf(await User.findByPk(Buffer.from('asdf'), params)).toEqualTypeOf<User | null>();
  }
})();
