import * as chai from 'chai';
import Support from '../support.js';
import DataTypes from '../../../lib/data-types.js';
import sinon from 'sinon';

const expect = chai.expect;

describe(Support.getTestDialectTeaser('Hooks'), () => {
  beforeEach(function () {
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

  describe('#destroy', () => {
    describe('on success', () => {
      it('should run hooks', function () {
        const beforeHook = sinon.spy(),
          afterHook = sinon.spy();

        this.User.beforeDestroy(beforeHook);
        this.User.afterDestroy(afterHook);

        return this.User.create({ username: 'Toni', mood: 'happy' }).then((user) => {
          return user.destroy().then(() => {
            expect(beforeHook.calledOnce).to.be.true;
            expect(afterHook.calledOnce).to.be.true;
          });
        });
      });
    });

    describe('on error', () => {
      it('should return an error from before', function () {
        const beforeHook = sinon.spy(),
          afterHook = sinon.spy();

        this.User.beforeDestroy(() => {
          beforeHook();
          throw new Error('Whoops!');
        });
        this.User.afterDestroy(afterHook);

        return this.User.create({ username: 'Toni', mood: 'happy' }).then((user) => {
          return expect(user.destroy()).to.be.rejected.then(() => {
            expect(beforeHook.calledOnce).to.be.true;
            expect(afterHook.called, 'afterHook should not have been called').to.be.false;
          });
        });
      });

      it('should return an error from after', function () {
        const beforeHook = sinon.spy(),
          afterHook = sinon.spy();

        this.User.beforeDestroy(beforeHook);
        this.User.afterDestroy(() => {
          afterHook();
          throw new Error('Whoops!');
        });

        return this.User.create({ username: 'Toni', mood: 'happy' }).then((user) => {
          return expect(user.destroy()).to.be.rejected.then(() => {
            expect(beforeHook.calledOnce).to.be.true;
            expect(afterHook.calledOnce).to.be.true;
          });
        });
      });
    });
  });
});
