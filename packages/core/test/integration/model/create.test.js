'use strict';

const range = require('lodash/range');

const chai = require('chai');
const sinon = require('sinon');

const expect = chai.expect;
const Support = require('../support');
const { DataTypes, Op, Sequelize, sql } = require('@sequelize/core');

const delay = require('delay');
const assert = require('node:assert');

const pTimeout = require('p-timeout');

const current = Support.sequelize;
const dialect = current.dialect;
const dialectName = Support.getTestDialect();

describe(Support.getTestDialectTeaser('Model'), () => {
  beforeEach(async function () {
    const sequelize = await Support.createMultiTransactionalTestSequelizeInstance(this.sequelize);
    this.customSequelize = sequelize;

    this.User = this.customSequelize.define('User', {
      username: DataTypes.STRING,
      secretValue: DataTypes.STRING,
      data: DataTypes.STRING,
      intVal: DataTypes.INTEGER,
      theDate: DataTypes.DATE,
      aBool: DataTypes.BOOLEAN,
      uniqueName: { type: DataTypes.STRING, unique: true },
    });
    this.Account = this.customSequelize.define('Account', {
      accountName: DataTypes.STRING,
    });
    this.Student = this.customSequelize.define('Student', {
      no: { type: DataTypes.INTEGER, primaryKey: true },
      name: { type: DataTypes.STRING, allowNull: false },
    });

    await this.customSequelize.sync({ force: true });
  });

  afterEach(function () {
    return this.customSequelize.close();
  });

  // TODO: move to own suite
  describe('findOrCreate', () => {
    if (current.dialect.supports.transactions) {
      it('supports transactions', async function () {
        const t = await this.customSequelize.startUnmanagedTransaction();

        await this.User.findOrCreate({
          where: {
            username: 'Username',
          },
          defaults: {
            data: 'some data',
          },
          transaction: t,
        });

        const count = await this.User.count();
        expect(count).to.equal(0);
        await t.commit();
        const count0 = await this.User.count();
        expect(count0).to.equal(1);
      });

      it('supports more than one models per transaction', async function () {
        const t = await this.customSequelize.startUnmanagedTransaction();
        await this.User.findOrCreate({
          where: { username: 'Username' },
          defaults: { data: 'some data' },
          transaction: t,
        });
        await this.Account.findOrCreate({ where: { accountName: 'accountName' }, transaction: t });
        await t.commit();
      });
    }

    it('should error correctly when defaults contain a unique key', async function () {
      const User = this.customSequelize.define('user', {
        objectId: {
          type: DataTypes.STRING,
          unique: true,
        },
        username: {
          type: DataTypes.STRING,
          unique: true,
        },
      });

      await User.sync({ force: true });

      await User.create({
        username: 'gottlieb',
      });

      await expect(
        User.findOrCreate({
          where: {
            objectId: 'asdasdasd',
          },
          defaults: {
            username: 'gottlieb',
          },
        }),
      ).to.eventually.be.rejectedWith(Sequelize.UniqueConstraintError);
    });

    it('should error correctly when defaults contain a unique key and a non-existent field', async function () {
      const User = this.customSequelize.define('user', {
        objectId: {
          type: DataTypes.STRING,
          unique: true,
        },
        username: {
          type: DataTypes.STRING,
          unique: true,
        },
      });

      await User.sync({ force: true });

      await User.create({
        username: 'gottlieb',
      });

      await expect(
        User.findOrCreate({
          where: {
            objectId: 'asdasdasd',
          },
          defaults: {
            username: 'gottlieb',
            foo: 'bar', // field that's not a defined attribute
            bar: 121,
          },
        }),
      ).to.eventually.be.rejectedWith(Sequelize.UniqueConstraintError);
    });

    it('should error correctly when defaults contain a unique key and the where clause is complex', async function () {
      const User = this.customSequelize.define('user', {
        objectId: {
          type: DataTypes.STRING,
          unique: true,
        },
        username: {
          type: DataTypes.STRING,
          unique: true,
        },
      });

      await User.sync({ force: true });
      await User.create({ username: 'gottlieb' });

      try {
        await User.findOrCreate({
          where: {
            [Op.or]: [
              {
                objectId: 'asdasdasd1',
              },
              {
                objectId: 'asdasdasd2',
              },
            ],
          },
          defaults: {
            username: 'gottlieb',
          },
        });
      } catch (error) {
        expect(error).to.be.instanceof(Sequelize.UniqueConstraintError);
        if (dialectName !== 'ibmi') {
          expect(error.errors[0].path).to.be.a('string', 'username');
        }
      }
    });

    it('should work with empty uuid primary key in where', async function () {
      const User = this.customSequelize.define('User', {
        id: {
          type: DataTypes.UUID,
          primaryKey: true,
          allowNull: false,
          defaultValue: sql.uuidV4,
        },
        name: {
          type: DataTypes.STRING,
        },
      });

      await User.sync({ force: true });

      await User.findOrCreate({
        where: {},
        defaults: {
          name: Math.random().toString(),
        },
      });
    });

    if (!['sqlite3', 'mssql', 'db2', 'ibmi'].includes(current.dialect.name)) {
      it('should not deadlock with no existing entries and no outer transaction', async function () {
        const User = this.customSequelize.define('User', {
          email: {
            type: DataTypes.STRING,
            unique: 'company_user_email',
          },
          companyId: {
            type: DataTypes.INTEGER,
            unique: 'company_user_email',
          },
        });

        await User.sync({ force: true });

        await Promise.all(
          range(50).map(i => {
            return User.findOrCreate({
              where: {
                email: `unique.email.${i}@sequelizejs.com`,
                companyId: Math.floor(Math.random() * 5),
              },
            });
          }),
        );
      });

      it('should not deadlock with existing entries and no outer transaction', async function () {
        const User = this.customSequelize.define('User', {
          email: {
            type: DataTypes.STRING,
            unique: 'company_user_email',
          },
          companyId: {
            type: DataTypes.INTEGER,
            unique: 'company_user_email',
          },
        });

        await User.sync({ force: true });

        await Promise.all(
          range(50).map(i => {
            return User.findOrCreate({
              where: {
                email: `unique.email.${i}@sequelizejs.com`,
                companyId: 2,
              },
            });
          }),
        );

        await Promise.all(
          range(50).map(i => {
            return User.findOrCreate({
              where: {
                email: `unique.email.${i}@sequelizejs.com`,
                companyId: 2,
              },
            });
          }),
        );
      });

      it('should not deadlock with concurrency duplicate entries and no outer transaction', async function () {
        const User = this.customSequelize.define('User', {
          email: {
            type: DataTypes.STRING,
            unique: 'company_user_email',
          },
          companyId: {
            type: DataTypes.INTEGER,
            unique: 'company_user_email',
          },
        });

        await User.sync({ force: true });

        await Promise.all(
          range(50).map(() => {
            return User.findOrCreate({
              where: {
                email: 'unique.email.1@sequelizejs.com',
                companyId: 2,
              },
            });
          }),
        );
      });
    }

    it('should support special characters in defaults', async function () {
      const User = this.customSequelize.define('user', {
        objectId: {
          type: DataTypes.INTEGER,
          unique: true,
        },
        description: {
          type: DataTypes.TEXT,
        },
      });

      await User.sync({ force: true });

      await User.findOrCreate({
        where: {
          objectId: 1,
        },
        defaults: {
          description: "$$ and !! and :: and ? and ^ and * and '",
        },
      });
    });

    it('should support bools in defaults', async function () {
      const User = this.customSequelize.define('user', {
        objectId: {
          type: DataTypes.INTEGER,
          unique: true,
        },
        bool: DataTypes.BOOLEAN,
      });

      await User.sync({ force: true });

      await User.findOrCreate({
        where: {
          objectId: 1,
        },
        defaults: {
          bool: false,
        },
      });
    });

    it('returns instance if already existent. Single find field.', async function () {
      const data = {
        username: 'Username',
      };

      const user = await this.User.create(data);

      const [_user, created] = await this.User.findOrCreate({
        where: {
          username: user.username,
        },
      });

      expect(_user.id).to.equal(user.id);
      expect(_user.username).to.equal('Username');
      expect(created).to.be.false;
    });

    it('Returns instance if already existent. Multiple find fields.', async function () {
      const data = {
        username: 'Username',
        data: 'ThisIsData',
      };

      const user = await this.User.create(data);
      const [_user, created] = await this.User.findOrCreate({ where: data });
      expect(_user.id).to.equal(user.id);
      expect(_user.username).to.equal('Username');
      expect(_user.data).to.equal('ThisIsData');
      expect(created).to.be.false;
    });

    it('does not include exception catcher in response', async function () {
      const data = {
        username: 'Username',
        data: 'ThisIsData',
      };

      const [user0] = await this.User.findOrCreate({
        where: data,
        defaults: {},
      });

      expect(user0.dataValues.sequelize_caught_exception).to.be.undefined;

      const [user] = await this.User.findOrCreate({
        where: data,
        defaults: {},
      });

      expect(user.dataValues.sequelize_caught_exception).to.be.undefined;
    });

    it('creates new instance with default value.', async function () {
      const data = {
        username: 'Username',
      };
      const default_values = {
        data: 'ThisIsData',
      };

      const [user, created] = await this.User.findOrCreate({
        where: data,
        defaults: default_values,
      });
      expect(user.username).to.equal('Username');
      expect(user.data).to.equal('ThisIsData');
      expect(created).to.be.true;
    });

    it('supports .or() (only using default values)', async function () {
      const [user, created] = await this.User.findOrCreate({
        where: Sequelize.or({ username: 'Fooobzz' }, { secretValue: 'Yolo' }),
        defaults: { username: 'Fooobzz', secretValue: 'Yolo' },
      });

      expect(user.username).to.equal('Fooobzz');
      expect(user.secretValue).to.equal('Yolo');
      expect(created).to.be.true;
    });

    it('should ignore option returning', async function () {
      const [user, created] = await this.User.findOrCreate({
        where: { username: 'Username' },
        defaults: { data: 'ThisIsData' },
        returning: false,
      });

      expect(user.username).to.equal('Username');
      expect(user.data).to.equal('ThisIsData');
      expect(created).to.be.true;
    });

    if (current.dialect.supports.transactions) {
      it('should release transaction when meeting errors', async function () {
        const test = async times => {
          if (times > 10) {
            return true;
          }

          try {
            return await pTimeout(
              this.Student.findOrCreate({
                where: {
                  no: 1,
                },
              }),
              1000,
            );
          } catch (error) {
            if (error instanceof Sequelize.ValidationError) {
              return test(times + 1);
            }

            if (error instanceof pTimeout.TimeoutError) {
              throw new TypeError(error);
            }

            throw error;
          }
        };

        await test(0);
      });
    }

    describe('several concurrent calls', () => {
      if (current.dialect.supports.transactions) {
        it('works with a transaction', async function () {
          const transaction = await this.customSequelize.startUnmanagedTransaction();

          const [first, second] = await Promise.all([
            this.User.findOrCreate({ where: { uniqueName: 'winner' }, transaction }),
            this.User.findOrCreate({ where: { uniqueName: 'winner' }, transaction }),
          ]);

          const firstInstance = first[0];
          const firstCreated = first[1];
          const secondInstance = second[0];
          const secondCreated = second[1];

          // Depending on execution order and MAGIC either the first OR the second call should return true
          expect(firstCreated ? !secondCreated : secondCreated).to.be.ok; // XOR

          expect(firstInstance).to.be.ok;
          expect(secondInstance).to.be.ok;

          expect(firstInstance.id).to.equal(secondInstance.id);

          await transaction.commit();
        });
      }

      it('should not fail silently with concurrency higher than pool, a unique constraint and a create hook resulting in mismatched values', async function () {
        if (['sqlite3', 'mssql', 'db2', 'ibmi'].includes(dialectName)) {
          return;
        }

        const User = this.customSequelize.define('user', {
          username: {
            type: DataTypes.STRING,
            unique: true,
            columnName: 'user_name',
          },
        });

        User.beforeCreate(instance => {
          instance.username += ' h.';
        });

        const spy = sinon.spy();

        const names = ['mick', 'mick', 'mick', 'mick', 'mick', 'mick', 'mick'];

        await User.sync({ force: true });

        await Promise.all(
          names.map(async username => {
            try {
              return await User.findOrCreate({ where: { username } });
            } catch (error) {
              spy();
              expect(error.message).to.equal(
                `user#findOrCreate: value used for username was not equal for both the find and the create calls, 'mick' vs 'mick h.'`,
              );
            }
          }),
        );

        expect(spy).to.have.been.called;
      });

      it('should error correctly when defaults contain a unique key without a transaction', async function () {
        if (dialectName === 'sqlite3') {
          return;
        }

        const User = this.customSequelize.define('user', {
          objectId: {
            type: DataTypes.STRING,
            unique: true,
          },
          username: {
            type: DataTypes.STRING,
            unique: true,
          },
        });

        await User.sync({ force: true });

        await User.create({
          username: 'gottlieb',
        });

        return Promise.all([
          (async () => {
            const error = await expect(
              User.findOrCreate({
                where: {
                  objectId: 'asdasdasd',
                },
                defaults: {
                  username: 'gottlieb',
                },
              }),
            ).to.be.rejectedWith(Sequelize.UniqueConstraintError);

            expect(error.fields).to.be.ok;
          })(),
          (async () => {
            const error = await expect(
              User.findOrCreate({
                where: {
                  objectId: 'asdasdasd',
                },
                defaults: {
                  username: 'gottlieb',
                },
              }),
            ).to.be.rejectedWith(Sequelize.UniqueConstraintError);

            expect(error.fields).to.be.ok;
          })(),
        ]);
      });

      it('works without a transaction', async function () {
        // Creating two concurrent transactions and selecting / inserting from the same table throws sqlite off
        if (dialectName === 'sqlite3') {
          return;
        }

        const [first, second] = await Promise.all([
          this.User.findOrCreate({ where: { uniqueName: 'winner' } }),
          this.User.findOrCreate({ where: { uniqueName: 'winner' } }),
        ]);

        const firstInstance = first[0];
        const firstCreated = first[1];
        const secondInstance = second[0];
        const secondCreated = second[1];

        // Depending on execution order and MAGIC either the first OR the second call should return true
        expect(firstCreated ? !secondCreated : secondCreated).to.be.ok; // XOR

        expect(firstInstance).to.be.ok;
        expect(secondInstance).to.be.ok;

        expect(firstInstance.id).to.equal(secondInstance.id);
      });
    });
  });

  // TODO: move to own suite
  describe('findCreateFind', () => {
    if (dialectName !== 'sqlite3') {
      it('should work with multiple concurrent calls', async function () {
        const [[instance1, created1], [instance2, created2], [instance3, created3]] =
          await Promise.all([
            this.User.findCreateFind({ where: { uniqueName: 'winner' } }),
            this.User.findCreateFind({ where: { uniqueName: 'winner' } }),
            this.User.findCreateFind({ where: { uniqueName: 'winner' } }),
          ]);

        // All instances are the same
        expect(instance1.id).to.equal(instance2.id);
        expect(instance2.id).to.equal(instance3.id);

        // Only one of the createdN values is true
        expect(Boolean(created1 ^ created2 ^ created3)).to.be.true;
      });

      if (current.dialect.supports.transactions) {
        it('should work with multiple concurrent calls within a transaction', async function () {
          const t = await this.customSequelize.startUnmanagedTransaction();
          const [[instance1, created1], [instance2, created2], [instance3, created3]] =
            await Promise.all([
              this.User.findCreateFind({ transaction: t, where: { uniqueName: 'winner' } }),
              this.User.findCreateFind({ transaction: t, where: { uniqueName: 'winner' } }),
              this.User.findCreateFind({ transaction: t, where: { uniqueName: 'winner' } }),
            ]);

          await t.commit();

          // All instances are the same
          expect(instance1.id).to.equal(1);
          expect(instance2.id).to.equal(1);
          expect(instance3.id).to.equal(1);
          // Only one of the createdN values is true
          expect(Boolean(created1 ^ created2 ^ created3)).to.be.true;
        });
      }
    }
  });

  describe('create', () => {
    it('works with multiple non-integer primary keys with a default value', async function () {
      const User = this.customSequelize.define('User', {
        id1: {
          primaryKey: true,
          type: DataTypes.UUID,
          defaultValue: sql.uuidV4,
        },
        id2: {
          primaryKey: true,
          type: DataTypes.UUID,
          defaultValue: sql.uuidV4,
        },
        email: {
          type: DataTypes.UUID,
          defaultValue: sql.uuidV4,
        },
      });

      await this.customSequelize.sync({ force: true });
      const user = await User.create({});
      expect(user).to.be.ok;
      expect(user.id1).to.be.ok;
      expect(user.id2).to.be.ok;
    });

    it('should return an error for a unique constraint error', async function () {
      const User = this.customSequelize.define('User', {
        email: {
          type: DataTypes.STRING,
          unique: { name: 'email', msg: 'Email is already registered.' },
          validate: {
            notEmpty: true,
            isEmail: true,
          },
        },
      });

      await this.customSequelize.sync({ force: true });
      await User.create({ email: 'hello@sequelize.com' });

      try {
        await User.create({ email: 'hello@sequelize.com' });
        assert(false);
      } catch (error) {
        expect(error).to.be.ok;
        expect(error).to.be.an.instanceof(Error);
      }
    });

    it('runs validation', async function () {
      const User = this.customSequelize.define('User', {
        email: {
          type: DataTypes.STRING,
          validate: {
            isEmail: true,
          },
        },
      });

      const error = await expect(User.create({ email: 'invalid' })).to.be.rejectedWith(
        Sequelize.ValidationError,
      );
      expect(error.get('email')).to.be.instanceof(Array);
      expect(error.get('email')[0]).to.exist;
      expect(error.get('email')[0].message).to.equal('Validation isEmail on email failed');
    });

    it('works without any primary key', async function () {
      const Log = this.customSequelize.define('log', {
        level: DataTypes.STRING,
      });

      Log.removeAttribute('id');

      await this.customSequelize.sync({ force: true });

      await Promise.all([
        Log.create({ level: 'info' }),
        Log.bulkCreate([{ level: 'error' }, { level: 'debug' }]),
      ]);

      const logs = await Log.findAll();
      for (const log of logs) {
        expect(log.get('id')).not.to.be.ok;
      }
    });

    it('should be able to set createdAt and updatedAt if using silent: true', async function () {
      const User = this.customSequelize.define(
        'user',
        {
          name: DataTypes.STRING,
        },
        {
          timestamps: true,
        },
      );

      const createdAt = new Date(2012, 10, 10, 10, 10, 10);
      const updatedAt = new Date(2011, 11, 11, 11, 11, 11);

      await User.sync({ force: true });

      const user = await User.create(
        {
          createdAt,
          updatedAt,
        },
        {
          silent: true,
        },
      );

      expect(createdAt.getTime()).to.equal(user.get('createdAt').getTime());
      expect(updatedAt.getTime()).to.equal(user.get('updatedAt').getTime());

      const user0 = await User.findOne({
        where: {
          updatedAt: {
            [Op.ne]: null,
          },
        },
      });

      expect(createdAt.getTime()).to.equal(user0.get('createdAt').getTime());
      expect(updatedAt.getTime()).to.equal(user0.get('updatedAt').getTime());
    });

    it('works with custom timestamps with a default value', async function () {
      const User = this.customSequelize.define(
        'User',
        {
          username: DataTypes.STRING,
          date_of_birth: DataTypes.DATE,
          email: DataTypes.STRING,
          password: DataTypes.STRING,
          created_time: {
            type: DataTypes.DATE(3),
            allowNull: false,
            defaultValue: DataTypes.NOW,
          },
          updated_time: {
            type: DataTypes.DATE(3),
            allowNull: false,
            defaultValue: DataTypes.NOW,
          },
        },
        {
          createdAt: 'created_time',
          updatedAt: 'updated_time',
          tableName: 'users',
          underscored: true,
          freezeTableName: true,
          force: false,
        },
      );

      await this.customSequelize.sync({ force: true });

      const user1 = await User.create({});
      await delay(10);
      const user2 = await User.create({});

      for (const user of [user1, user2]) {
        expect(user).to.be.ok;
        expect(user.created_time).to.be.ok;
        expect(user.updated_time).to.be.ok;
      }

      // Timestamps should have milliseconds. However, there is a small chance that
      // it really is 0 for one of them, by coincidence. So we check twice with two
      // users created almost at the same time.
      expect([
        user1.created_time.getMilliseconds(),
        user2.created_time.getMilliseconds(),
      ]).not.to.deep.equal([0, 0]);

      expect([
        user1.updated_time.getMilliseconds(),
        user2.updated_time.getMilliseconds(),
      ]).not.to.deep.equal([0, 0]);
    });

    it('works with custom timestamps and underscored', async function () {
      const User = this.customSequelize.define(
        'User',
        {},
        {
          createdAt: 'createdAt',
          updatedAt: 'updatedAt',
          underscored: true,
        },
      );

      await this.customSequelize.sync({ force: true });
      const user = await User.create({});
      expect(user).to.be.ok;
      expect(user.createdAt).to.be.ok;
      expect(user.updatedAt).to.be.ok;

      expect(user.created_at).not.to.be.ok;
      expect(user.updated_at).not.to.be.ok;
    });

    if (current.dialect.supports.transactions) {
      it('supports transactions', async function () {
        const t = await this.customSequelize.startUnmanagedTransaction();
        await this.User.create({ username: 'user' }, { transaction: t });
        const count = await this.User.count();
        expect(count).to.equal(0);
        await t.commit();
        const count0 = await this.User.count();
        expect(count0).to.equal(1);
      });
    }

    if (current.dialect.supports.returnValues) {
      describe('return values', () => {
        it('should make the autoincremented values available on the returned instances', async function () {
          const User = this.customSequelize.define('user', {});

          await User.sync({ force: true });
          const user = await User.create({}, { returning: true });
          expect(user.get('id')).to.be.ok;
          expect(user.get('id')).to.equal(1);
        });

        it('should make the autoincremented values available on the returned instances with custom fields', async function () {
          const User = this.customSequelize.define('user', {
            maId: {
              type: DataTypes.INTEGER,
              primaryKey: true,
              autoIncrement: true,
              field: 'yo_id',
            },
          });

          await User.sync({ force: true });
          const user = await User.create({}, { returning: true });
          expect(user.get('maId')).to.be.ok;
          expect(user.get('maId')).to.equal(1);
        });
      });
    }

    it('is possible to use casting when creating an instance', async function () {
      const type = ['mysql', 'mariadb'].includes(dialectName) ? 'signed' : 'integer';
      const bindParam =
        dialectName === 'postgres'
          ? '$1'
          : dialectName === 'sqlite3'
            ? '$sequelize_1'
            : dialectName === 'mssql'
              ? '@sequelize_1'
              : '?';
      let match = false;

      const user = await this.User.create(
        {
          intVal: this.customSequelize.cast('1', type),
        },
        {
          logging(sql) {
            expect(sql).to.include(`CAST(${bindParam} AS ${type.toUpperCase()})`);
            match = true;
          },
        },
      );

      const user0 = await this.User.findByPk(user.id);
      expect(user0.intVal).to.equal(1);
      expect(match).to.equal(true);
    });

    it('is possible to use casting multiple times mixed in with other utilities', async function () {
      let type = this.customSequelize.cast(
        this.customSequelize.cast(this.customSequelize.literal('1-2'), 'integer'),
        'integer',
      );
      let match = false;

      if (['mysql', 'mariadb'].includes(dialectName)) {
        type = this.customSequelize.cast(
          this.customSequelize.cast(this.customSequelize.literal('1-2'), 'unsigned'),
          'signed',
        );
      }

      const user = await this.User.create(
        {
          intVal: type,
        },
        {
          logging(sql) {
            if (['mysql', 'mariadb'].includes(dialectName)) {
              expect(sql).to.contain('CAST(CAST(1-2 AS UNSIGNED) AS SIGNED)');
            } else {
              expect(sql).to.contain('CAST(CAST(1-2 AS INTEGER) AS INTEGER)');
            }

            match = true;
          },
        },
      );

      const user0 = await this.User.findByPk(user.id);
      expect(user0.intVal).to.equal(-1);
      expect(match).to.equal(true);
    });

    it('is possible to just use .literal() to bypass escaping', async function () {
      const user = await this.User.create({
        intVal: this.customSequelize.literal(
          `CAST(1-2 AS ${dialectName === 'mysql' ? 'SIGNED' : 'INTEGER'})`,
        ),
      });

      const user0 = await this.User.findByPk(user.id);
      expect(user0.intVal).to.equal(-1);
    });

    it('is possible to use funtions when creating an instance', async function () {
      const user = await this.User.create({
        secretValue: this.customSequelize.fn('upper', 'sequelize'),
      });

      const user0 = await this.User.findByPk(user.id);
      expect(user0.secretValue).to.equal('SEQUELIZE');
    });

    it('should escape $ in sequelize functions arguments', async function () {
      const user = await this.User.create({
        secretValue: this.customSequelize.fn('upper', '$sequelize'),
      });

      const user0 = await this.User.findByPk(user.id);
      expect(user0.secretValue).to.equal('$SEQUELIZE');
    });

    it('should work with a non-id named uuid primary key columns', async function () {
      const Monkey = this.customSequelize.define('Monkey', {
        monkeyId: {
          type: DataTypes.UUID,
          primaryKey: true,
          defaultValue: sql.uuidV4,
          allowNull: false,
        },
      });

      await this.customSequelize.sync({ force: true });
      const monkey = await Monkey.create();
      expect(monkey.get('monkeyId')).to.be.ok;
    });

    it('is possible to use functions as default values', async function () {
      let userWithDefaults;

      if (dialectName.startsWith('postgres')) {
        await this.customSequelize.query('CREATE EXTENSION IF NOT EXISTS "uuid-ossp"');
        userWithDefaults = this.customSequelize.define('userWithDefaults', {
          uuid: {
            type: 'UUID',
            defaultValue: this.customSequelize.fn('uuid_generate_v4'),
          },
        });

        await userWithDefaults.sync({ force: true });
        const user = await userWithDefaults.create({});
        // uuid validation regex taken from http://stackoverflow.com/a/13653180/800016
        expect(user.uuid).to.match(
          /^[\da-f]{8}-[\da-f]{4}-[1-5][\da-f]{3}-[89ab][\da-f]{3}-[\da-f]{12}$/i,
        );

        return;
      }

      if (dialectName === 'sqlite3') {
        // The definition here is a bit hacky. sqlite expects () around the expression for default values, so we call a function without a name
        // to enclose the date function in (). http://www.sqlite.org/syntaxdiagrams.html#column-constraint
        userWithDefaults = this.customSequelize.define('userWithDefaults', {
          year: {
            type: DataTypes.STRING,
            defaultValue: this.customSequelize.fn('', this.customSequelize.fn('date', 'now')),
          },
        });

        await userWithDefaults.sync({ force: true });
        const user = await userWithDefaults.create({});
        const user0 = await userWithDefaults.findByPk(user.id);
        const now = new Date();
        const pad = number => number.toString().padStart(2, '0');

        expect(user0.year).to.equal(
          `${now.getUTCFullYear()}-${pad(now.getUTCMonth() + 1)}-${pad(now.getUTCDate())}`,
        );
      }
      // functions as default values are not supported in mysql, see http://stackoverflow.com/a/270338/800016
    });

    if (dialectName === 'postgres') {
      it('does not cast arrays for postgresql insert', async function () {
        const User = this.customSequelize.define('UserWithArray', {
          myvals: { type: DataTypes.ARRAY(DataTypes.INTEGER) },
          mystr: { type: DataTypes.ARRAY(DataTypes.STRING) },
        });

        let test = false;
        await User.sync({ force: true });

        await User.create(
          { myvals: [], mystr: [] },
          {
            logging(sql) {
              test = true;
              expect(sql).to.contain(
                'INSERT INTO "UserWithArrays" ("id","myvals","mystr","createdAt","updatedAt") VALUES (DEFAULT,$1,$2,$3,$4)',
              );
            },
          },
        );

        expect(test).to.be.true;
      });

      it('does not cast arrays for postgres update', async function () {
        const User = this.customSequelize.define('UserWithArray', {
          myvals: { type: DataTypes.ARRAY(DataTypes.INTEGER) },
          mystr: { type: DataTypes.ARRAY(DataTypes.STRING) },
        });
        let test = false;

        await User.sync({ force: true });
        const user = await User.create({
          myvals: [1, 2, 3, 4],
          mystr: ['One', 'Two', 'Three', 'Four'],
        });
        user.myvals = [];
        user.mystr = [];

        await user.save({
          logging(sql) {
            test = true;
            expect(sql).to.contain(
              'UPDATE "UserWithArrays" SET "myvals"=$1,"mystr"=$2,"updatedAt"=$3 WHERE "id" = $4',
            );
          },
        });

        expect(test).to.be.true;
      });
    }

    it("doesn't allow duplicated records with unique:true", async function () {
      const User = this.customSequelize.define('UserWithUniqueUsername', {
        username: { type: DataTypes.STRING, unique: true },
      });

      await User.sync({ force: true });
      await User.create({ username: 'foo' });

      try {
        await User.create({ username: 'foo' });
      } catch (error) {
        if (!(error instanceof Sequelize.UniqueConstraintError)) {
          throw error;
        }

        expect(error).to.be.ok;
      }
    });

    if (dialect.supports.dataTypes.CITEXT) {
      it(`doesn't allow case-insensitive duplicated records using CITEXT`, async function () {
        const User = this.customSequelize.define('UserWithUniqueCITEXT', {
          username: { type: DataTypes.CITEXT, unique: true },
        });

        try {
          await User.sync({ force: true });
          await User.create({ username: 'foo' });
          await User.create({ username: 'fOO' });
        } catch (error) {
          if (!(error instanceof Sequelize.UniqueConstraintError)) {
            throw error;
          }

          expect(error).to.be.ok;
        }
      });
    }

    if (dialectName === 'postgres') {
      it('allows the creation of a TSVECTOR field', async function () {
        const User = this.customSequelize.define('UserWithTSVECTOR', {
          name: DataTypes.TSVECTOR,
        });

        await User.sync({ force: true });
        await User.create({ name: 'John Doe' });
      });

      it('TSVECTOR only allow string', async function () {
        const User = this.customSequelize.define('UserWithTSVECTOR', {
          username: { type: DataTypes.TSVECTOR },
        });

        try {
          await User.sync({ force: true });
          await User.create({ username: 42 });
        } catch (error) {
          if (!(error instanceof Sequelize.ValidationError)) {
            throw error;
          }

          expect(error).to.be.ok;
        }
      });
    }

    if (current.dialect.supports.index.functionBased) {
      it(`doesn't allow duplicated records with unique function based indexes`, async function () {
        const User = this.customSequelize.define('UserWithUniqueUsernameFunctionIndex', {
          username: DataTypes.STRING,
          email: { type: DataTypes.STRING, unique: true },
        });

        try {
          await User.sync({ force: true });
          await this.customSequelize.query(
            `CREATE UNIQUE INDEX lower_case_username ON ${this.customSequelize.queryGenerator.quoteTable(User)} ((lower("username")))`,
          );
          await User.create({ username: 'foo' });
          await User.create({ username: 'foo' });
        } catch (error) {
          if (!(error instanceof Sequelize.UniqueConstraintError)) {
            throw error;
          }

          expect(error).to.be.ok;
        }
      });
    }

    it('raises an error if created object breaks definition constraints', async function () {
      const UserNull = this.customSequelize.define('UserWithNonNullSmth', {
        username: { type: DataTypes.STRING, unique: true },
        smth: { type: DataTypes.STRING, allowNull: false },
      });

      await UserNull.sync({ force: true });

      try {
        await UserNull.create({ username: 'foo2', smth: null });
      } catch (error) {
        expect(error).to.exist;

        const smth1 = error.get('smth')[0] || {};

        expect(smth1.path).to.equal('smth');
        expect(smth1.type || smth1.origin).to.match(/notNull violation/);
      }
    });

    it('raises an error if created object breaks definition constraints', async function () {
      const UserNull = this.customSequelize.define('UserWithNonNullSmth', {
        username: { type: DataTypes.STRING, unique: true },
        smth: { type: DataTypes.STRING, allowNull: false },
      });

      await UserNull.sync({ force: true });
      await UserNull.create({ username: 'foo', smth: 'foo' });

      try {
        await UserNull.create({ username: 'foo', smth: 'bar' });
      } catch (error) {
        if (!(error instanceof Sequelize.UniqueConstraintError)) {
          throw error;
        }

        expect(error).to.be.ok;
      }
    });

    it('raises an error if saving an empty string into a column allowing null or URL', async function () {
      const StringIsNullOrUrl = this.customSequelize.define('StringIsNullOrUrl', {
        str: { type: DataTypes.STRING, allowNull: true, validate: { isURL: true } },
      });

      await StringIsNullOrUrl.sync({ force: true });
      const str1 = await StringIsNullOrUrl.create({ str: null });
      expect(str1.str).to.be.null;
      const str2 = await StringIsNullOrUrl.create({ str: 'http://sequelizejs.org' });
      expect(str2.str).to.equal('http://sequelizejs.org');

      try {
        await StringIsNullOrUrl.create({ str: '' });
      } catch (error) {
        expect(error).to.exist;
        expect(error.get('str')[0].message).to.match(/Validation isURL on str failed/);
      }
    });

    if (current.dialect.supports.dataTypes.BIGINT) {
      it('sets a 64 bit int in bigint', async function () {
        const User = this.customSequelize.define('UserWithBigIntFields', {
          big: DataTypes.BIGINT,
        });

        await User.sync({ force: true });
        const user = await User.create({ big: '9223372036854775807' });
        expect(user.big).to.equal('9223372036854775807');
      });
    }

    it('sets auto increment fields', async function () {
      const User = this.customSequelize.define('UserWithAutoIncrementField', {
        userid: {
          type: DataTypes.INTEGER,
          autoIncrement: true,
          primaryKey: true,
          allowNull: false,
        },
      });

      await User.sync({ force: true });
      const user = await User.create({});
      expect(user.userid).to.equal(1);
      const user0 = await User.create({});
      expect(user0.userid).to.equal(2);
    });

    it('allows the usage of options as attribute', async function () {
      const User = this.customSequelize.define('UserWithNameAndOptions', {
        name: DataTypes.STRING,
        options: DataTypes.TEXT,
      });

      const options = JSON.stringify({ foo: 'bar', bar: 'foo' });

      await User.sync({ force: true });

      const user = await User.create({ name: 'John Doe', options });

      expect(user.options).to.equal(options);
    });

    it('allows sql logging', async function () {
      const User = this.customSequelize.define('UserWithUniqueNameAndNonNullSmth', {
        name: { type: DataTypes.STRING, unique: true },
        smth: { type: DataTypes.STRING, allowNull: false },
      });

      let test = false;
      await User.sync({ force: true });

      await User.create(
        { name: 'Fluffy Bunny', smth: 'else' },
        {
          logging(sql) {
            expect(sql).to.exist;
            test = true;
            expect(sql.toUpperCase()).to.contain('INSERT');
          },
        },
      );

      expect(test).to.be.true;
    });

    it('should only store the values passed in the whitelist', async function () {
      // A unique column do not accept NULL in Db2. Unique column must have value in insert statement.
      const data = { username: 'Peter', secretValue: '42', uniqueName: 'name' };
      const fields =
        dialectName === 'db2' ? { fields: ['username', 'uniqueName'] } : { fields: ['username'] };

      const user = await this.User.create(data, fields);
      const _user = await this.User.findByPk(user.id);
      expect(_user.username).to.equal(data.username);
      expect(_user.secretValue).not.to.equal(data.secretValue);
      expect(_user.secretValue).to.equal(null);
    });

    it('should store all values if no whitelist is specified', async function () {
      const data = { username: 'Peter', secretValue: '42' };

      const user = await this.User.create(data);
      const _user = await this.User.findByPk(user.id);
      expect(_user.username).to.equal(data.username);
      expect(_user.secretValue).to.equal(data.secretValue);
    });

    it('can omit autoincremental columns', async function () {
      const data = { title: 'Iliad' };
      const dataTypes = [DataTypes.INTEGER];
      const sync = [];
      const promises = [];
      const books = [];

      if (current.dialect.supports.dataTypes.BIGINT) {
        dataTypes.push(DataTypes.BIGINT);
      }

      for (const [index, dataType] of dataTypes.entries()) {
        books[index] = this.customSequelize.define(`Book${index}`, {
          id: { type: dataType, primaryKey: true, autoIncrement: true },
          title: DataTypes.TEXT,
        });
      }

      for (const b of books) {
        sync.push(b.sync({ force: true }));
      }

      await Promise.all(sync);
      for (const [index, b] of books.entries()) {
        promises.push(
          (async () => {
            const book = await b.create(data);
            expect(book.title).to.equal(data.title);
            expect(book.author).to.equal(data.author);
            expect(books[index].getAttributes().id.type instanceof dataTypes[index]).to.be.ok;
          })(),
        );
      }

      await Promise.all(promises);
    });

    it('saves data with single quote', async function () {
      const quote = "single'quote";

      const user = await this.User.create({ data: quote });
      expect(user.data).to.equal(quote);
      const user0 = await this.User.findOne({ where: { id: user.id } });
      expect(user0.data).to.equal(quote);
    });

    it('saves data with double quote', async function () {
      const quote = 'double"quote';

      const user = await this.User.create({ data: quote });
      expect(user.data).to.equal(quote);
      const user0 = await this.User.findOne({ where: { id: user.id } });
      expect(user0.data).to.equal(quote);
    });

    it('saves stringified JSON data', async function () {
      const json = JSON.stringify({ key: 'value' });

      const user = await this.User.create({ data: json });
      expect(user.data).to.equal(json);
      const user0 = await this.User.findOne({ where: { id: user.id } });
      expect(user0.data).to.equal(json);
    });

    it('stores the current date in createdAt', async function () {
      const user = await this.User.create({ username: 'foo' });
      expect(Number.parseInt(Number(user.createdAt) / 5000, 10)).to.be.closeTo(
        Number.parseInt(Date.now() / 5000, 10),
        1.5,
      );
    });

    it('allows setting custom IDs', async function () {
      const user = await this.User.create({ id: 42 });
      expect(user.id).to.equal(42);
      const user0 = await this.User.findByPk(42);
      expect(user0).to.exist;
    });

    it('should allow blank creates (with timestamps: false)', async function () {
      const Worker = this.customSequelize.define('Worker', {}, { timestamps: false });
      await Worker.sync();
      const worker = await Worker.create({}, { fields: [] });
      expect(worker).to.be.ok;
    });

    it('should allow truly blank creates', async function () {
      const Worker = this.customSequelize.define('Worker', {}, { timestamps: false });
      await Worker.sync();
      const worker = await Worker.create({}, { fields: [] });
      expect(worker).to.be.ok;
    });

    it('should only set passed fields', async function () {
      const User = this.customSequelize.define('User', {
        email: {
          type: DataTypes.STRING,
        },
        name: {
          type: DataTypes.STRING,
        },
      });

      await this.customSequelize.sync({ force: true });

      const user = await User.create(
        {
          name: 'Yolo Bear',
          email: 'yolo@bear.com',
        },
        {
          fields: ['name'],
        },
      );

      expect(user.name).to.be.ok;
      expect(user.email).not.to.be.ok;
      const user0 = await User.findByPk(user.id);
      expect(user0.name).to.be.ok;
      expect(user0.email).not.to.be.ok;
    });

    it('Works even when SQL query has a values of transaction keywords such as BEGIN TRANSACTION', async function () {
      const Task = this.customSequelize.define('task', {
        title: DataTypes.STRING,
      });
      await Task.sync({ force: true });

      const newTasks = await Promise.all([
        Task.create({ title: 'BEGIN TRANSACTION' }),
        Task.create({ title: 'COMMIT TRANSACTION' }),
        Task.create({ title: 'ROLLBACK TRANSACTION' }),
        Task.create({ title: 'SAVE TRANSACTION' }),
      ]);

      expect(newTasks).to.have.lengthOf(4);
      expect(newTasks[0].title).to.equal('BEGIN TRANSACTION');
      expect(newTasks[1].title).to.equal('COMMIT TRANSACTION');
      expect(newTasks[2].title).to.equal('ROLLBACK TRANSACTION');
      expect(newTasks[3].title).to.equal('SAVE TRANSACTION');
    });

    describe('enums', () => {
      it('correctly restores enum values', async function () {
        const Item = this.customSequelize.define('Item', {
          state: { type: DataTypes.ENUM(['available', 'in_cart', 'shipped']) },
        });

        await Item.sync({ force: true });
        const _item = await Item.create({ state: 'available' });
        const item = await Item.findOne({ where: { state: 'available' } });
        expect(item.id).to.equal(_item.id);
      });

      it('allows null values', async function () {
        const Enum = this.customSequelize.define('Enum', {
          state: {
            type: DataTypes.ENUM(['happy', 'sad']),
            allowNull: true,
          },
        });

        await Enum.sync({ force: true });
        const _enum = await Enum.create({ state: null });
        expect(_enum.state).to.be.null;
      });

      describe('when defined via { field: DataTypes.ENUM }', () => {
        it('allows values passed as parameters', async function () {
          const Enum = this.customSequelize.define('Enum', {
            state: DataTypes.ENUM('happy', 'sad'),
          });

          await Enum.sync({ force: true });

          await Enum.create({ state: 'happy' });
        });

        it('allows values passed as an array', async function () {
          const Enum = this.customSequelize.define('Enum', {
            state: DataTypes.ENUM(['happy', 'sad']),
          });

          await Enum.sync({ force: true });

          await Enum.create({ state: 'happy' });
        });
      });

      describe('when defined via { field: { type: DataTypes.ENUM } }', () => {
        it('allows values passed as parameters', async function () {
          const Enum = this.customSequelize.define('Enum', {
            state: {
              type: DataTypes.ENUM('happy', 'sad'),
            },
          });

          await Enum.sync({ force: true });

          await Enum.create({ state: 'happy' });
        });

        it('allows values passed as an array', async function () {
          const Enum = this.customSequelize.define('Enum', {
            state: {
              type: DataTypes.ENUM(['happy', 'sad']),
            },
          });

          await Enum.sync({ force: true });

          await Enum.create({ state: 'happy' });
        });
      });

      describe('can safely sync multiple times', () => {
        it('through the factory', async function () {
          const Enum = this.customSequelize.define('Enum', {
            state: {
              type: DataTypes.ENUM(['happy', 'sad']),
              allowNull: true,
            },
          });

          await Enum.sync({ force: true });
          await Enum.sync();

          await Enum.sync({ force: true });
        });

        it('through sequelize', async function () {
          this.customSequelize.define('Enum', {
            state: {
              type: DataTypes.ENUM(['happy', 'sad']),
              allowNull: true,
            },
          });

          await this.customSequelize.sync({ force: true });
          await this.customSequelize.sync();

          await this.customSequelize.sync({ force: true });
        });
      });
    });
  });

  it('should return autoIncrement primary key (create)', async function () {
    const Maya = this.customSequelize.define('Maya', {});

    const M1 = {};

    await Maya.sync({ force: true });
    const m = await Maya.create(M1, { returning: true });
    expect(m.id).to.be.eql(1);
  });

  it('should support logging', async function () {
    const spy = sinon.spy();

    await this.User.create(
      {},
      {
        logging: spy,
      },
    );

    expect(spy.called).to.be.ok;
  });

  if (current.dialect.supports.returnValues) {
    it('should return default value set by the database (create)', async function () {
      const User = this.customSequelize.define('User', {
        name: DataTypes.STRING,
        code: { type: DataTypes.INTEGER, defaultValue: Sequelize.literal(2020) },
      });

      await User.sync({ force: true });

      const user = await User.create({ name: 'FooBar' });

      expect(user.name).to.equal('FooBar');
      expect(user.code).to.equal(2020);
    });
  }
});
