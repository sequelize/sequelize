import type { CreationOptional, InferAttributes, InferCreationAttributes } from '@sequelize/core';
import { DataTypes, Model, Op } from '@sequelize/core';
import { Attribute, Table } from '@sequelize/core/decorators-legacy';
import { expect } from 'chai';
import {
  beforeAll2,
  createSingleTransactionalTestSequelizeInstance,
  sequelize,
  setResetMode,
} from '../support';

describe('destroy', () => {
  context('test-shared models', () => {
    setResetMode('truncate');

    const vars = beforeAll2(async () => {
      class User extends Model<InferAttributes<User>, InferCreationAttributes<User>> {
        @Attribute(DataTypes.STRING)
        declare username: string | null;
      }

      @Table({ paranoid: true })
      class ParanoidUser extends Model<
        InferAttributes<ParanoidUser>,
        InferCreationAttributes<ParanoidUser>
      > {
        declare id: CreationOptional<number>;

        @Attribute(DataTypes.STRING)
        declare username: string | null;

        declare deletedAt: Date | null;
      }

      sequelize.addModels([User, ParanoidUser]);

      await sequelize.sync({ force: true });

      return { User, ParanoidUser };
    });

    it('throws an error if no where clause is given', async () => {
      const { User } = vars;

      await expect(User.destroy()).to.be.rejectedWith(
        Error,
        'As a safeguard, the "destroy" static model method requires explicitly specifying a "where" option. If you actually mean to delete all rows in the table, set the option to a dummy condition such as sql`1 = 1`.',
      );
    });

    it('deletes all instances when given an empty where object', async () => {
      const { User } = vars;

      await User.bulkCreate([{ username: 'user1' }, { username: 'user2' }]);
      const affectedRows = await User.destroy({ where: {} });
      expect(affectedRows).to.equal(2);
      expect(await User.findAll()).to.have.lengthOf(0);
    });

    it('deletes values that match filter', async () => {
      const { User } = vars;

      const data = [{ username: 'Peter' }, { username: 'Paul' }, { username: 'Paul' }];

      await User.bulkCreate(data);
      await User.destroy({ where: { username: 'Paul' } });
      const users = await User.findAll();
      expect(users.length).to.equal(1);
      expect(users[0].username).to.equal('Peter');
    });

    it('returns the number of affected rows', async () => {
      const { User } = vars;

      const data = [{ username: 'Peter' }, { username: 'Paul' }, { username: 'Bob' }];

      await User.bulkCreate(data);
      const affectedRows = await User.destroy({ where: {} });
      expect(affectedRows).to.equal(3);
    });

    it('sets deletedAt to the current timestamp if paranoid is true', async () => {
      const { ParanoidUser } = vars;

      const data = [{ username: 'Peter' }, { username: 'Paul' }];

      await ParanoidUser.bulkCreate(data);

      // since we save in UTC, let's format to UTC time
      const date = new Date();
      await ParanoidUser.destroy({ where: { username: 'Paul' } });

      const users = await ParanoidUser.findAll();
      expect(users.length).to.equal(1);
      expect(users[0].username).to.equal('Peter');

      const deletedUsers = await ParanoidUser.findAll({
        paranoid: false,
        where: { deletedAt: { [Op.isNot]: null } },
        order: [['username', 'ASC']],
      });

      expect(deletedUsers[0].username).to.equal('Paul');
      expect(deletedUsers[0].deletedAt).to.be.closeToTime(date, 100);
    });

    it('does not set deletedAt for previously destroyed instances if paranoid is true', async () => {
      const { ParanoidUser } = vars;

      const [user1] = await ParanoidUser.bulkCreate([{ username: 'Toni' }, { username: 'Max' }]);

      const user = await ParanoidUser.findByPk(user1.id, { rejectOnEmpty: true });
      await user.destroy();
      await user.reload({ paranoid: false });

      const deletedAt = user.deletedAt!;
      await ParanoidUser.destroy({ where: {} });
      await user.reload({ paranoid: false });
      expect(user.deletedAt).to.equalTime(deletedAt);
    });

    it('permanently deletes a paranoid record if "force" is true', async () => {
      const { ParanoidUser } = vars;

      await ParanoidUser.create({ username: 'Bob' });
      await ParanoidUser.destroy({ where: {}, force: true });
      expect(await ParanoidUser.findAll({ paranoid: false })).to.be.empty;
    });

    it('should work if model is paranoid and has a where clause', async () => {
      const { ParanoidUser } = vars;

      await ParanoidUser.bulkCreate([{ username: 'foo' }, { username: 'bar' }]);
      await ParanoidUser.destroy({
        where: {
          username: 'bar',
        },
      });

      const users = await ParanoidUser.findAll();
      expect(users).to.have.length(1);
      expect(users[0].username).to.equal('foo');
    });
  });

  context('test-specific models', () => {
    if (sequelize.dialect.supports.transactions) {
      it('supports transactions', async () => {
        const transactionSequelize =
          await createSingleTransactionalTestSequelizeInstance(sequelize);
        const User = transactionSequelize.define('User', { username: DataTypes.STRING });

        await User.sync({ force: true });
        await User.create({ username: 'foo' });
        const transaction = await transactionSequelize.startUnmanagedTransaction();
        try {
          await User.destroy({
            where: {},
            transaction,
          });
          const count1 = await User.count();
          const count2 = await User.count({ transaction });
          expect(count1).to.equal(1);
          expect(count2).to.equal(0);
        } finally {
          await transaction.rollback();
        }
      });
    }

    it('works without a primary key', async () => {
      const Log = sequelize.define('Log', {
        client_id: DataTypes.INTEGER,
        content: DataTypes.TEXT,
        timestamp: DataTypes.DATE,
      });
      Log.removeAttribute('id');

      await Log.sync({ force: true });
      await Log.create({
        client_id: 13,
        content: 'Error!',
        timestamp: new Date(),
      });
      await Log.destroy({
        where: {
          client_id: 13,
        },
      });
      expect(await Log.findAll()).to.have.lengthOf(0);
    });

    it('maps the the column name', async () => {
      const UserProject = sequelize.define('UserProject', {
        userId: {
          type: DataTypes.INTEGER,
          columnName: 'user_id',
        },
      });

      await UserProject.sync({ force: true });
      await UserProject.create({ userId: 10 });
      await UserProject.destroy({ where: { userId: 10 } });
      expect(await UserProject.findAll()).to.have.lengthOf(0);
    });

    if (sequelize.dialect.supports.schemas) {
      it('supports table schema/prefix', async () => {
        @Table({ schema: 'prefix' })
        class User extends Model<InferAttributes<User>, InferCreationAttributes<User>> {
          @Attribute(DataTypes.STRING)
          declare username: string | null;
        }

        sequelize.addModels([User]);
        await sequelize.queryInterface.createSchema('prefix');
        await User.sync({ force: true });

        const data = [{ username: 'Peter' }, { username: 'Peter' }, { username: 'Bob' }];

        await User.bulkCreate(data);
        await User.destroy({ where: { username: 'Peter' } });
        const users = await User.findAll({ order: ['id'] });
        expect(users.length).to.equal(1);
        expect(users[0].username).to.equal('Bob');
      });
    }
  });
});
