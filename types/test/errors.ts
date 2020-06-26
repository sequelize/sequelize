// Error === BaseError
import { BaseError, EmptyResultError, Error, UniqueConstraintError } from 'sequelize';
import { User } from './models/User';
import { OptimisticLockError } from '../lib/errors';

async function test() {
  try {
    await User.create({ username: 'john_doe', firstName: 'John' });
  } catch (e) {
    if (e instanceof UniqueConstraintError) {
      throw new Error((e as UniqueConstraintError).sql);
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
      throw new Error('should return emptyresulterror');
    }
  }


  class CustomError extends Error {}

  try {
    await User.findOne({
      rejectOnEmpty: new CustomError('User does not exist'),
        where: {
          username: 'something_that_doesnt_exist',
        },
      });
  } catch (e) {
    if (!(e instanceof CustomError)) {
      throw new Error('should return CustomError');
    }
    if (e.message !== 'User does not exist') {
      throw new Error('should return CustomError with the proper message')
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
      throw new Error('should return OptimisticLockError');
    }
  }
}
