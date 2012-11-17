var config    = require("../config/config")
  , Sequelize = require("../../index")
  , sequelize = new Sequelize(config.mysql.database, config.mysql.username, config.mysql.password, { logging: false })
  , Helpers   = new (require("../config/helpers"))(sequelize)

describe('HasOne', function() {
  var User = null
    , Task = null

  var setup = function() {
    User = sequelize.define('User', { username: Sequelize.STRING })
    Task = sequelize.define('Task', { title: Sequelize.STRING })
  }

  beforeEach(function() { Helpers.dropAllTables(); setup() })
  afterEach(function() { Helpers.dropAllTables() })

  it("adds the foreign key", function() {
    User.hasOne(Task)
    expect(Task.attributes.UserId).toEqual("INTEGER")
  })

  it("adds an underscored foreign key", function() {
    User = sequelize.define('User', { username: Sequelize.STRING }, {underscored: true})
    Task = sequelize.define('Task', { title: Sequelize.STRING })

    User.hasOne(Task)
    expect(Task.attributes.user_id).toEqual("INTEGER")
  })

  it("uses the passed foreign key", function() {
    User = sequelize.define('User', { username: Sequelize.STRING }, {underscored: true})
    Task = sequelize.define('Task', { title: Sequelize.STRING })

    User.hasOne(Task, {foreignKey: 'person_id'})
    expect(Task.attributes.person_id).toEqual("INTEGER")
  })

  it("defines the getter and the setter", function() {
    User.hasOne(Task)

    var u = User.build({username: 'asd'})

    expect(u.setTask).toBeDefined()
    expect(u.getTask).toBeDefined()
  })

  it("defined the getter and the setter according to the passed 'as' option", function() {
    User.hasOne(Task, {as: 'Work'})

    var u = User.build({username: 'asd'})

    expect(u.setWork).toBeDefined()
    expect(u.getWork).toBeDefined()
  })

  it("aliases associations to the same table according to the passed 'as' option", function() {
      User.hasOne(Task, {as: 'Work'});
      User.hasOne(Task, {as: 'Play'});

      var u = User.build({username: 'asd'})
      expect(u.getWork).toBeDefined()
      expect(u.setWork).toBeDefined()
      expect(u.getPlay).toBeDefined()
      expect(u.setPlay).toBeDefined()
  })

  it("gets and sets the correct objects", function() {
    var user, task;

    User.hasOne(Task, {as: 'Task'})

    Helpers.async(function(done) {
      User.sync({force: true}).success(function() {
        Task.sync({force: true}).success(function() {
          User.create({username: 'name'}).success(function(_user) {
            Task.create({title: 'snafu'}).success(function(_task) {
              user = _user
              task = _task
              done()
            })
          })
        })
      })
    })

    Helpers.async(function(done) {
      user.setTask(task).on('success', function() {
        user.getTask().on('success', function(task2) {
          expect(task.title).toEqual(task2.title)
          user.getTask({attributes: ['title']}).on('success', function(task2) {
            expect(task2.selectedValues.title).toEqual('snafu')
            expect(task2.selectedValues.id).toEqual(null)
            done()
          })
        })
      })
    })
  })

  it("unsets unassociated objects", function() {
    var user, task1, task2;

    User.hasOne(Task, {as: 'Task'})

    Helpers.async(function(done) {
      User.sync({force: true}).success(function() {
        Task.sync({force: true}).success(function() {
          User.create({username: 'name'}).success(function(_user) {
            Task.create({title: 'snafu'}).success(function(_task1) {
              Task.create({title: 'another task'}).success(function(_task2) {
                user  = _user
                task1 = _task1
                task2 = _task2
                done()
              })
            })
          })
        })
      })
    })

    Helpers.async(function(done) {
      user.setTask(task1).success(function() {
        user.getTask().success(function(_task) {
          expect(task1.title).toEqual(_task.title)
          user.setTask(task2).success(function() {
            user.getTask().success(function(_task2) {
              expect(task2.title).toEqual(task2.title)
              done()
            })
          })
        })
      })
    })
  })

  it("sets self associations", function() {
    Helpers.async(function(done) {
      var Person = sequelize.define('Person', { name: Sequelize.STRING })

      Person.hasOne(Person, {as: 'Mother', foreignKey: 'MotherId'})
      Person.hasOne(Person, {as: 'Father', foreignKey: 'FatherId'})

      Person.sync({force: true}).success(function() {
        var p = Person.build()

        expect(p.setFather).toBeDefined()
        expect(p.setMother).toBeDefined()

        done()
      })
    })
  })

  it("automatically sets the foreign key on self associations", function() {
    var Person = sequelize.define('Person', { name: Sequelize.STRING })

    Person.hasOne(Person, {as: 'Mother'})
    expect(Person.associations.MotherPersons.options.foreignKey).toEqual('MotherId')
  })
})
