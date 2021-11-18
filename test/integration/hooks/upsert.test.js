'use strict';

const chai = require('chai'),
  expect = chai.expect,
  Support = require('../support'),
  DataTypes = require('sequelize/lib/data-types'),
  sinon = require('sinon');

if (Support.sequelize.dialect.supports.upserts) {
  describe(Support.getTestDialectTeaser('Hooks'), () => {
    beforeEach(async function() {
      this.User = this.sequelize.define('User', {
        username: {
          type: DataTypes.STRING,
          allowNull: false,
          unique: true //Either Primary Key/Unique Keys should be passed to upsert
        },
        mood: {
          type: DataTypes.ENUM,
          values: ['happy', 'sad', 'neutral']
        }
      });
      await this.sequelize.sync({ force: true });
    });

    describe('#upsert', () => {
      describe('on success', () => {
        it('should run hooks', async function() {
          const beforeHook = sinon.spy(),
            afterHook = sinon.spy();

          this.User.beforeUpsert(beforeHook);
          this.User.afterUpsert(afterHook);

          await this.User.upsert({ username: 'Toni', mood: 'happy' });
          expect(beforeHook).to.have.been.calledOnce;
          expect(afterHook).to.have.been.calledOnce;
        });
      });

      describe('on error', () => {
        it('should return an error from before', async function() {
          const beforeHook = sinon.spy(),
            afterHook = sinon.spy();

          this.User.beforeUpsert(() => {
            beforeHook();
            throw new Error('Whoops!');
          });
          this.User.afterUpsert(afterHook);

          await expect(this.User.upsert({ username: 'Toni', mood: 'happy' })).to.be.rejected;
          expect(beforeHook).to.have.been.calledOnce;
          expect(afterHook).not.to.have.been.called;
        });

        it('should return an error from after', async function() {
          const beforeHook = sinon.spy(),
            afterHook = sinon.spy();

          this.User.beforeUpsert(beforeHook);
          this.User.afterUpsert(() => {
            afterHook();
            throw new Error('Whoops!');
          });

          await expect(this.User.upsert({ username: 'Toni', mood: 'happy' })).to.be.rejected;
          expect(beforeHook).to.have.been.calledOnce;
          expect(afterHook).to.have.been.calledOnce;
        });
      });

      describe('preserves changes to values', () => {
        it('beforeUpsert', async function() {
          let hookCalled = 0;
          const valuesOriginal = { mood: 'sad', username: 'leafninja' };

          this.User.beforeUpsert(values => {
            values.mood = 'happy';
            hookCalled++;
          });

          await this.User.upsert(valuesOriginal);
          expect(valuesOriginal.mood).to.equal('happy');
          expect(hookCalled).to.equal(1);
        });
      });
    });
  });
}
