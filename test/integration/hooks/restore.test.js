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

    this.ParanoidUser = this.sequelize.define('ParanoidUser', {
      username: DataTypes.STRING,
      mood: {
        type: DataTypes.ENUM,
        values: ['happy', 'sad', 'neutral']
      }
    }, {
      paranoid: true
    });

    return this.sequelize.sync({ force: true });
  });

  describe('#restore', () => {
    describe('on success', () => {
      it('should run hooks', function() {
        const beforeHook = sinon.spy(),
          afterHook = sinon.spy();

        this.ParanoidUser.addHook('beforeRestore', beforeHook);
        this.ParanoidUser.addHook('afterRestore', afterHook);

        return this.ParanoidUser.create({ username: 'Toni', mood: 'happy' }).then(user => {
          return user.destroy().then(() => {
            return user.restore().then(() => {
              expect(beforeHook).to.have.been.calledOnce;
              expect(afterHook).to.have.been.calledOnce;
            });
          });
        });
      });
    });

    describe('on error', () => {
      it('should return an error from before', function() {
        const beforeHook = sinon.spy(),
          afterHook = sinon.spy();

        this.ParanoidUser.addHook('beforeRestore', () => {
          beforeHook();
          throw new Error('Whoops!');
        });
        this.ParanoidUser.addHook('afterRestore', afterHook);

        return this.ParanoidUser.create({ username: 'Toni', mood: 'happy' }).then(user => {
          return user.destroy().then(() => {
            return expect(user.restore()).to.be.rejected.then(() => {
              expect(beforeHook).to.have.been.calledOnce;
              expect(afterHook).not.to.have.been.called;
            });
          });
        });
      });

      it('should return an error from after', function() {
        const beforeHook = sinon.spy(),
          afterHook = sinon.spy();

        this.ParanoidUser.addHook('beforeRestore', beforeHook);
        this.ParanoidUser.addHook('afterRestore', () => {
          afterHook();
          throw new Error('Whoops!');
        });

        return this.ParanoidUser.create({ username: 'Toni', mood: 'happy' }).then(user => {
          return user.destroy().then(() => {
            return expect(user.restore()).to.be.rejected.then(() => {
              expect(beforeHook).to.have.been.calledOnce;
              expect(afterHook).to.have.been.calledOnce;
            });
          });
        });
      });
    });
  });

});
