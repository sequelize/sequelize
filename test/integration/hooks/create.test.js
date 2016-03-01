'use strict';

/* jshint -W030 */
var chai = require('chai')
  , expect = chai.expect
  , Support = require(__dirname + '/../support')
  , DataTypes = require(__dirname + '/../../../lib/data-types')
  , Sequelize = Support.Sequelize
  , sinon = require('sinon');

describe(Support.getTestDialectTeaser('Hooks'), function() {
  beforeEach(function() {
    this.User = this.sequelize.define('User', {
      username: {
        type: DataTypes.STRING,
        allowNull: false
      },
      mood: {
        type: DataTypes.ENUM,
        values: ['happy', 'sad', 'neutral']
      }
    });
    return this.sequelize.sync({ force: true });
  });

  describe('#create', function() {
    describe('on success', function() {
      it('should run hooks', function() {
        var beforeHook = sinon.spy()
          , afterHook = sinon.spy();

        this.User.beforeCreate(beforeHook);
        this.User.afterCreate(afterHook);

        return this.User.create({username: 'Toni', mood: 'happy'}).then(function() {
          expect(beforeHook).to.have.been.calledOnce;
          expect(afterHook).to.have.been.calledOnce;
        });
      });
    });

    describe('on error', function() {
      it('should return an error from before', function() {
        var beforeHook = sinon.spy()
          , afterHook = sinon.spy();

        this.User.beforeCreate(function(user, options) {
          beforeHook();
          throw new Error('Whoops!');
        });
        this.User.afterCreate(afterHook);

        return expect(this.User.create({username: 'Toni', mood: 'happy'})).to.be.rejected.then(function(err) {
          expect(beforeHook).to.have.been.calledOnce;
          expect(afterHook).not.to.have.been.called;
        });
      });

      it('should return an error from after', function() {
        var beforeHook = sinon.spy()
          , afterHook = sinon.spy();

        this.User.beforeCreate(beforeHook);
        this.User.afterCreate(function(user, options) {
          afterHook();
          throw new Error('Whoops!');
        });

        return expect(this.User.create({username: 'Toni', mood: 'happy'})).to.be.rejected.then(function(err) {
          expect(beforeHook).to.have.been.calledOnce;
          expect(afterHook).to.have.been.calledOnce;
        });
      });
    });

    it('should not trigger hooks on parent when using N:M association setters', function() {
      var A = this.sequelize.define('A', {
        name: Sequelize.STRING
      });
      var B = this.sequelize.define('B', {
        name: Sequelize.STRING
      });

      var hookCalled = 0;

      A.addHook('afterCreate', function(instance, options, next) {
        hookCalled++;
        next();
      });

      B.belongsToMany(A, {through: 'a_b'});
      A.belongsToMany(B, {through: 'a_b'});

      return this.sequelize.sync({force: true}).bind(this).then(function() {
        return this.sequelize.Promise.all([
          A.create({name: 'a'}),
          B.create({name: 'b'})
        ]).spread(function(a, b) {
          return a.addB(b).then(function() {
            expect(hookCalled).to.equal(1);
          });
        });
      });
    });
  });

});
