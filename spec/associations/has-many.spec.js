var config    = require("../config/config")
  , Sequelize = require("../../index")
  , sequelize = new Sequelize(config.database, config.username, config.password, { logging: false })
  , Helpers   = new (require("../config/helpers"))(sequelize)

describe('HasMany', function() {
  var User      = null
    , Task      = null
    , sequelize = null
    , Helpers   = null

  var setup = function() {
    sequelize = new Sequelize(config.database, config.username, config.password, { logging: false })
    Helpers   = new (require("../config/helpers"))(sequelize)

    Helpers.dropAllTables()

    User = sequelize.define('User', { username: Sequelize.STRING })
    Task = sequelize.define('Task', { title: Sequelize.STRING })
  }

  beforeEach(function() { setup() })
  afterEach(function() { Helpers.dropAllTables() })

  describe('mono-directional', function() {
    it("adds the foreign key", function() {
      User.hasMany(Task)
      expect(Task.attributes.UserId).toEqual("INTEGER")
    })

    it('adds the foreign key with underscore', function() {
      User = sequelize.define('User', { username: Sequelize.STRING })
      Task = sequelize.define('Task', { title: Sequelize.STRING }, { underscored: true })

      Task.hasMany(User)

      expect(User.attributes.task_id).toBeDefined()
    })

    it('uses the passed foreign key', function() {
      User.hasMany(Task, { foreignKey: 'person_id' })
      expect(Task.attributes.person_id).toEqual("INTEGER")
    })

    it('defines getters and setters', function() {
      User.hasMany(Task)

      var u = User.build({username: 'asd'})
      expect(u.setTasks).toBeDefined()
      expect(u.getTasks).toBeDefined()
    })

    it("defines getters and setters according to the 'as' option", function() {
      User.hasMany(Task, {as: 'Tasks'})

      var u = User.build({username: 'asd'})

      expect(u.setTasks).toBeDefined()
      expect(u.getTasks).toBeDefined()
    })

    it("sets and gets associated objects", function() {
      var user, task1, task2;

      User.hasMany(Task, { as: 'Tasks' })

      Helpers.async(function(done) {
        User.sync({ force: true }).success(function() {
          Task.sync({ force: true }).success(done)
        })
      })

      Helpers.async(function(done) {
        User.create({username: 'name'}).success(function(_user) {
          Task.create({title: 'task1'}).success(function(_task1) {
            Task.create({title: 'task2'}).success(function(_task2) {
              user  = _user
              task1 = _task1
              task2 = _task2
              done()
            })
          })
        })
      })

      Helpers.async(function(done) {
        user.setTasks([task1, task2]).success(function() {
          user.getTasks().success(function(tasks) {
            expect(tasks.length).toEqual(2)
            done()
          })
        })
      })
    })
  })

  describe('bi-directional', function() {
    it('adds the foreign key', function() {
      Task.hasMany(User)
      User.hasMany(Task)

      expect(Task.attributes.UserId).toBeUndefined()
      expect(User.attributes.UserId).toBeUndefined()

      var models = sequelize.modelManager.models.filter(function(model) {
        return (model.tableName == (Task.tableName + User.tableName))
      })

      models.forEach(function(model) {
        expect(model.attributes.UserId).toBeDefined()
        expect(model.attributes.TaskId).toBeDefined()
      })
    })

    it("adds the foreign key with underscores", function() {
      User = sequelize.define('User', { username: Sequelize.STRING }, { underscored: true })
      Task = sequelize.define('Task', { title: Sequelize.STRING })

      Task.hasMany(User)
      User.hasMany(Task)

      expect(Task.attributes.user_id).toBeUndefined()
      expect(User.attributes.user_id).toBeUndefined()

      var models = sequelize.modelManager.models.filter(function(model) {
        return (model.tableName == (Task.tableName + User.tableName))
      })

      models.forEach(function(model) {
        expect(model.attributes.user_id).toBeDefined()
        expect(model.attributes.TaskId).toBeDefined()
      })
    })

    it("uses the passed foreign keys", function() {
      User.hasMany(Task, { foreignKey: 'person_id' })
      Task.hasMany(User, { foreignKey: 'work_item_id' })

      var models = sequelize.modelManager.models.filter(function(model) {
        return (model.tableName == (Task.tableName + User.tableName))
      })

      models.forEach(function(model) {
        expect(model.attributes.person_id).toBeDefined()
        expect(model.attributes.work_item_id).toBeDefined()
      })
    })

    it("defines getters and setters", function() {
      User.hasMany(Task)
      Task.hasMany(User)

      var u = User.build({ username: 'asd' })
      expect(u.setTasks).toBeDefined()
      expect(u.getTasks).toBeDefined()

      var t = Task.build({ title: 'foobar' })
      expect(t.setUsers).toBeDefined()
      expect(t.getUsers).toBeDefined()
    })

    it("defines getters and setters according to the 'as' option", function() {
      User.hasMany(Task, { as: 'Tasks' })
      Task.hasMany(User, { as: 'Users' })

      var u = User.build({ username: 'asd' })
      expect(u.setTasks).toBeDefined()
      expect(u.getTasks).toBeDefined()

      var t = Task.build({ title: 'asd' })
      expect(t.setUsers).toBeDefined()
      expect(t.getUsers).toBeDefined()
    })

    it("sets and gets the corrected associated objects", function() {
      var users = []
        , tasks = []

      User.hasMany(Task, {as: 'Tasks'})
      Task.hasMany(User, {as: 'Users'})

      Helpers.async(function(done) {
        User.sync({force: true}).success(function() {
          Task.sync({force: true}).success(done)
        })
      })

      Helpers.async(function(done) {
        User.create({username: 'name'}).success(function(user1) {
          User.create({username: 'name2'}).success(function(user2) {
            Task.create({title: 'task1'}).success(function(task1) {
              Task.create({title: 'task2'}).success(function(task2) {
                users.push(user1)
                users.push(user2)
                tasks.push(task1)
                tasks.push(task2)
                done()
              })
            })
          })
        })
      })

      Helpers.async(function(done) {
        users[0].setTasks(tasks).success(function() {
          users[0].getTasks().success(function(_tasks) {
            expect(_tasks.length).toEqual(2)

            tasks[1].setUsers(users).success(function() {
              tasks[1].getUsers().success(function(_users) {
                expect(users.length).toEqual(2)
                done()
              })
            })
          })
        })
      })
    })
  })

  it("build the connector models name", function() {
    Helpers.async(function(done) {
      var Person = sequelize.define('Person', { name: Sequelize.STRING })

      Person.hasMany(Person, {as: 'Children'})
      Person.hasMany(Person, {as: 'Friends'})
      Person.hasMany(Person, {as: 'CoWorkers'})

      Person.sync({force: true}).success(function() {
        var modelNames  = sequelize.modelManager.models.map(function(model) { return model.tableName })
          , expectation = ["Persons", "ChildrenPersons", "CoWorkersPersons", "FriendsPersons"]

        expectation.forEach(function(ex) {
          expect(modelNames.indexOf(ex) > -1).toBeTruthy()
        })

        done()
      })
    })
  })

  it("gets and sets the connector models", function() {
    Helpers.async(function(done) {
      var Person = sequelize.define('Person', { name: Sequelize.STRING })

      Person.hasMany(Person, {as: 'Children'})
      Person.hasMany(Person, {as: 'Friends'})
      Person.hasMany(Person, {as: 'CoWorkers'})

      Person.sync({force: true}).success(function() {
        Person.create({name: 'foobar'}).success(function(person) {
          Person.create({name: 'friend'}).success(function(friend) {
            person.setFriends([friend]).success(function() {
              person.getFriends().success(function(friends) {
                expect(friends.length).toEqual(1)
                expect(friends[0].name).toEqual('friend')
                done()
              })
            })
          })
        })
      })
    })
  })
})
