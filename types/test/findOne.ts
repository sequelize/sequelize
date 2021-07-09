import { expectTypeOf } from 'expect-type'
import { User } from "./models/User";

async () => {
    const user = await User.findOne({ where: { firstName: 'John' } });
    expectTypeOf(user).toEqualTypeOf<User | null>()

    // @ts-expect-error blah is not an attribute of User
    User.findOne({ where: { blah: 'blah2' } });

    const rawUser = await User.findOne({
        where: { firstName: 'John' },
        raw: true,
        rejectOnEmpty: true,
    });
    expectTypeOf(rawUser).toEqualTypeOf<User['_attributes']>()
};
