'use strict';

const chai = require('chai'),
  expect = chai.expect,
  Support = require('../support'),
  DataTypes = require('../../../lib/data-types'),
  Sequelize = Support.Sequelize,
  dialect = Support.getTestDialect(),
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

  describe('#define', () => {
    before(function() {
      this.sequelize.hooks.add('beforeDefine', (attributes, options) => {
        options.modelName = 'bar';
        options.name.plural = 'barrs';
        attributes.type = DataTypes.STRING;
      });

      this.sequelize.hooks.add('afterDefine', factory => {
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
      this.sequelize.hooks.removeAll();
      this.sequelize.modelManager.removeModel(this.model);
    });
  });

  describe('#init', () => {
    before(function() {
      Sequelize.hooks.add('beforeInit', (config, options) => {
        config.database = 'db2';
        options.host = 'server9';
      });

      Sequelize.hooks.add('afterInit', sequelize => {
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
      Sequelize.hooks.removeAll();
    });
  });

  describe('passing DAO instances', () => {
    describe('beforeValidate / afterValidate', () => {
      it('should pass a DAO instance to the hook', function() {
        let beforeHooked = false;
        let afterHooked = false;
        const User = this.sequelize.define('User', {
          username: DataTypes.STRING
        }, {
          hooks: {
            beforeValidate(user) {
              expect(user).to.be.instanceof(User);
              beforeHooked = true;
              return Promise.resolve();
            },
            afterValidate(user) {
              expect(user).to.be.instanceof(User);
              afterHooked = true;
              return Promise.resolve();
            }
          }
        });

        return User.sync({ force: true }).then(() => {
          return User.create({ username: 'bob' }).then(() => {
            expect(beforeHooked).to.be.true;
            expect(afterHooked).to.be.true;
          });
        });
      });
    });

    describe('beforeCreate / afterCreate', () => {
      it('should pass a DAO instance to the hook', function() {
        let beforeHooked = false;
        let afterHooked = false;
        const User = this.sequelize.define('User', {
          username: DataTypes.STRING
        }, {
          hooks: {
            beforeCreate(user) {
              expect(user).to.be.instanceof(User);
              beforeHooked = true;
              return Promise.resolve();
            },
            afterCreate(user) {
              expect(user).to.be.instanceof(User);
              afterHooked = true;
              return Promise.resolve();
            }
          }
        });

        return User.sync({ force: true }).then(() => {
          return User.create({ username: 'bob' }).then(() => {
            expect(beforeHooked).to.be.true;
            expect(afterHooked).to.be.true;
          });
        });
      });
    });

    describe('beforeDestroy / afterDestroy', () => {
      it('should pass a DAO instance to the hook', function() {
        let beforeHooked = false;
        let afterHooked = false;
        const User = this.sequelize.define('User', {
          username: DataTypes.STRING
        }, {
          hooks: {
            beforeDestroy(user) {
              expect(user).to.be.instanceof(User);
              beforeHooked = true;
              return Promise.resolve();
            },
            afterDestroy(user) {
              expect(user).to.be.instanceof(User);
              afterHooked = true;
              return Promise.resolve();
            }
          }
        });

        return User.sync({ force: true }).then(() => {
          return User.create({ username: 'bob' }).then(user => {
            return user.destroy().then(() => {
              expect(beforeHooked).to.be.true;
              expect(afterHooked).to.be.true;
            });
          });
        });
      });
    });

    describe('beforeUpdate / afterUpdate', () => {
      it('should pass a DAO instance to the hook', function() {
        let beforeHooked = false;
        let afterHooked = false;
        const User = this.sequelize.define('User', {
          username: DataTypes.STRING
        }, {
          hooks: {
            beforeUpdate(user) {
              expect(user).to.be.instanceof(User);
              beforeHooked = true;
              return Promise.resolve();
            },
            afterUpdate(user) {
              expect(user).to.be.instanceof(User);
              afterHooked = true;
              return Promise.resolve();
            }
          }
        });

        return User.sync({ force: true }).then(() => {
          return User.create({ username: 'bob' }).then(user => {
            user.username = 'bawb';
            return user.save({ fields: ['username'] }).then(() => {
              expect(beforeHooked).to.be.true;
              expect(afterHooked).to.be.true;
            });
          });
        });
      });
    });
  });

  describe('Model#sync', () => {
    describe('on success', () => {
      it('should run hooks', function() {
        const beforeHook = sinon.spy(),
          afterHook = sinon.spy();

        this.User.hooks.add('beforeSync', beforeHook);
        this.User.hooks.add('afterSync', afterHook);

        return this.User.sync().then(() => {
          expect(beforeHook).to.have.been.calledOnce;
          expect(afterHook).to.have.been.calledOnce;
        });
      });

      it('should not run hooks when "hooks = false" option passed', function() {
        const beforeHook = sinon.spy(),
          afterHook = sinon.spy();

        this.User.hooks.add('beforeSync', beforeHook);
        this.User.hooks.add('afterSync', afterHook);

        return this.User.sync({ hooks: false }).then(() => {
          expect(beforeHook).to.not.have.been.called;
          expect(afterHook).to.not.have.been.called;
        });
      });

    });

    describe('on error', () => {
      it('should return an error from before', function() {
        const beforeHook = sinon.spy(),
          afterHook = sinon.spy();

        this.User.hooks.add('beforeSync', () => {
          beforeHook();
          throw new Error('Whoops!');
        });
        this.User.hooks.add('afterSync', afterHook);

        return expect(this.User.sync()).to.be.rejected.then(() => {
          expect(beforeHook).to.have.been.calledOnce;
          expect(afterHook).not.to.have.been.called;
        });
      });

      it('should return an error from after', function() {
        const beforeHook = sinon.spy(),
          afterHook = sinon.spy();

        this.User.hooks.add('beforeSync', beforeHook);
        this.User.hooks.add('afterSync', () => {
          afterHook();
          throw new Error('Whoops!');
        });

        return expect(this.User.sync()).to.be.rejected.then(() => {
          expect(beforeHook).to.have.been.calledOnce;
          expect(afterHook).to.have.been.calledOnce;
        });
      });
    });
  });

  describe('sequelize#sync', () => {
    describe('on success', () => {
      it('should run hooks', function() {
        const beforeHook = sinon.spy(),
          afterHook = sinon.spy(),
          modelBeforeHook = sinon.spy(),
          modelAfterHook = sinon.spy();

        this.sequelize.hooks.add('beforeBulkSync', beforeHook);
        this.User.hooks.add('beforeSync', modelBeforeHook);
        this.User.hooks.add('afterSync', modelAfterHook);
        this.sequelize.hooks.add('afterBulkSync', afterHook);

        return this.sequelize.sync().then(() => {
          expect(beforeHook).to.have.been.calledOnce;
          expect(modelBeforeHook).to.have.been.calledOnce;
          expect(modelAfterHook).to.have.been.calledOnce;
          expect(afterHook).to.have.been.calledOnce;
        });
      });

      it('should not run hooks if "hooks = false" option passed', function() {
        const beforeHook = sinon.spy(),
          afterHook = sinon.spy(),
          modelBeforeHook = sinon.spy(),
          modelAfterHook = sinon.spy();

        this.sequelize.hooks.add('beforeBulkSync', beforeHook);
        this.User.hooks.add('beforeSync', modelBeforeHook);
        this.User.hooks.add('afterSync', modelAfterHook);
        this.sequelize.hooks.add('afterBulkSync', afterHook);

        return this.sequelize.sync({ hooks: false }).then(() => {
          expect(beforeHook).to.not.have.been.called;
          expect(modelBeforeHook).to.not.have.been.called;
          expect(modelAfterHook).to.not.have.been.called;
          expect(afterHook).to.not.have.been.called;
        });
      });

      afterEach(function() {
        this.sequelize.hooks.removeAll();
      });

    });

    describe('on error', () => {

      it('should return an error from before', function() {
        const beforeHook = sinon.spy(),
          afterHook = sinon.spy();
        this.sequelize.hooks.add('beforeBulkSync', () => {
          beforeHook();
          throw new Error('Whoops!');
        });
        this.sequelize.hooks.add('afterBulkSync', afterHook);

        return expect(this.sequelize.sync()).to.be.rejected.then(() => {
          expect(beforeHook).to.have.been.calledOnce;
          expect(afterHook).not.to.have.been.called;
        });
      });

      it('should return an error from after', function() {
        const beforeHook = sinon.spy(),
          afterHook = sinon.spy();

        this.sequelize.hooks.add('beforeBulkSync', beforeHook);
        this.sequelize.hooks.add('afterBulkSync', () => {
          afterHook();
          throw new Error('Whoops!');
        });

        return expect(this.sequelize.sync()).to.be.rejected.then(() => {
          expect(beforeHook).to.have.been.calledOnce;
          expect(afterHook).to.have.been.calledOnce;
        });
      });

      afterEach(function() {
        this.sequelize.hooks.removeAll();
      });

    });
  });

  describe('#removal', () => {
    it('should be able to remove by reference', function() {
      const sasukeHook = sinon.spy(),
        narutoHook = sinon.spy();

      this.User.hooks.add('beforeCreate', sasukeHook);
      this.User.hooks.add('beforeCreate', narutoHook);

      return this.User.create({ username: 'makunouchi' }).then(() => {
        expect(sasukeHook).to.have.been.calledOnce;
        expect(narutoHook).to.have.been.calledOnce;
        this.User.hooks.remove('beforeCreate', sasukeHook);
        return this.User.create({ username: 'sendo' });
      }).then(() => {
        expect(sasukeHook).to.have.been.calledOnce;
        expect(narutoHook).to.have.been.calledTwice;
      });
    });

    it('should be able to remove proxies', function() {
      const sasukeHook = sinon.spy(),
        narutoHook = sinon.spy();

      this.User.hooks.add('beforeSave', sasukeHook);
      this.User.hooks.add('beforeSave', narutoHook);

      return this.User.create({ username: 'makunouchi' }).then(user => {
        expect(sasukeHook).to.have.been.calledOnce;
        expect(narutoHook).to.have.been.calledOnce;
        this.User.hooks.remove('beforeSave', sasukeHook);
        return user.update({ username: 'sendo' });
      }).then(() => {
        expect(sasukeHook).to.have.been.calledOnce;
        expect(narutoHook).to.have.been.calledTwice;
      });
    });
  });
});
