'use strict';

var chai = require('chai')
  , sinon = require('sinon')
  , Sequelize = require('../../../index')
  , expect = chai.expect
  , Support = require(__dirname + '/../support')
  , DataTypes = require(__dirname + '/../../../lib/data-types')
  , dialect = Support.getTestDialect()
  , config = require(__dirname + '/../../config/config')
  , datetime = require('chai-datetime')
  , _ = require('lodash')
  , moment = require('moment')
  , async = require('async')
  , current = Support.sequelize;

chai.use(datetime);
chai.config.includeStack = true;

describe(Support.getTestDialectTeaser('Model'), function() {
  beforeEach(function(done) {
    this.User = this.sequelize.define('User', {
      username: DataTypes.STRING,
      secretValue: DataTypes.STRING,
      data: DataTypes.STRING,
      intVal: DataTypes.INTEGER,
      theDate: DataTypes.DATE,
      aBool: DataTypes.BOOLEAN,
      binary: DataTypes.STRING(16, true)
    });

    this.User.sync({ force: true }).success(function() {
      done();
    });
  });

  describe('findAll', function() {
    if (current.dialect.supports.transactions) {
      it('supports transactions', function(done) {
        Support.prepareTransactionTest(this.sequelize, function(sequelize) {
          var User = sequelize.define('User', { username: Sequelize.STRING });

          User.sync({ force: true }).success(function() {
            sequelize.transaction().then(function(t) {
              User.create({ username: 'foo' }, { transaction: t }).success(function() {
                User.findAll({ username: 'foo' }).success(function(users1) {
                  User.findAll({ transaction: t }).success(function(users2) {
                    User.findAll({ username: 'foo' }, { transaction: t }).success(function(users3) {
                      expect(users1.length).to.equal(0);
                      expect(users2.length).to.equal(1);
                      expect(users3.length).to.equal(1);

                      t.rollback().success(function() {
                        done();
                      });
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
      beforeEach(function(done) {

        this.buf = new Buffer(16);
        this.buf.fill('\x01');
        this.User.bulkCreate([
          {username: 'boo', intVal: 5, theDate: '2013-01-01 12:00'},
          {username: 'boo2', intVal: 10, theDate: '2013-01-10 12:00', binary: this.buf }
        ]).success(function() {
          done();
        });
      });

      it('should be able to find rows where attribute is in a list of values', function(done) {
        this.User.findAll({
          where: {
            username: ['boo', 'boo2']
          }
        }).success(function(users) {
          expect(users).to.have.length(2);
          done();
        });
      });

      it('should not break when trying to find rows using an array of primary keys', function(done) {
        this.User.findAll({
          where: {
            id: [1, 2, 3]
          }
        }).success(function() {
          done();
        });
      });

      it('should not break when using smart syntax on binary fields', function(done) {
        this.User.findAll({
          where: {
            binary: [this.buf, this.buf]
          }
        }).success(function(users) {
          expect(users).to.have.length(1);
          expect(users[0].binary).to.be.an.instanceof.string;
          expect(users[0].username).to.equal('boo2');
          done();
        });
      });

      it('should be able to find a row using like', function(done) {
        this.User.findAll({
          where: {
            username: {
              like: '%2'
            }
          }
        }).success(function(users) {
          expect(users).to.be.an.instanceof(Array);
          expect(users).to.have.length(1);
          expect(users[0].username).to.equal('boo2');
          expect(users[0].intVal).to.equal(10);
          done();
        });
      });

      it('should be able to find a row using not like', function(done) {
        this.User.findAll({
          where: {
            username: {
              nlike: '%2'
            }
          }
        }).success(function(users) {
          expect(users).to.be.an.instanceof(Array);
          expect(users).to.have.length(1);
          expect(users[0].username).to.equal('boo');
          expect(users[0].intVal).to.equal(5);
          done();
        });
      });

      if (dialect === 'postgres') {
        it('should be able to find a row using ilike', function(done) {
          this.User.findAll({
            where: {
              username: {
                ilike: '%2'
              }
            }
          }).success(function(users) {
            expect(users).to.be.an.instanceof(Array);
            expect(users).to.have.length(1);
            expect(users[0].username).to.equal('boo2');
            expect(users[0].intVal).to.equal(10);
            done();
          });
        });

        it('should be able to find a row using not ilike', function(done) {
          this.User.findAll({
            where: {
              username: {
                notilike: '%2'
              }
            }
          }).success(function(users) {
            expect(users).to.be.an.instanceof(Array);
            expect(users).to.have.length(1);
            expect(users[0].username).to.equal('boo');
            expect(users[0].intVal).to.equal(5);
            done();
          });
        });
      }

      it('should be able to find a row between a certain date using the between shortcut', function(done) {
        this.User.findAll({
          where: {
            theDate: {
              '..': ['2013-01-02', '2013-01-11']
            }
          }
        }).success(function(users) {
          expect(users[0].username).to.equal('boo2');
          expect(users[0].intVal).to.equal(10);
          done();
        });
      });

      it('should be able to find a row not between a certain integer using the not between shortcut', function(done) {
        this.User.findAll({
          where: {
            intVal: {
              '!..': [8, 10]
            }
          }
        }).success(function(users) {
          expect(users[0].username).to.equal('boo');
          expect(users[0].intVal).to.equal(5);
          done();
        });
      });

      it('should be able to handle false/true values just fine...', function(done) {
        var User = this.User
          , escapeChar = (dialect === 'postgres' || dialect === 'mssql') ? '"' : '`';

        User.bulkCreate([
          {username: 'boo5', aBool: false},
          {username: 'boo6', aBool: true}
        ]).success(function() {
          User.all({where: [escapeChar + 'aBool' + escapeChar + ' = ?', false]}).success(function(users) {
            expect(users).to.have.length(1);
            expect(users[0].username).to.equal('boo5');

            User.all({where: [escapeChar + 'aBool' + escapeChar + ' = ?', true]}).success(function(_users) {
              expect(_users).to.have.length(1);
              expect(_users[0].username).to.equal('boo6');
              done();
            });
          });
        });
      });

      it('should be able to handle false/true values through associations as well...', function(done) {
        var User = this.User
          , escapeChar = (dialect === 'postgres' || dialect === 'mssql') ? '"' : '`'
          , Passports = this.sequelize.define('Passports', {
              isActive: Sequelize.BOOLEAN
            });

        User.hasMany(Passports);
        Passports.belongsTo(User);

        User.sync({ force: true }).success(function() {
          Passports.sync({ force: true }).success(function() {
            User.bulkCreate([
              {username: 'boo5', aBool: false},
              {username: 'boo6', aBool: true}
            ]).success(function() {
              Passports.bulkCreate([
                {isActive: true},
                {isActive: false}
              ]).success(function() {
                User.find(1).success(function(user) {
                  Passports.find(1).success(function(passport) {
                    user.setPassports([passport]).success(function() {
                      User.find(2).success(function(_user) {
                        Passports.find(2).success(function(_passport) {
                          _user.setPassports([_passport]).success(function() {
                            _user.getPassports({where: [escapeChar + 'isActive' + escapeChar + ' = ?', false]}).success(function(theFalsePassport) {
                              user.getPassports({where: [escapeChar + 'isActive' + escapeChar + ' = ?', true]}).success(function(theTruePassport) {
                                expect(theFalsePassport).to.have.length(1);
                                expect(theFalsePassport[0].isActive).to.be.false;
                                expect(theTruePassport).to.have.length(1);
                                expect(theTruePassport[0].isActive).to.be.true;
                                done();
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

      it('should be able to handle binary values through associations as well...', function(done) {
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

        this.sequelize.sync({ force: true }).success(function() {
          User.bulkCreate([
            {username: 'boo5', aBool: false},
            {username: 'boo6', aBool: true}
          ]).success(function() {
            Binary.bulkCreate([
              {id: buf1},
              {id: buf2}
            ]).success(function() {
              User.find(1).success(function(user) {
                Binary.find(buf1).success(function(binary) {
                  user.setBinary(binary).success(function() {
                    User.find(2).success(function(_user) {
                      Binary.find(buf2).success(function(_binary) {
                        _user.setBinary(_binary).success(function() {
                          _user.getBinary().success(function(_binaryRetrieved) {
                            user.getBinary().success(function(binaryRetrieved) {
                              expect(binaryRetrieved.id).to.be.an.instanceof.string;
                              expect(_binaryRetrieved.id).to.be.an.instanceof.string;
                              expect(binaryRetrieved.id).to.have.length(16);
                              expect(_binaryRetrieved.id).to.have.length(16);
                              expect(binaryRetrieved.id.toString()).to.be.equal(buf1.toString());
                              expect(_binaryRetrieved.id.toString()).to.be.equal(buf2.toString());
                              done();
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

      it('should be able to return a record with primaryKey being null for new inserts', function(done) {
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

        this.sequelize.sync({ force: true }).success(function() {
          User.create({name: 'Name1', password: '123', isAdmin: false}).success(function(user) {
            var sess = Session.build({
              lastUpdate: new Date(),
              token: '123'
            });

            user.addSession(sess).success(function(u) {
              expect(u.token).to.equal('123');
              done();
            });
          });
        });
      });

      it('should be able to find a row between a certain date', function(done) {
        this.User.findAll({
          where: {
            theDate: {
              between: ['2013-01-02', '2013-01-11']
            }
          }
        }).success(function(users) {
          expect(users[0].username).to.equal('boo2');
          expect(users[0].intVal).to.equal(10);
          done();
        });
      });

      it('should be able to find a row between a certain date and an additional where clause', function(done) {
        this.User.findAll({
          where: {
            theDate: {
              between: ['2013-01-02', '2013-01-11']
            },
            intVal: 10
          }
        }).success(function(users) {
          expect(users[0].username).to.equal('boo2');
          expect(users[0].intVal).to.equal(10);
          done();
        });
      });

      it('should be able to find a row not between a certain integer', function(done) {
        this.User.findAll({
          where: {
            intVal: {
              nbetween: [8, 10]
            }
          }
        }).success(function(users) {
          expect(users[0].username).to.equal('boo');
          expect(users[0].intVal).to.equal(5);
          done();
        });
      });

      it('should be able to find a row using not between and between logic', function(done) {
        this.User.findAll({
          where: {
            theDate: {
              between: ['2012-12-10', '2013-01-02'],
              nbetween: ['2013-01-04', '2013-01-20']
            }
          }
        }).success(function(users) {
          expect(users[0].username).to.equal('boo');
          expect(users[0].intVal).to.equal(5);
          done();
        });
      });

      it('should be able to find a row using not between and between logic with dates', function(done) {
        this.User.findAll({
          where: {
            theDate: {
              between: [new Date('2012-12-10'), new Date('2013-01-02')],
              nbetween: [new Date('2013-01-04'), new Date('2013-01-20')]
            }
          }
        }).success(function(users) {
          expect(users[0].username).to.equal('boo');
          expect(users[0].intVal).to.equal(5);
          done();
        });
      });

      it('should be able to find a row using greater than or equal to logic with dates', function(done) {
        this.User.findAll({
          where: {
            theDate: {
              gte: new Date('2013-01-09')
            }
          }
        }).success(function(users) {
          expect(users[0].username).to.equal('boo2');
          expect(users[0].intVal).to.equal(10);
          done();
        });
      });

      it('should be able to find a row using greater than or equal to', function(done) {
        this.User.find({
          where: {
            intVal: {
              gte: 6
            }
          }
        }).success(function(user) {
          expect(user.username).to.equal('boo2');
          expect(user.intVal).to.equal(10);
          done();
        });
      });

      it('should be able to find a row using greater than', function(done) {
        this.User.find({
          where: {
            intVal: {
              gt: 5
            }
          }
        }).success(function(user) {
          expect(user.username).to.equal('boo2');
          expect(user.intVal).to.equal(10);
          done();
        });
      });

      it('should be able to find a row using lesser than or equal to', function(done) {
        this.User.find({
          where: {
            intVal: {
              lte: 5
            }
          }
        }).success(function(user) {
          expect(user.username).to.equal('boo');
          expect(user.intVal).to.equal(5);
          done();
        });
      });

      it('should be able to find a row using lesser than', function(done) {
        this.User.find({
          where: {
            intVal: {
              lt: 6
            }
          }
        }).success(function(user) {
          expect(user.username).to.equal('boo');
          expect(user.intVal).to.equal(5);
          done();
        });
      });

      it('should have no problem finding a row using lesser and greater than', function(done) {
        this.User.findAll({
          where: {
            intVal: {
              lt: 6,
              gt: 4
            }
          }
        }).success(function(users) {
          expect(users[0].username).to.equal('boo');
          expect(users[0].intVal).to.equal(5);
          done();
        });
      });

      it('should be able to find a row using not equal to logic', function(done) {
        this.User.find({
          where: {
            intVal: {
              ne: 10
            }
          }
        }).success(function(user) {
          expect(user.username).to.equal('boo');
          expect(user.intVal).to.equal(5);
          done();
        });
      });

      it('should be able to find multiple users with any of the special where logic properties', function(done) {
        this.User.findAll({
          where: {
            intVal: {
              lte: 10
            }
          }
        }).success(function(users) {
          expect(users[0].username).to.equal('boo');
          expect(users[0].intVal).to.equal(5);
          expect(users[1].username).to.equal('boo2');
          expect(users[1].intVal).to.equal(10);
          done();
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
        beforeEach(function(done) {
          var self = this;
          self.Task = self.sequelize.define('TaskBelongsTo', { title: Sequelize.STRING });
          self.Worker = self.sequelize.define('Worker', { name: Sequelize.STRING });
          self.Task.belongsTo(self.Worker);

          self.Worker.sync({ force: true }).success(function() {
            self.Task.sync({ force: true }).success(function() {
              self.Worker.create({ name: 'worker' }).success(function(worker) {
                self.Task.create({ title: 'homework' }).success(function(task) {
                  self.worker = worker;
                  self.task = task;

                  self.task.setWorker(self.worker).success(function() {
                    done();
                  });
                });
              });
            });
          });
        });

        it('throws an error about unexpected input if include contains a non-object', function(done) {
          var self = this;
          self.Worker.all({ include: [1] }).catch (function(err) {
            expect(err.message).to.equal('Include unexpected. Element has to be either a Model, an Association or an object.');
            done();
          });
        });

        it('throws an error if included DaoFactory is not associated', function(done) {
          var self = this;
          self.Worker.all({ include: [self.Task] }).catch (function(err) {
            expect(err.message).to.equal('TaskBelongsTo is not associated to Worker!');
            done();
          });
        });

        it('returns the associated worker via task.worker', function(done) {
          this.Task.all({
            where: { title: 'homework' },
            include: [this.Worker]
          }).complete(function(err, tasks) {
            expect(err).to.be.null;
            expect(tasks).to.exist;
            expect(tasks[0].Worker).to.exist;
            expect(tasks[0].Worker.name).to.equal('worker');
            done();
          });
        });
      });

      describe('hasOne', function() {
        beforeEach(function(done) {
          var self = this;
          self.Task = self.sequelize.define('TaskHasOne', { title: Sequelize.STRING });
          self.Worker = self.sequelize.define('Worker', { name: Sequelize.STRING });
          self.Worker.hasOne(self.Task);
          self.Worker.sync({ force: true }).success(function() {
            self.Task.sync({ force: true }).success(function() {
              self.Worker.create({ name: 'worker' }).success(function(worker) {
                self.Task.create({ title: 'homework' }).success(function(task) {
                  self.worker = worker;
                  self.task = task;

                  self.worker.setTaskHasOne(self.task).success(function() {
                    done();
                  });
                });
              });
            });
          });
        });

        it('throws an error if included DaoFactory is not associated', function(done) {
          var self = this;
          self.Task.all({ include: [self.Worker] }).catch (function(err) {
            expect(err.message).to.equal('Worker is not associated to TaskHasOne!');
            done();
          });
        });

        it('returns the associated task via worker.task', function(done) {
          this.Worker.all({
            where: { name: 'worker' },
            include: [this.Task]
          }).complete(function(err, workers) {
            expect(err).to.be.null;
            expect(workers).to.exist;
            expect(workers[0].TaskHasOne).to.exist;
            expect(workers[0].TaskHasOne.title).to.equal('homework');
            done();
          });
        });
      });

      describe('hasOne with alias', function() {
        beforeEach(function(done) {
          var self = this;
          self.Task = self.sequelize.define('Task', { title: Sequelize.STRING });
          self.Worker = self.sequelize.define('Worker', { name: Sequelize.STRING });
          self.Worker.hasOne(self.Task, { as: 'ToDo' });

          self.Worker.sync({ force: true }).success(function() {
            self.Task.sync({ force: true }).success(function() {
              self.Worker.create({ name: 'worker' }).success(function(worker) {
                self.Task.create({ title: 'homework' }).success(function(task) {
                  self.worker = worker;
                  self.task = task;

                  self.worker.setToDo(self.task).success(function() {
                    done();
                  });
                });
              });
            });
          });
        });

        it('throws an error if included DaoFactory is not referenced by alias', function(done) {
          var self = this;
          self.Worker.all({ include: [self.Task] }).catch (function(err) {
            expect(err.message).to.equal('Task is not associated to Worker!');
            done();
          });
        });

        it('throws an error if alias is not associated', function(done) {
          var self = this;
          self.Worker.all({ include: [{ daoFactory: self.Task, as: 'Work' }] }).catch (function(err) {
            expect(err.message).to.equal('Task (Work) is not associated to Worker!');
            done();
          });
        });

        it('returns the associated task via worker.task', function(done) {
          this.Worker.all({
            where: { name: 'worker' },
            include: [{ daoFactory: this.Task, as: 'ToDo' }]
          }).complete(function(err, workers) {
            expect(err).to.be.null;
            expect(workers).to.exist;
            expect(workers[0].ToDo).to.exist;
            expect(workers[0].ToDo.title).to.equal('homework');
            done();
          });
        });

        it('returns the associated task via worker.task when daoFactory is aliased with model', function(done) {
          this.Worker.all({
            where: { name: 'worker' },
            include: [{ model: this.Task, as: 'ToDo' }]
          }).complete(function(err, workers) {
            expect(workers[0].ToDo.title).to.equal('homework');
            done();
          });
        });
      });

      describe('hasMany', function() {
        beforeEach(function(done) {
          var self = this;
          self.Task = self.sequelize.define('task', { title: Sequelize.STRING });
          self.Worker = self.sequelize.define('worker', { name: Sequelize.STRING });
          self.Worker.hasMany(self.Task);

          self.Worker.sync({ force: true }).success(function() {
            self.Task.sync({ force: true }).success(function() {
              self.Worker.create({ name: 'worker' }).success(function(worker) {
                self.Task.create({ title: 'homework' }).success(function(task) {
                  self.worker = worker;
                  self.task = task;

                  self.worker.setTasks([self.task]).success(function() {
                    done();
                  });
                });
              });
            });
          });
        });

        it('throws an error if included DaoFactory is not associated', function(done) {
          var self = this;
          self.Task.findAll({ include: [self.Worker] }).catch (function(err) {
            expect(err.message).to.equal('worker is not associated to task!');
            done();
          });
        });

        it('returns the associated tasks via worker.tasks', function(done) {
          this.Worker.findAll({
            where: { name: 'worker' },
            include: [this.Task]
          }).complete(function(err, workers) {
            expect(err).to.be.null;
            expect(workers).to.exist;
            expect(workers[0].tasks).to.exist;
            expect(workers[0].tasks[0].title).to.equal('homework');
            done();
          });
        });
      });

      describe('hasMany with alias', function() {
        beforeEach(function(done) {
          var self = this;
          self.Task = self.sequelize.define('Task', { title: Sequelize.STRING });
          self.Worker = self.sequelize.define('Worker', { name: Sequelize.STRING });
          self.Worker.hasMany(self.Task, { as: 'ToDos' });

          self.Worker.sync({ force: true }).success(function() {
            self.Task.sync({ force: true }).success(function() {
              self.Worker.create({ name: 'worker' }).success(function(worker) {
                self.Task.create({ title: 'homework' }).success(function(task) {
                  self.worker = worker;
                  self.task = task;

                  self.worker.setToDos([self.task]).success(function() {
                    done();
                  });
                });
              });
            });
          });
        });

        it('throws an error if included DaoFactory is not referenced by alias', function(done) {
          var self = this;
          self.Worker.findAll({ include: [self.Task] }).catch (function(err) {
            expect(err.message).to.equal('Task is not associated to Worker!');
            done();
          });
        });

        it('throws an error if alias is not associated', function(done) {
          var self = this;
          self.Worker.findAll({ include: [{ daoFactory: self.Task, as: 'Work' }] }).catch (function(err) {
            expect(err.message).to.equal('Task (Work) is not associated to Worker!');
            done();
          });
        });

        it('returns the associated task via worker.task', function(done) {
          this.Worker.findAll({
            where: { name: 'worker' },
            include: [{ daoFactory: this.Task, as: 'ToDos' }]
          }).complete(function(err, workers) {
            expect(err).to.be.null;
            expect(workers).to.exist;
            expect(workers[0].ToDos).to.exist;
            expect(workers[0].ToDos[0].title).to.equal('homework');
            done();
          });
        });

        it('returns the associated task via worker.task when daoFactory is aliased with model', function(done) {
          this.Worker.findAll({
            where: { name: 'worker' },
            include: [{ daoFactory: this.Task, as: 'ToDos' }]
          }).complete(function(err, workers) {
            expect(workers[0].ToDos[0].title).to.equal('homework');
            done();
          });
        });
      });

      describe('queryOptions', function() {
        beforeEach(function(done) {
          var self = this;
          this.User.create({username: 'barfooz'}).success(function(user) {
            self.user = user;
            done();
          });
        });

        it('should return a DAO when queryOptions are not set', function(done) {
          var self = this;
          this.User.findAll({ where: { username: 'barfooz'}}).done(function(err, users) {
            users.forEach(function(user) {
              expect(user).to.be.instanceOf(self.User.DAO);
            });
            done();
          });
        });

        it('should return a DAO when raw is false', function(done) {
          var self = this;
          this.User.findAll({ where: { username: 'barfooz'}}, { raw: false }).done(function(err, users) {
            users.forEach(function(user) {
              expect(user).to.be.instanceOf(self.User.DAO);
            });
            done();
          });
        });

        it('should return raw data when raw is true', function(done) {
          var self = this;
          this.User.findAll({ where: { username: 'barfooz'}}, { raw: true }).done(function(err, users) {
            users.forEach(function(user) {
              expect(user).to.not.be.instanceOf(self.User.DAO);
              expect(users[0]).to.be.instanceOf(Object);
            });
            done();
          });
        });
      });

      describe('include all', function() {
        beforeEach(function(done) {
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

          this.sequelize.sync({ force: true }).success(function() {
            async.parallel({
              europe: function(callback) { self.Continent.create({ name: 'Europe' }).done(callback); },
              england: function(callback) { self.Country.create({ name: 'England' }).done(callback); },
              coal: function(callback) { self.Industry.create({ name: 'Coal' }).done(callback); },
              bob: function(callback) { self.Person.create({ name: 'Bob', lastName: 'Becket' }).done(callback); }
            }, function(err, r) {
              if (err) throw err;

              _.forEach(r, function(item, itemName) {
                self[itemName] = item;
              });

              async.parallel([
                function(callback) { self.england.setContinent(self.europe).done(callback); },
                function(callback) { self.england.addIndustry(self.coal).done(callback); },
                function(callback) { self.bob.setCountry(self.england).done(callback); },
                function(callback) { self.bob.setCountryResident(self.england).done(callback); }
              ], function(err) {
                if (err) throw err;
                done();
              });
            });
          });
        });

        it('includes all associations', function(done) {
          this.Country.findAll({ include: [{ all: true }] }).done(function(err, countries) {
            expect(err).not.to.be.ok;
            expect(countries).to.exist;
            expect(countries[0]).to.exist;
            expect(countries[0].continent).to.exist;
            expect(countries[0].industries).to.exist;
            expect(countries[0].people).to.exist;
            expect(countries[0].residents).to.exist;
            done();
          });
        });

        it('includes specific type of association', function(done) {
          this.Country.findAll({ include: [{ all: 'BelongsTo' }] }).done(function(err, countries) {
            expect(err).not.to.be.ok;
            expect(countries).to.exist;
            expect(countries[0]).to.exist;
            expect(countries[0].continent).to.exist;
            expect(countries[0].industries).not.to.exist;
            expect(countries[0].people).not.to.exist;
            expect(countries[0].residents).not.to.exist;
            done();
          });
        });

        it('utilises specified attributes', function(done) {
          this.Country.findAll({ include: [{ all: 'HasMany', attributes: ['name'] }] }).done(function(err, countries) {
            expect(err).not.to.be.ok;
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
            done();
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

        it('includes all nested associations', function(done) {
          this.Continent.findAll({ include: [{ all: true, nested: true }] }).done(function(err, continents) {
            expect(err).not.to.be.ok;
            expect(continents).to.exist;
            expect(continents[0]).to.exist;
            expect(continents[0].countries).to.exist;
            expect(continents[0].countries[0]).to.exist;
            expect(continents[0].countries[0].industries).to.exist;
            expect(continents[0].countries[0].people).to.exist;
            expect(continents[0].countries[0].residents).to.exist;
            expect(continents[0].countries[0].continent).not.to.exist;
            done();
          });
        });
      });
    });

    describe('order by eager loaded tables', function() {
      describe('HasMany', function() {
        beforeEach(function(done) {
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

          this.sequelize.sync({ force: true }).success(function() {
            async.parallel({
              europe: function(callback) { self.Continent.create({ name: 'Europe' }).done(callback); },
              asia: function(callback) { self.Continent.create({ name: 'Asia' }).done(callback); },
              england: function(callback) { self.Country.create({ name: 'England' }).done(callback); },
              france: function(callback) { self.Country.create({ name: 'France' }).done(callback); },
              korea: function(callback) { self.Country.create({ name: 'Korea' }).done(callback); },
              bob: function(callback) { self.Person.create({ name: 'Bob', lastName: 'Becket' }).done(callback); },
              fred: function(callback) { self.Person.create({ name: 'Fred', lastName: 'Able' }).done(callback); },
              pierre: function(callback) { self.Person.create({ name: 'Pierre', lastName: 'Paris' }).done(callback); },
              kim: function(callback) { self.Person.create({ name: 'Kim', lastName: 'Z' }).done(callback); }
            }, function(err, r) {
              if (err) throw err;

              _.forEach(r, function(item, itemName) {
                self[itemName] = item;
              });

              async.parallel([
                function(callback) { self.england.setContinent(self.europe).done(callback); },
                function(callback) { self.france.setContinent(self.europe).done(callback); },
                function(callback) { self.korea.setContinent(self.asia).done(callback); },

                function(callback) { self.bob.setCountry(self.england).done(callback); },
                function(callback) { self.fred.setCountry(self.england).done(callback); },
                function(callback) { self.pierre.setCountry(self.france).done(callback); },
                function(callback) { self.kim.setCountry(self.korea).done(callback); },

                function(callback) { self.bob.setCountryResident(self.england).done(callback); },
                function(callback) { self.fred.setCountryResident(self.france).done(callback); },
                function(callback) { self.pierre.setCountryResident(self.korea).done(callback); },
                function(callback) { self.kim.setCountryResident(self.england).done(callback); }
              ], function(err) {
                if (err) throw err;
                done();
              });
            });
          });
        });

        it('sorts simply', function(done) {
          var self = this;
          async.eachSeries([['ASC', 'Asia'], ['DESC', 'Europe']], function(params, callback) {
            self.Continent.findAll({
              order: [['name', params[0]]]
            }).done(function(err, continents) {
              expect(err).not.to.be.ok;
              expect(continents).to.exist;
              expect(continents[0]).to.exist;
              expect(continents[0].name).to.equal(params[1]);
              callback();
            });
          }, function() { done(); });
        });

        it('sorts by 1st degree association', function(done) {
          var self = this;
          async.forEach([['ASC', 'Europe', 'England'], ['DESC', 'Asia', 'Korea']], function(params, callback) {
            self.Continent.findAll({
              include: [self.Country],
              order: [[self.Country, 'name', params[0]]]
            }).done(function(err, continents) {
              expect(err).not.to.be.ok;
              expect(continents).to.exist;
              expect(continents[0]).to.exist;
              expect(continents[0].name).to.equal(params[1]);
              expect(continents[0].countries).to.exist;
              expect(continents[0].countries[0]).to.exist;
              expect(continents[0].countries[0].name).to.equal(params[2]);
              callback();
            });
          }, function() { done(); });
        });

        it('sorts by 2nd degree association', function(done) {
          var self = this;
          async.forEach([['ASC', 'Europe', 'England', 'Fred'], ['DESC', 'Asia', 'Korea', 'Kim']], function(params, callback) {
            self.Continent.findAll({
              include: [{ model: self.Country, include: [self.Person] }],
              order: [[self.Country, self.Person, 'lastName', params[0]]]
            }).done(function(err, continents) {
              expect(err).not.to.be.ok;
              expect(continents).to.exist;
              expect(continents[0]).to.exist;
              expect(continents[0].name).to.equal(params[1]);
              expect(continents[0].countries).to.exist;
              expect(continents[0].countries[0]).to.exist;
              expect(continents[0].countries[0].name).to.equal(params[2]);
              expect(continents[0].countries[0].people).to.exist;
              expect(continents[0].countries[0].people[0]).to.exist;
              expect(continents[0].countries[0].people[0].name).to.equal(params[3]);
              callback();
            });
          }, function() { done(); });
        }),

        it('sorts by 2nd degree association with alias', function(done) {
          var self = this;
          async.forEach([['ASC', 'Europe', 'France', 'Fred'], ['DESC', 'Europe', 'England', 'Kim']], function(params, callback) {
            self.Continent.findAll({
              include: [{ model: self.Country, include: [self.Person, {model: self.Person, as: 'residents' }] }],
              order: [[self.Country, {model: self.Person, as: 'residents' }, 'lastName', params[0]]]
            }).done(function(err, continents) {
              expect(err).not.to.be.ok;
              expect(continents).to.exist;
              expect(continents[0]).to.exist;
              expect(continents[0].name).to.equal(params[1]);
              expect(continents[0].countries).to.exist;
              expect(continents[0].countries[0]).to.exist;
              expect(continents[0].countries[0].name).to.equal(params[2]);
              expect(continents[0].countries[0].residents).to.exist;
              expect(continents[0].countries[0].residents[0]).to.exist;
              expect(continents[0].countries[0].residents[0].name).to.equal(params[3]);
              callback();
            });
          }, function() { done(); });
        });

        it('sorts by 2nd degree association with alias while using limit', function(done) {
          var self = this;
          async.forEach([['ASC', 'Europe', 'France', 'Fred'], ['DESC', 'Europe', 'England', 'Kim']], function(params, callback) {
            self.Continent.findAll({
              include: [{ model: self.Country, include: [self.Person, {model: self.Person, as: 'residents' }] }],
              order: [[{ model: self.Country }, {model: self.Person, as: 'residents' }, 'lastName', params[0]]],
              limit: 3
            }).done(function(err, continents) {
              expect(err).not.to.be.ok;
              expect(continents).to.exist;
              expect(continents[0]).to.exist;
              expect(continents[0].name).to.equal(params[1]);
              expect(continents[0].countries).to.exist;
              expect(continents[0].countries[0]).to.exist;
              expect(continents[0].countries[0].name).to.equal(params[2]);
              expect(continents[0].countries[0].residents).to.exist;
              expect(continents[0].countries[0].residents[0]).to.exist;
              expect(continents[0].countries[0].residents[0].name).to.equal(params[3]);
              callback();
            });
          }, function() { done(); });
        });
      }),

      describe('ManyToMany', function() {
        beforeEach(function(done) {
          var self = this;

          self.Country = this.sequelize.define('country', { name: Sequelize.STRING });
          self.Industry = this.sequelize.define('industry', { name: Sequelize.STRING });
          self.IndustryCountry = this.sequelize.define('IndustryCountry', { numYears: Sequelize.INTEGER });

          self.Country.hasMany(self.Industry, {through: self.IndustryCountry});
          self.Industry.hasMany(self.Country, {through: self.IndustryCountry});

          this.sequelize.sync({ force: true }).success(function() {
            async.parallel({
              england: function(callback) { self.Country.create({ name: 'England' }).done(callback); },
              france: function(callback) { self.Country.create({ name: 'France' }).done(callback); },
              korea: function(callback) { self.Country.create({ name: 'Korea' }).done(callback); },
              energy: function(callback) { self.Industry.create({ name: 'Energy' }).done(callback); },
              media: function(callback) { self.Industry.create({ name: 'Media' }).done(callback); },
              tech: function(callback) { self.Industry.create({ name: 'Tech' }).done(callback); }
            }, function(err, r) {
              if (err) throw err;

              _.forEach(r, function(item, itemName) {
                self[itemName] = item;
              });

              async.parallel([
                function(callback) { self.england.addIndustry(self.energy, {numYears: 20}).done(callback); },
                function(callback) { self.england.addIndustry(self.media, {numYears: 40}).done(callback); },
                function(callback) { self.france.addIndustry(self.media, {numYears: 80}).done(callback); },
                function(callback) { self.korea.addIndustry(self.tech, {numYears: 30}).done(callback); }
              ], function(err) {
                if (err) throw err;
                done();
              });
            });
          });
        });

        it('sorts by 1st degree association', function(done) {
          var self = this;
          async.forEach([['ASC', 'England', 'Energy'], ['DESC', 'Korea', 'Tech']], function(params, callback) {
            self.Country.findAll({
              include: [self.Industry],
              order: [[self.Industry, 'name', params[0]]]
            }).done(function(err, countries) {
              expect(err).not.to.be.ok;
              expect(countries).to.exist;
              expect(countries[0]).to.exist;
              expect(countries[0].name).to.equal(params[1]);
              expect(countries[0].industries).to.exist;
              expect(countries[0].industries[0]).to.exist;
              expect(countries[0].industries[0].name).to.equal(params[2]);
              callback();
            });
          }, function() { done(); });
        });

        it('sorts by 1st degree association while using limit', function(done) {
          var self = this;
          async.forEach([['ASC', 'England', 'Energy'], ['DESC', 'Korea', 'Tech']], function(params, callback) {
            self.Country.findAll({
              include: [self.Industry],
              order: [
                [self.Industry, 'name', params[0]]
              ],
              limit: 3
            }).done(function(err, countries) {
              expect(err).not.to.be.ok;
              expect(countries).to.exist;
              expect(countries[0]).to.exist;
              expect(countries[0].name).to.equal(params[1]);
              expect(countries[0].industries).to.exist;
              expect(countries[0].industries[0]).to.exist;
              expect(countries[0].industries[0].name).to.equal(params[2]);
              callback();
            });
          }, function() { done(); });
        });

        it('sorts by through table attribute', function(done) {
          var self = this;
          async.forEach([['ASC', 'England', 'Energy'], ['DESC', 'France', 'Media']], function(params, callback) {
            self.Country.findAll({
              include: [self.Industry],
              order: [[self.Industry, self.IndustryCountry, 'numYears', params[0]]]
            }).done(function(err, countries) {
              expect(err).not.to.be.ok;
              expect(countries).to.exist;
              expect(countries[0]).to.exist;
              expect(countries[0].name).to.equal(params[1]);
              expect(countries[0].industries).to.exist;
              expect(countries[0].industries[0]).to.exist;
              expect(countries[0].industries[0].name).to.equal(params[2]);
              callback();
            });
          }, function() { done(); });
        });
      });
    });

    describe('normal findAll', function() {
      beforeEach(function(done) {
        var self = this;
        this.User.create({username: 'user', data: 'foobar', theDate: moment().toDate()}).success(function(user) {
          self.User.create({username: 'user2', data: 'bar', theDate: moment().toDate()}).success(function(user2) {
            self.users = [user].concat(user2);
            done();
          });
        });
      });

      it('finds all entries', function(done) {
        this.User.all().on('success', function(users) {
          expect(users.length).to.equal(2);
          done();
        });
      });

      it('does not modify the passed arguments', function(done) {
        var options = { where: ['username = ?', 'awesome']};

        this.User.findAll(options).success(function() {
          expect(options).to.deep.equal({ where: ['username = ?', 'awesome']});
          done();
        });
      });

      it('finds all users matching the passed conditions', function(done) {
        this.User.findAll({where: 'id != ' + this.users[1].id}).success(function(users) {
          expect(users.length).to.equal(1);
          done();
        });
      });

      it('can also handle array notation', function(done) {
        var self = this;
        this.User.findAll({where: ['id = ?', this.users[1].id]}).success(function(users) {
          expect(users.length).to.equal(1);
          expect(users[0].id).to.equal(self.users[1].id);
          done();
        });
      });

      it('sorts the results via id in ascending order', function(done) {
        this.User.findAll().success(function(users) {
          expect(users.length).to.equal(2);
          expect(users[0].id).to.be.below(users[1].id);
          done();
        });
      });

      it('sorts the results via id in descending order', function(done) {
        this.User.findAll({ order: 'id DESC' }).success(function(users) {
          expect(users[0].id).to.be.above(users[1].id);
          done();
        });
      });

      it('sorts the results via a date column', function(done) {
        var self = this;
        self.User.create({username: 'user3', data: 'bar', theDate: moment().add(2, 'hours').toDate()}).success(function() {
          self.User.findAll({ order: [['theDate', 'DESC']] }).success(function(users) {
            expect(users[0].id).to.be.above(users[2].id);
            done();
          });
        });
      });

      it('handles offset and limit', function(done) {
        var self = this;

        this.User.bulkCreate([{username: 'bobby'}, {username: 'tables'}]).success(function() {
          self.User.findAll({ limit: 2, offset: 2 }).success(function(users) {
            expect(users.length).to.equal(2);
            expect(users[0].id).to.equal(3);
            done();
          });
        });
      });

      it('should allow us to find IDs using capital letters', function(done) {
        var User = this.sequelize.define('User' + config.rand(), {
          ID: { type: Sequelize.INTEGER, primaryKey: true, autoIncrement: true },
          Login: { type: Sequelize.STRING }
        });

        User.sync({ force: true }).success(function() {
          User.create({Login: 'foo'}).success(function() {
            User.findAll({ID: 1}).success(function(user) {
              expect(user).to.be.instanceof(Array);
              expect(user).to.have.length(1);
              done();
            });
          });
        });
      });

      it('should be possible to order by sequelize.col()', function(done) {
        var self = this;
        var Company = this.sequelize.define('Company', {
          name: Sequelize.STRING
        });

        Company.sync().done(function() {
          Company.findAll({
            order: [self.sequelize.col('name')]
          }).done(function(err) {
            expect(err).not.to.be.ok;
            done();
          });
        });
      });
    });
  });

  describe('findAndCountAll', function() {
    beforeEach(function(done) {
      var self = this;
      this.User.bulkCreate([
        {username: 'user', data: 'foobar'},
        {username: 'user2', data: 'bar'},
        {username: 'bobby', data: 'foo'}
      ]).success(function() {
        self.User.all().success(function(users) {
          self.users = users;
          done();
        });
      });
    });

    if (current.dialect.supports.transactions) {
      it('supports transactions', function(done) {
        Support.prepareTransactionTest(this.sequelize, function(sequelize) {
          var User = sequelize.define('User', { username: Sequelize.STRING });

          User.sync({ force: true }).success(function() {
            sequelize.transaction().then(function(t) {
              User.create({ username: 'foo' }, { transaction: t }).success(function() {

                User.findAndCountAll().success(function(info1) {
                  User.findAndCountAll({ transaction: t }).success(function(info2) {
                    expect(info1.count).to.equal(0);
                    expect(info2.count).to.equal(1);
                    t.rollback().success(function() { done(); });
                  });
                });
              });
            });
          });
        });
      });
    }

    it('handles where clause [only]', function(done) {
      this.User.findAndCountAll({where: 'id != ' + this.users[0].id}).success(function(info) {
        expect(info.count).to.equal(2);
        expect(Array.isArray(info.rows)).to.be.ok;
        expect(info.rows.length).to.equal(2);
        done();
      });
    });

    it('handles where clause with ordering [only]', function(done) {
      this.User.findAndCountAll({where: 'id != ' + this.users[0].id, order: 'id ASC'}).success(function(info) {
        expect(info.count).to.equal(2);
        expect(Array.isArray(info.rows)).to.be.ok;
        expect(info.rows.length).to.equal(2);
        done();
      });
    });

    it('handles offset', function(done) {
      this.User.findAndCountAll({offset: 1}).success(function(info) {
        expect(info.count).to.equal(3);
        expect(Array.isArray(info.rows)).to.be.ok;
        expect(info.rows.length).to.equal(2);
        done();
      });
    });

    it('handles limit', function(done) {
      this.User.findAndCountAll({limit: 1}).success(function(info) {
        expect(info.count).to.equal(3);
        expect(Array.isArray(info.rows)).to.be.ok;
        expect(info.rows.length).to.equal(1);
        done();
      });
    });

    it('handles offset and limit', function(done) {
      this.User.findAndCountAll({offset: 1, limit: 1}).success(function(info) {
        expect(info.count).to.equal(3);
        expect(Array.isArray(info.rows)).to.be.ok;
        expect(info.rows.length).to.equal(1);
        done();
      });
    });

    it('handles offset with includes', function(done) {
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

      this.sequelize.sync().done(function(err) {
        expect(err).not.be.ok;

        // Add some data
        Citizen.create({ name: 'Alice' }).done(function(err, alice) {
          expect(err).not.be.ok;
          Citizen.create({ name: 'Bob' }).done(function(err, bob) {
            expect(err).not.be.ok;
            Election.create({ name: 'Some election' }).done(function(err, election) {
              Election.create({ name: 'Some other election' }).done(function(err, election) {
                expect(err).not.be.ok;
                election.setCitizen(alice).done(function(err) {
                  expect(err).not.be.ok;
                  election.setVoters([alice, bob]).done(function(err) {
                    expect(err).not.be.ok;

                    var criteria = {
                      offset: 5,
                      limit: 1,
                      include: [
                        Citizen, // Election creator
                        { model: Citizen, as: 'Voters' } // Election voters
                      ]
                    };
                    Election.findAndCountAll(criteria).done(function(err, elections) {
                      expect(err).not.be.ok;
                      expect(elections.count).to.equal(2);
                      expect(elections.rows.length).to.equal(0);
                      done();
                    });
                  });
                });
              });
            });
          });
        });
      });
    });

    it('handles attributes', function(done) {
      this.User.findAndCountAll({where: 'id != ' + this.users[0].id, attributes: ['data']}).success(function(info) {
        expect(info.count).to.equal(2);
        expect(Array.isArray(info.rows)).to.be.ok;
        expect(info.rows.length).to.equal(2);
        expect(info.rows[0].dataValues).to.not.have.property('username');
        expect(info.rows[1].dataValues).to.not.have.property('username');
        done();
      });
    });
  });

  describe('all', function() {
    beforeEach(function(done) {
      this.User.bulkCreate([
        {username: 'user', data: 'foobar'},
        {username: 'user2', data: 'bar'}
      ]).complete(function() {
        done();
      });
    });

    if (current.dialect.supports.transactions) {
      it('supports transactions', function(done) {
        Support.prepareTransactionTest(this.sequelize, function(sequelize) {
          var User = sequelize.define('User', { username: Sequelize.STRING });

          User.sync({ force: true }).success(function() {
            sequelize.transaction().then(function(t) {
              User.create({ username: 'foo' }, { transaction: t }).success(function() {
                User.all().success(function(users1) {
                  User.all({ transaction: t }).success(function(users2) {
                    expect(users1.length).to.equal(0);
                    expect(users2.length).to.equal(1);
                    t.rollback().success(function() { done(); });
                  });
                });
              });
            });
          });
        });
      });
    }

    it('should return all users', function(done) {
      this.User.all().on('success', function(users) {
        expect(users.length).to.equal(2);
        done();
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
