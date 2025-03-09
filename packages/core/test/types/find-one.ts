import type { Attributes, FindOptions } from '@sequelize/core';
import { expectTypeOf } from 'expect-type';
import { User } from './models/user';

// These attributes exist
User.findOne({ where: { firstName: 'John' } });
User.findOne({ where: { $firstName$: 'John' } });

// These attributes do not exist
// @ts-expect-error -- this should error, if this doesn't error, findOne has a bug!
User.findOne({ where: { blah: 'blah2' } });
// @ts-expect-error -- this should error, if this doesn't error, findOne has a bug!
User.findOne({ where: { $blah$: 'blah2' } });

// $nested.syntax$ is valid
User.findOne({ where: { '$include1.includeAttr$': 'blah2' } });
// $nested.nested.syntax$ is valid
User.findOne({ where: { '$include1.$include2.includeAttr$': 'blah2' } });

(async () => {
  expectTypeOf(await User.findOne()).toEqualTypeOf<User | null>();

  // rejectOnEmpty

  expectTypeOf(
    await User.findOne({
      rejectOnEmpty: undefined,
    }),
  ).toEqualTypeOf<User | null>();

  expectTypeOf(
    await User.findOne({
      rejectOnEmpty: false,
    }),
  ).toEqualTypeOf<User | null>();

  expectTypeOf(
    await User.findOne({
      rejectOnEmpty: true,
    }),
  ).toEqualTypeOf<User>();

  expectTypeOf(
    await User.findOne({
      rejectOnEmpty: new Error('error'),
    }),
  ).toEqualTypeOf<User>();

  // raw

  expectTypeOf(
    await User.findOne({
      raw: true,
    }),
  ).toEqualTypeOf<Attributes<User> | null>();

  expectTypeOf(
    await User.findOne({
      raw: false,
    }),
  ).toEqualTypeOf<User | null>();

  expectTypeOf(
    await User.findOne({
      raw: undefined,
    }),
  ).toEqualTypeOf<User | null>();

  // combination

  expectTypeOf(
    await User.findOne({
      raw: false,
      rejectOnEmpty: false,
    }),
  ).toEqualTypeOf<User | null>();

  expectTypeOf(
    await User.findOne({
      raw: false,
      rejectOnEmpty: true,
    }),
  ).toEqualTypeOf<User>();

  expectTypeOf(
    await User.findOne({
      raw: false,
      rejectOnEmpty: undefined,
    }),
  ).toEqualTypeOf<User | null>();

  expectTypeOf(
    await User.findOne({
      raw: true,
      rejectOnEmpty: false,
    }),
  ).toEqualTypeOf<Attributes<User> | null>();

  expectTypeOf(
    await User.findOne({
      raw: true,
      rejectOnEmpty: true,
    }),
  ).toEqualTypeOf<Attributes<User>>();

  expectTypeOf(
    await User.findOne({
      raw: true,
      rejectOnEmpty: undefined,
    }),
  ).toEqualTypeOf<Attributes<User> | null>();

  expectTypeOf(
    await User.findOne({
      raw: undefined,
      rejectOnEmpty: false,
    }),
  ).toEqualTypeOf<User | null>();

  expectTypeOf(
    await User.findOne({
      raw: undefined,
      rejectOnEmpty: true,
    }),
  ).toEqualTypeOf<User>();

  expectTypeOf(
    await User.findOne({
      raw: undefined,
      rejectOnEmpty: undefined,
    }),
  ).toEqualTypeOf<User | null>();

  // custom parameter

  interface CustomUser {
    foo: 'bar';
  }

  expectTypeOf(
    await User.findOne<User, CustomUser>({
      raw: true,
    }),
  ).toEqualTypeOf<CustomUser | null>();

  expectTypeOf(
    await User.findOne<User, CustomUser>({
      attributes: [['bar', 'foo']],
      rejectOnEmpty: false,
      raw: true,
    }),
  ).toEqualTypeOf<CustomUser | null>();

  expectTypeOf(
    await User.findOne<User, CustomUser>({
      attributes: [['bar', 'foo']],
      rejectOnEmpty: true,
      raw: true,
    }),
  ).toEqualTypeOf<CustomUser>();

  async function passDown(params: FindOptions<Attributes<User>>) {
    // Unknown ahead of time
    // We can't what 'rejectOnEmpty' and 'raw' are set to, so we default to these types:
    expectTypeOf(await User.findOne(params)).toEqualTypeOf<User | null>();
  }
})();
