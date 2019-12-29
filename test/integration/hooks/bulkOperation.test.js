'use strict';

const chai = require('chai'),
  expect = chai.expect,
  Support = require(__dirname + '/../support'),
  DataTypes = require(__dirname + '/../../../lib/data-types'),
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

        this.User.beforeBulkCreate(beforeBulk);

        this.User.afterBulkCreate(afterBulk);

        return this.User.bulkCreate([
          {username: 'Cheech', mood: 'sad'},
          {username: 'Chong', mood: 'sad'}
        ]).then(() => {
          expect(beforeBulk).to.have.been.calledOnce;
          expect(afterBulk).to.have.been.calledOnce;
        });
      });
    });

    describe('on error', () => {
      it('should return an error from before', function() {
        this.User.beforeBulkCreate(() => {
          throw new Error('Whoops!');
        });

        return expect(this.User.bulkCreate([
          {username: 'Cheech', mood: 'sad'},
          {username: 'Chong', mood: 'sad'}
        ])).to.be.rejected;
      });

      it('should return an error from after', function() {
        this.User.afterBulkCreate(() => {
          throw new Error('Whoops!');
        });

        return expect(this.User.bulkCreate([
          {username: 'Cheech', mood: 'sad'},
          {username: 'Chong', mood: 'sad'}
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

        this.User.beforeBulkCreate(() => {
          beforeBulkCreate = true;
          return Promise.resolve();
        });

        this.User.afterBulkCreate(() => {
          afterBulkCreate = true;
          return Promise.resolve();
        });

        this.User.beforeCreate(user => {
          user.beforeHookTest = true;
          return Promise.resolve();
        });

        this.User.afterCreate(user => {
          user.username = 'User' + user.id;
          return Promise.resolve();
        });

        return this.User.bulkCreate([{aNumber: 5}, {aNumber: 7}, {aNumber: 3}], { fields: ['aNumber'], individualHooks: true }).then(records => {
          records.forEach(record => {
            expect(record.username).to.equal('User' + record.id);
            expect(record.beforeHookTest).to.be.true;
          });
          expect(beforeBulkCreate).to.be.true;
          expect(afterBulkCreate).to.be.true;
        });
      });

      it('should run the afterCreate/beforeCreate functions for each item created with an error', function() {
        let beforeBulkCreate = false,
          afterBulkCreate = false;

        this.User.beforeBulkCreate(() => {
          beforeBulkCreate = true;
          return Promise.resolve();
        });

        this.User.afterBulkCreate(() => {
          afterBulkCreate = true;
          return Promise.resolve();
        });

        this.User.beforeCreate(() => {
          return Promise.reject(new Error('You shall not pass!'));
        });

        this.User.afterCreate(user => {
          user.username = 'User' + user.id;
          return Promise.resolve();
        });

        return this.User.bulkCreate([{aNumber: 5}, {aNumber: 7}, {aNumber: 3}], { fields: ['aNumber'], individualHooks: true }).catch(err => {
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
        const self = this,
          beforeBulk = sinon.spy(),
          afterBulk = sinon.spy();

        this.User.beforeBulkUpdate(beforeBulk);
        this.User.afterBulkUpdate(afterBulk);

        return this.User.bulkCreate([
          {username: 'Cheech', mood: 'sad'},
          {username: 'Chong', mood: 'sad'}
        ]).then(() => {
          return self.User.update({mood: 'happy'}, {where: {mood: 'sad'}}).then(() => {
            expect(beforeBulk).to.have.been.calledOnce;
            expect(afterBulk).to.have.been.calledOnce;
          });
        });
      });
    });

    describe('on error', () => {
      it('should return an error from before', function() {
        const self = this;

        this.User.beforeBulkUpdate(() => {
          throw new Error('Whoops!');
        });

        return this.User.bulkCreate([
          {username: 'Cheech', mood: 'sad'},
          {username: 'Chong', mood: 'sad'}
        ]).then(() => {
          return expect(self.User.update({mood: 'happy'}, {where: {mood: 'sad'}})).to.be.rejected;
        });
      });

      it('should return an error from after', function() {
        const self = this;

        this.User.afterBulkUpdate(() => {
          throw new Error('Whoops!');
        });

        return this.User.bulkCreate([
          {username: 'Cheech', mood: 'sad'},
          {username: 'Chong', mood: 'sad'}
        ]).then(() => {
          return expect(self.User.update({mood: 'happy'}, {where: {mood: 'sad'}})).to.be.rejected;
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
        const self = this,
          beforeBulk = sinon.spy(),
          afterBulk = sinon.spy();

        this.User.beforeBulkUpdate(beforeBulk);

        this.User.afterBulkUpdate(afterBulk);

        this.User.beforeUpdate(user => {
          expect(user.changed()).to.not.be.empty;
          user.beforeHookTest = true;
        });

        this.User.afterUpdate(user => {
          user.username = 'User' + user.id;
        });

        return this.User.bulkCreate([
          {aNumber: 1}, {aNumber: 1}, {aNumber: 1}
        ]).then(() => {
          return self.User.update({aNumber: 10}, {where: {aNumber: 1}, individualHooks: true}).spread((affectedRows, records) => {
            records.forEach(record => {
              expect(record.username).to.equal('User' + record.id);
              expect(record.beforeHookTest).to.be.true;
            });
            expect(beforeBulk).to.have.been.calledOnce;
            expect(afterBulk).to.have.been.calledOnce;
          });
        });
      });

      it('should run the after/before functions for each item created successfully changing some data before updating', function() {
        const self = this;

        this.User.beforeUpdate(user => {
          expect(user.changed()).to.not.be.empty;
          if (user.get('id') === 1) {
            user.set('aNumber', user.get('aNumber') + 3);
          }
        });

        return this.User.bulkCreate([
          {aNumber: 1}, {aNumber: 1}, {aNumber: 1}
        ]).then(() => {
          return self.User.update({aNumber: 10}, {where: {aNumber: 1}, individualHooks: true}).spread((affectedRows, records) => {
            records.forEach(record => {
              expect(record.aNumber).to.equal(10 + (record.id === 1 ? 3 : 0));
            });
          });
        });
      });

      it('should run the after/before functions for each item created with an error', function() {
        const self = this,
          beforeBulk = sinon.spy(),
          afterBulk = sinon.spy();

        this.User.beforeBulkUpdate(beforeBulk);

        this.User.afterBulkUpdate(afterBulk);

        this.User.beforeUpdate(() => {
          throw new Error('You shall not pass!');
        });

        this.User.afterUpdate(user => {
          user.username = 'User' + user.id;
        });

        return this.User.bulkCreate([{aNumber: 1}, {aNumber: 1}, {aNumber: 1}], { fields: ['aNumber'] }).then(() => {
          return self.User.update({aNumber: 10}, {where: {aNumber: 1}, individualHooks: true}).catch(err => {
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

        this.User.beforeBulkDestroy(beforeBulk);
        this.User.afterBulkDestroy(afterBulk);

        return this.User.destroy({where: {username: 'Cheech', mood: 'sad'}}).then(() => {
          expect(beforeBulk).to.have.been.calledOnce;
          expect(afterBulk).to.have.been.calledOnce;
        });
      });
    });

    describe('on error', () => {
      it('should return an error from before', function() {
        this.User.beforeBulkDestroy(() => {
          throw new Error('Whoops!');
        });

        return expect(this.User.destroy({where: {username: 'Cheech', mood: 'sad'}})).to.be.rejected;
      });

      it('should return an error from after', function() {
        this.User.afterBulkDestroy(() => {
          throw new Error('Whoops!');
        });

        return expect(this.User.destroy({where: {username: 'Cheech', mood: 'sad'}})).to.be.rejected;
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
        const self = this;
        let beforeBulk = false,
          afterBulk = false,
          beforeHook = false,
          afterHook = false;

        this.User.beforeBulkDestroy(() => {
          beforeBulk = true;
          return Promise.resolve();
        });

        this.User.afterBulkDestroy(() => {
          afterBulk = true;
          return Promise.resolve();
        });

        this.User.beforeDestroy(() => {
          beforeHook = true;
          return Promise.resolve();
        });

        this.User.afterDestroy(() => {
          afterHook = true;
          return Promise.resolve();
        });

        return this.User.bulkCreate([
          {aNumber: 1}, {aNumber: 1}, {aNumber: 1}
        ]).then(() => {
          return self.User.destroy({where: {aNumber: 1}, individualHooks: true}).then(() => {
            expect(beforeBulk).to.be.true;
            expect(afterBulk).to.be.true;
            expect(beforeHook).to.be.true;
            expect(afterHook).to.be.true;
          });
        });
      });

      it('should run the after/before functions for each item created with an error', function() {
        const self = this;
        let beforeBulk = false,
          afterBulk = false,
          beforeHook = false,
          afterHook = false;

        this.User.beforeBulkDestroy(() => {
          beforeBulk = true;
          return Promise.resolve();
        });

        this.User.afterBulkDestroy(() => {
          afterBulk = true;
          return Promise.resolve();
        });

        this.User.beforeDestroy(() => {
          beforeHook = true;
          return Promise.reject(new Error('You shall not pass!'));
        });

        this.User.afterDestroy(() => {
          afterHook = true;
          return Promise.resolve();
        });

        return this.User.bulkCreate([{aNumber: 1}, {aNumber: 1}, {aNumber: 1}], { fields: ['aNumber'] }).then(() => {
          return self.User.destroy({where: {aNumber: 1}, individualHooks: true}).catch(err => {
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
        {username: 'adam', mood: 'happy'},
        {username: 'joe', mood: 'sad'}
      ]).bind(this).then(function() {
        return this.ParanoidUser.destroy({truncate: true});
      });
    });

    describe('on success', () => {
      it('should run hooks', function() {
        const beforeBulk = sinon.spy(),
          afterBulk = sinon.spy();

        this.ParanoidUser.beforeBulkRestore(beforeBulk);
        this.ParanoidUser.afterBulkRestore(afterBulk);

        return this.ParanoidUser.restore({where: {username: 'adam', mood: 'happy'}}).then(() => {
          expect(beforeBulk).to.have.been.calledOnce;
          expect(afterBulk).to.have.been.calledOnce;
        });
      });
    });

    describe('on error', () => {
      it('should return an error from before', function() {
        this.ParanoidUser.beforeBulkRestore(() => {
          throw new Error('Whoops!');
        });

        return expect(this.ParanoidUser.restore({where: {username: 'adam', mood: 'happy'}})).to.be.rejected;
      });

      it('should return an error from after', function() {
        this.ParanoidUser.afterBulkRestore(() => {
          throw new Error('Whoops!');
        });

        return expect(this.ParanoidUser.restore({where: {username: 'adam', mood: 'happy'}})).to.be.rejected;
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
        const self = this,
          beforeBulk = sinon.spy(),
          afterBulk = sinon.spy(),
          beforeHook = sinon.spy(),
          afterHook = sinon.spy();

        this.ParanoidUser.beforeBulkRestore(beforeBulk);
        this.ParanoidUser.afterBulkRestore(afterBulk);
        this.ParanoidUser.beforeRestore(beforeHook);
        this.ParanoidUser.afterRestore(afterHook);

        return this.ParanoidUser.bulkCreate([
          {aNumber: 1}, {aNumber: 1}, {aNumber: 1}
        ]).then(() => {
          return self.ParanoidUser.destroy({where: {aNumber: 1}});
        }).then(() => {
          return self.ParanoidUser.restore({where: {aNumber: 1}, individualHooks: true});
        }).then(() => {
          expect(beforeBulk).to.have.been.calledOnce;
          expect(afterBulk).to.have.been.calledOnce;
          expect(beforeHook).to.have.been.calledThrice;
          expect(afterHook).to.have.been.calledThrice;
        });
      });

      it('should run the after/before functions for each item restored with an error', function() {
        const self = this,
          beforeBulk = sinon.spy(),
          afterBulk = sinon.spy(),
          beforeHook = sinon.spy(),
          afterHook = sinon.spy();

        this.ParanoidUser.beforeBulkRestore(beforeBulk);
        this.ParanoidUser.afterBulkRestore(afterBulk);
        this.ParanoidUser.beforeRestore(() => {
          beforeHook();
          return Promise.reject(new Error('You shall not pass!'));
        });

        this.ParanoidUser.afterRestore(afterHook);

        return this.ParanoidUser.bulkCreate([{aNumber: 1}, {aNumber: 1}, {aNumber: 1}], { fields: ['aNumber'] }).then(() => {
          return self.ParanoidUser.destroy({where: {aNumber: 1}});
        }).then(() => {
          return self.ParanoidUser.restore({where: {aNumber: 1}, individualHooks: true});
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
