'use strict';

const chai = require('chai'),
  sinon = require('sinon'),
  Sequelize = require('../../../index'),
  expect = chai.expect,
  Support = require(__dirname + '/../support'),
  DataTypes = require(__dirname + '/../../../lib/data-types'),
  config = require(__dirname + '/../../config/config'),
  current = Support.sequelize;

describe(Support.getTestDialectTeaser('Instance'), () => {
  before(function() {
    this.clock = sinon.useFakeTimers();
  });
  after(function() {
    this.clock.restore();
  });

  describe('update', () => {
    beforeEach(function() {
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
          set(val) {
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
        return Support.prepareTransactionTest(this.sequelize).bind({}).then(sequelize => {
          const User = sequelize.define('User', { username: Support.Sequelize.STRING });

          return User.sync({ force: true }).then(() => {
            return User.create({ username: 'foo' }).then(user => {
              return sequelize.transaction().then(t => {
                return user.update({ username: 'bar' }, { transaction: t }).then(() => {
                  return User.findAll().then(users1 => {
                    return User.findAll({ transaction: t }).then(users2 => {
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
      const User = this.sequelize.define('User' + config.rand(), {
        name: DataTypes.STRING,
        bio: DataTypes.TEXT,
        email: DataTypes.STRING
      });

      return User.sync({force: true}).then(() => {
        return User.create({
          name: 'snafu',
          email: 'email'
        }, {
          fields: ['name', 'email']
        }).then(user => {
          return user.update({bio: 'swag'});
        }).then(user => {
          return user.reload();
        }).then(user => {
          expect(user.get('name')).to.equal('snafu');
          expect(user.get('email')).to.equal('email');
          expect(user.get('bio')).to.equal('swag');
        });
      });
    });

    it('should succeed in updating when values are unchanged (without timestamps)', function() {
      const User = this.sequelize.define('User' + config.rand(), {
        name: DataTypes.STRING,
        bio: DataTypes.TEXT,
        email: DataTypes.STRING
      }, {
        timestamps: false
      });

      return User.sync({force: true}).then(() => {
        return User.create({
          name: 'snafu',
          email: 'email'
        }, {
          fields: ['name', 'email']
        }).then(user => {
          return user.update({
            name: 'snafu',
            email: 'email'
          });
        }).then(user => {
          return user.reload();
        }).then(user => {
          expect(user.get('name')).to.equal('snafu');
          expect(user.get('email')).to.equal('email');
        });
      });
    });

    it('should update timestamps with milliseconds', function() {
      const User = this.sequelize.define('User' + config.rand(), {
        name: DataTypes.STRING,
        bio: DataTypes.TEXT,
        email: DataTypes.STRING,
        createdAt: {type: DataTypes.DATE(6), allowNull: false},
        updatedAt: {type: DataTypes.DATE(6), allowNull: false}
      }, {
        timestamps: true
      });

      this.clock.tick(2100); //move the clock forward 2100 ms.

      return User.sync({force: true}).then(() => {
        return User.create({
          name: 'snafu',
          email: 'email'
        }).then(user => {
          return user.reload();
        }).then(user => {
          expect(user.get('name')).to.equal('snafu');
          expect(user.get('email')).to.equal('email');
          const testDate = new Date();
          testDate.setTime(2100);
          expect(user.get('createdAt')).to.equalTime(testDate);
        });
      });
    });

    it('should only save passed attributes', function() {
      const user = this.User.build();
      return user.save().then(() => {
        user.set('validateTest', 5);
        expect(user.changed('validateTest')).to.be.ok;
        return user.update({
          validateCustom: '1'
        });
      }).then(() => {
        expect(user.changed('validateTest')).to.be.ok;
        expect(user.validateTest).to.be.equal(5);
      }).then(() => {
        return user.reload();
      }).then(() => {
        expect(user.validateTest).to.not.be.equal(5);
      });
    });

    it('should save attributes affected by setters', function() {
      const user = this.User.build();
      return user.update({validateSideEffect: 5}).then(() => {
        expect(user.validateSideEffect).to.be.equal(5);
      }).then(() => {
        return user.reload();
      }).then(() => {
        expect(user.validateSideAffected).to.be.equal(10);
        expect(user.validateSideEffect).not.to.be.ok;
      });
    });

    describe('hooks', () => {
      it('should update attributes added in hooks when default fields are used', function() {
        const User = this.sequelize.define('User' + config.rand(), {
          name: DataTypes.STRING,
          bio: DataTypes.TEXT,
          email: DataTypes.STRING
        });

        User.beforeUpdate(instance => {
          instance.set('email', 'B');
        });

        return User.sync({force: true}).then(() => {
          return User.create({
            name: 'A',
            bio: 'A',
            email: 'A'
          }).then(user => {
            return user.update({
              name: 'B',
              bio: 'B'
            });
          }).then(() => {
            return User.findOne({});
          }).then(user => {
            expect(user.get('name')).to.equal('B');
            expect(user.get('bio')).to.equal('B');
            expect(user.get('email')).to.equal('B');
          });
        });
      });

      it('should update attributes changed in hooks when default fields are used', function() {
        const User = this.sequelize.define('User' + config.rand(), {
          name: DataTypes.STRING,
          bio: DataTypes.TEXT,
          email: DataTypes.STRING
        });

        User.beforeUpdate(instance => {
          instance.set('email', 'C');
        });

        return User.sync({force: true}).then(() => {
          return User.create({
            name: 'A',
            bio: 'A',
            email: 'A'
          }).then(user => {
            return user.update({
              name: 'B',
              bio: 'B',
              email: 'B'
            });
          }).then(() => {
            return User.findOne({});
          }).then(user => {
            expect(user.get('name')).to.equal('B');
            expect(user.get('bio')).to.equal('B');
            expect(user.get('email')).to.equal('C');
          });
        });
      });

      it('should validate attributes added in hooks when default fields are used', function() {
        const User = this.sequelize.define('User' + config.rand(), {
          name: DataTypes.STRING,
          bio: DataTypes.TEXT,
          email: {
            type: DataTypes.STRING,
            validate: {
              isEmail: true
            }
          }
        });

        User.beforeUpdate(instance => {
          instance.set('email', 'B');
        });

        return User.sync({force: true}).then(() => {
          return User.create({
            name: 'A',
            bio: 'A',
            email: 'valid.email@gmail.com'
          }).then(user => {
            return expect(user.update({
              name: 'B'
            })).to.be.rejectedWith(Sequelize.ValidationError);
          }).then(() => {
            return User.findOne({}).then(user => {
              expect(user.get('email')).to.equal('valid.email@gmail.com');
            });
          });
        });
      });

      it('should validate attributes changed in hooks when default fields are used', function() {
        const User = this.sequelize.define('User' + config.rand(), {
          name: DataTypes.STRING,
          bio: DataTypes.TEXT,
          email: {
            type: DataTypes.STRING,
            validate: {
              isEmail: true
            }
          }
        });

        User.beforeUpdate(instance => {
          instance.set('email', 'B');
        });

        return User.sync({force: true}).then(() => {
          return User.create({
            name: 'A',
            bio: 'A',
            email: 'valid.email@gmail.com'
          }).then(user => {
            return expect(user.update({
              name: 'B',
              email: 'still.valid.email@gmail.com'
            })).to.be.rejectedWith(Sequelize.ValidationError);
          }).then(() => {
            return User.findOne({}).then(user => {
              expect(user.get('email')).to.equal('valid.email@gmail.com');
            });
          });
        });
      });
    });

    it('should not set attributes that are not specified by fields', function() {
      const User = this.sequelize.define('User' + config.rand(), {
        name: DataTypes.STRING,
        bio: DataTypes.TEXT,
        email: DataTypes.STRING
      });

      return User.sync({force: true}).then(() => {
        return User.create({
          name: 'snafu',
          email: 'email'
        }).then(user => {
          return user.update({
            bio: 'heyo',
            email: 'heho'
          }, {
            fields: ['bio']
          });
        }).then(user => {
          expect(user.get('name')).to.equal('snafu');
          expect(user.get('email')).to.equal('email');
          expect(user.get('bio')).to.equal('heyo');
        });
      });
    });

    it('updates attributes in the database', function() {
      return this.User.create({ username: 'user' }).then(user => {
        expect(user.username).to.equal('user');
        return user.update({ username: 'person' }).then(user => {
          expect(user.username).to.equal('person');
        });
      });
    });

    it('ignores unknown attributes', function() {
      return this.User.create({ username: 'user' }).then(user => {
        return user.update({ username: 'person', foo: 'bar'}).then(user => {
          expect(user.username).to.equal('person');
          expect(user.foo).not.to.exist;
        });
      });
    });

    it('doesn\'t update primary keys or timestamps', function() {
      const User = this.sequelize.define('User' + config.rand(), {
        name: DataTypes.STRING,
        bio: DataTypes.TEXT,
        identifier: {type: DataTypes.STRING, primaryKey: true}
      });

      return User.sync({ force: true }).bind(this).then(() => {
        return User.create({
          name: 'snafu',
          identifier: 'identifier'
        });
      }).then(function(user) {
        const oldCreatedAt = user.createdAt,
          oldUpdatedAt = user.updatedAt,
          oldIdentifier = user.identifier;

        this.clock.tick(1000);
        return user.update({
          name: 'foobar',
          createdAt: new Date(2000, 1, 1),
          identifier: 'another identifier'
        }).then(user => {
          expect(new Date(user.createdAt)).to.equalDate(new Date(oldCreatedAt));
          expect(new Date(user.updatedAt)).to.not.equalTime(new Date(oldUpdatedAt));
          expect(user.identifier).to.equal(oldIdentifier);
        });
      });
    });

    it('stores and restores null values', function() {
      const Download = this.sequelize.define('download', {
        startedAt: DataTypes.DATE,
        canceledAt: DataTypes.DATE,
        finishedAt: DataTypes.DATE
      });

      return Download.sync().then(() => {
        return Download.create({
          startedAt: new Date()
        }).then(download => {
          expect(download.startedAt instanceof Date).to.be.true;
          expect(download.canceledAt).to.not.be.ok;
          expect(download.finishedAt).to.not.be.ok;

          return download.update({
            canceledAt: new Date()
          }).then(download => {
            expect(download.startedAt instanceof Date).to.be.true;
            expect(download.canceledAt instanceof Date).to.be.true;
            expect(download.finishedAt).to.not.be.ok;

            return Download.findAll({
              where: {finishedAt: null}
            }).then(downloads => {
              downloads.forEach(download => {
                expect(download.startedAt instanceof Date).to.be.true;
                expect(download.canceledAt instanceof Date).to.be.true;
                expect(download.finishedAt).to.not.be.ok;
              });
            });
          });
        });
      });
    });

    it('should support logging', function() {
      const spy = sinon.spy();

      return this.User.create({}).then(user => {
        return user.update({username: 'yolo'}, {logging: spy}).then(() => {
          expect(spy.called).to.be.ok;
        });
      });
    });
  });
});
