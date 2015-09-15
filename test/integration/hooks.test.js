'use strict';

/* jshint -W030 */
var chai = require('chai')
  , expect = chai.expect
  , Support = require(__dirname + '/support')
  , DataTypes = require(__dirname + '/../../lib/data-types')
  , Sequelize = Support.Sequelize
  , sinon = require('sinon')
  , dialect = Support.getTestDialect();

describe(Support.getTestDialectTeaser('Hooks'), function() {
  beforeEach(function() {
    this.User = this.sequelize.define('User', {
      username: DataTypes.STRING,
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

  describe('#validate', function() {
    describe('#create', function() {
      it('should return the user', function() {
        this.User.beforeValidate(function(user, options) {
          user.mood = 'happy';
        });

        this.User.afterValidate(function(user, options) {
          user.username = 'Toni';
        });

        return this.User.create({mood: 'ecstatic'}).then(function(user) {
          expect(user.mood).to.equal('happy');
          expect(user.username).to.equal('Toni');
        });
      });
    });

    describe('on error', function() {
      it('should emit an error from after hook', function() {
        this.User.afterValidate(function(user, options) {
          user.mood = 'ecstatic';
          throw new Error('Whoops! Changed user.mood!');
        });

        return expect(this.User.create({mood: 'happy'})).to.be.rejectedWith('Whoops! Changed user.mood!');
      });
    });
  });

  describe('#create', function() {
    describe('on success', function() {
      it('should run hooks', function() {
        var beforeHook = sinon.spy()
          , afterHook = sinon.spy();

        this.User.beforeCreate(beforeHook);
        this.User.afterCreate(afterHook);

        return this.User.create({username: 'Toni', mood: 'happy'}).then(function() {
          expect(beforeHook).to.have.been.calledOnce;
          expect(afterHook).to.have.been.calledOnce;
        });
      });
    });

    describe('on error', function() {
      it('should return an error from before', function() {
        var beforeHook = sinon.spy()
          , afterHook = sinon.spy();

        this.User.beforeCreate(function(user, options) {
          beforeHook();
          throw new Error('Whoops!');
        });
        this.User.afterCreate(afterHook);

        return expect(this.User.create({username: 'Toni', mood: 'happy'})).to.be.rejected.then(function(err) {
          expect(beforeHook).to.have.been.calledOnce;
          expect(afterHook).not.to.have.been.called;
        });
      });

      it('should return an error from after', function() {
        var beforeHook = sinon.spy()
          , afterHook = sinon.spy();

        this.User.beforeCreate(beforeHook);
        this.User.afterCreate(function(user, options) {
          afterHook();
          throw new Error('Whoops!');
        });

        return expect(this.User.create({username: 'Toni', mood: 'happy'})).to.be.rejected.then(function(err) {
          expect(beforeHook).to.have.been.calledOnce;
          expect(afterHook).to.have.been.calledOnce;
        });
      });
    });

    it('should not trigger hooks on parent when using N:M association setters', function() {
      var A = this.sequelize.define('A', {
        name: Sequelize.STRING
      });
      var B = this.sequelize.define('B', {
        name: Sequelize.STRING
      });

      var hookCalled = 0;

      A.addHook('afterCreate', function(instance, options, next) {
        hookCalled++;
        next();
      });

      B.belongsToMany(A, {through: 'a_b'});
      A.belongsToMany(B, {through: 'a_b'});

      return this.sequelize.sync({force: true}).bind(this).then(function() {
        return this.sequelize.Promise.all([
          A.create({name: 'a'}),
          B.create({name: 'b'})
        ]).spread(function(a, b) {
          return a.addB(b).then(function() {
            expect(hookCalled).to.equal(1);
          });
        });
      });
    });
  });

  describe('#updateAttributes', function() {
    describe('on success', function() {
      it('should run hooks', function() {
        var beforeHook = sinon.spy()
          , afterHook = sinon.spy();

        this.User.beforeUpdate(beforeHook);
        this.User.afterUpdate(afterHook);

        return this.User.create({username: 'Toni', mood: 'happy'}).then(function(user) {
          return user.updateAttributes({username: 'Chong'}).then(function(user) {
            expect(beforeHook).to.have.been.calledOnce;
            expect(afterHook).to.have.been.calledOnce;
            expect(user.username).to.equal('Chong');
          });
        });
      });
    });

    describe('on error', function() {
      it('should return an error from before', function() {
        var beforeHook = sinon.spy()
          , afterHook = sinon.spy();

        this.User.beforeUpdate(function(user, options) {
          beforeHook();
          throw new Error('Whoops!');
        });
        this.User.afterUpdate(afterHook);

        return this.User.create({username: 'Toni', mood: 'happy'}).then(function(user) {
          return expect(user.updateAttributes({username: 'Chong'})).to.be.rejected.then(function() {
            expect(beforeHook).to.have.been.calledOnce;
            expect(afterHook).not.to.have.been.called;
          });
        });
      });

      it('should return an error from after', function() {
        var beforeHook = sinon.spy()
          , afterHook = sinon.spy();

        this.User.beforeUpdate(beforeHook);
        this.User.afterUpdate(function(user, options) {
          afterHook();
          throw new Error('Whoops!');
        });

        return this.User.create({username: 'Toni', mood: 'happy'}).then(function(user) {
          return expect(user.updateAttributes({username: 'Chong'})).to.be.rejected.then(function() {
            expect(beforeHook).to.have.been.calledOnce;
            expect(afterHook).to.have.been.calledOnce;
          });
        });
      });
    });
  });

  describe('#destroy', function() {
    describe('on success', function() {
      it('should run hooks', function() {
        var beforeHook = sinon.spy()
          , afterHook = sinon.spy();

        this.User.beforeDestroy(beforeHook);
        this.User.afterDestroy(afterHook);

        return this.User.create({username: 'Toni', mood: 'happy'}).then(function(user) {
          return user.destroy().then(function() {
            expect(beforeHook).to.have.been.calledOnce;
            expect(afterHook).to.have.been.calledOnce;
          });
        });
      });
    });

    describe('on error', function() {
      it('should return an error from before', function() {
        var beforeHook = sinon.spy()
          , afterHook = sinon.spy();

        this.User.beforeDestroy(function(user, options) {
          beforeHook();
          throw new Error('Whoops!');
        });
        this.User.afterDestroy(afterHook);

        return this.User.create({username: 'Toni', mood: 'happy'}).then(function(user) {
          return expect(user.destroy()).to.be.rejected.then(function() {
            expect(beforeHook).to.have.been.calledOnce;
            expect(afterHook).not.to.have.been.called;
          });
        });
      });

      it('should return an error from after', function() {
        var beforeHook = sinon.spy()
          , afterHook = sinon.spy();

        this.User.beforeDestroy(beforeHook);
        this.User.afterDestroy(function(user, options) {
          afterHook();
          throw new Error('Whoops!');
        });

        return this.User.create({username: 'Toni', mood: 'happy'}).then(function(user) {
          return expect(user.destroy()).to.be.rejected.then(function() {
            expect(beforeHook).to.have.been.calledOnce;
            expect(afterHook).to.have.been.calledOnce;
          });
        });
      });
    });
  });

  describe('#restore', function() {
    describe('on success', function() {
      it('should run hooks', function() {
        var beforeHook = sinon.spy()
          , afterHook = sinon.spy();

        this.ParanoidUser.beforeRestore(beforeHook);
        this.ParanoidUser.afterRestore(afterHook);

        return this.ParanoidUser.create({username: 'Toni', mood: 'happy'}).then(function(user) {
          return user.destroy().then(function() {
            return user.restore().then(function(user) {
              expect(beforeHook).to.have.been.calledOnce;
              expect(afterHook).to.have.been.calledOnce;
            });
          });
        });
      });
    });

    describe('on error', function() {
      it('should return an error from before', function() {
        var beforeHook = sinon.spy()
          , afterHook = sinon.spy();

        this.ParanoidUser.beforeRestore(function(user, options) {
          beforeHook();
          throw new Error('Whoops!');
        });
        this.ParanoidUser.afterRestore(afterHook);

        return this.ParanoidUser.create({username: 'Toni', mood: 'happy'}).then(function(user) {
          return user.destroy().then(function() {
            return expect(user.restore()).to.be.rejected.then(function() {
              expect(beforeHook).to.have.been.calledOnce;
              expect(afterHook).not.to.have.been.called;
            });
          });
        });
      });

      it('should return an error from after', function() {
        var beforeHook = sinon.spy()
          , afterHook = sinon.spy();

        this.ParanoidUser.beforeRestore(beforeHook);
        this.ParanoidUser.afterRestore(function(user, options) {
          afterHook();
          throw new Error('Whoops!');
        });

        return this.ParanoidUser.create({username: 'Toni', mood: 'happy'}).then(function(user) {
          return user.destroy().then(function() {
            return expect(user.restore()).to.be.rejected.then(function() {
              expect(beforeHook).to.have.been.calledOnce;
              expect(afterHook).to.have.been.calledOnce;
            });
          });
        });
      });
    });
  });

  describe('#bulkCreate', function() {
    describe('on success', function() {
      it('should run hooks', function() {
        var beforeBulk = sinon.spy()
          , afterBulk = sinon.spy();

        this.User.beforeBulkCreate(beforeBulk);

        this.User.afterBulkCreate(afterBulk);

        return this.User.bulkCreate([
          {username: 'Cheech', mood: 'sad'},
          {username: 'Chong', mood: 'sad'}
        ]).then(function() {
          expect(beforeBulk).to.have.been.calledOnce;
          expect(afterBulk).to.have.been.calledOnce;
        });
      });
    });

    describe('on error', function() {
      it('should return an error from before', function() {
        this.User.beforeBulkCreate(function(daos, options) {
          throw new Error('Whoops!');
        });

        return expect(this.User.bulkCreate([
          {username: 'Cheech', mood: 'sad'},
          {username: 'Chong', mood: 'sad'}
        ])).to.be.rejected;
      });

      it('should return an error from after', function() {
        this.User.afterBulkCreate(function(daos, options) {
          throw new Error('Whoops!');
        });

        return expect(this.User.bulkCreate([
          {username: 'Cheech', mood: 'sad'},
          {username: 'Chong', mood: 'sad'}
        ])).to.be.rejected;
      });
    });

    describe('with the {individualHooks: true} option', function() {
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
        var beforeBulkCreate = false
          , afterBulkCreate = false;

        this.User.beforeBulkCreate(function(daos, options, fn) {
          beforeBulkCreate = true;
          fn();
        });

        this.User.afterBulkCreate(function(daos, options, fn) {
          afterBulkCreate = true;
          fn();
        });

        this.User.beforeCreate(function(user, options, fn) {
          user.beforeHookTest = true;
          fn();
        });

        this.User.afterCreate(function(user, options, fn) {
          user.username = 'User' + user.id;
          fn();
        });

        return this.User.bulkCreate([{aNumber: 5}, {aNumber: 7}, {aNumber: 3}], { fields: ['aNumber'], individualHooks: true }).then(function(records) {
          records.forEach(function(record) {
            expect(record.username).to.equal('User' + record.id);
            expect(record.beforeHookTest).to.be.true;
          });
          expect(beforeBulkCreate).to.be.true;
          expect(afterBulkCreate).to.be.true;
        });
      });

      it('should run the afterCreate/beforeCreate functions for each item created with an error', function() {
        var beforeBulkCreate = false
          , afterBulkCreate = false;

        this.User.beforeBulkCreate(function(daos, options, fn) {
          beforeBulkCreate = true;
          fn();
        });

        this.User.afterBulkCreate(function(daos, options, fn) {
          afterBulkCreate = true;
          fn();
        });

        this.User.beforeCreate(function(user, options, fn) {
          fn(new Error('You shall not pass!'));
        });

        this.User.afterCreate(function(user, options, fn) {
          user.username = 'User' + user.id;
          fn();
        });

        return this.User.bulkCreate([{aNumber: 5}, {aNumber: 7}, {aNumber: 3}], { fields: ['aNumber'], individualHooks: true }).catch(function(err) {
          expect(err).to.be.instanceOf(Error);
          expect(beforeBulkCreate).to.be.true;
          expect(afterBulkCreate).to.be.false;
        });
      });
    });
  });

  describe('#bulkUpdate', function() {
    describe('on success', function() {
      it('should run hooks', function() {
        var self = this
          , beforeBulk = sinon.spy()
          , afterBulk = sinon.spy();

        this.User.beforeBulkUpdate(beforeBulk);
        this.User.afterBulkUpdate(afterBulk);

        return this.User.bulkCreate([
          {username: 'Cheech', mood: 'sad'},
          {username: 'Chong', mood: 'sad'}
        ]).then(function() {
          return self.User.update({mood: 'happy'}, {where: {mood: 'sad'}}).then(function() {
            expect(beforeBulk).to.have.been.calledOnce;
            expect(afterBulk).to.have.been.calledOnce;
          });
        });
      });
    });

    describe('on error', function() {
      it('should return an error from before', function() {
        var self = this;

        this.User.beforeBulkUpdate(function(options) {
          throw new Error('Whoops!');
        });

        return this.User.bulkCreate([
          {username: 'Cheech', mood: 'sad'},
          {username: 'Chong', mood: 'sad'}
        ]).then(function() {
          return expect(self.User.update({mood: 'happy'}, {where: {mood: 'sad'}})).to.be.rejected;
        });
      });

      it('should return an error from after', function() {
        var self = this;

        this.User.afterBulkUpdate(function(options) {
          throw new Error('Whoops!');
        });

        return this.User.bulkCreate([
          {username: 'Cheech', mood: 'sad'},
          {username: 'Chong', mood: 'sad'}
        ]).then(function() {
          return expect(self.User.update({mood: 'happy'}, {where: {mood: 'sad'}})).to.be.rejected;
        });
      });
    });

    describe('with the {individualHooks: true} option', function() {
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
        var self = this
          , beforeBulk = sinon.spy()
          , afterBulk = sinon.spy();

        this.User.beforeBulkUpdate(beforeBulk);

        this.User.afterBulkUpdate(afterBulk);

        this.User.beforeUpdate(function(user, options) {
          expect(user.changed()).to.not.be.empty;
          user.beforeHookTest = true;
        });

        this.User.afterUpdate(function(user, options) {
          user.username = 'User' + user.id;
        });

        return this.User.bulkCreate([
          {aNumber: 1}, {aNumber: 1}, {aNumber: 1}
        ]).then(function() {
          return self.User.update({aNumber: 10}, {where: {aNumber: 1}, individualHooks: true}).spread(function(affectedRows, records) {
            records.forEach(function(record) {
              expect(record.username).to.equal('User' + record.id);
              expect(record.beforeHookTest).to.be.true;
            });
            expect(beforeBulk).to.have.been.calledOnce;
            expect(afterBulk).to.have.been.calledOnce;
          });
        });
      });

      it('should run the after/before functions for each item created successfully changing some data before updating', function() {
        var self = this;

        this.User.beforeUpdate(function(user, options) {
          expect(user.changed()).to.not.be.empty;
          if (user.get('id') === 1) {
            user.set('aNumber', user.get('aNumber') + 3);
          }
        });

        return this.User.bulkCreate([
          {aNumber: 1}, {aNumber: 1}, {aNumber: 1}
        ]).then(function() {
          return self.User.update({aNumber: 10}, {where: {aNumber: 1}, individualHooks: true}).spread(function(affectedRows, records) {
            records.forEach(function(record, i) {
              expect(record.aNumber).to.equal(10 + (record.id === 1 ? 3 : 0));
            });
          });
        });
      });

      it('should run the after/before functions for each item created with an error', function() {
        var self = this
          , beforeBulk = sinon.spy()
          , afterBulk = sinon.spy();

        this.User.beforeBulkUpdate(beforeBulk);

        this.User.afterBulkUpdate(afterBulk);

        this.User.beforeUpdate(function(user, options) {
          throw new Error('You shall not pass!');
        });

        this.User.afterUpdate(function(user, options) {
          user.username = 'User' + user.id;
        });

        return this.User.bulkCreate([{aNumber: 1}, {aNumber: 1}, {aNumber: 1}], { fields: ['aNumber'] }).then(function() {
          return self.User.update({aNumber: 10}, {where: {aNumber: 1}, individualHooks: true}).catch(function(err) {
            expect(err).to.be.instanceOf(Error);
            expect(err.message).to.be.equal('You shall not pass!');
            expect(beforeBulk).to.have.been.calledOnce;
            expect(afterBulk).not.to.have.been.called;
          });
        });
      });
    });
  });

  describe('#bulkDestroy', function() {
    describe('on success', function() {
      it('should run hooks', function() {
        var beforeBulk = sinon.spy()
          , afterBulk = sinon.spy();

        this.User.beforeBulkDestroy(beforeBulk);
        this.User.afterBulkDestroy(afterBulk);

        return this.User.destroy({where: {username: 'Cheech', mood: 'sad'}}).then(function() {
          expect(beforeBulk).to.have.been.calledOnce;
          expect(afterBulk).to.have.been.calledOnce;
        });
      });
    });

    describe('on error', function() {
      it('should return an error from before', function() {
        this.User.beforeBulkDestroy(function(options) {
          throw new Error('Whoops!');
        });

        return expect(this.User.destroy({where: {username: 'Cheech', mood: 'sad'}})).to.be.rejected;
      });

      it('should return an error from after', function() {
        this.User.afterBulkDestroy(function(options) {
          throw new Error('Whoops!');
        });

        return expect(this.User.destroy({where: {username: 'Cheech', mood: 'sad'}})).to.be.rejected;
      });
    });

    describe('with the {individualHooks: true} option', function() {
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
        var self = this
          , beforeBulk = false
          , afterBulk = false
          , beforeHook = false
          , afterHook = false;

        this.User.beforeBulkDestroy(function(options, fn) {
          beforeBulk = true;
          fn();
        });

        this.User.afterBulkDestroy(function(options, fn) {
          afterBulk = true;
          fn();
        });

        this.User.beforeDestroy(function(user, options, fn) {
          beforeHook = true;
          fn();
        });

        this.User.afterDestroy(function(user, options, fn) {
          afterHook = true;
          fn();
        });

        return this.User.bulkCreate([
          {aNumber: 1}, {aNumber: 1}, {aNumber: 1}
        ]).then(function() {
          return self.User.destroy({where: {aNumber: 1}, individualHooks: true}).then(function() {
            expect(beforeBulk).to.be.true;
            expect(afterBulk).to.be.true;
            expect(beforeHook).to.be.true;
            expect(afterHook).to.be.true;
          });
        });
      });

      it('should run the after/before functions for each item created with an error', function() {
        var self = this
          , beforeBulk = false
          , afterBulk = false
          , beforeHook = false
          , afterHook = false;

        this.User.beforeBulkDestroy(function(options, fn) {
          beforeBulk = true;
          fn();
        });

        this.User.afterBulkDestroy(function(options, fn) {
          afterBulk = true;
          fn();
        });

        this.User.beforeDestroy(function(user, options, fn) {
          beforeHook = true;
          fn(new Error('You shall not pass!'));
        });

        this.User.afterDestroy(function(user, options, fn) {
          afterHook = true;
          fn();
        });

        return this.User.bulkCreate([{aNumber: 1}, {aNumber: 1}, {aNumber: 1}], { fields: ['aNumber'] }).then(function() {
          return self.User.destroy({where: {aNumber: 1}, individualHooks: true}).catch(function(err) {
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

  describe('#bulkRestore', function() {
    beforeEach(function() {
      return this.ParanoidUser.bulkCreate([
        {username: 'adam', mood: 'happy'},
        {username: 'joe', mood: 'sad'}
      ]).bind(this).then(function() {
        return this.ParanoidUser.destroy({truncate: true});
      });
    });

    describe('on success', function() {
      it('should run hooks', function() {
        var beforeBulk = sinon.spy()
          , afterBulk = sinon.spy();

        this.ParanoidUser.beforeBulkRestore(beforeBulk);
        this.ParanoidUser.afterBulkRestore(afterBulk);

        return this.ParanoidUser.restore({where: {username: 'adam', mood: 'happy'}}).then(function() {
          expect(beforeBulk).to.have.been.calledOnce;
          expect(afterBulk).to.have.been.calledOnce;
        });
      });
    });

    describe('on error', function() {
      it('should return an error from before', function() {
        this.ParanoidUser.beforeBulkRestore(function(options) {
          throw new Error('Whoops!');
        });

        return expect(this.ParanoidUser.restore({where: {username: 'adam', mood: 'happy'}})).to.be.rejected;
      });

      it('should return an error from after', function() {
        this.ParanoidUser.afterBulkRestore(function(options) {
          throw new Error('Whoops!');
        });

        return expect(this.ParanoidUser.restore({where: {username: 'adam', mood: 'happy'}})).to.be.rejected;
      });
    });

    describe('with the {individualHooks: true} option', function() {
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
        var self = this
          , beforeBulk = sinon.spy()
          , afterBulk = sinon.spy()
          , beforeHook = sinon.spy()
          , afterHook = sinon.spy();

        this.ParanoidUser.beforeBulkRestore(beforeBulk);
        this.ParanoidUser.afterBulkRestore(afterBulk);
        this.ParanoidUser.beforeRestore(beforeHook);
        this.ParanoidUser.afterRestore(afterHook);

        return this.ParanoidUser.bulkCreate([
          {aNumber: 1}, {aNumber: 1}, {aNumber: 1}
        ]).then(function() {
          return self.ParanoidUser.destroy({where: {aNumber: 1}});
        }).then(function() {
          return self.ParanoidUser.restore({where: {aNumber: 1}, individualHooks: true});
        }).then(function() {
          expect(beforeBulk).to.have.been.calledOnce;
          expect(afterBulk).to.have.been.calledOnce;
          expect(beforeHook).to.have.been.calledThrice;
          expect(afterHook).to.have.been.calledThrice;
        });
      });

      it('should run the after/before functions for each item restored with an error', function() {
        var self = this
          , beforeBulk = sinon.spy()
          , afterBulk = sinon.spy()
          , beforeHook = sinon.spy()
          , afterHook = sinon.spy();

        this.ParanoidUser.beforeBulkRestore(beforeBulk);
        this.ParanoidUser.afterBulkRestore(afterBulk);
        this.ParanoidUser.beforeRestore(function(user, options, fn) {
          beforeHook();
          fn(new Error('You shall not pass!'));
        });

        this.ParanoidUser.afterRestore(afterHook);

        return this.ParanoidUser.bulkCreate([{aNumber: 1}, {aNumber: 1}, {aNumber: 1}], { fields: ['aNumber'] }).then(function() {
          return self.ParanoidUser.destroy({where: {aNumber: 1}});
        }).then(function() {
          return self.ParanoidUser.restore({where: {aNumber: 1}, individualHooks: true});
        }).catch(function(err) {
          expect(err).to.be.instanceOf(Error);
          expect(beforeBulk).to.have.been.calledOnce;
          expect(beforeHook).to.have.been.calledThrice;
          expect(afterBulk).not.to.have.been.called;
          expect(afterHook).not.to.have.been.called;
        });
      });
    });
  });

  describe('#find', function() {
    beforeEach(function() {
      return this.User.bulkCreate([
        {username: 'adam', mood: 'happy'},
        {username: 'joe', mood: 'sad'}
      ]);
    });

    describe('on success', function() {
      it('all hooks run', function() {
        var beforeHook = false
          , beforeHook2 = false
          , beforeHook3 = false
          , afterHook = false;

        this.User.beforeFind(function() {
          beforeHook = true;
        });

        this.User.beforeFindAfterExpandIncludeAll(function() {
          beforeHook2 = true;
        });

        this.User.beforeFindAfterOptions(function() {
          beforeHook3 = true;
        });

        this.User.afterFind(function() {
          afterHook = true;
        });

        return this.User.find({where: {username: 'adam'}}).then(function(user) {
          expect(user.mood).to.equal('happy');
          expect(beforeHook).to.be.true;
          expect(beforeHook2).to.be.true;
          expect(beforeHook3).to.be.true;
          expect(afterHook).to.be.true;
        });
      });

      it('beforeFind hook can change options', function() {
        this.User.beforeFind(function(options) {
          options.where.username = 'joe';
        });

        return this.User.find({where: {username: 'adam'}}).then(function(user) {
          expect(user.mood).to.equal('sad');
        });
      });

      it('beforeFindAfterExpandIncludeAll hook can change options', function() {
        this.User.beforeFindAfterExpandIncludeAll(function(options) {
          options.where.username = 'joe';
        });

        return this.User.find({where: {username: 'adam'}}).then(function(user) {
          expect(user.mood).to.equal('sad');
        });
      });

      it('beforeFindAfterOptions hook can change options', function() {
        this.User.beforeFindAfterOptions(function(options) {
          options.where.username = 'joe';
        });

        return this.User.find({where: {username: 'adam'}}).then(function(user) {
          expect(user.mood).to.equal('sad');
        });
      });

      it('afterFind hook can change results', function() {
        this.User.afterFind(function(user) {
          user.mood = 'sad';
        });

        return this.User.find({where: {username: 'adam'}}).then(function(user) {
          expect(user.mood).to.equal('sad');
        });
      });
    });

    describe('on error', function() {
      it('in beforeFind hook returns error', function() {
        this.User.beforeFind(function() {
          throw new Error('Oops!');
        });

        return this.User.find({where: {username: 'adam'}}).catch (function(err) {
          expect(err.message).to.equal('Oops!');
        });
      });

      it('in beforeFindAfterExpandIncludeAll hook returns error', function() {
        this.User.beforeFindAfterExpandIncludeAll(function() {
          throw new Error('Oops!');
        });

        return this.User.find({where: {username: 'adam'}}).catch (function(err) {
          expect(err.message).to.equal('Oops!');
        });
      });

      it('in beforeFindAfterOptions hook returns error', function() {
        this.User.beforeFindAfterOptions(function() {
          throw new Error('Oops!');
        });

        return this.User.find({where: {username: 'adam'}}).catch (function(err) {
          expect(err.message).to.equal('Oops!');
        });
      });

      it('in afterFind hook returns error', function() {
        this.User.afterFind(function() {
          throw new Error('Oops!');
        });

        return this.User.find({where: {username: 'adam'}}).catch (function(err) {
          expect(err.message).to.equal('Oops!');
        });
      });
    });
  });

  describe('#define', function() {
    before(function() {
      this.sequelize.addHook('beforeDefine', function(attributes, options) {
        options.modelName = 'bar';
        options.name.plural = 'barrs';
        attributes.type = DataTypes.STRING;
      });

      this.sequelize.addHook('afterDefine', function(factory) {
        factory.options.name.singular = 'barr';
      });

      this.model = this.sequelize.define('foo', {name: DataTypes.STRING});
    });

    it('beforeDefine hook can change model name', function() {
      expect(this.model.name).to.equal('bar');
    });

    it('beforeDefine hook can alter options', function() {
      expect(this.model.options.name.plural).to.equal('barrs');
    });

    it('beforeDefine hook can alter attributes', function() {
      expect(this.model.rawAttributes.type).to.be.ok;
    });

    it('afterDefine hook can alter options', function() {
      expect(this.model.options.name.singular).to.equal('barr');
    });

    after(function() {
      this.sequelize.options.hooks = {};
      this.sequelize.modelManager.removeModel(this.model);
    });
  });

  describe('#init', function() {
    before(function() {
      Sequelize.addHook('beforeInit', function(config, options) {
        config.database = 'db2';
        options.host = 'server9';
      });

      Sequelize.addHook('afterInit', function(sequelize) {
        sequelize.options.protocol = 'udp';
      });

      this.seq = new Sequelize('db', 'user', 'pass', {});
    });

    it('beforeInit hook can alter config', function() {
      expect(this.seq.config.database).to.equal('db2');
    });

    it('beforeInit hook can alter options', function() {
      expect(this.seq.options.host).to.equal('server9');
    });

    it('afterInit hook can alter options', function() {
      expect(this.seq.options.protocol).to.equal('udp');
    });

    after(function() {
      Sequelize.options.hooks = {};
    });
  });

  describe('associations', function() {
    describe('1:1', function() {
      describe('cascade onUpdate', function() {
        beforeEach(function() {
          var self = this;

          this.Projects = this.sequelize.define('Project', {
            title: DataTypes.STRING
          });

          this.Tasks = this.sequelize.define('Task', {
            title: DataTypes.STRING
          });

          this.Projects.hasOne(this.Tasks, {onUpdate: 'cascade', hooks: true});
          this.Tasks.belongsTo(this.Projects);

          return this.Projects.sync({ force: true }).then(function() {
            return self.Tasks.sync({ force: true });
          });
        });

        it('on success', function() {
          var self = this
            , beforeHook = false
            , afterHook = false;

          this.Tasks.beforeUpdate(function(task, options, fn) {
            beforeHook = true;
            fn();
          });

          this.Tasks.afterUpdate(function(task, options, fn) {
            afterHook = true;
            fn();
          });

          return this.Projects.create({title: 'New Project'}).then(function(project) {
            return self.Tasks.create({title: 'New Task'}).then(function(task) {
              return project.setTask(task).then(function() {
                return project.updateAttributes({id: 2}).then(function() {
                  expect(beforeHook).to.be.true;
                  expect(afterHook).to.be.true;
                });
              });
            });
          });
        });

        it('on error', function() {
          var self = this;

          this.Tasks.afterUpdate(function(task, options, fn) {
            fn(new Error('Whoops!'));
          });

          return this.Projects.create({title: 'New Project'}).then(function(project) {
            return self.Tasks.create({title: 'New Task'}).then(function(task) {
              return project.setTask(task).catch(function(err) {
                expect(err).to.be.instanceOf(Error);
              });
            });
          });
        });
      });

      describe('cascade onDelete', function() {
        beforeEach(function() {
          this.Projects = this.sequelize.define('Project', {
            title: DataTypes.STRING
          });

          this.Tasks = this.sequelize.define('Task', {
            title: DataTypes.STRING
          });

          this.Projects.hasOne(this.Tasks, {onDelete: 'cascade', hooks: true});
          this.Tasks.belongsTo(this.Projects);

          return this.sequelize.sync({ force: true });
        });

        describe('#remove', function() {
          it('with no errors', function() {
            var self = this
              , beforeProject = sinon.spy()
              , afterProject = sinon.spy()
              , beforeTask = sinon.spy()
              , afterTask = sinon.spy();

            this.Projects.beforeCreate(beforeProject);
            this.Projects.afterCreate(afterProject);
            this.Tasks.beforeDestroy(beforeTask);
            this.Tasks.afterDestroy(afterTask);

            return this.Projects.create({title: 'New Project'}).then(function(project) {
              return self.Tasks.create({title: 'New Task'}).then(function(task) {
                return project.setTask(task).then(function() {
                  return project.destroy().then(function() {
                    expect(beforeProject).to.have.been.calledOnce;
                    expect(afterProject).to.have.been.calledOnce;
                    expect(beforeTask).to.have.been.calledOnce;
                    expect(afterTask).to.have.been.calledOnce;
                  });
                });
              });
            });
          });

          it('with errors', function() {
            var self = this
              , beforeProject = false
              , afterProject = false
              , beforeTask = false
              , afterTask = false
              , VeryCustomError = function() {};

            this.Projects.beforeCreate(function(project, options, fn) {
              beforeProject = true;
              fn();
            });

            this.Projects.afterCreate(function(project, options, fn) {
              afterProject = true;
              fn();
            });

            this.Tasks.beforeDestroy(function(task, options, fn) {
              beforeTask = true;
              fn(new VeryCustomError('Whoops!'));
            });

            this.Tasks.afterDestroy(function(task, options, fn) {
              afterTask = true;
              fn();
            });

            return this.Projects.create({title: 'New Project'}).then(function(project) {
              return self.Tasks.create({title: 'New Task'}).then(function(task) {
                return project.setTask(task).then(function() {
                  return expect(project.destroy()).to.eventually.be.rejectedWith(VeryCustomError).then(function () {
                    expect(beforeProject).to.be.true;
                    expect(afterProject).to.be.true;
                    expect(beforeTask).to.be.true;
                    expect(afterTask).to.be.false;
                  });
                });
              });
            });
          });
        });
      });

      describe('no cascade update', function() {
        beforeEach(function() {
          var self = this;

          this.Projects = this.sequelize.define('Project', {
            title: DataTypes.STRING
          });

          this.Tasks = this.sequelize.define('Task', {
            title: DataTypes.STRING
          });

          this.Projects.hasOne(this.Tasks);
          this.Tasks.belongsTo(this.Projects);

          return this.Projects.sync({ force: true }).then(function() {
            return self.Tasks.sync({ force: true });
          });
        });

        it('on success', function() {
          var self = this
            , beforeHook = sinon.spy()
            , afterHook = sinon.spy();

          this.Tasks.beforeUpdate(beforeHook);
          this.Tasks.afterUpdate(afterHook);

          return this.Projects.create({title: 'New Project'}).then(function(project) {
            return self.Tasks.create({title: 'New Task'}).then(function(task) {
              return project.setTask(task).then(function() {
                return project.updateAttributes({id: 2}).then(function() {
                  expect(beforeHook).to.have.been.calledOnce;
                  expect(afterHook).to.have.been.calledOnce;
                });
              });
            });
          });
        });

        it('on error', function() {
          var self = this;

          this.Tasks.afterUpdate(function(task, options) {
            throw new Error('Whoops!');
          });

          return this.Projects.create({title: 'New Project'}).then(function(project) {
            return self.Tasks.create({title: 'New Task'}).then(function(task) {
              return expect(project.setTask(task)).to.be.rejected;
            });
          });
        });
      });

      describe('no cascade delete', function() {
        beforeEach(function() {
          var self = this;

          this.Projects = this.sequelize.define('Project', {
            title: DataTypes.STRING
          });

          this.Tasks = this.sequelize.define('Task', {
            title: DataTypes.STRING
          });

          this.Projects.hasMany(this.Tasks);
          this.Tasks.belongsTo(this.Projects);

          return this.Projects.sync({ force: true }).then(function() {
            return self.Tasks.sync({ force: true });
          });
        });

        describe('#remove', function() {
          it('with no errors', function() {
            var self = this
              , beforeProject = sinon.spy()
              , afterProject = sinon.spy()
              , beforeTask = sinon.spy()
              , afterTask = sinon.spy();

            this.Projects.beforeCreate(beforeProject);
            this.Projects.afterCreate(afterProject);
            this.Tasks.beforeUpdate(beforeTask);
            this.Tasks.afterUpdate(afterTask);

            return this.Projects.create({title: 'New Project'}).then(function(project) {
              return self.Tasks.create({title: 'New Task'}).then(function(task) {
                return project.addTask(task).then(function() {
                  return project.removeTask(task).then(function() {
                    expect(beforeProject).to.have.been.called;
                    expect(afterProject).to.have.been.called;
                    expect(beforeTask).not.to.have.been.called;
                    expect(afterTask).not.to.have.been.called;
                  });
                });
              });
            });
          });

          it('with errors', function() {
            var self = this
              , beforeProject = sinon.spy()
              , afterProject = sinon.spy()
              , beforeTask = sinon.spy()
              , afterTask = sinon.spy();

            this.Projects.beforeCreate(beforeProject);
            this.Projects.afterCreate(afterProject);
            this.Tasks.beforeUpdate(function(task, options) {
              beforeTask();
              throw new Error('Whoops!');
            });
            this.Tasks.afterUpdate(afterTask);

            return this.Projects.create({title: 'New Project'}).then(function(project) {
              return self.Tasks.create({title: 'New Task'}).then(function(task) {
                return project.addTask(task).catch(function(err) {
                  expect(err).to.be.instanceOf(Error);
                  expect(beforeProject).to.have.been.calledOnce;
                  expect(afterProject).to.have.been.calledOnce;
                  expect(beforeTask).to.have.been.calledOnce;
                  expect(afterTask).not.to.have.been.called;
                });
              });
            });
          });
        });
      });
    });

    describe('1:M', function() {
      describe('cascade', function() {
        beforeEach(function() {
          var self = this;
          this.Projects = this.sequelize.define('Project', {
            title: DataTypes.STRING
          });

          this.Tasks = this.sequelize.define('Task', {
            title: DataTypes.STRING
          });

          this.Projects.hasMany(this.Tasks, {onDelete: 'cascade', hooks: true});
          this.Tasks.belongsTo(this.Projects, {hooks: true});

          return this.Projects.sync({ force: true }).then(function() {
            return self.Tasks.sync({ force: true });
          });
        });

        describe('#remove', function() {
          it('with no errors', function() {
            var self = this
              , beforeProject = sinon.spy()
              , afterProject = sinon.spy()
              , beforeTask = sinon.spy()
              , afterTask = sinon.spy();

            this.Projects.beforeCreate(beforeProject);
            this.Projects.afterCreate(afterProject);
            this.Tasks.beforeDestroy(beforeTask);
            this.Tasks.afterDestroy(afterTask);

            return this.Projects.create({title: 'New Project'}).then(function(project) {
              return self.Tasks.create({title: 'New Task'}).then(function(task) {
                return project.addTask(task).then(function() {
                  return project.destroy().then(function() {
                    expect(beforeProject).to.have.been.calledOnce;
                    expect(afterProject).to.have.been.calledOnce;
                    expect(beforeTask).to.have.been.calledOnce;
                    expect(afterTask).to.have.been.calledOnce;
                  });
                });
              });
            });
          });

          it('with errors', function() {
            var self = this
              , beforeProject = false
              , afterProject = false
              , beforeTask = false
              , afterTask = false;

            this.Projects.beforeCreate(function(project, options, fn) {
              beforeProject = true;
              fn();
            });

            this.Projects.afterCreate(function(project, options, fn) {
              afterProject = true;
              fn();
            });

            this.Tasks.beforeDestroy(function(task, options, fn) {
              beforeTask = true;
              fn(new Error('Whoops!'));
            });

            this.Tasks.afterDestroy(function(task, options, fn) {
              afterTask = true;
              fn();
            });

            return this.Projects.create({title: 'New Project'}).then(function(project) {
              return self.Tasks.create({title: 'New Task'}).then(function(task) {
                return project.addTask(task).then(function() {
                  return project.destroy().catch(function(err) {
                    expect(err).to.be.instanceOf(Error);
                    expect(beforeProject).to.be.true;
                    expect(afterProject).to.be.true;
                    expect(beforeTask).to.be.true;
                    expect(afterTask).to.be.false;
                  });
                });
              });
            });
          });
        });
      });

      describe('no cascade', function() {
        beforeEach(function() {
          this.Projects = this.sequelize.define('Project', {
            title: DataTypes.STRING
          });

          this.Tasks = this.sequelize.define('Task', {
            title: DataTypes.STRING
          });

          this.Projects.hasMany(this.Tasks);
          this.Tasks.belongsTo(this.Projects);

          return this.sequelize.sync({ force: true });
        });

        describe('#remove', function() {
          it('with no errors', function() {
            var self = this
              , beforeProject = sinon.spy()
              , afterProject = sinon.spy()
              , beforeTask = sinon.spy()
              , afterTask = sinon.spy();

            this.Projects.beforeCreate(beforeProject);
            this.Projects.afterCreate(afterProject);
            this.Tasks.beforeUpdate(beforeTask);
            this.Tasks.afterUpdate(afterTask);

            return this.Projects.create({title: 'New Project'}).then(function(project) {
              return self.Tasks.create({title: 'New Task'}).then(function(task) {
                return project.addTask(task).then(function() {
                  return project.removeTask(task).then(function() {
                    expect(beforeProject).to.have.been.called;
                    expect(afterProject).to.have.been.called;
                    expect(beforeTask).not.to.have.been.called;
                    expect(afterTask).not.to.have.been.called;
                  });
                });
              });
            });
          });

          it('with errors', function() {
            var self = this
              , beforeProject = false
              , afterProject = false
              , beforeTask = false
              , afterTask = false;

            this.Projects.beforeCreate(function(project, options, fn) {
              beforeProject = true;
              fn();
            });

            this.Projects.afterCreate(function(project, options, fn) {
              afterProject = true;
              fn();
            });

            this.Tasks.beforeUpdate(function(task, options, fn) {
              beforeTask = true;
              fn(new Error('Whoops!'));
            });

            this.Tasks.afterUpdate(function(task, options, fn) {
              afterTask = true;
              fn();
            });

            return this.Projects.create({title: 'New Project'}).then(function(project) {
              return self.Tasks.create({title: 'New Task'}).then(function(task) {
                return project.addTask(task).catch(function(err) {
                  expect(err).to.be.instanceOf(Error);
                  expect(beforeProject).to.be.true;
                  expect(afterProject).to.be.true;
                  expect(beforeTask).to.be.true;
                  expect(afterTask).to.be.false;
                });
              });
            });
          });
        });
      });
    });

    describe('M:M', function() {
      describe('cascade', function() {
        beforeEach(function() {
          this.Projects = this.sequelize.define('Project', {
            title: DataTypes.STRING
          });

          this.Tasks = this.sequelize.define('Task', {
            title: DataTypes.STRING
          });

          this.Projects.belongsToMany(this.Tasks, {cascade: 'onDelete', through: 'projects_and_tasks', hooks: true});
          this.Tasks.belongsToMany(this.Projects, {cascade: 'onDelete', through: 'projects_and_tasks', hooks: true});

          return this.sequelize.sync({ force: true });
        });

        describe('#remove', function() {
          it('with no errors', function() {
            var self = this
              , beforeProject = sinon.spy()
              , afterProject = sinon.spy()
              , beforeTask = sinon.spy()
              , afterTask = sinon.spy();

            this.Projects.beforeCreate(beforeProject);
            this.Projects.afterCreate(afterProject);
            this.Tasks.beforeDestroy(beforeTask);
            this.Tasks.afterDestroy(afterTask);

            return this.Projects.create({title: 'New Project'}).then(function(project) {
              return self.Tasks.create({title: 'New Task'}).then(function(task) {
                return project.addTask(task).then(function() {
                  return project.destroy().then(function() {
                    expect(beforeProject).to.have.been.calledOnce;
                    expect(afterProject).to.have.been.calledOnce;
                    // Since Sequelize does not cascade M:M, these should be false
                    expect(beforeTask).not.to.have.been.called;
                    expect(afterTask).not.to.have.been.called;
                  });
                });
              });
            });
          });

          it('with errors', function() {
            var self = this
              , beforeProject = false
              , afterProject = false
              , beforeTask = false
              , afterTask = false;

            this.Projects.beforeCreate(function(project, options, fn) {
              beforeProject = true;
              fn();
            });

            this.Projects.afterCreate(function(project, options, fn) {
              afterProject = true;
              fn();
            });

            this.Tasks.beforeDestroy(function(task, options, fn) {
              beforeTask = true;
              fn(new Error('Whoops!'));
            });

            this.Tasks.afterDestroy(function(task, options, fn) {
              afterTask = true;
              fn();
            });

            return this.Projects.create({title: 'New Project'}).then(function(project) {
              return self.Tasks.create({title: 'New Task'}).then(function(task) {
                return project.addTask(task).then(function() {
                  return project.destroy().then(function() {
                    expect(beforeProject).to.be.true;
                    expect(afterProject).to.be.true;
                    expect(beforeTask).to.be.false;
                    expect(afterTask).to.be.false;
                  });
                });
              });
            });
          });
        });
      });

      describe('no cascade', function() {
        beforeEach(function() {
          this.Projects = this.sequelize.define('Project', {
            title: DataTypes.STRING
          });

          this.Tasks = this.sequelize.define('Task', {
            title: DataTypes.STRING
          });

          this.Projects.belongsToMany(this.Tasks, {hooks: true, through: 'project_tasks'});
          this.Tasks.belongsToMany(this.Projects, {hooks: true, through: 'project_tasks'});

          return this.sequelize.sync({ force: true });
        });

        describe('#remove', function() {
          it('with no errors', function() {
            var self = this
              , beforeProject = sinon.spy()
              , afterProject = sinon.spy()
              , beforeTask = sinon.spy()
              , afterTask = sinon.spy();

            this.Projects.beforeCreate(beforeProject);
            this.Projects.afterCreate(afterProject);
            this.Tasks.beforeUpdate(beforeTask);
            this.Tasks.afterUpdate(afterTask);

            return this.Projects.create({title: 'New Project'}).then(function(project) {
              return self.Tasks.create({title: 'New Task'}).then(function(task) {
                return project.addTask(task).then(function() {
                  return project.removeTask(task).then(function() {
                    expect(beforeProject).to.have.been.calledOnce;
                    expect(afterProject).to.have.been.calledOnce;
                    expect(beforeTask).not.to.have.been.called;
                    expect(afterTask).not.to.have.been.called;
                  });
                });
              });
            });
          });

          it('with errors', function() {
            var self = this
              , beforeProject = false
              , afterProject = false
              , beforeTask = false
              , afterTask = false;

            this.Projects.beforeCreate(function(project, options, fn) {
              beforeProject = true;
              fn();
            });

            this.Projects.afterCreate(function(project, options, fn) {
              afterProject = true;
              fn();
            });

            this.Tasks.beforeUpdate(function(task, options, fn) {
              beforeTask = true;
              fn(new Error('Whoops!'));
            });

            this.Tasks.afterUpdate(function(task, options, fn) {
              afterTask = true;
              fn();
            });

            return this.Projects.create({title: 'New Project'}).then(function(project) {
              return self.Tasks.create({title: 'New Task'}).then(function(task) {
                return project.addTask(task).then(function() {
                  expect(beforeProject).to.be.true;
                  expect(afterProject).to.be.true;
                  expect(beforeTask).to.be.false;
                  expect(afterTask).to.be.false;
                });
              });
            });
          });
        });
      });
    });

    // NOTE: Reenable when FK constraints create table query is fixed when using hooks
    if (dialect !== 'mssql') {
      describe('multiple 1:M', function () {

        describe('cascade', function() {
          beforeEach(function() {
            this.Projects = this.sequelize.define('Project', {
              title: DataTypes.STRING
            });

            this.Tasks = this.sequelize.define('Task', {
              title: DataTypes.STRING
            });

            this.MiniTasks = this.sequelize.define('MiniTask', {
              mini_title: DataTypes.STRING
            });

            this.Projects.hasMany(this.Tasks, {onDelete: 'cascade', hooks: true});
            this.Projects.hasMany(this.MiniTasks, {onDelete: 'cascade', hooks: true});

            this.Tasks.belongsTo(this.Projects, {hooks: true});
            this.Tasks.hasMany(this.MiniTasks, {onDelete: 'cascade', hooks: true});

            this.MiniTasks.belongsTo(this.Projects, {hooks: true});
            this.MiniTasks.belongsTo(this.Tasks, {hooks: true});

            return this.sequelize.sync({force: true});
          });

          describe('#remove', function() {
            it('with no errors', function() {
              var beforeProject = false
                , afterProject = false
                , beforeTask = false
                , afterTask = false
                , beforeMiniTask = false
                , afterMiniTask = false;

              this.Projects.beforeCreate(function(project, options, fn) {
                beforeProject = true;
                fn();
              });

              this.Projects.afterCreate(function(project, options, fn) {
                afterProject = true;
                fn();
              });

              this.Tasks.beforeDestroy(function(task, options, fn) {
                beforeTask = true;
                fn();
              });

              this.Tasks.afterDestroy(function(task, options, fn) {
                afterTask = true;
                fn();
              });

              this.MiniTasks.beforeDestroy(function(minitask, options, fn) {
                beforeMiniTask = true;
                fn();
              });

              this.MiniTasks.afterDestroy(function(minitask, options, fn) {
                afterMiniTask = true;
                fn();
              });

              return this.sequelize.Promise.all([
                this.Projects.create({title: 'New Project'}),
                this.MiniTasks.create({mini_title: 'New MiniTask'})
              ]).bind(this).spread(function(project, minitask) {
                return project.addMiniTask(minitask);
              }).then(function(project) {
                return project.destroy();
              }).then(function() {
                expect(beforeProject).to.be.true;
                expect(afterProject).to.be.true;
                expect(beforeTask).to.be.false;
                expect(afterTask).to.be.false;
                expect(beforeMiniTask).to.be.true;
                expect(afterMiniTask).to.be.true;
              });

            });

            it('with errors', function() {
              var beforeProject = false
                , afterProject = false
                , beforeTask = false
                , afterTask = false
                , beforeMiniTask = false
                , afterMiniTask = false;

              this.Projects.beforeCreate(function(project, options, fn) {
                beforeProject = true;
                fn();
              });

              this.Projects.afterCreate(function(project, options, fn) {
                afterProject = true;
                fn();
              });

              this.Tasks.beforeDestroy(function(task, options, fn) {
                beforeTask = true;
                fn();
              });

              this.Tasks.afterDestroy(function(task, options, fn) {
                afterTask = true;
                fn();
              });

              this.MiniTasks.beforeDestroy(function(minitask, options, fn) {
                beforeMiniTask = true;
                fn(new Error('Whoops!'));
              });

              this.MiniTasks.afterDestroy(function(minitask, options, fn) {
                afterMiniTask = true;
                fn();
              });

              return this.sequelize.Promise.all([
                this.Projects.create({title: 'New Project'}),
                this.MiniTasks.create({mini_title: 'New MiniTask'})
              ]).bind(this).spread(function(project, minitask) {
                return project.addMiniTask(minitask);
              }).then(function(project) {
                return project.destroy();
              }).catch(function() {
                expect(beforeProject).to.be.true;
                expect(afterProject).to.be.true;
                expect(beforeTask).to.be.false;
                expect(afterTask).to.be.false;
                expect(beforeMiniTask).to.be.true;
                expect(afterMiniTask).to.be.false;
              });
            });
          });
        });
      });

      describe('multiple 1:M sequential hooks', function () {
        describe('cascade', function() {
          beforeEach(function() {
            this.Projects = this.sequelize.define('Project', {
              title: DataTypes.STRING
            });

            this.Tasks = this.sequelize.define('Task', {
              title: DataTypes.STRING
            });

            this.MiniTasks = this.sequelize.define('MiniTask', {
              mini_title: DataTypes.STRING
            });

            this.Projects.hasMany(this.Tasks, {onDelete: 'cascade', hooks: true});
            this.Projects.hasMany(this.MiniTasks, {onDelete: 'cascade', hooks: true});

            this.Tasks.belongsTo(this.Projects, {hooks: true});
            this.Tasks.hasMany(this.MiniTasks, {onDelete: 'cascade', hooks: true});

            this.MiniTasks.belongsTo(this.Projects, {hooks: true});
            this.MiniTasks.belongsTo(this.Tasks, {hooks: true});

            return this.sequelize.sync({force: true});
          });

          describe('#remove', function() {
            it('with no errors', function() {
              var beforeProject = false
                , afterProject = false
                , beforeTask = false
                , afterTask = false
                , beforeMiniTask = false
                , afterMiniTask = false;

              this.Projects.beforeCreate(function(project, options, fn) {
                beforeProject = true;
                fn();
              });

              this.Projects.afterCreate(function(project, options, fn) {
                afterProject = true;
                fn();
              });

              this.Tasks.beforeDestroy(function(task, options, fn) {
                beforeTask = true;
                fn();
              });

              this.Tasks.afterDestroy(function(task, options, fn) {
                afterTask = true;
                fn();
              });

              this.MiniTasks.beforeDestroy(function(minitask, options, fn) {
                beforeMiniTask = true;
                fn();
              });

              this.MiniTasks.afterDestroy(function(minitask, options, fn) {
                afterMiniTask = true;
                fn();
              });

              return this.sequelize.Promise.all([
                this.Projects.create({title: 'New Project'}),
                this.Tasks.create({title: 'New Task'}),
                this.MiniTasks.create({mini_title: 'New MiniTask'})
              ]).bind(this).spread(function(project, task, minitask) {
                return this.sequelize.Promise.all([
                  task.addMiniTask(minitask),
                  project.addTask(task)
                ]).return(project);
              }).then(function(project) {
                return project.destroy();
              }).then(function() {
                expect(beforeProject).to.be.true;
                expect(afterProject).to.be.true;
                expect(beforeTask).to.be.true;
                expect(afterTask).to.be.true;
                expect(beforeMiniTask).to.be.true;
                expect(afterMiniTask).to.be.true;
              });
            });

            it('with errors', function() {
              var beforeProject = false
                , afterProject = false
                , beforeTask = false
                , afterTask = false
                , beforeMiniTask = false
                , afterMiniTask = false
                , VeryCustomError = function() {};

              this.Projects.beforeCreate(function() {
                beforeProject = true;
              });

              this.Projects.afterCreate(function() {
                afterProject = true;
              });

              this.Tasks.beforeDestroy(function() {
                beforeTask = true;
                throw new VeryCustomError('Whoops!');
              });

              this.Tasks.afterDestroy(function() {
                afterTask = true;
              });

              this.MiniTasks.beforeDestroy(function() {
                beforeMiniTask = true;
              });

              this.MiniTasks.afterDestroy(function() {
                afterMiniTask = true;
              });

              return this.sequelize.Promise.all([
                this.Projects.create({title: 'New Project'}),
                this.Tasks.create({title: 'New Task'}),
                this.MiniTasks.create({mini_title: 'New MiniTask'})
              ]).bind(this).spread(function(project, task, minitask) {
                return this.sequelize.Promise.all([
                  task.addMiniTask(minitask),
                  project.addTask(task)
                ]).return(project);
              }).then(function(project) {
                return expect(project.destroy()).to.eventually.be.rejectedWith(VeryCustomError).then(function () {
                  expect(beforeProject).to.be.true;
                  expect(afterProject).to.be.true;
                  expect(beforeTask).to.be.true;
                  expect(afterTask).to.be.false;
                  expect(beforeMiniTask).to.be.false;
                  expect(afterMiniTask).to.be.false;
                });
              });
            });
          });
        });
      });
    }

  });

  describe('passing DAO instances', function() {
    describe('beforeValidate / afterValidate', function() {
      it('should pass a DAO instance to the hook', function() {
        var beforeHooked = false;
        var afterHooked = false;
        var User = this.sequelize.define('User', {
          username: DataTypes.STRING
        }, {
          hooks: {
            beforeValidate: function(user, options, fn) {
              expect(user).to.be.instanceof(User.Instance);
              beforeHooked = true;
              fn();
            },
            afterValidate: function(user, options, fn) {
              expect(user).to.be.instanceof(User.Instance);
              afterHooked = true;
              fn();
            }
          }
        });

        return User.sync({ force: true }).then(function() {
          return User.create({ username: 'bob' }).then(function() {
            expect(beforeHooked).to.be.true;
            expect(afterHooked).to.be.true;
          });
        });
      });
    });

    describe('beforeCreate / afterCreate', function() {
      it('should pass a DAO instance to the hook', function() {
        var beforeHooked = false;
        var afterHooked = false;
        var User = this.sequelize.define('User', {
          username: DataTypes.STRING
        }, {
          hooks: {
            beforeCreate: function(user, options, fn) {
              expect(user).to.be.instanceof(User.Instance);
              beforeHooked = true;
              fn();
            },
            afterCreate: function(user, options, fn) {
              expect(user).to.be.instanceof(User.Instance);
              afterHooked = true;
              fn();
            }
          }
        });

        return User.sync({ force: true }).then(function() {
          return User.create({ username: 'bob' }).then(function() {
            expect(beforeHooked).to.be.true;
            expect(afterHooked).to.be.true;
          });
        });
      });
    });

    describe('beforeDestroy / afterDestroy', function() {
      it('should pass a DAO instance to the hook', function() {
        var beforeHooked = false;
        var afterHooked = false;
        var User = this.sequelize.define('User', {
          username: DataTypes.STRING
        }, {
          hooks: {
            beforeDestroy: function(user, options, fn) {
              expect(user).to.be.instanceof(User.Instance);
              beforeHooked = true;
              fn();
            },
            afterDestroy: function(user, options, fn) {
              expect(user).to.be.instanceof(User.Instance);
              afterHooked = true;
              fn();
            }
          }
        });

        return User.sync({ force: true }).then(function() {
          return User.create({ username: 'bob' }).then(function(user) {
            return user.destroy().then(function() {
              expect(beforeHooked).to.be.true;
              expect(afterHooked).to.be.true;
            });
          });
        });
      });
    });

    describe('beforeDelete / afterDelete', function() {
      it('should pass a DAO instance to the hook', function() {
        var beforeHooked = false;
        var afterHooked = false;
        var User = this.sequelize.define('User', {
          username: DataTypes.STRING
        }, {
          hooks: {
            beforeDelete: function(user, options, fn) {
              expect(user).to.be.instanceof(User.Instance);
              beforeHooked = true;
              fn();
            },
            afterDelete: function(user, options, fn) {
              expect(user).to.be.instanceof(User.Instance);
              afterHooked = true;
              fn();
            }
          }
        });

        return User.sync({ force: true }).then(function() {
          return User.create({ username: 'bob' }).then(function(user) {
            return user.destroy().then(function() {
              expect(beforeHooked).to.be.true;
              expect(afterHooked).to.be.true;
            });
          });
        });
      });
    });

    describe('beforeUpdate / afterUpdate', function() {
      it('should pass a DAO instance to the hook', function() {
        var beforeHooked = false;
        var afterHooked = false;
        var User = this.sequelize.define('User', {
          username: DataTypes.STRING
        }, {
          hooks: {
            beforeUpdate: function(user, options, fn) {
              expect(user).to.be.instanceof(User.Instance);
              beforeHooked = true;
              fn();
            },
            afterUpdate: function(user, options, fn) {
              expect(user).to.be.instanceof(User.Instance);
              afterHooked = true;
              fn();
            }
          }
        });

        return User.sync({ force: true }).then(function() {
          return User.create({ username: 'bob' }).then(function(user) {
            user.username = 'bawb';
            return user.save({ fields: ['username'] }).then(function() {
              expect(beforeHooked).to.be.true;
              expect(afterHooked).to.be.true;
            });
          });
        });
      });
    });
  });

  describe('Model#sync', function() {
    describe('on success', function() {
      it('should run hooks', function() {
        var beforeHook = sinon.spy()
          , afterHook = sinon.spy();

        this.User.beforeSync(beforeHook);
        this.User.afterSync(afterHook);

        return this.User.sync().then(function() {
          expect(beforeHook).to.have.been.calledOnce;
          expect(afterHook).to.have.been.calledOnce;
        });
      });

      it('should not run hooks when "hooks = false" option passed', function() {
        var beforeHook = sinon.spy()
          , afterHook = sinon.spy();

        this.User.beforeSync(beforeHook);
        this.User.afterSync(afterHook);

        return this.User.sync({ hooks: false }).then(function() {
          expect(beforeHook).to.not.have.been.called;
          expect(afterHook).to.not.have.been.called;
        });
      });

    });

    describe('on error', function() {
      it('should return an error from before', function() {
        var beforeHook = sinon.spy()
          , afterHook = sinon.spy();

        this.User.beforeSync(function(options) {
          beforeHook();
          throw new Error('Whoops!');
        });
        this.User.afterSync(afterHook);

        return expect(this.User.sync()).to.be.rejected.then(function(err) {
          expect(beforeHook).to.have.been.calledOnce;
          expect(afterHook).not.to.have.been.called;
        });
      });

      it('should return an error from after', function() {
        var beforeHook = sinon.spy()
          , afterHook = sinon.spy();

        this.User.beforeSync(beforeHook);
        this.User.afterSync(function(options) {
          afterHook();
          throw new Error('Whoops!');
        });

        return expect(this.User.sync()).to.be.rejected.then(function(err) {
          expect(beforeHook).to.have.been.calledOnce;
          expect(afterHook).to.have.been.calledOnce;
        });
      });
    });
  });

  describe('sequelize#sync', function() {
    describe('on success', function() {
      it('should run hooks', function() {
        var beforeHook = sinon.spy()
          , afterHook = sinon.spy()
          , modelBeforeHook = sinon.spy()
          , modelAfterHook = sinon.spy();

        this.sequelize.beforeBulkSync(beforeHook);
        this.User.beforeSync(modelBeforeHook);
        this.User.afterSync(modelAfterHook);
        this.sequelize.afterBulkSync(afterHook);

        return this.sequelize.sync().then(function() {
          expect(beforeHook).to.have.been.calledOnce;
          expect(modelBeforeHook).to.have.been.calledOnce;
          expect(modelAfterHook).to.have.been.calledOnce;
          expect(afterHook).to.have.been.calledOnce;
        });
      });

      it('should not run hooks if "hooks = false" option passed', function() {
        var beforeHook = sinon.spy()
          , afterHook = sinon.spy()
          , modelBeforeHook = sinon.spy()
          , modelAfterHook = sinon.spy();

        this.sequelize.beforeBulkSync(beforeHook);
        this.User.beforeSync(modelBeforeHook);
        this.User.afterSync(modelAfterHook);
        this.sequelize.afterBulkSync(afterHook);

        return this.sequelize.sync({ hooks: false }).then(function() {
          expect(beforeHook).to.not.have.been.called;
          expect(modelBeforeHook).to.not.have.been.called;
          expect(modelAfterHook).to.not.have.been.called;
          expect(afterHook).to.not.have.been.called;
        });
      });

      afterEach(function() {
        this.sequelize.options.hooks = {};
      });

    });

    describe('on error', function() {

      it('should return an error from before', function() {
        var beforeHook = sinon.spy()
          , afterHook = sinon.spy();
        this.sequelize.beforeBulkSync(function(options) {
          beforeHook();
          throw new Error('Whoops!');
        });
        this.sequelize.afterBulkSync(afterHook);

        return expect(this.sequelize.sync()).to.be.rejected.then(function(err) {
          expect(beforeHook).to.have.been.calledOnce;
          expect(afterHook).not.to.have.been.called;
        });
      });

      it('should return an error from after', function() {
        var beforeHook = sinon.spy()
          , afterHook = sinon.spy();

        this.sequelize.beforeBulkSync(beforeHook);
        this.sequelize.afterBulkSync(function(options) {
          afterHook();
          throw new Error('Whoops!');
        });

        return expect(this.sequelize.sync()).to.be.rejected.then(function(err) {
          expect(beforeHook).to.have.been.calledOnce;
          expect(afterHook).to.have.been.calledOnce;
        });
      });

      afterEach(function() {
        this.sequelize.options.hooks = {};
      });

    });
  });

});
