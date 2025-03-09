import type { InferAttributes, InferCreationAttributes } from '@sequelize/core';
import { DataTypes, IsolationLevel, Model } from '@sequelize/core';
import { Attribute, NotNull } from '@sequelize/core/decorators-legacy';
import { expect } from 'chai';
import delay from 'delay';
import sinon from 'sinon';
import {
  beforeAll2,
  createMultiTransactionalTestSequelizeInstance,
  getTestDialect,
  sequelize,
  setResetMode,
} from '../../support';

const dialect = getTestDialect();

if (dialect === 'hana') {
  describe('[HANA Specific] Transaction', () => {
    describe('Isolation Levels', () => {
      setResetMode('truncate');
      const vars = beforeAll2(async () => {
        const transactionSequelize = await createMultiTransactionalTestSequelizeInstance(sequelize);

        class User extends Model<InferAttributes<User>, InferCreationAttributes<User>> {
          @Attribute(DataTypes.STRING)
          @NotNull
          declare name: string;

          @Attribute(DataTypes.INTEGER)
          @NotNull
          declare age: number;
        }

        transactionSequelize.addModels([User]);

        await transactionSequelize.sync({ force: true });

        return { transactionSequelize, User };
      });

      after(async () => {
        return vars.transactionSequelize.close();
      });

      beforeEach(async () => {
        await vars.User.create({ name: 'John Doe', age: 21 });
      });

      it('should block updates after updating a row using SERIALIZABLE', async () => {
        const { User, transactionSequelize } = vars;
        const transactionSpy = sinon.spy();
        const transaction = await transactionSequelize.startUnmanagedTransaction({
          isolationLevel: IsolationLevel.SERIALIZABLE,
        });

        await User.update({ age: 24 }, { where: { name: 'John Doe' }, transaction });
        await Promise.all([
          // Update should not succeed before transaction has committed
          User.update({ age: 25 }, { where: { name: 'John Doe' } }).then(() => {
            expect(transactionSpy).to.have.been.called;
            expect(transaction.finished).to.equal('commit');
          }),

          delay(4000)
            .then(transactionSpy)
            .then(async () => transaction.commit()),
        ]);
      });
    });
  });
}
