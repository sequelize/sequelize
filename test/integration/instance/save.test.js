'use strict';

const chai = require('chai'),
  expect = chai.expect,
  Sequelize = require('../../../index'),
  Support = require('../support'),
  DataTypes = require('../../../lib/data-types'),
  config = require('../../config/config'),
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

  describe('save', () => {
    if (current.dialect.supports.transactions) {
      it('supports transactions', function() {
        return Support.prepareTransactionTest(this.sequelize).then(sequelize => {
          const User = sequelize.define('User', { username: Support.Sequelize.STRING });
          return User.sync({ force: true }).then(() => {
            return sequelize.transaction().then(t => {
              return new User({ username: 'foo' }).save({ transaction: t }).then(() => {
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
      return new this.User({
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

        User.addHook('beforeUpdate', instance => {
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

        User.addHook('beforeUpdate', instance => {
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

        User.addHook('beforeUpdate', instance => {
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

        User.addHook('beforeUpdate', instance => {
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
        user = new this.User({
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

      const user = new this.User({ username: 'user' });
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
      return new this.User({ aNumber: 0, validateCustom: 'aaaaaaaaaaaaaaaaaaaaaaaaaa' }).save()
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
      return new this.User({ aNumber: 0 }).save({
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
});
