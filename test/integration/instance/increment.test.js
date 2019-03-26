'use strict';

const chai = require('chai'),
  expect = chai.expect,
  Sequelize = require('../../../index'),
  Support = require('../support'),
  DataTypes = require('../../../lib/data-types'),
  sinon = require('sinon'),
  current = Support.sequelize;

describe(Support.getTestDialectTeaser('Instance'), () => {
  before(function() {
    this.clock = sinon.useFakeTimers();
  });

  afterEach(function() {
    this.clock.reset();
  });

  after(function() {
    this.clock.restore();
  });

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
        validate: { isInt: true }
      },
      validateCustom: {
        type: DataTypes.STRING,
        allowNull: true,
        validate: { len: { msg: 'Length failed.', args: [1, 20] } }
      },

      dateAllowNullTrue: {
        type: DataTypes.DATE,
        allowNull: true
      },

      isSuperUser: {
        type: DataTypes.BOOLEAN,
        defaultValue: false
      }
    });

    return this.User.sync({ force: true });
  });

  describe('increment', () => {
    beforeEach(function() {
      return this.User.create({ id: 1, aNumber: 0, bNumber: 0 });
    });

    if (current.dialect.supports.transactions) {
      it('supports transactions', function() {
        return Support.prepareTransactionTest(this.sequelize).then(sequelize => {
          const User = sequelize.define('User', { number: Support.Sequelize.INTEGER });

          return User.sync({ force: true }).then(() => {
            return User.create({ number: 1 }).then(user => {
              return sequelize.transaction().then(t => {
                return user.increment('number', { by: 2, transaction: t }).then(() => {
                  return User.findAll().then(users1 => {
                    return User.findAll({ transaction: t }).then(users2 => {
                      expect(users1[0].number).to.equal(1);
                      expect(users2[0].number).to.equal(3);
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

    if (current.dialect.supports.returnValues.returning) {
      it('supports returning', function() {
        return this.User.findByPk(1).then(user1 => {
          return user1.increment('aNumber', { by: 2 }).then(() => {
            expect(user1.aNumber).to.be.equal(2);
            return user1.increment('bNumber', { by: 2, returning: false }).then(user3 => {
              expect(user3.bNumber).to.be.equal(0);
            });
          });
        });
      });
    }

    it('supports where conditions', function() {
      return this.User.findByPk(1).then(user1 => {
        return user1.increment(['aNumber'], { by: 2, where: { bNumber: 1 } }).then(() => {
          return this.User.findByPk(1).then(user3 => {
            expect(user3.aNumber).to.be.equal(0);
          });
        });
      });
    });

    it('with array', function() {
      return this.User.findByPk(1).then(user1 => {
        return user1.increment(['aNumber'], { by: 2 }).then(() => {
          return this.User.findByPk(1).then(user3 => {
            expect(user3.aNumber).to.be.equal(2);
          });
        });
      });
    });

    it('with single field', function() {
      return this.User.findByPk(1).then(user1 => {
        return user1.increment('aNumber', { by: 2 }).then(() => {
          return this.User.findByPk(1).then(user3 => {
            expect(user3.aNumber).to.be.equal(2);
          });
        });
      });
    });

    it('with single field and no value', function() {
      return this.User.findByPk(1).then(user1 => {
        return user1.increment('aNumber').then(() => {
          return this.User.findByPk(1).then(user2 => {
            expect(user2.aNumber).to.be.equal(1);
          });
        });
      });
    });

    it('should still work right with other concurrent updates', function() {
      return this.User.findByPk(1).then(user1 => {
        // Select the user again (simulating a concurrent query)
        return this.User.findByPk(1).then(user2 => {
          return user2.update({
            aNumber: user2.aNumber + 1
          }).then(() => {
            return user1.increment(['aNumber'], { by: 2 }).then(() => {
              return this.User.findByPk(1).then(user5 => {
                expect(user5.aNumber).to.be.equal(3);
              });
            });
          });
        });
      });
    });

    it('should still work right with other concurrent increments', function() {
      return this.User.findByPk(1).then(user1 => {
        return Sequelize.Promise.all([
          user1.increment(['aNumber'], { by: 2 }),
          user1.increment(['aNumber'], { by: 2 }),
          user1.increment(['aNumber'], { by: 2 })
        ]).then(() => {
          return this.User.findByPk(1).then(user2 => {
            expect(user2.aNumber).to.equal(6);
          });
        });
      });
    });

    it('with key value pair', function() {
      return this.User.findByPk(1).then(user1 => {
        return user1.increment({ 'aNumber': 1, 'bNumber': 2 }).then(() => {
          return this.User.findByPk(1).then(user3 => {
            expect(user3.aNumber).to.be.equal(1);
            expect(user3.bNumber).to.be.equal(2);
          });
        });
      });
    });

    it('with timestamps set to true', function() {
      const User = this.sequelize.define('IncrementUser', {
        aNumber: DataTypes.INTEGER
      }, { timestamps: true });

      let oldDate;

      return User.sync({ force: true })
        .then(() => User.create({ aNumber: 1 }))
        .then(user => {
          oldDate = user.get('updatedAt');

          this.clock.tick(1000);
          return user.increment('aNumber', { by: 1 });
        })
        .then(user => user.reload())
        .then(user => {
          return expect(user).to.have.property('updatedAt').afterTime(oldDate);
        });
    });

    it('with timestamps set to true and options.silent set to true', function() {
      const User = this.sequelize.define('IncrementUser', {
        aNumber: DataTypes.INTEGER
      }, { timestamps: true });
      let oldDate;

      return User.sync({ force: true }).then(() => {
        return User.create({ aNumber: 1 });
      }).then(user => {
        oldDate = user.updatedAt;
        this.clock.tick(1000);
        return user.increment('aNumber', { by: 1, silent: true });
      }).then(() => {
        return expect(User.findByPk(1)).to.eventually.have.property('updatedAt').equalTime(oldDate);
      });
    });
  });
});
