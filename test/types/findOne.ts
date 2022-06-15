import { expectTypeOf } from 'expect-type';
import { Attributes, FindOptions } from '@sequelize/core';
import { User } from './models/User';

// These attributes exist
User.findOne({ where: { firstName: 'John' } });
User.findOne({ where: { '$firstName$': 'John' } });

// These attributes do not exist
// @ts-expect-error
User.findOne({ where: { blah: 'blah2' } });
// @ts-expect-error
User.findOne({ where: { '$blah$': 'blah2' } });

// $nested.syntax$ is valid
// TODO [2022-05-26]: Remove this ts-ignore once we drop support for TS < 4.4
// TypeScript < 4.4 does not support using a Template Literal Type as a key.
//  note: this *must* be a ts-ignore, as it works in ts >= 4.4
// @ts-ignore
User.findOne({ where: { '$include1.includeAttr$': 'blah2' } });
// $nested.nested.syntax$ is valid
// TODO [2022-05-26]: Remove this ts-ignore once we drop support for TS < 4.4
// TypeScript < 4.4 does not support using a Template Literal Type as a key.
//  note: this *must* be a ts-ignore, as it works in ts >= 4.4
// @ts-ignore
User.findOne({ where: { '$include1.$include2.includeAttr$': 'blah2' } });

(async () => {
  expectTypeOf(await User.findOne()).toEqualTypeOf<User | null>();

  // rejectOnEmpty

  expectTypeOf(await User.findOne({
    rejectOnEmpty: undefined
  })).toEqualTypeOf<User | null>();

  expectTypeOf(await User.findOne({
    rejectOnEmpty: false
  })).toEqualTypeOf<User | null>();

  expectTypeOf(await User.findOne({
    rejectOnEmpty: true
  })).toEqualTypeOf<User>();

  expectTypeOf(await User.findOne({
    rejectOnEmpty: new Error('')
  })).toEqualTypeOf<User>();

  // raw

  expectTypeOf(await User.findOne({
    raw: true,
  })).toEqualTypeOf<Attributes<User> | null>();

  expectTypeOf(await User.findOne({
    raw: false,
  })).toEqualTypeOf<User | null>();

  expectTypeOf(await User.findOne({
    raw: undefined,
  })).toEqualTypeOf<User | null>();

  // combination

  expectTypeOf(await User.findOne({
    raw: false,
    rejectOnEmpty: false
  })).toEqualTypeOf<User | null>();

  expectTypeOf(await User.findOne({
    raw: false,
    rejectOnEmpty: true
  })).toEqualTypeOf<User>();

  expectTypeOf(await User.findOne({
    raw: true,
    rejectOnEmpty: false,
  })).toEqualTypeOf<Attributes<User> | null>();

  expectTypeOf(await User.findOne({
    raw: true,
    rejectOnEmpty: true,
  })).toEqualTypeOf<Attributes<User>>();

  // custom parameter

  interface CustomUser {
    foo: 'bar';
  }

  expectTypeOf(await User.findOne<User, CustomUser>({
    raw: true,
  })).toEqualTypeOf<CustomUser | null>();

  expectTypeOf(await User.findOne<User, CustomUser>({
    attributes: [['bar', 'foo']],
    rejectOnEmpty: false,
    raw: true,
  })).toEqualTypeOf<CustomUser | null>();

  expectTypeOf(await User.findOne<User, CustomUser>({
    attributes: [['bar', 'foo']],
    rejectOnEmpty: true,
    raw: true,
  })).toEqualTypeOf<CustomUser>();

  async function passDown(params: FindOptions<User>) {
    // Unknown ahead of time
    // We can't what 'rejectOnEmpty' and 'raw' are set to, so we default to these types:
    expectTypeOf(await User.findOne(params))
      .toEqualTypeOf<User | null>();
  }
})();
