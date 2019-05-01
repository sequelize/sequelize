import { Deferrable, Sequelize, Transaction } from 'sequelize';
import { User } from './models/User';

export const sequelize = new Sequelize('uri');

async function trans() {
    const a: number = await sequelize.transaction(async transaction => {
        transaction.addHook('afterCommit', () => console.log('transaction complete'));
        User.create(
            {
                data: 123,
            },
            {
                transaction,
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
