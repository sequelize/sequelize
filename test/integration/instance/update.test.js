'use strict';

var chai = require('chai')
  , sinon = require('sinon')
  , Sequelize = require('../../../index')
  , expect = chai.expect
  , Support = require(__dirname + '/../support')
  , dialect = Support.getTestDialect()
  , DataTypes = require(__dirname + '/../../../lib/data-types')
  , datetime = require('chai-datetime')
  , config = require(__dirname + '/../../config/config')
  , current = Support.sequelize;

chai.use(datetime);
chai.config.includeStack = true;

describe(Support.getTestDialectTeaser('Instance'), function() {
  describe('update', function() {
    beforeEach(function () {
      this.User = this.sequelize.define('User', {
        username: { type: DataTypes.STRING },
        uuidv1: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV1 },
        uuidv4: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4 },
        touchedAt: { type: DataTypes.DATE, defaultValue: DataTypes.NOW },
        aNumber: { type: DataTypes.INTEGER },
        bNumber: { type: DataTypes.INTEGER },
        aDate: { type: DataTypes.DATE },

        validateTest: {
          type: DataTypes.INTEGER,
          allowNull: true,
          validate: {isInt: true}
        },
        validateCustom: {
          type: DataTypes.STRING,
          allowNull: true,
          validate: {len: {msg: 'Length failed.', args: [1, 20]}}
        },
        validateSideEffect: {
          type: DataTypes.VIRTUAL,
          allowNull: true,
          validate: {isInt: true},
          set: function (val) {
            this.setDataValue('validateSideEffect', val);
            this.setDataValue('validateSideAffected', val*2);
          }
        },
        validateSideAffected: {
          type: DataTypes.INTEGER,
          allowNull: true,
          validate: {isInt: true}
        },

        dateAllowNullTrue: {
          type: DataTypes.DATE,
          allowNull: true
        }
      });
      return this.User.sync({ force: true });
    });

    if (current.dialect.supports.transactions) {
      it('supports transactions', function() {
        return Support.prepareTransactionTest(this.sequelize).bind({}).then(function(sequelize) {
          var User = sequelize.define('User', { username: Support.Sequelize.STRING });

          return User.sync({ force: true }).then(function() {
            return User.create({ username: 'foo' }).then(function(user) {
              return sequelize.transaction().then(function(t) {
                return user.update({ username: 'bar' }, { transaction: t }).then(function() {
                  return User.findAll().then(function(users1) {
                    return User.findAll({ transaction: t }).then(function(users2) {
                      expect(users1[0].username).to.equal('foo');
                      expect(users2[0].username).to.equal('bar');
                      return t.rollback();
                    });
                  });
                });
              });
            });
          });
        });
      });
    }

    it('should update fields that are not specified on create', function() {
      var User = this.sequelize.define('User' + config.rand(), {
        name: DataTypes.STRING,
        bio: DataTypes.TEXT,
        email: DataTypes.STRING
      });

     return User.sync({force: true}).then(function() {
        return User.create({
          name: 'snafu',
          email: 'email'
        }, {
          fields: ['name', 'email']
        }).then(function(user) {
          return user.update({bio: 'swag'});
        }).then(function(user) {
          return user.reload();
        }).then(function(user) {
          expect(user.get('name')).to.equal('snafu');
          expect(user.get('email')).to.equal('email');
          expect(user.get('bio')).to.equal('swag');
        });
      });
    });

    it('should succeed in updating when values are unchanged (without timestamps)', function() {
      var User = this.sequelize.define('User' + config.rand(), {
        name: DataTypes.STRING,
        bio: DataTypes.TEXT,
        email: DataTypes.STRING
      }, {
        timestamps: false
      });

     return User.sync({force: true}).then(function() {
        return User.create({
          name: 'snafu',
          email: 'email'
        }, {
          fields: ['name', 'email']
        }).then(function(user) {
          return user.update({
            name: 'snafu',
            email: 'email'
          });
        }).then(function(user) {
          return user.reload();
        }).then(function(user) {
          expect(user.get('name')).to.equal('snafu');
          expect(user.get('email')).to.equal('email');
        });
      });
    });

    it('should only save passed attributes', function () {
      var user = this.User.build();
      return user.save().then(function () {
        user.set('validateTest', 5);
        expect(user.changed('validateTest')).to.be.ok;
        return user.update({
          validateCustom: '1'
        });
      }).then(function () {
        expect(user.changed('validateTest')).to.be.ok;
        expect(user.validateTest).to.be.equal(5);
      }).then(function () {
        return user.reload();
      }).then(function () {
        expect(user.validateTest).to.not.be.equal(5);
      });
    });

    it('should save attributes affected by setters', function () {
      var user = this.User.build();
      return user.update({validateSideEffect: 5}).then(function () {
        expect(user.validateSideEffect).to.be.equal(5);
      }).then(function () {
        return user.reload();
      }).then(function () {
        expect(user.validateSideAffected).to.be.equal(10);
        expect(user.validateSideEffect).not.to.be.ok;
      });
    });

    describe('hooks', function () {
      it('should update attributes added in hooks when default fields are used', function () {
        var User = this.sequelize.define('User' + config.rand(), {
          name: DataTypes.STRING,
          bio: DataTypes.TEXT,
          email: DataTypes.STRING
        });

        User.beforeUpdate(function(instance, options) {
          instance.set('email', 'B');
        });

        return User.sync({force: true}).then(function() {
          return User.create({
            name: 'A',
            bio: 'A',
            email: 'A'
          }).then(function (user) {
            return user.update({
              name: 'B',
              bio: 'B'
            });
          }).then(function () {
            return User.findOne({});
          }).then(function (user) {
            expect(user.get('name')).to.equal('B');
            expect(user.get('bio')).to.equal('B');
            expect(user.get('email')).to.equal('B');
          });
        });
      });

      it('should update attributes changed in hooks when default fields are used', function () {
        var User = this.sequelize.define('User' + config.rand(), {
          name: DataTypes.STRING,
          bio: DataTypes.TEXT,
          email: DataTypes.STRING
        });

        User.beforeUpdate(function(instance, options) {
          instance.set('email', 'C');
        });

        return User.sync({force: true}).then(function() {
          return User.create({
            name: 'A',
            bio: 'A',
            email: 'A'
          }).then(function (user) {
            return user.update({
              name: 'B',
              bio: 'B',
              email: 'B'
            });
          }).then(function () {
            return User.findOne({});
          }).then(function (user) {
            expect(user.get('name')).to.equal('B');
            expect(user.get('bio')).to.equal('B');
            expect(user.get('email')).to.equal('C');
          });
        });
      });

      it('should validate attributes added in hooks when default fields are used', function () {
        var User = this.sequelize.define('User' + config.rand(), {
          name: DataTypes.STRING,
          bio: DataTypes.TEXT,
          email: {
            type: DataTypes.STRING,
            validate: {
              isEmail: true
            }
          }
        });

        User.beforeUpdate(function(instance, options) {
          instance.set('email', 'B');
        });

        return User.sync({force: true}).then(function () {
          return User.create({
            name: 'A',
            bio: 'A',
            email: 'valid.email@gmail.com'
          }).then(function (user) {
            return expect(user.update({
              name: 'B'
            })).to.be.rejectedWith(Sequelize.ValidationError);
          }).then(function () {
            return User.findOne({}).then(function (user) {
              expect(user.get('email')).to.equal('valid.email@gmail.com');
            });
          });
        });
      });

      it('should validate attributes changed in hooks when default fields are used', function () {
        var User = this.sequelize.define('User' + config.rand(), {
          name: DataTypes.STRING,
          bio: DataTypes.TEXT,
          email: {
            type: DataTypes.STRING,
            validate: {
              isEmail: true
            }
          }
        });

        User.beforeUpdate(function(instance, options) {
          instance.set('email', 'B');
        });

        return User.sync({force: true}).then(function () {
          return User.create({
            name: 'A',
            bio: 'A',
            email: 'valid.email@gmail.com'
          }).then(function (user) {
            return expect(user.update({
              name: 'B',
              email: 'still.valid.email@gmail.com'
            })).to.be.rejectedWith(Sequelize.ValidationError);
          }).then(function () {
            return User.findOne({}).then(function (user) {
              expect(user.get('email')).to.equal('valid.email@gmail.com');
            });
          });
        });
      });
    });

    it('should not set attributes that are not specified by fields', function () {
      var User = this.sequelize.define('User' + config.rand(), {
        name: DataTypes.STRING,
        bio: DataTypes.TEXT,
        email: DataTypes.STRING
      });

     return User.sync({force: true}).then(function() {
        return User.create({
          name: 'snafu',
          email: 'email'
        }).then(function(user) {
          return user.update({
            bio: 'heyo',
            email: 'heho'
          }, {
            fields: ['bio']
          });
        }).then(function(user) {
          expect(user.get('name')).to.equal('snafu');
          expect(user.get('email')).to.equal('email');
          expect(user.get('bio')).to.equal('heyo');
        });
      });
    });

    it('updates attributes in the database', function() {
      return this.User.create({ username: 'user' }).then(function(user) {
        expect(user.username).to.equal('user');
        return user.update({ username: 'person' }).then(function(user) {
          expect(user.username).to.equal('person');
        });
      });
    });

    it('ignores unknown attributes', function() {
      return this.User.create({ username: 'user' }).then(function(user) {
        return user.update({ username: 'person', foo: 'bar'}).then(function(user) {
          expect(user.username).to.equal('person');
          expect(user.foo).not.to.exist;
        });
      });
    });

    it("doesn't update primary keys or timestamps", function() {
      var User = this.sequelize.define('User' + config.rand(), {
        name: DataTypes.STRING,
        bio: DataTypes.TEXT,
        identifier: {type: DataTypes.STRING, primaryKey: true}
      });

      return User.sync({ force: true }).then(function() {
        return User.create({
          name: 'snafu',
          identifier: 'identifier'
        }).then(function(user) {
          var oldCreatedAt = user.createdAt
            , oldUpdatedAt = user.updatedAt
            , oldIdentifier = user.identifier;

          return this.sequelize.Promise.delay(1000).then(function() {
            return user.update({
              name: 'foobar',
              createdAt: new Date(2000, 1, 1),
              identifier: 'another identifier'
            }).then(function(user) {
              expect(new Date(user.createdAt)).to.equalDate(new Date(oldCreatedAt));
              expect(new Date(user.updatedAt)).to.not.equalTime(new Date(oldUpdatedAt));
              expect(user.identifier).to.equal(oldIdentifier);
            });
          });
        });
      });
    });

    it('stores and restores null values', function() {
      var Download = this.sequelize.define('download', {
        startedAt: DataTypes.DATE,
        canceledAt: DataTypes.DATE,
        finishedAt: DataTypes.DATE
      });

      return Download.sync().then(function() {
        return Download.create({
          startedAt: new Date()
        }).then(function(download) {
          expect(download.startedAt instanceof Date).to.be.true;
          expect(download.canceledAt).to.not.be.ok;
          expect(download.finishedAt).to.not.be.ok;

          return download.update({
            canceledAt: new Date()
          }).then(function(download) {
            expect(download.startedAt instanceof Date).to.be.true;
            expect(download.canceledAt instanceof Date).to.be.true;
            expect(download.finishedAt).to.not.be.ok;

            return Download.findAll({
              where: (dialect === 'postgres' || dialect === 'mssql' ? '"finishedAt" IS NULL' : '`finishedAt` IS NULL')
            }).then(function(downloads) {
              downloads.forEach(function(download) {
                expect(download.startedAt instanceof Date).to.be.true;
                expect(download.canceledAt instanceof Date).to.be.true;
                expect(download.finishedAt).to.not.be.ok;
              });
            });
          });
        });
      });
    });

    it('should support logging', function () {
      var spy = sinon.spy();

      return this.User.create({}).then(function (user) {
        return user.update({username: 'yolo'}, {logging: spy}).then(function () {
          expect(spy.called).to.be.ok;
        });
      });
    });
  });
});
