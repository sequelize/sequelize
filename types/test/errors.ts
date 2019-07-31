// Error === BaseError
import { BaseError, EmptyResultError, Error, UniqueConstraintError } from 'sequelize';
import { User } from './models/User';
import { OptimisticLockError } from '../lib/errors';

async function test() {
    try {
        await User.create({ username: 'john_doe' });
    } catch (e) {
        if (e instanceof UniqueConstraintError) {
            console.error((e as UniqueConstraintError).sql);
        }
    }

    try {
        await User.findOne({
            rejectOnEmpty: true,
            where: {
                username: 'something_that_doesnt_exist',
            },
        });
    } catch (e) {
        if (!(e instanceof EmptyResultError)) {
            console.error('should return emptyresulterror');
        }
    }

    try {
        const user: User | null = await User.findByPk(1);
        if (user != null) {
            user.username = 'foo';
            user.save();
        }
    } catch (e) {
        if (!(e instanceof OptimisticLockError)) {
            console.log('should return OptimisticLockError');
        }
    }
}
