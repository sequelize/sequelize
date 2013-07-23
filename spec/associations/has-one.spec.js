/* jshint camelcase: false */
var buster    = require("buster")
  , Helpers   = require('../buster-helpers')
  , dialect   = Helpers.getTestDialect()
  , DataTypes = require(__dirname + "/../../lib/data-types")

buster.spec.expose()
buster.testRunner.timeout = 1500

describe(Helpers.getTestDialectTeaser("HasOne"), function() {
  var sequelize = Helpers.createSequelizeInstance({dialect: dialect})

  before(function(done) {
    var self = this
    self.sequelize = Object.create(sequelize)
    Helpers.clearDatabase(self.sequelize, done)
  })

  describe('general usage', function() {
    before(function(done) {
      var self = this
      Helpers.clearDatabase(self.sequelize, function() {
        self.User = self.sequelize.define('User', { username: DataTypes.STRING })
        self.Task = self.sequelize.define('Task', { title: DataTypes.STRING })
        self.User.sync({ force: true }).success(function() {
          self.Task.sync({ force: true }).success(done)
        })
      })
    })

    it("adds the foreign key", function() {
      var self = this
      self.User.hasOne(self.Task)
      expect(self.Task.attributes.UserId).toEqual("INTEGER")
    })

    it("adds an underscored foreign key", function() {
      var self = this
        , User = self.sequelize.define('User', { username: DataTypes.STRING }, {underscored: true})
        , Task = self.sequelize.define('Task', { title: DataTypes.STRING })

      User.hasOne(Task)
      expect(Task.attributes.user_id).toEqual("INTEGER")
    })

    it("uses the passed foreign key", function() {
      var self = this
        , User = self.sequelize.define('User', { username: DataTypes.STRING }, {underscored: true})
        , Task = self.sequelize.define('Task', { title: DataTypes.STRING })

      User.hasOne(Task, {foreignKey: 'person_id'})
      expect(Task.attributes.person_id).toEqual("INTEGER")
    })

    it("defines the getter and the setter", function() {
      var self = this
      self.User.hasOne(self.Task)
      var u = self.User.build({username: 'asd'})

      expect(u.setTask).toBeDefined()
      expect(u.getTask).toBeDefined()
    })

    it("defined the getter and the setter according to the passed 'as' option", function() {
      var self = this
      self.User.hasOne(self.Task, {as: 'Work'})
      var u = self.User.build({username: 'asd'})

      expect(u.setWork).toBeDefined()
      expect(u.getWork).toBeDefined()
    })

    it("aliases associations to the same table according to the passed 'as' option", function() {
      var self = this
      self.User.hasOne(self.Task, {as: 'Work'});
      self.User.hasOne(self.Task, {as: 'Play'});

      var u = self.User.build({username: 'asd'})
      expect(u.getWork).toBeDefined()
      expect(u.setWork).toBeDefined()
      expect(u.getPlay).toBeDefined()
      expect(u.setPlay).toBeDefined()
    })

    it("gets and sets the correct objects", function(done) {
      var self = this

      self.User.hasOne(self.Task, {as: 'Task'})
      self.User.sync({ force: true }).success(function() {
        self.Task.sync({ force: true }).success(function() {
          self.User.create({username: 'name'}).success(function(user) {
            self.Task.create({title: 'snafu'}).success(function(task) {
              user.setTask(task).on('success', function() {
                user.getTask().on('success', function(task2) {
                  expect(task.title).toEqual(task2.title)
                  user.getTask({attributes: ['title']}).on('success', function(task2) {
                    expect(task2.selectedValues.title).toEqual('snafu')
                    expect(task2.selectedValues.id).not.toBeDefined()
                    done()
                  })
                })
              })
            })
          })
        })
      })
    })

    it("unsets unassociated objects", function(done) {
      var self = this

      self.User.hasOne(self.Task, {as: 'Task'})
      self.User.sync({ force: true }).success(function() {
        self.Task.sync({ force: true }).success(function() {
          self.User.create({username: 'name'}).success(function(user) {
            self.Task.create({title: 'snafu'}).success(function(task1) {
              self.Task.create({title: 'another task'}).success(function(task2) {
                user.setTask(task1).success(function() {
                  user.getTask().success(function(_task) {
                    expect(task1.title).toEqual(_task.title)
                    user.setTask(task2).success(function() {
                      user.getTask().success(function(_task2) {
                        expect(task2.title).toEqual(_task2.title)
                        done()
                      })
                    })
                  })
                })
              })
            })
          })
        })
      })
    })

    it("sets self associations", function(done) {
      var Person = this.sequelize.define('Person', { name: Helpers.Sequelize.STRING })
      Person.hasOne(Person, {as: 'Mother', foreignKey: 'MotherId'})
      Person.hasOne(Person, {as: 'Father', foreignKey: 'FatherId'})

      Person.sync({ force: true }).success(function() {
        var p = Person.build()
        expect(p.setFather).toBeDefined()
        expect(p.setMother).toBeDefined()
        done()
      })
    })

    it("automatically sets the foreign key on self associations", function(done) {
      var Person = this.sequelize.define('Person', { name: Helpers.Sequelize.STRING })

      Person.hasOne(Person, {as: 'Mother'})
      expect(Person.associations.MotherPersons.options.foreignKey).toEqual('MotherId')
      done()
    })
  })

  describe('getAssocation', function() {
    it('should be able to handle a where object that\'s a first class citizen.', function(done) {
      var self = this
        , User = self.sequelize.define('UserXYZ', { username: DataTypes.STRING })
        , Task = self.sequelize.define('TaskXYZ', { title: DataTypes.STRING, status: DataTypes.STRING })

      User.hasOne(Task)
      User.sync({ force: true }).success(function() {
        Task.sync({ force: true }).success(function() {
          User.create({ username: 'foo' }).success(function(user) {
            Task.create({ title: 'task', status: 'inactive' }).success(function(task) {
              user.setTaskXYZ(task).success(function() {
                user.getTaskXYZ({where: ['status = ?', 'active']}).success(function(task) {
                  expect(task).toEqual(null)
                  done()
                })
              })
            })
          })
        })
      })
    })
  })

  describe('setAssociation', function() {
    it('clears the association if null is passed', function(done) {
      var self = this
        , User = self.sequelize.define('UserXYZ', { username: DataTypes.STRING })
        , Task = self.sequelize.define('TaskXYZ', { title: DataTypes.STRING })
      User.hasOne(Task)

      User.sync({ force: true }).success(function() {
        Task.sync({ force: true }).success(function() {
          User.create({ username: 'foo' }).success(function(user) {
            Task.create({ title: 'task' }).success(function(task) {
              user.setTaskXYZ(task).success(function() {
                user.getTaskXYZ().success(function(task) {
                  expect(task).not.toEqual(null)
                  user.setTaskXYZ(null).success(function() {
                    user.getTaskXYZ().success(function(task) {
                      expect(task).toEqual(null)
                      done()
                    })
                  })
                })
              })
            })
          })
        })
      })
    })
  })

  describe("Foreign key constraints", function() {
    before(function(done) {
      var self = this
      self.sequelize = Object.create(self.sequelize)
      Helpers.clearDatabase(self.sequelize, done)
    })

    it("is not enabled by default", function(done) {
      var self = this
        , Task = self.sequelize.define('Task1', { title: DataTypes.STRING })
        , User = self.sequelize.define('User1', { username: DataTypes.STRING })

      User.hasOne(Task)

      User.sync({ force: true }).success(function() {
        Task.sync({ force: true }).success(function() {
          User.create({ username: 'foo' }).success(function(user) {
            Task.create({ title: 'task' }).success(function(task) {
              user.setTask1(task).success(function() {
                user.destroy().success(function() {
                  Task.all().success(function(tasks) {
                    expect(tasks.length).toEqual(1)
                    done()
                  })
                })
              })
            })
          })
        })
      })
    })

    it("can cascade deletes", function(done) {
      var self = this
        , Task = self.sequelize.define('Task2', { title: DataTypes.STRING })
        , User = self.sequelize.define('User2', { username: DataTypes.STRING })

      User.hasOne(Task, {onDelete: 'cascade'})

      User.sync({ force: true }).success(function() {
        Task.sync({ force: true }).success(function() {
          User.create({ username: 'foo' }).success(function(user) {
            Task.create({ title: 'task' }).success(function(task) {
              user.setTask2(task).success(function() {
                user.destroy().success(function() {
                  Task.all().success(function(tasks) {
                    expect(tasks.length).toEqual(0)
                    done()
                  })
                })
              })
            })
          })
        })
      })
    })

    it("can restrict deletes", function(done) {
      var self = this
        , Task = self.sequelize.define('Task3', { title: DataTypes.STRING })
        , User = self.sequelize.define('User3', { username: DataTypes.STRING })

      User.hasOne(Task, {onDelete: 'restrict'})

      User.sync({ force: true }).success(function() {
        Task.sync({ force: true }).success(function() {
          User.create({ username: 'foo' }).success(function(user) {
            Task.create({ title: 'task' }).success(function(task) {
              user.setTask3(task).success(function() {
                user.destroy().success(function() {
                  expect(false).toEqual('You shouldn\'t reach here.')
                  done()
                })
                .error(function() {
                  // Should fail due to FK restriction
                  Task.all().success(function(tasks) {
                    expect(tasks.length).toEqual(1)
                    done()
                  })
                })
              })
            })
          })
        })
      })
    })

    it("can cascade updates", function(done) {
      var self = this
        , Task = self.sequelize.define('Task4', { title: DataTypes.STRING })
        , User = self.sequelize.define('User4', { username: DataTypes.STRING })

      User.hasOne(Task, {onUpdate: 'cascade'})

      User.sync({ force: true }).success(function() {
        Task.sync({ force: true }).success(function() {
          User.create({ username: 'foo' }).success(function(user) {
            Task.create({ title: 'task' }).success(function(task) {
              user.setTask4(task).success(function() {

                // Changing the id of a DAO requires a little dance since
                // the `UPDATE` query generated by `save()` uses `id` in the
                // `WHERE` clause

                var tableName = user.QueryInterface.QueryGenerator.addSchema(user.__factory)
                user.QueryInterface.update(user, tableName, {id: 999}, user.id)
                .success(function() {
                  Task.all().success(function(tasks) {
                    expect(tasks.length).toEqual(1)
                    expect(tasks[0].User4Id).toEqual(999)
                    done()
                  })
                })
              })
            })
          })
        })
      })
    })

    it("can restrict updates", function(done) {
      var self = this
        , Task = self.sequelize.define('Task5', { title: DataTypes.STRING })
        , User = self.sequelize.define('User5', { username: DataTypes.STRING })

      User.hasOne(Task, {onUpdate: 'restrict'})

      User.sync({ force: true }).success(function() {
        Task.sync({ force: true }).success(function() {
          User.create({ username: 'foo' }).success(function(user) {
            Task.create({ title: 'task' }).success(function(task) {
              user.setTask5(task).success(function() {
                // Changing the id of a DAO requires a little dance since
                // the `UPDATE` query generated by `save()` uses `id` in the
                // `WHERE` clause

                var tableName = user.QueryInterface.QueryGenerator.addSchema(user.__factory)
                user.QueryInterface.update(user, tableName, {id: 999}, user.id)
                .success(function() {
                  expect(1).toEqual(2)
                  done()
                })
                .error(function() {
                  // Should fail due to FK restriction
                  Task.all().success(function(tasks) {
                    expect(tasks.length).toEqual(1)
                    done()
                  })
                })
              })
            })
          })
        })
      })
    })
  })

  describe("Association options", function() {
    it('can specify data type for autogenerated relational keys', function(done) {
      var User = this.sequelize.define('UserXYZ', { username: DataTypes.STRING })
        , dataTypes = [DataTypes.INTEGER, DataTypes.BIGINT, DataTypes.STRING]
        , self = this

      dataTypes.forEach(function(dataType) {
        var tableName = 'TaskXYZ_' + dataType.toString()
          , Task = self.sequelize.define(tableName, { title: DataTypes.STRING })

        User.hasOne(Task, { foreignKey: 'userId', keyType: dataType })

        User.sync({ force: true }).success(function() {
          expect(Task.rawAttributes.userId.type.toString())
            .toEqual(dataType.toString())

          dataTypes.splice(dataTypes.indexOf(dataType), 1)
          if (!dataTypes.length) {
            done()
          }
        })
      })
    })
  })

})
