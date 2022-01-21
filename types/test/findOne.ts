import { User } from './models/User';

User.findOne({ where: { firstName: 'John' } });

// @ts-expect-error
User.findOne({ where: { blah: 'blah2' } });

User.findOne({
  where: {
    firstName: 'John',
    // reference to `include`
    '$blah.test$': 'blah2',
  },
});
