'use strict';

const chai = require('chai');

const expect = chai.expect;
const Support = require('../support');
const { DataTypes, Sequelize } = require('@sequelize/core');

const dialect = Support.getTestDialect();
const sinon = require('sinon');

describe(Support.getTestDialectTeaser('Hooks'), () => {
  beforeEach(async function () {
    this.User = this.sequelize.define('User', {
      username: {
        type: DataTypes.STRING,
        allowNull: false,
      },
      mood: {
        type: DataTypes.ENUM(['happy', 'sad', 'neutral']),
      },
    });

    this.ParanoidUser = this.sequelize.define('ParanoidUser', {
      username: DataTypes.STRING,
      mood: {
        type: DataTypes.ENUM(['happy', 'sad', 'neutral']),
      },
    }, {
      paranoid: true,
    });

    await this.sequelize.sync({ force: true });
  });

  describe('#define', () => {
    before(function () {
      this.sequelize.addHook('beforeDefine', (attributes, options) => {
        options.modelName = 'bar';
        options.name.plural = 'barrs';
        attributes.type = DataTypes.STRING;
      });

      this.sequelize.addHook('afterDefine', factory => {
        factory.options.name.singular = 'barr';
      });

      this.model = this.sequelize.define('foo', { name: DataTypes.STRING });
    });

    it('beforeDefine hook can change model name', function () {
      expect(this.model.name).to.equal('bar');
    });

    it('beforeDefine hook can alter options', function () {
      expect(this.model.options.name.plural).to.equal('barrs');
    });

    it('beforeDefine hook can alter attributes', function () {
      expect(this.model.getAttributes().type).to.be.ok;
    });

    it('afterDefine hook can alter options', function () {
      expect(this.model.options.name.singular).to.equal('barr');
    });

    after(function () {
      this.sequelize.hooks.removeAllListeners();
      this.sequelize.modelManager.removeModel(this.model);
    });
  });

  describe('init', () => {
    Support.setResetMode('none');

    const vars = Support.beforeAll2(() => {
      const unhookBeforeInit = Sequelize.hooks.addListener('beforeInit', options => {
        options.database = 'db2';
        options.host = 'server9';
      });

      const unhookAfterInit = Sequelize.hooks.addListener('afterInit', sequelize => {
        sequelize.options.protocol = 'udp';
      });

      const seq = new Sequelize('db', 'user', 'pass', { dialect });

      return {
        seq,
        unhook() {
          unhookBeforeInit();
          unhookAfterInit();
        },
      };
    });

    after(async () => {
      await vars.seq.close();
      vars.unhook();
    });

    it('beforeInit hook can alter config', () => {
      expect(vars.seq.config.database).to.equal('db2');
    });

    it('beforeInit hook can alter options', () => {
      expect(vars.seq.options.host).to.equal('server9');
    });

    it('afterInit hook can alter options', () => {
      expect(vars.seq.options.protocol).to.equal('udp');
    });
  });

  describe('passing DAO instances', () => {
    describe('beforeValidate / afterValidate', () => {
      it('should pass a DAO instance to the hook', async function () {
        let beforeHooked = false;
        let afterHooked = false;
        const User = this.sequelize.define('User', {
          username: DataTypes.STRING,
        }, {
          hooks: {
            async beforeValidate(user) {
              expect(user).to.be.instanceof(User);
              beforeHooked = true;
            },
            async afterValidate(user) {
              expect(user).to.be.instanceof(User);
              afterHooked = true;
            },
          },
        });

        await User.sync({ force: true });
        await User.create({ username: 'bob' });
        expect(beforeHooked).to.be.true;
        expect(afterHooked).to.be.true;
      });
    });

    describe('beforeCreate / afterCreate', () => {
      it('should pass a DAO instance to the hook', async function () {
        let beforeHooked = false;
        let afterHooked = false;
        const User = this.sequelize.define('User', {
          username: DataTypes.STRING,
        }, {
          hooks: {
            async beforeCreate(user) {
              expect(user).to.be.instanceof(User);
              beforeHooked = true;
            },
            async afterCreate(user) {
              expect(user).to.be.instanceof(User);
              afterHooked = true;
            },
          },
        });

        await User.sync({ force: true });
        await User.create({ username: 'bob' });
        expect(beforeHooked).to.be.true;
        expect(afterHooked).to.be.true;
      });
    });

    describe('beforeDestroy / afterDestroy', () => {
      it('should pass a DAO instance to the hook', async function () {
        let beforeHooked = false;
        let afterHooked = false;
        const User = this.sequelize.define('User', {
          username: DataTypes.STRING,
        }, {
          hooks: {
            async beforeDestroy(user) {
              expect(user).to.be.instanceof(User);
              beforeHooked = true;
            },
            async afterDestroy(user) {
              expect(user).to.be.instanceof(User);
              afterHooked = true;
            },
          },
        });

        await User.sync({ force: true });
        const user = await User.create({ username: 'bob' });
        await user.destroy();
        expect(beforeHooked).to.be.true;
        expect(afterHooked).to.be.true;
      });
    });

    describe('beforeUpdate / afterUpdate', () => {
      it('should pass a DAO instance to the hook', async function () {
        let beforeHooked = false;
        let afterHooked = false;
        const User = this.sequelize.define('User', {
          username: DataTypes.STRING,
        }, {
          hooks: {
            async beforeUpdate(user) {
              expect(user).to.be.instanceof(User);
              beforeHooked = true;
            },
            async afterUpdate(user) {
              expect(user).to.be.instanceof(User);
              afterHooked = true;
            },
          },
        });

        await User.sync({ force: true });
        const user = await User.create({ username: 'bob' });
        user.username = 'bawb';
        await user.save({ fields: ['username'] });
        expect(beforeHooked).to.be.true;
        expect(afterHooked).to.be.true;
      });
    });
  });

  describe('Model#sync', () => {
    describe('on success', () => {
      it('should run hooks', async function () {
        const beforeHook = sinon.spy();
        const afterHook = sinon.spy();

        this.User.beforeSync(beforeHook);
        this.User.afterSync(afterHook);

        await this.User.sync();
        expect(beforeHook).to.have.been.calledOnce;
        expect(afterHook).to.have.been.calledOnce;
      });

      it('should not run hooks when "hooks = false" option passed', async function () {
        const beforeHook = sinon.spy();
        const afterHook = sinon.spy();

        this.User.beforeSync(beforeHook);
        this.User.afterSync(afterHook);

        await this.User.sync({ hooks: false });
        expect(beforeHook).to.not.have.been.called;
        expect(afterHook).to.not.have.been.called;
      });

    });

    describe('on error', () => {
      it('should return an error from before', async function () {
        const beforeHook = sinon.spy();
        const afterHook = sinon.spy();

        this.User.beforeSync(() => {
          beforeHook();
          throw new Error('Whoops!');
        });
        this.User.afterSync(afterHook);

        await expect(this.User.sync()).to.be.rejected;
        expect(beforeHook).to.have.been.calledOnce;
        expect(afterHook).not.to.have.been.called;
      });

      it('should return an error from after', async function () {
        const beforeHook = sinon.spy();
        const afterHook = sinon.spy();

        this.User.beforeSync(beforeHook);
        this.User.afterSync(() => {
          afterHook();
          throw new Error('Whoops!');
        });

        await expect(this.User.sync()).to.be.rejected;
        expect(beforeHook).to.have.been.calledOnce;
        expect(afterHook).to.have.been.calledOnce;
      });
    });
  });

  describe('sequelize#sync', () => {
    describe('on success', () => {
      it('should run hooks', async function () {
        const beforeHook = sinon.spy();
        const afterHook = sinon.spy();
        const modelBeforeHook = sinon.spy();
        const modelAfterHook = sinon.spy();

        this.sequelize.beforeBulkSync(beforeHook);
        this.User.beforeSync(modelBeforeHook);
        this.User.afterSync(modelAfterHook);
        this.sequelize.afterBulkSync(afterHook);

        await this.sequelize.sync();
        expect(beforeHook).to.have.been.calledOnce;
        expect(modelBeforeHook).to.have.been.calledOnce;
        expect(modelAfterHook).to.have.been.calledOnce;
        expect(afterHook).to.have.been.calledOnce;
      });

      it('should not run hooks if "hooks = false" option passed', async function () {
        const beforeHook = sinon.spy();
        const afterHook = sinon.spy();
        const modelBeforeHook = sinon.spy();
        const modelAfterHook = sinon.spy();

        this.sequelize.beforeBulkSync(beforeHook);
        this.User.beforeSync(modelBeforeHook);
        this.User.afterSync(modelAfterHook);
        this.sequelize.afterBulkSync(afterHook);

        await this.sequelize.sync({ hooks: false });
        expect(beforeHook).to.not.have.been.called;
        expect(modelBeforeHook).to.not.have.been.called;
        expect(modelAfterHook).to.not.have.been.called;
        expect(afterHook).to.not.have.been.called;
      });

      afterEach(function () {
        this.sequelize.hooks.removeAllListeners();
      });

    });

    describe('on error', () => {
      it('should return an error from before', async () => {
        const beforeHook = sinon.spy();
        const afterHook = sinon.spy();
        const tmpSequelize = Support.createSingleTestSequelizeInstance();

        tmpSequelize.beforeBulkSync(() => {
          beforeHook();
          throw new Error('Whoops!');
        });

        tmpSequelize.afterBulkSync(afterHook);

        await expect(tmpSequelize.sync()).to.be.rejectedWith('Whoops!');
        expect(beforeHook).to.have.been.calledOnce;
        expect(afterHook).not.to.have.been.called;
      });

      it('should return an error from after', async () => {
        const beforeHook = sinon.spy();
        const afterHook = sinon.spy();
        const tmpSequelize = Support.createSingleTestSequelizeInstance();

        tmpSequelize.beforeBulkSync(beforeHook);
        tmpSequelize.afterBulkSync(() => {
          afterHook();
          throw new Error('Whoops!');
        });

        await expect(tmpSequelize.sync()).to.be.rejectedWith('Whoops!');
        expect(beforeHook).to.have.been.calledOnce;
        expect(afterHook).to.have.been.calledOnce;
      });

      afterEach(function () {
        this.sequelize.hooks.removeAllListeners();
      });
    });
  });

  describe('Sequelize hooks', () => {
    it('should run before/afterPoolAcquire hooks', async function () {
      if (dialect === 'sqlite') {
        return this.skip();
      }

      const beforeHook = sinon.spy();
      const afterHook = sinon.spy();

      this.sequelize.addHook('beforePoolAcquire', beforeHook);
      this.sequelize.addHook('afterPoolAcquire', afterHook);

      await this.sequelize.authenticate();

      expect(beforeHook).to.have.been.calledOnce;
      expect(afterHook).to.have.been.calledOnce;

    });
  });

});
