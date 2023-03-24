'use strict';

const chai = require('chai'),
  sinon = require('sinon'),
  Sequelize = require('sequelize'),
  expect = chai.expect,
  Support = require('../support'),
  DataTypes = require('sequelize/lib/data-types'),
  dialect = Support.getTestDialect(),
  Op = Sequelize.Op,
  _ = require('lodash'),
  delay = require('delay'),
  assert = require('assert'),
  current = Support.sequelize,
  pTimeout = require('p-timeout');

describe(Support.getTestDialectTeaser('Model'), () => {
  beforeEach(async function() {
    const sequelize = await Support.prepareTransactionTest(this.sequelize);
    this.sequelize = sequelize;

    this.User = this.sequelize.define('User', {
      username: DataTypes.STRING,
      secretValue: DataTypes.STRING,
      data: DataTypes.STRING,
      intVal: DataTypes.INTEGER,
      theDate: DataTypes.DATE,
      aBool: DataTypes.BOOLEAN,
      uniqueName: { type: DataTypes.STRING, unique: true }
    });
    this.Account = this.sequelize.define('Account', {
      accountName: DataTypes.STRING
    });
    this.Student = this.sequelize.define('Student', {
      no: { type: DataTypes.INTEGER, primaryKey: true },
      name: { type: DataTypes.STRING, allowNull: false }
    });

    await this.sequelize.sync({ force: true });
  });

  describe('findOrCreate', () => {
    if (current.dialect.supports.transactions) {
      it('supports transactions', async function() {
        const t = await this.sequelize.transaction();

        await this.User.findOrCreate({
          where: {
            username: 'Username'
          },
          defaults: {
            data: 'some data'
          },
          transaction: t
        });

        const count = await this.User.count();
        expect(count).to.equal(0);
        await t.commit();
        const count0 = await this.User.count();
        expect(count0).to.equal(1);
      });

      it('supports more than one models per transaction', async function() {
        const t = await this.sequelize.transaction();
        await this.User.findOrCreate({ where: { username: 'Username' }, defaults: { data: 'some data' }, transaction: t });
        await this.Account.findOrCreate({ where: { accountName: 'accountName' }, transaction: t });
        await t.commit();
      });
    }

    it('should error correctly when defaults contain a unique key', async function() {
      const User = this.sequelize.define('user', {
        objectId: {
          type: DataTypes.STRING,
          unique: true
        },
        username: {
          type: DataTypes.STRING,
          unique: true
        }
      });

      await User.sync({ force: true });

      await User.create({
        username: 'gottlieb'
      });

      await expect(User.findOrCreate({
        where: {
          objectId: 'asdasdasd'
        },
        defaults: {
          username: 'gottlieb'
        }
      })).to.eventually.be.rejectedWith(Sequelize.UniqueConstraintError);
    });

    it('should error correctly when defaults contain a unique key and a non-existent field', async function() {
      const User = this.sequelize.define('user', {
        objectId: {
          type: DataTypes.STRING,
          unique: true
        },
        username: {
          type: DataTypes.STRING,
          unique: true
        }
      });

      await User.sync({ force: true });

      await User.create({
        username: 'gottlieb'
      });

      await expect(User.findOrCreate({
        where: {
          objectId: 'asdasdasd'
        },
        defaults: {
          username: 'gottlieb',
          foo: 'bar', // field that's not a defined attribute
          bar: 121
        }
      })).to.eventually.be.rejectedWith(Sequelize.UniqueConstraintError);
    });

    it('should error correctly when defaults contain a unique key and the where clause is complex', async function() {
      const User = this.sequelize.define('user', {
        objectId: {
          type: DataTypes.STRING,
          unique: true
        },
        username: {
          type: DataTypes.STRING,
          unique: true
        }
      });

      await User.sync({ force: true });
      await User.create({ username: 'gottlieb' });

      try {
        await User.findOrCreate({
          where: {
            [Op.or]: [{
              objectId: 'asdasdasd1'
            }, {
              objectId: 'asdasdasd2'
            }]
          },
          defaults: {
            username: 'gottlieb'
          }
        });
      } catch (error) {
        expect(error).to.be.instanceof(Sequelize.UniqueConstraintError);
        expect(error.errors[0].path).to.be.a('string', 'username');
      }
    });

    it('should work with empty uuid primary key in where', async function() {
      const User = this.sequelize.define('User', {
        id: {
          type: DataTypes.UUID,
          primaryKey: true,
          allowNull: false,
          defaultValue: DataTypes.UUIDV4
        },
        name: {
          type: DataTypes.STRING
        }
      });

      await User.sync({ force: true });

      await User.findOrCreate({
        where: {},
        defaults: {
          name: Math.random().toString()
        }
      });
    });

    if (!['sqlite', 'mssql', 'db2'].includes(current.dialect.name)) {
      it('should not deadlock with no existing entries and no outer transaction', async function() {
        const User = this.sequelize.define('User', {
          email: {
            type: DataTypes.STRING,
            unique: 'company_user_email'
          },
          companyId: {
            type: DataTypes.INTEGER,
            unique: 'company_user_email'
          }
        });

        await User.sync({ force: true });

        await Promise.all(_.range(50).map(i => {
          return User.findOrCreate({
            where: {
              email: `unique.email.${i}@sequelizejs.com`,
              companyId: Math.floor(Math.random() * 5)
            }
          });
        }));
      });

      it('should not deadlock with existing entries and no outer transaction', async function() {
        const User = this.sequelize.define('User', {
          email: {
            type: DataTypes.STRING,
            unique: 'company_user_email'
          },
          companyId: {
            type: DataTypes.INTEGER,
            unique: 'company_user_email'
          }
        });

        await User.sync({ force: true });

        await Promise.all(_.range(50).map(i => {
          return User.findOrCreate({
            where: {
              email: `unique.email.${i}@sequelizejs.com`,
              companyId: 2
            }
          });
        }));

        await Promise.all(_.range(50).map(i => {
          return User.findOrCreate({
            where: {
              email: `unique.email.${i}@sequelizejs.com`,
              companyId: 2
            }
          });
        }));
      });

      it('should not deadlock with concurrency duplicate entries and no outer transaction', async function() {
        const User = this.sequelize.define('User', {
          email: {
            type: DataTypes.STRING,
            unique: 'company_user_email'
          },
          companyId: {
            type: DataTypes.INTEGER,
            unique: 'company_user_email'
          }
        });

        await User.sync({ force: true });

        await Promise.all(_.range(50).map(() => {
          return User.findOrCreate({
            where: {
              email: 'unique.email.1@sequelizejs.com',
              companyId: 2
            }
          });
        }));
      });
    }

    it('should support special characters in defaults', async function() {
      const User = this.sequelize.define('user', {
        objectId: {
          type: DataTypes.INTEGER,
          unique: true
        },
        description: {
          type: DataTypes.TEXT
        }
      });

      await User.sync({ force: true });

      await User.findOrCreate({
        where: {
          objectId: 1
        },
        defaults: {
          description: '$$ and !! and :: and ? and ^ and * and \''
        }
      });
    });

    it('should support bools in defaults', async function() {
      const User = this.sequelize.define('user', {
        objectId: {
          type: DataTypes.INTEGER,
          unique: true
        },
        bool: DataTypes.BOOLEAN
      });

      await User.sync({ force: true });

      await User.findOrCreate({
        where: {
          objectId: 1
        },
        defaults: {
          bool: false
        }
      });
    });

    it('returns instance if already existent. Single find field.', async function() {
      const data = {
        username: 'Username'
      };

      const user = await this.User.create(data);

      const [_user, created] = await this.User.findOrCreate({ where: {
        username: user.username
      } });

      expect(_user.id).to.equal(user.id);
      expect(_user.username).to.equal('Username');
      expect(created).to.be.false;
    });

    it('Returns instance if already existent. Multiple find fields.', async function() {
      const data = {
        username: 'Username',
        data: 'ThisIsData'
      };

      const user = await this.User.create(data);
      const [_user, created] = await this.User.findOrCreate({ where: data });
      expect(_user.id).to.equal(user.id);
      expect(_user.username).to.equal('Username');
      expect(_user.data).to.equal('ThisIsData');
      expect(created).to.be.false;
    });

    it('does not include exception catcher in response', async function() {
      const data = {
        username: 'Username',
        data: 'ThisIsData'
      };

      const [user0] = await this.User.findOrCreate({
        where: data,
        defaults: {}
      });

      expect(user0.dataValues.sequelize_caught_exception).to.be.undefined;

      const [user] = await this.User.findOrCreate({
        where: data,
        defaults: {}
      });

      expect(user.dataValues.sequelize_caught_exception).to.be.undefined;
    });

    it('creates new instance with default value.', async function() {
      const data = {
          username: 'Username'
        },
        default_values = {
          data: 'ThisIsData'
        };

      const [user, created] = await this.User.findOrCreate({ where: data, defaults: default_values });
      expect(user.username).to.equal('Username');
      expect(user.data).to.equal('ThisIsData');
      expect(created).to.be.true;
    });

    it('supports .or() (only using default values)', async function() {
      const [user, created] = await this.User.findOrCreate({
        where: Sequelize.or({ username: 'Fooobzz' }, { secretValue: 'Yolo' }),
        defaults: { username: 'Fooobzz', secretValue: 'Yolo' }
      });

      expect(user.username).to.equal('Fooobzz');
      expect(user.secretValue).to.equal('Yolo');
      expect(created).to.be.true;
    });

    it('should ignore option returning', async function() {
      const [user, created] = await this.User.findOrCreate({
        where: { username: 'Username' },
        defaults: { data: 'ThisIsData' },
        returning: false
      });

      expect(user.username).to.equal('Username');
      expect(user.data).to.equal('ThisIsData');
      expect(created).to.be.true;
    });

    if (current.dialect.supports.transactions) {
      it('should release transaction when meeting errors', async function() {
        const test = async times => {
          if (times > 10) {
            return true;
          }

          try {
            return await pTimeout(this.Student.findOrCreate({
              where: {
                no: 1
              }
            }), 1000);
          } catch (e) {
            if (e instanceof Sequelize.ValidationError) return test(times + 1);
            if (e instanceof pTimeout.TimeoutError) throw new Error(e);
            throw e;
          }
        };

        await test(0);
      });
    }

    describe('several concurrent calls', () => {
      if (current.dialect.supports.transactions) {
        it('works with a transaction', async function() {
          const transaction = await this.sequelize.transaction();

          const [first, second] = await Promise.all([
            this.User.findOrCreate({ where: { uniqueName: 'winner' }, transaction }),
            this.User.findOrCreate({ where: { uniqueName: 'winner' }, transaction })
          ]);

          const firstInstance = first[0],
            firstCreated = first[1],
            secondInstance = second[0],
            secondCreated = second[1];

          // Depending on execution order and MAGIC either the first OR the second call should return true
          expect(firstCreated ? !secondCreated : secondCreated).to.be.ok; // XOR

          expect(firstInstance).to.be.ok;
          expect(secondInstance).to.be.ok;

          expect(firstInstance.id).to.equal(secondInstance.id);

          await transaction.commit();
        });
      }

      (!['sqlite', 'mssql', 'db2', 'oracle'].includes(dialect) ? it : it.skip)('should not fail silently with concurrency higher than pool, a unique constraint and a create hook resulting in mismatched values', async function() {
        const User = this.sequelize.define('user', {
          username: {
            type: DataTypes.STRING,
            unique: true,
            field: 'user_name'
          }
        });

        User.beforeCreate(instance => {
          instance.set('username', instance.get('username').trim());
        });

        const spy = sinon.spy();

        const names = [
          'mick ',
          'mick ',
          'mick ',
          'mick ',
          'mick ',
          'mick ',
          'mick '
        ];

        await User.sync({ force: true });

        await Promise.all(
          names.map(async username => {
            try {
              return await User.findOrCreate({ where: { username } });
            } catch (err) {
              spy();
              expect(err.message).to.equal('user#findOrCreate: value used for username was not equal for both the find and the create calls, \'mick \' vs \'mick\'');
            }
          })
        );

        expect(spy).to.have.been.called;
      });

      (dialect !== 'sqlite' ? it : it.skip)('should error correctly when defaults contain a unique key without a transaction', async function() {
        const User = this.sequelize.define('user', {
          objectId: {
            type: DataTypes.STRING,
            unique: true
          },
          username: {
            type: DataTypes.STRING,
            unique: true
          }
        });

        await User.sync({ force: true });

        await User.create({
          username: 'gottlieb'
        });

        return Promise.all([(async () => {
          try {
            await User.findOrCreate({
              where: {
                objectId: 'asdasdasd'
              },
              defaults: {
                username: 'gottlieb'
              }
            });

            throw new Error('I should have ben rejected');
          } catch (err) {
            expect(err instanceof Sequelize.UniqueConstraintError).to.be.ok;
            expect(err.fields).to.be.ok;
          }
        })(), (async () => {
          try {
            await User.findOrCreate({
              where: {
                objectId: 'asdasdasd'
              },
              defaults: {
                username: 'gottlieb'
              }
            });

            throw new Error('I should have ben rejected');
          } catch (err) {
            expect(err instanceof Sequelize.UniqueConstraintError).to.be.ok;
            expect(err.fields).to.be.ok;
          }
        })()]);
      });

      // Creating two concurrent transactions and selecting / inserting from the same table throws sqlite off
      (dialect !== 'sqlite' ? it : it.skip)('works without a transaction', async function() {
        const [first, second] = await Promise.all([
          this.User.findOrCreate({ where: { uniqueName: 'winner' } }),
          this.User.findOrCreate({ where: { uniqueName: 'winner' } })
        ]);

        const firstInstance = first[0],
          firstCreated = first[1],
          secondInstance = second[0],
          secondCreated = second[1];

        // Depending on execution order and MAGIC either the first OR the second call should return true
        expect(firstCreated ? !secondCreated : secondCreated).to.be.ok; // XOR

        expect(firstInstance).to.be.ok;
        expect(secondInstance).to.be.ok;

        expect(firstInstance.id).to.equal(secondInstance.id);
      });
    });
  });

  describe('findCreateFind', () => {
    if (dialect !== 'sqlite') {
      it('[Flaky] should work with multiple concurrent calls', async function() {
        const [
          [instance1, created1],
          [instance2, created2],
          [instance3, created3]
        ] = await Promise.all([
          this.User.findCreateFind({ where: { uniqueName: 'winner' } }),
          this.User.findCreateFind({ where: { uniqueName: 'winner' } }),
          this.User.findCreateFind({ where: { uniqueName: 'winner' } })
        ]);

        // All instances are the same
        // Flaky test: sometimes the id is 2, not 1. Here whe just need to assert
        // all the id1 === id2 === id3
        expect(instance1.id).to.equal(instance2.id);
        expect(instance2.id).to.equal(instance3.id);

        // Only one of the createdN values is true
        expect(!!(created1 ^ created2 ^ created3)).to.be.true;
      });

      if (current.dialect.supports.transactions) {
        it('should work with multiple concurrent calls within a transaction', async function() {
          const t = await this.sequelize.transaction();
          const [
            [instance1, created1],
            [instance2, created2],
            [instance3, created3]
          ] = await Promise.all([
            this.User.findCreateFind({ transaction: t, where: { uniqueName: 'winner' } }),
            this.User.findCreateFind({ transaction: t, where: { uniqueName: 'winner' } }),
            this.User.findCreateFind({ transaction: t, where: { uniqueName: 'winner' } })
          ]);

          await t.commit();

          // All instances are the same
          expect(instance1.id).to.equal(1);
          expect(instance2.id).to.equal(1);
          expect(instance3.id).to.equal(1);
          // Only one of the createdN values is true
          expect(!!(created1 ^ created2 ^ created3)).to.be.true;
        });
      }
    }
  });

  describe('create', () => {
    it('works with multiple non-integer primary keys with a default value', async function() {
      const User = this.sequelize.define('User', {
        'id1': {
          primaryKey: true,
          type: DataTypes.UUID,
          defaultValue: DataTypes.UUIDV4
        },
        'id2': {
          primaryKey: true,
          type: DataTypes.UUID,
          defaultValue: DataTypes.UUIDV4
        },
        'email': {
          type: DataTypes.UUID,
          defaultValue: DataTypes.UUIDV4
        }
      });

      await this.sequelize.sync({ force: true });
      const user = await User.create({});
      expect(user).to.be.ok;
      expect(user.id1).to.be.ok;
      expect(user.id2).to.be.ok;
    });

    it('should return an error for a unique constraint error', async function() {
      const User = this.sequelize.define('User', {
        'email': {
          type: DataTypes.STRING,
          unique: { name: 'email', msg: 'Email is already registered.' },
          validate: {
            notEmpty: true,
            isEmail: true
          }
        }
      });

      await this.sequelize.sync({ force: true });
      await User.create({ email: 'hello@sequelize.com' });

      try {
        await User.create({ email: 'hello@sequelize.com' });
        assert(false);
      } catch (err) {
        expect(err).to.be.ok;
        expect(err).to.be.an.instanceof(Error);
      }
    });

    it('works without any primary key', async function() {
      const Log = this.sequelize.define('log', {
        level: DataTypes.STRING
      });

      Log.removeAttribute('id');

      await this.sequelize.sync({ force: true });

      await Promise.all([Log.create({ level: 'info' }), Log.bulkCreate([
        { level: 'error' },
        { level: 'debug' }
      ])]);

      const logs = await Log.findAll();
      logs.forEach(log => {
        expect(log.get('id')).not.to.be.ok;
      });
    });

    it('should be able to set createdAt and updatedAt if using silent: true', async function() {
      const User = this.sequelize.define('user', {
        name: DataTypes.STRING
      }, {
        timestamps: true
      });

      const createdAt = new Date(2012, 10, 10, 10, 10, 10);
      const updatedAt = new Date(2011, 11, 11, 11, 11, 11);

      await User.sync({ force: true });

      const user = await User.create({
        createdAt,
        updatedAt
      }, {
        silent: true
      });

      expect(createdAt.getTime()).to.equal(user.get('createdAt').getTime());
      expect(updatedAt.getTime()).to.equal(user.get('updatedAt').getTime());

      const user0 = await User.findOne({
        where: {
          updatedAt: {
            [Op.ne]: null
          }
        }
      });

      expect(createdAt.getTime()).to.equal(user0.get('createdAt').getTime());
      expect(updatedAt.getTime()).to.equal(user0.get('updatedAt').getTime());
    });

    it('works with custom timestamps with a default value', async function() {
      const User = this.sequelize.define('User', {
        username: DataTypes.STRING,
        date_of_birth: DataTypes.DATE,
        email: DataTypes.STRING,
        password: DataTypes.STRING,
        created_time: {
          type: DataTypes.DATE,
          allowNull: true,
          defaultValue: DataTypes.NOW
        },
        updated_time: {
          type: DataTypes.DATE,
          allowNull: true,
          defaultValue: DataTypes.NOW
        }
      }, {
        createdAt: 'created_time',
        updatedAt: 'updated_time',
        tableName: 'users',
        underscored: true,
        freezeTableName: true,
        force: false
      });

      await this.sequelize.sync({ force: true });

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
      if (dialect === 'db2') {
        expect([
          user1.created_time.getMilliseconds(),
          user2.created_time.getMilliseconds()
        ]).not.to.equal([0, 0]);
        expect([
          user1.updated_time.getMilliseconds(),
          user2.updated_time.getMilliseconds()
        ]).not.to.equal([0, 0]);
      } else {
        expect([
          user1.created_time.getMilliseconds(),
          user2.created_time.getMilliseconds()
        ]).not.to.deep.equal([0, 0]);
        expect([
          user1.updated_time.getMilliseconds(),
          user2.updated_time.getMilliseconds()
        ]).not.to.deep.equal([0, 0]);
      }
    });

    it('works with custom timestamps and underscored', async function() {
      const User = this.sequelize.define('User', {

      }, {
        createdAt: 'createdAt',
        updatedAt: 'updatedAt',
        underscored: true
      });

      await this.sequelize.sync({ force: true });
      const user = await User.create({});
      expect(user).to.be.ok;
      expect(user.createdAt).to.be.ok;
      expect(user.updatedAt).to.be.ok;

      expect(user.created_at).not.to.be.ok;
      expect(user.updated_at).not.to.be.ok;
    });

    if (current.dialect.supports.transactions) {
      it('supports transactions', async function() {
        const t = await this.sequelize.transaction();
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
        it('should make the autoincremented values available on the returned instances', async function() {
          const User = this.sequelize.define('user', {});

          await User.sync({ force: true });
          const user = await User.create({}, { returning: true });
          expect(user.get('id')).to.be.ok;
          expect(user.get('id')).to.equal(1);
        });

        it('should make the autoincremented values available on the returned instances with custom fields', async function() {
          const User = this.sequelize.define('user', {
            maId: {
              type: DataTypes.INTEGER,
              primaryKey: true,
              autoIncrement: true,
              field: 'yo_id'
            }
          });

          await User.sync({ force: true });
          const user = await User.create({}, { returning: true });
          expect(user.get('maId')).to.be.ok;
          expect(user.get('maId')).to.equal(1);
        });
      });
    }

    it('is possible to use casting when creating an instance', async function() {
      const type = ['mysql', 'mariadb'].includes(dialect) ? 'signed' : 'integer';
      let match = false;

      const user = await this.User.create({
        intVal: this.sequelize.cast('1', type)
      }, {
        logging(sql) {
          expect(sql).to.match(new RegExp(`CAST\\(N?'1' AS ${type.toUpperCase()}\\)`));
          match = true;
        }
      });

      const user0 = await this.User.findByPk(user.id);
      expect(user0.intVal).to.equal(1);
      expect(match).to.equal(true);
    });

    it('is possible to use casting multiple times mixed in with other utilities', async function() {
      let type = this.sequelize.cast(this.sequelize.cast(this.sequelize.literal('1-2'), 'integer'), 'integer'),
        match = false;

      if (['mysql', 'mariadb'].includes(dialect)) {
        type = this.sequelize.cast(this.sequelize.cast(this.sequelize.literal('1-2'), 'unsigned'), 'signed');
      }

      const user = await this.User.create({
        intVal: type
      }, {
        logging(sql) {
          if (['mysql', 'mariadb'].includes(dialect)) {
            expect(sql).to.contain('CAST(CAST(1-2 AS UNSIGNED) AS SIGNED)');
          } else {
            expect(sql).to.contain('CAST(CAST(1-2 AS INTEGER) AS INTEGER)');
          }
          match = true;
        }
      });

      const user0 = await this.User.findByPk(user.id);
      expect(user0.intVal).to.equal(-1);
      expect(match).to.equal(true);
    });

    it('is possible to just use .literal() to bypass escaping', async function() {
      const user = await this.User.create({
        intVal: this.sequelize.literal(`CAST(1-2 AS ${dialect === 'mysql' ? 'SIGNED' : 'INTEGER'})`)
      });

      const user0 = await this.User.findByPk(user.id);
      expect(user0.intVal).to.equal(-1);
    });

    it('is possible to use funtions when creating an instance', async function() {
      const user = await this.User.create({
        secretValue: this.sequelize.fn('upper', 'sequelize')
      });

      const user0 = await this.User.findByPk(user.id);
      expect(user0.secretValue).to.equal('SEQUELIZE');
    });

    it('should escape $ in sequelize functions arguments', async function() {
      const user = await this.User.create({
        secretValue: this.sequelize.fn('upper', '$sequelize')
      });

      const user0 = await this.User.findByPk(user.id);
      expect(user0.secretValue).to.equal('$SEQUELIZE');
    });

    it('should escape multiple instances of $ in sequelize functions arguments', async function() {
      const user = await this.User.create({
        secretValue: this.sequelize.fn('upper', '$sequelize and $sequelize2 and some money $42.69')
      });

      const user0 = await this.User.findByPk(user.id);
      expect(user0.secretValue).to.equal('$SEQUELIZE AND $SEQUELIZE2 AND SOME MONEY $42.69');
    });

    it('should work with a non-id named uuid primary key columns', async function() {
      const Monkey = this.sequelize.define('Monkey', {
        monkeyId: { type: DataTypes.UUID, primaryKey: true, defaultValue: DataTypes.UUIDV4, allowNull: false }
      });

      await this.sequelize.sync({ force: true });
      const monkey = await Monkey.create();
      expect(monkey.get('monkeyId')).to.be.ok;
    });

    it('is possible to use functions as default values', async function() {
      let userWithDefaults;

      if (dialect.startsWith('postgres')) {
        await this.sequelize.query('CREATE EXTENSION IF NOT EXISTS "uuid-ossp"');
        userWithDefaults = this.sequelize.define('userWithDefaults', {
          uuid: {
            type: 'UUID',
            defaultValue: this.sequelize.fn('uuid_generate_v4')
          }
        });

        await userWithDefaults.sync({ force: true });
        const user = await userWithDefaults.create({});
        // uuid validation regex taken from http://stackoverflow.com/a/13653180/800016
        expect(user.uuid).to.match(/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i);
        return;
      }
      if (dialect === 'sqlite') {
        // The definition here is a bit hacky. sqlite expects () around the expression for default values, so we call a function without a name
        // to enclose the date function in (). http://www.sqlite.org/syntaxdiagrams.html#column-constraint
        userWithDefaults = this.sequelize.define('userWithDefaults', {
          year: {
            type: Sequelize.STRING,
            defaultValue: this.sequelize.fn('', this.sequelize.fn('date', 'now'))
          }
        });

        await userWithDefaults.sync({ force: true });
        const user = await userWithDefaults.create({});
        const user0 = await userWithDefaults.findByPk(user.id);
        const now = new Date();
        const pad = number =>  number.toString().padStart(2, '0');

        expect(user0.year).to.equal(`${now.getUTCFullYear()}-${pad(now.getUTCMonth() + 1)}-${pad(now.getUTCDate())}`);

        return;
      }
      // functions as default values are not supported in mysql, see http://stackoverflow.com/a/270338/800016
    });

    if (dialect === 'postgres') {
      it('does not cast arrays for postgresql insert', async function() {
        const User = this.sequelize.define('UserWithArray', {
          myvals: { type: Sequelize.ARRAY(Sequelize.INTEGER) },
          mystr: { type: Sequelize.ARRAY(Sequelize.STRING) }
        });

        let test = false;
        await User.sync({ force: true });

        await User.create({ myvals: [], mystr: [] }, {
          logging(sql) {
            test = true;
            expect(sql).to.contain('INSERT INTO "UserWithArrays" ("id","myvals","mystr","createdAt","updatedAt") VALUES (DEFAULT,$1,$2,$3,$4)');
          }
        });

        expect(test).to.be.true;
      });

      it('does not cast arrays for postgres update', async function() {
        const User = this.sequelize.define('UserWithArray', {
          myvals: { type: Sequelize.ARRAY(Sequelize.INTEGER) },
          mystr: { type: Sequelize.ARRAY(Sequelize.STRING) }
        });
        let test = false;

        await User.sync({ force: true });
        const user = await User.create({ myvals: [1, 2, 3, 4], mystr: ['One', 'Two', 'Three', 'Four'] });
        user.myvals = [];
        user.mystr = [];

        await user.save({
          logging(sql) {
            test = true;
            expect(sql).to.contain('UPDATE "UserWithArrays" SET "myvals"=$1,"mystr"=$2,"updatedAt"=$3 WHERE "id" = $4');
          }
        });

        expect(test).to.be.true;
      });
    }

    it("doesn't allow duplicated records with unique:true", async function() {
      const User = this.sequelize.define('UserWithUniqueUsername', {
        username: { type: Sequelize.STRING, unique: true }
      });

      await User.sync({ force: true });
      await User.create({ username: 'foo' });

      try {
        await User.create({ username: 'foo' });
      } catch (err) {
        if (!(err instanceof Sequelize.UniqueConstraintError)) throw err;
        expect(err).to.be.ok;
      }
    });

    if (['postgres', 'sqlite'].includes(dialect)) {
      it("doesn't allow case-insensitive duplicated records using CITEXT", async function() {
        const User = this.sequelize.define('UserWithUniqueCITEXT', {
          username: { type: Sequelize.CITEXT, unique: true }
        });

        try {
          await User.sync({ force: true });
          await User.create({ username: 'foo' });
          await User.create({ username: 'fOO' });
        } catch (err) {
          if (!(err instanceof Sequelize.UniqueConstraintError)) throw err;
          expect(err).to.be.ok;
        }
      });
    }

    if (dialect === 'postgres') {
      it('allows the creation of a TSVECTOR field', async function() {
        const User = this.sequelize.define('UserWithTSVECTOR', {
          name: Sequelize.TSVECTOR
        });

        await User.sync({ force: true });
        await User.create({ name: 'John Doe' });
      });

      it('TSVECTOR only allow string', async function() {
        const User = this.sequelize.define('UserWithTSVECTOR', {
          username: { type: Sequelize.TSVECTOR }
        });

        try {
          await User.sync({ force: true });
          await User.create({ username: 42 });
        } catch (err) {
          if (!(err instanceof Sequelize.ValidationError)) throw err;
          expect(err).to.be.ok;
        }
      });
    }

    if (current.dialect.supports.index.functionBased) {
      it("doesn't allow duplicated records with unique function based indexes", async function() {
        const User = this.sequelize.define('UserWithUniqueUsernameFunctionIndex', {
          username: Sequelize.STRING,
          email: { type: Sequelize.STRING, unique: true }
        });

        try {
          await User.sync({ force: true });
          const tableName = User.getTableName();
          await this.sequelize.query(`CREATE UNIQUE INDEX lower_case_username ON "${tableName}" ((lower(username)))`);
          await User.create({ username: 'foo' });
          await User.create({ username: 'foo' });
        } catch (err) {
          if (!(err instanceof Sequelize.UniqueConstraintError)) throw err;
          expect(err).to.be.ok;
        }
      });
    }

    it('raises an error if created object breaks definition constraints', async function() {
      const UserNull = this.sequelize.define('UserWithNonNullSmth', {
        username: { type: Sequelize.STRING, unique: true },
        smth: { type: Sequelize.STRING, allowNull: false }
      });

      this.sequelize.options.omitNull = false;

      await UserNull.sync({ force: true });

      try {
        await UserNull.create({ username: 'foo2', smth: null });
      } catch (err) {
        expect(err).to.exist;

        const smth1 = err.get('smth')[0] || {};

        expect(smth1.path).to.equal('smth');
        expect(smth1.type || smth1.origin).to.match(/notNull Violation/);
      }
    });
    it('raises an error if created object breaks definition constraints', async function() {
      const UserNull = this.sequelize.define('UserWithNonNullSmth', {
        username: { type: Sequelize.STRING, unique: true },
        smth: { type: Sequelize.STRING, allowNull: false }
      });

      this.sequelize.options.omitNull = false;

      await UserNull.sync({ force: true });
      await UserNull.create({ username: 'foo', smth: 'foo' });

      try {
        await UserNull.create({ username: 'foo', smth: 'bar' });
      } catch (err) {
        if (!(err instanceof Sequelize.UniqueConstraintError)) throw err;
        expect(err).to.be.ok;
      }
    });

    it('raises an error if saving an empty string into a column allowing null or URL', async function() {
      const StringIsNullOrUrl = this.sequelize.define('StringIsNullOrUrl', {
        str: { type: Sequelize.STRING, allowNull: true, validate: { isURL: true } }
      });

      this.sequelize.options.omitNull = false;

      await StringIsNullOrUrl.sync({ force: true });
      const str1 = await StringIsNullOrUrl.create({ str: null });
      expect(str1.str).to.be.null;
      const str2 = await StringIsNullOrUrl.create({ str: 'http://sequelizejs.org' });
      expect(str2.str).to.equal('http://sequelizejs.org');

      try {
        await StringIsNullOrUrl.create({ str: '' });
      } catch (err) {
        expect(err).to.exist;
        expect(err.get('str')[0].message).to.match(/Validation isURL on str failed/);
      }
    });

    it('raises an error if you mess up the datatype', function() {
      expect(() => {
        this.sequelize.define('UserBadDataType', {
          activity_date: Sequelize.DATe
        });
      }).to.throw(Error, 'Unrecognized datatype for attribute "UserBadDataType.activity_date"');

      expect(() => {
        this.sequelize.define('UserBadDataType', {
          activity_date: { type: Sequelize.DATe }
        });
      }).to.throw(Error, 'Unrecognized datatype for attribute "UserBadDataType.activity_date"');
    });

    it('sets a 64 bit int in bigint', async function() {
      const User = this.sequelize.define('UserWithBigIntFields', {
        big: Sequelize.BIGINT
      });

      await User.sync({ force: true });
      const user = await User.create({ big: '9223372036854775807' });
      expect(user.big).to.be.equal('9223372036854775807');
    });

    it('sets auto increment fields', async function() {
      const User = this.sequelize.define('UserWithAutoIncrementField', {
        userid: { type: Sequelize.INTEGER, autoIncrement: true, primaryKey: true, allowNull: false }
      });

      await User.sync({ force: true });
      const user = await User.create({});
      expect(user.userid).to.equal(1);
      const user0 = await User.create({});
      expect(user0.userid).to.equal(2);
    });

    it('allows the usage of options as attribute', async function() {
      const User = this.sequelize.define('UserWithNameAndOptions', {
        name: Sequelize.STRING,
        options: Sequelize.TEXT
      });

      const options = JSON.stringify({ foo: 'bar', bar: 'foo' });

      await User.sync({ force: true });

      const user = await User
        .create({ name: 'John Doe', options });

      expect(user.options).to.equal(options);
    });

    it('allows sql logging', async function() {
      const User = this.sequelize.define('UserWithUniqueNameAndNonNullSmth', {
        name: { type: Sequelize.STRING, unique: true },
        smth: { type: Sequelize.STRING, allowNull: false }
      });

      let test = false;
      await User.sync({ force: true });

      await User
        .create({ name: 'Fluffy Bunny', smth: 'else' }, {
          logging(sql) {
            expect(sql).to.exist;
            test = true;
            expect(sql.toUpperCase()).to.contain('INSERT');
          }
        });

      expect(test).to.be.true;
    });

    it('should only store the values passed in the whitelist', async function() {
      // A unique column do not accept NULL in Db2. Unique column must have value in insert statement.
      const data = { username: 'Peter', secretValue: '42', uniqueName: 'name' };
      const fields = dialect === 'db2' ? { fields: ['username', 'uniqueName'] } : { fields: ['username'] };

      const user = await this.User.create(data, fields);
      const _user = await this.User.findByPk(user.id);
      expect(_user.username).to.equal(data.username);
      expect(_user.secretValue).not.to.equal(data.secretValue);
      expect(_user.secretValue).to.equal(null);
    });

    it('should store all values if no whitelist is specified', async function() {
      const data = { username: 'Peter', secretValue: '42' };

      const user = await this.User.create(data);
      const _user = await this.User.findByPk(user.id);
      expect(_user.username).to.equal(data.username);
      expect(_user.secretValue).to.equal(data.secretValue);
    });

    it('can omit autoincremental columns', async function() {
      const data = { title: 'Iliad' },
        dataTypes = [Sequelize.INTEGER, Sequelize.BIGINT],
        sync = [],
        promises = [],
        books = [];

      dataTypes.forEach((dataType, index) => {
        books[index] = this.sequelize.define(`Book${index}`, {
          id: { type: dataType, primaryKey: true, autoIncrement: true },
          title: Sequelize.TEXT
        });
      });

      books.forEach(b => {
        sync.push(b.sync({ force: true }));
      });

      await Promise.all(sync);
      books.forEach((b, index) => {
        promises.push((async () => {
          const book = await b.create(data);
          expect(book.title).to.equal(data.title);
          expect(book.author).to.equal(data.author);
          expect(books[index].rawAttributes.id.type instanceof dataTypes[index]).to.be.ok;
        })());
      });

      await Promise.all(promises);
    });

    it('saves data with single quote', async function() {
      const quote = "single'quote";

      const user = await this.User.create({ data: quote });
      expect(user.data).to.equal(quote);
      const user0 = await this.User.findOne({ where: { id: user.id } });
      expect(user0.data).to.equal(quote);
    });

    it('saves data with double quote', async function() {
      const quote = 'double"quote';

      const user = await this.User.create({ data: quote });
      expect(user.data).to.equal(quote);
      const user0 = await this.User.findOne({ where: { id: user.id } });
      expect(user0.data).to.equal(quote);
    });

    it('saves stringified JSON data', async function() {
      const json = JSON.stringify({ key: 'value' });

      const user = await this.User.create({ data: json });
      expect(user.data).to.equal(json);
      const user0 = await this.User.findOne({ where: { id: user.id } });
      expect(user0.data).to.equal(json);
    });

    it('stores the current date in createdAt', async function() {
      const user = await this.User.create({ username: 'foo' });
      expect(parseInt(+user.createdAt / 5000, 10)).to.be.closeTo(parseInt(+new Date() / 5000, 10), 1.5);
    });

    it('allows setting custom IDs', async function() {
      const user = await this.User.create({ id: 42 });
      expect(user.id).to.equal(42);
      const user0 = await this.User.findByPk(42);
      expect(user0).to.exist;
    });

    it('should allow blank creates (with timestamps: false)', async function() {
      const Worker = this.sequelize.define('Worker', {}, { timestamps: false });
      await Worker.sync();
      const worker = await Worker.create({}, { fields: [] });
      expect(worker).to.be.ok;
    });

    it('should allow truly blank creates', async function() {
      const Worker = this.sequelize.define('Worker', {}, { timestamps: false });
      await Worker.sync();
      const worker = await Worker.create({}, { fields: [] });
      expect(worker).to.be.ok;
    });

    it('should only set passed fields', async function() {
      const User = this.sequelize.define('User', {
        'email': {
          type: DataTypes.STRING
        },
        'name': {
          type: DataTypes.STRING
        }
      });

      await this.sequelize.sync({ force: true });

      const user = await User.create({
        name: 'Yolo Bear',
        email: 'yolo@bear.com'
      }, {
        fields: ['name']
      });

      expect(user.name).to.be.ok;
      expect(user.email).not.to.be.ok;
      const user0 = await User.findByPk(user.id);
      expect(user0.name).to.be.ok;
      expect(user0.email).not.to.be.ok;
    });

    it('Works even when SQL query has a values of transaction keywords such as BEGIN TRANSACTION', async function() {
      const Task = this.sequelize.define('task', {
        title: DataTypes.STRING
      });
      await Task.sync({ force: true });

      const newTasks = await Promise.all([
        Task.create({ title: 'BEGIN TRANSACTION' }),
        Task.create({ title: 'COMMIT TRANSACTION' }),
        Task.create({ title: 'ROLLBACK TRANSACTION' }),
        Task.create({ title: 'SAVE TRANSACTION' })
      ]);

      expect(newTasks).to.have.lengthOf(4);
      expect(newTasks[0].title).to.equal('BEGIN TRANSACTION');
      expect(newTasks[1].title).to.equal('COMMIT TRANSACTION');
      expect(newTasks[2].title).to.equal('ROLLBACK TRANSACTION');
      expect(newTasks[3].title).to.equal('SAVE TRANSACTION');
    });

    describe('enums', () => {
      it('correctly restores enum values', async function() {
        const Item = this.sequelize.define('Item', {
          state: { type: Sequelize.ENUM, values: ['available', 'in_cart', 'shipped'] }
        });

        await Item.sync({ force: true });
        const _item = await Item.create({ state: 'available' });
        const item = await Item.findOne({ where: { state: 'available' } });
        expect(item.id).to.equal(_item.id);
      });

      it('allows null values', async function() {
        const Enum = this.sequelize.define('Enum', {
          state: {
            type: Sequelize.ENUM,
            values: ['happy', 'sad'],
            allowNull: true
          }
        });

        await Enum.sync({ force: true });
        const _enum = await Enum.create({ state: null });
        expect(_enum.state).to.be.null;
      });

      describe('when defined via { field: Sequelize.ENUM }', () => {
        it('allows values passed as parameters', async function() {
          const Enum = this.sequelize.define('Enum', {
            state: Sequelize.ENUM('happy', 'sad')
          });

          await Enum.sync({ force: true });

          await Enum.create({ state: 'happy' });
        });

        it('allows values passed as an array', async function() {
          const Enum = this.sequelize.define('Enum', {
            state: Sequelize.ENUM(['happy', 'sad'])
          });

          await Enum.sync({ force: true });

          await Enum.create({ state: 'happy' });
        });
      });

      describe('when defined via { field: { type: Sequelize.ENUM } }', () => {
        it('allows values passed as parameters', async function() {
          const Enum = this.sequelize.define('Enum', {
            state: {
              type: Sequelize.ENUM('happy', 'sad')
            }
          });

          await Enum.sync({ force: true });

          await Enum.create({ state: 'happy' });
        });

        it('allows values passed as an array', async function() {
          const Enum = this.sequelize.define('Enum', {
            state: {
              type: Sequelize.ENUM(['happy', 'sad'])
            }
          });

          await Enum.sync({ force: true });

          await Enum.create({ state: 'happy' });
        });
      });

      describe('can safely sync multiple times', () => {
        it('through the factory', async function() {
          const Enum = this.sequelize.define('Enum', {
            state: {
              type: Sequelize.ENUM,
              values: ['happy', 'sad'],
              allowNull: true
            }
          });

          await Enum.sync({ force: true });
          await Enum.sync();

          await Enum.sync({ force: true });
        });

        it('through sequelize', async function() {
          this.sequelize.define('Enum', {
            state: {
              type: Sequelize.ENUM,
              values: ['happy', 'sad'],
              allowNull: true
            }
          });

          await this.sequelize.sync({ force: true });
          await this.sequelize.sync();

          await this.sequelize.sync({ force: true });
        });
      });
    });
  });

  it('should return autoIncrement primary key (create)', async function() {
    const Maya = this.sequelize.define('Maya', {});

    const M1 = {};

    await Maya.sync({ force: true });
    const m = await Maya.create(M1, { returning: true });
    expect(m.id).to.be.eql(1);
  });

  it('should support logging', async function() {
    const spy = sinon.spy();

    await this.User.create({}, {
      logging: spy
    });

    expect(spy.called).to.be.ok;
  });

  if (current.dialect.supports.returnValues) {
    it('should return default value set by the database (create)', async function() {

      const User = this.sequelize.define('User', {
        name: DataTypes.STRING,
        code: { type: Sequelize.INTEGER, defaultValue: Sequelize.literal(2020) }
      });

      await User.sync({ force: true });

      const user = await User.create({ name: 'FooBar' });

      expect(user.name).to.be.equal('FooBar');
      expect(user.code).to.be.equal(2020);
    });
  }
});
