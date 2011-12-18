var config    = require("../config/config")
  , Sequelize = require("../../index")
  , sequelize = new Sequelize(config.database, config.username, config.password, { logging: false })
  , Helpers   = new (require("../config/helpers"))(sequelize)

describe('BelongsTo', function() {
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
      expect(Task.attributes.UserId).toEqual("INT")
    })

    it('adds the foreign key with underscore', function() {
      User = sequelize.define('User', { username: Sequelize.STRING })
      Task = sequelize.define('Task', { title: Sequelize.STRING }, { underscored: true })

      Task.hasMany(User)

      expect(User.attributes.task_id).toBeDefined()
    })

    it('uses the passed foreign key', function() {
      User.hasMany(Task, { foreignKey: 'person_id' })
      expect(Task.attributes.person_id).toEqual("INT")
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
      User.hasMany(Task, { as: 'Tasks' })

      Helpers.async(function(done) {
        User.sync({ force: true }).success(function() {
          Task.sync({ force: true }).success(done)
        })
      })

      Helpers.async(function(done) {
        User.create({username: 'name'}).success(function(user) {
          Task.create({title: 'task1'}).success(function(task1) {
            Task.create({title: 'task2'}).success(function(task2) {

              user.setTasks([task1, task2]).success(function() {
                user.getTasks().success(function(tasks) {
                  expect(tasks.length).toEqual(2)
                  done()
                })
              })

            })
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
  })
})
