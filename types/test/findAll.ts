import { expectTypeOf } from 'expect-type'
import Sequelize, { Op } from 'sequelize';
import { User } from './models/User';

async () => {
    const users = await User.findAll({ raw: false });
    expectTypeOf(users).toEqualTypeOf<User[]>()

    await User.findAll({
      order: [
        ['id', 'DESC'],
        ['AssociatedModel', User, 'id', 'DESC'],
        ['AssociatedModel', User, Sequelize.col('MyModel.id')],
        [User, 'id'],
        'id',
        Sequelize.col('id'),
        Sequelize.fn('FN'),
        Sequelize.literal('<literal>'),
        Sequelize.where(Sequelize.col('id'), Op.eq, '<id>'),
        [Sequelize.col('id'), 'ASC'],
        [Sequelize.fn('FN'), 'DESC NULLS LAST'],
        [Sequelize.literal('<literal>'), 'NULLS FIRST'],
        [Sequelize.where(Sequelize.col('id'), Op.eq, '<id>'), 'DESC'],
      ],
    });

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
