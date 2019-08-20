'use strict';

const chai = require('chai'),
  expect = chai.expect,
  sinon = require('sinon'),
  moment = require('moment'),
  Support = require('../support'),
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

    it('does not update deletedAt with custom default in subsequent destroys', function() {
      const ParanoidUser = this.sequelize.define('ParanoidUser', {
        username: Support.Sequelize.STRING,
        deletedAt: { type: Support.Sequelize.DATE, defaultValue: new Date(0) }
      }, { paranoid: true });

      let deletedAt;
      return ParanoidUser.sync({ force: true }).then(() => {
        return ParanoidUser.create({
          username: 'username'
        });
      }).then(user => {
        return user.destroy();
      }).then(user => {
        deletedAt = user.deletedAt;
        expect(deletedAt).to.be.ok;
        expect(deletedAt.getTime()).to.be.ok;

        return user.destroy();
      }).then(user => {
        expect(user).to.be.ok;
        expect(user.deletedAt).to.be.ok;
        expect(user.deletedAt.toISOString()).to.equal(deletedAt.toISOString());
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

    it('allows updating soft deleted instance', function() {
      const ParanoidUser = this.sequelize.define('ParanoidUser', {
        username: Support.Sequelize.STRING
      }, { paranoid: true });

      let deletedAt;
      return ParanoidUser.sync({ force: true }).then(() => {
        return ParanoidUser.create({
          username: 'username'
        });
      }).then(user => {
        return user.destroy();
      }).then(user => {
        expect(user.deletedAt).to.be.ok;
        deletedAt = user.deletedAt;
        user.username = 'foo';
        return user.save();
      }).then(user => {
        expect(user.username).to.equal('foo');
        expect(user.deletedAt).to.equal(deletedAt, 'should not update deletedAt');

        return ParanoidUser.findOne({
          paranoid: false,
          where: {
            username: 'foo'
          }
        });
      }).then(user => {
        expect(user).to.be.ok;
        expect(user.deletedAt).to.be.ok;
      });
    });

    it('supports custom deletedAt field', function() {
      const ParanoidUser = this.sequelize.define('ParanoidUser', {
        username: Support.Sequelize.STRING,
        destroyTime: Support.Sequelize.DATE
      }, { paranoid: true, deletedAt: 'destroyTime' });

      return ParanoidUser.sync({ force: true }).then(() => {
        return ParanoidUser.create({
          username: 'username'
        });
      }).then(user => {
        return user.destroy();
      }).then(user => {
        expect(user.destroyTime).to.be.ok;
        expect(user.deletedAt).to.not.be.ok;

        return ParanoidUser.findOne({
          paranoid: false,
          where: {
            username: 'username'
          }
        });
      }).then(user => {
        expect(user).to.be.ok;
        expect(user.destroyTime).to.be.ok;
        expect(user.deletedAt).to.not.be.ok;
      });
    });

    it('supports custom deletedAt database column', function() {
      const ParanoidUser = this.sequelize.define('ParanoidUser', {
        username: Support.Sequelize.STRING,
        deletedAt: { type: Support.Sequelize.DATE, field: 'deleted_at' }
      }, { paranoid: true });

      return ParanoidUser.sync({ force: true }).then(() => {
        return ParanoidUser.create({
          username: 'username'
        });
      }).then(user => {
        return user.destroy();
      }).then(user => {
        expect(user.dataValues.deletedAt).to.be.ok;
        expect(user.dataValues.deleted_at).to.not.be.ok;

        return ParanoidUser.findOne({
          paranoid: false,
          where: {
            username: 'username'
          }
        });
      }).then(user => {
        expect(user).to.be.ok;
        expect(user.deletedAt).to.be.ok;
        expect(user.deleted_at).to.not.be.ok;
      });
    });

    it('supports custom deletedAt field and database column', function() {
      const ParanoidUser = this.sequelize.define('ParanoidUser', {
        username: Support.Sequelize.STRING,
        destroyTime: { type: Support.Sequelize.DATE, field: 'destroy_time' }
      }, { paranoid: true, deletedAt: 'destroyTime' });

      return ParanoidUser.sync({ force: true }).then(() => {
        return ParanoidUser.create({
          username: 'username'
        });
      }).then(user => {
        return user.destroy();
      }).then(user => {
        expect(user.dataValues.destroyTime).to.be.ok;
        expect(user.dataValues.destroy_time).to.not.be.ok;

        return ParanoidUser.findOne({
          paranoid: false,
          where: {
            username: 'username'
          }
        });
      }).then(user => {
        expect(user).to.be.ok;
        expect(user.destroyTime).to.be.ok;
        expect(user.destroy_time).to.not.be.ok;
      });
    });

    it('persists other model changes when soft deleting', function() {
      const ParanoidUser = this.sequelize.define('ParanoidUser', {
        username: Support.Sequelize.STRING
      }, { paranoid: true });

      let deletedAt;
      return ParanoidUser.sync({ force: true }).then(() => {
        return ParanoidUser.create({
          username: 'username'
        });
      }).then(user => {
        user.username = 'foo';
        return user.destroy();
      }).then(user => {
        expect(user.username).to.equal('foo');
        expect(user.deletedAt).to.be.ok;
        deletedAt = user.deletedAt;

        return ParanoidUser.findOne({
          paranoid: false,
          where: {
            username: 'foo'
          }
        });
      }).tap(user => {
        expect(user).to.be.ok;
        expect(moment.utc(user.deletedAt).startOf('second').toISOString())
          .to.equal(moment.utc(deletedAt).startOf('second').toISOString());
        expect(user.username).to.equal('foo');
      }).then(user => {
        // update model and delete again
        user.username = 'bar';
        return user.destroy();
      }).then(user => {
        expect(moment.utc(user.deletedAt).startOf('second').toISOString())
          .to.equal(moment.utc(deletedAt).startOf('second').toISOString(),
            'should not updated deletedAt when destroying multiple times');

        return ParanoidUser.findOne({
          paranoid: false,
          where: {
            username: 'bar'
          }
        });
      }).then(user => {
        expect(user).to.be.ok;
        expect(moment.utc(user.deletedAt).startOf('second').toISOString())
          .to.equal(moment.utc(deletedAt).startOf('second').toISOString());
        expect(user.username).to.equal('bar');
      });
    });

    it('allows sql logging of delete statements', function() {
      const UserDelete = this.sequelize.define('UserDelete', {
        name: Support.Sequelize.STRING,
        bio: Support.Sequelize.TEXT
      });

      const logging = sinon.spy();

      return UserDelete.sync({ force: true }).then(() => {
        return UserDelete.create({ name: 'hallo', bio: 'welt' }).then(u => {
          return UserDelete.findAll().then(users => {
            expect(users.length).to.equal(1);
            return u.destroy({ logging });
          });
        });
      }).then(() => {
        expect(logging.callCount).to.equal(1, 'should call logging');
        const sql = logging.firstCall.args[0];
        expect(sql).to.exist;
        expect(sql.toUpperCase()).to.include('DELETE');
      });
    });

    it('allows sql logging of update statements', function() {
      const UserDelete = this.sequelize.define('UserDelete', {
        name: Support.Sequelize.STRING,
        bio: Support.Sequelize.TEXT
      }, { paranoid: true });

      const logging = sinon.spy();

      return UserDelete.sync({ force: true }).then(() => {
        return UserDelete.create({ name: 'hallo', bio: 'welt' }).then(u => {
          return UserDelete.findAll().then(users => {
            expect(users.length).to.equal(1);
            return u.destroy({ logging });
          });
        });
      }).then(() => {
        expect(logging.callCount).to.equal(1, 'should call logging');
        const sql = logging.firstCall.args[0];
        expect(sql).to.exist;
        expect(sql.toUpperCase()).to.include('UPDATE');
      });
    });

    it('should not call save hooks when soft deleting', function() {
      const beforeSave = sinon.spy();
      const afterSave = sinon.spy();

      const ParanoidUser = this.sequelize.define('ParanoidUser', {
        username: Support.Sequelize.STRING
      }, {
        paranoid: true,
        hooks: {
          beforeSave,
          afterSave
        }
      });

      return ParanoidUser.sync({ force: true }).then(() => {
        return ParanoidUser.create({
          username: 'username'
        });
      }).then(user => {
        // clear out calls from .create
        beforeSave.resetHistory();
        afterSave.resetHistory();

        return user.destroy();
      }).tap(() => {
        expect(beforeSave.callCount).to.equal(0, 'should not call beforeSave');
        expect(afterSave.callCount).to.equal(0, 'should not call afterSave');
      }).then(user => {
        // now try with `hooks: true`
        return user.destroy({ hooks: true });
      }).tap(() => {
        expect(beforeSave.callCount).to.equal(0, 'should not call beforeSave even if `hooks: true`');
        expect(afterSave.callCount).to.equal(0, 'should not call afterSave even if `hooks: true`');
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
              type: Support.Sequelize.DATE,
              primaryKey: true
            },
            deletedAt: {
              type: Support.Sequelize.DATE,
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
