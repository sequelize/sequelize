'use strict';

const chai = require('chai'),
  expect = chai.expect,
  Support = require('../support'),
  DataTypes = require('sequelize/lib/data-types'),
  Sequelize = Support.Sequelize,
  sinon = require('sinon');

describe(Support.getTestDialectTeaser('Hooks'), () => {
  beforeEach(async function() {
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
    await this.sequelize.sync({ force: true });
  });

  describe('#create', () => {
    describe('on success', () => {
      it('should run hooks', async function() {
        const beforeHook = sinon.spy(),
          afterHook = sinon.spy(),
          beforeSave = sinon.spy(),
          afterSave = sinon.spy();

        this.User.beforeCreate(beforeHook);
        this.User.afterCreate(afterHook);
        this.User.beforeSave(beforeSave);
        this.User.afterSave(afterSave);

        await this.User.create({ username: 'Toni', mood: 'happy' });
        expect(beforeHook).to.have.been.calledOnce;
        expect(afterHook).to.have.been.calledOnce;
        expect(beforeSave).to.have.been.calledOnce;
        expect(afterSave).to.have.been.calledOnce;
      });
    });

    describe('on error', () => {
      it('should return an error from before', async function() {
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

        await expect(this.User.create({ username: 'Toni', mood: 'happy' })).to.be.rejected;
        expect(beforeHook).to.have.been.calledOnce;
        expect(afterHook).not.to.have.been.called;
        expect(beforeSave).not.to.have.been.called;
        expect(afterSave).not.to.have.been.called;
      });

      it('should return an error from after', async function() {
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

        await expect(this.User.create({ username: 'Toni', mood: 'happy' })).to.be.rejected;
        expect(beforeHook).to.have.been.calledOnce;
        expect(afterHook).to.have.been.calledOnce;
        expect(beforeSave).to.have.been.calledOnce;
        expect(afterSave).not.to.have.been.called;
      });
    });

    it('should not trigger hooks on parent when using N:M association setters', async function() {
      const A = this.sequelize.define('A', {
        name: Sequelize.STRING
      });
      const B = this.sequelize.define('B', {
        name: Sequelize.STRING
      });

      let hookCalled = 0;

      A.addHook('afterCreate', async () => {
        hookCalled++;
      });

      B.belongsToMany(A, { through: 'a_b' });
      A.belongsToMany(B, { through: 'a_b' });

      await this.sequelize.sync({ force: true });

      const [a, b] = await Promise.all([
        A.create({ name: 'a' }),
        B.create({ name: 'b' })
      ]);

      await a.addB(b);
      expect(hookCalled).to.equal(1);
    });

    describe('preserves changes to instance', () => {
      it('beforeValidate', async function() {
        let hookCalled = 0;

        this.User.beforeValidate(user => {
          user.mood = 'happy';
          hookCalled++;
        });

        const user = await this.User.create({ mood: 'sad', username: 'leafninja' });
        expect(user.mood).to.equal('happy');
        expect(user.username).to.equal('leafninja');
        expect(hookCalled).to.equal(1);
      });

      it('afterValidate', async function() {
        let hookCalled = 0;

        this.User.afterValidate(user => {
          user.mood = 'neutral';
          hookCalled++;
        });

        const user = await this.User.create({ mood: 'sad', username: 'fireninja' });
        expect(user.mood).to.equal('neutral');
        expect(user.username).to.equal('fireninja');
        expect(hookCalled).to.equal(1);
      });

      it('beforeCreate', async function() {
        let hookCalled = 0;

        this.User.beforeCreate(user => {
          user.mood = 'happy';
          hookCalled++;
        });

        const user = await this.User.create({ username: 'akira' });
        expect(user.mood).to.equal('happy');
        expect(user.username).to.equal('akira');
        expect(hookCalled).to.equal(1);
      });

      it('beforeSave', async function() {
        let hookCalled = 0;

        this.User.beforeSave(user => {
          user.mood = 'happy';
          hookCalled++;
        });

        const user = await this.User.create({ username: 'akira' });
        expect(user.mood).to.equal('happy');
        expect(user.username).to.equal('akira');
        expect(hookCalled).to.equal(1);
      });

      it('beforeSave with beforeCreate', async function() {
        let hookCalled = 0;

        this.User.beforeCreate(user => {
          user.mood = 'sad';
          hookCalled++;
        });

        this.User.beforeSave(user => {
          user.mood = 'happy';
          hookCalled++;
        });

        const user = await this.User.create({ username: 'akira' });
        expect(user.mood).to.equal('happy');
        expect(user.username).to.equal('akira');
        expect(hookCalled).to.equal(2);
      });
    });
  });
});
