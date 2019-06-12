'use strict';

const chai = require('chai'),
  sinon = require('sinon'),
  expect = chai.expect,
  Sequelize = require('../../index'),
  Promise = Sequelize.Promise,
  Support = require('./support'),
  _ = require('lodash'),
  current = Support.sequelize;

describe(Support.getTestDialectTeaser('Hooks'), () => {
  beforeEach(function() {
    this.Model = current.define('m');
  });

  it('does not expose non-model hooks', function() {
    for (const badHook of ['beforeDefine', 'afterDefine', 'beforeConnect', 'afterConnect', 'beforeInit', 'afterInit', 'beforeBulkSync', 'afterBulkSync']) {
      expect(() => this.Model.hooks.add(badHook, () => {})).to.throw(/is only applicable/);
    }
  });

  describe('arguments', () => {
    it('hooks can modify passed arguments', function() {
      this.Model.hooks.add('beforeCreate', options => {
        options.answer = 41;
      });

      const options = {};
      return this.Model.hooks.run('beforeCreate', options).then(() => {
        expect(options.answer).to.equal(41);
      });
    });
  });

  describe('proxies', () => {
    beforeEach(() => {
      sinon.stub(current, 'query').resolves([{
        _previousDataValues: {},
        dataValues: { id: 1, name: 'abc' }
      }]);
    });

    afterEach(() => {
      current.query.restore();
    });

    describe('defined by options.hooks', () => {
      beforeEach(function() {
        this.beforeSaveHook = sinon.spy();
        this.afterSaveHook = sinon.spy();
        this.afterCreateHook = sinon.spy();

        this.Model = current.define('m', {
          name: Support.Sequelize.STRING
        }, {
          hooks: {
            beforeSave: this.beforeSaveHook,
            afterSave: this.afterSaveHook,
            afterCreate: this.afterCreateHook
          }
        });
      });

      it('calls beforeSave/afterSave', function() {
        return this.Model.create({}).then(() => {
          expect(this.afterCreateHook).to.have.been.calledOnce;
          expect(this.beforeSaveHook).to.have.been.calledOnce;
          expect(this.afterSaveHook).to.have.been.calledOnce;
        });
      });
    });

    describe('defined by hooks.add method', () => {
      beforeEach(function() {
        this.beforeSaveHook = sinon.spy();
        this.afterSaveHook = sinon.spy();

        this.Model = current.define('m', {
          name: Support.Sequelize.STRING
        });

        this.Model.hooks.add('beforeSave', this.beforeSaveHook);
        this.Model.hooks.add('afterSave', this.afterSaveHook);
      });

      it('calls beforeSave/afterSave', function() {
        return this.Model.create({}).then(() => {
          expect(this.beforeSaveHook).to.have.been.calledOnce;
          expect(this.afterSaveHook).to.have.been.calledOnce;
        });
      });
    });

    describe('defined by hook method', () => {
      beforeEach(function() {
        this.beforeSaveHook = sinon.spy();
        this.afterSaveHook = sinon.spy();

        this.Model = current.define('m', {
          name: Support.Sequelize.STRING
        });

        this.Model.hooks.add('beforeSave', this.beforeSaveHook);
        this.Model.hooks.add('afterSave', this.afterSaveHook);
      });

      it('calls beforeSave/afterSave', function() {
        return this.Model.create({}).then(() => {
          expect(this.beforeSaveHook).to.have.been.calledOnce;
          expect(this.afterSaveHook).to.have.been.calledOnce;
        });
      });
    });
  });

  describe('multiple hooks', () => {
    beforeEach(function() {
      this.hook1 = sinon.spy();
      this.hook2 = sinon.spy();
      this.hook3 = sinon.spy();
    });

    describe('runs all hooks on success', () => {
      afterEach(function() {
        expect(this.hook1).to.have.been.calledOnce;
        expect(this.hook2).to.have.been.calledOnce;
        expect(this.hook3).to.have.been.calledOnce;
      });

      it('using hooks.add', function() {
        this.Model.hooks.add('beforeCreate', this.hook1);
        this.Model.hooks.add('beforeCreate', this.hook2);
        this.Model.hooks.add('beforeCreate', this.hook3);

        return this.Model.hooks.run('beforeCreate');
      });

      it('using define', function() {
        return current.define('M', {}, {
          hooks: {
            beforeCreate: [this.hook1, this.hook2, this.hook3]
          }
        }).hooks.run('beforeCreate');
      });

      it('using a mixture', function() {
        const Model = current.define('M', {}, {
          hooks: {
            beforeCreate: this.hook1
          }
        });
        Model.hooks.add('beforeCreate', this.hook2);
        Model.hooks.add('beforeCreate', this.hook3);

        return Model.hooks.run('beforeCreate');
      });
    });

    it('stops execution when a hook throws', function() {
      this.Model.hooks.add('beforeCreate', () => {
        this.hook1();

        throw new Error('No!');
      });
      this.Model.hooks.add('beforeCreate', this.hook2);

      return expect(this.Model.hooks.run('beforeCreate')).to.be.rejected.then(() => {
        expect(this.hook1).to.have.been.calledOnce;
        expect(this.hook2).not.to.have.been.called;
      });
    });

    it('stops execution when a hook rejects', function() {
      this.Model.hooks.add('beforeCreate', () => {
        this.hook1();

        return Promise.reject(new Error('No!'));
      });
      this.Model.hooks.add('beforeCreate', this.hook2);

      return expect(this.Model.hooks.run('beforeCreate')).to.be.rejected.then(() => {
        expect(this.hook1).to.have.been.calledOnce;
        expect(this.hook2).not.to.have.been.called;
      });
    });
  });

  describe('global hooks', () => {
    describe('using hooks.add', () => {

      it('invokes the global hook', function() {
        const globalHook = sinon.spy();

        current.hooks.add('beforeUpdate', globalHook);

        return this.Model.hooks.run('beforeUpdate').then(() => {
          expect(globalHook).to.have.been.calledOnce;
        });
      });

      it('invokes the global hook, when the model also has a hook', () => {
        const globalHookBefore = sinon.spy(),
          globalHookAfter = sinon.spy(),
          localHook = sinon.spy();

        current.hooks.add('beforeUpdate', globalHookBefore);

        const Model = current.define('m', {}, {
          hooks: {
            beforeUpdate: localHook
          }
        });

        current.hooks.add('beforeUpdate', globalHookAfter);

        return Model.hooks.run('beforeUpdate').then(() => {
          expect(globalHookBefore).to.have.been.calledOnce;
          expect(globalHookAfter).to.have.been.calledOnce;
          expect(localHook).to.have.been.calledOnce;

          expect(localHook).to.have.been.calledBefore(globalHookBefore);
          expect(localHook).to.have.been.calledBefore(globalHookAfter);
        });
      });
    });

    describe('using define hooks', () => {
      beforeEach(function() {
        this.beforeCreate = sinon.spy();
        this.sequelize = Support.createSequelizeInstance({
          define: {
            hooks: {
              beforeCreate: this.beforeCreate
            }
          }
        });
      });

      it('runs the global hook when no hook is passed', function() {
        const Model = this.sequelize.define('M', {}, {
          hooks: {
            beforeUpdate: _.noop // Just to make sure we can define other hooks without overwriting the global one
          }
        });

        return Model.hooks.run('beforeCreate').then(() => {
          expect(this.beforeCreate).to.have.been.calledOnce;
        });
      });

      it('does not run the global hook when the model specifies its own hook', function() {
        const localHook = sinon.spy(),
          Model = this.sequelize.define('M', {}, {
            hooks: {
              beforeCreate: localHook
            }
          });

        return Model.hooks.run('beforeCreate').then(() => {
          expect(this.beforeCreate).not.to.have.been.called;
          expect(localHook).to.have.been.calledOnce;
        });
      });
    });
  });

  describe('#removeHook', () => {
    it('should remove hook', function() {
      const hook1 = sinon.spy(),
        hook2 = sinon.spy();

      this.Model.hooks.add('beforeCreate', 'myHook', hook1);

      return this.Model.hooks.run('beforeCreate').then(() => {
        expect(hook1).to.have.been.calledOnce;

        hook1.resetHistory();

        this.Model.hooks.remove('beforeCreate', 'myHook');

        return this.Model.hooks.run('beforeCreate');
      }).then(() => {
        expect(hook1).not.to.have.been.called;
        expect(hook2).not.to.have.been.called;
      });
    });

    it('should not remove other hooks', function() {
      const hook1 = sinon.spy(),
        hook2 = sinon.spy(),
        hook3 = sinon.spy(),
        hook4 = sinon.spy();

      this.Model.hooks.add('beforeCreate', hook1);
      this.Model.hooks.add('beforeCreate', 'myHook', hook2);
      this.Model.hooks.add('beforeCreate', 'myHook2', hook3);
      this.Model.hooks.add('beforeCreate', hook4);

      return this.Model.hooks.run('beforeCreate').then(() => {
        expect(hook1).to.have.been.calledOnce;
        expect(hook2).to.have.been.calledOnce;
        expect(hook3).to.have.been.calledOnce;
        expect(hook4).to.have.been.calledOnce;

        hook1.resetHistory();
        hook2.resetHistory();
        hook3.resetHistory();
        hook4.resetHistory();

        this.Model.hooks.remove('beforeCreate', 'myHook');

        return this.Model.hooks.run('beforeCreate');
      }).then(() => {
        expect(hook1).to.have.been.calledOnce;
        expect(hook2).not.to.have.been.called;
        expect(hook3).to.have.been.calledOnce;
        expect(hook4).to.have.been.calledOnce;
      });
    });
  });

  describe('#hooks.add', () => {
    it('should add additional hook when previous exists', function() {
      const hook1 = sinon.spy(),
        hook2 = sinon.spy();

      const Model = this.sequelize.define('Model', {}, {
        hooks: { beforeCreate: hook1 }
      });

      Model.hooks.add('beforeCreate', hook2);

      return Model.hooks.run('beforeCreate').then(() => {
        expect(hook1).to.have.been.calledOnce;
        expect(hook2).to.have.been.calledOnce;
      });
    });
  });

  describe('promises', () => {
    it('can return a promise', function() {
      this.Model.hooks.add('beforeBulkCreate', () => {
        return Sequelize.Promise.resolve();
      });

      return expect(this.Model.hooks.run('beforeBulkCreate')).to.be.fulfilled;
    });

    it('can return undefined', function() {
      this.Model.hooks.add('beforeBulkCreate', () => {
        // This space intentionally left blank
      });

      return expect(this.Model.hooks.run('beforeBulkCreate')).to.be.fulfilled;
    });

    it('can return an error by rejecting', function() {
      this.Model.hooks.add('beforeCreate', () => {
        return Promise.reject(new Error('Forbidden'));
      });

      return expect(this.Model.hooks.run('beforeCreate')).to.be.rejectedWith('Forbidden');
    });

    it('can return an error by throwing', function() {
      this.Model.hooks.add('beforeCreate', () => {
        throw new Error('Forbidden');
      });

      return expect(this.Model.hooks.run('beforeCreate')).to.be.rejectedWith('Forbidden');
    });
  });

  describe('sync hooks', () => {
    beforeEach(function() {
      this.hook1 = sinon.spy();
      this.hook2 = sinon.spy();
      this.hook3 = sinon.spy();
      this.hook4 = sinon.spy();
    });

    it('runs all beforInit/afterInit hooks', function() {
      Support.Sequelize.hooks.add('beforeInit', 'h1', this.hook1);
      Support.Sequelize.hooks.add('beforeInit', 'h2', this.hook2);
      Support.Sequelize.hooks.add('afterInit', 'h3', this.hook3);
      Support.Sequelize.hooks.add('afterInit', 'h4', this.hook4);

      Support.createSequelizeInstance();

      expect(this.hook1).to.have.been.calledOnce;
      expect(this.hook2).to.have.been.calledOnce;
      expect(this.hook3).to.have.been.calledOnce;
      expect(this.hook4).to.have.been.calledOnce;

      // cleanup hooks on Support.Sequelize
      Support.Sequelize.hooks.remove('beforeInit', 'h1');
      Support.Sequelize.hooks.remove('beforeInit', 'h2');
      Support.Sequelize.hooks.remove('afterInit', 'h3');
      Support.Sequelize.hooks.remove('afterInit', 'h4');

      Support.createSequelizeInstance();

      // check if hooks were removed
      expect(this.hook1).to.have.been.calledOnce;
      expect(this.hook2).to.have.been.calledOnce;
      expect(this.hook3).to.have.been.calledOnce;
      expect(this.hook4).to.have.been.calledOnce;
    });

    it('runs all beforDefine/afterDefine hooks', function() {
      const sequelize = Support.createSequelizeInstance();
      sequelize.hooks.add('beforeDefine', this.hook1);
      sequelize.hooks.add('beforeDefine', this.hook2);
      sequelize.hooks.add('afterDefine', this.hook3);
      sequelize.hooks.add('afterDefine', this.hook4);
      sequelize.define('Test', {});
      expect(this.hook1).to.have.been.calledOnce;
      expect(this.hook2).to.have.been.calledOnce;
      expect(this.hook3).to.have.been.calledOnce;
      expect(this.hook4).to.have.been.calledOnce;
    });
  });
});
