import { User } from './models/User';

User.findOne({ where: { firstName: 'John' } });

// @ts-expect-error
User.findOne({ where: { blah: 'blah2' } });

User.findOne({
  where: {
    firstName: 'John',
    // reference to `include`
    // TODO [2022-05-26]: Remove this ts-ignore once we drop support for TS < 4.4
    // TypeScript < 4.4 does not support using a Template Literal Type as a key.
    //  note: this *must* be a ts-ignore, as it works in ts >= 4.4
    // @ts-ignore
    '$blah.test$': 'blah2',
  },
});
