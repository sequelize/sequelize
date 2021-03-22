'use strict';

const chai = require('chai'),
  sinon = require('sinon'),
  Sequelize = require('../../../index'),
  expect = chai.expect,
  Support = require('../support'),
  DataTypes = require('../../../lib/data-types'),
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
        if (dialect === 'sqlite' || dialect === 'postgres') {
          expect(created0).to.be.null;
        } else {
          expect(created0).to.be.true;
        }

        this.clock.tick(1000);
        const [, created] = await this.User.upsert({ id: 42, username: 'doe' });
        if (dialect === 'sqlite' || dialect === 'postgres') {
          expect(created).to.be.null;
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
        if (dialect === 'sqlite' || dialect === 'postgres') {
          expect(created0).to.be.null;
        } else {
          expect(created0).to.be.true;
        }

        this.clock.tick(1000);
        const [, created] = await this.User.upsert({ foo: 'baz', bar: 19, username: 'doe' });
        if (dialect === 'sqlite' || dialect === 'postgres') {
          expect(created).to.be.null;
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

        if (dialect === 'sqlite' || dialect === 'postgres') {
          expect(created1[1]).to.be.null;
          expect(created2[1]).to.be.null;
        } else {
          expect(created1[1]).to.be.true;
          expect(created2[1]).to.be.true;
        }

        this.clock.tick(1000);
        // Update the first one
        const [, created] = await User.upsert({ a: 'a', b: 'b', username: 'doe' });
        if (dialect === 'sqlite' || dialect === 'postgres') {
          expect(created).to.be.null;
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
        if (dialect === 'sqlite' || dialect === 'postgres') {
          expect(created).to.be.null;
        } else {
          expect(created).to.be.true;
        }
      });

      it('works with BLOBs', async function() {
        const [, created0] = await this.User.upsert({ id: 42, username: 'john', blob: Buffer.from('kaj') });
        if (dialect === 'sqlite' || dialect === 'postgres') {
          expect(created0).to.be.null;
        } else {
          expect(created0).to.be.ok;
        }

        this.clock.tick(1000);
        const [, created] = await this.User.upsert({ id: 42, username: 'doe', blob: Buffer.from('andrea') });
        if (dialect === 'sqlite' || dialect === 'postgres') {
          expect(created).to.be.null;
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
        if (dialect === 'sqlite' || dialect === 'postgres') {
          expect(created0).to.be.null;
        } else {
          expect(created0).to.be.ok;
        }

        const [, created] = await this.User.upsert({ id: 42, baz: 'oof' });
        if (dialect === 'sqlite' || dialect === 'postgres') {
          expect(created).to.be.null;
        } else {
          expect(created).to.be.false;
        }

        const user = await this.User.findByPk(42);
        expect(user.baz).to.equal('oof');
      });

      it('works with primary key using .field', async function() {
        const [, created0] = await this.ModelWithFieldPK.upsert({ userId: 42, foo: 'first' });
        if (dialect === 'sqlite' || dialect === 'postgres') {
          expect(created0).to.be.null;
        } else {
          expect(created0).to.be.ok;
        }

        this.clock.tick(1000);
        const [, created] = await this.ModelWithFieldPK.upsert({ userId: 42, foo: 'second' });
        if (dialect === 'sqlite' || dialect === 'postgres') {
          expect(created).to.be.null;
        } else {
          expect(created).to.be.false;
        }

        const instance = await this.ModelWithFieldPK.findOne({ where: { userId: 42 } });
        expect(instance.foo).to.equal('second');
      });

      it('works with database functions', async function() {
        const [, created0] = await this.User.upsert({ id: 42, username: 'john', foo: this.sequelize.fn('upper', 'mixedCase1') });
        if (dialect === 'sqlite' || dialect === 'postgres') {
          expect(created0).to.be.null;
        } else {
          expect(created0).to.be.ok;
        }

        this.clock.tick(1000);
        const [, created] = await this.User.upsert({ id: 42, username: 'doe', foo: this.sequelize.fn('upper', 'mixedCase2') });
        if (dialect === 'sqlite' || dialect === 'postgres') {
          expect(created).to.be.null;
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
        if (dialect === 'sqlite' || dialect === 'postgres') {
          expect(created).to.be.null;
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
        if (dialect === 'sqlite' || dialect === 'postgres') {
          expect(created0).to.be.null;
        } else {
          expect(created0).to.be.ok;
        }
        clock.tick(1000);
        const [, created] = await User.upsert({ username: 'user1', email: 'user1@domain.ext', city: 'New City' });
        if (dialect === 'sqlite' || dialect === 'postgres') {
          expect(created).to.be.null;
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
        if (dialect === 'sqlite' || dialect === 'postgres') {
          expect(created0).to.be.null;
        } else {
          expect(created0).to.be.ok;
        }
        const [, created] = await User.upsert({ username: 'user1', email: 'user1@domain.ext', city: 'New City' });
        if (dialect === 'sqlite' || dialect === 'postgres') {
          expect(created).to.be.null;
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
        if (dialect === 'sqlite' || dialect === 'postgres') {
          expect(created0).to.be.null;
        } else {
          expect(created0).to.be.ok;
        }
        const [, created] = await User.upsert({ name: 'user1', address: 'address', city: 'New City' });
        if (dialect === 'sqlite' || dialect === 'postgres') {
          expect(created).to.be.null;
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
            if (dialect === 'sqlite' || dialect === 'postgres') {
              expect(created0).to.be.null;
            } else {
              expect(created0).to.be.true;
            }

            const [user, created] = await this.User.upsert({ id: 42, username: 'doe' }, { returning: true });
            expect(user.get('id')).to.equal(42);
            expect(user.get('username')).to.equal('doe');
            if (dialect === 'sqlite' || dialect === 'postgres') {
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
            if (dialect === 'sqlite' || dialect === 'postgres') {
              expect(created0).to.be.null;
            } else {
              expect(created0).to.be.true;
            }

            const [user, created] = await User.upsert({ id: 42, username: 'doe' }, { returning: true });
            expect(user.get('id')).to.equal(42);
            expect(user.get('username')).to.equal('doe');
            if (dialect === 'sqlite' || dialect === 'postgres') {
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
            if (dialect === 'sqlite' || dialect === 'postgres') {
              expect(created0).to.be.null;
            } else {
              expect(created0).to.be.true;
            }

            const [user, created] = await User.upsert({ id: 'surya', username: 'doe' }, { returning: true });
            expect(user.get('id')).to.equal('surya');
            expect(user.get('username')).to.equal('doe');
            if (dialect === 'sqlite' || dialect === 'postgres') {
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

            if (dialect === 'sqlite' || dialect === 'postgres') {
              expect(created).to.be.null;
            } else {
              expect(created).to.be.true;
            }
          });
        });
      }
    });
  }
});
