/* jshint camelcase: false, expr: true */
var chai      = require('chai')
  , expect    = chai.expect
  , Support   = require(__dirname + '/../support')
  , Sequelize = require('../../index')

chai.Assertion.includeStack = true

describe(Support.getTestDialectTeaser("HasOne"), function() {
  describe("Model.associations", function () {
    it("should store all assocations when associting to the same table multiple times", function () {
      var User = this.sequelize.define('User', {})
        , Group = this.sequelize.define('Group', {})

      Group.hasOne(User)
      Group.hasOne(User, { foreignKey: 'primaryGroupId', as: 'primaryUsers' })
      Group.hasOne(User, { foreignKey: 'secondaryGroupId', as: 'secondaryUsers' })

      expect(Object.keys(Group.associations)).to.deep.equal(['User', 'primaryUsers', 'secondaryUsers'])
    })
  })

  describe('getAssocation', function() {
    it('supports transactions', function(done) {
      Support.prepareTransactionTest(this.sequelize, function(sequelize) {
        var User  = sequelize.define('User', { username: Support.Sequelize.STRING })
          , Group = sequelize.define('Group', { name: Support.Sequelize.STRING })

        Group.hasOne(User)

        sequelize.sync({ force: true }).success(function() {
          User.create({ username: 'foo' }).success(function(user) {
            Group.create({ name: 'bar' }).success(function(group) {
              sequelize.transaction(function(t) {
                group.setUser(user, { transaction: t }).success(function() {
                  Group.all().success(function(groups) {
                    groups[0].getUser().success(function(associatedUser) {
                      expect(associatedUser).to.be.null
                      Group.all({ transaction: t }).success(function(groups) {
                        groups[0].getUser({ transaction: t }).success(function(associatedUser) {
                          expect(associatedUser).to.be.not.null
                          t.rollback().success(function() { done() })
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
    })

    it('should be able to handle a where object that\'s a first class citizen.', function(done) {
      var User = this.sequelize.define('UserXYZ', { username: Sequelize.STRING })
        , Task = this.sequelize.define('TaskXYZ', { title: Sequelize.STRING, status: Sequelize.STRING })

      User.hasOne(Task)
      User.sync({ force: true }).success(function() {
        Task.sync({ force: true }).success(function() {
          User.create({ username: 'foo' }).success(function(user) {
            Task.create({ title: 'task', status: 'inactive' }).success(function(task) {
              user.setTaskXYZ(task).success(function() {
                user.getTaskXYZ({where: ['status = ?', 'active']}).success(function(task) {
                  expect(task).to.be.null
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
    it('supports transactions', function(done) {
      Support.prepareTransactionTest(this.sequelize, function(sequelize) {
        var User  = sequelize.define('User', { username: Support.Sequelize.STRING })
          , Group = sequelize.define('Group', { name: Support.Sequelize.STRING })

        Group.hasOne(User)

        sequelize.sync({ force: true }).success(function() {
          User.create({ username: 'foo' }).success(function(user) {
            Group.create({ name: 'bar' }).success(function(group) {
              sequelize.transaction(function(t) {
                group.setUser(user, { transaction: t }).success(function() {
                  Group.all().success(function(groups) {
                    groups[0].getUser().success(function(associatedUser) {
                      expect(associatedUser).to.be.null
                      t.rollback().success(function() { done() })
                    })
                  })
                })
              })
            })
          })
        })
      })
    })

    it('can set an association with predefined primary keys', function(done) {
      var User = this.sequelize.define('UserXYZZ', { userCoolIdTag: { type: Sequelize.INTEGER, primaryKey: true }, username: Sequelize.STRING })
        , Task = this.sequelize.define('TaskXYZZ', { taskOrSomething: { type: Sequelize.INTEGER, primaryKey: true }, title: Sequelize.STRING })
        , self = this

      User.hasOne(Task, {foreignKey: 'userCoolIdTag'})

      User.sync({ force: true }).success(function() {
        Task.sync({ force: true }).success(function() {
          User.create({userCoolIdTag: 1, username: 'foo'}).success(function(user) {
            Task.create({taskOrSomething: 1, title: 'bar'}).success(function(task) {
              user.setTaskXYZZ(task).success(function() {
                user.getTaskXYZZ().success(function(task) {
                  expect(task).not.to.be.null

                  user.setTaskXYZZ(null).success(function() {
                    user.getTaskXYZZ().success(function(_task) {
                      expect(_task).to.be.null
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

    it('clears the association if null is passed', function(done) {
      var User = this.sequelize.define('UserXYZ', { username: Sequelize.STRING })
        , Task = this.sequelize.define('TaskXYZ', { title: Sequelize.STRING })

      User.hasOne(Task)

      User.sync({ force: true }).success(function() {
        Task.sync({ force: true }).success(function() {
          User.create({ username: 'foo' }).success(function(user) {
            Task.create({ title: 'task' }).success(function(task) {
              user.setTaskXYZ(task).success(function() {
                user.getTaskXYZ().success(function(task) {
                  expect(task).not.to.equal(null)

                  user.setTaskXYZ(null).success(function() {
                    user.getTaskXYZ().success(function(task) {
                      expect(task).to.equal(null)
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

  describe('createAssociation', function() {
    it('creates an associated model instance', function(done) {
      var User = this.sequelize.define('User', { username: Sequelize.STRING })
        , Task = this.sequelize.define('Task', { title: Sequelize.STRING })

      User.hasOne(Task)

      this.sequelize.sync({ force: true }).success(function() {
        User.create({ username: 'bob' }).success(function(user) {
          user.createTask({ title: 'task' }).success(function() {
            user.getTask().success(function(task) {
              expect(task).not.to.be.null
              expect(task.title).to.equal('task')

              done()
            })
          })
        })
      })
    })

    it('supports transactions', function(done) {
      Support.prepareTransactionTest(this.sequelize, function(sequelize) {
        var User  = sequelize.define('User', { username: Sequelize.STRING })
          , Group = sequelize.define('Group', { name: Sequelize.STRING })

        User.hasOne(Group)

        sequelize.sync({ force: true }).success(function() {
          User.create({ username: 'bob' }).success(function(user) {
            sequelize.transaction(function(t) {
              user.createGroup({ name: 'testgroup' }, { transaction: t }).success(function(group) {
                User.all().success(function (users) {
                  users[0].getGroup().success(function (group) {
                    expect(group).to.be.null;
                    User.all({ transaction: t }).success(function (users) {
                      users[0].getGroup({ transaction: t }).success(function (group) {
                        expect(group).to.be.not.null;
                        t.rollback().success(function() { done() })
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
  })

  describe("foreign key", function () {
    it('should lowercase foreign keys when using underscored', function () {
      var User  = this.sequelize.define('User', { username: Sequelize.STRING }, { underscored: true })
        , Account = this.sequelize.define('Account', { name: Sequelize.STRING }, { underscored: true })

      Account.hasOne(User)

      expect(User.rawAttributes.account_id).to.exist
    })
    it('should use model name when using camelcase', function () {
      var User  = this.sequelize.define('User', { username: Sequelize.STRING }, { underscored: false })
        , Account = this.sequelize.define('Account', { name: Sequelize.STRING }, { underscored: false })

      Account.hasOne(User)

      expect(User.rawAttributes.AccountId).to.exist
    })
  })

  describe("foreign key constraints", function() {
    it("are not enabled by default", function(done) {
      var Task = this.sequelize.define('Task', { title: Sequelize.STRING })
        , User = this.sequelize.define('User', { username: Sequelize.STRING })

      User.hasOne(Task)

      User.sync({ force: true }).success(function() {
        Task.sync({ force: true }).success(function() {
          User.create({ username: 'foo' }).success(function(user) {
            Task.create({ title: 'task' }).success(function(task) {
              user.setTask(task).success(function() {
                user.destroy().success(function() {
                  Task.findAll().success(function(tasks) {
                    expect(tasks).to.have.length(1)
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
      var Task = this.sequelize.define('Task', { title: Sequelize.STRING })
        , User = this.sequelize.define('User', { username: Sequelize.STRING })

      User.hasOne(Task, {onDelete: 'cascade'})

      User.sync({ force: true }).success(function() {
        Task.sync({ force: true }).success(function() {
          User.create({ username: 'foo' }).success(function(user) {
            Task.create({ title: 'task' }).success(function(task) {
              user.setTask(task).success(function() {
                user.destroy().success(function() {
                  Task.findAll().success(function(tasks) {
                    expect(tasks).to.have.length(0)
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
      var Task = this.sequelize.define('Task', { title: Sequelize.STRING })
        , User = this.sequelize.define('User', { username: Sequelize.STRING })

      User.hasOne(Task, {onDelete: 'restrict'})

      User.sync({ force: true }).success(function() {
        Task.sync({ force: true }).success(function() {
          User.create({ username: 'foo' }).success(function(user) {
            Task.create({ title: 'task' }).success(function(task) {
              user.setTask(task).success(function() {
                user.destroy().error(function() {
                  // Should fail due to FK restriction
                  Task.findAll().success(function(tasks) {
                    expect(tasks).to.have.length(1)
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
      var Task = this.sequelize.define('Task', { title: Sequelize.STRING })
        , User = this.sequelize.define('User', { username: Sequelize.STRING })

      User.hasOne(Task, {onUpdate: 'cascade'})

      User.sync({ force: true }).success(function() {
        Task.sync({ force: true }).success(function() {
          User.create({ username: 'foo' }).success(function(user) {
            Task.create({ title: 'task' }).success(function(task) {
              user.setTask(task).success(function() {

                // Changing the id of a DAO requires a little dance since
                // the `UPDATE` query generated by `save()` uses `id` in the
                // `WHERE` clause

                var tableName = user.QueryInterface.QueryGenerator.addSchema(user.Model)
                user.QueryInterface.update(user, tableName, {id: 999}, user.id)
                .success(function() {
                  Task.findAll().success(function(tasks) {
                    expect(tasks).to.have.length(1)
                    expect(tasks[0].UserId).to.equal(999)
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
      var Task = this.sequelize.define('Task', { title: Sequelize.STRING })
        , User = this.sequelize.define('User', { username: Sequelize.STRING })

      User.hasOne(Task, {onUpdate: 'restrict'})

      User.sync({ force: true }).success(function() {
        Task.sync({ force: true }).success(function() {
          User.create({ username: 'foo' }).success(function(user) {
            Task.create({ title: 'task' }).success(function(task) {
              user.setTask(task).success(function() {

                // Changing the id of a DAO requires a little dance since
                // the `UPDATE` query generated by `save()` uses `id` in the
                // `WHERE` clause

                var tableName = user.QueryInterface.QueryGenerator.addSchema(user.Model)
                user.QueryInterface.update(user, tableName, {id: 999}, user.id)
                .error(function() {
                  // Should fail due to FK restriction
                  Task.findAll().success(function(tasks) {
                    expect(tasks).to.have.length(1)
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

  describe("Association column", function() {
    it('has correct type for non-id primary keys with non-integer type', function(done) {
      var User = this.sequelize.define('UserPKBT', {
        username: {
          type: Sequelize.STRING
        }
      })
        , self = this

      var Group = this.sequelize.define('GroupPKBT', {
        name: {
          type: Sequelize.STRING,
          primaryKey: true
        }
      })

      Group.hasOne(User)

      self.sequelize.sync({ force: true }).success(function() {
        expect(User.rawAttributes.GroupPKBTName.type.toString()).to.equal(Sequelize.STRING.toString())
        done()
      })
    })
  })

  describe("Association options", function() {
    it('can specify data type for autogenerated relational keys', function(done) {
      var User = this.sequelize.define('UserXYZ', { username: Sequelize.STRING })
        , dataTypes = [Sequelize.INTEGER, Sequelize.BIGINT, Sequelize.STRING]
        , self = this
        , Tasks = {}

      dataTypes.forEach(function(dataType) {
        var tableName = 'TaskXYZ_' + dataType.toString()
        Tasks[dataType] = self.sequelize.define(tableName, { title: Sequelize.STRING })

        User.hasOne(Tasks[dataType], { foreignKey: 'userId', keyType: dataType })

        Tasks[dataType].sync({ force: true }).success(function() {
          expect(Tasks[dataType].rawAttributes.userId.type.toString())
            .to.equal(dataType.toString())

          dataTypes.splice(dataTypes.indexOf(dataType), 1)
          if (!dataTypes.length) {
            done()
          }
        })
      })
    })
  })

})
