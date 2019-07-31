'use strict';

const chai = require('chai'),
  expect = chai.expect,
  Support = require('../support'),
  DataTypes = require('../../../lib/data-types'),
  sinon = require('sinon');

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

  describe('#destroy', () => {
    describe('on success', () => {
      it('should run hooks', function() {
        const beforeHook = sinon.spy(),
          afterHook = sinon.spy();

        this.User.beforeDestroy(beforeHook);
        this.User.afterDestroy(afterHook);

        return this.User.create({ username: 'Toni', mood: 'happy' }).then(user => {
          return user.destroy().then(() => {
            expect(beforeHook).to.have.been.calledOnce;
            expect(afterHook).to.have.been.calledOnce;
          });
        });
      });
    });

    describe('on error', () => {
      it('should return an error from before', function() {
        const beforeHook = sinon.spy(),
          afterHook = sinon.spy();

        this.User.beforeDestroy(() => {
          beforeHook();
          throw new Error('Whoops!');
        });
        this.User.afterDestroy(afterHook);

        return this.User.create({ username: 'Toni', mood: 'happy' }).then(user => {
          return expect(user.destroy()).to.be.rejected.then(() => {
            expect(beforeHook).to.have.been.calledOnce;
            expect(afterHook).not.to.have.been.called;
          });
        });
      });

      it('should return an error from after', function() {
        const beforeHook = sinon.spy(),
          afterHook = sinon.spy();

        this.User.beforeDestroy(beforeHook);
        this.User.afterDestroy(() => {
          afterHook();
          throw new Error('Whoops!');
        });

        return this.User.create({ username: 'Toni', mood: 'happy' }).then(user => {
          return expect(user.destroy()).to.be.rejected.then(() => {
            expect(beforeHook).to.have.been.calledOnce;
            expect(afterHook).to.have.been.calledOnce;
          });
        });
      });
    });

    describe('with paranoid mode enabled', () => {
      beforeEach(function() {
        this.ParanoidUser = this.sequelize.define('ParanoidUser', {
          username: DataTypes.STRING,
          updatedBy: DataTypes.INTEGER,
          virtualField: {
            type: DataTypes.VIRTUAL(DataTypes.INTEGER, ['updatedBy']),
            get() {
              return this.updatedBy - 1;
            }
          }
        }, {
          paranoid: true,
          hooks: {
            beforeDestroy: instance => instance.updatedBy = 1
          }
        });
      });

      it('sets other changed values when soft deleting and a beforeDestroy hooks kicks in', function() {
        return this.ParanoidUser.sync({ force: true })
          .then(() => this.ParanoidUser.create({ username: 'user1' }))
          .then(user => user.destroy())
          .then(() => this.ParanoidUser.findOne({ paranoid: false }))
          .then(user => {
            expect(user.updatedBy).to.equal(1);
          });
      });

      it('should not throw error when a beforeDestroy hook changes a virtual column', function() {
        this.ParanoidUser.beforeDestroy(instance => instance.virtualField = 2);

        return this.ParanoidUser.sync({ force: true })
          .then(() => this.ParanoidUser.create({ username: 'user1' }))
          .then(user => user.destroy())
          .then(() => this.ParanoidUser.findOne({ paranoid: false }))
          .then(user => {
            expect(user.virtualField).to.equal(0);
          });
      });
    });
  });

});
