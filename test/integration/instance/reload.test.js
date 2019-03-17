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
});
