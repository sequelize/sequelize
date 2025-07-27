import type { InferAttributes, InferCreationAttributes, ModelStatic } from '@sequelize/core';
import { DataTypes, Model, QueryTypes } from '@sequelize/core';
import type { ModelHooks } from '@sequelize/core/_non-semver-use-at-your-own-risk_/model-hooks.js';
import { expect } from 'chai';
import delay from 'delay';
import sinon from 'sinon';
import {
  beforeAll2,
  createMultiTransactionalTestSequelizeInstance,
  sequelize,
  setResetMode,
} from './support';

describe('AsyncLocalStorage (ContinuationLocalStorage) Transactions (CLS)', () => {
  if (!sequelize.dialect.supports.transactions) {
    return;
  }

  setResetMode('none');

  const vars = beforeAll2(async () => {
    const clsSequelize = await createMultiTransactionalTestSequelizeInstance(sequelize, {
      disableClsTransactions: false,
    });

    class User extends Model<InferAttributes<User>, InferCreationAttributes<User>> {
      declare name: string | null;
    }

    User.init(
      {
        name: DataTypes.STRING,
      },
      { sequelize: clsSequelize },
    );
    await clsSequelize.sync({ force: true });

    return { clsSequelize, User };
  });

  after(async () => {
    return vars.clsSequelize.close();
  });

  describe('context', () => {
    it('does not use AsyncLocalStorage on manually managed transactions', async () => {
      const transaction = await vars.clsSequelize.startUnmanagedTransaction();

      try {
        expect(vars.clsSequelize.getCurrentClsTransaction()).to.equal(undefined);
      } finally {
        await transaction.rollback();
      }
    });

    // other tests for nested transaction are in sequelize/transaction.test.ts.
    it('supports nested transactions', async () => {
      await vars.clsSequelize.transaction(async () => {
        const transactionA = vars.clsSequelize.getCurrentClsTransaction();

        await vars.clsSequelize.transaction(async () => {
          const transactionB = vars.clsSequelize.getCurrentClsTransaction();

          expect(transactionA === transactionB).to.equal(true, 'transactions should be the same');
        });
      });
    });

    it('supports several concurrent transactions', async () => {
      let t1id;
      let t2id;
      await Promise.all([
        vars.clsSequelize.transaction(async () => {
          t1id = vars.clsSequelize.getCurrentClsTransaction()!.id;
        }),
        vars.clsSequelize.transaction(async () => {
          t2id = vars.clsSequelize.getCurrentClsTransaction()!.id;
        }),
      ]);
      expect(t1id).to.be.ok;
      expect(t2id).to.be.ok;
      expect(t1id).not.to.equal(t2id);
    });

    it('supports nested promise chains', async () => {
      await vars.clsSequelize.transaction(async () => {
        const tid = vars.clsSequelize.getCurrentClsTransaction()!.id;

        await vars.User.findAll();

        expect(vars.clsSequelize.getCurrentClsTransaction()!.id).to.be.ok;
        expect(vars.clsSequelize.getCurrentClsTransaction()!.id).to.equal(tid);
      });
    });

    it('does not leak variables to the outer scope', async () => {
      // This is a little tricky. We want to check the values in the outer scope, when the transaction has been successfully set up, but before it has been comitted.
      // We can't just call another function from inside that transaction, since that would transfer the context to that function - exactly what we are trying to prevent;

      let transactionSetup = false;
      let transactionEnded = false;

      const clsTask = vars.clsSequelize.transaction(async () => {
        transactionSetup = true;
        await delay(500);
        expect(vars.clsSequelize.getCurrentClsTransaction()).to.be.ok;
        transactionEnded = true;
      });

      await new Promise<void>(resolve => {
        // Wait for the transaction to be setup
        const interval = setInterval(() => {
          if (transactionSetup) {
            clearInterval(interval);
            resolve();
          }
        }, 200);
      });
      expect(transactionEnded).not.to.be.ok;

      expect(vars.clsSequelize.getCurrentClsTransaction()).not.to.be.ok;

      // Just to make sure it didn't change between our last check and the assertion
      expect(transactionEnded).not.to.be.ok;
      await clsTask; // ensure we don't leak the promise
    });

    it('does not leak variables to the following promise chain', async () => {
      await vars.clsSequelize.transaction(() => {});
      expect(vars.clsSequelize.getCurrentClsTransaction()).not.to.be.ok;
    });

    it('does not leak outside findOrCreate', async () => {
      await vars.User.findOrCreate({
        where: {
          name: 'Kafka',
        },
        logging(sql) {
          if (sql.includes('default')) {
            throw new Error('The transaction was not properly assigned');
          }
        },
      });

      await vars.User.findAll();
    });
  });

  describe('sequelize.query', () => {
    beforeEach(async () => {
      await vars.User.truncate();
    });

    it('automatically uses the transaction in all calls', async () => {
      await vars.clsSequelize.transaction(async () => {
        await vars.User.create({ name: 'bob' });

        return Promise.all([
          expect(vars.User.findAll({ transaction: null })).to.eventually.have.length(0),
          expect(vars.User.findAll({})).to.eventually.have.length(1),
        ]);
      });
    });

    it('automagically uses the transaction in all calls with async/await', async () => {
      await vars.clsSequelize.transaction(async () => {
        await vars.User.create({ name: 'bob' });
        expect(await vars.User.findAll({ transaction: null })).to.have.length(0);
        expect(await vars.User.findAll({})).to.have.length(1);
      });
    });
  });

  it('promises returned by sequelize.query are correctly patched', async () => {
    await vars.clsSequelize.transaction(async t => {
      await vars.clsSequelize.query('select 1', { type: QueryTypes.SELECT });

      return expect(vars.clsSequelize.getCurrentClsTransaction()).to.equal(t);
    });
  });

  // reason for this test: https://github.com/sequelize/sequelize/issues/12973
  describe('Model Hook integration', () => {
    type Params<M extends Model> = {
      method: string;
      hooks: Array<keyof ModelHooks>;
      optionPos: number;
      execute(model: ModelStatic<M>): Promise<unknown>;
      getModel(): ModelStatic<M>;
    };

    function testHooks<T extends Model>({
      method,
      hooks: hookNames,
      optionPos,
      execute,
      getModel,
    }: Params<T>) {
      it(`passes the transaction to hooks {${hookNames.join(',')}} when calling ${method}`, async () => {
        await vars.clsSequelize.transaction(async transaction => {
          const hooks = Object.create(null);

          for (const hookName of hookNames) {
            hooks[hookName] = sinon.spy();
          }

          const User = getModel();

          for (const [hookName, spy] of Object.entries(hooks)) {
            User.hooks.addListener(hookName as keyof ModelHooks, spy as any);
          }

          await execute(User);

          const spyMatcher = [];
          // ignore all arguments until we get to the option bag.
          for (let i = 0; i < optionPos; i++) {
            spyMatcher.push(sinon.match.any);
          }

          // find the transaction in the option bag
          spyMatcher.push(sinon.match.has('transaction', transaction));

          for (const [hookName, spy] of Object.entries(hooks)) {
            expect(
              spy,
              `hook ${hookName} did not receive the transaction from AsyncLocalStorage.`,
            ).to.have.been.calledWith(...spyMatcher);
          }
        });
      });
    }

    testHooks({
      method: 'Model.bulkCreate',
      hooks: ['beforeBulkCreate', 'beforeCreate', 'afterCreate', 'afterBulkCreate'],
      optionPos: 1,
      async execute(User) {
        await User.bulkCreate([{ name: 'bob' }], { individualHooks: true });
      },
      getModel() {
        return vars.User;
      },
    });

    testHooks({
      method: 'Model.findAll',
      hooks: ['beforeFind', 'beforeFindAfterExpandIncludeAll', 'beforeFindAfterOptions'],
      optionPos: 0,
      async execute(User) {
        await User.findAll();
      },
      getModel() {
        return vars.User;
      },
    });

    testHooks({
      method: 'Model.findAll',
      hooks: ['afterFind'],
      optionPos: 1,
      async execute(User) {
        await User.findAll();
      },
      getModel() {
        return vars.User;
      },
    });

    testHooks({
      method: 'Model.count',
      hooks: ['beforeCount'],
      optionPos: 0,
      async execute(User) {
        await User.count();
      },
      getModel() {
        return vars.User;
      },
    });

    if (sequelize.dialect.supports.upserts) {
      testHooks({
        method: 'Model.upsert',
        hooks: ['beforeUpsert', 'afterUpsert'],
        optionPos: 1,
        async execute(User) {
          await User.upsert({
            id: 1,
            name: 'bob',
          });
        },
        getModel() {
          return vars.User;
        },
      });
    }

    testHooks({
      method: 'Model.destroy',
      hooks: ['beforeBulkDestroy', 'afterBulkDestroy'],
      optionPos: 0,
      async execute(User) {
        await User.destroy({ where: { name: 'bob' } });
      },
      getModel() {
        return vars.User;
      },
    });

    testHooks({
      method: 'Model.destroy with individualHooks',
      hooks: ['beforeDestroy', 'beforeDestroy'],
      optionPos: 1,
      async execute(User) {
        await User.create({ name: 'bob' });
        await User.destroy({ where: { name: 'bob' }, individualHooks: true });
      },
      getModel() {
        return vars.User;
      },
    });

    testHooks({
      method: 'Model#destroy',
      hooks: ['beforeDestroy', 'beforeDestroy'],
      optionPos: 1,
      async execute(User) {
        const user = await User.create({ name: 'bob' });
        await user.destroy();
      },
      getModel() {
        return vars.User;
      },
    });

    testHooks({
      method: 'Model.update',
      hooks: ['beforeBulkUpdate', 'afterBulkUpdate'],
      optionPos: 0,
      async execute(User) {
        await User.update({ name: 'alice' }, { where: { name: 'bob' } });
      },
      getModel() {
        return vars.User;
      },
    });

    testHooks({
      method: 'Model.update with individualHooks',
      hooks: ['beforeUpdate', 'afterUpdate'],
      optionPos: 1,
      async execute(User) {
        await User.create({ name: 'bob' });
        await User.update({ name: 'alice' }, { where: { name: 'bob' }, individualHooks: true });
      },
      getModel() {
        return vars.User;
      },
    });

    testHooks({
      method: 'Model#save (isNewRecord)',
      hooks: ['beforeCreate', 'afterCreate'],
      optionPos: 1,
      async execute(User: typeof vars.User) {
        const user = User.build({ name: 'bob' });
        user.name = 'alice';
        await user.save();
      },
      getModel() {
        return vars.User;
      },
    });

    testHooks({
      method: 'Model#save (!isNewRecord)',
      hooks: ['beforeUpdate', 'afterUpdate'],
      optionPos: 1,
      async execute(User: typeof vars.User) {
        const user = await User.create({ name: 'bob' });
        user.name = 'alice';
        await user.save();
      },
      getModel() {
        return vars.User;
      },
    });

    describe('paranoid restore', () => {
      const vars2 = beforeAll2(async () => {
        const ParanoidUser = vars.clsSequelize.define(
          'ParanoidUser',
          {
            name: DataTypes.STRING,
          },
          { paranoid: true },
        );

        await ParanoidUser.sync({ force: true });

        return { ParanoidUser };
      });

      testHooks({
        method: 'Model.restore',
        hooks: ['beforeBulkRestore', 'afterBulkRestore'],
        optionPos: 0,
        async execute() {
          const User = vars2.ParanoidUser;
          await User.restore({ where: { name: 'bob' } });
        },
        getModel() {
          return vars2.ParanoidUser;
        },
      });

      testHooks({
        method: 'Model.restore with individualHooks',
        hooks: ['beforeRestore', 'afterRestore'],
        optionPos: 1,
        async execute() {
          const User = vars2.ParanoidUser;

          await User.create({ name: 'bob' });
          await User.destroy({ where: { name: 'bob' } });
          await User.restore({ where: { name: 'bob' }, individualHooks: true });
        },
        getModel() {
          return vars2.ParanoidUser;
        },
      });

      testHooks({
        method: 'Model#restore',
        hooks: ['beforeRestore', 'afterRestore'],
        optionPos: 1,
        async execute() {
          const User = vars2.ParanoidUser;

          const user = await User.create({ name: 'bob' });
          await user.destroy();
          await user.restore();
        },
        getModel() {
          return vars2.ParanoidUser;
        },
      });
    });
  });
});
