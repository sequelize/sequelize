'use strict';

const chai = require('chai'),
  expect = chai.expect,
  Support = require('../support'),
  DataTypes = require('sequelize/lib/data-types'),
  Sequelize = Support.Sequelize,
  dialect = Support.getTestDialect(),
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

  describe('#define', () => {
    before(function() {
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

  describe('#init', () => {
    before(function() {
      Sequelize.addHook('beforeInit', (config, options) => {
        config.database = 'db2';
        options.host = 'server9';
      });

      Sequelize.addHook('afterInit', sequelize => {
        sequelize.options.protocol = 'udp';
      });

      this.seq = new Sequelize('db', 'user', 'pass', { dialect });
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

    after(() => {
      Sequelize.options.hooks = {};
    });
  });

  describe('passing DAO instances', () => {
    describe('beforeValidate / afterValidate', () => {
      it('should pass a DAO instance to the hook', async function() {
        let beforeHooked = false;
        let afterHooked = false;
        const User = this.sequelize.define('User', {
          username: DataTypes.STRING
        }, {
          hooks: {
            async beforeValidate(user) {
              expect(user).to.be.instanceof(User);
              beforeHooked = true;
            },
            async afterValidate(user) {
              expect(user).to.be.instanceof(User);
              afterHooked = true;
            }
          }
        });

        await User.sync({ force: true });
        await User.create({ username: 'bob' });
        expect(beforeHooked).to.be.true;
        expect(afterHooked).to.be.true;
      });
    });

    describe('beforeCreate / afterCreate', () => {
      it('should pass a DAO instance to the hook', async function() {
        let beforeHooked = false;
        let afterHooked = false;
        const User = this.sequelize.define('User', {
          username: DataTypes.STRING
        }, {
          hooks: {
            async beforeCreate(user) {
              expect(user).to.be.instanceof(User);
              beforeHooked = true;
            },
            async afterCreate(user) {
              expect(user).to.be.instanceof(User);
              afterHooked = true;
            }
          }
        });

        await User.sync({ force: true });
        await User.create({ username: 'bob' });
        expect(beforeHooked).to.be.true;
        expect(afterHooked).to.be.true;
      });
    });

    describe('beforeDestroy / afterDestroy', () => {
      it('should pass a DAO instance to the hook', async function() {
        let beforeHooked = false;
        let afterHooked = false;
        const User = this.sequelize.define('User', {
          username: DataTypes.STRING
        }, {
          hooks: {
            async beforeDestroy(user) {
              expect(user).to.be.instanceof(User);
              beforeHooked = true;
            },
            async afterDestroy(user) {
              expect(user).to.be.instanceof(User);
              afterHooked = true;
            }
          }
        });

        await User.sync({ force: true });
        const user = await User.create({ username: 'bob' });
        await user.destroy();
        expect(beforeHooked).to.be.true;
        expect(afterHooked).to.be.true;
      });
    });

    describe('beforeUpdate / afterUpdate', () => {
      it('should pass a DAO instance to the hook', async function() {
        let beforeHooked = false;
        let afterHooked = false;
        const User = this.sequelize.define('User', {
          username: DataTypes.STRING
        }, {
          hooks: {
            async beforeUpdate(user) {
              expect(user).to.be.instanceof(User);
              beforeHooked = true;
            },
            async afterUpdate(user) {
              expect(user).to.be.instanceof(User);
              afterHooked = true;
            }
          }
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
      it('should run hooks', async function() {
        const beforeHook = sinon.spy(),
          afterHook = sinon.spy();

        this.User.beforeSync(beforeHook);
        this.User.afterSync(afterHook);

        await this.User.sync();
        expect(beforeHook).to.have.been.calledOnce;
        expect(afterHook).to.have.been.calledOnce;
      });

      it('should not run hooks when "hooks = false" option passed', async function() {
        const beforeHook = sinon.spy(),
          afterHook = sinon.spy();

        this.User.beforeSync(beforeHook);
        this.User.afterSync(afterHook);

        await this.User.sync({ hooks: false });
        expect(beforeHook).to.not.have.been.called;
        expect(afterHook).to.not.have.been.called;
      });

    });

    describe('on error', () => {
      it('should return an error from before', async function() {
        const beforeHook = sinon.spy(),
          afterHook = sinon.spy();

        this.User.beforeSync(() => {
          beforeHook();
          throw new Error('Whoops!');
        });
        this.User.afterSync(afterHook);

        await expect(this.User.sync()).to.be.rejected;
        expect(beforeHook).to.have.been.calledOnce;
        expect(afterHook).not.to.have.been.called;
      });

      it('should return an error from after', async function() {
        const beforeHook = sinon.spy(),
          afterHook = sinon.spy();

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
      it('should run hooks', async function() {
        const beforeHook = sinon.spy(),
          afterHook = sinon.spy(),
          modelBeforeHook = sinon.spy(),
          modelAfterHook = sinon.spy();

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

      it('should not run hooks if "hooks = false" option passed', async function() {
        const beforeHook = sinon.spy(),
          afterHook = sinon.spy(),
          modelBeforeHook = sinon.spy(),
          modelAfterHook = sinon.spy();

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

      afterEach(function() {
        this.sequelize.options.hooks = {};
      });

    });

    describe('on error', () => {

      it('should return an error from before', async function() {
        const beforeHook = sinon.spy(),
          afterHook = sinon.spy();
        this.sequelize.beforeBulkSync(() => {
          beforeHook();
          throw new Error('Whoops!');
        });
        this.sequelize.afterBulkSync(afterHook);

        await expect(this.sequelize.sync()).to.be.rejected;
        expect(beforeHook).to.have.been.calledOnce;
        expect(afterHook).not.to.have.been.called;
      });

      it('should return an error from after', async function() {
        const beforeHook = sinon.spy(),
          afterHook = sinon.spy();

        this.sequelize.beforeBulkSync(beforeHook);
        this.sequelize.afterBulkSync(() => {
          afterHook();
          throw new Error('Whoops!');
        });

        await expect(this.sequelize.sync()).to.be.rejected;
        expect(beforeHook).to.have.been.calledOnce;
        expect(afterHook).to.have.been.calledOnce;
      });

      afterEach(function() {
        this.sequelize.options.hooks = {};
      });

    });
  });

  describe('#removal', () => {
    it('should be able to remove by name', async function() {
      const sasukeHook = sinon.spy(),
        narutoHook = sinon.spy();

      this.User.addHook('beforeCreate', 'sasuke', sasukeHook);
      this.User.addHook('beforeCreate', 'naruto', narutoHook);

      await this.User.create({ username: 'makunouchi' });
      expect(sasukeHook).to.have.been.calledOnce;
      expect(narutoHook).to.have.been.calledOnce;
      this.User.removeHook('beforeCreate', 'sasuke');
      await this.User.create({ username: 'sendo' });
      expect(sasukeHook).to.have.been.calledOnce;
      expect(narutoHook).to.have.been.calledTwice;
    });

    it('should be able to remove by reference', async function() {
      const sasukeHook = sinon.spy(),
        narutoHook = sinon.spy();

      this.User.addHook('beforeCreate', sasukeHook);
      this.User.addHook('beforeCreate', narutoHook);

      await this.User.create({ username: 'makunouchi' });
      expect(sasukeHook).to.have.been.calledOnce;
      expect(narutoHook).to.have.been.calledOnce;
      this.User.removeHook('beforeCreate', sasukeHook);
      await this.User.create({ username: 'sendo' });
      expect(sasukeHook).to.have.been.calledOnce;
      expect(narutoHook).to.have.been.calledTwice;
    });

    it('should be able to remove proxies', async function() {
      const sasukeHook = sinon.spy(),
        narutoHook = sinon.spy();

      this.User.addHook('beforeSave', sasukeHook);
      this.User.addHook('beforeSave', narutoHook);

      const user = await this.User.create({ username: 'makunouchi' });
      expect(sasukeHook).to.have.been.calledOnce;
      expect(narutoHook).to.have.been.calledOnce;
      this.User.removeHook('beforeSave', sasukeHook);
      await user.update({ username: 'sendo' });
      expect(sasukeHook).to.have.been.calledOnce;
      expect(narutoHook).to.have.been.calledTwice;
    });
  });

  describe('Sequelize hooks', () => {
    it('should run before/afterPoolAcquire hooks', async function() {
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
