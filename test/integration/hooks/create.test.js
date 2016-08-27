'use strict';

/* jshint -W030 */
/* jshint -W079 */
const chai = require('chai');
const expect = chai.expect;
const Support = require(__dirname + '/../support');
const DataTypes = require(__dirname + '/../../../lib/data-types');
const Sequelize = Support.Sequelize;
const sinon = require('sinon');
const Promise = require('bluebird');

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
        let beforeHook = sinon.spy()
          , afterHook = sinon.spy()
          , beforeSave = sinon.spy()
          , afterSave = sinon.spy();

        this.User.beforeCreate(beforeHook);
        this.User.afterCreate(afterHook);
        this.User.beforeSave(beforeSave);
        this.User.afterSave(afterSave);

        return this.User.create({username: 'Toni', mood: 'happy'}).then(function() {
          expect(beforeHook).to.have.been.calledOnce;
          expect(afterHook).to.have.been.calledOnce;
          expect(beforeSave).to.have.been.calledOnce;
          expect(afterSave).to.have.been.calledOnce;
        });
      });
    });

    describe('on error', function() {
      it('should return an error from before', function() {
        let beforeHook = sinon.spy()
          , beforeSave = sinon.spy()
          , afterHook = sinon.spy()
          , afterSave = sinon.spy();

        this.User.beforeCreate(function(user, options) {
          beforeHook();
          throw new Error('Whoops!');
        });
        this.User.afterCreate(afterHook);
        this.User.beforeSave(beforeSave);
        this.User.afterSave(afterSave);

        return expect(this.User.create({username: 'Toni', mood: 'happy'})).to.be.rejected.then(function(err) {
          expect(beforeHook).to.have.been.calledOnce;
          expect(afterHook).not.to.have.been.called;
          expect(beforeSave).not.to.have.been.called;
          expect(afterSave).not.to.have.been.called;
        });
      });

      it('should return an error from after', function() {
        let beforeHook = sinon.spy()
          , beforeSave = sinon.spy()
          , afterHook = sinon.spy()
          , afterSave = sinon.spy();


        this.User.beforeCreate(beforeHook);
        this.User.afterCreate(function(user, options) {
          afterHook();
          throw new Error('Whoops!');
        });
        this.User.beforeSave(beforeSave);
        this.User.afterSave(afterSave);

        return expect(this.User.create({username: 'Toni', mood: 'happy'})).to.be.rejected.then(function(err) {
          expect(beforeHook).to.have.been.calledOnce;
          expect(afterHook).to.have.been.calledOnce;
          expect(beforeSave).to.have.been.calledOnce;
          expect(afterSave).not.to.have.been.called;
        });
      });
    });

    it('should not trigger hooks on parent when using N:M association setters', function() {
      const A = this.sequelize.define('A', {
        name: Sequelize.STRING
      });
      const B = this.sequelize.define('B', {
        name: Sequelize.STRING
      });

      let hookCalled = 0;

      A.addHook('afterCreate', function(instance, options) {
        hookCalled++;
        return Promise.resolve();
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

    describe('preserves changes to instance', function() {
      it('beforeValidate', function(){
        let hookCalled = 0;

        this.User.beforeValidate(function(user, options) {
          user.mood = 'happy';
          hookCalled++;
        });

        return this.User.create({mood: 'sad', username: 'leafninja'}).then(function(user) {
          expect(user.mood).to.equal('happy');
          expect(user.username).to.equal('leafninja');
          expect(hookCalled).to.equal(1);
        });
      });

      it('afterValidate', function() {
        let hookCalled = 0;

        this.User.afterValidate(function(user, options) {
          user.mood = 'neutral';
          hookCalled++;
        });

        return this.User.create({mood: 'sad', username: 'fireninja'}).then(function(user) {
          expect(user.mood).to.equal('neutral');
          expect(user.username).to.equal('fireninja');
          expect(hookCalled).to.equal(1);
        });
      });

      it('beforeCreate', function() {
        let hookCalled = 0;

        this.User.beforeCreate(function(user, options) {
          user.mood = 'happy';
          hookCalled++;
        });

        return this.User.create({username: 'akira'}).then(function(user) {
          expect(user.mood).to.equal('happy');
          expect(user.username).to.equal('akira');
          expect(hookCalled).to.equal(1);
        });
      });

      it('beforeSave', function() {
        let hookCalled = 0;

        this.User.beforeSave(function(user, options) {
          user.mood = 'happy';
          hookCalled++;
        });

        return this.User.create({username: 'akira'}).then(function(user) {
          expect(user.mood).to.equal('happy');
          expect(user.username).to.equal('akira');
          expect(hookCalled).to.equal(1);
        });
      });

      it('beforeSave with beforeCreate', function() {
        let hookCalled = 0;

        this.User.beforeCreate(function(user, options) {
          user.mood = 'sad';
          hookCalled++;
        });

        this.User.beforeSave(function(user, options) {
          user.mood = 'happy';
          hookCalled++;
        });

        return this.User.create({username: 'akira'}).then(function(user) {
          expect(user.mood).to.equal('happy');
          expect(user.username).to.equal('akira');
          expect(hookCalled).to.equal(2);
        });
      });


    });

  });

});
