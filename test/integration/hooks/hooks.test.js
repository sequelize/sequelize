'use strict';

/* jshint -W030 */
var chai = require('chai')
  , expect = chai.expect
  , Support = require(__dirname + '/../support')
  , DataTypes = require(__dirname + '/../../../lib/data-types')
  , Sequelize = Support.Sequelize
  , sinon = require('sinon');

describe(Support.getTestDialectTeaser('Hooks'), function() {
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
