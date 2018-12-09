'use strict';

const chai = require('chai'),
  sinon = require('sinon'),
  Sequelize = require('../../../index'),
  expect = chai.expect,
  Support = require('../support'),
  Op = Sequelize.Op,
  DataTypes = require('../../../lib/data-types'),
  dialect = Support.getTestDialect(),
  config = require('../../config/config'),
  _ = require('lodash'),
  moment = require('moment'),
  current = Support.sequelize;

describe(Support.getTestDialectTeaser('Model'), () => {
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

  describe('findAll', () => {
    if (current.dialect.supports.transactions) {
      it('supports transactions', function() {
        return Support.prepareTransactionTest(this.sequelize).then(sequelize => {
          const User = sequelize.define('User', { username: Sequelize.STRING });

          return User.sync({ force: true }).then(() => {
            return sequelize.transaction().then(t => {
              return User.create({ username: 'foo' }, { transaction: t }).then(() => {
                return User.findAll({ where: { username: 'foo' } }).then(users1 => {
                  return User.findAll({ transaction: t }).then(users2 => {
                    return User.findAll({ where: { username: 'foo' }, transaction: t }).then(users3 => {
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

    it('should not crash on an empty where array', function() {
      return this.User.findAll({
        where: []
      });
    });

    describe('special where conditions/smartWhere object', () => {
      beforeEach(function() {
        this.buf = Buffer.alloc(16);
        this.buf.fill('\x01');
        return this.User.bulkCreate([
          { username: 'boo', intVal: 5, theDate: '2013-01-01 12:00' },
          { username: 'boo2', intVal: 10, theDate: '2013-01-10 12:00', binary: this.buf }
        ]);
      });

      it('should be able to find rows where attribute is in a list of values', function() {
        return this.User.findAll({
          where: {
            username: ['boo', 'boo2']
          }
        }).then(users => {
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
        }).then(users => {
          expect(users).to.have.length(1);
          expect(users[0].binary.toString()).to.equal(this.buf.toString());
          expect(users[0].username).to.equal('boo2');
        });
      });

      it('should be able to find a row using like', function() {
        return this.User.findAll({
          where: {
            username: {
              [Op.like]: '%2'
            }
          }
        }).then(users => {
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
              [Op.notLike]: '%2'
            }
          }
        }).then(users => {
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
                [Op.iLike]: '%2'
              }
            }
          }).then(users => {
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
                [Op.notILike]: '%2'
              }
            }
          }).then(users => {
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
              [Op.between]: ['2013-01-02', '2013-01-11']
            }
          }
        }).then(users => {
          expect(users[0].username).to.equal('boo2');
          expect(users[0].intVal).to.equal(10);
        });
      });

      it('should be able to find a row not between a certain integer using the not between shortcut', function() {
        return this.User.findAll({
          where: {
            intVal: {
              [Op.notBetween]: [8, 10]
            }
          }
        }).then(users => {
          expect(users[0].username).to.equal('boo');
          expect(users[0].intVal).to.equal(5);
        });
      });

      it('should be able to handle false/true values just fine...', function() {
        const User = this.User;

        return User.bulkCreate([
          { username: 'boo5', aBool: false },
          { username: 'boo6', aBool: true }
        ]).then(() => {
          return User.findAll({ where: { aBool: false } }).then(users => {
            expect(users).to.have.length(1);
            expect(users[0].username).to.equal('boo5');
            return User.findAll({ where: { aBool: true } }).then(_users => {
              expect(_users).to.have.length(1);
              expect(_users[0].username).to.equal('boo6');
            });
          });
        });
      });

      it('should be able to handle false/true values through associations as well...', function() {
        const User = this.User,
          Passports = this.sequelize.define('Passports', {
            isActive: Sequelize.BOOLEAN
          });

        User.hasMany(Passports);
        Passports.belongsTo(User);

        return User.sync({ force: true }).then(() => {
          return Passports.sync({ force: true }).then(() => {
            return User.bulkCreate([
              { username: 'boo5', aBool: false },
              { username: 'boo6', aBool: true }
            ]).then(() => {
              return Passports.bulkCreate([
                { isActive: true },
                { isActive: false }
              ]).then(() => {
                return User.findByPk(1).then(user => {
                  return Passports.findByPk(1).then(passport => {
                    return user.setPassports([passport]).then(() => {
                      return User.findByPk(2).then(_user => {
                        return Passports.findByPk(2).then(_passport => {
                          return _user.setPassports([_passport]).then(() => {
                            return _user.getPassports({ where: { isActive: false } }).then(theFalsePassport => {
                              return user.getPassports({ where: { isActive: true } }).then(theTruePassport => {
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
        const User = this.User;
        const Binary = this.sequelize.define('Binary', {
          id: {
            type: DataTypes.STRING(16, true),
            primaryKey: true
          }
        });

        const buf1 = this.buf;
        const buf2 = Buffer.alloc(16);
        buf2.fill('\x02');

        User.belongsTo(Binary, { foreignKey: 'binary' });

        return this.sequelize.sync({ force: true }).then(() => {
          return User.bulkCreate([
            { username: 'boo5', aBool: false },
            { username: 'boo6', aBool: true }
          ]).then(() => {
            return Binary.bulkCreate([
              { id: buf1 },
              { id: buf2 }
            ]).then(() => {
              return User.findByPk(1).then(user => {
                return Binary.findByPk(buf1).then(binary => {
                  return user.setBinary(binary).then(() => {
                    return User.findByPk(2).then(_user => {
                      return Binary.findByPk(buf2).then(_binary => {
                        return _user.setBinary(_binary).then(() => {
                          return _user.getBinary().then(_binaryRetrieved => {
                            return user.getBinary().then(binaryRetrieved => {
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

      it('should be able to find a row between a certain date', function() {
        return this.User.findAll({
          where: {
            theDate: {
              [Op.between]: ['2013-01-02', '2013-01-11']
            }
          }
        }).then(users => {
          expect(users[0].username).to.equal('boo2');
          expect(users[0].intVal).to.equal(10);
        });
      });

      it('should be able to find a row between a certain date and an additional where clause', function() {
        return this.User.findAll({
          where: {
            theDate: {
              [Op.between]: ['2013-01-02', '2013-01-11']
            },
            intVal: 10
          }
        }).then(users => {
          expect(users[0].username).to.equal('boo2');
          expect(users[0].intVal).to.equal(10);
        });
      });

      it('should be able to find a row not between a certain integer', function() {
        return this.User.findAll({
          where: {
            intVal: {
              [Op.notBetween]: [8, 10]
            }
          }
        }).then(users => {
          expect(users[0].username).to.equal('boo');
          expect(users[0].intVal).to.equal(5);
        });
      });

      it('should be able to find a row using not between and between logic', function() {
        return this.User.findAll({
          where: {
            theDate: {
              [Op.between]: ['2012-12-10', '2013-01-02'],
              [Op.notBetween]: ['2013-01-04', '2013-01-20']
            }
          }
        }).then(users => {
          expect(users[0].username).to.equal('boo');
          expect(users[0].intVal).to.equal(5);
        });
      });

      it('should be able to find a row using not between and between logic with dates', function() {
        return this.User.findAll({
          where: {
            theDate: {
              [Op.between]: [new Date('2012-12-10'), new Date('2013-01-02')],
              [Op.notBetween]: [new Date('2013-01-04'), new Date('2013-01-20')]
            }
          }
        }).then(users => {
          expect(users[0].username).to.equal('boo');
          expect(users[0].intVal).to.equal(5);
        });
      });

      it('should be able to find a row using greater than or equal to logic with dates', function() {
        return this.User.findAll({
          where: {
            theDate: {
              [Op.gte]: new Date('2013-01-09')
            }
          }
        }).then(users => {
          expect(users[0].username).to.equal('boo2');
          expect(users[0].intVal).to.equal(10);
        });
      });

      it('should be able to find a row using greater than or equal to', function() {
        return this.User.findOne({
          where: {
            intVal: {
              [Op.gte]: 6
            }
          }
        }).then(user => {
          expect(user.username).to.equal('boo2');
          expect(user.intVal).to.equal(10);
        });
      });

      it('should be able to find a row using greater than', function() {
        return this.User.findOne({
          where: {
            intVal: {
              [Op.gt]: 5
            }
          }
        }).then(user => {
          expect(user.username).to.equal('boo2');
          expect(user.intVal).to.equal(10);
        });
      });

      it('should be able to find a row using lesser than or equal to', function() {
        return this.User.findOne({
          where: {
            intVal: {
              [Op.lte]: 5
            }
          }
        }).then(user => {
          expect(user.username).to.equal('boo');
          expect(user.intVal).to.equal(5);
        });
      });

      it('should be able to find a row using lesser than', function() {
        return this.User.findOne({
          where: {
            intVal: {
              [Op.lt]: 6
            }
          }
        }).then(user => {
          expect(user.username).to.equal('boo');
          expect(user.intVal).to.equal(5);
        });
      });

      it('should have no problem finding a row using lesser and greater than', function() {
        return this.User.findAll({
          where: {
            intVal: {
              [Op.lt]: 6,
              [Op.gt]: 4
            }
          }
        }).then(users => {
          expect(users[0].username).to.equal('boo');
          expect(users[0].intVal).to.equal(5);
        });
      });

      it('should be able to find a row using not equal to logic', function() {
        return this.User.findOne({
          where: {
            intVal: {
              [Op.ne]: 10
            }
          }
        }).then(user => {
          expect(user.username).to.equal('boo');
          expect(user.intVal).to.equal(5);
        });
      });

      it('should be able to find multiple users with any of the special where logic properties', function() {
        return this.User.findAll({
          where: {
            intVal: {
              [Op.lte]: 10
            }
          }
        }).then(users => {
          expect(users[0].username).to.equal('boo');
          expect(users[0].intVal).to.equal(5);
          expect(users[1].username).to.equal('boo2');
          expect(users[1].intVal).to.equal(10);
        });
      });

      if (dialect === 'postgres' || dialect === 'sqlite') {
        it('should be able to find multiple users with case-insensitive on CITEXT type', function() {
          const User = this.sequelize.define('UsersWithCaseInsensitiveName', {
            username: Sequelize.CITEXT
          });

          return User.sync({ force: true }).then(() => {
            return User.bulkCreate([
              { username: 'lowercase' },
              { username: 'UPPERCASE' },
              { username: 'MIXEDcase' }
            ]);
          }).then(() => {
            return User.findAll({
              where: { username: ['LOWERCASE', 'uppercase', 'mixedCase'] },
              order: [['id', 'ASC']]
            });
          }).then(users => {
            expect(users[0].username).to.equal('lowercase');
            expect(users[1].username).to.equal('UPPERCASE');
            expect(users[2].username).to.equal('MIXEDcase');
          });
        });
      }
    });

    describe('eager loading', () => {
      it('should not ignore where condition with empty includes, #8771', function() {
        return this.User.bulkCreate([
          { username: 'D.E.N.N.I.S', intVal: 6 },
          { username: 'F.R.A.N.K', intVal: 5 },
          { username: 'W.I.L.D C.A.R.D', intVal: 8 }
        ]).then(() => this.User.findAll({
          where: {
            intVal: 8
          },
          include: []
        })).then(users => {
          expect(users).to.have.length(1);
          expect(users[0].get('username')).to.be.equal('W.I.L.D C.A.R.D');
        });
      });

      describe('belongsTo', () => {
        beforeEach(function() {
          this.Task = this.sequelize.define('TaskBelongsTo', { title: Sequelize.STRING });
          this.Worker = this.sequelize.define('Worker', { name: Sequelize.STRING });
          this.Task.belongsTo(this.Worker);

          return this.Worker.sync({ force: true }).then(() => {
            return this.Task.sync({ force: true }).then(() => {
              return this.Worker.create({ name: 'worker' }).then(worker => {
                return this.Task.create({ title: 'homework' }).then(task => {
                  this.worker = worker;
                  this.task = task;
                  return this.task.setWorker(this.worker);
                });
              });
            });
          });
        });

        it('throws an error about unexpected input if include contains a non-object', function() {
          return this.Worker.findAll({ include: [1] }).catch(err => {
            expect(err.message).to.equal('Include unexpected. Element has to be either a Model, an Association or an object.');
          });
        });

        it('throws an error if included DaoFactory is not associated', function() {
          return this.Worker.findAll({ include: [this.Task] }).catch(err => {
            expect(err.message).to.equal('TaskBelongsTo is not associated to Worker!');
          });
        });

        it('returns the associated worker via task.worker', function() {
          return this.Task.findAll({
            where: { title: 'homework' },
            include: [this.Worker]
          }).then(tasks => {
            expect(tasks).to.exist;
            expect(tasks[0].Worker).to.exist;
            expect(tasks[0].Worker.name).to.equal('worker');
          });
        });

        it('returns the associated worker via task.worker, using limit and sort', function() {
          return this.Task.findAll({
            where: { title: 'homework' },
            include: [this.Worker],
            limit: 1,
            order: [['title', 'DESC']]
          }).then(tasks => {
            expect(tasks).to.exist;
            expect(tasks[0].Worker).to.exist;
            expect(tasks[0].Worker.name).to.equal('worker');
          });
        });
      });

      describe('hasOne', () => {
        beforeEach(function() {
          this.Task = this.sequelize.define('TaskHasOne', { title: Sequelize.STRING });
          this.Worker = this.sequelize.define('Worker', { name: Sequelize.STRING });
          this.Worker.hasOne(this.Task);
          return this.Worker.sync({ force: true }).then(() => {
            return this.Task.sync({ force: true }).then(() => {
              return this.Worker.create({ name: 'worker' }).then(worker => {
                return this.Task.create({ title: 'homework' }).then(task => {
                  this.worker = worker;
                  this.task = task;
                  return this.worker.setTaskHasOne(this.task);
                });
              });
            });
          });
        });

        it('throws an error if included DaoFactory is not associated', function() {
          return this.Task.findAll({ include: [this.Worker] }).catch(err => {
            expect(err.message).to.equal('Worker is not associated to TaskHasOne!');
          });
        });

        it('returns the associated task via worker.task', function() {
          return this.Worker.findAll({
            where: { name: 'worker' },
            include: [this.Task]
          }).then(workers => {
            expect(workers).to.exist;
            expect(workers[0].TaskHasOne).to.exist;
            expect(workers[0].TaskHasOne.title).to.equal('homework');
          });
        });
      });

      describe('hasOne with alias', () => {
        beforeEach(function() {
          this.Task = this.sequelize.define('Task', { title: Sequelize.STRING });
          this.Worker = this.sequelize.define('Worker', { name: Sequelize.STRING });
          this.Worker.hasOne(this.Task, { as: 'ToDo' });
          return this.Worker.sync({ force: true }).then(() => {
            return this.Task.sync({ force: true }).then(() => {
              return this.Worker.create({ name: 'worker' }).then(worker => {
                return this.Task.create({ title: 'homework' }).then(task => {
                  this.worker = worker;
                  this.task = task;
                  return this.worker.setToDo(this.task);
                });
              });
            });
          });
        });

        it('throws an error if included DaoFactory is not referenced by alias', function() {
          return this.Worker.findAll({ include: [this.Task] }).catch(err => {
            expect(err.message).to.equal('Task is associated to Worker using an alias. ' +
            'You must use the \'as\' keyword to specify the alias within your include statement.');
          });
        });

        it('throws an error if alias is not associated', function() {
          return this.Worker.findAll({ include: [{ model: this.Task, as: 'Work' }] }).catch(err => {
            expect(err.message).to.equal('Task is associated to Worker using an alias. ' +
            'You\'ve included an alias (Work), but it does not match the alias(es) defined in your association (ToDo).');
          });
        });

        it('returns the associated task via worker.task', function() {
          return this.Worker.findAll({
            where: { name: 'worker' },
            include: [{ model: this.Task, as: 'ToDo' }]
          }).then(workers => {
            expect(workers).to.exist;
            expect(workers[0].ToDo).to.exist;
            expect(workers[0].ToDo.title).to.equal('homework');
          });
        });

        it('returns the associated task via worker.task when daoFactory is aliased with model', function() {
          return this.Worker.findAll({
            where: { name: 'worker' },
            include: [{ model: this.Task, as: 'ToDo' }]
          }).then(workers => {
            expect(workers[0].ToDo.title).to.equal('homework');
          });
        });
      });

      describe('hasMany', () => {
        beforeEach(function() {
          this.Task = this.sequelize.define('task', { title: Sequelize.STRING });
          this.Worker = this.sequelize.define('worker', { name: Sequelize.STRING });
          this.Worker.hasMany(this.Task);
          return this.Worker.sync({ force: true }).then(() => {
            return this.Task.sync({ force: true }).then(() => {
              return this.Worker.create({ name: 'worker' }).then(worker => {
                return this.Task.create({ title: 'homework' }).then(task => {
                  this.worker = worker;
                  this.task = task;
                  return this.worker.setTasks([this.task]);
                });
              });
            });
          });
        });

        it('throws an error if included DaoFactory is not associated', function() {
          return this.Task.findAll({ include: [this.Worker] }).catch(err => {
            expect(err.message).to.equal('worker is not associated to task!');
          });
        });

        it('returns the associated tasks via worker.tasks', function() {
          return this.Worker.findAll({
            where: { name: 'worker' },
            include: [this.Task]
          }).then(workers => {
            expect(workers).to.exist;
            expect(workers[0].tasks).to.exist;
            expect(workers[0].tasks[0].title).to.equal('homework');
          });
        });

        // https://github.com/sequelize/sequelize/issues/8739
        it('supports sorting on renamed sub-query attribute', function() {
          const User = this.sequelize.define('user', {
            name: {
              type: Sequelize.STRING,
              field: 'some_other_name'
            }
          });
          const Project = this.sequelize.define('project', { title: Sequelize.STRING });
          User.hasMany(Project);

          return User.sync({ force: true })
            .then(() => Project.sync({ force: true }))
            .then(() => {
              return User.bulkCreate([
                { name: 'a' },
                { name: 'b' },
                { name: 'c' }
              ]);
            })
            .then(() => {
              return User.findAll({
                order: ['name'],
                limit: 2, // to force use of a sub-query
                include: [Project]
              });
            })
            .then(users => {
              expect(users).to.have.lengthOf(2);
              expect(users[0].name).to.equal('a');
              expect(users[1].name).to.equal('b');
            });
        });

        it('supports sorting DESC on renamed sub-query attribute', function() {
          const User = this.sequelize.define('user', {
            name: {
              type: Sequelize.STRING,
              field: 'some_other_name'
            }
          });
          const Project = this.sequelize.define('project', { title: Sequelize.STRING });
          User.hasMany(Project);

          return User.sync({ force: true })
            .then(() => Project.sync({ force: true }))
            .then(() => {
              return User.bulkCreate([
                { name: 'a' },
                { name: 'b' },
                { name: 'c' }
              ]);
            })
            .then(() => {
              return User.findAll({
                order: [['name', 'DESC']],
                limit: 2,
                include: [Project]
              });
            })
            .then(users => {
              expect(users).to.have.lengthOf(2);
              expect(users[0].name).to.equal('c');
              expect(users[1].name).to.equal('b');
            });
        });

        it('supports sorting on multiple renamed sub-query attributes', function() {
          const User = this.sequelize.define('user', {
            name: {
              type: Sequelize.STRING,
              field: 'some_other_name'
            },
            age: {
              type: Sequelize.INTEGER,
              field: 'a_g_e'
            }
          });
          const Project = this.sequelize.define('project', { title: Sequelize.STRING });
          User.hasMany(Project);

          return User.sync({ force: true })
            .then(() => Project.sync({ force: true }))
            .then(() => {
              return User.bulkCreate([
                { name: 'a', age: 1 },
                { name: 'a', age: 2 },
                { name: 'b', age: 3 }
              ]);
            })
            .then(() => {
              return User.findAll({
                order: [['name', 'ASC'], ['age', 'DESC']],
                limit: 2,
                include: [Project]
              });
            })
            .then(users => {
              expect(users).to.have.lengthOf(2);
              expect(users[0].name).to.equal('a');
              expect(users[0].age).to.equal(2);
              expect(users[1].name).to.equal('a');
              expect(users[1].age).to.equal(1);
            })
            .then(() => {
              return User.findAll({
                order: [['name', 'DESC'], 'age'],
                limit: 2,
                include: [Project]
              });
            })
            .then(users => {
              expect(users).to.have.lengthOf(2);
              expect(users[0].name).to.equal('b');
              expect(users[1].name).to.equal('a');
              expect(users[1].age).to.equal(1);
            });
        });
      });

      describe('hasMany with alias', () => {
        beforeEach(function() {
          this.Task = this.sequelize.define('Task', { title: Sequelize.STRING });
          this.Worker = this.sequelize.define('Worker', { name: Sequelize.STRING });
          this.Worker.hasMany(this.Task, { as: 'ToDos' });
          return this.Worker.sync({ force: true }).then(() => {
            return this.Task.sync({ force: true }).then(() => {
              return this.Worker.create({ name: 'worker' }).then(worker => {
                return this.Task.create({ title: 'homework' }).then(task => {
                  this.worker = worker;
                  this.task = task;
                  return this.worker.setToDos([this.task]);
                });
              });
            });
          });
        });

        it('throws an error if included DaoFactory is not referenced by alias', function() {
          return this.Worker.findAll({ include: [this.Task] }).catch(err => {
            expect(err.message).to.equal('Task is associated to Worker using an alias. ' +
            'You must use the \'as\' keyword to specify the alias within your include statement.');
          });
        });

        it('throws an error if alias is not associated', function() {
          return this.Worker.findAll({ include: [{ model: this.Task, as: 'Work' }] }).catch(err => {
            expect(err.message).to.equal('Task is associated to Worker using an alias. ' +
            'You\'ve included an alias (Work), but it does not match the alias(es) defined in your association (ToDos).');
          });
        });

        it('returns the associated task via worker.task', function() {
          return this.Worker.findAll({
            where: { name: 'worker' },
            include: [{ model: this.Task, as: 'ToDos' }]
          }).then(workers => {
            expect(workers).to.exist;
            expect(workers[0].ToDos).to.exist;
            expect(workers[0].ToDos[0].title).to.equal('homework');
          });
        });

        it('returns the associated task via worker.task when daoFactory is aliased with model', function() {
          return this.Worker.findAll({
            where: { name: 'worker' },
            include: [{ model: this.Task, as: 'ToDos' }]
          }).then(workers => {
            expect(workers[0].ToDos[0].title).to.equal('homework');
          });
        });
      });

      describe('queryOptions', () => {
        beforeEach(function() {
          return this.User.create({ username: 'barfooz' }).then(user => {
            this.user = user;
          });
        });

        it('should return a DAO when queryOptions are not set', function() {
          return this.User.findAll({ where: { username: 'barfooz' } }).then(users => {
            users.forEach(user => {
              expect(user).to.be.instanceOf(this.User);
            });
          });
        });

        it('should return a DAO when raw is false', function() {
          return this.User.findAll({ where: { username: 'barfooz' }, raw: false }).then(users => {
            users.forEach(user => {
              expect(user).to.be.instanceOf(this.User);
            });
          });
        });

        it('should return raw data when raw is true', function() {
          return this.User.findAll({ where: { username: 'barfooz' }, raw: true }).then(users => {
            users.forEach(user => {
              expect(user).to.not.be.instanceOf(this.User);
              expect(users[0]).to.be.instanceOf(Object);
            });
          });
        });
      });

      describe('include all', () => {
        beforeEach(function() {
          this.Continent = this.sequelize.define('continent', { name: Sequelize.STRING });
          this.Country = this.sequelize.define('country', { name: Sequelize.STRING });
          this.Industry = this.sequelize.define('industry', { name: Sequelize.STRING });
          this.Person = this.sequelize.define('person', { name: Sequelize.STRING, lastName: Sequelize.STRING });

          this.Continent.hasMany(this.Country);
          this.Country.belongsTo(this.Continent);
          this.Country.belongsToMany(this.Industry, { through: 'country_industry' });
          this.Industry.belongsToMany(this.Country, { through: 'country_industry' });
          this.Country.hasMany(this.Person);
          this.Person.belongsTo(this.Country);
          this.Country.hasMany(this.Person, { as: 'residents', foreignKey: 'CountryResidentId' });
          this.Person.belongsTo(this.Country, { as: 'CountryResident', foreignKey: 'CountryResidentId' });

          return this.sequelize.sync({ force: true }).then(() => {
            return Sequelize.Promise.props({
              europe: this.Continent.create({ name: 'Europe' }),
              england: this.Country.create({ name: 'England' }),
              coal: this.Industry.create({ name: 'Coal' }),
              bob: this.Person.create({ name: 'Bob', lastName: 'Becket' })
            }).then(r => {
              _.forEach(r, (item, itemName) => {
                this[itemName] = item;
              });
              return Sequelize.Promise.all([
                this.england.setContinent(this.europe),
                this.england.addIndustry(this.coal),
                this.bob.setCountry(this.england),
                this.bob.setCountryResident(this.england)
              ]);
            });
          });
        });

        it('includes all associations', function() {
          return this.Country.findAll({ include: [{ all: true }] }).then(countries => {
            expect(countries).to.exist;
            expect(countries[0]).to.exist;
            expect(countries[0].continent).to.exist;
            expect(countries[0].industries).to.exist;
            expect(countries[0].people).to.exist;
            expect(countries[0].residents).to.exist;
          });
        });

        it('includes specific type of association', function() {
          return this.Country.findAll({ include: [{ all: 'BelongsTo' }] }).then(countries => {
            expect(countries).to.exist;
            expect(countries[0]).to.exist;
            expect(countries[0].continent).to.exist;
            expect(countries[0].industries).not.to.exist;
            expect(countries[0].people).not.to.exist;
            expect(countries[0].residents).not.to.exist;
          });
        });

        it('utilises specified attributes', function() {
          return this.Country.findAll({ include: [{ all: 'HasMany', attributes: ['name'] }] }).then(countries => {
            expect(countries).to.exist;
            expect(countries[0]).to.exist;
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
          return this.Country.findAll({ include: [{ all: true }, { model: this.Continent, attributes: ['id'] }] }).then(countries => {
            expect(countries).to.exist;
            expect(countries[0]).to.exist;
            expect(countries[0].continent).to.exist;
            expect(countries[0].continent.name).to.be.undefined;
          });
        });

        it('includes all nested associations', function() {
          return this.Continent.findAll({ include: [{ all: true, nested: true }] }).then(continents => {
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

      describe('properly handles attributes:[] cases', () => {
        beforeEach(function() {
          this.Animal = this.sequelize.define('Animal', {
            name: Sequelize.STRING,
            age: Sequelize.INTEGER
          });
          this.Kingdom = this.sequelize.define('Kingdom', {
            name: Sequelize.STRING
          });
          this.AnimalKingdom = this.sequelize.define('AnimalKingdom', {
            relation: Sequelize.STRING,
            mutation: Sequelize.BOOLEAN
          });

          this.Kingdom.belongsToMany(this.Animal, { through: this.AnimalKingdom });

          return this.sequelize.sync({ force: true })
            .then(() => Sequelize.Promise.all([
              this.Animal.create({ name: 'Dog', age: 20 }),
              this.Animal.create({ name: 'Cat', age: 30 }),
              this.Animal.create({ name: 'Peacock', age: 25 }),
              this.Animal.create({ name: 'Fish', age: 100 })
            ]))
            .then(([a1, a2, a3, a4]) => Sequelize.Promise.all([
              this.Kingdom.create({ name: 'Earth' }),
              this.Kingdom.create({ name: 'Water' }),
              this.Kingdom.create({ name: 'Wind' })
            ]).then(([k1, k2, k3]) =>
              Sequelize.Promise.all([
                k1.addAnimals([a1, a2]),
                k2.addAnimals([a4]),
                k3.addAnimals([a3])
              ])
            ));
        });

        it('N:M with ignoring include.attributes only', function() {
          return this.Kingdom.findAll({
            include: [{
              model: this.Animal,
              where: { age: { [Op.gte]: 29 } },
              attributes: []
            }]
          }).then(kingdoms => {
            expect(kingdoms.length).to.be.eql(2);
            kingdoms.forEach(kingdom => {
              // include.attributes:[] , model doesn't exists
              expect(kingdom.Animals).to.not.exist;
            });
          });
        });

        it('N:M with ignoring through.attributes only', function() {
          return this.Kingdom.findAll({
            include: [{
              model: this.Animal,
              where: { age: { [Op.gte]: 29 } },
              through: {
                attributes: []
              }
            }]
          }).then(kingdoms => {
            expect(kingdoms.length).to.be.eql(2);
            kingdoms.forEach(kingdom => {
              expect(kingdom.Animals).to.exist; // include model exists
              expect(kingdom.Animals[0].AnimalKingdom).to.not.exist; // through doesn't exists
            });
          });
        });

        it('N:M with ignoring include.attributes but having through.attributes', function() {
          return this.Kingdom.findAll({
            include: [{
              model: this.Animal,
              where: { age: { [Op.gte]: 29 } },
              attributes: [],
              through: {
                attributes: ['mutation']
              }
            }]
          }).then(kingdoms => {
            expect(kingdoms.length).to.be.eql(2);
            kingdoms.forEach(kingdom => {
              // include.attributes: [], model doesn't exists
              expect(kingdom.Animals).to.not.exist;
            });
          });
        });
      });
    });

    describe('order by eager loaded tables', () => {
      describe('HasMany', () => {
        beforeEach(function() {
          this.Continent = this.sequelize.define('continent', { name: Sequelize.STRING });
          this.Country = this.sequelize.define('country', { name: Sequelize.STRING });
          this.Person = this.sequelize.define('person', { name: Sequelize.STRING, lastName: Sequelize.STRING });

          this.Continent.hasMany(this.Country);
          this.Country.belongsTo(this.Continent);
          this.Country.hasMany(this.Person);
          this.Person.belongsTo(this.Country);
          this.Country.hasMany(this.Person, { as: 'residents', foreignKey: 'CountryResidentId' });
          this.Person.belongsTo(this.Country, { as: 'CountryResident', foreignKey: 'CountryResidentId' });

          return this.sequelize.sync({ force: true }).then(() => {
            return Sequelize.Promise.props({
              europe: this.Continent.create({ name: 'Europe' }),
              asia: this.Continent.create({ name: 'Asia' }),
              england: this.Country.create({ name: 'England' }),
              france: this.Country.create({ name: 'France' }),
              korea: this.Country.create({ name: 'Korea' }),
              bob: this.Person.create({ name: 'Bob', lastName: 'Becket' }),
              fred: this.Person.create({ name: 'Fred', lastName: 'Able' }),
              pierre: this.Person.create({ name: 'Pierre', lastName: 'Paris' }),
              kim: this.Person.create({ name: 'Kim', lastName: 'Z' })
            }).then(r => {
              _.forEach(r, (item, itemName) => {
                this[itemName] = item;
              });

              return Sequelize.Promise.all([
                this.england.setContinent(this.europe),
                this.france.setContinent(this.europe),
                this.korea.setContinent(this.asia),

                this.bob.setCountry(this.england),
                this.fred.setCountry(this.england),
                this.pierre.setCountry(this.france),
                this.kim.setCountry(this.korea),

                this.bob.setCountryResident(this.england),
                this.fred.setCountryResident(this.france),
                this.pierre.setCountryResident(this.korea),
                this.kim.setCountryResident(this.england)
              ]);
            });
          });
        });

        it('sorts simply', function() {
          return Sequelize.Promise.map([['ASC', 'Asia'], ['DESC', 'Europe']], params => {
            return this.Continent.findAll({
              order: [['name', params[0]]]
            }).then(continents => {
              expect(continents).to.exist;
              expect(continents[0]).to.exist;
              expect(continents[0].name).to.equal(params[1]);
            });
          });
        });

        it('sorts by 1st degree association', function() {
          return Sequelize.Promise.map([['ASC', 'Europe', 'England'], ['DESC', 'Asia', 'Korea']], params => {
            return this.Continent.findAll({
              include: [this.Country],
              order: [[this.Country, 'name', params[0]]]
            }).then(continents => {
              expect(continents).to.exist;
              expect(continents[0]).to.exist;
              expect(continents[0].name).to.equal(params[1]);
              expect(continents[0].countries).to.exist;
              expect(continents[0].countries[0]).to.exist;
              expect(continents[0].countries[0].name).to.equal(params[2]);
            });
          });
        });

        it('sorts simply and by 1st degree association with limit where 1st degree associated instances returned for second one and not the first', function() {
          return Sequelize.Promise.map([['ASC', 'Asia', 'Europe', 'England']], params => {
            return this.Continent.findAll({
              include: [{
                model: this.Country,
                required: false,
                where: {
                  name: params[3]
                }
              }],
              limit: 2,
              order: [['name', params[0]], [this.Country, 'name', params[0]]]
            }).then(continents => {
              expect(continents).to.exist;
              expect(continents[0]).to.exist;
              expect(continents[0].name).to.equal(params[1]);
              expect(continents[0].countries).to.exist;
              expect(continents[0].countries.length).to.equal(0);
              expect(continents[1]).to.exist;
              expect(continents[1].name).to.equal(params[2]);
              expect(continents[1].countries).to.exist;
              expect(continents[1].countries.length).to.equal(1);
              expect(continents[1].countries[0]).to.exist;
              expect(continents[1].countries[0].name).to.equal(params[3]);
            });
          });
        });

        it('sorts by 2nd degree association', function() {
          return Sequelize.Promise.map([['ASC', 'Europe', 'England', 'Fred'], ['DESC', 'Asia', 'Korea', 'Kim']], params => {
            return this.Continent.findAll({
              include: [{ model: this.Country, include: [this.Person] }],
              order: [[this.Country, this.Person, 'lastName', params[0]]]
            }).then(continents => {
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
          return Sequelize.Promise.map([['ASC', 'Europe', 'France', 'Fred'], ['DESC', 'Europe', 'England', 'Kim']], params => {
            return this.Continent.findAll({
              include: [{ model: this.Country, include: [this.Person, { model: this.Person, as: 'residents' }] }],
              order: [[this.Country, { model: this.Person, as: 'residents' }, 'lastName', params[0]]]
            }).then(continents => {
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
          return Sequelize.Promise.map([['ASC', 'Europe', 'France', 'Fred'], ['DESC', 'Europe', 'England', 'Kim']], params => {
            return this.Continent.findAll({
              include: [{ model: this.Country, include: [this.Person, { model: this.Person, as: 'residents' }] }],
              order: [[{ model: this.Country }, { model: this.Person, as: 'residents' }, 'lastName', params[0]]],
              limit: 3
            }).then(continents => {
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

      describe('ManyToMany', () => {
        beforeEach(function() {
          this.Country = this.sequelize.define('country', { name: Sequelize.STRING });
          this.Industry = this.sequelize.define('industry', { name: Sequelize.STRING });
          this.IndustryCountry = this.sequelize.define('IndustryCountry', { numYears: Sequelize.INTEGER });

          this.Country.belongsToMany(this.Industry, { through: this.IndustryCountry });
          this.Industry.belongsToMany(this.Country, { through: this.IndustryCountry });

          return this.sequelize.sync({ force: true }).then(() => {
            return Sequelize.Promise.props({
              england: this.Country.create({ name: 'England' }),
              france: this.Country.create({ name: 'France' }),
              korea: this.Country.create({ name: 'Korea' }),
              energy: this.Industry.create({ name: 'Energy' }),
              media: this.Industry.create({ name: 'Media' }),
              tech: this.Industry.create({ name: 'Tech' })
            }).then(r => {
              _.forEach(r, (item, itemName) => {
                this[itemName] = item;
              });

              return Sequelize.Promise.all([
                this.england.addIndustry(this.energy, { through: { numYears: 20 } }),
                this.england.addIndustry(this.media, { through: { numYears: 40 } }),
                this.france.addIndustry(this.media, { through: { numYears: 80 } }),
                this.korea.addIndustry(this.tech, { through: { numYears: 30 } })
              ]);
            });
          });
        });

        it('sorts by 1st degree association', function() {
          return Sequelize.Promise.map([['ASC', 'England', 'Energy'], ['DESC', 'Korea', 'Tech']], params => {
            return this.Country.findAll({
              include: [this.Industry],
              order: [[this.Industry, 'name', params[0]]]
            }).then(countries => {
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
          return Sequelize.Promise.map([['ASC', 'England', 'Energy'], ['DESC', 'Korea', 'Tech']], params => {
            return this.Country.findAll({
              include: [this.Industry],
              order: [
                [this.Industry, 'name', params[0]]
              ],
              limit: 3
            }).then(countries => {
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
          return Sequelize.Promise.map([['ASC', 'England', 'Energy'], ['DESC', 'France', 'Media']], params => {
            return this.Country.findAll({
              include: [this.Industry],
              order: [[this.Industry, this.IndustryCountry, 'numYears', params[0]]]
            }).then(countries => {
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

    describe('normal findAll', () => {
      beforeEach(function() {
        return this.User.create({ username: 'user', data: 'foobar', theDate: moment().toDate() }).then(user => {
          return this.User.create({ username: 'user2', data: 'bar', theDate: moment().toDate() }).then(user2 => {
            this.users = [user].concat(user2);
          });
        });
      });

      it('finds all entries', function() {
        return this.User.findAll().then(users => {
          expect(users.length).to.equal(2);
        });
      });

      it('can also handle object notation', function() {
        return this.User.findAll({ where: { id: this.users[1].id } }).then(users => {
          expect(users.length).to.equal(1);
          expect(users[0].id).to.equal(this.users[1].id);
        });
      });

      it('sorts the results via id in ascending order', function() {
        return this.User.findAll().then(users => {
          expect(users.length).to.equal(2);
          expect(users[0].id).to.be.below(users[1].id);
        });
      });

      it('sorts the results via id in descending order', function() {
        return this.User.findAll({ order: [['id', 'DESC']] }).then(users => {
          expect(users[0].id).to.be.above(users[1].id);
        });
      });

      it('sorts the results via a date column', function() {
        return this.User.create({ username: 'user3', data: 'bar', theDate: moment().add(2, 'hours').toDate() }).then(() => {
          return this.User.findAll({ order: [['theDate', 'DESC']] }).then(users => {
            expect(users[0].id).to.be.above(users[2].id);
          });
        });
      });

      it('handles offset and limit', function() {
        return this.User.bulkCreate([{ username: 'bobby' }, { username: 'tables' }]).then(() => {
          return this.User.findAll({ limit: 2, offset: 2 }).then(users => {
            expect(users.length).to.equal(2);
            expect(users[0].id).to.equal(3);
          });
        });
      });

      it('should allow us to find IDs using capital letters', function() {
        const User = this.sequelize.define(`User${config.rand()}`, {
          ID: { type: Sequelize.INTEGER, primaryKey: true, autoIncrement: true },
          Login: { type: Sequelize.STRING }
        });

        return User.sync({ force: true }).then(() => {
          return User.create({ Login: 'foo' }).then(() => {
            return User.findAll({ where: { ID: 1 } }).then(user => {
              expect(user).to.be.instanceof(Array);
              expect(user).to.have.length(1);
            });
          });
        });
      });

      it('should be possible to order by sequelize.col()', function() {
        const Company = this.sequelize.define('Company', {
          name: Sequelize.STRING
        });

        return Company.sync().then(() => {
          return Company.findAll({
            order: [this.sequelize.col('name')]
          });
        });
      });

      it('should pull in dependent fields for a VIRTUAL', function() {
        const User = this.sequelize.define('User', {
          active: {
            type: new Sequelize.VIRTUAL(Sequelize.BOOLEAN, ['createdAt']),
            get() {
              return this.get('createdAt') > Date.now() - 7 * 24 * 60 * 60 * 1000;
            }
          }
        }, {
          timestamps: true
        });

        return User.create().then(() => {
          return User.findAll({
            attributes: ['active']
          }).then(users => {
            users.forEach(user => {
              expect(user.get('createdAt')).to.be.ok;
              expect(user.get('active')).to.equal(true);
            });
          });
        });
      });

      it('should throw for undefined where parameters', function() {
        return this.User.findAll({ where: { username: undefined } }).then(() => {
          throw new Error('findAll should throw an error if where has a key with undefined value');
        }, err => {
          expect(err).to.be.an.instanceof(Error);
          expect(err.message).to.equal('WHERE parameter "username" has invalid "undefined" value');
        });
      });
    });
  });

  describe('findAndCountAll', () => {
    beforeEach(function() {
      return this.User.bulkCreate([
        { username: 'user', data: 'foobar' },
        { username: 'user2', data: 'bar' },
        { username: 'bobby', data: 'foo' }
      ]).then(() => {
        return this.User.findAll().then(users => {
          this.users = users;
        });
      });
    });

    if (current.dialect.supports.transactions) {
      it('supports transactions', function() {
        return Support.prepareTransactionTest(this.sequelize).then(sequelize => {
          const User = sequelize.define('User', { username: Sequelize.STRING });

          return User.sync({ force: true }).then(() => {
            return sequelize.transaction().then(t => {
              return User.create({ username: 'foo' }, { transaction: t }).then(() => {
                return User.findAndCountAll().then(info1 => {
                  return User.findAndCountAll({ transaction: t }).then(info2 => {
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

    it('handles where clause {only}', function() {
      return this.User.findAndCountAll({ where: { id: { [Op.ne]: this.users[0].id } } }).then(info => {
        expect(info.count).to.equal(2);
        expect(Array.isArray(info.rows)).to.be.ok;
        expect(info.rows.length).to.equal(2);
      });
    });

    it('handles where clause with ordering {only}', function() {
      return this.User.findAndCountAll({ where: { id: { [Op.ne]: this.users[0].id } }, order: [['id', 'ASC']] }).then(info => {
        expect(info.count).to.equal(2);
        expect(Array.isArray(info.rows)).to.be.ok;
        expect(info.rows.length).to.equal(2);
      });
    });

    it('handles offset', function() {
      return this.User.findAndCountAll({ offset: 1 }).then(info => {
        expect(info.count).to.equal(3);
        expect(Array.isArray(info.rows)).to.be.ok;
        expect(info.rows.length).to.equal(2);
      });
    });

    it('handles limit', function() {
      return this.User.findAndCountAll({ limit: 1 }).then(info => {
        expect(info.count).to.equal(3);
        expect(Array.isArray(info.rows)).to.be.ok;
        expect(info.rows.length).to.equal(1);
      });
    });

    it('handles offset and limit', function() {
      return this.User.findAndCountAll({ offset: 1, limit: 1 }).then(info => {
        expect(info.count).to.equal(3);
        expect(Array.isArray(info.rows)).to.be.ok;
        expect(info.rows.length).to.equal(1);
      });
    });

    it('handles offset with includes', function() {
      const Election = this.sequelize.define('Election', {
        name: Sequelize.STRING
      });
      const Citizen = this.sequelize.define('Citizen', {
        name: Sequelize.STRING
      });

      // Associations
      Election.belongsTo(Citizen);
      Election.belongsToMany(Citizen, { as: 'Voters', through: 'ElectionsVotes' });
      Citizen.hasMany(Election);
      Citizen.belongsToMany(Election, { as: 'Votes', through: 'ElectionsVotes' });

      return this.sequelize.sync().then(() => {
        // Add some data
        return Citizen.create({ name: 'Alice' }).then(alice => {
          return Citizen.create({ name: 'Bob' }).then(bob => {
            return Election.create({ name: 'Some election' }).then(() => {
              return Election.create({ name: 'Some other election' }).then(election => {
                return election.setCitizen(alice).then(() => {
                  return election.setVoters([alice, bob]).then(() => {
                    const criteria = {
                      offset: 5,
                      limit: 1,
                      where: {
                        name: 'Some election'
                      },
                      include: [
                        Citizen, // Election creator
                        { model: Citizen, as: 'Voters' } // Election voters
                      ]
                    };
                    return Election.findAndCountAll(criteria).then(elections => {
                      expect(elections.count).to.equal(1);
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
      return this.User.findAndCountAll({ where: { id: { [Op.ne]: this.users[0].id } }, attributes: ['data'] }).then(info => {
        expect(info.count).to.equal(2);
        expect(Array.isArray(info.rows)).to.be.ok;
        expect(info.rows.length).to.equal(2);
        expect(info.rows[0].dataValues).to.not.have.property('username');
        expect(info.rows[1].dataValues).to.not.have.property('username');
      });
    });
  });

  describe('all', () => {
    beforeEach(function() {
      return this.User.bulkCreate([
        { username: 'user', data: 'foobar' },
        { username: 'user2', data: 'bar' }
      ]);
    });

    if (current.dialect.supports.transactions) {
      it('supports transactions', function() {
        return Support.prepareTransactionTest(this.sequelize).then(sequelize => {
          const User = sequelize.define('User', { username: Sequelize.STRING });

          return User.sync({ force: true }).then(() => {
            return sequelize.transaction().then(t => {
              return User.create({ username: 'foo' }, { transaction: t }).then(() => {
                return User.findAll().then(users1 => {
                  return User.findAll({ transaction: t }).then(users2 => {
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
      return this.User.findAll().then(users => {
        expect(users.length).to.equal(2);
      });
    });
  });

  it('should support logging', function() {
    const spy = sinon.spy();

    return this.User.findAll({
      where: {},
      logging: spy
    }).then(() => {
      expect(spy.called).to.be.ok;
    });
  });

  describe('rejectOnEmpty mode', () => {
    it('works from model options', () => {
      const Model = current.define('Test', {
        username: Sequelize.STRING(100)
      }, {
        rejectOnEmpty: true
      });

      return Model.sync({ force: true })
        .then(() => {
          return expect(Model.findAll({
            where: {
              username: 'some-username-that-is-not-used-anywhere'
            }
          })).to.eventually.be.rejectedWith(Sequelize.EmptyResultError);
        });
    });

    it('throws custom error with initialized', () => {
      const Model = current.define('Test', {
        username: Sequelize.STRING(100)
      }, {
        rejectOnEmpty: new Sequelize.ConnectionError('Some Error') //using custom error instance
      });

      return Model.sync({ force: true })
        .then(() => {
          return expect(Model.findAll({
            where: {
              username: 'some-username-that-is-not-used-anywhere-for-sure-this-time'
            }
          })).to.eventually.be.rejectedWith(Sequelize.ConnectionError);
        });
    });

    it('throws custom error with instance', () => {
      const Model = current.define('Test', {
        username: Sequelize.STRING(100)
      }, {
        rejectOnEmpty: Sequelize.ConnectionError //using custom error instance
      });

      return Model.sync({ force: true })
        .then(() => {
          return expect(Model.findAll({
            where: {
              username: 'some-username-that-is-not-used-anywhere-for-sure-this-time'
            }
          })).to.eventually.be.rejectedWith(Sequelize.ConnectionError);
        });
    });
  });
});
