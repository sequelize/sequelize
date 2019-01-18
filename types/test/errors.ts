// Error === BaseError
import { BaseError, EmptyResultError, Error, UniqueConstraintError } from 'sequelize';
import { User } from './models/User';

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
}
