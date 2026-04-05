import { ConstraintChecking, Sequelize, Transaction } from '@sequelize/core';
import { MySqlDialect } from '@sequelize/mysql';
import { User } from './models/user';

export const sequelize = new Sequelize({ dialect: MySqlDialect });

async function trans() {
  const a: number = await sequelize.transaction(async transaction => {
    transaction.afterCommit(() => console.debug('transaction complete'));
    User.create(
      {
        firstName: 'John',
      },
      {
        transaction,
      },
    );

    return 1;
  });
}

async function trans2() {
  return sequelize.transaction(async transaction => {
    transaction.afterCommit(() => console.debug('transaction complete'));
    User.findAll({
      transaction,
      lock: transaction.LOCK.UPDATE,
    });

    return 1;
  });
}

async function trans3() {
  return sequelize.transaction(async transaction => {
    transaction.afterCommit(() => console.debug('transaction complete'));
    User.findAll({
      transaction,
      lock: true,
    });

    return 1;
  });
}

async function trans4() {
  return sequelize.transaction(async transaction => {
    transaction.afterCommit(() => console.debug('transaction complete'));
    User.findAll({
      transaction,
      lock: {
        level: transaction.LOCK.UPDATE,
        of: User,
      },
    });

    return 1;
  });
}

async function transact() {
  const t = await sequelize.startUnmanagedTransaction({
    constraintChecking: ConstraintChecking.DEFERRED(['test']),
    isolationLevel: Transaction.ISOLATION_LEVELS.READ_COMMITTED,
    type: Transaction.TYPES.DEFERRED,
  });
  await t.commit();
  await t.rollback();
}

transact();

async function nestedTransact() {
  const tr = await sequelize.startUnmanagedTransaction({
    transaction: await sequelize.startUnmanagedTransaction(),
  });
  await tr.commit();
}

async function excludeFromTransaction() {
  await sequelize.transaction(async t => sequelize.query('SELECT 1', { transaction: null }));
}
