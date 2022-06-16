import { expectTypeOf } from 'expect-type';
import { User } from './models/User';

(async () => {
  expectTypeOf(await User.findByPk(Buffer.from('asdf'))).toEqualTypeOf<User | null>();

  expectTypeOf(await User.findByPk(Buffer.from('asdf'), {
    rejectOnEmpty: undefined,
  })).toEqualTypeOf<User | null>();

  expectTypeOf(await User.findByPk(Buffer.from('asdf'), {
    rejectOnEmpty: false,
  })).toEqualTypeOf<User | null>();

  expectTypeOf(await User.findByPk(Buffer.from('asdf'), {
    rejectOnEmpty: true,
  })).toEqualTypeOf<User>();

  expectTypeOf(await User.findByPk(Buffer.from('asdf'), {
    rejectOnEmpty: new Error('An error!'),
  })).toEqualTypeOf<User>();
})();
