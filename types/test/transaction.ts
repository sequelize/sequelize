import { Deferrable, Sequelize, Transaction } from 'sequelize';
import { User } from './models/User';

export const sequelize = new Sequelize('uri');

async function trans() {
    const a: number = await sequelize.transaction(async transaction => {
        transaction.afterCommit(() => console.log('transaction complete'));
        User.create(
            {
                firstName: 'John',
            },
            {
                transaction,
            }
        );
        return 1;
    });
}

async function trans2() {
    return await sequelize.transaction(async transaction => {
        transaction.afterCommit(() => console.log('transaction complete'));
        User.findAll(
            {
                transaction,
                lock: transaction.LOCK.UPDATE,
            }
        );
        return 1;
    });
}

async function trans3() {
    return await sequelize.transaction(async transaction => {
        transaction.afterCommit(() => console.log('transaction complete'));
        User.findAll(
            {
                transaction,
                lock: true,
            }
        );
        return 1;
    });
}

async function trans4() {
    return await sequelize.transaction(async transaction => {
        transaction.afterCommit(() => console.log('transaction complete'));
        User.findAll(
            {
                transaction,
                lock: {
                    level: transaction.LOCK.UPDATE,
                    of: User,
                },
            }
        );
        return 1;
    });
}

async function transact() {
    const t = await sequelize.transaction({
        deferrable: Deferrable.SET_DEFERRED(['test']),
        isolationLevel: Transaction.ISOLATION_LEVELS.READ_COMMITTED,
        type: Transaction.TYPES.DEFERRED,
    });
    await t.commit();
    await t.rollback();
}

transact();

async function nestedTransact() {
  const tr = await sequelize.transaction({
    transaction: await sequelize.transaction(),
  });
  await tr.commit();
}

async function excludeFromTransaction() {
  await sequelize.transaction(async t =>
    await sequelize.query('SELECT 1', { transaction: null })
  );
}
