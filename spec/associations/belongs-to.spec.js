/* jshint camelcase: false */
if (typeof require === 'function') {
  const buster    = require("buster")
      , Helpers   = require('../buster-helpers')
      , Sequelize = require('../../index')
      , dialect   = Helpers.getTestDialect()
}

buster.spec.expose()
buster.testRunner.timeout = 500

describe(Helpers.getTestDialectTeaser("BelongsTo"), function() {
  before(function(done) {
    Helpers.initTests({
      dialect: dialect,
      beforeComplete: function(sequelize) {
        this.sequelize = sequelize
      }.bind(this),
      onComplete: done
    })
  })

  describe('general usage', function() {
    before(function(done) {
      this.User = this.sequelize.define('User', {
        username: Helpers.Sequelize.STRING,
        enabled: {
          type: Helpers.Sequelize.BOOLEAN,
          defaultValue: true
        }
      })
      this.Task = this.sequelize.define('Task', {
        title: Helpers.Sequelize.STRING
      })

      this.sequelize.sync({ force: true }).success(done)
    })

    it('adds the foreign key', function(done) {
      this.Task.belongsTo(this.User)
      expect(this.Task.attributes.UserId).toEqual("INTEGER")
      done()
    })

    it("underscores the foreign key", function(done) {
      var Task = this.sequelize.define('Task', { title: Sequelize.STRING }, {underscored: true})
      Task.belongsTo(this.User)
      expect(Task.attributes.user_id).toEqual("INTEGER")
      done()
    })

    it("uses the passed foreign key", function(done) {
      this.Task.belongsTo(this.User, {foreignKey: 'person_id'})
      expect(this.Task.attributes.person_id).toEqual("INTEGER")
      done()
    })

    it("defines getters and setters", function(done) {
      this.Task.belongsTo(this.User)

      var task = this.Task.build({title: 'asd'})
      expect(task.setUser).toBeDefined()
      expect(task.getUser).toBeDefined()
      done()
    })

    it("aliases the getters and setters according to the passed 'as' option", function(done) {
      this.Task.belongsTo(this.User, {as: 'Person'})

      var task = this.Task.build({title: 'asd'})
      expect(task.setPerson).toBeDefined()
      expect(task.getPerson).toBeDefined()
      done()
    })

    it("aliases associations to the same table according to the passed 'as' option", function(done) {
      this.Task.belongsTo(this.User, {as: 'Poster'})
      this.Task.belongsTo(this.User, {as: 'Owner'})

      var task = this.Task.build({title: 'asd'})
      expect(task.getPoster).toBeDefined()
      expect(task.setPoster).toBeDefined()
      expect(task.getOwner).toBeDefined()
      expect(task.setOwner).toBeDefined()
      done()
    })

    it("intializes the foreign key with null", function(done) {
      this.Task.belongsTo(this.User)

      var task = this.Task.build({title: 'asd'})
      expect(task.UserId).not.toBeDefined();
      done()
    })

    it("sets and gets the correct objects", function(done) {
      var self = this

      this.Task.belongsTo(this.User, {as: 'User'})
      this.sequelize.sync({ force: true }).success(function() {
        self.User.create({username: 'asd'}).success(function(u) {
          self.Task.create({title: 'a task'}).success(function(t) {
            t.setUser(u).success(function() {
              t.getUser().success(function(user) {
                expect(user.username).toEqual('asd')
                done()
              })
            })
          })
        })
      })
    })

    it('extends the id where param with the supplied where params', function(done) {
      var self = this

      this.Task.belongsTo(this.User, {as: 'User'})
      this.sequelize.sync({ force: true }).success(function() {
        self.User.create({username: 'asd', enabled: false}).success(function(u) {
          self.Task.create({title: 'a task'}).success(function(t) {
            t.setUser(u).success(function() {
              t.getUser({where: {enabled: true}}).success(function(user) {
                expect(user).toEqual(null)
                done()
              })
            })
          })
        })
      })
    })

    it("handles self associations", function(done) {
      var Person = this.sequelize.define('Person', { name: Helpers.Sequelize.STRING })

      Person.belongsTo(Person, {as: 'Mother', foreignKey: 'MotherId'})
      Person.belongsTo(Person, {as: 'Father', foreignKey: 'FatherId'})

      Person.sync({force: true}).success(function() {
        var p = Person.build()
        expect(p.setFather).toBeDefined()
        expect(p.setMother).toBeDefined()
        done()
      })
    })

    it("sets the foreign key in self associations", function(done) {
      var Person = this.sequelize.define('Person', { name: Helpers.Sequelize.STRING })
      Person.belongsTo(Person, {as: 'Mother'})
      expect(Person.associations.MotherPersons.options.foreignKey).toEqual('MotherId')
      done()
    })
  })

  describe('setAssociation', function() {
    it('clears the association if null is passed', function(done) {
      var User = this.sequelize.define('UserXYZ', { username: Sequelize.STRING })
        , Task = this.sequelize.define('TaskXYZ', { title: Sequelize.STRING })

      Task.belongsTo(User)

      this.sequelize.sync({ force: true }).success(function() {
        User.create({ username: 'foo' }).success(function(user) {
          Task.create({ title: 'task' }).success(function(task) {
            task.setUserXYZ(user).success(function() {
              task.getUserXYZ().success(function(user) {
                expect(user).not.toEqual(null)

                task.setUserXYZ(null).success(function() {
                  task.getUserXYZ().success(function(user) {
                    expect(user).toEqual(null)
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

      Task.belongsTo(User)

      this.sequelize.sync({ force: true }).success(function() {
        User.create({ username: 'foo' }).success(function(user) {
          Task.create({ title: 'task' }).success(function(task) {
            task.setUser(user).success(function() {
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

      Task.belongsTo(User, {onDelete: 'cascade'})

      this.sequelize.sync({ force: true }).success(function() {
        User.create({ username: 'foo' }).success(function(user) {
          Task.create({ title: 'task' }).success(function(task) {
            task.setUser(user).success(function() {
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

      Task.belongsTo(User, {onDelete: 'restrict'})

      this.sequelize.sync({ force: true }).success(function() {
        User.create({ username: 'foo' }).success(function(user) {
          Task.create({ title: 'task' }).success(function(task) {
            task.setUser(user).success(function() {
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

      Task.belongsTo(User, {onUpdate: 'cascade'})

      this.sequelize.sync({ force: true }).success(function() {
        User.create({ username: 'foo' }).success(function(user) {
          Task.create({ title: 'task' }).success(function(task) {
            task.setUser(user).success(function() {

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

      Task.belongsTo(User, {onUpdate: 'restrict'})

      this.sequelize.sync({ force: true }).success(function() {
        User.create({ username: 'foo' }).success(function(user) {
          Task.create({ title: 'task' }).success(function(task) {
            task.setUser(user).success(function() {

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

        Task.belongsTo(User, { foreignKey: 'userId', keyType: dataType })

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
