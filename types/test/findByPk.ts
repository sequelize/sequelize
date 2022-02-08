import { expectTypeOf } from 'expect-type'
import { User } from './models/User';

async () => {
    const user = await User.findByPk(Buffer.from('asdf'));
    expectTypeOf(user).toEqualTypeOf<User | null>()

    const rawUser = await User.findByPk(123, { raw: true });
    expectTypeOf(rawUser).toEqualTypeOf<User['_attributes'] | null>();

    interface CustomUser {
        foo: 'bar';
    }
    const customUser = await User.findByPk<User, CustomUser>(123, {
        attributes: [['bar', 'foo']],
        raw: true,
    });
    expectTypeOf(customUser).toEqualTypeOf<CustomUser | null>();
};
