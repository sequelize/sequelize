'use strict';

const chai = require('chai'),
  expect = chai.expect,
  Sequelize = require('../../index'),
  Support = require('./support'),
  DataTypes = require('../../lib/data-types'),
  dialect = Support.getTestDialect(),
  config = require('../config/config'),
  sinon = require('sinon'),
  isUUID = require('validator').isUUID,
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

  describe('Escaping', () => {
    it('is done properly for special characters', function() {
      // Ideally we should test more: "\0\n\r\b\t\\\'\"\x1a"
      // But this causes sqlite to fail and exits the entire test suite immediately
      const bio = `${dialect}'"\n`; // Need to add the dialect here so in case of failure I know what DB it failed for

      return this.User.create({ username: bio }).then(u1 => {
        return this.User.findByPk(u1.id).then(u2 => {
          expect(u2.username).to.equal(bio);
        });
      });
    });
  });

  describe('isNewRecord', () => {
    it('returns true for non-saved objects', function() {
      const user = this.User.build({ username: 'user' });
      expect(user.id).to.be.null;
      expect(user.isNewRecord).to.be.ok;
    });

    it('returns false for saved objects', function() {
      return this.User.build({ username: 'user' }).save().then(user => {
        expect(user.isNewRecord).to.not.be.ok;
      });
    });

    it('returns false for created objects', function() {
      return this.User.create({ username: 'user' }).then(user => {
        expect(user.isNewRecord).to.not.be.ok;
      });
    });

    it('returns false for objects found by find method', function() {
      return this.User.create({ username: 'user' }).then(() => {
        return this.User.create({ username: 'user' }).then(user => {
          return this.User.findByPk(user.id).then(user => {
            expect(user.isNewRecord).to.not.be.ok;
          });
        });
      });
    });

    it('returns false for objects found by findAll method', function() {
      const users = [];

      for (let i = 0; i < 10; i++) {
        users[i] = { username: 'user' };
      }

      return this.User.bulkCreate(users).then(() => {
        return this.User.findAll().then(users => {
          users.forEach(u => {
            expect(u.isNewRecord).to.not.be.ok;
          });
        });
      });
    });
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

  describe('decrement', () => {
    beforeEach(function() {
      return this.User.create({ id: 1, aNumber: 0, bNumber: 0 });
    });

    if (current.dialect.supports.transactions) {
      it('supports transactions', function() {
        return Support.prepareTransactionTest(this.sequelize).then(sequelize => {
          const User = sequelize.define('User', { number: Support.Sequelize.INTEGER });

          return User.sync({ force: true }).then(() => {
            return User.create({ number: 3 }).then(user => {
              return sequelize.transaction().then(t => {
                return user.decrement('number', { by: 2, transaction: t }).then(() => {
                  return User.findAll().then(users1 => {
                    return User.findAll({ transaction: t }).then(users2 => {
                      expect(users1[0].number).to.equal(3);
                      expect(users2[0].number).to.equal(1);
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
          return user1.decrement('aNumber', { by: 2 }).then(() => {
            expect(user1.aNumber).to.be.equal(-2);
            return user1.decrement('bNumber', { by: 2, returning: false }).then(user3 => {
              expect(user3.bNumber).to.be.equal(0);
            });
          });
        });
      });
    }

    it('with array', function() {
      return this.User.findByPk(1).then(user1 => {
        return user1.decrement(['aNumber'], { by: 2 }).then(() => {
          return this.User.findByPk(1).then(user3 => {
            expect(user3.aNumber).to.be.equal(-2);
          });
        });
      });
    });

    it('with single field', function() {
      return this.User.findByPk(1).then(user1 => {
        return user1.decrement('aNumber', { by: 2 }).then(() => {
          return this.User.findByPk(1).then(user3 => {
            expect(user3.aNumber).to.be.equal(-2);
          });
        });
      });
    });

    it('with single field and no value', function() {
      return this.User.findByPk(1).then(user1 => {
        return user1.decrement('aNumber').then(() => {
          return this.User.findByPk(1).then(user2 => {
            expect(user2.aNumber).to.be.equal(-1);
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
            return user1.decrement(['aNumber'], { by: 2 }).then(() => {
              return this.User.findByPk(1).then(user5 => {
                expect(user5.aNumber).to.be.equal(-1);
              });
            });
          });
        });
      });
    });

    it('should still work right with other concurrent increments', function() {
      return this.User.findByPk(1).then(user1 => {
        return Sequelize.Promise.all([
          user1.decrement(['aNumber'], { by: 2 }),
          user1.decrement(['aNumber'], { by: 2 }),
          user1.decrement(['aNumber'], { by: 2 })
        ]).then(() => {
          return this.User.findByPk(1).then(user2 => {
            expect(user2.aNumber).to.equal(-6);
          });
        });
      });
    });

    it('with key value pair', function() {
      return this.User.findByPk(1).then(user1 => {
        return user1.decrement({ 'aNumber': 1, 'bNumber': 2 }).then(() => {
          return this.User.findByPk(1).then(user3 => {
            expect(user3.aNumber).to.be.equal(-1);
            expect(user3.bNumber).to.be.equal(-2);
          });
        });
      });
    });

    it('with negative value', function() {
      return this.User.findByPk(1).then(user1 => {
        return Sequelize.Promise.all([
          user1.decrement('aNumber', { by: -2 }),
          user1.decrement(['aNumber', 'bNumber'], { by: -2 }),
          user1.decrement({ 'aNumber': -1, 'bNumber': -2 })
        ]).then(() => {
          return this.User.findByPk(1).then(user3 => {
            expect(user3.aNumber).to.be.equal(+5);
            expect(user3.bNumber).to.be.equal(+4);
          });
        });
      });
    });

    it('with timestamps set to true', function() {
      const User = this.sequelize.define('IncrementUser', {
        aNumber: DataTypes.INTEGER
      }, { timestamps: true });
      let oldDate;

      return User.sync({ force: true }).then(() => {
        return User.create({ aNumber: 1 });
      }).then(user => {
        oldDate = user.updatedAt;
        this.clock.tick(1000);
        return user.decrement('aNumber', { by: 1 });
      }).then(() => {
        return expect(User.findByPk(1)).to.eventually.have.property('updatedAt').afterTime(oldDate);
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
        return user.decrement('aNumber', { by: 1, silent: true });
      }).then(() => {
        return expect(User.findByPk(1)).to.eventually.have.property('updatedAt').equalTime(oldDate);
      });
    });
  });

  describe('reload', () => {
    if (current.dialect.supports.transactions) {
      it('supports transactions', function() {
        return Support.prepareTransactionTest(this.sequelize).then(sequelize => {
          const User = sequelize.define('User', { username: Support.Sequelize.STRING });

          return User.sync({ force: true }).then(() => {
            return User.create({ username: 'foo' }).then(user => {
              return sequelize.transaction().then(t => {
                return User.update({ username: 'bar' }, { where: { username: 'foo' }, transaction: t }).then(() => {
                  return user.reload().then(user => {
                    expect(user.username).to.equal('foo');
                    return user.reload({ transaction: t }).then(user => {
                      expect(user.username).to.equal('bar');
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

    it('should return a reference to the same DAO instead of creating a new one', function() {
      return this.User.create({ username: 'John Doe' }).then(originalUser => {
        return originalUser.update({ username: 'Doe John' }).then(() => {
          return originalUser.reload().then(updatedUser => {
            expect(originalUser === updatedUser).to.be.true;
          });
        });
      });
    });

    it('should update the values on all references to the DAO', function() {
      return this.User.create({ username: 'John Doe' }).then(originalUser => {
        return this.User.findByPk(originalUser.id).then(updater => {
          return updater.update({ username: 'Doe John' }).then(() => {
            // We used a different reference when calling update, so originalUser is now out of sync
            expect(originalUser.username).to.equal('John Doe');
            return originalUser.reload().then(updatedUser => {
              expect(originalUser.username).to.equal('Doe John');
              expect(updatedUser.username).to.equal('Doe John');
            });
          });
        });
      });
    });

    it('should support updating a subset of attributes', function() {
      return this.User.create({
        aNumber: 1,
        bNumber: 1
      }).tap(user => {
        return this.User.update({
          bNumber: 2
        }, {
          where: {
            id: user.get('id')
          }
        });
      }).then(user => {
        return user.reload({
          attributes: ['bNumber']
        });
      }).then(user => {
        expect(user.get('aNumber')).to.equal(1);
        expect(user.get('bNumber')).to.equal(2);
      });
    });

    it('should update read only attributes as well (updatedAt)', function() {
      return this.User.create({ username: 'John Doe' }).then(originalUser => {
        this.originallyUpdatedAt = originalUser.updatedAt;
        this.originalUser = originalUser;

        // Wait for a second, so updatedAt will actually be different
        this.clock.tick(1000);
        return this.User.findByPk(originalUser.id);
      }).then(updater => {
        return updater.update({ username: 'Doe John' });
      }).then(updatedUser => {
        this.updatedUser = updatedUser;
        return this.originalUser.reload();
      }).then(() => {
        expect(this.originalUser.updatedAt).to.be.above(this.originallyUpdatedAt);
        expect(this.updatedUser.updatedAt).to.be.above(this.originallyUpdatedAt);
      });
    });

    it('should update the associations as well', function() {
      const Book = this.sequelize.define('Book', { title: DataTypes.STRING }),
        Page = this.sequelize.define('Page', { content: DataTypes.TEXT });

      Book.hasMany(Page);
      Page.belongsTo(Book);

      return Book.sync({ force: true }).then(() => {
        return Page.sync({ force: true }).then(() => {
          return Book.create({ title: 'A very old book' }).then(book => {
            return Page.create({ content: 'om nom nom' }).then(page => {
              return book.setPages([page]).then(() => {
                return Book.findOne({
                  where: { id: book.id },
                  include: [Page]
                }).then(leBook => {
                  return page.update({ content: 'something totally different' }).then(page => {
                    expect(leBook.Pages.length).to.equal(1);
                    expect(leBook.Pages[0].content).to.equal('om nom nom');
                    expect(page.content).to.equal('something totally different');
                    return leBook.reload().then(leBook => {
                      expect(leBook.Pages.length).to.equal(1);
                      expect(leBook.Pages[0].content).to.equal('something totally different');
                      expect(page.content).to.equal('something totally different');
                    });
                  });
                });
              });
            });
          });
        });
      });
    });

    it('should update internal options of the instance', function() {
      const Book = this.sequelize.define('Book', { title: DataTypes.STRING }),
        Page = this.sequelize.define('Page', { content: DataTypes.TEXT });

      Book.hasMany(Page);
      Page.belongsTo(Book);

      return Book.sync({ force: true }).then(() => {
        return Page.sync({ force: true }).then(() => {
          return Book.create({ title: 'A very old book' }).then(book => {
            return Page.create().then(page => {
              return book.setPages([page]).then(() => {
                return Book.findOne({
                  where: { id: book.id }
                }).then(leBook => {
                  const oldOptions = leBook._options;
                  return leBook.reload({
                    include: [Page]
                  }).then(leBook => {
                    expect(oldOptions).not.to.equal(leBook._options);
                    expect(leBook._options.include.length).to.equal(1);
                    expect(leBook.Pages.length).to.equal(1);
                    expect(leBook.get({ plain: true }).Pages.length).to.equal(1);
                  });
                });
              });
            });
          });
        });
      });
    });

    it('should return an error when reload fails', function() {
      return this.User.create({ username: 'John Doe' }).then(user => {
        return user.destroy().then(() => {
          return expect(user.reload()).to.be.rejectedWith(
            Sequelize.InstanceError,
            'Instance could not be reloaded because it does not exist anymore (find call returned null)'
          );
        });
      });
    });

    it('should set an association to null after deletion, 1-1', function() {
      const Shoe = this.sequelize.define('Shoe', { brand: DataTypes.STRING }),
        Player = this.sequelize.define('Player', { name: DataTypes.STRING });

      Player.hasOne(Shoe);
      Shoe.belongsTo(Player);

      return this.sequelize.sync({ force: true }).then(() => {
        return Shoe.create({
          brand: 'the brand',
          Player: {
            name: 'the player'
          }
        }, { include: [Player] });
      }).then(shoe => {
        return Player.findOne({
          where: { id: shoe.Player.id },
          include: [Shoe]
        }).then(lePlayer => {
          expect(lePlayer.Shoe).not.to.be.null;
          return lePlayer.Shoe.destroy().return(lePlayer);
        }).then(lePlayer => {
          return lePlayer.reload();
        }).then(lePlayer => {
          expect(lePlayer.Shoe).to.be.null;
        });
      });
    });

    it('should set an association to empty after all deletion, 1-N', function() {
      const Team = this.sequelize.define('Team', { name: DataTypes.STRING }),
        Player = this.sequelize.define('Player', { name: DataTypes.STRING });

      Team.hasMany(Player);
      Player.belongsTo(Team);

      return this.sequelize.sync({ force: true }).then(() => {
        return Team.create({
          name: 'the team',
          Players: [{
            name: 'the player1'
          }, {
            name: 'the player2'
          }]
        }, { include: [Player] });
      }).then(team => {
        return Team.findOne({
          where: { id: team.id },
          include: [Player]
        }).then(leTeam => {
          expect(leTeam.Players).not.to.be.empty;
          return leTeam.Players[1].destroy().then(() => {
            return leTeam.Players[0].destroy();
          }).return(leTeam);
        }).then(leTeam => {
          return leTeam.reload();
        }).then(leTeam => {
          expect(leTeam.Players).to.be.empty;
        });
      });
    });

    it('should update the associations after one element deleted', function() {
      const Team = this.sequelize.define('Team', { name: DataTypes.STRING }),
        Player = this.sequelize.define('Player', { name: DataTypes.STRING });

      Team.hasMany(Player);
      Player.belongsTo(Team);


      return this.sequelize.sync({ force: true }).then(() => {
        return Team.create({
          name: 'the team',
          Players: [{
            name: 'the player1'
          }, {
            name: 'the player2'
          }]
        }, { include: [Player] });
      }).then(team => {
        return Team.findOne({
          where: { id: team.id },
          include: [Player]
        }).then(leTeam => {
          expect(leTeam.Players).to.have.length(2);
          return leTeam.Players[0].destroy().return(leTeam);
        }).then(leTeam => {
          return leTeam.reload();
        }).then(leTeam => {
          expect(leTeam.Players).to.have.length(1);
        });
      });
    });
  });

  describe('default values', () => {
    describe('uuid', () => {
      it('should store a string in uuidv1 and uuidv4', function() {
        const user = this.User.build({ username: 'a user' });
        expect(user.uuidv1).to.be.a('string');
        expect(user.uuidv4).to.be.a('string');
      });

      it('should store a string of length 36 in uuidv1 and uuidv4', function() {
        const user = this.User.build({ username: 'a user' });
        expect(user.uuidv1).to.have.length(36);
        expect(user.uuidv4).to.have.length(36);
      });

      it('should store a valid uuid in uuidv1 and uuidv4 that conforms to the UUID v1 and v4 specifications', function() {
        const user = this.User.build({ username: 'a user' });
        expect(isUUID(user.uuidv1)).to.be.true;
        expect(isUUID(user.uuidv4, 4)).to.be.true;
      });

      it('should store a valid uuid if the field is a primary key named id', function() {
        const Person = this.sequelize.define('Person', {
          id: {
            type: DataTypes.UUID,
            defaultValue: DataTypes.UUIDV1,
            primaryKey: true
          }
        });

        const person = Person.build({});
        expect(person.id).to.be.ok;
        expect(person.id).to.have.length(36);
      });
    });
    describe('current date', () => {
      it('should store a date in touchedAt', function() {
        const user = this.User.build({ username: 'a user' });
        expect(user.touchedAt).to.be.instanceof(Date);
      });

      it('should store the current date in touchedAt', function() {
        const clock = sinon.useFakeTimers();
        clock.tick(5000);
        const user = this.User.build({ username: 'a user' });
        clock.restore();
        expect(+user.touchedAt).to.be.equal(5000);
      });
    });

    describe('allowNull date', () => {
      it('should be just "null" and not Date with Invalid Date', function() {
        return this.User.build({ username: 'a user' }).save().then(() => {
          return this.User.findOne({ where: { username: 'a user' } }).then(user => {
            expect(user.dateAllowNullTrue).to.be.null;
          });
        });
      });

      it('should be the same valid date when saving the date', function() {
        const date = new Date();
        return this.User.build({ username: 'a user', dateAllowNullTrue: date }).save().then(() => {
          return this.User.findOne({ where: { username: 'a user' } }).then(user => {
            expect(user.dateAllowNullTrue.toString()).to.equal(date.toString());
          });
        });
      });
    });

    describe('super user boolean', () => {
      it('should default to false', function() {
        return this.User.build({
          username: 'a user'
        })
          .save()
          .then(() => {
            return this.User.findOne({
              where: {
                username: 'a user'
              }
            })
              .then(user => {
                expect(user.isSuperUser).to.be.false;
              });
          });
      });

      it('should override default when given truthy boolean', function() {
        return this.User.build({
          username: 'a user',
          isSuperUser: true
        })
          .save()
          .then(() => {
            return this.User.findOne({
              where: {
                username: 'a user'
              }
            })
              .then(user => {
                expect(user.isSuperUser).to.be.true;
              });
          });
      });

      it('should override default when given truthy boolean-string ("true")', function() {
        return this.User.build({
          username: 'a user',
          isSuperUser: 'true'
        })
          .save()
          .then(() => {
            return this.User.findOne({
              where: {
                username: 'a user'
              }
            })
              .then(user => {
                expect(user.isSuperUser).to.be.true;
              });
          });
      });

      it('should override default when given truthy boolean-int (1)', function() {
        return this.User.build({
          username: 'a user',
          isSuperUser: 1
        })
          .save()
          .then(() => {
            return this.User.findOne({
              where: {
                username: 'a user'
              }
            })
              .then(user => {
                expect(user.isSuperUser).to.be.true;
              });
          });
      });

      it('should throw error when given value of incorrect type', function() {
        let callCount = 0;

        return this.User.build({
          username: 'a user',
          isSuperUser: 'INCORRECT_VALUE_TYPE'
        })
          .save()
          .then(() => {
            callCount += 1;
          })
          .catch(err => {
            expect(callCount).to.equal(0);
            expect(err).to.exist;
            expect(err.message).to.exist;
          });
      });
    });
  });

  describe('complete', () => {
    it('gets triggered if an error occurs', function() {
      return this.User.findOne({ where: ['asdasdasd'] }).catch(err => {
        expect(err).to.exist;
        expect(err.message).to.exist;
      });
    });

    it('gets triggered if everything was ok', function() {
      return this.User.count().then(result => {
        expect(result).to.exist;
      });
    });
  });

  describe('save', () => {
    if (current.dialect.supports.transactions) {
      it('supports transactions', function() {
        return Support.prepareTransactionTest(this.sequelize).then(sequelize => {
          const User = sequelize.define('User', { username: Support.Sequelize.STRING });
          return User.sync({ force: true }).then(() => {
            return sequelize.transaction().then(t => {
              return User.build({ username: 'foo' }).save({ transaction: t }).then(() => {
                return User.count().then(count1 => {
                  return User.count({ transaction: t }).then(count2 => {
                    expect(count1).to.equal(0);
                    expect(count2).to.equal(1);
                    return t.rollback();
                  });
                });
              });
            });
          });
        });
      });
    }

    it('only updates fields in passed array', function() {
      const date = new Date(1990, 1, 1);

      return this.User.create({
        username: 'foo',
        touchedAt: new Date()
      }).then(user => {
        user.username = 'fizz';
        user.touchedAt = date;

        return user.save({ fields: ['username'] }).then(() => {
          // re-select user
          return this.User.findByPk(user.id).then(user2 => {
            // name should have changed
            expect(user2.username).to.equal('fizz');
            // bio should be unchanged
            expect(user2.birthDate).not.to.equal(date);
          });
        });
      });
    });

    it('should work on a model with an attribute named length', function() {
      const Box = this.sequelize.define('box', {
        length: DataTypes.INTEGER,
        width: DataTypes.INTEGER,
        height: DataTypes.INTEGER
      });

      return Box.sync({ force: true }).then(() => {
        return Box.create({
          length: 1,
          width: 2,
          height: 3
        }).then(box => {
          return box.update({
            length: 4,
            width: 5,
            height: 6
          });
        }).then(() => {
          return Box.findOne({}).then(box => {
            expect(box.get('length')).to.equal(4);
            expect(box.get('width')).to.equal(5);
            expect(box.get('height')).to.equal(6);
          });
        });
      });
    });

    it('only validates fields in passed array', function() {
      return this.User.build({
        validateTest: 'cake', // invalid, but not saved
        validateCustom: '1'
      }).save({
        fields: ['validateCustom']
      });
    });

    describe('hooks', () => {
      it('should update attributes added in hooks when default fields are used', function() {
        const User = this.sequelize.define(`User${config.rand()}`, {
          name: DataTypes.STRING,
          bio: DataTypes.TEXT,
          email: DataTypes.STRING
        });

        User.beforeUpdate(instance => {
          instance.set('email', 'B');
        });

        return User.sync({ force: true }).then(() => {
          return User.create({
            name: 'A',
            bio: 'A',
            email: 'A'
          }).then(user => {
            return user.set({
              name: 'B',
              bio: 'B'
            }).save();
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
        const User = this.sequelize.define(`User${config.rand()}`, {
          name: DataTypes.STRING,
          bio: DataTypes.TEXT,
          email: DataTypes.STRING
        });

        User.beforeUpdate(instance => {
          instance.set('email', 'C');
        });

        return User.sync({ force: true }).then(() => {
          return User.create({
            name: 'A',
            bio: 'A',
            email: 'A'
          }).then(user => {
            return user.set({
              name: 'B',
              bio: 'B',
              email: 'B'
            }).save();
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
        const User = this.sequelize.define(`User${config.rand()}`, {
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

        return User.sync({ force: true }).then(() => {
          return User.create({
            name: 'A',
            bio: 'A',
            email: 'valid.email@gmail.com'
          }).then(user => {
            return expect(user.set({
              name: 'B'
            }).save()).to.be.rejectedWith(Sequelize.ValidationError);
          }).then(() => {
            return User.findOne({}).then(user => {
              expect(user.get('email')).to.equal('valid.email@gmail.com');
            });
          });
        });
      });

      it('should validate attributes changed in hooks when default fields are used', function() {
        const User = this.sequelize.define(`User${config.rand()}`, {
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

        return User.sync({ force: true }).then(() => {
          return User.create({
            name: 'A',
            bio: 'A',
            email: 'valid.email@gmail.com'
          }).then(user => {
            return expect(user.set({
              name: 'B',
              email: 'still.valid.email@gmail.com'
            }).save()).to.be.rejectedWith(Sequelize.ValidationError);
          }).then(() => {
            return User.findOne({}).then(user => {
              expect(user.get('email')).to.equal('valid.email@gmail.com');
            });
          });
        });
      });
    });

    it('stores an entry in the database', function() {
      const username = 'user',
        User = this.User,
        user = this.User.build({
          username,
          touchedAt: new Date(1984, 8, 23)
        });

      return User.findAll().then(users => {
        expect(users).to.have.length(0);
        return user.save().then(() => {
          return User.findAll().then(users => {
            expect(users).to.have.length(1);
            expect(users[0].username).to.equal(username);
            expect(users[0].touchedAt).to.be.instanceof(Date);
            expect(users[0].touchedAt).to.equalDate(new Date(1984, 8, 23));
          });
        });
      });
    });

    it('handles an entry with primaryKey of zero', function() {
      const username = 'user',
        newUsername = 'newUser',
        User2 = this.sequelize.define('User2',
          {
            id: {
              type: DataTypes.INTEGER.UNSIGNED,
              autoIncrement: false,
              primaryKey: true
            },
            username: { type: DataTypes.STRING }
          });

      return User2.sync().then(() => {
        return User2.create({ id: 0, username }).then(user => {
          expect(user).to.be.ok;
          expect(user.id).to.equal(0);
          expect(user.username).to.equal(username);
          return User2.findByPk(0).then(user => {
            expect(user).to.be.ok;
            expect(user.id).to.equal(0);
            expect(user.username).to.equal(username);
            return user.update({ username: newUsername }).then(user => {
              expect(user).to.be.ok;
              expect(user.id).to.equal(0);
              expect(user.username).to.equal(newUsername);
            });
          });
        });
      });
    });

    it('updates the timestamps', function() {
      const now = new Date();
      now.setMilliseconds(0);

      const user = this.User.build({ username: 'user' });
      this.clock.tick(1000);

      return user.save().then(savedUser => {
        expect(savedUser).have.property('updatedAt').afterTime(now);

        this.clock.tick(1000);
        return savedUser.save();
      }).then(updatedUser => {
        expect(updatedUser).have.property('updatedAt').afterTime(now);
      });
    });

    it('does not update timestamps when passing silent=true', function() {
      return this.User.create({ username: 'user' }).then(user => {
        const updatedAt = user.updatedAt;

        this.clock.tick(1000);
        return expect(user.update({
          username: 'userman'
        }, {
          silent: true
        })).to.eventually.have.property('updatedAt').equalTime(updatedAt);
      });
    });

    it('does not update timestamps when passing silent=true in a bulk update', function() {
      const data = [
        { username: 'Paul' },
        { username: 'Peter' }
      ];
      let updatedAtPeter,
        updatedAtPaul;

      return this.User.bulkCreate(data).then(() => {
        return this.User.findAll();
      }).then(users => {
        updatedAtPaul = users[0].updatedAt;
        updatedAtPeter = users[1].updatedAt;
      })
        .then(() => {
          this.clock.tick(150);
          return this.User.update(
            { aNumber: 1 },
            { where: {}, silent: true }
          );
        }).then(() => {
          return this.User.findAll();
        }).then(users => {
          expect(users[0].updatedAt).to.equalTime(updatedAtPeter);
          expect(users[1].updatedAt).to.equalTime(updatedAtPaul);
        });
    });

    describe('when nothing changed', () => {
      it('does not update timestamps', function() {
        return this.User.create({ username: 'John' }).then(() => {
          return this.User.findOne({ where: { username: 'John' } }).then(user => {
            const updatedAt = user.updatedAt;
            this.clock.tick(2000);
            return user.save().then(newlySavedUser => {
              expect(newlySavedUser.updatedAt).to.equalTime(updatedAt);
              return this.User.findOne({ where: { username: 'John' } }).then(newlySavedUser => {
                expect(newlySavedUser.updatedAt).to.equalTime(updatedAt);
              });
            });
          });
        });
      });

      it('should not throw ER_EMPTY_QUERY if changed only virtual fields', function() {
        const User = this.sequelize.define(`User${config.rand()}`, {
          name: DataTypes.STRING,
          bio: {
            type: DataTypes.VIRTUAL,
            get: () => 'swag'
          }
        }, {
          timestamps: false
        });
        return User.sync({ force: true }).then(() =>
          User.create({ name: 'John', bio: 'swag 1' }).then(user => user.update({ bio: 'swag 2' }).should.be.fulfilled)
        );
      });
    });

    it('updates with function and column value', function() {
      return this.User.create({
        aNumber: 42
      }).then(user => {
        user.bNumber = this.sequelize.col('aNumber');
        user.username = this.sequelize.fn('upper', 'sequelize');
        return user.save().then(() => {
          return this.User.findByPk(user.id).then(user2 => {
            expect(user2.username).to.equal('SEQUELIZE');
            expect(user2.bNumber).to.equal(42);
          });
        });
      });
    });

    describe('without timestamps option', () => {
      it("doesn't update the updatedAt column", function() {
        const User2 = this.sequelize.define('User2', {
          username: DataTypes.STRING,
          updatedAt: DataTypes.DATE
        }, { timestamps: false });
        return User2.sync().then(() => {
          return User2.create({ username: 'john doe' }).then(johnDoe => {
            // sqlite and mysql return undefined, whereas postgres returns null
            expect([undefined, null]).to.include(johnDoe.updatedAt);
          });
        });
      });
    });

    describe('with custom timestamp options', () => {
      it('updates the createdAt column if updatedAt is disabled', function() {
        const now = new Date();
        this.clock.tick(1000);

        const User2 = this.sequelize.define('User2', {
          username: DataTypes.STRING
        }, { updatedAt: false });

        return User2.sync().then(() => {
          return User2.create({ username: 'john doe' }).then(johnDoe => {
            expect(johnDoe.updatedAt).to.be.undefined;
            expect(now).to.be.beforeTime(johnDoe.createdAt);
          });
        });
      });

      it('updates the updatedAt column if createdAt is disabled', function() {
        const now = new Date();
        this.clock.tick(1000);

        const User2 = this.sequelize.define('User2', {
          username: DataTypes.STRING
        }, { createdAt: false });

        return User2.sync().then(() => {
          return User2.create({ username: 'john doe' }).then(johnDoe => {
            expect(johnDoe.createdAt).to.be.undefined;
            expect(now).to.be.beforeTime(johnDoe.updatedAt);
          });
        });
      });

      it('works with `allowNull: false` on createdAt and updatedAt columns', function() {
        const User2 = this.sequelize.define('User2', {
          username: DataTypes.STRING,
          createdAt: {
            type: DataTypes.DATE,
            allowNull: false
          },
          updatedAt: {
            type: DataTypes.DATE,
            allowNull: false
          }
        }, { timestamps: true });

        return User2.sync().then(() => {
          return User2.create({ username: 'john doe' }).then(johnDoe => {
            expect(johnDoe.createdAt).to.be.an.instanceof(Date);
            expect( ! isNaN(johnDoe.createdAt.valueOf()) ).to.be.ok;
            expect(johnDoe.createdAt).to.equalTime(johnDoe.updatedAt);
          });
        });
      });
    });

    it('should fail a validation upon creating', function() {
      return this.User.create({ aNumber: 0, validateTest: 'hello' }).catch(err => {
        expect(err).to.exist;
        expect(err).to.be.instanceof(Object);
        expect(err.get('validateTest')).to.be.instanceof(Array);
        expect(err.get('validateTest')[0]).to.exist;
        expect(err.get('validateTest')[0].message).to.equal('Validation isInt on validateTest failed');
      });
    });

    it('should fail a validation upon creating with hooks false', function() {
      return this.User.create({ aNumber: 0, validateTest: 'hello' }, { hooks: false }).catch(err => {
        expect(err).to.exist;
        expect(err).to.be.instanceof(Object);
        expect(err.get('validateTest')).to.be.instanceof(Array);
        expect(err.get('validateTest')[0]).to.exist;
        expect(err.get('validateTest')[0].message).to.equal('Validation isInt on validateTest failed');
      });
    });

    it('should fail a validation upon building', function() {
      return this.User.build({ aNumber: 0, validateCustom: 'aaaaaaaaaaaaaaaaaaaaaaaaaa' }).save()
        .catch(err => {
          expect(err).to.exist;
          expect(err).to.be.instanceof(Object);
          expect(err.get('validateCustom')).to.exist;
          expect(err.get('validateCustom')).to.be.instanceof(Array);
          expect(err.get('validateCustom')[0]).to.exist;
          expect(err.get('validateCustom')[0].message).to.equal('Length failed.');
        });
    });

    it('should fail a validation when updating', function() {
      return this.User.create({ aNumber: 0 }).then(user => {
        return user.update({ validateTest: 'hello' }).catch(err => {
          expect(err).to.exist;
          expect(err).to.be.instanceof(Object);
          expect(err.get('validateTest')).to.exist;
          expect(err.get('validateTest')).to.be.instanceof(Array);
          expect(err.get('validateTest')[0]).to.exist;
          expect(err.get('validateTest')[0].message).to.equal('Validation isInt on validateTest failed');
        });
      });
    });

    it('takes zero into account', function() {
      return this.User.build({ aNumber: 0 }).save({
        fields: ['aNumber']
      }).then(user => {
        expect(user.aNumber).to.equal(0);
      });
    });

    it('saves a record with no primary key', function() {
      const HistoryLog = this.sequelize.define('HistoryLog', {
        someText: { type: DataTypes.STRING },
        aNumber: { type: DataTypes.INTEGER },
        aRandomId: { type: DataTypes.INTEGER }
      });
      return HistoryLog.sync().then(() => {
        return HistoryLog.create({ someText: 'Some random text', aNumber: 3, aRandomId: 5 }).then(log => {
          return log.update({ aNumber: 5 }).then(newLog => {
            expect(newLog.aNumber).to.equal(5);
          });
        });
      });
    });

    describe('eagerly loaded objects', () => {
      beforeEach(function() {
        this.UserEager = this.sequelize.define('UserEagerLoadingSaves', {
          username: DataTypes.STRING,
          age: DataTypes.INTEGER
        }, { timestamps: false });

        this.ProjectEager = this.sequelize.define('ProjectEagerLoadingSaves', {
          title: DataTypes.STRING,
          overdue_days: DataTypes.INTEGER
        }, { timestamps: false });

        this.UserEager.hasMany(this.ProjectEager, { as: 'Projects', foreignKey: 'PoobahId' });
        this.ProjectEager.belongsTo(this.UserEager, { as: 'Poobah', foreignKey: 'PoobahId' });

        return this.UserEager.sync({ force: true }).then(() => {
          return this.ProjectEager.sync({ force: true });
        });
      });

      it('saves one object that has a collection of eagerly loaded objects', function() {
        return this.UserEager.create({ username: 'joe', age: 1 }).then(user => {
          return this.ProjectEager.create({ title: 'project-joe1', overdue_days: 0 }).then(project1 => {
            return this.ProjectEager.create({ title: 'project-joe2', overdue_days: 0 }).then(project2 => {
              return user.setProjects([project1, project2]).then(() => {
                return this.UserEager.findOne({ where: { age: 1 }, include: [{ model: this.ProjectEager, as: 'Projects' }] }).then(user => {
                  expect(user.username).to.equal('joe');
                  expect(user.age).to.equal(1);
                  expect(user.Projects).to.exist;
                  expect(user.Projects.length).to.equal(2);

                  user.age = user.age + 1; // happy birthday joe
                  return user.save().then(user => {
                    expect(user.username).to.equal('joe');
                    expect(user.age).to.equal(2);
                    expect(user.Projects).to.exist;
                    expect(user.Projects.length).to.equal(2);
                  });
                });
              });
            });
          });
        });
      });

      it('saves many objects that each a have collection of eagerly loaded objects', function() {
        return this.UserEager.create({ username: 'bart', age: 20 }).then(bart => {
          return this.UserEager.create({ username: 'lisa', age: 20 }).then(lisa => {
            return this.ProjectEager.create({ title: 'detention1', overdue_days: 0 }).then(detention1 => {
              return this.ProjectEager.create({ title: 'detention2', overdue_days: 0 }).then(detention2 => {
                return this.ProjectEager.create({ title: 'exam1', overdue_days: 0 }).then(exam1 => {
                  return this.ProjectEager.create({ title: 'exam2', overdue_days: 0 }).then(exam2 => {
                    return bart.setProjects([detention1, detention2]).then(() => {
                      return lisa.setProjects([exam1, exam2]).then(() => {
                        return this.UserEager.findAll({ where: { age: 20 }, order: [['username', 'ASC']], include: [{ model: this.ProjectEager, as: 'Projects' }] }).then(simpsons => {
                          expect(simpsons.length).to.equal(2);

                          const _bart = simpsons[0];
                          const _lisa = simpsons[1];

                          expect(_bart.Projects).to.exist;
                          expect(_lisa.Projects).to.exist;
                          expect(_bart.Projects.length).to.equal(2);
                          expect(_lisa.Projects.length).to.equal(2);

                          _bart.age = _bart.age + 1; // happy birthday bart - off to Moe's

                          return _bart.save().then(savedbart => {
                            expect(savedbart.username).to.equal('bart');
                            expect(savedbart.age).to.equal(21);

                            _lisa.username = 'lsimpson';

                            return _lisa.save().then(savedlisa => {
                              expect(savedlisa.username).to.equal('lsimpson');
                              expect(savedlisa.age).to.equal(20);
                            });
                          });
                        });
                      });
                    });
                  });
                });
              });
            });
          });
        });
      });

      it('saves many objects that each has one eagerly loaded object (to which they belong)', function() {
        return this.UserEager.create({ username: 'poobah', age: 18 }).then(user => {
          return this.ProjectEager.create({ title: 'homework', overdue_days: 10 }).then(homework => {
            return this.ProjectEager.create({ title: 'party', overdue_days: 2 }).then(party => {
              return user.setProjects([homework, party]).then(() => {
                return this.ProjectEager.findAll({ include: [{ model: this.UserEager, as: 'Poobah' }] }).then(projects => {
                  expect(projects.length).to.equal(2);
                  expect(projects[0].Poobah).to.exist;
                  expect(projects[1].Poobah).to.exist;
                  expect(projects[0].Poobah.username).to.equal('poobah');
                  expect(projects[1].Poobah.username).to.equal('poobah');

                  projects[0].title = 'partymore';
                  projects[1].title = 'partymore';
                  projects[0].overdue_days = 0;
                  projects[1].overdue_days = 0;

                  return projects[0].save().then(() => {
                    return projects[1].save().then(() => {
                      return this.ProjectEager.findAll({ where: { title: 'partymore', overdue_days: 0 }, include: [{ model: this.UserEager, as: 'Poobah' }] }).then(savedprojects => {
                        expect(savedprojects.length).to.equal(2);
                        expect(savedprojects[0].Poobah).to.exist;
                        expect(savedprojects[1].Poobah).to.exist;
                        expect(savedprojects[0].Poobah.username).to.equal('poobah');
                        expect(savedprojects[1].Poobah.username).to.equal('poobah');
                      });
                    });
                  });
                });
              });
            });
          });
        });
      });
    });
  });

  describe('findAll', () => {
    beforeEach(function() {
      this.ParanoidUser = this.sequelize.define('ParanoidUser', {
        username: { type: DataTypes.STRING }
      }, { paranoid: true });

      this.ParanoidUser.hasOne(this.ParanoidUser);
      return this.ParanoidUser.sync({ force: true });
    });

    it('sql should have paranoid condition', function() {
      return this.ParanoidUser.create({ username: 'cuss' })
        .then(() => {
          return this.ParanoidUser.findAll();
        })
        .then(users => {
          expect(users).to.have.length(1);
          return users[0].destroy();
        })
        .then(() => {
          return this.ParanoidUser.findAll();
        })
        .then(users => {
          expect(users).to.have.length(0);
        });
    });

    it('sequelize.and as where should include paranoid condition', function() {
      return this.ParanoidUser.create({ username: 'cuss' })
        .then(() => {
          return this.ParanoidUser.findAll({
            where: this.sequelize.and({
              username: 'cuss'
            })
          });
        })
        .then(users => {
          expect(users).to.have.length(1);
          return users[0].destroy();
        })
        .then(() => {
          return this.ParanoidUser.findAll({
            where: this.sequelize.and({
              username: 'cuss'
            })
          });
        })
        .then(users => {
          expect(users).to.have.length(0);
        });
    });

    it('sequelize.or as where should include paranoid condition', function() {
      return this.ParanoidUser.create({ username: 'cuss' })
        .then(() => {
          return this.ParanoidUser.findAll({
            where: this.sequelize.or({
              username: 'cuss'
            })
          });
        })
        .then(users => {
          expect(users).to.have.length(1);
          return users[0].destroy();
        })
        .then(() => {
          return this.ParanoidUser.findAll({
            where: this.sequelize.or({
              username: 'cuss'
            })
          });
        })
        .then(users => {
          expect(users).to.have.length(0);
        });
    });

    it('escapes a single single quotes properly in where clauses', function() {
      return this.User
        .create({ username: "user'name" })
        .then(() => {
          return this.User.findAll({
            where: { username: "user'name" }
          }).then(users => {
            expect(users.length).to.equal(1);
            expect(users[0].username).to.equal("user'name");
          });
        });
    });

    it('escapes two single quotes properly in where clauses', function() {
      return this.User
        .create({ username: "user''name" })
        .then(() => {
          return this.User.findAll({
            where: { username: "user''name" }
          }).then(users => {
            expect(users.length).to.equal(1);
            expect(users[0].username).to.equal("user''name");
          });
        });
    });

    it('returns the timestamps if no attributes have been specified', function() {
      return this.User.create({ username: 'fnord' }).then(() => {
        return this.User.findAll().then(users => {
          expect(users[0].createdAt).to.exist;
        });
      });
    });

    it('does not return the timestamps if the username attribute has been specified', function() {
      return this.User.create({ username: 'fnord' }).then(() => {
        return this.User.findAll({ attributes: ['username'] }).then(users => {
          expect(users[0].createdAt).not.to.exist;
          expect(users[0].username).to.exist;
        });
      });
    });

    it('creates the deletedAt property, when defining paranoid as true', function() {
      return this.ParanoidUser.create({ username: 'fnord' }).then(() => {
        return this.ParanoidUser.findAll().then(users => {
          expect(users[0].deletedAt).to.be.null;
        });
      });
    });

    it('destroys a record with a primary key of something other than id', function() {
      const UserDestroy = this.sequelize.define('UserDestroy', {
        newId: {
          type: DataTypes.STRING,
          primaryKey: true
        },
        email: DataTypes.STRING
      });

      return UserDestroy.sync().then(() => {
        return UserDestroy.create({ newId: '123ABC', email: 'hello' }).then(() => {
          return UserDestroy.findOne({ where: { email: 'hello' } }).then(user => {
            return user.destroy();
          });
        });
      });
    });

    it('sets deletedAt property to a specific date when deleting an instance', function() {
      return this.ParanoidUser.create({ username: 'fnord' }).then(() => {
        return this.ParanoidUser.findAll().then(users => {
          return users[0].destroy().then(() => {
            expect(users[0].deletedAt.getMonth).to.exist;

            return users[0].reload({ paranoid: false }).then(user => {
              expect(user.deletedAt.getMonth).to.exist;
            });
          });
        });
      });
    });

    it('keeps the deletedAt-attribute with value null, when running update', function() {
      return this.ParanoidUser.create({ username: 'fnord' }).then(() => {
        return this.ParanoidUser.findAll().then(users => {
          return users[0].update({ username: 'newFnord' }).then(user => {
            expect(user.deletedAt).not.to.exist;
          });
        });
      });
    });

    it('keeps the deletedAt-attribute with value null, when updating associations', function() {
      return this.ParanoidUser.create({ username: 'fnord' }).then(() => {
        return this.ParanoidUser.findAll().then(users => {
          return this.ParanoidUser.create({ username: 'linkedFnord' }).then(linkedUser => {
            return users[0].setParanoidUser(linkedUser).then(user => {
              expect(user.deletedAt).not.to.exist;
            });
          });
        });
      });
    });

    it('can reuse query option objects', function() {
      return this.User.create({ username: 'fnord' }).then(() => {
        const query = { where: { username: 'fnord' } };
        return this.User.findAll(query).then(users => {
          expect(users[0].username).to.equal('fnord');
          return this.User.findAll(query).then(users => {
            expect(users[0].username).to.equal('fnord');
          });
        });
      });
    });
  });

  describe('findOne', () => {
    it('can reuse query option objects', function() {
      return this.User.create({ username: 'fnord' }).then(() => {
        const query = { where: { username: 'fnord' } };
        return this.User.findOne(query).then(user => {
          expect(user.username).to.equal('fnord');
          return this.User.findOne(query).then(user => {
            expect(user.username).to.equal('fnord');
          });
        });
      });
    });
    it('returns null for null, undefined, and unset boolean values', function() {
      const Setting = this.sequelize.define('SettingHelper', {
        setting_key: DataTypes.STRING,
        bool_value: { type: DataTypes.BOOLEAN, allowNull: true },
        bool_value2: { type: DataTypes.BOOLEAN, allowNull: true },
        bool_value3: { type: DataTypes.BOOLEAN, allowNull: true }
      }, { timestamps: false, logging: false });

      return Setting.sync({ force: true }).then(() => {
        return Setting.create({ setting_key: 'test', bool_value: null, bool_value2: undefined }).then(() => {
          return Setting.findOne({ where: { setting_key: 'test' } }).then(setting => {
            expect(setting.bool_value).to.equal(null);
            expect(setting.bool_value2).to.equal(null);
            expect(setting.bool_value3).to.equal(null);
          });
        });
      });
    });
  });

  describe('equals', () => {
    it('can compare records with Date field', function() {
      return this.User.create({ username: 'fnord' }).then(user1 => {
        return this.User.findOne({ where: { username: 'fnord' } }).then(user2 => {
          expect(user1.equals(user2)).to.be.true;
        });
      });
    });

    it('does not compare the existence of associations', function() {
      this.UserAssociationEqual = this.sequelize.define('UserAssociationEquals', {
        username: DataTypes.STRING,
        age: DataTypes.INTEGER
      }, { timestamps: false });

      this.ProjectAssociationEqual = this.sequelize.define('ProjectAssocationEquals', {
        title: DataTypes.STRING,
        overdue_days: DataTypes.INTEGER
      }, { timestamps: false });

      this.UserAssociationEqual.hasMany(this.ProjectAssociationEqual, { as: 'Projects', foreignKey: 'userId' });
      this.ProjectAssociationEqual.belongsTo(this.UserAssociationEqual, { as: 'Users', foreignKey: 'userId' });

      return this.UserAssociationEqual.sync({ force: true }).then(() => {
        return this.ProjectAssociationEqual.sync({ force: true }).then(() => {
          return this.UserAssociationEqual.create({ username: 'jimhalpert' }).then(user1 => {
            return this.ProjectAssociationEqual.create({ title: 'A Cool Project' }).then(project1 => {
              return user1.setProjects([project1]).then(() => {
                return this.UserAssociationEqual.findOne({ where: { username: 'jimhalpert' }, include: [{ model: this.ProjectAssociationEqual, as: 'Projects' }] }).then(user2 => {
                  return this.UserAssociationEqual.create({ username: 'pambeesly' }).then(user3 => {
                    expect(user1.get('Projects')).to.not.exist;
                    expect(user2.get('Projects')).to.exist;
                    expect(user1.equals(user2)).to.be.true;
                    expect(user2.equals(user1)).to.be.true;
                    expect(user1.equals(user3)).to.not.be.true;
                    expect(user3.equals(user1)).to.not.be.true;
                  });
                });
              });
            });
          });
        });
      });
    });
  });

  describe('values', () => {
    it('returns all values', function() {
      const User = this.sequelize.define('UserHelper', {
        username: DataTypes.STRING
      }, { timestamps: false, logging: false });

      return User.sync().then(() => {
        const user = User.build({ username: 'foo' });
        expect(user.get({ plain: true })).to.deep.equal({ username: 'foo', id: null });
      });
    });
  });

  describe('destroy', () => {
    if (current.dialect.supports.transactions) {
      it('supports transactions', function() {
        return Support.prepareTransactionTest(this.sequelize).then(sequelize => {
          const User = sequelize.define('User', { username: Support.Sequelize.STRING });

          return User.sync({ force: true }).then(() => {
            return User.create({ username: 'foo' }).then(user => {
              return sequelize.transaction().then(t => {
                return user.destroy({ transaction: t }).then(() => {
                  return User.count().then(count1 => {
                    return User.count({ transaction: t }).then(count2 => {
                      expect(count1).to.equal(1);
                      expect(count2).to.equal(0);
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

    it('does not set the deletedAt date in subsequent destroys if dao is paranoid', function() {
      const UserDestroy = this.sequelize.define('UserDestroy', {
        name: Support.Sequelize.STRING,
        bio: Support.Sequelize.TEXT
      }, { paranoid: true });

      return UserDestroy.sync({ force: true }).then(() => {
        return UserDestroy.create({ name: 'hallo', bio: 'welt' }).then(user => {
          return user.destroy().then(() => {
            return user.reload({ paranoid: false }).then(() => {
              const deletedAt = user.deletedAt;

              return user.destroy().then(() => {
                return user.reload({ paranoid: false }).then(() => {
                  expect(user.deletedAt).to.eql(deletedAt);
                });
              });
            });
          });
        });
      });
    });

    it('deletes a record from the database if dao is not paranoid', function() {
      const UserDestroy = this.sequelize.define('UserDestroy', {
        name: Support.Sequelize.STRING,
        bio: Support.Sequelize.TEXT
      });

      return UserDestroy.sync({ force: true }).then(() => {
        return UserDestroy.create({ name: 'hallo', bio: 'welt' }).then(u => {
          return UserDestroy.findAll().then(users => {
            expect(users.length).to.equal(1);
            return u.destroy().then(() => {
              return UserDestroy.findAll().then(users => {
                expect(users.length).to.equal(0);
              });
            });
          });
        });
      });
    });

    it('allows sql logging of delete statements', function() {
      const UserDelete = this.sequelize.define('UserDelete', {
        name: Support.Sequelize.STRING,
        bio: Support.Sequelize.TEXT
      });

      return UserDelete.sync({ force: true }).then(() => {
        return UserDelete.create({ name: 'hallo', bio: 'welt' }).then(u => {
          return UserDelete.findAll().then(users => {
            expect(users.length).to.equal(1);
            return u.destroy({
              logging(sql) {
                expect(sql).to.exist;
                expect(sql.toUpperCase()).to.include('DELETE');
              }
            });
          });
        });
      });
    });

    it('delete a record of multiple primary keys table', function() {
      const MultiPrimary = this.sequelize.define('MultiPrimary', {
        bilibili: {
          type: Support.Sequelize.CHAR(2),
          primaryKey: true
        },

        guruguru: {
          type: Support.Sequelize.CHAR(2),
          primaryKey: true
        }
      });

      return MultiPrimary.sync({ force: true }).then(() => {
        return MultiPrimary.create({ bilibili: 'bl', guruguru: 'gu' }).then(() => {
          return MultiPrimary.create({ bilibili: 'bl', guruguru: 'ru' }).then(m2 => {
            return MultiPrimary.findAll().then(ms => {
              expect(ms.length).to.equal(2);
              return m2.destroy({
                logging(sql) {
                  expect(sql).to.exist;
                  expect(sql.toUpperCase()).to.include('DELETE');
                  expect(sql).to.include('ru');
                  expect(sql).to.include('bl');
                }
              }).then(() => {
                return MultiPrimary.findAll().then(ms => {
                  expect(ms.length).to.equal(1);
                  expect(ms[0].bilibili).to.equal('bl');
                  expect(ms[0].guruguru).to.equal('gu');
                });
              });
            });
          });
        });
      });
    });

    if (dialect.match(/^postgres/)) {
      it('converts Infinity in where clause to a timestamp', function() {
        const Date = this.sequelize.define('Date',
          {
            date: {
              type: DataTypes.DATE,
              primaryKey: true
            },
            deletedAt: {
              type: DataTypes.DATE,
              defaultValue: Infinity
            }
          },
          { paranoid: true });

        return this.sequelize.sync({ force: true })
          .then(() => {
            return Date.build({ date: Infinity })
              .save()
              .then(date => {
                return date.destroy();
              });
          });
      });
    }
  });

  describe('isSoftDeleted', () => {
    beforeEach(function() {
      this.ParanoidUser = this.sequelize.define('ParanoidUser', {
        username: { type: DataTypes.STRING }
      }, { paranoid: true });

      return this.ParanoidUser.sync({ force: true });
    });

    it('returns false if user is not soft deleted', function() {
      return this.ParanoidUser.create({ username: 'fnord' }).then(() => {
        return this.ParanoidUser.findAll().then(users => {
          expect(users[0].isSoftDeleted()).to.be.false;
        });
      });
    });

    it('returns true if user is soft deleted', function() {
      return this.ParanoidUser.create({ username: 'fnord' }).then(() => {
        return this.ParanoidUser.findAll().then(users => {
          return users[0].destroy().then(() => {
            expect(users[0].isSoftDeleted()).to.be.true;

            return users[0].reload({ paranoid: false }).then(user => {
              expect(user.isSoftDeleted()).to.be.true;
            });
          });
        });
      });
    });

    it('works with custom `deletedAt` field name', function() {
      this.ParanoidUserWithCustomDeletedAt = this.sequelize.define('ParanoidUserWithCustomDeletedAt', {
        username: { type: DataTypes.STRING }
      }, {
        deletedAt: 'deletedAtThisTime',
        paranoid: true
      });

      this.ParanoidUserWithCustomDeletedAt.hasOne(this.ParanoidUser);

      return this.ParanoidUserWithCustomDeletedAt.sync({ force: true }).then(() => {
        return this.ParanoidUserWithCustomDeletedAt.create({ username: 'fnord' }).then(() => {
          return this.ParanoidUserWithCustomDeletedAt.findAll().then(users => {
            expect(users[0].isSoftDeleted()).to.be.false;

            return users[0].destroy().then(() => {
              expect(users[0].isSoftDeleted()).to.be.true;

              return users[0].reload({ paranoid: false }).then(user => {
                expect(user.isSoftDeleted()).to.be.true;
              });
            });
          });
        });
      });
    });
  });

  describe('restore', () => {
    it('returns an error if the model is not paranoid', function() {
      return this.User.create({ username: 'Peter', secretValue: '42' }).then(user => {
        expect(() => {user.restore();}).to.throw(Error, 'Model is not paranoid');
      });
    });

    it('restores a previously deleted model', function() {
      const ParanoidUser = this.sequelize.define('ParanoidUser', {
          username: DataTypes.STRING,
          secretValue: DataTypes.STRING,
          data: DataTypes.STRING,
          intVal: { type: DataTypes.INTEGER, defaultValue: 1 }
        }, {
          paranoid: true
        }),
        data = [{ username: 'Peter', secretValue: '42' },
          { username: 'Paul', secretValue: '43' },
          { username: 'Bob', secretValue: '44' }];

      return ParanoidUser.sync({ force: true }).then(() => {
        return ParanoidUser.bulkCreate(data);
      }).then(() => {
        return ParanoidUser.findOne({ where: { secretValue: '42' } });
      }).then(user => {
        return user.destroy().then(() => {
          return user.restore();
        });
      }).then(() => {
        return ParanoidUser.findOne({ where: { secretValue: '42' } });
      }).then(user => {
        expect(user).to.be.ok;
        expect(user.username).to.equal('Peter');
      });
    });
  });
});
