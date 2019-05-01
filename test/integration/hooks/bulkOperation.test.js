'use strict';

const chai = require('chai'),
  expect = chai.expect,
  Support = require('../support'),
  DataTypes = require('../../../lib/data-types'),
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

  describe('#bulkCreate', () => {
    describe('on success', () => {
      it('should run hooks', function() {
        const beforeBulk = sinon.spy(),
          afterBulk = sinon.spy();

        this.User.addHook('beforeBulkCreate', beforeBulk);

        this.User.addHook('afterBulkCreate', afterBulk);

        return this.User.bulkCreate([
          { username: 'Cheech', mood: 'sad' },
          { username: 'Chong', mood: 'sad' }
        ]).then(() => {
          expect(beforeBulk).to.have.been.calledOnce;
          expect(afterBulk).to.have.been.calledOnce;
        });
      });
    });

    describe('on error', () => {
      it('should return an error from before', function() {
        this.User.addHook('beforeBulkCreate', () => {
          throw new Error('Whoops!');
        });

        return expect(this.User.bulkCreate([
          { username: 'Cheech', mood: 'sad' },
          { username: 'Chong', mood: 'sad' }
        ])).to.be.rejected;
      });

      it('should return an error from after', function() {
        this.User.addHook('afterBulkCreate', () => {
          throw new Error('Whoops!');
        });

        return expect(this.User.bulkCreate([
          { username: 'Cheech', mood: 'sad' },
          { username: 'Chong', mood: 'sad' }
        ])).to.be.rejected;
      });
    });

    describe('with the {individualHooks: true} option', () => {
      beforeEach(function() {
        this.User = this.sequelize.define('User', {
          username: {
            type: DataTypes.STRING,
            defaultValue: ''
          },
          beforeHookTest: {
            type: DataTypes.BOOLEAN,
            defaultValue: false
          },
          aNumber: {
            type: DataTypes.INTEGER,
            defaultValue: 0
          }
        });

        return this.User.sync({ force: true });
      });

      it('should run the afterCreate/beforeCreate functions for each item created successfully', function() {
        let beforeBulkCreate = false,
          afterBulkCreate = false;

        this.User.addHook('beforeBulkCreate', () => {
          beforeBulkCreate = true;
          return Promise.resolve();
        });

        this.User.addHook('afterBulkCreate', () => {
          afterBulkCreate = true;
          return Promise.resolve();
        });

        this.User.addHook('beforeCreate', user => {
          user.beforeHookTest = true;
          return Promise.resolve();
        });

        this.User.addHook('afterCreate', user => {
          user.username = `User${user.id}`;
          return Promise.resolve();
        });

        return this.User.bulkCreate([{ aNumber: 5 }, { aNumber: 7 }, { aNumber: 3 }], { fields: ['aNumber'], individualHooks: true }).then(records => {
          records.forEach(record => {
            expect(record.username).to.equal(`User${record.id}`);
            expect(record.beforeHookTest).to.be.true;
          });
          expect(beforeBulkCreate).to.be.true;
          expect(afterBulkCreate).to.be.true;
        });
      });

      it('should run the afterCreate/beforeCreate functions for each item created with an error', function() {
        let beforeBulkCreate = false,
          afterBulkCreate = false;

        this.User.addHook('beforeBulkCreate', () => {
          beforeBulkCreate = true;
          return Promise.resolve();
        });

        this.User.addHook('afterBulkCreate', () => {
          afterBulkCreate = true;
          return Promise.resolve();
        });

        this.User.addHook('beforeCreate', () => {
          return Promise.reject(new Error('You shall not pass!'));
        });

        this.User.addHook('afterCreate', user => {
          user.username = `User${user.id}`;
          return Promise.resolve();
        });

        return this.User.bulkCreate([{ aNumber: 5 }, { aNumber: 7 }, { aNumber: 3 }], { fields: ['aNumber'], individualHooks: true }).catch(err => {
          expect(err).to.be.instanceOf(Error);
          expect(beforeBulkCreate).to.be.true;
          expect(afterBulkCreate).to.be.false;
        });
      });
    });
  });

  describe('#bulkUpdate', () => {
    describe('on success', () => {
      it('should run hooks', function() {
        const beforeBulk = sinon.spy(),
          afterBulk = sinon.spy();

        this.User.addHook('beforeBulkUpdate', beforeBulk);
        this.User.addHook('afterBulkUpdate', afterBulk);

        return this.User.bulkCreate([
          { username: 'Cheech', mood: 'sad' },
          { username: 'Chong', mood: 'sad' }
        ]).then(() => {
          return this.User.update({ mood: 'happy' }, { where: { mood: 'sad' } }).then(() => {
            expect(beforeBulk).to.have.been.calledOnce;
            expect(afterBulk).to.have.been.calledOnce;
          });
        });
      });
    });

    describe('on error', () => {
      it('should return an error from before', function() {
        this.User.addHook('beforeBulkUpdate', () => {
          throw new Error('Whoops!');
        });

        return this.User.bulkCreate([
          { username: 'Cheech', mood: 'sad' },
          { username: 'Chong', mood: 'sad' }
        ]).then(() => {
          return expect(this.User.update({ mood: 'happy' }, { where: { mood: 'sad' } })).to.be.rejected;
        });
      });

      it('should return an error from after', function() {
        this.User.addHook('afterBulkUpdate', () => {
          throw new Error('Whoops!');
        });

        return this.User.bulkCreate([
          { username: 'Cheech', mood: 'sad' },
          { username: 'Chong', mood: 'sad' }
        ]).then(() => {
          return expect(this.User.update({ mood: 'happy' }, { where: { mood: 'sad' } })).to.be.rejected;
        });
      });
    });

    describe('with the {individualHooks: true} option', () => {
      beforeEach(function() {
        this.User = this.sequelize.define('User', {
          username: {
            type: DataTypes.STRING,
            defaultValue: ''
          },
          beforeHookTest: {
            type: DataTypes.BOOLEAN,
            defaultValue: false
          },
          aNumber: {
            type: DataTypes.INTEGER,
            defaultValue: 0
          }
        });

        return this.User.sync({ force: true });
      });

      it('should run the after/before functions for each item created successfully', function() {
        const beforeBulk = sinon.spy(),
          afterBulk = sinon.spy();

        this.User.addHook('beforeBulkUpdate', beforeBulk);

        this.User.addHook('afterBulkUpdate', afterBulk);

        this.User.addHook('beforeUpdate', user => {
          expect(user.changed()).to.not.be.empty;
          user.beforeHookTest = true;
        });

        this.User.addHook('afterUpdate', user => {
          user.username = `User${user.id}`;
        });

        return this.User.bulkCreate([
          { aNumber: 1 }, { aNumber: 1 }, { aNumber: 1 }
        ]).then(() => {
          return this.User.update({ aNumber: 10 }, { where: { aNumber: 1 }, individualHooks: true }).then(([, records]) => {
            records.forEach(record => {
              expect(record.username).to.equal(`User${record.id}`);
              expect(record.beforeHookTest).to.be.true;
            });
            expect(beforeBulk).to.have.been.calledOnce;
            expect(afterBulk).to.have.been.calledOnce;
          });
        });
      });

      it('should run the after/before functions for each item created successfully changing some data before updating', function() {
        this.User.addHook('beforeUpdate', user => {
          expect(user.changed()).to.not.be.empty;
          if (user.get('id') === 1) {
            user.set('aNumber', user.get('aNumber') + 3);
          }
        });

        return this.User.bulkCreate([
          { aNumber: 1 }, { aNumber: 1 }, { aNumber: 1 }
        ]).then(() => {
          return this.User.update({ aNumber: 10 }, { where: { aNumber: 1 }, individualHooks: true }).then(([, records]) => {
            records.forEach(record => {
              expect(record.aNumber).to.equal(10 + (record.id === 1 ? 3 : 0));
            });
          });
        });
      });

      it('should run the after/before functions for each item created with an error', function() {
        const beforeBulk = sinon.spy(),
          afterBulk = sinon.spy();

        this.User.addHook('beforeBulkUpdate', beforeBulk);

        this.User.addHook('afterBulkUpdate', afterBulk);

        this.User.addHook('beforeUpdate', () => {
          throw new Error('You shall not pass!');
        });

        this.User.addHook('afterUpdate', user => {
          user.username = `User${user.id}`;
        });

        return this.User.bulkCreate([{ aNumber: 1 }, { aNumber: 1 }, { aNumber: 1 }], { fields: ['aNumber'] }).then(() => {
          return this.User.update({ aNumber: 10 }, { where: { aNumber: 1 }, individualHooks: true }).catch(err => {
            expect(err).to.be.instanceOf(Error);
            expect(err.message).to.be.equal('You shall not pass!');
            expect(beforeBulk).to.have.been.calledOnce;
            expect(afterBulk).not.to.have.been.called;
          });
        });
      });
    });
  });

  describe('#bulkDestroy', () => {
    describe('on success', () => {
      it('should run hooks', function() {
        const beforeBulk = sinon.spy(),
          afterBulk = sinon.spy();

        this.User.addHook('beforeBulkDestroy', beforeBulk);
        this.User.addHook('afterBulkDestroy', afterBulk);

        return this.User.destroy({ where: { username: 'Cheech', mood: 'sad' } }).then(() => {
          expect(beforeBulk).to.have.been.calledOnce;
          expect(afterBulk).to.have.been.calledOnce;
        });
      });
    });

    describe('on error', () => {
      it('should return an error from before', function() {
        this.User.addHook('beforeBulkDestroy', () => {
          throw new Error('Whoops!');
        });

        return expect(this.User.destroy({ where: { username: 'Cheech', mood: 'sad' } })).to.be.rejected;
      });

      it('should return an error from after', function() {
        this.User.addHook('afterBulkDestroy', () => {
          throw new Error('Whoops!');
        });

        return expect(this.User.destroy({ where: { username: 'Cheech', mood: 'sad' } })).to.be.rejected;
      });
    });

    describe('with the {individualHooks: true} option', () => {
      beforeEach(function() {
        this.User = this.sequelize.define('User', {
          username: {
            type: DataTypes.STRING,
            defaultValue: ''
          },
          beforeHookTest: {
            type: DataTypes.BOOLEAN,
            defaultValue: false
          },
          aNumber: {
            type: DataTypes.INTEGER,
            defaultValue: 0
          }
        });

        return this.User.sync({ force: true });
      });

      it('should run the after/before functions for each item created successfully', function() {
        let beforeBulk = false,
          afterBulk = false,
          beforeHook = false,
          afterHook = false;

        this.User.addHook('beforeBulkDestroy', () => {
          beforeBulk = true;
          return Promise.resolve();
        });

        this.User.addHook('afterBulkDestroy', () => {
          afterBulk = true;
          return Promise.resolve();
        });

        this.User.addHook('beforeDestroy', () => {
          beforeHook = true;
          return Promise.resolve();
        });

        this.User.addHook('afterDestroy', () => {
          afterHook = true;
          return Promise.resolve();
        });

        return this.User.bulkCreate([
          { aNumber: 1 }, { aNumber: 1 }, { aNumber: 1 }
        ]).then(() => {
          return this.User.destroy({ where: { aNumber: 1 }, individualHooks: true }).then(() => {
            expect(beforeBulk).to.be.true;
            expect(afterBulk).to.be.true;
            expect(beforeHook).to.be.true;
            expect(afterHook).to.be.true;
          });
        });
      });

      it('should run the after/before functions for each item created with an error', function() {
        let beforeBulk = false,
          afterBulk = false,
          beforeHook = false,
          afterHook = false;

        this.User.addHook('beforeBulkDestroy', () => {
          beforeBulk = true;
          return Promise.resolve();
        });

        this.User.addHook('afterBulkDestroy', () => {
          afterBulk = true;
          return Promise.resolve();
        });

        this.User.addHook('beforeDestroy', () => {
          beforeHook = true;
          return Promise.reject(new Error('You shall not pass!'));
        });

        this.User.addHook('afterDestroy', () => {
          afterHook = true;
          return Promise.resolve();
        });

        return this.User.bulkCreate([{ aNumber: 1 }, { aNumber: 1 }, { aNumber: 1 }], { fields: ['aNumber'] }).then(() => {
          return this.User.destroy({ where: { aNumber: 1 }, individualHooks: true }).catch(err => {
            expect(err).to.be.instanceOf(Error);
            expect(beforeBulk).to.be.true;
            expect(beforeHook).to.be.true;
            expect(afterBulk).to.be.false;
            expect(afterHook).to.be.false;
          });
        });
      });
    });
  });

  describe('#bulkRestore', () => {
    beforeEach(function() {
      return this.ParanoidUser.bulkCreate([
        { username: 'adam', mood: 'happy' },
        { username: 'joe', mood: 'sad' }
      ]).then(() => {
        return this.ParanoidUser.destroy({ truncate: true });
      });
    });

    describe('on success', () => {
      it('should run hooks', function() {
        const beforeBulk = sinon.spy(),
          afterBulk = sinon.spy();

        this.ParanoidUser.addHook('beforeBulkRestore', beforeBulk);
        this.ParanoidUser.addHook('afterBulkRestore', afterBulk);

        return this.ParanoidUser.restore({ where: { username: 'adam', mood: 'happy' } }).then(() => {
          expect(beforeBulk).to.have.been.calledOnce;
          expect(afterBulk).to.have.been.calledOnce;
        });
      });
    });

    describe('on error', () => {
      it('should return an error from before', function() {
        this.ParanoidUser.addHook('beforeBulkRestore', () => {
          throw new Error('Whoops!');
        });

        return expect(this.ParanoidUser.restore({ where: { username: 'adam', mood: 'happy' } })).to.be.rejected;
      });

      it('should return an error from after', function() {
        this.ParanoidUser.addHook('afterBulkRestore', () => {
          throw new Error('Whoops!');
        });

        return expect(this.ParanoidUser.restore({ where: { username: 'adam', mood: 'happy' } })).to.be.rejected;
      });
    });

    describe('with the {individualHooks: true} option', () => {
      beforeEach(function() {
        this.ParanoidUser = this.sequelize.define('ParanoidUser', {
          aNumber: {
            type: DataTypes.INTEGER,
            defaultValue: 0
          }
        }, {
          paranoid: true
        });

        return this.ParanoidUser.sync({ force: true });
      });

      it('should run the after/before functions for each item restored successfully', function() {
        const beforeBulk = sinon.spy(),
          afterBulk = sinon.spy(),
          beforeHook = sinon.spy(),
          afterHook = sinon.spy();

        this.ParanoidUser.addHook('beforeBulkRestore', beforeBulk);
        this.ParanoidUser.addHook('afterBulkRestore', afterBulk);
        this.ParanoidUser.addHook('beforeRestore', beforeHook);
        this.ParanoidUser.addHook('afterRestore', afterHook);

        return this.ParanoidUser.bulkCreate([
          { aNumber: 1 }, { aNumber: 1 }, { aNumber: 1 }
        ]).then(() => {
          return this.ParanoidUser.destroy({ where: { aNumber: 1 } });
        }).then(() => {
          return this.ParanoidUser.restore({ where: { aNumber: 1 }, individualHooks: true });
        }).then(() => {
          expect(beforeBulk).to.have.been.calledOnce;
          expect(afterBulk).to.have.been.calledOnce;
          expect(beforeHook).to.have.been.calledThrice;
          expect(afterHook).to.have.been.calledThrice;
        });
      });

      it('should run the after/before functions for each item restored with an error', function() {
        const beforeBulk = sinon.spy(),
          afterBulk = sinon.spy(),
          beforeHook = sinon.spy(),
          afterHook = sinon.spy();

        this.ParanoidUser.addHook('beforeBulkRestore', beforeBulk);
        this.ParanoidUser.addHook('afterBulkRestore', afterBulk);
        this.ParanoidUser.addHook('beforeRestore', () => {
          beforeHook();
          return Promise.reject(new Error('You shall not pass!'));
        });

        this.ParanoidUser.addHook('afterRestore', afterHook);

        return this.ParanoidUser.bulkCreate([{ aNumber: 1 }, { aNumber: 1 }, { aNumber: 1 }], { fields: ['aNumber'] }).then(() => {
          return this.ParanoidUser.destroy({ where: { aNumber: 1 } });
        }).then(() => {
          return this.ParanoidUser.restore({ where: { aNumber: 1 }, individualHooks: true });
        }).catch(err => {
          expect(err).to.be.instanceOf(Error);
          expect(beforeBulk).to.have.been.calledOnce;
          expect(beforeHook).to.have.been.calledThrice;
          expect(afterBulk).not.to.have.been.called;
          expect(afterHook).not.to.have.been.called;
        });
      });
    });
  });
});
