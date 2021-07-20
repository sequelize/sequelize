import { User } from "./models/User";

User.findOne({ where: { firstName: 'John' } });

// @ts-expect-error
User.findOne({ where: { blah: 'blah2' } });
