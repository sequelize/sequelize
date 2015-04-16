'use strict';

/* jshint -W030 */
var chai = require('chai')
  , Sequelize = require('../../../index')
  , Promise = Sequelize.Promise
  , expect = chai.expect
  , Support = require(__dirname + '/../support')
  , DataTypes = require(__dirname + '/../../../lib/data-types')
  , dialect = Support.getTestDialect()
  , current = Support.sequelize;

chai.config.includeStack = true;

describe(Support.getTestDialectTeaser('Model'), function() {
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
        field: 'zab'
      },
      blob: DataTypes.BLOB
    });

    return this.sequelize.sync({ force: true });
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

          return this.sequelize.Promise.delay(1000).bind(this).then(function() {
            return this.User.upsert({ id: 42, username: 'doe' });
          });
        }).then(function(created) {
          if (dialect === 'sqlite') {
            expect(created).to.be.undefined;
          } else {
            expect(created).not.to.be.ok;
          }

          return this.User.find(42);
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

          return this.sequelize.Promise.delay(1000).bind(this).then(function() {
            return this.User.upsert({ foo: 'baz', bar: 19, username: 'doe' });
          });
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

          return Promise.delay(1000).bind(this).then(function() {
            // Update the first one
            return User.upsert({ a: 'a', b: 'b', username: 'doe' });
          });
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

          return this.sequelize.Promise.delay(1000).bind(this).then(function() {
            return this.User.upsert({ id: 42, username: 'doe', blob: new Buffer('andrea') });
          });
        }).then(function(created) {
          if (dialect === 'sqlite') {
            expect(created).to.be.undefined;
          } else {
            expect(created).not.to.be.ok;
          }

          return this.User.find(42);
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

          return this.sequelize.Promise.delay(1000).bind(this).then(function() {
            return this.User.upsert({ id: 42, baz: 'oof' });
          });
        }).then(function(created) {
          if (dialect === 'sqlite') {
            expect(created).to.be.undefined;
          } else {
            expect(created).not.to.be.ok;
          }

          return this.User.find(42);
        }).then(function(user) {
          expect(user.baz).to.equal('oof');
        });
      });
    });
  }
});
