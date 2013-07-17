/* jshint camelcase: false */
if (typeof require === 'function') {
  const buster    = require("buster")
      , Sequelize = require("../../index")
      , Helpers   = require('../buster-helpers')
      , dialect   = Helpers.getTestDialect()
}

buster.spec.expose()
buster.testRunner.timeout = 1500

describe(Helpers.getTestDialectTeaser("HasOne"), function() {
  before(function(done) {
    var self = this

    Helpers.initTests({
      dialect: dialect,
      beforeComplete: function(sequelize) { self.sequelize = sequelize },
      onComplete: done
    })
  })

  describe('general usage', function() {
    before(function(done) {
      this.User = this.sequelize.define('User', { username: Helpers.Sequelize.STRING })
      this.Task = this.sequelize.define('Task', { title: Helpers.Sequelize.STRING })
      this.sequelize.sync({ force: true }).success(done)
    })

    it("adds the foreign key", function(done) {
      this.User.hasOne(this.Task)
      expect(this.Task.attributes.UserId).toEqual("INTEGER")
      done()
    })

    it("adds an underscored foreign key", function(done) {
      var User = this.sequelize.define('User', { username: Helpers.Sequelize.STRING }, {underscored: true})
      , Task = this.sequelize.define('Task', { title: Helpers.Sequelize.STRING })

      User.hasOne(Task)
      expect(Task.attributes.user_id).toEqual("INTEGER")
      done()
    })

    it("uses the passed foreign key", function(done) {
      var User = this.sequelize.define('User', { username: Helpers.Sequelize.STRING }, {underscored: true})
        , Task = this.sequelize.define('Task', { title: Helpers.Sequelize.STRING })

      User.hasOne(Task, {foreignKey: 'person_id'})
      expect(Task.attributes.person_id).toEqual("INTEGER")
      done()
    })

    it("defines the getter and the setter", function(done) {
      this.User.hasOne(this.Task)
      var u = this.User.build({username: 'asd'})

      expect(u.setTask).toBeDefined()
      expect(u.getTask).toBeDefined()
      done()
    })

    it("defined the getter and the setter according to the passed 'as' option", function(done) {
      this.User.hasOne(this.Task, {as: 'Work'})
      var u = this.User.build({username: 'asd'})

      expect(u.setWork).toBeDefined()
      expect(u.getWork).toBeDefined()
      done()
    })

    it("aliases associations to the same table according to the passed 'as' option", function(done) {
      this.User.hasOne(this.Task, {as: 'Work'});
      this.User.hasOne(this.Task, {as: 'Play'});

      var u = this.User.build({username: 'asd'})
      expect(u.getWork).toBeDefined()
      expect(u.setWork).toBeDefined()
      expect(u.getPlay).toBeDefined()
      expect(u.setPlay).toBeDefined()
      done()
    })

    it("gets and sets the correct objects", function(done) {
      var self = this

      this.User.hasOne(this.Task, {as: 'Task'})
      this.sequelize.sync({ force: true }).success(function() {
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

    it("unsets unassociated objects", function(done) {
      var self = this

      this.User.hasOne(this.Task, {as: 'Task'})
      this.sequelize.sync({ force: true }).success(function() {
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

    it("sets self associations", function(done) {
      var Person = this.sequelize.define('Person', { name: Helpers.Sequelize.STRING })
      Person.hasOne(Person, {as: 'Mother', foreignKey: 'MotherId'})
      Person.hasOne(Person, {as: 'Father', foreignKey: 'FatherId'})

      Person.sync({force: true}).success(function() {
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
      var User = this.sequelize.define('UserXYZ', { username: Sequelize.STRING })
        , Task = this.sequelize.define('TaskXYZ', { title: Sequelize.STRING, status: Sequelize.STRING })

      User.hasOne(Task)
      this.sequelize.sync({ force: true }).success(function() {
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

  describe('setAssociation', function() {
    it('clears the association if null is passed', function(done) {
      var User = this.sequelize.define('UserXYZ', { username: Sequelize.STRING })
        , Task = this.sequelize.define('TaskXYZ', { title: Sequelize.STRING })

      User.hasOne(Task)

      this.sequelize.sync({ force: true }).success(function() {
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

  describe("Foreign key constraints", function() {
    it("are not enabled by default", function(done) {
      var Task = this.sequelize.define('Task', { title: Sequelize.STRING })
        , User = this.sequelize.define('User', { username: Sequelize.STRING })

      User.hasOne(Task)

      this.sequelize.sync({ force: true }).success(function() {
        User.create({ username: 'foo' }).success(function(user) {
          Task.create({ title: 'task' }).success(function(task) {
            user.setTask(task).success(function() {
              user.destroy().success(function() {
                Task.findAll().success(function(tasks) {
                  expect(tasks.length).toEqual(1)
                  done()
                })
              })
            })
          })
        })
      })
    })

    it("can cascade deletes", function(done) {
      var Task = this.sequelize.define('Task', { title: Sequelize.STRING })
        , User = this.sequelize.define('User', { username: Sequelize.STRING })

      User.hasOne(Task, {onDelete: 'cascade'})

      this.sequelize.sync({ force: true }).success(function() {
        User.create({ username: 'foo' }).success(function(user) {
          Task.create({ title: 'task' }).success(function(task) {
            user.setTask(task).success(function() {
              user.destroy().success(function() {
                Task.findAll().success(function(tasks) {
                  expect(tasks.length).toEqual(0)
                  done()
                })
              })
            })
          })
        })
      })
    })

    it("can restrict deletes", function(done) {
      var Task = this.sequelize.define('Task', { title: Sequelize.STRING })
        , User = this.sequelize.define('User', { username: Sequelize.STRING })

      User.hasOne(Task, {onDelete: 'restrict'})

      this.sequelize.sync({ force: true }).success(function() {
        User.create({ username: 'foo' }).success(function(user) {
          Task.create({ title: 'task' }).success(function(task) {
            user.setTask(task).success(function() {
              user.destroy().error(function() {
                // Should fail due to FK restriction
                Task.findAll().success(function(tasks) {
                  expect(tasks.length).toEqual(1)
                  done()
                })
              })
            })
          })
        })
      })
    })

    it("can cascade updates", function(done) {
      var Task = this.sequelize.define('Task', { title: Sequelize.STRING })
        , User = this.sequelize.define('User', { username: Sequelize.STRING })

      User.hasOne(Task, {onUpdate: 'cascade'})

      this.sequelize.sync({ force: true }).success(function() {
        User.create({ username: 'foo' }).success(function(user) {
          Task.create({ title: 'task' }).success(function(task) {
            user.setTask(task).success(function() {

              // Changing the id of a DAO requires a little dance since
              // the `UPDATE` query generated by `save()` uses `id` in the
              // `WHERE` clause

              var tableName = user.QueryInterface.QueryGenerator.addSchema(user.__factory)
              user.QueryInterface.update(user, tableName, {id: 999}, user.id)
              .success(function() {
                Task.findAll().success(function(tasks) {
                  expect(tasks.length).toEqual(1)
                  expect(tasks[0].UserId).toEqual(999)
                  done()
                })
              })
            })
          })
        })
      })
    })

    it("can restrict updates", function(done) {
      var Task = this.sequelize.define('Task', { title: Sequelize.STRING })
        , User = this.sequelize.define('User', { username: Sequelize.STRING })

      User.hasOne(Task, {onUpdate: 'restrict'})

      this.sequelize.sync({ force: true }).success(function() {
        User.create({ username: 'foo' }).success(function(user) {
          Task.create({ title: 'task' }).success(function(task) {
            user.setTask(task).success(function() {

              // Changing the id of a DAO requires a little dance since
              // the `UPDATE` query generated by `save()` uses `id` in the
              // `WHERE` clause

              var tableName = user.QueryInterface.QueryGenerator.addSchema(user.__factory)
              user.QueryInterface.update(user, tableName, {id: 999}, user.id)
              .error(function() {
                // Should fail due to FK restriction
                Task.findAll().success(function(tasks) {
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

  describe("Association options", function() {
    it('can specify data type for autogenerated relational keys', function(done) {
      var User = this.sequelize.define('UserXYZ', { username: Sequelize.STRING })
        , dataTypes = [Sequelize.INTEGER, Sequelize.BIGINT, Sequelize.STRING]
        , self = this

      dataTypes.forEach(function(dataType) {
        var tableName = 'TaskXYZ_' + dataType.toString()
          , Task = self.sequelize.define(tableName, { title: Sequelize.STRING })

        User.hasOne(Task, { foreignKey: 'userId', keyType: dataType })

        self.sequelize.sync({ force: true }).success(function() {
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
