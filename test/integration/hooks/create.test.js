'use strict';

const chai = require('chai'),
  expect = chai.expect,
  Support = require(__dirname + '/../support'),
  DataTypes = require(__dirname + '/../../../lib/data-types'),
  Sequelize = Support.Sequelize,
  sinon = require('sinon'),
  Promise = require('bluebird');

describe(Support.getTestDialectTeaser('Hooks'), () => {
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

  describe('#create', () => {
    describe('on success', () => {
      it('should run hooks', function() {
        const beforeHook = sinon.spy(),
          afterHook = sinon.spy(),
          beforeSave = sinon.spy(),
          afterSave = sinon.spy();

        this.User.beforeCreate(beforeHook);
        this.User.afterCreate(afterHook);
        this.User.beforeSave(beforeSave);
        this.User.afterSave(afterSave);

        return this.User.create({username: 'Toni', mood: 'happy'}).then(() => {
          expect(beforeHook).to.have.been.calledOnce;
          expect(afterHook).to.have.been.calledOnce;
          expect(beforeSave).to.have.been.calledOnce;
          expect(afterSave).to.have.been.calledOnce;
        });
      });
    });

    describe('on error', () => {
      it('should return an error from before', function() {
        const beforeHook = sinon.spy(),
          beforeSave = sinon.spy(),
          afterHook = sinon.spy(),
          afterSave = sinon.spy();

        this.User.beforeCreate(() => {
          beforeHook();
          throw new Error('Whoops!');
        });
        this.User.afterCreate(afterHook);
        this.User.beforeSave(beforeSave);
        this.User.afterSave(afterSave);

        return expect(this.User.create({username: 'Toni', mood: 'happy'})).to.be.rejected.then(() => {
          expect(beforeHook).to.have.been.calledOnce;
          expect(afterHook).not.to.have.been.called;
          expect(beforeSave).not.to.have.been.called;
          expect(afterSave).not.to.have.been.called;
        });
      });

      it('should return an error from after', function() {
        const beforeHook = sinon.spy(),
          beforeSave = sinon.spy(),
          afterHook = sinon.spy(),
          afterSave = sinon.spy();


        this.User.beforeCreate(beforeHook);
        this.User.afterCreate(() => {
          afterHook();
          throw new Error('Whoops!');
        });
        this.User.beforeSave(beforeSave);
        this.User.afterSave(afterSave);

        return expect(this.User.create({username: 'Toni', mood: 'happy'})).to.be.rejected.then(() => {
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

      A.addHook('afterCreate', () => {
        hookCalled++;
        return Promise.resolve();
      });

      B.belongsToMany(A, {through: 'a_b'});
      A.belongsToMany(B, {through: 'a_b'});

      return this.sequelize.sync({force: true}).bind(this).then(function() {
        return this.sequelize.Promise.all([
          A.create({name: 'a'}),
          B.create({name: 'b'})
        ]).spread((a, b) => {
          return a.addB(b).then(() => {
            expect(hookCalled).to.equal(1);
          });
        });
      });
    });

    describe('preserves changes to instance', () => {
      it('beforeValidate', function() {
        let hookCalled = 0;

        this.User.beforeValidate(user => {
          user.mood = 'happy';
          hookCalled++;
        });

        return this.User.create({mood: 'sad', username: 'leafninja'}).then(user => {
          expect(user.mood).to.equal('happy');
          expect(user.username).to.equal('leafninja');
          expect(hookCalled).to.equal(1);
        });
      });

      it('afterValidate', function() {
        let hookCalled = 0;

        this.User.afterValidate(user => {
          user.mood = 'neutral';
          hookCalled++;
        });

        return this.User.create({mood: 'sad', username: 'fireninja'}).then(user => {
          expect(user.mood).to.equal('neutral');
          expect(user.username).to.equal('fireninja');
          expect(hookCalled).to.equal(1);
        });
      });

      it('beforeCreate', function() {
        let hookCalled = 0;

        this.User.beforeCreate(user => {
          user.mood = 'happy';
          hookCalled++;
        });

        return this.User.create({username: 'akira'}).then(user => {
          expect(user.mood).to.equal('happy');
          expect(user.username).to.equal('akira');
          expect(hookCalled).to.equal(1);
        });
      });

      it('beforeSave', function() {
        let hookCalled = 0;

        this.User.beforeSave(user => {
          user.mood = 'happy';
          hookCalled++;
        });

        return this.User.create({username: 'akira'}).then(user => {
          expect(user.mood).to.equal('happy');
          expect(user.username).to.equal('akira');
          expect(hookCalled).to.equal(1);
        });
      });

      it('beforeSave with beforeCreate', function() {
        let hookCalled = 0;

        this.User.beforeCreate(user => {
          user.mood = 'sad';
          hookCalled++;
        });

        this.User.beforeSave(user => {
          user.mood = 'happy';
          hookCalled++;
        });

        return this.User.create({username: 'akira'}).then(user => {
          expect(user.mood).to.equal('happy');
          expect(user.username).to.equal('akira');
          expect(hookCalled).to.equal(2);
        });
      });
    });
  });
});
