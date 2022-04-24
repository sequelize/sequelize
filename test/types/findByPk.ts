import { expectTypeOf } from 'expect-type'
import { Attributes } from '@sequelize/core';
import { User } from './models/User';

(async () => {
  expectTypeOf(await User.findByPk(Buffer.from('asdf'))).toEqualTypeOf<User | null>();

  expectTypeOf(await User.findByPk(Buffer.from('asdf'), {
    rejectOnEmpty: undefined
  })).toEqualTypeOf<User | null>();

  expectTypeOf(await User.findByPk(Buffer.from('asdf'), {
    rejectOnEmpty: false
  })).toEqualTypeOf<User | null>();

  expectTypeOf(await User.findByPk(Buffer.from('asdf'), {
    raw: false,
    rejectOnEmpty: false
  })).toEqualTypeOf<User | null>();

  expectTypeOf(await User.findByPk(Buffer.from('asdf'), {
    rejectOnEmpty: true
  })).toEqualTypeOf<User>();

  expectTypeOf(await User.findByPk(Buffer.from('asdf'), {
    rejectOnEmpty: new Error('')
  })).toEqualTypeOf<User>();

  expectTypeOf(await User.findByPk(Buffer.from('asdf'), {
    raw: false,
    rejectOnEmpty: new Error('')
  })).toEqualTypeOf<User>();

  expectTypeOf(await User.findByPk(Buffer.from('asdf'), {
    raw: true,
  })).toEqualTypeOf<Attributes<User> | null>();

  expectTypeOf(await User.findByPk(Buffer.from('asdf'), {
    raw: true,
    rejectOnEmpty: true,
  })).toEqualTypeOf<Attributes<User>>();

  interface CustomUser {
    foo: 'bar';
  }

  expectTypeOf(await User.findByPk<User, CustomUser>(Buffer.from('asdf'), {
    raw: true,
  })).toEqualTypeOf<CustomUser | null>();

  expectTypeOf(await User.findByPk<User, CustomUser>(Buffer.from('asdf'), {
    attributes: [['bar', 'foo']],
    rejectOnEmpty: false,
    raw: true,
  })).toEqualTypeOf<CustomUser | null>();

  expectTypeOf(await User.findByPk<User, CustomUser>(Buffer.from('asdf'), {
    attributes: [['bar', 'foo']],
    rejectOnEmpty: true,
    raw: true,
  })).toEqualTypeOf<CustomUser>();
})();
