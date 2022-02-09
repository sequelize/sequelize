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
