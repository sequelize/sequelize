import type { CreationOptional, InferAttributes, InferCreationAttributes } from '@sequelize/core';
import { DataTypes, Model, sql } from '@sequelize/core';
import { Attribute, ColumnName, PrimaryKey, Table } from '@sequelize/core/decorators-legacy';
import chai from 'chai';
import sinon from 'sinon';
import {
  beforeAll2,
  createSingleTransactionalTestSequelizeInstance,
  expectsql,
  sequelize,
  setResetMode,
} from '../support';

const expect = chai.expect;
const dialect = sequelize.dialect;
const dialectName = dialect.name;

describe('Model.update', () => {
  context('test-shared models', () => {
    setResetMode('destroy');

    const vars = beforeAll2(async () => {
      const clock = sinon.useFakeTimers();

      class User extends Model<InferAttributes<User>, InferCreationAttributes<User>> {
        declare id: CreationOptional<number>;
        declare updatedAt: CreationOptional<Date>;
        declare createdAt: CreationOptional<Date>;

        @Attribute(DataTypes.STRING)
        declare username: string | null;

        @Attribute(DataTypes.STRING)
        declare email: string | null;
      }

      @Table({ paranoid: true })
      class ParanoidUser extends Model<InferAttributes<User>, InferCreationAttributes<User>> {
        declare id: CreationOptional<number>;
        declare updatedAt: CreationOptional<Date>;
        declare createdAt: CreationOptional<Date>;

        @Attribute(DataTypes.STRING)
        declare username: string | null;

        @Attribute(DataTypes.STRING)
        declare email: string | null;
      }

      sequelize.addModels([User, ParanoidUser]);

      await sequelize.sync({ force: true });

      return { User, ParanoidUser, clock };
    });

    afterEach(() => {
      vars.clock.reset();
    });

    after(() => {
      vars.clock.restore();
    });

    it('throws an error if no where clause is given', async () => {
      // @ts-expect-error -- testing that this fails
      await expect(vars.User.update({}, {})).to.be.rejectedWith(
        Error,
        'Missing where attribute in the options parameter',
      );
    });

    it('only updates rows that match where', async () => {
      const { User } = vars;

      await User.bulkCreate([{ username: 'Peter' }, { username: 'Peter' }, { username: 'Bob' }]);
      await User.update({ username: 'John' }, { where: { username: 'Peter' } });
      const users = await User.findAll({ order: ['username'] });
      expect(users).to.have.lengthOf(3);

      expect(users[0].username).to.equal('Bob');
      expect(users[1].username).to.equal('John');
      expect(users[2].username).to.equal('John');
    });

    // TODO: rename "fields" -> "attributes"
    it('updates only attributes specified by "fields" option', async () => {
      const { User } = vars;

      const data = [{ username: 'Peter', email: 'first-email' }];

      await User.bulkCreate(data);
      await User.update(
        { username: 'Bill', email: 'second-email' },
        { where: { email: 'first-email' }, fields: ['username'] },
      );
      const users = await User.findAll();
      expect(users).to.have.lengthOf(1);
      expect(users[0].username).to.equal('Bill');
      expect(users[0].email).to.equal('first-email');
    });

    it('updates with casting', async () => {
      const { User } = vars;

      await User.create({ username: 'John' });
      await User.update(
        {
          // @ts-expect-error -- TODO: fix typing to allow this
          username: sql.cast('1', dialectName === 'mssql' ? 'nvarchar' : 'char'),
        },
        {
          where: { username: 'John' },
        },
      );

      expect((await User.findOne({ rejectOnEmpty: true })).username).to.equal('1');
    });

    it('updates with function and column value', async () => {
      const { User } = vars;

      await User.create({ username: 'John' });
      await User.update(
        {
          username: sql.fn('upper', sql.col('username')),
        },
        {
          where: { username: 'John' },
        },
      );

      expect((await User.findOne({ rejectOnEmpty: true })).username).to.equal('JOHN');
    });

    it('should properly set data when individualHooks are true', async () => {
      const { User } = vars;

      const unhook = User.hooks.addListener('beforeUpdate', instance => {
        instance.set('email', 'new email');
      });

      try {
        const user = await User.create({ username: 'Peter' });
        await User.update(
          { username: 'John' },
          {
            where: { id: user.id },
            individualHooks: true,
          },
        );
        expect((await User.findByPk(user.id, { rejectOnEmpty: true })).email).to.equal('new email');
      } finally {
        unhook();
      }
    });

    it('sets updatedAt to the current timestamp', async () => {
      const { User } = vars;

      await User.bulkCreate([{ username: 'Peter' }, { username: 'Paul' }, { username: 'Bob' }]);

      let users = await User.findAll({ order: ['id'] });
      const updatedAt = users[0].updatedAt;

      expect(updatedAt).to.be.ok;
      expect(updatedAt).to.equalTime(users[2].updatedAt); // All users should have the same updatedAt

      vars.clock.tick(1000);
      await User.update({ username: 'Bill' }, { where: { username: 'Bob' } });

      users = await User.findAll({ order: ['username'] });
      expect(users[0].username).to.equal('Bill');
      expect(users[1].username).to.equal('Paul');
      expect(users[2].username).to.equal('Peter');

      expect(users[0].updatedAt).to.be.afterTime(updatedAt);
      expect(users[1].updatedAt).to.equalTime(updatedAt);
      expect(users[2].updatedAt).to.equalTime(updatedAt);
    });

    it('does not update timestamps when passing silent=true in a bulk update', async () => {
      const { User, clock } = vars;

      await User.bulkCreate([{ username: 'Paul' }, { username: 'Peter' }]);

      const users0 = await User.findAll();
      const updatedAtPaul = users0[0].updatedAt;
      const updatedAtPeter = users0[1].updatedAt;
      clock.tick(150);

      await User.update({ username: 'John' }, { where: {}, silent: true });

      const users = await User.findAll();
      expect(users[0].updatedAt).to.equalTime(updatedAtPeter);
      expect(users[1].updatedAt).to.equalTime(updatedAtPaul);
    });

    it('returns the number of affected rows', async () => {
      const { User } = vars;

      await User.bulkCreate([{ username: 'Peter' }, { username: 'Paul' }, { username: 'Bob' }]);

      const [affectedRows] = await User.update({ username: 'Bill' }, { where: {} });
      expect(affectedRows).to.equal(3);
    });

    it('does not update soft deleted records when model is paranoid', async () => {
      const { ParanoidUser } = vars;

      await ParanoidUser.bulkCreate([{ username: 'user1' }, { username: 'user2' }]);
      await ParanoidUser.destroy({
        where: { username: 'user1' },
      });
      await ParanoidUser.update({ username: 'foo' }, { where: {} });
      const users = await ParanoidUser.findAll({
        paranoid: false,
        where: {
          username: 'foo',
        },
      });

      expect(users).to.have.lengthOf(1, 'should not update soft-deleted record');
    });

    it('updates soft deleted records when paranoid is overridden', async () => {
      const { ParanoidUser } = vars;

      await ParanoidUser.bulkCreate([{ username: 'user1' }, { username: 'user2' }]);

      await ParanoidUser.destroy({ where: { username: 'user1' } });

      await ParanoidUser.update(
        { username: 'foo' },
        {
          where: {},
          paranoid: false,
        },
      );

      const users = await ParanoidUser.findAll({
        paranoid: false,
      });

      expect(users).to.have.lengthOf(2);
    });

    it('calls update hook for soft deleted objects', async () => {
      const hookSpy = sinon.spy();

      const { ParanoidUser } = vars;
      const unhook = ParanoidUser.hooks.addListener('beforeUpdate', hookSpy);
      try {
        await ParanoidUser.bulkCreate([{ username: 'user1' }]);
        await ParanoidUser.destroy({
          where: {
            username: 'user1',
          },
        });
        await ParanoidUser.update(
          { username: 'updUser1' },
          {
            paranoid: false,
            where: { username: 'user1' },
            individualHooks: true,
          },
        );
        const user = await ParanoidUser.findOne({
          where: { username: 'updUser1' },
          rejectOnEmpty: true,
          paranoid: false,
        });
        expect(user.username).to.eq('updUser1');
        expect(hookSpy).to.have.been.called;
      } finally {
        unhook();
      }
    });

    if (dialect.supports['LIMIT ON UPDATE']) {
      it('supports limit clause', async () => {
        const { User } = vars;

        await User.bulkCreate([
          { username: 'Peter' },
          { username: 'Peter' },
          { username: 'Peter' },
        ]);

        const [affectedRows] = await User.update(
          { username: 'Bob' },
          {
            where: {},
            limit: 1,
          },
        );

        expect(affectedRows).to.equal(1);
      });
    }

    it('skips query if there is no data to update', async () => {
      const { User } = vars;

      const spy = sinon.spy();

      await User.create({});

      const result = await User.update(
        {
          // @ts-expect-error -- TODO: throw if trying to update non-existing attribute
          unknownField: 'haha',
        },
        {
          where: {},
          logging: spy,
        },
      );

      expect(result[0]).to.equal(0);
      expect(spy.called, 'Update query was issued when no data to update').to.be.false;
    });

    it('treats undefined like if the property were not set: The attribute is ignored', async () => {
      const { User } = vars;

      const account = await User.create({
        username: 'username 1',
        email: 'email 1',
      });

      await User.update(
        {
          username: 'username 2',
          email: undefined,
        },
        {
          where: {
            id: account.get('id'),
          },
        },
      );

      await account.reload();
      expect(account.email).to.equal('email 1');
    });

    if (sequelize.dialect.supports.returnValues) {
      it('should return the updated record', async () => {
        const { User } = vars;

        await User.create({ username: 'username 1', id: 5 });
        const [, accounts] = await User.update(
          { username: 'username 2' },
          {
            where: {},
            returning: true,
          },
        );

        const firstAcc = accounts[0];
        expect(firstAcc.username).to.equal('username 2');
        expect(firstAcc.id).to.equal(5);
      });
    }
  });

  context('test-specific models', () => {
    if (sequelize.dialect.supports.transactions) {
      it('supports transactions', async () => {
        class User extends Model<InferAttributes<User>, InferCreationAttributes<User>> {
          @Attribute(DataTypes.STRING)
          declare username: string | null;
        }

        const transactionSequelize =
          await createSingleTransactionalTestSequelizeInstance(sequelize);
        transactionSequelize.addModels([User]);

        await User.sync({ force: true });
        await User.create({ username: 'foo' });

        const t = await transactionSequelize.startUnmanagedTransaction();
        await User.update(
          { username: 'bar' },
          {
            where: { username: 'foo' },
            transaction: t,
          },
        );

        const users1 = await User.findAll();
        const users2 = await User.findAll({ transaction: t });
        expect(users1[0].username).to.equal('foo');
        expect(users2[0].username).to.equal('bar');
        await t.rollback();
      });
    }

    it('should map the correct fields when saving instance (#10589)', async () => {
      class User extends Model<InferAttributes<User>, InferCreationAttributes<User>> {
        @ColumnName('id2')
        @Attribute(DataTypes.INTEGER)
        declare id: number;

        @ColumnName('id3')
        @Attribute(DataTypes.INTEGER)
        declare id2: number;

        @ColumnName('id')
        @Attribute(DataTypes.INTEGER)
        @PrimaryKey
        declare id3: number;
      }

      sequelize.addModels([User]);
      await sequelize.sync({ force: true });
      await User.create({ id3: 94, id: 87, id2: 943 });
      const user = await User.findByPk(94, { rejectOnEmpty: true });

      await user.update({ id2: 8877 });

      expect((await User.findByPk(94, { rejectOnEmpty: true })).id2).to.equal(8877);
    });

    it('updates the attributes that we select only without updating createdAt', async () => {
      const User = sequelize.define(
        'User1',
        {
          username: DataTypes.STRING,
          secretValue: DataTypes.STRING,
        },
        {
          paranoid: true,
          tableName: 'users1',
        },
      );

      let test = false;
      await User.sync({ force: true });
      const user = await User.create({ username: 'Peter', secretValue: '42' });
      await user.update(
        { secretValue: '43' },
        {
          fields: ['secretValue'],
          logging(sqlQuery: string) {
            test = true;

            expect(sqlQuery).to.match(/^Executing \(default\): /);
            sqlQuery = sqlQuery.slice(21);

            expectsql(sqlQuery, {
              default: `UPDATE [users1] SET [secretValue]=$sequelize_1,[updatedAt]=$sequelize_2 WHERE [id] = $sequelize_3`,
              sqlite3:
                'UPDATE `users1` SET `secretValue`=$sequelize_1,`updatedAt`=$sequelize_2 WHERE `id` = $sequelize_3 RETURNING *',
              postgres: `UPDATE "users1" SET "secretValue"=$1,"updatedAt"=$2 WHERE "id" = $3 RETURNING *`,
              mysql: 'UPDATE `users1` SET `secretValue`=?,`updatedAt`=? WHERE `id` = ?',
              mariadb: 'UPDATE `users1` SET `secretValue`=?,`updatedAt`=? WHERE `id` = ?',
              mssql: `UPDATE [users1] SET [secretValue]=@sequelize_1,[updatedAt]=@sequelize_2 OUTPUT INSERTED.* WHERE [id] = @sequelize_3`,
              db2: `SELECT * FROM FINAL TABLE (UPDATE "users1" SET "secretValue"=?,"updatedAt"=? WHERE "id" = ?);`,
              ibmi: `UPDATE "users1" SET "secretValue"=?,"updatedAt"=? WHERE "id" = ?;`,
            });
          },
          returning: [sql.col('*')],
        },
      );
      expect(test).to.be.true;
    });

    it('allows sql logging of updated statements', async () => {
      const User = sequelize.define(
        'User',
        {
          name: DataTypes.STRING,
          bio: DataTypes.TEXT,
        },
        {
          paranoid: true,
        },
      );
      let test = false;
      await User.sync({ force: true });
      const u = await User.create({ name: 'meg', bio: 'none' });
      expect(u).to.exist;
      await u.update(
        { name: 'brian' },
        {
          logging(sqlQuery) {
            test = true;
            expect(sqlQuery).to.exist;
            expect(sqlQuery.toUpperCase()).to.include('UPDATE');
          },
        },
      );
      expect(test).to.be.true;
    });

    it('does not update virtual attributes', async () => {
      class User extends Model<InferAttributes<User>, InferCreationAttributes<User>> {
        @Attribute(DataTypes.STRING)
        declare username: string | null;

        // TODO: throw if a virtual attribute does not have either a getter or a setter
        @Attribute(DataTypes.VIRTUAL)
        declare virtual: CreationOptional<string>;
      }

      sequelize.addModels([User]);
      await User.sync();

      await User.create({ username: 'jan' });

      // TODO: Model.update should always throw an error if a virtual attributes are used (even if it has a setter, no access to it from static update)
      await User.update(
        {
          username: 'kurt',
          virtual: 'test',
        },
        {
          where: {
            username: 'jan',
          },
        },
      );

      const user = await User.findOne({ rejectOnEmpty: true });
      expect(user.username).to.equal('kurt');
      expect(user.virtual).to.not.equal('test');
    });

    it('updates attributes that are altered by virtual setters', async () => {
      class User extends Model<InferAttributes<User>, InferCreationAttributes<User>> {
        @Attribute(DataTypes.STRING)
        declare username: string | null;

        @Attribute(DataTypes.STRING)
        declare illnessName: string;

        @Attribute(DataTypes.INTEGER)
        declare illnessPain: number;

        @Attribute(DataTypes.VIRTUAL)
        set illness(value: CreationOptional<{ pain: number; name: string }>) {
          this.set('illnessName', value.name);
          this.set('illnessPain', value.pain);
        }
      }

      sequelize.addModels([User]);

      await User.sync({ force: true });
      await User.create({
        username: 'Jan',
        illnessName: 'Headache',
        illnessPain: 5,
      });
      await User.update(
        {
          illness: { pain: 10, name: 'Backache' },
        },
        {
          where: {
            username: 'Jan',
          },
        },
      );
      expect((await User.findOne({ rejectOnEmpty: true })).illnessPain).to.equal(10);
    });

    it(`doesn't update attributes that are altered by virtual setters when "sideEffects" is false`, async () => {
      class User extends Model<InferAttributes<User>, InferCreationAttributes<User>> {
        @Attribute(DataTypes.STRING)
        declare username: string | null;

        @Attribute(DataTypes.STRING)
        declare illnessName: string;

        @Attribute(DataTypes.INTEGER)
        declare illnessPain: number;

        @Attribute(DataTypes.VIRTUAL)
        set illness(value: CreationOptional<{ pain: number; name: string }>) {
          this.set('illnessName', value.name);
          this.set('illnessPain', value.pain);
        }
      }

      sequelize.addModels([User]);

      await User.sync({ force: true });
      await User.create({
        username: 'Jan',
        illnessName: 'Headache',
        illnessPain: 5,
      });
      await User.update(
        {
          illness: { pain: 10, name: 'Backache' },
        },
        {
          where: {
            username: 'Jan',
          },
          sideEffects: false,
        },
      );
      expect((await User.findOne({ rejectOnEmpty: true })).illnessPain).to.equal(5);
    });
  });
});
