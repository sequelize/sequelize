'use strict';

const chai = require('chai'),
  expect = chai.expect,
  Support = require('../support'),
  DataTypes = require('../../../lib/data-types'),
  dialect = Support.getTestDialect(),
  current = Support.sequelize;

describe(Support.getTestDialectTeaser('Instance'), () => {
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
});
