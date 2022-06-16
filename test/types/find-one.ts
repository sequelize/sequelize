import { User } from './models/User';

// These attributes exist
User.findOne({ where: { firstName: 'John' } });
User.findOne({ where: { $firstName$: 'John' } });

// These attributes do not exist
// @ts-expect-error
User.findOne({ where: { blah: 'blah2' } });
// @ts-expect-error
User.findOne({ where: { $blah$: 'blah2' } });

// $nested.syntax$ is valid
User.findOne({ where: { '$include1.includeAttr$': 'blah2' } });
// $nested.nested.syntax$ is valid
User.findOne({ where: { '$include1.$include2.includeAttr$': 'blah2' } });
