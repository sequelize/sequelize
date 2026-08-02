import * as chai from 'chai';
import Support from '../support.js';
import DataTypes from '../../../lib/data-types.js';
import sinon from 'sinon';

const expect = chai.expect;

if (Support.sequelize.dialect.supports.upserts) {
  describe(Support.getTestDialectTeaser('Hooks'), () => {
    beforeEach(function () {
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
        it('should run hooks', function () {
          const beforeHook = sinon.spy(),
            afterHook = sinon.spy();

          this.User.beforeUpsert(beforeHook);
          this.User.afterUpsert(afterHook);

          return this.User.upsert({ username: 'Toni', mood: 'happy' }).then(() => {
            expect(beforeHook.calledOnce).to.be.true;
            expect(afterHook.calledOnce).to.be.true;
          });
        });
      });

      describe('on error', () => {
        it('should return an error from before', function () {
          const beforeHook = sinon.spy(),
            afterHook = sinon.spy();

          this.User.beforeUpsert(() => {
            beforeHook();
            throw new Error('Whoops!');
          });
          this.User.afterUpsert(afterHook);

          return expect(this.User.upsert({ username: 'Toni', mood: 'happy' })).to.be.rejected.then(() => {
            expect(beforeHook.calledOnce).to.be.true;
            expect(afterHook.called, 'afterHook should not have been called').to.be.false;
          });
        });

        it('should return an error from after', function () {
          const beforeHook = sinon.spy(),
            afterHook = sinon.spy();

          this.User.beforeUpsert(beforeHook);
          this.User.afterUpsert(() => {
            afterHook();
            throw new Error('Whoops!');
          });

          return expect(this.User.upsert({ username: 'Toni', mood: 'happy' })).to.be.rejected.then(() => {
            expect(beforeHook.calledOnce).to.be.true;
            expect(afterHook.calledOnce).to.be.true;
          });
        });
      });

      describe('preserves changes to values', () => {
        it('beforeUpsert', function () {
          let hookCalled = 0;
          const valuesOriginal = { mood: 'sad', username: 'leafninja' };

          this.User.beforeUpsert((values) => {
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
