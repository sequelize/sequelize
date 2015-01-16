'use strict';

var chai = require('chai')
  , sinon = require('sinon')
  , Sequelize = require('../../index')
  , Promise = Sequelize.Promise
  , expect = chai.expect
  , Support = require(__dirname + '/../support')
  , DataTypes = require(__dirname + '/../../lib/data-types')
  , dialect = Support.getTestDialect()
  , datetime = require('chai-datetime')
  , _ = require('lodash')
  , assert = require('assert')
  , current = Support.sequelize;

chai.use(datetime);
chai.config.includeStack = true;

describe(Support.getTestDialectTeaser('Model'), function() {
  beforeEach(function() {
    this.clock = sinon.useFakeTimers();

    this.User = this.sequelize.define('user', {
      username: DataTypes.STRING,
      foo: {
        unique: 'foobar',
        type: DataTypes.STRING
      },
      bar: {
        unique: 'foobar',
        type: DataTypes.INTEGER
      }
    });

    return this.sequelize.sync({ force: true });
  });

  afterEach(function() {
    this.clock.restore();
  });

  if (current.dialect.supports.upserts) {
    describe('upsert', function() {
      it('works with upsert on id', function() {
        return this.User.upsert({ id: 42, username: 'john' }).bind(this).then(function(created) {
          if (dialect === 'sqlite') {
            expect(created).not.to.be.defined;
          } else {
            expect(created).to.be.ok;
          }

          this.clock.tick(2000); // Make sure to pass some time so updatedAt != createdAt
          return this.User.upsert({ id: 42, username: 'doe' });
        }).then(function(created) {
          if (dialect === 'sqlite') {
            expect(created).not.to.be.defined;
          } else {
            expect(created).not.to.be.ok;
          }

          return this.User.find(42);
        }).then(function(user) {
          expect(user.createdAt).to.be.defined;
          expect(user.username).to.equal('doe');
          expect(user.updatedAt).to.be.afterTime(user.createdAt);
        });
      });

      it('works with upsert on a composite key', function() {
        return this.User.upsert({ foo: 'baz', bar: 19, username: 'john' }).bind(this).then(function(created) {
          if (dialect === 'sqlite') {
            expect(created).not.to.be.defined;
          } else {
            expect(created).to.be.ok;
          }

          this.clock.tick(2000); // Make sure to pass some time so updatedAt != createdAt
          return this.User.upsert({ foo: 'baz', bar: 19, username: 'doe' });
        }).then(function(created) {
          if (dialect === 'sqlite') {
            expect(created).not.to.be.defined;
          } else {
            expect(created).not.to.be.ok;
          }

          return this.User.find({ where: { foo: 'baz', bar: 19 }});
        }).then(function(user) {
          expect(user.createdAt).to.be.defined;
          expect(user.username).to.equal('doe');
          expect(user.updatedAt).to.be.afterTime(user.createdAt);
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
    });
  }
});
