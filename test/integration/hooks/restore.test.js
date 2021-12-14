'use strict';

const chai = require('chai'),
  expect = chai.expect,
  Support = require('../support'),
  DataTypes = require('sequelize/lib/data-types'),
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

    this.ParanoidUser = this.sequelize.define('ParanoidUser', {
      username: DataTypes.STRING,
      mood: {
        type: DataTypes.ENUM,
        values: ['happy', 'sad', 'neutral']
      }
    }, {
      paranoid: true
    });

    await this.sequelize.sync({ force: true });
  });

  describe('#restore', () => {
    describe('on success', () => {
      it('should run hooks', async function() {
        const beforeHook = sinon.spy(),
          afterHook = sinon.spy();

        this.ParanoidUser.beforeRestore(beforeHook);
        this.ParanoidUser.afterRestore(afterHook);

        const user = await this.ParanoidUser.create({ username: 'Toni', mood: 'happy' });
        await user.destroy();
        await user.restore();
        expect(beforeHook).to.have.been.calledOnce;
        expect(afterHook).to.have.been.calledOnce;
      });
    });

    describe('on error', () => {
      it('should return an error from before', async function() {
        const beforeHook = sinon.spy(),
          afterHook = sinon.spy();

        this.ParanoidUser.beforeRestore(() => {
          beforeHook();
          throw new Error('Whoops!');
        });
        this.ParanoidUser.afterRestore(afterHook);

        const user = await this.ParanoidUser.create({ username: 'Toni', mood: 'happy' });
        await user.destroy();
        await expect(user.restore()).to.be.rejected;
        expect(beforeHook).to.have.been.calledOnce;
        expect(afterHook).not.to.have.been.called;
      });

      it('should return an error from after', async function() {
        const beforeHook = sinon.spy(),
          afterHook = sinon.spy();

        this.ParanoidUser.beforeRestore(beforeHook);
        this.ParanoidUser.afterRestore(() => {
          afterHook();
          throw new Error('Whoops!');
        });

        const user = await this.ParanoidUser.create({ username: 'Toni', mood: 'happy' });
        await user.destroy();
        await expect(user.restore()).to.be.rejected;
        expect(beforeHook).to.have.been.calledOnce;
        expect(afterHook).to.have.been.calledOnce;
      });
    });
  });

});
