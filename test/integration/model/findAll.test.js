'use strict';

/* jshint -W030 */
/* jshint -W110 */
var chai = require('chai')
  , sinon = require('sinon')
  , Sequelize = require('../../../index')
  , expect = chai.expect
  , Support = require(__dirname + '/../support')
  , DataTypes = require(__dirname + '/../../../lib/data-types')
  , dialect = Support.getTestDialect()
  , config = require(__dirname + '/../../config/config')
  , _ = require('lodash')
  , moment = require('moment')
  , current = Support.sequelize;

describe(Support.getTestDialectTeaser('Model'), function() {
  beforeEach(function() {
    this.User = this.sequelize.define('User', {
      username: DataTypes.STRING,
      secretValue: DataTypes.STRING,
      data: DataTypes.STRING,
      intVal: DataTypes.INTEGER,
      theDate: DataTypes.DATE,
      aBool: DataTypes.BOOLEAN,
      binary: DataTypes.STRING(16, true)
    });

    return this.User.sync({ force: true });
  });

  describe('findAll', function() {
    if (current.dialect.supports.transactions) {
      it('supports transactions', function() {
        return Support.prepareTransactionTest(this.sequelize).bind({}).then(function(sequelize) {
          var User = sequelize.define('User', { username: Sequelize.STRING });

          return User.sync({ force: true }).then(function() {
            return sequelize.transaction().then(function(t) {
              return User.create({ username: 'foo' }, { transaction: t }).then(function() {
                return User.findAll({ username: 'foo' }).then(function(users1) {
                  return User.findAll({ transaction: t }).then(function(users2) {
                    return User.findAll({ username: 'foo' }, { transaction: t }).then(function(users3) {
                      expect(users1.length).to.equal(0);
                      expect(users2.length).to.equal(1);
                      expect(users3.length).to.equal(1);
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

    describe('special where conditions/smartWhere object', function() {
      beforeEach(function() {
        this.buf = new Buffer(16);
        this.buf.fill('\x01');
        return this.User.bulkCreate([
          {username: 'boo', intVal: 5, theDate: '2013-01-01 12:00'},
          {username: 'boo2', intVal: 10, theDate: '2013-01-10 12:00', binary: this.buf }
        ]);
      });

      it('should be able to find rows where attribute is in a list of values', function() {
        return this.User.findAll({
          where: {
            username: ['boo', 'boo2']
          }
        }).then(function(users) {
          expect(users).to.have.length(2);
        });
      });

      it('should not break when trying to find rows using an array of primary keys', function() {
        return this.User.findAll({
          where: {
            id: [1, 2, 3]
          }
        });
      });

      it('should not break when using smart syntax on binary fields', function() {
        return this.User.findAll({
          where: {
            binary: [this.buf, this.buf]
          }
        }).then(function(users) {
          expect(users).to.have.length(1);
          expect(users[0].binary).to.be.an.instanceof.string;
          expect(users[0].username).to.equal('boo2');
        });
      });

      it('should be able to find a row using like', function() {
        return this.User.findAll({
          where: {
            username: {
              like: '%2'
            }
          }
        }).then(function(users) {
          expect(users).to.be.an.instanceof(Array);
          expect(users).to.have.length(1);
          expect(users[0].username).to.equal('boo2');
          expect(users[0].intVal).to.equal(10);
        });
      });

      it('should be able to find a row using not like', function() {
        return this.User.findAll({
          where: {
            username: {
              nlike: '%2'
            }
          }
        }).then(function(users) {
          expect(users).to.be.an.instanceof(Array);
          expect(users).to.have.length(1);
          expect(users[0].username).to.equal('boo');
          expect(users[0].intVal).to.equal(5);
        });
      });

      if (dialect === 'postgres') {
        it('should be able to find a row using ilike', function() {
          return this.User.findAll({
            where: {
              username: {
                ilike: '%2'
              }
            }
          }).then(function(users) {
            expect(users).to.be.an.instanceof(Array);
            expect(users).to.have.length(1);
            expect(users[0].username).to.equal('boo2');
            expect(users[0].intVal).to.equal(10);
          });
        });

        it('should be able to find a row using not ilike', function() {
          return this.User.findAll({
            where: {
              username: {
                notilike: '%2'
              }
            }
          }).then(function(users) {
            expect(users).to.be.an.instanceof(Array);
            expect(users).to.have.length(1);
            expect(users[0].username).to.equal('boo');
            expect(users[0].intVal).to.equal(5);
          });
        });
      }

      it('should be able to find a row between a certain date using the between shortcut', function() {
        return this.User.findAll({
          where: {
            theDate: {
              '..': ['2013-01-02', '2013-01-11']
            }
          }
        }).then(function(users) {
          expect(users[0].username).to.equal('boo2');
          expect(users[0].intVal).to.equal(10);
        });
      });

      it('should be able to find a row not between a certain integer using the not between shortcut', function() {
        return this.User.findAll({
          where: {
            intVal: {
              '!..': [8, 10]
            }
          }
        }).then(function(users) {
          expect(users[0].username).to.equal('boo');
          expect(users[0].intVal).to.equal(5);
        });
      });

      it('should be able to handle false/true values just fine...', function() {
        var User = this.User
          , escapeChar = (dialect === 'postgres' || dialect === 'mssql') ? '"' : '`';

        return User.bulkCreate([
          {username: 'boo5', aBool: false},
          {username: 'boo6', aBool: true}
        ]).then(function() {
          return User.findAll({where: [escapeChar + 'aBool' + escapeChar + ' = ?', false]}).then(function(users) {
            expect(users).to.have.length(1);
            expect(users[0].username).to.equal('boo5');
            return User.findAll({where: [escapeChar + 'aBool' + escapeChar + ' = ?', true]}).then(function(_users) {
              expect(_users).to.have.length(1);
              expect(_users[0].username).to.equal('boo6');
            });
          });
        });
      });

      it('should be able to handle false/true values through associations as well...', function() {
        var User = this.User
          , escapeChar = (dialect === 'postgres' || dialect === 'mssql') ? '"' : '`'
          , Passports = this.sequelize.define('Passports', {
              isActive: Sequelize.BOOLEAN
            });

        User.hasMany(Passports);
        Passports.belongsTo(User);

        return User.sync({ force: true }).then(function() {
          return Passports.sync({ force: true }).then(function() {
            return User.bulkCreate([
              {username: 'boo5', aBool: false},
              {username: 'boo6', aBool: true}
            ]).then(function() {
              return Passports.bulkCreate([
                {isActive: true},
                {isActive: false}
              ]).then(function() {
                return User.find(1).then(function(user) {
                  return Passports.find(1).then(function(passport) {
                    return user.setPassports([passport]).then(function() {
                      return User.find(2).then(function(_user) {
                        return Passports.find(2).then(function(_passport) {
                          return _user.setPassports([_passport]).then(function() {
                            return _user.getPassports({where: [escapeChar + 'isActive' + escapeChar + ' = ?', false]}).then(function(theFalsePassport) {
                              return user.getPassports({where: [escapeChar + 'isActive' + escapeChar + ' = ?', true]}).then(function(theTruePassport) {
                                expect(theFalsePassport).to.have.length(1);
                                expect(theFalsePassport[0].isActive).to.be.false;
                                expect(theTruePassport).to.have.length(1);
                                expect(theTruePassport[0].isActive).to.be.true;
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
      });

      it('should be able to handle binary values through associations as well...', function() {
        var User = this.User;
        var Binary = this.sequelize.define('Binary', {
          id: {
            type: DataTypes.STRING(16, true),
            primaryKey: true
          }
        });

        var buf1 = this.buf;
        var buf2 = new Buffer(16);
        buf2.fill('\x02');

        User.belongsTo(Binary, { foreignKey: 'binary' });

        return this.sequelize.sync({ force: true }).then(function() {
          return User.bulkCreate([
            {username: 'boo5', aBool: false},
            {username: 'boo6', aBool: true}
          ]).then(function() {
            return Binary.bulkCreate([
              {id: buf1},
              {id: buf2}
            ]).then(function() {
              return User.find(1).then(function(user) {
                return Binary.find(buf1).then(function(binary) {
                  return user.setBinary(binary).then(function() {
                    return User.find(2).then(function(_user) {
                      return Binary.find(buf2).then(function(_binary) {
                        return _user.setBinary(_binary).then(function() {
                          return _user.getBinary().then(function(_binaryRetrieved) {
                            return user.getBinary().then(function(binaryRetrieved) {
                              expect(binaryRetrieved.id).to.be.an.instanceof.string;
                              expect(_binaryRetrieved.id).to.be.an.instanceof.string;
                              expect(binaryRetrieved.id).to.have.length(16);
                              expect(_binaryRetrieved.id).to.have.length(16);
                              expect(binaryRetrieved.id.toString()).to.be.equal(buf1.toString());
                              expect(_binaryRetrieved.id.toString()).to.be.equal(buf2.toString());
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

      it('should be able to return a record with primaryKey being null for new inserts', function() {
        var Session = this.sequelize.define('Session', {
            token: { type: DataTypes.TEXT, allowNull: false },
            lastUpdate: { type: DataTypes.DATE, allowNull: false }
          }, {
              charset: 'utf8',
              collate: 'utf8_general_ci',
              omitNull: true
            })

          , User = this.sequelize.define('User', {
              name: { type: DataTypes.STRING, allowNull: false, unique: true },
              password: { type: DataTypes.STRING, allowNull: false },
              isAdmin: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: false }
            }, {
              charset: 'utf8',
              collate: 'utf8_general_ci'
            });

        User.hasMany(Session, { as: 'Sessions' });
        Session.belongsTo(User);

        return this.sequelize.sync({ force: true }).then(function() {
          return User.create({name: 'Name1', password: '123', isAdmin: false}).then(function(user) {
            var sess = Session.build({
              lastUpdate: new Date(),
              token: '123'
            });

            return user.addSession(sess).then(function(u) {
              expect(u.token).to.equal('123');
            });
          });
        });
      });

      it('should be able to find a row between a certain date', function() {
        return this.User.findAll({
          where: {
            theDate: {
              between: ['2013-01-02', '2013-01-11']
            }
          }
        }).then(function(users) {
          expect(users[0].username).to.equal('boo2');
          expect(users[0].intVal).to.equal(10);
        });
      });

      it('should be able to find a row between a certain date and an additional where clause', function() {
        return this.User.findAll({
          where: {
            theDate: {
              between: ['2013-01-02', '2013-01-11']
            },
            intVal: 10
          }
        }).then(function(users) {
          expect(users[0].username).to.equal('boo2');
          expect(users[0].intVal).to.equal(10);
        });
      });

      it('should be able to find a row not between a certain integer', function() {
        return this.User.findAll({
          where: {
            intVal: {
              nbetween: [8, 10]
            }
          }
        }).then(function(users) {
          expect(users[0].username).to.equal('boo');
          expect(users[0].intVal).to.equal(5);
        });
      });

      it('should be able to find a row using not between and between logic', function() {
        return this.User.findAll({
          where: {
            theDate: {
              between: ['2012-12-10', '2013-01-02'],
              nbetween: ['2013-01-04', '2013-01-20']
            }
          }
        }).then(function(users) {
          expect(users[0].username).to.equal('boo');
          expect(users[0].intVal).to.equal(5);
        });
      });

      it('should be able to find a row using not between and between logic with dates', function() {
        return this.User.findAll({
          where: {
            theDate: {
              between: [new Date('2012-12-10'), new Date('2013-01-02')],
              nbetween: [new Date('2013-01-04'), new Date('2013-01-20')]
            }
          }
        }).then(function(users) {
          expect(users[0].username).to.equal('boo');
          expect(users[0].intVal).to.equal(5);
        });
      });

      it('should be able to find a row using greater than or equal to logic with dates', function() {
        return this.User.findAll({
          where: {
            theDate: {
              gte: new Date('2013-01-09')
            }
          }
        }).then(function(users) {
          expect(users[0].username).to.equal('boo2');
          expect(users[0].intVal).to.equal(10);
        });
      });

      it('should be able to find a row using greater than or equal to', function() {
        return this.User.find({
          where: {
            intVal: {
              gte: 6
            }
          }
        }).then(function(user) {
          expect(user.username).to.equal('boo2');
          expect(user.intVal).to.equal(10);
        });
      });

      it('should be able to find a row using greater than', function() {
        return this.User.find({
          where: {
            intVal: {
              gt: 5
            }
          }
        }).then(function(user) {
          expect(user.username).to.equal('boo2');
          expect(user.intVal).to.equal(10);
        });
      });

      it('should be able to find a row using lesser than or equal to', function() {
        return this.User.find({
          where: {
            intVal: {
              lte: 5
            }
          }
        }).then(function(user) {
          expect(user.username).to.equal('boo');
          expect(user.intVal).to.equal(5);
        });
      });

      it('should be able to find a row using lesser than', function() {
        return this.User.find({
          where: {
            intVal: {
              lt: 6
            }
          }
        }).then(function(user) {
          expect(user.username).to.equal('boo');
          expect(user.intVal).to.equal(5);
        });
      });

      it('should have no problem finding a row using lesser and greater than', function() {
        return this.User.findAll({
          where: {
            intVal: {
              lt: 6,
              gt: 4
            }
          }
        }).then(function(users) {
          expect(users[0].username).to.equal('boo');
          expect(users[0].intVal).to.equal(5);
        });
      });

      it('should be able to find a row using not equal to logic', function() {
        return this.User.find({
          where: {
            intVal: {
              ne: 10
            }
          }
        }).then(function(user) {
          expect(user.username).to.equal('boo');
          expect(user.intVal).to.equal(5);
        });
      });

      it('should be able to find multiple users with any of the special where logic properties', function() {
        return this.User.findAll({
          where: {
            intVal: {
              lte: 10
            }
          }
        }).then(function(users) {
          expect(users[0].username).to.equal('boo');
          expect(users[0].intVal).to.equal(5);
          expect(users[1].username).to.equal('boo2');
          expect(users[1].intVal).to.equal(10);
        });
      });
    });

    it('should not crash on an empty where array', function () {
      return this.User.findAll({
        where: []
      });
    });

    describe('eager loading', function() {
      describe('belongsTo', function() {
        beforeEach(function() {
          var self = this;
          self.Task = self.sequelize.define('TaskBelongsTo', { title: Sequelize.STRING });
          self.Worker = self.sequelize.define('Worker', { name: Sequelize.STRING });
          self.Task.belongsTo(self.Worker);

          return self.Worker.sync({ force: true }).then(function() {
            return self.Task.sync({ force: true }).then(function() {
              return self.Worker.create({ name: 'worker' }).then(function(worker) {
                return self.Task.create({ title: 'homework' }).then(function(task) {
                  self.worker = worker;
                  self.task = task;
                  return self.task.setWorker(self.worker);
                });
              });
            });
          });
        });

        it('throws an error about unexpected input if include contains a non-object', function() {
          var self = this;
          return self.Worker.findAll({ include: [1] }).catch (function(err) {
            expect(err.message).to.equal('Include unexpected. Element has to be either a Model, an Association or an object.');
          });
        });

        it('throws an error if included DaoFactory is not associated', function() {
          var self = this;
          return self.Worker.findAll({ include: [self.Task] }).catch (function(err) {
            expect(err.message).to.equal('TaskBelongsTo is not associated to Worker!');
          });
        });

        it('returns the associated worker via task.worker', function() {
          return this.Task.findAll({
            where: { title: 'homework' },
            include: [this.Worker]
          }).then(function(tasks) {
            expect(tasks).to.exist;
            expect(tasks[0].Worker).to.exist;
            expect(tasks[0].Worker.name).to.equal('worker');
          });
        });
      });

      describe('hasOne', function() {
        beforeEach(function() {
          var self = this;
          self.Task = self.sequelize.define('TaskHasOne', { title: Sequelize.STRING });
          self.Worker = self.sequelize.define('Worker', { name: Sequelize.STRING });
          self.Worker.hasOne(self.Task);
          return self.Worker.sync({ force: true }).then(function() {
            return self.Task.sync({ force: true }).then(function() {
              return self.Worker.create({ name: 'worker' }).then(function(worker) {
                return self.Task.create({ title: 'homework' }).then(function(task) {
                  self.worker = worker;
                  self.task = task;
                  return self.worker.setTaskHasOne(self.task);
                });
              });
            });
          });
        });

        it('throws an error if included DaoFactory is not associated', function() {
          var self = this;
          return self.Task.findAll({ include: [self.Worker] }).catch (function(err) {
            expect(err.message).to.equal('Worker is not associated to TaskHasOne!');
          });
        });

        it('returns the associated task via worker.task', function() {
          return this.Worker.findAll({
            where: { name: 'worker' },
            include: [this.Task]
          }).then(function(workers) {
            expect(workers).to.exist;
            expect(workers[0].TaskHasOne).to.exist;
            expect(workers[0].TaskHasOne.title).to.equal('homework');
          });
        });
      });

      describe('hasOne with alias', function() {
        beforeEach(function() {
          var self = this;
          self.Task = self.sequelize.define('Task', { title: Sequelize.STRING });
          self.Worker = self.sequelize.define('Worker', { name: Sequelize.STRING });
          self.Worker.hasOne(self.Task, { as: 'ToDo' });
          return self.Worker.sync({ force: true }).then(function() {
            return self.Task.sync({ force: true }).then(function() {
              return self.Worker.create({ name: 'worker' }).then(function(worker) {
                return self.Task.create({ title: 'homework' }).then(function(task) {
                  self.worker = worker;
                  self.task = task;
                  return self.worker.setToDo(self.task);
                });
              });
            });
          });
        });

        it('throws an error if included DaoFactory is not referenced by alias', function() {
          var self = this;
          return self.Worker.findAll({ include: [self.Task] }).catch (function(err) {
            expect(err.message).to.equal('Task is not associated to Worker!');
          });
        });

        it('throws an error if alias is not associated', function() {
          var self = this;
          return self.Worker.findAll({ include: [{ model: self.Task, as: 'Work' }] }).catch (function(err) {
            expect(err.message).to.equal('Task (Work) is not associated to Worker!');
          });
        });

        it('returns the associated task via worker.task', function() {
          return this.Worker.findAll({
            where: { name: 'worker' },
            include: [{ model: this.Task, as: 'ToDo' }]
          }).then(function(workers) {
            expect(workers).to.exist;
            expect(workers[0].ToDo).to.exist;
            expect(workers[0].ToDo.title).to.equal('homework');
          });
        });

        it('returns the associated task via worker.task when daoFactory is aliased with model', function() {
          return this.Worker.findAll({
            where: { name: 'worker' },
            include: [{ model: this.Task, as: 'ToDo' }]
          }).then(function(workers) {
            expect(workers[0].ToDo.title).to.equal('homework');
          });
        });
      });

      describe('hasMany', function() {
        beforeEach(function() {
          var self = this;
          self.Task = self.sequelize.define('task', { title: Sequelize.STRING });
          self.Worker = self.sequelize.define('worker', { name: Sequelize.STRING });
          self.Worker.hasMany(self.Task);
          return self.Worker.sync({ force: true }).then(function() {
            return self.Task.sync({ force: true }).then(function() {
              return self.Worker.create({ name: 'worker' }).then(function(worker) {
                return self.Task.create({ title: 'homework' }).then(function(task) {
                  self.worker = worker;
                  self.task = task;
                  return self.worker.setTasks([self.task]);
                });
              });
            });
          });
        });

        it('throws an error if included DaoFactory is not associated', function() {
          var self = this;
          return self.Task.findAll({ include: [self.Worker] }).catch (function(err) {
            expect(err.message).to.equal('worker is not associated to task!');
          });
        });

        it('returns the associated tasks via worker.tasks', function() {
          return this.Worker.findAll({
            where: { name: 'worker' },
            include: [this.Task]
          }).then(function(workers) {
            expect(workers).to.exist;
            expect(workers[0].tasks).to.exist;
            expect(workers[0].tasks[0].title).to.equal('homework');
          });
        });
      });

      describe('hasMany with alias', function() {
        beforeEach(function() {
          var self = this;
          self.Task = self.sequelize.define('Task', { title: Sequelize.STRING });
          self.Worker = self.sequelize.define('Worker', { name: Sequelize.STRING });
          self.Worker.hasMany(self.Task, { as: 'ToDos' });
          return self.Worker.sync({ force: true }).then(function() {
            return self.Task.sync({ force: true }).then(function() {
              return self.Worker.create({ name: 'worker' }).then(function(worker) {
                return self.Task.create({ title: 'homework' }).then(function(task) {
                  self.worker = worker;
                  self.task = task;
                  return self.worker.setToDos([self.task]);
                });
              });
            });
          });
        });

        it('throws an error if included DaoFactory is not referenced by alias', function() {
          var self = this;
          return self.Worker.findAll({ include: [self.Task] }).catch (function(err) {
            expect(err.message).to.equal('Task is not associated to Worker!');
          });
        });

        it('throws an error if alias is not associated', function() {
          var self = this;
          return self.Worker.findAll({ include: [{ model: self.Task, as: 'Work' }] }).catch (function(err) {
            expect(err.message).to.equal('Task (Work) is not associated to Worker!');
          });
        });

        it('returns the associated task via worker.task', function() {
          return this.Worker.findAll({
            where: { name: 'worker' },
            include: [{ model: this.Task, as: 'ToDos' }]
          }).then(function(workers) {
            expect(workers).to.exist;
            expect(workers[0].ToDos).to.exist;
            expect(workers[0].ToDos[0].title).to.equal('homework');
          });
        });

        it('returns the associated task via worker.task when daoFactory is aliased with model', function() {
          return this.Worker.findAll({
            where: { name: 'worker' },
            include: [{ model: this.Task, as: 'ToDos' }]
          }).then(function(workers) {
            expect(workers[0].ToDos[0].title).to.equal('homework');
          });
        });
      });

      describe('queryOptions', function() {
        beforeEach(function() {
          var self = this;
          return this.User.create({username: 'barfooz'}).then(function(user) {
            self.user = user;
          });
        });

        it('should return a DAO when queryOptions are not set', function() {
          var self = this;
          return this.User.findAll({ where: { username: 'barfooz'}}).then(function(users) {
            users.forEach(function(user) {
              expect(user).to.be.instanceOf(self.User.DAO);
            });
          });
        });

        it('should return a DAO when raw is false', function() {
          var self = this;
          return this.User.findAll({ where: { username: 'barfooz'}}, { raw: false }).then(function(users) {
            users.forEach(function(user) {
              expect(user).to.be.instanceOf(self.User.DAO);
            });
          });
        });

        it('should return raw data when raw is true', function() {
          var self = this;
          return this.User.findAll({ where: { username: 'barfooz'}}, { raw: true }).then(function(users) {
            users.forEach(function(user) {
              expect(user).to.not.be.instanceOf(self.User.DAO);
              expect(users[0]).to.be.instanceOf(Object);
            });
          });
        });
      });

      describe('include all', function() {
        beforeEach(function() {
          var self = this;

          self.Continent = this.sequelize.define('continent', { name: Sequelize.STRING });
          self.Country = this.sequelize.define('country', { name: Sequelize.STRING });
          self.Industry = this.sequelize.define('industry', { name: Sequelize.STRING });
          self.Person = this.sequelize.define('person', { name: Sequelize.STRING, lastName: Sequelize.STRING });

          self.Continent.hasMany(self.Country);
          self.Country.belongsTo(self.Continent);
          self.Country.hasMany(self.Industry);
          self.Industry.hasMany(self.Country);
          self.Country.hasMany(self.Person);
          self.Person.belongsTo(self.Country);
          self.Country.hasMany(self.Person, { as: 'residents', foreignKey: 'CountryResidentId' });
          self.Person.belongsTo(self.Country, { as: 'CountryResident', foreignKey: 'CountryResidentId' });

          return this.sequelize.sync({ force: true }).then(function() {
            return self.sequelize.Promise.props({
              europe: self.Continent.create({ name: 'Europe' }),
              england: self.Country.create({ name: 'England' }),
              coal: self.Industry.create({ name: 'Coal' }),
              bob: self.Person.create({ name: 'Bob', lastName: 'Becket' })
            }).then(function(r) {
              _.forEach(r, function(item, itemName) {
                self[itemName] = item;
              });
              return self.sequelize.Promise.all([
                self.england.setContinent(self.europe),
                self.england.addIndustry(self.coal),
                self.bob.setCountry(self.england),
                self.bob.setCountryResident(self.england)
              ]);
            });
          });
        });

        it('includes all associations', function() {
          return this.Country.findAll({ include: [{ all: true }] }).then(function(countries) {
            expect(countries).to.exist;
            expect(countries[0]).to.exist;
            expect(countries[0].continent).to.exist;
            expect(countries[0].industries).to.exist;
            expect(countries[0].people).to.exist;
            expect(countries[0].residents).to.exist;
          });
        });

        it('includes specific type of association', function() {
          return this.Country.findAll({ include: [{ all: 'BelongsTo' }] }).then(function(countries) {
            expect(countries).to.exist;
            expect(countries[0]).to.exist;
            expect(countries[0].continent).to.exist;
            expect(countries[0].industries).not.to.exist;
            expect(countries[0].people).not.to.exist;
            expect(countries[0].residents).not.to.exist;
          });
        });

        it('utilises specified attributes', function() {
          return this.Country.findAll({ include: [{ all: 'HasMany', attributes: ['name'] }] }).then(function(countries) {
            expect(countries).to.exist;
            expect(countries[0]).to.exist;
            expect(countries[0].industries).to.exist;
            expect(countries[0].people).to.exist;
            expect(countries[0].people[0]).to.exist;
            expect(countries[0].people[0].name).not.to.be.undefined;
            expect(countries[0].people[0].lastName).to.be.undefined;
            expect(countries[0].residents).to.exist;
            expect(countries[0].residents[0]).to.exist;
            expect(countries[0].residents[0].name).not.to.be.undefined;
            expect(countries[0].residents[0].lastName).to.be.undefined;
          });
        });

        it('is over-ruled by specified include', function() {
          return this.Country.findAll({ include: [{ all: true }, { model: this.Continent, attributes: ['id'] }] }).then(function(countries) {
            expect(countries).to.exist;
            expect(countries[0]).to.exist;
            expect(countries[0].continent).to.exist;
            expect(countries[0].continent.name).to.be.undefined;
          });
        });

        it('includes all nested associations', function() {
          return this.Continent.findAll({ include: [{ all: true, nested: true }] }).then(function(continents) {
            expect(continents).to.exist;
            expect(continents[0]).to.exist;
            expect(continents[0].countries).to.exist;
            expect(continents[0].countries[0]).to.exist;
            expect(continents[0].countries[0].industries).to.exist;
            expect(continents[0].countries[0].people).to.exist;
            expect(continents[0].countries[0].residents).to.exist;
            expect(continents[0].countries[0].continent).not.to.exist;
          });
        });
      });
    });

    describe('order by eager loaded tables', function() {
      describe('HasMany', function() {
        beforeEach(function() {
          var self = this;

          self.Continent = this.sequelize.define('continent', { name: Sequelize.STRING });
          self.Country = this.sequelize.define('country', { name: Sequelize.STRING });
          self.Person = this.sequelize.define('person', { name: Sequelize.STRING, lastName: Sequelize.STRING });

          self.Continent.hasMany(self.Country);
          self.Country.belongsTo(self.Continent);
          self.Country.hasMany(self.Person);
          self.Person.belongsTo(self.Country);
          self.Country.hasMany(self.Person, { as: 'residents', foreignKey: 'CountryResidentId' });
          self.Person.belongsTo(self.Country, { as: 'CountryResident', foreignKey: 'CountryResidentId' });

          return this.sequelize.sync({ force: true }).then(function() {
            return self.sequelize.Promise.props({
              europe: self.Continent.create({ name: 'Europe' }),
              asia: self.Continent.create({ name: 'Asia' }),
              england: self.Country.create({ name: 'England' }),
              france: self.Country.create({ name: 'France' }),
              korea: self.Country.create({ name: 'Korea' }),
              bob: self.Person.create({ name: 'Bob', lastName: 'Becket' }),
              fred: self.Person.create({ name: 'Fred', lastName: 'Able' }),
              pierre: self.Person.create({ name: 'Pierre', lastName: 'Paris' }),
              kim: self.Person.create({ name: 'Kim', lastName: 'Z' })
            }).then(function(r) {
              _.forEach(r, function(item, itemName) {
                self[itemName] = item;
              });

              return self.sequelize.Promise.all([
                self.england.setContinent(self.europe),
                self.france.setContinent(self.europe),
                self.korea.setContinent(self.asia),

                self.bob.setCountry(self.england),
                self.fred.setCountry(self.england),
                self.pierre.setCountry(self.france),
                self.kim.setCountry(self.korea),

                self.bob.setCountryResident(self.england),
                self.fred.setCountryResident(self.france),
                self.pierre.setCountryResident(self.korea),
                self.kim.setCountryResident(self.england)
              ]);
            });
          });
        });

        it('sorts simply', function() {
          var self = this;
          return this.sequelize.Promise.map([['ASC', 'Asia'], ['DESC', 'Europe']], function(params) {
            return self.Continent.findAll({
              order: [['name', params[0]]]
            }).then(function(continents) {
              expect(continents).to.exist;
              expect(continents[0]).to.exist;
              expect(continents[0].name).to.equal(params[1]);
            });
          });
        });

        it('sorts by 1st degree association', function() {
          var self = this;
          return this.sequelize.Promise.map([['ASC', 'Europe', 'England'], ['DESC', 'Asia', 'Korea']], function(params) {
            return self.Continent.findAll({
              include: [self.Country],
              order: [[self.Country, 'name', params[0]]]
            }).then(function(continents) {
              expect(continents).to.exist;
              expect(continents[0]).to.exist;
              expect(continents[0].name).to.equal(params[1]);
              expect(continents[0].countries).to.exist;
              expect(continents[0].countries[0]).to.exist;
              expect(continents[0].countries[0].name).to.equal(params[2]);
            });
          });
        });

        it('sorts by 2nd degree association', function() {
          var self = this;
          return this.sequelize.Promise.map([['ASC', 'Europe', 'England', 'Fred'], ['DESC', 'Asia', 'Korea', 'Kim']], function(params) {
            return self.Continent.findAll({
              include: [{ model: self.Country, include: [self.Person] }],
              order: [[self.Country, self.Person, 'lastName', params[0]]]
            }).then(function(continents) {
              expect(continents).to.exist;
              expect(continents[0]).to.exist;
              expect(continents[0].name).to.equal(params[1]);
              expect(continents[0].countries).to.exist;
              expect(continents[0].countries[0]).to.exist;
              expect(continents[0].countries[0].name).to.equal(params[2]);
              expect(continents[0].countries[0].people).to.exist;
              expect(continents[0].countries[0].people[0]).to.exist;
              expect(continents[0].countries[0].people[0].name).to.equal(params[3]);
            });
          });
        }),

        it('sorts by 2nd degree association with alias', function() {
          var self = this;
          return this.sequelize.Promise.map([['ASC', 'Europe', 'France', 'Fred'], ['DESC', 'Europe', 'England', 'Kim']], function(params) {
            return self.Continent.findAll({
              include: [{ model: self.Country, include: [self.Person, {model: self.Person, as: 'residents' }] }],
              order: [[self.Country, {model: self.Person, as: 'residents' }, 'lastName', params[0]]]
            }).then(function(continents) {
              expect(continents).to.exist;
              expect(continents[0]).to.exist;
              expect(continents[0].name).to.equal(params[1]);
              expect(continents[0].countries).to.exist;
              expect(continents[0].countries[0]).to.exist;
              expect(continents[0].countries[0].name).to.equal(params[2]);
              expect(continents[0].countries[0].residents).to.exist;
              expect(continents[0].countries[0].residents[0]).to.exist;
              expect(continents[0].countries[0].residents[0].name).to.equal(params[3]);
            });
          });
        });

        it('sorts by 2nd degree association with alias while using limit', function() {
          var self = this;
          return this.sequelize.Promise.map([['ASC', 'Europe', 'France', 'Fred'], ['DESC', 'Europe', 'England', 'Kim']], function(params) {
            return self.Continent.findAll({
              include: [{ model: self.Country, include: [self.Person, {model: self.Person, as: 'residents' }] }],
              order: [[{ model: self.Country }, {model: self.Person, as: 'residents' }, 'lastName', params[0]]],
              limit: 3
            }).then(function(continents) {
              expect(continents).to.exist;
              expect(continents[0]).to.exist;
              expect(continents[0].name).to.equal(params[1]);
              expect(continents[0].countries).to.exist;
              expect(continents[0].countries[0]).to.exist;
              expect(continents[0].countries[0].name).to.equal(params[2]);
              expect(continents[0].countries[0].residents).to.exist;
              expect(continents[0].countries[0].residents[0]).to.exist;
              expect(continents[0].countries[0].residents[0].name).to.equal(params[3]);
            });
          });
        });
      }),

      describe('ManyToMany', function() {
        beforeEach(function() {
          var self = this;

          self.Country = this.sequelize.define('country', { name: Sequelize.STRING });
          self.Industry = this.sequelize.define('industry', { name: Sequelize.STRING });
          self.IndustryCountry = this.sequelize.define('IndustryCountry', { numYears: Sequelize.INTEGER });

          self.Country.hasMany(self.Industry, {through: self.IndustryCountry});
          self.Industry.hasMany(self.Country, {through: self.IndustryCountry});

          return this.sequelize.sync({ force: true }).then(function() {
            return self.sequelize.Promise.props({
              england: self.Country.create({ name: 'England' }),
              france: self.Country.create({ name: 'France' }),
              korea: self.Country.create({ name: 'Korea' }),
              energy: self.Industry.create({ name: 'Energy' }),
              media: self.Industry.create({ name: 'Media' }),
              tech: self.Industry.create({ name: 'Tech' })
            }).then(function(r) {
              _.forEach(r, function(item, itemName) {
                self[itemName] = item;
              });

              return self.sequelize.Promise.all([
                self.england.addIndustry(self.energy, {numYears: 20}),
                self.england.addIndustry(self.media, {numYears: 40}),
                self.france.addIndustry(self.media, {numYears: 80}),
                self.korea.addIndustry(self.tech, {numYears: 30})
              ]);
            });
          });
        });

        it('sorts by 1st degree association', function() {
          var self = this;
          return this.sequelize.Promise.map([['ASC', 'England', 'Energy'], ['DESC', 'Korea', 'Tech']], function(params) {
            return self.Country.findAll({
              include: [self.Industry],
              order: [[self.Industry, 'name', params[0]]]
            }).then(function(countries) {
              expect(countries).to.exist;
              expect(countries[0]).to.exist;
              expect(countries[0].name).to.equal(params[1]);
              expect(countries[0].industries).to.exist;
              expect(countries[0].industries[0]).to.exist;
              expect(countries[0].industries[0].name).to.equal(params[2]);
            });
          });
        });

        it('sorts by 1st degree association while using limit', function() {
          var self = this;
          return this.sequelize.Promise.map([['ASC', 'England', 'Energy'], ['DESC', 'Korea', 'Tech']], function(params) {
            return self.Country.findAll({
              include: [self.Industry],
              order: [
                [self.Industry, 'name', params[0]]
              ],
              limit: 3
            }).then(function(countries) {
              expect(countries).to.exist;
              expect(countries[0]).to.exist;
              expect(countries[0].name).to.equal(params[1]);
              expect(countries[0].industries).to.exist;
              expect(countries[0].industries[0]).to.exist;
              expect(countries[0].industries[0].name).to.equal(params[2]);
            });
          });
        });

        it('sorts by through table attribute', function() {
          var self = this;
          return this.sequelize.Promise.map([['ASC', 'England', 'Energy'], ['DESC', 'France', 'Media']], function(params) {
            return self.Country.findAll({
              include: [self.Industry],
              order: [[self.Industry, self.IndustryCountry, 'numYears', params[0]]]
            }).then(function(countries) {
              expect(countries).to.exist;
              expect(countries[0]).to.exist;
              expect(countries[0].name).to.equal(params[1]);
              expect(countries[0].industries).to.exist;
              expect(countries[0].industries[0]).to.exist;
              expect(countries[0].industries[0].name).to.equal(params[2]);
            });
          });
        });
      });
    });

    describe('normal findAll', function() {
      beforeEach(function() {
        var self = this;
        return this.User.create({username: 'user', data: 'foobar', theDate: moment().toDate()}).then(function(user) {
          return self.User.create({username: 'user2', data: 'bar', theDate: moment().toDate()}).then(function(user2) {
            self.users = [user].concat(user2);
          });
        });
      });

      it('finds all entries', function() {
        return this.User.findAll().then(function(users) {
          expect(users.length).to.equal(2);
        });
      });

      it('does not modify the passed arguments', function() {
        var options = { where: ['username = ?', 'awesome']};
        return this.User.findAll(options).then(function() {
          expect(options).to.deep.equal({ where: ['username = ?', 'awesome']});
        });
      });

      it('finds all users matching the passed conditions', function() {
        return this.User.findAll({where: 'id != ' + this.users[1].id}).then(function(users) {
          expect(users.length).to.equal(1);
        });
      });

      it('can also handle array notation', function() {
        var self = this;
        return this.User.findAll({where: ['id = ?', this.users[1].id]}).then(function(users) {
          expect(users.length).to.equal(1);
          expect(users[0].id).to.equal(self.users[1].id);
        });
      });

      it('sorts the results via id in ascending order', function() {
        return this.User.findAll().then(function(users) {
          expect(users.length).to.equal(2);
          expect(users[0].id).to.be.below(users[1].id);
        });
      });

      it('sorts the results via id in descending order', function() {
        return this.User.findAll({ order: 'id DESC' }).then(function(users) {
          expect(users[0].id).to.be.above(users[1].id);
        });
      });

      it('sorts the results via a date column', function() {
        var self = this;
        return self.User.create({username: 'user3', data: 'bar', theDate: moment().add(2, 'hours').toDate()}).then(function() {
          return self.User.findAll({ order: [['theDate', 'DESC']] }).then(function(users) {
            expect(users[0].id).to.be.above(users[2].id);
          });
        });
      });

      it('handles offset and limit', function() {
        var self = this;
        return this.User.bulkCreate([{username: 'bobby'}, {username: 'tables'}]).then(function() {
          return self.User.findAll({ limit: 2, offset: 2 }).then(function(users) {
            expect(users.length).to.equal(2);
            expect(users[0].id).to.equal(3);
          });
        });
      });

      it('should allow us to find IDs using capital letters', function() {
        var User = this.sequelize.define('User' + config.rand(), {
          ID: { type: Sequelize.INTEGER, primaryKey: true, autoIncrement: true },
          Login: { type: Sequelize.STRING }
        });

        return User.sync({ force: true }).then(function() {
          return User.create({Login: 'foo'}).then(function() {
            return User.findAll({ID: 1}).then(function(user) {
              expect(user).to.be.instanceof(Array);
              expect(user).to.have.length(1);
            });
          });
        });
      });

      it('should be possible to order by sequelize.col()', function() {
        var self = this;
        var Company = this.sequelize.define('Company', {
          name: Sequelize.STRING
        });

        return Company.sync().then(function() {
          return Company.findAll({
            order: [self.sequelize.col('name')]
          });
        });
      });
    });
  });

  describe('findAndCountAll', function() {
    beforeEach(function() {
      var self = this;
      return this.User.bulkCreate([
        {username: 'user', data: 'foobar'},
        {username: 'user2', data: 'bar'},
        {username: 'bobby', data: 'foo'}
      ]).then(function() {
        return self.User.findAll().then(function(users) {
          self.users = users;
        });
      });
    });

    if (current.dialect.supports.transactions) {
      it('supports transactions', function() {
        return Support.prepareTransactionTest(this.sequelize).bind({}).then(function(sequelize) {
          var User = sequelize.define('User', { username: Sequelize.STRING });

          return User.sync({ force: true }).then(function() {
            return sequelize.transaction().then(function(t) {
              return User.create({ username: 'foo' }, { transaction: t }).then(function() {
                return User.findAndCountAll().then(function(info1) {
                  return User.findAndCountAll({ transaction: t }).then(function(info2) {
                    expect(info1.count).to.equal(0);
                    expect(info2.count).to.equal(1);
                    return t.rollback();
                  });
                });
              });
            });
          });
        });
      });
    }

    it('handles where clause [only]', function() {
      return this.User.findAndCountAll({where: 'id != ' + this.users[0].id}).then(function(info) {
        expect(info.count).to.equal(2);
        expect(Array.isArray(info.rows)).to.be.ok;
        expect(info.rows.length).to.equal(2);
      });
    });

    it('handles where clause with ordering [only]', function() {
      return this.User.findAndCountAll({where: 'id != ' + this.users[0].id, order: 'id ASC'}).then(function(info) {
        expect(info.count).to.equal(2);
        expect(Array.isArray(info.rows)).to.be.ok;
        expect(info.rows.length).to.equal(2);
      });
    });

    it('handles offset', function() {
      return this.User.findAndCountAll({offset: 1}).then(function(info) {
        expect(info.count).to.equal(3);
        expect(Array.isArray(info.rows)).to.be.ok;
        expect(info.rows.length).to.equal(2);
      });
    });

    it('handles limit', function() {
      return this.User.findAndCountAll({limit: 1}).then(function(info) {
        expect(info.count).to.equal(3);
        expect(Array.isArray(info.rows)).to.be.ok;
        expect(info.rows.length).to.equal(1);
      });
    });

    it('handles offset and limit', function() {
      return this.User.findAndCountAll({offset: 1, limit: 1}).then(function(info) {
        expect(info.count).to.equal(3);
        expect(Array.isArray(info.rows)).to.be.ok;
        expect(info.rows.length).to.equal(1);
      });
    });

    it('handles offset with includes', function() {
      var Election = this.sequelize.define('Election', {
        name: Sequelize.STRING
      });
      var Citizen = this.sequelize.define('Citizen', {
        name: Sequelize.STRING
      });

      // Associations
      Election.belongsTo(Citizen);
      Election.hasMany(Citizen, { as: 'Voters', through: 'ElectionsVotes' });
      Citizen.hasMany(Election);
      Citizen.hasMany(Election, { as: 'Votes', through: 'ElectionsVotes' });

      return this.sequelize.sync().then(function() {
        // Add some data
        return Citizen.create({ name: 'Alice' }).then(function(alice) {
          return Citizen.create({ name: 'Bob' }).then(function(bob) {
            return Election.create({ name: 'Some election' }).then(function() {
              return Election.create({ name: 'Some other election' }).then(function(election) {
                return election.setCitizen(alice).then(function() {
                  return election.setVoters([alice, bob]).then(function() {
                    var criteria = {
                      offset: 5,
                      limit: 1,
                      include: [
                        Citizen, // Election creator
                        { model: Citizen, as: 'Voters' } // Election voters
                      ]
                    };
                    return Election.findAndCountAll(criteria).then(function(elections) {
                      expect(elections.count).to.equal(2);
                      expect(elections.rows.length).to.equal(0);
                    });
                  });
                });
              });
            });
          });
        });
      });
    });

    it('handles attributes', function() {
      return this.User.findAndCountAll({where: 'id != ' + this.users[0].id, attributes: ['data']}).then(function(info) {
        expect(info.count).to.equal(2);
        expect(Array.isArray(info.rows)).to.be.ok;
        expect(info.rows.length).to.equal(2);
        expect(info.rows[0].dataValues).to.not.have.property('username');
        expect(info.rows[1].dataValues).to.not.have.property('username');
      });
    });
  });

  describe('all', function() {
    beforeEach(function() {
      return this.User.bulkCreate([
        {username: 'user', data: 'foobar'},
        {username: 'user2', data: 'bar'}
      ]);
    });

    if (current.dialect.supports.transactions) {
      it('supports transactions', function() {
        return Support.prepareTransactionTest(this.sequelize).bind({}).then(function(sequelize) {
          var User = sequelize.define('User', { username: Sequelize.STRING });

          return User.sync({ force: true }).then(function() {
            return sequelize.transaction().then(function(t) {
              return User.create({ username: 'foo' }, { transaction: t }).then(function() {
                return User.findAll().then(function(users1) {
                  return User.findAll({ transaction: t }).then(function(users2) {
                    expect(users1.length).to.equal(0);
                    expect(users2.length).to.equal(1);
                    return t.rollback();
                  });
                });
              });
            });
          });
        });
      });
    }

    it('should return all users', function() {
      return this.User.findAll().then(function(users) {
        expect(users.length).to.equal(2);
      });
    });
  });

  it('should support logging', function () {
    var spy = sinon.spy();

    return this.User.findAll({
      where: {},
      logging: spy
    }).then(function () {
      expect(spy.called).to.be.ok;
    });
  });
});
