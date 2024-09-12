'use strict';

const chai = require('chai'),
  sinon = require('sinon'),
  Sequelize = require('sequelize'),
  expect = chai.expect,
  Support = require('../support'),
  DataTypes = require('sequelize/lib/data-types'),
  dialect = Support.getTestDialect(),
  current = Support.sequelize;

describe(Support.getTestDialectTeaser('Model'), () => {
  before(function() {
    this.clock = sinon.useFakeTimers();
  });

  after(function() {
    this.clock.restore();
  });

  beforeEach(function() {
    this.clock.reset();
  });

  beforeEach(async function() {
    this.User = this.sequelize.define('user', {
      username: DataTypes.STRING,
      foo: {
        unique: 'foobar',
        type: DataTypes.STRING
      },
      bar: {
        unique: 'foobar',
        type: DataTypes.INTEGER
      },
      baz: {
        type: DataTypes.STRING,
        field: 'zab',
        defaultValue: 'BAZ_DEFAULT_VALUE'
      },
      blob: DataTypes.BLOB
    });

    this.ModelWithFieldPK = this.sequelize.define('ModelWithFieldPK', {
      userId: {
        field: 'user_id',
        type: Sequelize.INTEGER,
        autoIncrement: true,
        primaryKey: true
      },
      foo: {
        type: DataTypes.STRING,
        unique: true
      }
    });

    await this.sequelize.sync({ force: true });
  });

  if (current.dialect.supports.upserts) {
    describe('upsert', () => {
      it('works with upsert on id', async function() {
        const [, created0] = await this.User.upsert({ id: 42, username: 'john' });
        if (['sqlite', 'postgres'].includes(dialect)) {
          expect(created0).to.be.null;
        } else if (dialect === 'db2') {
          expect(created0).to.be.undefined;
        } else {
          expect(created0).to.be.true;
        }

        this.clock.tick(1000);
        const [, created] = await this.User.upsert({ id: 42, username: 'doe' });
        if (['sqlite', 'postgres'].includes(dialect)) {
          expect(created).to.be.null;
        } else if (dialect === 'db2') {
          expect(created0).to.be.undefined;
        } else {
          expect(created).to.be.false;
        }

        const user = await this.User.findByPk(42);
        expect(user.createdAt).to.be.ok;
        expect(user.username).to.equal('doe');
        expect(user.updatedAt).to.be.afterTime(user.createdAt);
      });

      it('works with upsert on a composite key', async function() {
        const [, created0] = await this.User.upsert({ foo: 'baz', bar: 19, username: 'john' });
        if (['sqlite', 'postgres'].includes(dialect)) {
          expect(created0).to.be.null;
        } else if (dialect === 'db2') {
          expect(created0).to.be.undefined;
        } else {
          expect(created0).to.be.true;
        }

        this.clock.tick(1000);
        const [, created] = await this.User.upsert({ foo: 'baz', bar: 19, username: 'doe' });
        if (['sqlite', 'postgres'].includes(dialect)) {
          expect(created).to.be.null;
        } else if (dialect === 'db2') {
          expect(created).to.be.undefined;
        } else {
          expect(created).to.be.false;
        }

        const user = await this.User.findOne({ where: { foo: 'baz', bar: 19 } });
        expect(user.createdAt).to.be.ok;
        expect(user.username).to.equal('doe');
        expect(user.updatedAt).to.be.afterTime(user.createdAt);
      });

      it('should work with UUIDs wth default values', async function() {
        const User = this.sequelize.define('User', {
          id: {
            primaryKey: true,
            allowNull: false,
            unique: true,
            type: Sequelize.UUID,
            defaultValue: Sequelize.UUIDV4
          },
          name: {
            type: Sequelize.STRING
          }
        });

        await User.sync({ force: true });
        await User.upsert({ name: 'John Doe' });
      });

      it('works with upsert on a composite primary key', async function() {
        const User = this.sequelize.define('user', {
          a: {
            type: Sequelize.STRING,
            primaryKey: true
          },
          b: {
            type: Sequelize.STRING,
            primaryKey: true
          },
          username: DataTypes.STRING
        });

        await User.sync({ force: true });

        const [created1, created2] = await Promise.all([
          // Create two users
          User.upsert({ a: 'a', b: 'b', username: 'john' }),
          User.upsert({ a: 'a', b: 'a', username: 'curt' })
        ]);

        if (['sqlite', 'postgres'].includes(dialect)) {
          expect(created1[1]).to.be.null;
          expect(created2[1]).to.be.null;
        } else if (dialect === 'db2') {
          expect(created1[1]).to.be.undefined;
          expect(created2[1]).to.be.undefined;
        } else {
          expect(created1[1]).to.be.true;
          expect(created2[1]).to.be.true;
        }

        this.clock.tick(1000);
        // Update the first one
        const [, created] = await User.upsert({ a: 'a', b: 'b', username: 'doe' });
        if (['sqlite', 'postgres'].includes(dialect)) {
          expect(created).to.be.null;
        } else if (dialect === 'db2') {
          expect(created).to.be.undefined;
        } else {
          expect(created).to.be.false;
        }

        const user1 = await User.findOne({ where: { a: 'a', b: 'b' } });
        expect(user1.createdAt).to.be.ok;
        expect(user1.username).to.equal('doe');
        expect(user1.updatedAt).to.be.afterTime(user1.createdAt);

        const user2 = await User.findOne({ where: { a: 'a', b: 'a' } });
        // The second one should not be updated
        expect(user2.createdAt).to.be.ok;
        expect(user2.username).to.equal('curt');
        expect(user2.updatedAt).to.equalTime(user2.createdAt);
      });

      it('supports validations', async function() {
        const User = this.sequelize.define('user', {
          email: {
            type: Sequelize.STRING,
            validate: {
              isEmail: true
            }
          }
        });

        await expect(User.upsert({ email: 'notanemail' })).to.eventually.be.rejectedWith(Sequelize.ValidationError);
      });

      it('supports skipping validations', async function() {
        const User = this.sequelize.define('user', {
          email: {
            type: Sequelize.STRING,
            validate: {
              isEmail: true
            }
          }
        });

        const options = { validate: false };

        await User.sync({ force: true });
        const [, created] = await User.upsert({ id: 1, email: 'notanemail' }, options);
        if (['sqlite', 'postgres'].includes(dialect)) {
          expect(created).to.be.null;
        } else if (dialect === 'db2') {
          expect(created).to.be.undefined;
        } else {
          expect(created).to.be.true;
        }
      });

      it('works with BLOBs', async function() {
        const [, created0] = await this.User.upsert({ id: 42, username: 'john', blob: Buffer.from('kaj') });
        if (['sqlite', 'postgres'].includes(dialect)) {
          expect(created0).to.be.null;
        } else if (dialect === 'db2') {
          expect(created0).to.be.undefined;
        } else {
          expect(created0).to.be.ok;
        }

        this.clock.tick(1000);
        const [, created] = await this.User.upsert({ id: 42, username: 'doe', blob: Buffer.from('andrea') });
        if (['sqlite', 'postgres'].includes(dialect)) {
          expect(created).to.be.null;
        } else if (dialect === 'db2') {
          expect(created).to.be.undefined;
        } else {
          expect(created).to.be.false;
        }

        const user = await this.User.findByPk(42);
        expect(user.createdAt).to.be.ok;
        expect(user.username).to.equal('doe');
        expect(user.blob.toString()).to.equal('andrea');
        expect(user.updatedAt).to.be.afterTime(user.createdAt);
      });

      it('works with .field', async function() {
        const [, created0] = await this.User.upsert({ id: 42, baz: 'foo' });
        if (['sqlite', 'postgres'].includes(dialect)) {
          expect(created0).to.be.null;
        } else if (dialect === 'db2') {
          expect(created0).to.be.undefined;
        } else {
          expect(created0).to.be.ok;
        }

        const [, created] = await this.User.upsert({ id: 42, baz: 'oof' });
        if (['sqlite', 'postgres'].includes(dialect)) {
          expect(created).to.be.null;
        } else if (dialect === 'db2') {
          expect(created).to.be.undefined;
        } else {
          expect(created).to.be.false;
        }

        const user = await this.User.findByPk(42);
        expect(user.baz).to.equal('oof');
      });

      it('works with primary key using .field', async function() {
        const [, created0] = await this.ModelWithFieldPK.upsert({ userId: 42, foo: 'first' });
        if (['sqlite', 'postgres'].includes(dialect)) {
          expect(created0).to.be.null;
        } else if (dialect === 'db2') {
          expect(created0).to.be.undefined;
        } else {
          expect(created0).to.be.ok;
        }

        this.clock.tick(1000);
        const [, created] = await this.ModelWithFieldPK.upsert({ userId: 42, foo: 'second' });
        if (['sqlite', 'postgres'].includes(dialect)) {
          expect(created).to.be.null;
        } else if (dialect === 'db2') {
          expect(created).to.be.undefined;
        } else {
          expect(created).to.be.false;
        }

        const instance = await this.ModelWithFieldPK.findOne({ where: { userId: 42 } });
        expect(instance.foo).to.equal('second');
      });

      it('works with database functions', async function() {
        const [, created0] = await this.User.upsert({ id: 42, username: 'john', foo: this.sequelize.fn('upper', 'mixedCase1') });
        if (['sqlite', 'postgres'].includes(dialect)) {
          expect(created0).to.be.null;
        } else if (dialect === 'db2') {
          expect(created0).to.be.undefined;
        } else {
          expect(created0).to.be.ok;
        }

        this.clock.tick(1000);
        const [, created] = await this.User.upsert({ id: 42, username: 'doe', foo: this.sequelize.fn('upper', 'mixedCase2') });
        if (['sqlite', 'postgres'].includes(dialect)) {
          expect(created).to.be.null;
        } else if (dialect === 'db2') {
          expect(created).to.be.undefined;
        } else {
          expect(created).to.be.false;
        }
        const user = await this.User.findByPk(42);
        expect(user.createdAt).to.be.ok;
        expect(user.username).to.equal('doe');
        expect(user.foo).to.equal('MIXEDCASE2');
      });

      it('does not overwrite createdAt time on update', async function() {
        const clock = sinon.useFakeTimers();
        await this.User.create({ id: 42, username: 'john' });
        const user0 = await this.User.findByPk(42);
        const originalCreatedAt = user0.createdAt;
        const originalUpdatedAt = user0.updatedAt;
        clock.tick(5000);
        await this.User.upsert({ id: 42, username: 'doe' });
        const user = await this.User.findByPk(42);
        expect(user.updatedAt).to.be.gt(originalUpdatedAt);
        expect(user.createdAt).to.deep.equal(originalCreatedAt);
        clock.restore();
      });

      it('does not overwrite createdAt when supplied as an explicit insert value when using fields', async function() {
        const clock = sinon.useFakeTimers();
        const originalCreatedAt = new Date('2010-01-01T12:00:00.000Z');
        await this.User.upsert({ id: 42, username: 'john', createdAt: originalCreatedAt }, { fields: ['id', 'username'] });
        const user = await this.User.findByPk(42);
        expect(user.createdAt).to.deep.equal(originalCreatedAt);
        clock.restore();
      });

      it('falls back to a noop if no update values are found in the upsert data', async function() {
        const User = this.sequelize.define('user', {
          username: DataTypes.STRING,
          email: {
            type: DataTypes.STRING,
            field: 'email_address',
            defaultValue: 'xxx@yyy.zzz'
          }
        }, {
          // note, timestamps: false is important here because this test is attempting to see what happens
          // if there are NO updatable fields (including timestamp values).
          timestamps: false
        });

        await User.sync({ force: true });
        // notice how the data does not actually have the update fields.
        await User.upsert({ id: 42, username: 'jack' }, { fields: ['email'] });
        await User.upsert({ id: 42, username: 'jill' }, { fields: ['email'] });
        const user = await User.findByPk(42);
        // just making sure the user exists, i.e. the insert happened.
        expect(user).to.be.ok;
        expect(user.username).to.equal('jack');  // second upsert should not have updated username.
      });

      it('does not update using default values', async function() {
        await this.User.create({ id: 42, username: 'john', baz: 'new baz value' });
        const user0 = await this.User.findByPk(42);
        // 'username' should be 'john' since it was set
        expect(user0.username).to.equal('john');
        // 'baz' should be 'new baz value' since it was set
        expect(user0.baz).to.equal('new baz value');
        await this.User.upsert({ id: 42, username: 'doe' });
        const user = await this.User.findByPk(42);
        // 'username' was updated
        expect(user.username).to.equal('doe');
        // 'baz' should still be 'new baz value' since it was not updated
        expect(user.baz).to.equal('new baz value');
      });

      it('does not update when setting current values', async function() {
        await this.User.create({ id: 42, username: 'john' });
        const user = await this.User.findByPk(42);
        const [, created] = await this.User.upsert({ id: user.id, username: user.username });
        if (['sqlite', 'postgres'].includes(dialect)) {
          expect(created).to.be.null;
        } else if (dialect === 'db2') {
          expect(created).to.be.undefined;
        } else {
          // After set node-mysql flags = '-FOUND_ROWS' / foundRows=false
          // result from upsert should be false when upsert a row to its current value
          // https://dev.mysql.com/doc/refman/5.7/en/insert-on-duplicate.html
          expect(created).to.equal(false);
        }
      });

      it('works when two separate uniqueKeys are passed', async function() {
        const User = this.sequelize.define('User', {
          username: {
            type: Sequelize.STRING,
            unique: true
          },
          email: {
            type: Sequelize.STRING,
            unique: true
          },
          city: {
            type: Sequelize.STRING
          }
        });
        const clock = sinon.useFakeTimers();
        await User.sync({ force: true });
        const [, created0] = await User.upsert({ username: 'user1', email: 'user1@domain.ext', city: 'City' });
        if (['sqlite', 'postgres'].includes(dialect)) {
          expect(created0).to.be.null;
        } else if (dialect === 'db2') {
          expect(created0).to.be.undefined;
        } else {
          expect(created0).to.be.ok;
        }
        clock.tick(1000);
        const [, created] = await User.upsert({ username: 'user1', email: 'user1@domain.ext', city: 'New City' });
        if (['sqlite', 'postgres'].includes(dialect)) {
          expect(created).to.be.null;
        }  else if (dialect === 'db2') {
          expect(created).to.be.undefined;
        } else {
          expect(created).to.be.false;
        }
        clock.tick(1000);
        const user = await User.findOne({ where: { username: 'user1', email: 'user1@domain.ext' } });
        expect(user.createdAt).to.be.ok;
        expect(user.city).to.equal('New City');
        expect(user.updatedAt).to.be.afterTime(user.createdAt);
      });

      it('works when indexes are created via indexes array', async function() {
        const User = this.sequelize.define('User', {
          username: Sequelize.STRING,
          email: Sequelize.STRING,
          city: Sequelize.STRING
        }, {
          indexes: [{
            unique: true,
            fields: ['username']
          }, {
            unique: true,
            fields: ['email']
          }]
        });

        await User.sync({ force: true });
        const [, created0] = await User.upsert({ username: 'user1', email: 'user1@domain.ext', city: 'City' });
        if (['sqlite', 'postgres'].includes(dialect)) {
          expect(created0).to.be.null;
        } else if (dialect === 'db2') {
          expect(created0).to.be.undefined;
        } else {
          expect(created0).to.be.ok;
        }
        const [, created] = await User.upsert({ username: 'user1', email: 'user1@domain.ext', city: 'New City' });
        if (['sqlite', 'postgres'].includes(dialect)) {
          expect(created).to.be.null;
        }  else if (dialect === 'db2') {
          expect(created).to.be.undefined;
        } else {
          expect(created).to.be.false;
        }
        const user = await User.findOne({ where: { username: 'user1', email: 'user1@domain.ext' } });
        expect(user.createdAt).to.be.ok;
        expect(user.city).to.equal('New City');
      });

      it('works when composite indexes are created via indexes array', async () => {
        const User = current.define('User', {
          name: DataTypes.STRING,
          address: DataTypes.STRING,
          city: DataTypes.STRING
        }, {
          indexes: [{
            unique: 'users_name_address',
            fields: ['name', 'address']
          }]
        });

        await User.sync({ force: true });
        const [, created0] = await User.upsert({ name: 'user1', address: 'address', city: 'City' });
        if (['sqlite', 'postgres'].includes(dialect)) {
          expect(created0).to.be.null;
        } else if (dialect === 'db2') {
          expect(created0).to.be.undefined;
        } else {
          expect(created0).to.be.ok;
        }
        const [, created] = await User.upsert({ name: 'user1', address: 'address', city: 'New City' });
        if (['sqlite', 'postgres'].includes(dialect)) {
          expect(created).to.be.null;
        } else if (dialect === 'db2') {
          expect(created).to.be.undefined;
        } else {
          expect(created).not.to.be.ok;
        }
        const user = await User.findOne({ where: { name: 'user1', address: 'address' } });
        expect(user.createdAt).to.be.ok;
        expect(user.city).to.equal('New City');
      });

      if (dialect === 'mssql') {
        it('Should throw foreignKey violation for MERGE statement as ForeignKeyConstraintError', async function() {
          const User = this.sequelize.define('User', {
            username: {
              type: DataTypes.STRING,
              primaryKey: true
            }
          });
          const Posts = this.sequelize.define('Posts', {
            title: {
              type: DataTypes.STRING,
              primaryKey: true
            },
            username: DataTypes.STRING
          });
          Posts.belongsTo(User, { foreignKey: 'username' });
          await this.sequelize.sync({ force: true });
          await User.create({ username: 'user1' });
          await expect(Posts.upsert({ title: 'Title', username: 'user2' })).to.eventually.be.rejectedWith(Sequelize.ForeignKeyConstraintError);
        });
      }

      if (dialect.match(/^postgres/)) {
        it('works when deletedAt is Infinity and part of primary key', async function() {
          const User = this.sequelize.define('User', {
            name: {
              type: DataTypes.STRING,
              primaryKey: true
            },
            address: DataTypes.STRING,
            deletedAt: {
              type: DataTypes.DATE,
              primaryKey: true,
              allowNull: false,
              defaultValue: Infinity
            }
          }, {
            paranoid: true
          });

          await User.sync({ force: true });

          await Promise.all([
            User.create({ name: 'user1' }),
            User.create({ name: 'user2', deletedAt: Infinity }),

            // this record is soft deleted
            User.create({ name: 'user3', deletedAt: -Infinity })
          ]);

          await User.upsert({ name: 'user1', address: 'address' });

          const users = await User.findAll({
            where: { address: null }
          });

          expect(users).to.have.lengthOf(2);
        });
      }

      if (current.dialect.supports.returnValues) {
        describe('returns values', () => {
          it('works with upsert on id', async function() {
            const [user0, created0] = await this.User.upsert({ id: 42, username: 'john' }, { returning: true });
            expect(user0.get('id')).to.equal(42);
            expect(user0.get('username')).to.equal('john');
            if (['sqlite', 'postgres'].includes(dialect)) {
              expect(created0).to.be.null;
            } else {
              expect(created0).to.be.true;
            }

            const [user, created] = await this.User.upsert({ id: 42, username: 'doe' }, { returning: true });
            expect(user.get('id')).to.equal(42);
            expect(user.get('username')).to.equal('doe');
            if (['sqlite', 'postgres'].includes(dialect)) {
              expect(created).to.be.null;
            } else {
              expect(created).to.be.false;
            }
          });

          it('works for table with custom primary key field', async function() {
            const User = this.sequelize.define('User', {
              id: {
                type: DataTypes.INTEGER,
                autoIncrement: true,
                primaryKey: true,
                field: 'id_the_primary'
              },
              username: {
                type: DataTypes.STRING
              }
            });

            await User.sync({ force: true });
            const [user0, created0] = await User.upsert({ id: 42, username: 'john' }, { returning: true });
            expect(user0.get('id')).to.equal(42);
            expect(user0.get('username')).to.equal('john');
            if (['sqlite', 'postgres'].includes(dialect)) {
              expect(created0).to.be.null;
            } else {
              expect(created0).to.be.true;
            }

            const [user, created] = await User.upsert({ id: 42, username: 'doe' }, { returning: true });
            expect(user.get('id')).to.equal(42);
            expect(user.get('username')).to.equal('doe');
            if (['sqlite', 'postgres'].includes(dialect)) {
              expect(created).to.be.null;
            } else {
              expect(created).to.be.false;
            }
          });

          it('works for non incrementing primaryKey', async function() {
            const User = this.sequelize.define('User', {
              id: {
                type: DataTypes.STRING,
                primaryKey: true,
                field: 'id_the_primary'
              },
              username: {
                type: DataTypes.STRING
              }
            });

            await User.sync({ force: true });
            const [user0, created0] = await User.upsert({ id: 'surya', username: 'john' }, { returning: true });
            expect(user0.get('id')).to.equal('surya');
            expect(user0.get('username')).to.equal('john');
            if (['sqlite', 'postgres'].includes(dialect)) {
              expect(created0).to.be.null;
            } else {
              expect(created0).to.be.true;
            }

            const [user, created] = await User.upsert({ id: 'surya', username: 'doe' }, { returning: true });
            expect(user.get('id')).to.equal('surya');
            expect(user.get('username')).to.equal('doe');
            if (['sqlite', 'postgres'].includes(dialect)) {
              expect(created).to.be.null;
            } else {
              expect(created).to.be.false;
            }
          });

          it('should return default value set by the database (upsert)', async function() {
            const User = this.sequelize.define('User', {
              name: { type: DataTypes.STRING, primaryKey: true },
              code: { type: Sequelize.INTEGER, defaultValue: Sequelize.literal(2020) }
            });

            await User.sync({ force: true });

            const [user, created] = await User.upsert({ name: 'Test default value' }, { returning: true });

            expect(user.name).to.be.equal('Test default value');
            expect(user.code).to.be.equal(2020);

            if (['sqlite', 'postgres'].includes(dialect)) {
              expect(created).to.be.null;
            } else if (dialect === 'db2') {
              expect(created).to.be.undefined;
            } else {
              expect(created).to.be.true;
            }
          });
        });
      }

      if (current.dialect.supports.inserts.conflictFields) {
        describe('conflictFields', () => {
          // An Abstract joiner table.  Unique constraint deliberately removed
          // to ensure that `conflictFields` is actually respected, not inferred.
          const Memberships = current.define('memberships', {
            user_id: DataTypes.INTEGER,
            group_id: DataTypes.INTEGER,
            permissions: DataTypes.ENUM('admin', 'member')
          });

          beforeEach(async () => {
            await Memberships.sync({ force: true });

            await current.queryInterface.addConstraint('memberships', {
              type: 'UNIQUE',
              fields: ['user_id', 'group_id']
            });
          });

          it('should insert with no other rows', async () => {
            const [newRow] = await Memberships.upsert(
              {
                user_id: 1,
                group_id: 1,
                permissions: 'member'
              },
              {
                conflictFields: ['user_id', 'group_id']
              }
            );

            expect(newRow).to.not.eq(null);
            expect(newRow.permissions).to.eq('member');
          });

          it('should use conflictFields as upsertKeys', async () => {
            const [originalMembership] = await Memberships.upsert(
              {
                user_id: 1,
                group_id: 1,
                permissions: 'member'
              },
              {
                conflictFields: ['user_id', 'group_id']
              }
            );

            expect(originalMembership).to.not.eq(null);
            expect(originalMembership.permissions).to.eq('member');

            const [updatedMembership] = await Memberships.upsert(
              {
                user_id: 1,
                group_id: 1,
                permissions: 'admin'
              },
              {
                conflictFields: ['user_id', 'group_id']
              }
            );

            expect(updatedMembership).to.not.eq(null);
            expect(updatedMembership.permissions).to.eq('admin');
            expect(updatedMembership.id).to.eq(originalMembership.id);

            const [otherMembership] = await Memberships.upsert(
              {
                user_id: 2,
                group_id: 1,
                permissions: 'member'
              },
              {
                conflictFields: ['user_id', 'group_id']
              }
            );

            expect(otherMembership).to.not.eq(null);
            expect(otherMembership.permissions).to.eq('member');
            expect(otherMembership.id).to.not.eq(originalMembership.id);
          });
        });

        if (current.dialect.supports.inserts.onConflictWhere) {
          describe('conflictWhere', () => {
            const Users = current.define(
              'users',
              {
                name: DataTypes.STRING,
                bio: DataTypes.STRING,
                isUnique: DataTypes.BOOLEAN
              },
              {
                indexes: [
                  {
                    unique: true,
                    fields: ['name'],
                    where: { isUnique: true }
                  }
                ]
              }
            );

            beforeEach(() => Users.sync({ force: true }));

            it('should insert with no other rows', async () => {
              const [newRow] = await Users.upsert(
                {
                  name: 'John',
                  isUnique: true
                },
                {
                  conflictWhere: {
                    isUnique: true
                  }
                }
              );

              expect(newRow).to.not.eq(null);
              expect(newRow.name).to.eq('John');
            });

            it('should update with another unique user', async () => {
              let [newRow] = await Users.upsert(
                {
                  name: 'John',
                  isUnique: true,
                  bio: 'before'
                },
                {
                  conflictWhere: {
                    isUnique: true
                  }
                }
              );

              expect(newRow).to.not.eq(null);
              expect(newRow.name).to.eq('John');
              expect(newRow.bio).to.eq('before');

              [newRow] = await Users.upsert(
                {
                  name: 'John',
                  isUnique: true,
                  bio: 'after'
                },
                {
                  conflictWhere: {
                    isUnique: true
                  }
                }
              );

              expect(newRow).to.not.eq(null);
              expect(newRow.name).to.eq('John');
              expect(newRow.bio).to.eq('after');

              const rowCount = await Users.count();

              expect(rowCount).to.eq(1);
            });

            it('allows both unique and non-unique users with the same name', async () => {
              let [newRow] = await Users.upsert(
                {
                  name: 'John',
                  isUnique: true,
                  bio: 'first'
                },
                {
                  conflictWhere: {
                    isUnique: true
                  }
                }
              );

              expect(newRow).to.not.eq(null);
              expect(newRow.name).to.eq('John');
              expect(newRow.bio).to.eq('first');

              [newRow] = await Users.upsert(
                {
                  name: 'John',
                  isUnique: false,
                  bio: 'second'
                },
                {
                  conflictWhere: {
                    isUnique: true
                  }
                }
              );

              expect(newRow).to.not.eq(null);
              expect(newRow.name).to.eq('John');
              expect(newRow.bio).to.eq('second');

              const rowCount = await Users.count();

              expect(rowCount).to.eq(2);
            });

            it('allows for multiple unique users with different names', async () => {
              let [newRow] = await Users.upsert(
                {
                  name: 'John',
                  isUnique: true,
                  bio: 'first'
                },
                {
                  conflictWhere: {
                    isUnique: true
                  }
                }
              );

              expect(newRow).to.not.eq(null);
              expect(newRow.name).to.eq('John');
              expect(newRow.bio).to.eq('first');

              [newRow] = await Users.upsert(
                {
                  name: 'Bob',
                  isUnique: false,
                  bio: 'second'
                },
                {
                  conflictWhere: {
                    isUnique: true
                  }
                }
              );

              expect(newRow).to.not.eq(null);
              expect(newRow.name).to.eq('Bob');
              expect(newRow.bio).to.eq('second');

              const rowCount = await Users.count();

              expect(rowCount).to.eq(2);
            });
          });
        }
      }
    });
  }
});
