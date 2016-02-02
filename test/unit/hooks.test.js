'use strict';

/* jshint -W030 */
var chai = require('chai')
  , sinon = require('sinon')
  , expect = chai.expect
  , Support = require(__dirname + '/support')
  , _ = require('lodash')
  , current = Support.sequelize
  , Promise = current.Promise;

describe(Support.getTestDialectTeaser('Hooks'), function() {
  beforeEach(function () {
    this.Model = current.define('m');
  });

  describe('callback', function () {
    // Legacy - remove at some point

    it('success', function () {
      this.Model.beforeCreate(function (attributes, options, fn) {
        fn();
      });

      return expect(this.Model.runHooks('beforeCreate', {}, {})).to.be.resolved;
    });

    it('error', function () {
      this.Model.beforeCreate(function (attributes, options, fn) {
        fn('No!');
      });

      return expect(this.Model.runHooks('beforeCreate', {}, {})).to.be.rejectedWith('No!');
    });
  });

  describe('arguments', function () {
    it('hooks can modify passed arguments', function () {
      this.Model.addHook('beforeCreate', function (options) {
        options.answer = 41;
      });

      var options = {};
      return this.Model.runHooks('beforeCreate', options).then(function () {
        expect(options.answer).to.equal(41);
      });
    });
  });

  describe('multiple hooks', function () {
    beforeEach(function () {
      this.hook1 = sinon.spy();
      this.hook2 = sinon.spy();
      this.hook3 = sinon.spy();
    });

    describe('runs all hooks on success', function () {
      afterEach(function () {
        expect(this.hook1).to.have.been.calledOnce;
        expect(this.hook2).to.have.been.calledOnce;
        expect(this.hook3).to.have.been.calledOnce;
      });

      it('using addHook', function () {
        this.Model.addHook('beforeCreate', this.hook1);
        this.Model.addHook('beforeCreate', this.hook2);
        this.Model.addHook('beforeCreate', this.hook3);

        return this.Model.runHooks('beforeCreate');
      });

      it('using function', function () {
        this.Model.beforeCreate(this.hook1);
        this.Model.beforeCreate(this.hook2);
        this.Model.beforeCreate(this.hook3);

        return this.Model.runHooks('beforeCreate');
      });

      it('using define', function () {
        return current.define('M', {}, {
          hooks: {
            beforeCreate: [this.hook1, this.hook2, this.hook3]
          }
        }).runHooks('beforeCreate');
      });

      it('using a mixture', function () {
        var Model = current.define('M', {}, {
          hooks: {
            beforeCreate: this.hook1
          }
        });
        Model.beforeCreate(this.hook2);
        Model.addHook('beforeCreate', this.hook3);

        return Model.runHooks('beforeCreate');
      });
    });

    it('stops execution when a hook throws', function () {
      this.Model.beforeCreate(function () {
        this.hook1();

        throw new Error('No!');
      }.bind(this));
      this.Model.beforeCreate(this.hook2);

      return expect(this.Model.runHooks('beforeCreate')).to.be.rejected.then(function () {
        expect(this.hook1).to.have.been.calledOnce;
        expect(this.hook2).not.to.have.been.called;
      }.bind(this));
    });

    it('stops execution when a hook rejects', function () {
      this.Model.beforeCreate(function () {
        this.hook1();

        return Promise.reject(new Error('No!'));
      }.bind(this));
      this.Model.beforeCreate(this.hook2);

      return expect(this.Model.runHooks('beforeCreate')).to.be.rejected.then(function () {
        expect(this.hook1).to.have.been.calledOnce;
        expect(this.hook2).not.to.have.been.called;
      }.bind(this));
    });
  });

  describe('global hooks', function () {
    describe('using addHook', function () {

      it('invokes the global hook', function () {
        var globalHook = sinon.spy();

        current.addHook('beforeUpdate', globalHook);

        return this.Model.runHooks('beforeUpdate').then(function () {
          expect(globalHook).to.have.been.calledOnce;
        });
      });

      it('invokes the global hook, when the model also has a hook', function () {
        var globalHookBefore = sinon.spy()
          , globalHookAfter = sinon.spy()
          , localHook = sinon.spy();

        current.addHook('beforeUpdate', globalHookBefore);

        var Model = current.define('m', {}, {
          hooks: {
            beforeUpdate: localHook
          }
        });

        current.addHook('beforeUpdate', globalHookAfter);

        return Model.runHooks('beforeUpdate').then(function () {
          expect(globalHookBefore).to.have.been.calledOnce;
          expect(globalHookAfter).to.have.been.calledOnce;
          expect(localHook).to.have.been.calledOnce;

          expect(localHook).to.have.been.calledBefore(globalHookBefore);
          expect(localHook).to.have.been.calledBefore(globalHookAfter);
        });
      });
    });

    describe('using define hooks', function () {
      beforeEach(function () {
        this.beforeCreate = sinon.spy();
        this.sequelize = Support.createSequelizeInstance({
          define: {
            hooks: {
              beforeCreate: this.beforeCreate
            }
          }
        });
      });

      it('runs the global hook when no hook is passed', function () {
        var Model = this.sequelize.define('M', {}, {
          hooks: {
            beforeUpdate: _.noop // Just to make sure we can define other hooks without overwriting the global one
          }
        });

        return Model.runHooks('beforeCreate').bind(this).then(function () {
          expect(this.beforeCreate).to.have.been.calledOnce;
        });
      });

      it('does not run the global hook when the model specifies its own hook', function () {
        var localHook = sinon.spy()
          , Model = this.sequelize.define('M', {}, {
            hooks: {
              beforeCreate: localHook
            }
          });

        return Model.runHooks('beforeCreate').bind(this).then(function () {
          expect(this.beforeCreate).not.to.have.been.called;
          expect(localHook).to.have.been.calledOnce;
        });
      });
    });
  });

  describe('#removeHook', function() {
    it('should remove hook', function() {
      var hook1 = sinon.spy()
        , hook2 = sinon.spy();

      this.Model.addHook('beforeCreate', 'myHook', hook1);
      this.Model.beforeCreate('myHook2', hook2);

      return this.Model.runHooks('beforeCreate').bind(this).then(function() {
        expect(hook1).to.have.been.calledOnce;
        expect(hook2).to.have.been.calledOnce;

        hook1.reset();
        hook2.reset();

        this.Model.removeHook('beforeCreate', 'myHook');
        this.Model.removeHook('beforeCreate', 'myHook2');

        return this.Model.runHooks('beforeCreate');
      }).then(function() {
        expect(hook1).not.to.have.been.called;
        expect(hook2).not.to.have.been.called;
      });
    });
  });

  describe('#addHook', function() {
    it('should add additional hook when previous exists', function() {
      var hook1 = sinon.spy()
        , hook2 = sinon.spy()
        , Model;

      Model = this.sequelize.define('Model', {}, {
        hooks: { beforeCreate: hook1 }
      });

      Model.addHook('beforeCreate', hook2);

      return Model.runHooks('beforeCreate').then(function() {
        expect(hook1).to.have.been.calledOnce;
        expect(hook2).to.have.been.calledOnce;
      });
    });
  });

  describe('aliases', function() {
    beforeEach(function () {
      this.beforeDelete = sinon.spy();
      this.afterDelete = sinon.spy();
    });

    afterEach(function () {
      expect(this.beforeDelete).to.have.been.calledOnce;
      expect(this.afterDelete).to.have.been.calledOnce;
    });

    describe('direct method', function() {
      it('#delete', function() {
        this.Model.beforeDelete(this.beforeDelete);
        this.Model.afterDelete(this.afterDelete);

        return Promise.join(
          this.Model.runHooks('beforeDestroy'),
          this.Model.runHooks('afterDestroy')
        );
      });
    });

    describe('.hook() method', function() {
      it('#delete', function() {
        this.Model.hook('beforeDelete', this.beforeDelete);
        this.Model.hook('afterDelete', this.afterDelete);

        return Promise.join(
          this.Model.runHooks('beforeDestroy'),
          this.Model.runHooks('afterDestroy')
        );
      });
    });
  });

  describe('promises', function() {
    it('can return a promise', function() {
      var self = this;

      this.Model.beforeBulkCreate(function() {
        return self.sequelize.Promise.resolve();
      });

      return expect(this.Model.runHooks('beforeBulkCreate')).to.be.resolved;
    });

    it('can return undefined', function() {
      this.Model.beforeBulkCreate(function() {
        // This space intentionally left blank
      });

      return expect(this.Model.runHooks('beforeBulkCreate')).to.be.resolved;
    });

    it('can return an error by rejecting', function() {
      this.Model.beforeCreate(function() {
        return Promise.reject(new Error('Forbidden'));
      });

      return expect(this.Model.runHooks('beforeCreate')).to.be.rejectedWith('Forbidden');
    });

    it('can return an error by throwing', function() {
      this.Model.beforeCreate(function() {
        throw (new Error('Forbidden'));
      });

      return expect(this.Model.runHooks('beforeCreate')).to.be.rejectedWith('Forbidden');
    });
  });
});
