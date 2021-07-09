import { expectTypeOf } from 'expect-type'
import { User } from './models/User';

async () => {
    const user = await User.findByPk(Buffer.from('asdf'));
    expectTypeOf(user).toEqualTypeOf<User | null>()

    interface RawUser {
        foo: 'bar';
    }
    const rawUser = await User.findByPk<User, RawUser>(123, {
        attributes: [['bar', 'foo']],
        raw: true,
    });
    expectTypeOf(rawUser).toEqualTypeOf<RawUser | null>();
};
