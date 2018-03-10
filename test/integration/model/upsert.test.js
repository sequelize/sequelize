'use strict';

const chai = require('chai'),
  sinon = require('sinon'),
  Sequelize = require('../../../index'),
  Promise = Sequelize.Promise,
  expect = chai.expect,
  Support = require(__dirname + '/../support'),
  DataTypes = require(__dirname + '/../../../lib/data-types'),
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

  beforeEach(function() {
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

    return this.sequelize.sync({ force: true });
  });

  if (current.dialect.supports.upserts) {
    describe('upsert', () => {
      it('works with upsert on id', function() {
        return this.User.upsert({ id: 42, username: 'john' }).bind(this).then(function(created) {
          if (dialect === 'sqlite') {
            expect(created).to.be.undefined;
          } else {
            expect(created).to.be.ok;
          }

          this.clock.tick(1000);
          return this.User.upsert({ id: 42, username: 'doe' });
        }).then(function(created) {
          if (dialect === 'sqlite') {
            expect(created).to.be.undefined;
          } else {
            expect(created).not.to.be.ok;
          }

          return this.User.findById(42);
        }).then(user => {
          expect(user.createdAt).to.be.ok;
          expect(user.username).to.equal('doe');
          expect(user.updatedAt).to.be.afterTime(user.createdAt);
        });
      });

      it('works with upsert on a composite key', function() {
        return this.User.upsert({ foo: 'baz', bar: 19, username: 'john' }).bind(this).then(function(created) {
          if (dialect === 'sqlite') {
            expect(created).to.be.undefined;
          } else {
            expect(created).to.be.ok;
          }

          this.clock.tick(1000);
          return this.User.upsert({ foo: 'baz', bar: 19, username: 'doe' });
        }).then(function(created) {
          if (dialect === 'sqlite') {
            expect(created).to.be.undefined;
          } else {
            expect(created).not.to.be.ok;
          }

          return this.User.find({ where: { foo: 'baz', bar: 19 }});
        }).then(user => {
          expect(user.createdAt).to.be.ok;
          expect(user.username).to.equal('doe');
          expect(user.updatedAt).to.be.afterTime(user.createdAt);
        });
      });

      it('should work with UUIDs wth default values', function() {
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

        return User.sync({ force: true }).then(() => {
          return User.upsert({ name: 'John Doe' });
        });
      });

      it('works with upsert on a composite primary key', function() {
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

        return User.sync({ force: true }).bind(this).then(() => {
          return Promise.all([
            // Create two users
            User.upsert({ a: 'a', b: 'b', username: 'john' }),
            User.upsert({ a: 'a', b: 'a', username: 'curt' })
          ]);
        }).spread(function(created1, created2) {
          if (dialect === 'sqlite') {
            expect(created1).to.be.undefined;
            expect(created2).to.be.undefined;
          } else {
            expect(created1).to.be.ok;
            expect(created2).to.be.ok;
          }

          this.clock.tick(1000);
          // Update the first one
          return User.upsert({ a: 'a', b: 'b', username: 'doe' });
        }).then(created => {
          if (dialect === 'sqlite') {
            expect(created).to.be.undefined;
          } else {
            expect(created).not.to.be.ok;
          }

          return User.find({ where: { a: 'a', b: 'b' }});
        }).then(user1 => {
          expect(user1.createdAt).to.be.ok;
          expect(user1.username).to.equal('doe');
          expect(user1.updatedAt).to.be.afterTime(user1.createdAt);

          return User.find({ where: { a: 'a', b: 'a' }});
        }).then(user2 => {
          // The second one should not be updated
          expect(user2.createdAt).to.be.ok;
          expect(user2.username).to.equal('curt');
          expect(user2.updatedAt).to.equalTime(user2.createdAt);
        });
      });

      it('supports validations', function() {
        const User = this.sequelize.define('user', {
          email: {
            type: Sequelize.STRING,
            validate: {
              isEmail: true
            }
          }
        });

        return expect(User.upsert({ email: 'notanemail' })).to.eventually.be.rejectedWith(this.sequelize.ValidationError);
      });

      it('supports skipping validations', function() {
        const User = this.sequelize.define('user', {
          email: {
            type: Sequelize.STRING,
            validate: {
              isEmail: true
            }
          }
        });

        const options = { validate: false };

        return User.sync({ force: true })
          .then(() => User.upsert({ id: 1, email: 'notanemail' }, options))
          .then(created => {
            if (dialect === 'sqlite') {
              expect(created).to.be.undefined;
            } else {
              expect(created).to.be.ok;
            }
          });
      });

      it('works with BLOBs', function() {
        return this.User.upsert({ id: 42, username: 'john', blob: new Buffer('kaj') }).bind(this).then(function(created) {
          if (dialect === 'sqlite') {
            expect(created).to.be.undefined;
          } else {
            expect(created).to.be.ok;
          }

          this.clock.tick(1000);
          return this.User.upsert({ id: 42, username: 'doe', blob: new Buffer('andrea') });
        }).then(function(created) {
          if (dialect === 'sqlite') {
            expect(created).to.be.undefined;
          } else {
            expect(created).not.to.be.ok;
          }

          return this.User.findById(42);
        }).then(user => {
          expect(user.createdAt).to.be.ok;
          expect(user.username).to.equal('doe');
          expect(user.blob.toString()).to.equal('andrea');
          expect(user.updatedAt).to.be.afterTime(user.createdAt);
        });
      });

      it('works with .field', function() {
        return this.User.upsert({ id: 42, baz: 'foo' }).bind(this).then(function(created) {
          if (dialect === 'sqlite') {
            expect(created).to.be.undefined;
          } else {
            expect(created).to.be.ok;
          }

          return this.User.upsert({ id: 42, baz: 'oof' });
        }).then(function(created) {
          if (dialect === 'sqlite') {
            expect(created).to.be.undefined;
          } else {
            expect(created).not.to.be.ok;
          }

          return this.User.findById(42);
        }).then(user => {
          expect(user.baz).to.equal('oof');
        });
      });

      it('works with primary key using .field', function() {
        return this.ModelWithFieldPK.upsert({ userId: 42, foo: 'first' }).bind(this).then(function(created) {
          if (dialect === 'sqlite') {
            expect(created).to.be.undefined;
          } else {
            expect(created).to.be.ok;
          }

          this.clock.tick(1000);
          return this.ModelWithFieldPK.upsert({ userId: 42, foo: 'second' });
        }).then(function(created) {
          if (dialect === 'sqlite') {
            expect(created).to.be.undefined;
          } else {
            expect(created).not.to.be.ok;
          }

          return this.ModelWithFieldPK.findOne({ where: { userId: 42 } });
        }).then(instance => {
          expect(instance.foo).to.equal('second');
        });
      });

      it('works with database functions', function() {
        return this.User.upsert({ id: 42, username: 'john', foo: this.sequelize.fn('upper', 'mixedCase1')}).bind(this).then(function(created) {
          if (dialect === 'sqlite') {
            expect(created).to.be.undefined;
          } else {
            expect(created).to.be.ok;
          }

          this.clock.tick(1000);
          return this.User.upsert({ id: 42, username: 'doe', foo: this.sequelize.fn('upper', 'mixedCase2') });
        }).then(function(created) {
          if (dialect === 'sqlite') {
            expect(created).to.be.undefined;
          } else {
            expect(created).not.to.be.ok;
          }
          return this.User.findById(42);
        }).then(user => {
          expect(user.createdAt).to.be.ok;
          expect(user.username).to.equal('doe');
          expect(user.foo).to.equal('MIXEDCASE2');
        });
      });

      it('does not overwrite createdAt time on update', function() {
        let originalCreatedAt;
        let originalUpdatedAt;
        const clock = sinon.useFakeTimers();
        return this.User.create({ id: 42, username: 'john'}).bind(this).then(function() {
          return this.User.findById(42);
        }).then(function(user) {
          originalCreatedAt = user.createdAt;
          originalUpdatedAt = user.updatedAt;
          clock.tick(5000);
          return this.User.upsert({ id: 42, username: 'doe'});
        }).then(function() {
          return this.User.findById(42);
        }).then(user => {
          expect(user.updatedAt).to.be.gt(originalUpdatedAt);
          expect(user.createdAt).to.deep.equal(originalCreatedAt);
          clock.restore();
        });
      });

      it('does not update using default values', function() {
        return this.User.create({ id: 42, username: 'john', baz: 'new baz value'}).bind(this).then(function() {
          return this.User.findById(42);
        }).then(function(user) {
          // 'username' should be 'john' since it was set
          expect(user.username).to.equal('john');
          // 'baz' should be 'new baz value' since it was set
          expect(user.baz).to.equal('new baz value');
          return this.User.upsert({ id: 42, username: 'doe'});
        }).then(function() {
          return this.User.findById(42);
        }).then(user => {
          // 'username' was updated
          expect(user.username).to.equal('doe');
          // 'baz' should still be 'new baz value' since it was not updated
          expect(user.baz).to.equal('new baz value');
        });
      });

      it('does not update when setting current values', function() {
        return this.User.create({ id: 42, username: 'john' }).bind(this).then(function() {
          return this.User.findById(42);
        }).then(function(user) {
          return this.User.upsert({ id: user.id, username: user.username });
        }).then(created => {
          if (dialect === 'sqlite') {
            expect(created).to.be.undefined;
          } else {
            // After set node-mysql flags = '-FOUND_ROWS' in connection of mysql,
            // result from upsert should be false when upsert a row to its current value
            // https://dev.mysql.com/doc/refman/5.7/en/insert-on-duplicate.html
            expect(created).to.equal(false);
          }
        });
      });

      it('Works when two separate uniqueKeys are passed', function() {
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
        return User.sync({ force: true }).bind(this).then(() => {
          return User.upsert({ username: 'user1', email: 'user1@domain.ext', city: 'City' })
            .then(created => {
              if (dialect === 'sqlite') {
                expect(created).to.be.undefined;
              } else {
                expect(created).to.be.ok;
              }
              clock.tick(1000);
              return User.upsert({ username: 'user1', email: 'user1@domain.ext', city: 'New City' });
            }).then(created => {
              if (dialect === 'sqlite') {
                expect(created).to.be.undefined;
              } else {
                expect(created).not.to.be.ok;
              }
              clock.tick(1000);
              return User.findOne({ where: { username: 'user1', email: 'user1@domain.ext' }});
            })
            .then(user => {
              expect(user.createdAt).to.be.ok;
              expect(user.city).to.equal('New City');
              expect(user.updatedAt).to.be.afterTime(user.createdAt);
            });
        });
      });

      it('works when indexes are created via indexes array', function() {
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

        return User.sync({ force: true }).then(() => {
          return User.upsert({ username: 'user1', email: 'user1@domain.ext', city: 'City' })
            .then(created => {
              if (dialect === 'sqlite') {
                expect(created).to.be.undefined;
              } else {
                expect(created).to.be.ok;
              }
              return User.upsert({ username: 'user1', email: 'user1@domain.ext', city: 'New City' });
            }).then(created => {
              if (dialect === 'sqlite') {
                expect(created).to.be.undefined;
              } else {
                expect(created).not.to.be.ok;
              }
              return User.findOne({ where: { username: 'user1', email: 'user1@domain.ext' }});
            })
            .then(user => {
              expect(user.createdAt).to.be.ok;
              expect(user.city).to.equal('New City');
            });
        });
      });

      it('works when composite indexes are created via indexes array', () => {
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

        return User.sync({ force: true }).then(() => {
          return User.upsert({ name: 'user1', address: 'address', city: 'City' })
            .then(created => {
              if (dialect === 'sqlite') {
                expect(created).to.be.undefined;
              } else {
                expect(created).to.be.ok;
              }
              return User.upsert({ name: 'user1', address: 'address', city: 'New City' });
            }).then(created => {
              if (dialect === 'sqlite') {
                expect(created).to.be.undefined;
              } else {
                expect(created).not.to.be.ok;
              }
              return User.findOne({ where: { name: 'user1', address: 'address' }});
            })
            .then(user => {
              expect(user.createdAt).to.be.ok;
              expect(user.city).to.equal('New City');
            });
        });
      });

      if (dialect === 'mssql') {
        it('Should throw foreignKey violation for MERGE statement as ForeignKeyConstraintError', function() {
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
          return this.sequelize.sync({ force: true })
            .then(() => User.create({ username: 'user1' }))
            .then(() => {
              return expect(Posts.upsert({ title: 'Title', username: 'user2' })).to.eventually.be.rejectedWith(Sequelize.ForeignKeyConstraintError);
            });
        });
      }

      if (dialect.match(/^postgres/)) {
        it('works when deletedAt is Infinity and part of primary key', function() {
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

          return User.sync({ force: true }).then(() => {
            return Promise.all([
              User.create({ name: 'user1' }),
              User.create({ name: 'user2', deletedAt: Infinity }),

              // this record is soft deleted
              User.create({ name: 'user3', deletedAt: -Infinity })
            ]).then(() => {
              return User.upsert({ name: 'user1', address: 'address' });
            }).then(() => {
              return User.findAll({
                where: { address: null }
              });
            }).then(users => {
              expect(users).to.have.lengthOf(2);
            });
          });
        });
      }

      if (current.dialect.supports.returnValues) {
        describe('with returning option', () => {
          it('works with upsert on id', function() {
            return this.User.upsert({ id: 42, username: 'john' }, { returning: true }).spread((user, created) => {
              expect(user.get('id')).to.equal(42);
              expect(user.get('username')).to.equal('john');
              expect(created).to.be.true;

              return this.User.upsert({ id: 42, username: 'doe' }, { returning: true });
            }).spread((user, created) => {
              expect(user.get('id')).to.equal(42);
              expect(user.get('username')).to.equal('doe');
              expect(created).to.be.false;
            });
          });

          it('works for table with custom primary key field', function() {
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

            return User.sync({ force: true }).then(() => {
              return User.upsert({ id: 42, username: 'john' }, { returning: true });
            }).spread((user, created) => {
              expect(user.get('id')).to.equal(42);
              expect(user.get('username')).to.equal('john');
              expect(created).to.be.true;

              return User.upsert({ id: 42, username: 'doe' }, { returning: true });
            }).spread((user, created) => {
              expect(user.get('id')).to.equal(42);
              expect(user.get('username')).to.equal('doe');
              expect(created).to.be.false;
            });
          });

          it('works for non incrementing primaryKey', function() {
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

            return User.sync({ force: true }).then(() => {
              return User.upsert({ id: 'surya', username: 'john' }, { returning: true });
            }).spread((user, created) => {
              expect(user.get('id')).to.equal('surya');
              expect(user.get('username')).to.equal('john');
              expect(created).to.be.true;

              return User.upsert({ id: 'surya', username: 'doe' }, { returning: true });
            }).spread((user, created) => {
              expect(user.get('id')).to.equal('surya');
              expect(user.get('username')).to.equal('doe');
              expect(created).to.be.false;
            });
          });
        });
      }
    });
  }
});
