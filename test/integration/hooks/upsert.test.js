'use strict';

const chai = require('chai'),
  expect = chai.expect,
  Support = require(__dirname + '/../support'),
  DataTypes = require(__dirname + '/../../../lib/data-types'),
  sinon = require('sinon');

if (Support.sequelize.dialect.supports.upserts) {
  describe(Support.getTestDialectTeaser('Hooks'), () => {
    beforeEach(function() {
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
      return this.sequelize.sync({ force: true });
    });

    describe('#upsert', () => {
      describe('on success', () => {
        it('should run hooks', function() {
          const beforeHook = sinon.spy(),
            afterHook = sinon.spy();

          this.User.beforeUpsert(beforeHook);
          this.User.afterUpsert(afterHook);

          return this.User.upsert({username: 'Toni', mood: 'happy'}).then(() => {
            expect(beforeHook).to.have.been.calledOnce;
            expect(afterHook).to.have.been.calledOnce;
          });
        });
      });

      describe('on error', () => {
        it('should return an error from before', function() {
          const beforeHook = sinon.spy(),
            afterHook = sinon.spy();

          this.User.beforeUpsert(() => {
            beforeHook();
            throw new Error('Whoops!');
          });
          this.User.afterUpsert(afterHook);

          return expect(this.User.upsert({username: 'Toni', mood: 'happy'})).to.be.rejected.then(() => {
            expect(beforeHook).to.have.been.calledOnce;
            expect(afterHook).not.to.have.been.called;
          });
        });

        it('should return an error from after', function() {
          const beforeHook = sinon.spy(),
            afterHook = sinon.spy();

          this.User.beforeUpsert(beforeHook);
          this.User.afterUpsert(() => {
            afterHook();
            throw new Error('Whoops!');
          });

          return expect(this.User.upsert({username: 'Toni', mood: 'happy'})).to.be.rejected.then(() => {
            expect(beforeHook).to.have.been.calledOnce;
            expect(afterHook).to.have.been.calledOnce;
          });
        });
      });

      describe('preserves changes to values', () => {
        it('beforeUpsert', function() {
          let hookCalled = 0;
          const valuesOriginal = { mood: 'sad', username: 'leafninja' };

          this.User.beforeUpsert(values => {
            values.mood = 'happy';
            hookCalled++;
          });

          return this.User.upsert(valuesOriginal).then(() => {
            expect(valuesOriginal.mood).to.equal('happy');
            expect(hookCalled).to.equal(1);
          });
        });
      });
    });
  });
}
