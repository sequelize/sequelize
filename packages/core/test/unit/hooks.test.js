'use strict';

const noop = require('lodash/noop');

const chai = require('chai');
const sinon = require('sinon');

const expect = chai.expect;
const Support = require('../support');
const { DataTypes, Sequelize } = require('@sequelize/core');

const sequelize = Support.sequelize;

describe(Support.getTestDialectTeaser('Hooks'), () => {
  beforeEach(function () {
    this.Model = sequelize.define('m');
  });

  it('does not expose non-model hooks', function () {
    for (const badHook of [
      'beforeDefine',
      'afterDefine',
      'beforeConnect',
      'afterConnect',
      'beforePoolAcquire',
      'afterPoolAcquire',
      'beforeDisconnect',
      'afterDisconnect',
      'beforeInit',
      'afterInit',
    ]) {
      expect(this.Model).to.not.have.property(badHook);
    }
  });

  describe('arguments', () => {
    it('hooks can modify passed arguments', async function () {
      this.Model.addHook('beforeCreate', options => {
        options.answer = 41;
      });

      const options = {};
      await this.Model.runHooks('beforeCreate', options);
      expect(options.answer).to.equal(41);
    });
  });

  describe('proxies', () => {
    beforeEach(() => {
      sinon.stub(sequelize, 'queryRaw').resolves([
        {
          _previousDataValues: {},
          dataValues: { id: 1, name: 'abc' },
        },
      ]);
    });

    afterEach(() => {
      sequelize.queryRaw.restore();
    });

    describe('defined by options.hooks', () => {
      beforeEach(function () {
        this.beforeSaveHook = sinon.spy();
        this.afterSaveHook = sinon.spy();
        this.afterCreateHook = sinon.spy();

        this.Model = sequelize.define(
          'm',
          {
            name: DataTypes.STRING,
          },
          {
            hooks: {
              beforeSave: this.beforeSaveHook,
              afterSave: this.afterSaveHook,
              afterCreate: this.afterCreateHook,
            },
          },
        );
      });

      it('calls beforeSave/afterSave', async function () {
        await this.Model.create({});
        expect(this.afterCreateHook).to.have.been.calledOnce;
        expect(this.beforeSaveHook).to.have.been.calledOnce;
        expect(this.afterSaveHook).to.have.been.calledOnce;
      });
    });

    describe('defined by addHook method', () => {
      beforeEach(function () {
        this.beforeSaveHook = sinon.spy();
        this.afterSaveHook = sinon.spy();

        this.Model = sequelize.define('m', {
          name: DataTypes.STRING,
        });

        this.Model.addHook('beforeSave', this.beforeSaveHook);
        this.Model.addHook('afterSave', this.afterSaveHook);
      });

      it('calls beforeSave/afterSave', async function () {
        await this.Model.create({});
        expect(this.beforeSaveHook).to.have.been.calledOnce;
        expect(this.afterSaveHook).to.have.been.calledOnce;
      });
    });

    describe('defined by hook method', () => {
      beforeEach(function () {
        this.beforeSaveHook = sinon.spy();
        this.afterSaveHook = sinon.spy();

        this.Model = sequelize.define('m', {
          name: DataTypes.STRING,
        });

        this.Model.addHook('beforeSave', this.beforeSaveHook);
        this.Model.addHook('afterSave', this.afterSaveHook);
      });

      it('calls beforeSave/afterSave', async function () {
        await this.Model.create({});
        expect(this.beforeSaveHook).to.have.been.calledOnce;
        expect(this.afterSaveHook).to.have.been.calledOnce;
      });
    });
  });

  describe('multiple hooks', () => {
    beforeEach(function () {
      this.hook1 = sinon.spy();
      this.hook2 = sinon.spy();
      this.hook3 = sinon.spy();
    });

    describe('runs all hooks on success', () => {
      afterEach(function () {
        expect(this.hook1).to.have.been.calledOnce;
        expect(this.hook2).to.have.been.calledOnce;
        expect(this.hook3).to.have.been.calledOnce;
      });

      it('using addHook', async function () {
        this.Model.addHook('beforeCreate', this.hook1);
        this.Model.addHook('beforeCreate', this.hook2);
        this.Model.addHook('beforeCreate', this.hook3);

        await this.Model.runHooks('beforeCreate');
      });

      it('using function', async function () {
        this.Model.beforeCreate(this.hook1);
        this.Model.beforeCreate(this.hook2);
        this.Model.beforeCreate(this.hook3);

        await this.Model.runHooks('beforeCreate');
      });

      it('using define', async function () {
        await sequelize
          .define(
            'M',
            {},
            {
              hooks: {
                beforeCreate: [this.hook1, this.hook2, this.hook3],
              },
            },
          )
          .runHooks('beforeCreate');
      });

      it('using a mixture', async function () {
        const Model = sequelize.define(
          'M',
          {},
          {
            hooks: {
              beforeCreate: this.hook1,
            },
          },
        );
        Model.beforeCreate(this.hook2);
        Model.addHook('beforeCreate', this.hook3);

        await Model.runHooks('beforeCreate');
      });
    });

    it('stops execution when a hook throws', async function () {
      this.Model.beforeCreate(() => {
        this.hook1();

        throw new Error('No!');
      });
      this.Model.beforeCreate(this.hook2);

      await expect(this.Model.runHooks('beforeCreate')).to.be.rejected;
      expect(this.hook1).to.have.been.calledOnce;
      expect(this.hook2).not.to.have.been.called;
    });

    it('stops execution when a hook rejects', async function () {
      this.Model.beforeCreate(async () => {
        this.hook1();

        throw new Error('No!');
      });
      this.Model.beforeCreate(this.hook2);

      await expect(this.Model.runHooks('beforeCreate')).to.be.rejected;
      expect(this.hook1).to.have.been.calledOnce;
      expect(this.hook2).not.to.have.been.called;
    });
  });

  describe('global hooks', () => {
    describe('using addHook', () => {
      it('invokes the global hook', async function () {
        const globalHook = sinon.spy();

        sequelize.addHook('beforeUpdate', globalHook);

        await this.Model.runHooks('beforeUpdate');
        expect(globalHook).to.have.been.calledOnce;
      });

      it('invokes the global hook, when the model also has a hook', async () => {
        const globalHookBefore = sinon.spy();
        const globalHookAfter = sinon.spy();
        const localHook = sinon.spy();

        sequelize.addHook('beforeUpdate', globalHookBefore);

        const Model = sequelize.define(
          'm',
          {},
          {
            hooks: {
              beforeUpdate: localHook,
            },
          },
        );

        sequelize.addHook('beforeUpdate', globalHookAfter);

        await Model.runHooks('beforeUpdate');
        expect(globalHookBefore).to.have.been.calledOnce;
        expect(globalHookAfter).to.have.been.calledOnce;
        expect(localHook).to.have.been.calledOnce;

        expect(localHook).to.have.been.calledBefore(globalHookBefore);
        expect(localHook).to.have.been.calledBefore(globalHookAfter);
      });
    });

    it('registers both the global define hook, and the local hook', async () => {
      const globalHook = sinon.spy();
      const sequelize = Support.createSequelizeInstance({
        define: {
          hooks: {
            beforeCreate: globalHook,
          },
        },
      });

      const localHook = sinon.spy();

      const Model = sequelize.define(
        'M',
        {},
        {
          hooks: {
            beforeUpdate: noop, // Just to make sure we can define other hooks without overwriting the global one
            beforeCreate: localHook,
          },
        },
      );

      await Model.runHooks('beforeCreate');
      expect(globalHook).to.have.been.calledOnce;
      expect(localHook).to.have.been.calledOnce;
    });
  });

  describe('#removeHook', () => {
    it('should remove hook', async function () {
      const hook1 = sinon.spy();
      const hook2 = sinon.spy();

      this.Model.addHook('beforeCreate', 'myHook', hook1);
      this.Model.beforeCreate('myHook2', hook2);

      await this.Model.runHooks('beforeCreate');
      expect(hook1).to.have.been.calledOnce;
      expect(hook2).to.have.been.calledOnce;

      hook1.resetHistory();
      hook2.resetHistory();

      this.Model.removeHook('beforeCreate', 'myHook');
      this.Model.removeHook('beforeCreate', 'myHook2');

      await this.Model.runHooks('beforeCreate');
      expect(hook1).not.to.have.been.called;
      expect(hook2).not.to.have.been.called;
    });

    it('should not remove other hooks', async function () {
      const hook1 = sinon.spy();
      const hook2 = sinon.spy();
      const hook3 = sinon.spy();
      const hook4 = sinon.spy();

      this.Model.addHook('beforeCreate', hook1);
      this.Model.addHook('beforeCreate', 'myHook', hook2);
      this.Model.beforeCreate('myHook2', hook3);
      this.Model.beforeCreate(hook4);

      await this.Model.runHooks('beforeCreate');
      expect(hook1).to.have.been.calledOnce;
      expect(hook2).to.have.been.calledOnce;
      expect(hook3).to.have.been.calledOnce;
      expect(hook4).to.have.been.calledOnce;

      hook1.resetHistory();
      hook2.resetHistory();
      hook3.resetHistory();
      hook4.resetHistory();

      this.Model.removeHook('beforeCreate', 'myHook');

      await this.Model.runHooks('beforeCreate');
      expect(hook1).to.have.been.calledOnce;
      expect(hook2).not.to.have.been.called;
      expect(hook3).to.have.been.calledOnce;
      expect(hook4).to.have.been.calledOnce;
    });
  });

  describe('#addHook', () => {
    it('should add additional hook when previous exists', async function () {
      const hook1 = sinon.spy();
      const hook2 = sinon.spy();

      const Model = this.sequelize.define(
        'Model',
        {},
        {
          hooks: { beforeCreate: hook1 },
        },
      );

      Model.addHook('beforeCreate', hook2);

      await Model.runHooks('beforeCreate');
      expect(hook1).to.have.been.calledOnce;
      expect(hook2).to.have.been.calledOnce;
    });
  });

  describe('promises', () => {
    it('can return a promise', async function () {
      this.Model.beforeBulkCreate(async () => {
        // This space intentionally left blank
      });

      await expect(this.Model.runHooks('beforeBulkCreate')).to.be.fulfilled;
    });

    it('can return undefined', async function () {
      this.Model.beforeBulkCreate(() => {
        // This space intentionally left blank
      });

      await expect(this.Model.runHooks('beforeBulkCreate')).to.be.fulfilled;
    });

    it('can return an error by rejecting', async function () {
      this.Model.beforeCreate(async () => {
        throw new Error('Forbidden');
      });

      await expect(this.Model.runHooks('beforeCreate')).to.be.rejectedWith('Forbidden');
    });

    it('can return an error by throwing', async function () {
      this.Model.beforeCreate(() => {
        throw new Error('Forbidden');
      });

      await expect(this.Model.runHooks('beforeCreate')).to.be.rejectedWith('Forbidden');
    });
  });

  describe('sync hooks', () => {
    beforeEach(function () {
      this.hook1 = sinon.spy();
      this.hook2 = sinon.spy();
      this.hook3 = sinon.spy();
      this.hook4 = sinon.spy();
    });

    it('runs all beforInit/afterInit hooks', function () {
      Sequelize.addHook('beforeInit', 'h1', this.hook1);
      Sequelize.addHook('beforeInit', 'h2', this.hook2);
      Sequelize.addHook('afterInit', 'h3', this.hook3);
      Sequelize.addHook('afterInit', 'h4', this.hook4);

      Support.createSequelizeInstance();

      expect(this.hook1).to.have.been.calledOnce;
      expect(this.hook2).to.have.been.calledOnce;
      expect(this.hook3).to.have.been.calledOnce;
      expect(this.hook4).to.have.been.calledOnce;

      // cleanup hooks on Sequelize
      Sequelize.removeHook('beforeInit', 'h1');
      Sequelize.removeHook('beforeInit', 'h2');
      Sequelize.removeHook('afterInit', 'h3');
      Sequelize.removeHook('afterInit', 'h4');

      Support.createSequelizeInstance();

      // check if hooks were removed
      expect(this.hook1).to.have.been.calledOnce;
      expect(this.hook2).to.have.been.calledOnce;
      expect(this.hook3).to.have.been.calledOnce;
      expect(this.hook4).to.have.been.calledOnce;
    });

    it('runs all beforDefine/afterDefine hooks', function () {
      const sequelize = Support.createSequelizeInstance();
      sequelize.addHook('beforeDefine', this.hook1);
      sequelize.addHook('beforeDefine', this.hook2);
      sequelize.addHook('afterDefine', this.hook3);
      sequelize.addHook('afterDefine', this.hook4);
      sequelize.define('Test', {});
      expect(this.hook1).to.have.been.calledOnce;
      expect(this.hook2).to.have.been.calledOnce;
      expect(this.hook3).to.have.been.calledOnce;
      expect(this.hook4).to.have.been.calledOnce;
    });
  });

  describe('#removal', () => {
    before(() => {
      sinon.stub(sequelize, 'queryRaw').resolves([
        {
          _previousDataValues: {},
          dataValues: { id: 1, name: 'abc' },
        },
      ]);
    });

    after(() => {
      sequelize.queryRaw.restore();
    });

    it('should be able to remove by name', async () => {
      const User = sequelize.define('User');

      const hook1 = sinon.spy();
      const hook2 = sinon.spy();

      User.addHook('beforeCreate', 'sasuke', hook1);
      User.addHook('beforeCreate', 'naruto', hook2);

      await User.create({ username: 'makunouchi' });
      expect(hook1).to.have.been.calledOnce;
      expect(hook2).to.have.been.calledOnce;
      User.removeHook('beforeCreate', 'sasuke');
      await User.create({ username: 'sendo' });
      expect(hook1).to.have.been.calledOnce;
      expect(hook2).to.have.been.calledTwice;
    });

    it('should be able to remove by reference', async () => {
      const User = sequelize.define('User');

      const hook1 = sinon.spy();
      const hook2 = sinon.spy();

      User.addHook('beforeCreate', hook1);
      User.addHook('beforeCreate', hook2);

      await User.create({ username: 'makunouchi' });
      expect(hook1).to.have.been.calledOnce;
      expect(hook2).to.have.been.calledOnce;
      User.removeHook('beforeCreate', hook1);
      await User.create({ username: 'sendo' });
      expect(hook1).to.have.been.calledOnce;
      expect(hook2).to.have.been.calledTwice;
    });
  });
});
