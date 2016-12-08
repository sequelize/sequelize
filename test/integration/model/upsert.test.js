'use strict';

/* jshint -W030 */
var chai = require('chai')
  , sinon = require('sinon')
  , Sequelize = require('../../../index')
  , Promise = Sequelize.Promise
  , expect = chai.expect
  , Support = require(__dirname + '/../support')
  , DataTypes = require(__dirname + '/../../../lib/data-types')
  , dialect = Support.getTestDialect()
  , current = Support.sequelize;

describe(Support.getTestDialectTeaser('Model'), function() {
  before(function () {
    this.clock = sinon.useFakeTimers();
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
      foo:{
        type: DataTypes.STRING,
        unique: true
      }
    });

    return this.sequelize.sync({ force: true });
  });

  after(function () {
    this.clock.restore();
  });

  if (current.dialect.supports.upserts) {
    describe('upsert', function() {
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
        }).then(function(user) {
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
        }).then(function(user) {
          expect(user.createdAt).to.be.ok;
          expect(user.username).to.equal('doe');
          expect(user.updatedAt).to.be.afterTime(user.createdAt);
        });
      });

      it('should work with UUIDs wth default values', function () {
        var User = this.sequelize.define('User', {
          id: {
            primaryKey: true,
            allowNull: false,
            unique: true,
            type: Sequelize.UUID,
            defaultValue: Sequelize.UUIDV4
          },

          name: {
            type: Sequelize.STRING,
          }
        });

        return User.sync({ force: true }).then(function () {
          return User.upsert({ name: 'John Doe' });
        });
      });

      it('works with upsert on a composite primary key', function() {
        var User = this.sequelize.define('user', {
          a: {
            type: Sequelize.STRING,
            primaryKey: true,
          },
          b: {
            type: Sequelize.STRING,
            primaryKey: true,
          },
          username: DataTypes.STRING,
        });

        return User.sync({ force: true }).bind(this).then(function  () {
          return Promise.all([
              // Create two users
             User.upsert({ a: 'a', b: 'b', username: 'john' }),
             User.upsert({ a: 'a', b: 'a', username: 'curt' }),
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
        }).then(function(created) {
          if (dialect === 'sqlite') {
            expect(created).to.be.undefined;
          } else {
            expect(created).not.to.be.ok;
          }

          return User.find({ where: { a: 'a', b: 'b' }});
        }).then(function (user1) {
          expect(user1.createdAt).to.be.ok;
          expect(user1.username).to.equal('doe');
          expect(user1.updatedAt).to.be.afterTime(user1.createdAt);

          return User.find({ where: { a: 'a', b: 'a' }});
        }).then(function (user2) {
          // The second one should not be updated
          expect(user2.createdAt).to.be.ok;
          expect(user2.username).to.equal('curt');
          expect(user2.updatedAt).to.equalTime(user2.createdAt);
        });
      });

      it('supports validations', function () {
        var User = this.sequelize.define('user', {
          email: {
            type: Sequelize.STRING,
            validate: {
              isEmail: true
            }
          }
        });

        return expect(User.upsert({ email: 'notanemail' })).to.eventually.be.rejectedWith(this.sequelize.ValidationError);
      });

      it('works with BLOBs', function () {
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
        }).then(function(user) {
          expect(user.createdAt).to.be.ok;
          expect(user.username).to.equal('doe');
          expect(user.blob.toString()).to.equal('andrea');
          expect(user.updatedAt).to.be.afterTime(user.createdAt);
        });
      });

      it('works with .field', function () {
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
        }).then(function(user) {
          expect(user.baz).to.equal('oof');
        });
      });

      it('works with primary key using .field', function () {
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

          return this.ModelWithFieldPK.findOne({ userId: 42 });
        }).then(function(instance) {
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
        }).then(function(user) {
          expect(user.createdAt).to.be.ok;
          expect(user.username).to.equal('doe');
          expect(user.foo).to.equal('MIXEDCASE2');
        });
      });

      it('does not overwrite createdAt time on update', function() {
        var originalCreatedAt;
        var originalUpdatedAt;
        var clock = sinon.useFakeTimers();
        return this.User.create({ id: 42, username: 'john'}).bind(this).then(function() {
          return this.User.findById(42);
        }).then(function(user) {
          originalCreatedAt = user.createdAt;
          originalUpdatedAt = user.updatedAt;
          clock.tick(5000);
          return this.User.upsert({ id: 42, username: 'doe'});
        }).then(function() {
          return this.User.findById(42);
        }).then(function(user) {
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
        }).then(function(user) {
          // 'username' was updated
          expect(user.username).to.equal('doe');
          // 'baz' should still be 'new baz value' since it was not updated
          expect(user.baz).to.equal('new baz value');
        });
      });

      it('does not update when setting current values', function() {
        return this.User.create({ id: 42, username: 'john'  }).bind(this).then(function() {
          return this.User.findById(42);

        }).then(function(user) {
          return this.User.upsert({ id: user.id, username: user.username  });

        }).then(function(created) {
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
        var User = this.sequelize.define('User', {
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
        var clock = sinon.useFakeTimers();
        return User.sync({ force: true }).bind(this).then(function() {
          return User.upsert({ username: 'user1', email: 'user1@domain.ext', city: 'City' })
            .then(function(created) {
              if (dialect === 'sqlite') {
                expect(created).to.be.undefined;
              } else {
                expect(created).to.be.ok;
              }
              clock.tick(1000);
              return User.upsert({ username: 'user1', email: 'user1@domain.ext', city: 'New City' });
            }).then(function(created) {
              if (dialect === 'sqlite') {
                expect(created).to.be.undefined;
              } else {
                expect(created).not.to.be.ok;
              }
              clock.tick(1000);
              return User.findOne({ where: { username: 'user1', email: 'user1@domain.ext' }});
            })
            .then(function(user) {
              expect(user.createdAt).to.be.ok;
              expect(user.city).to.equal('New City');
              expect(user.updatedAt).to.be.afterTime(user.createdAt);
            });
        });
      });
    });
  }
});
