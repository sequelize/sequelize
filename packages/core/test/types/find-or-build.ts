import { expectTypeOf } from 'expect-type';
import { User } from './models/user';

User.findOrBuild({
  where: { firstName: 'Jonh' },
  // `defaults` shouldn't require all fields
  defaults: {
    lastName: 'Smith',
  },
});

User.findOrBuild({
  // These attributes do not exist
  // @ts-expect-error -- this should error, if this doesn't error, findOrBuild has a bug!
  where: { blah: 'blah2' },
  defaults: {
    firstName: 'Jonh',
  },
});

User.findOrBuild({
  where: {
    firstName: 'Jonh',
  },
  defaults: {
    // These attributes do not exist
    // @ts-expect-error -- this should error, if this doesn't error, findOrBuild has a bug!
    blah: 'Jonh 2',
  },
});

(async () => {
  expectTypeOf(
    await User.findOrBuild({ where: { firstName: 'John' } }),
  ).toEqualTypeOf<[User, boolean]>();
})();
