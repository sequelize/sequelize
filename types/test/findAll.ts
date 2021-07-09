import { expectTypeOf } from 'expect-type'
import { Sequelize } from 'sequelize';
import { User } from './models/User';

async () => {
    const users = await User.findAll({ raw: false });
    expectTypeOf(users).toEqualTypeOf<User[]>()

    interface RawUser {
        foo: 'bar';
    }
    const rawUsers = await User.findAll<User, RawUser>({
        attributes: [
            ['bar', 'foo'],
            'ignored',
            [Sequelize.col('table.id'), 'xyz'],
        ],
        raw: true,
    });
    expectTypeOf(rawUsers).toEqualTypeOf<RawUser[]>();

    // @ts-expect-error
    rawUsers[0].id = 123; // not an instance
};
