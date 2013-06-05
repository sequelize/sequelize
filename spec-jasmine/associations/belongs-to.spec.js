var config    = require("../config/config")
  , Sequelize = require("../../index")
  , sequelize = new Sequelize(config.mysql.database, config.mysql.username, config.mysql.password, { pool: config.mysql.pool, logging: false, host: config.mysql.host, port: config.mysql.port })
  , Helpers   = new (require("../config/helpers"))(sequelize)

describe('BelongsTo', function() {
  var User = null
    , Task = null

  var setup = function() {
    User = sequelize.define('User', { username: Sequelize.STRING, enabled: {
      type: Sequelize.BOOLEAN,
      defaultValue: true
    }})
    Task = sequelize.define('Task', { title: Sequelize.STRING })
  }

  beforeEach(function() { Helpers.dropAllTables(); setup() })
  afterEach(function() { Helpers.dropAllTables() })

  it('adds the foreign key', function() {
    Task.belongsTo(User)
    expect(Task.attributes['UserId']).toEqual("INTEGER")
  })

  it("underscores the foreign key", function() {
    Task = sequelize.define('Task', { title: Sequelize.STRING }, {underscored: true})
    Task.belongsTo(User)
    expect(Task.attributes['user_id']).toEqual("INTEGER")
  })

  it("uses the passed foreign key", function() {
    Task.belongsTo(User, {foreignKey: 'person_id'})
    expect(Task.attributes['person_id']).toEqual("INTEGER")
  })

  it("defines getters and setters", function() {
    Task.belongsTo(User)

    var task = Task.build({title: 'asd'})
    expect(task.setUser).toBeDefined()
    expect(task.getUser).toBeDefined()
  })

  it("aliases the getters and setters according to the passed 'as' option", function() {
    Task.belongsTo(User, {as: 'Person'})

    var task = Task.build({title: 'asd'})
    expect(task.setPerson).toBeDefined()
    expect(task.getPerson).toBeDefined()
  })

  it("aliases associations to the same table according to the passed 'as' option", function() {
    Task.belongsTo(User, {as: 'Poster'})
    Task.belongsTo(User, {as: 'Owner'})

    var task = Task.build({title: 'asd'})
    expect(task.getPoster).toBeDefined()
    expect(task.setPoster).toBeDefined()
    expect(task.getOwner).toBeDefined()
    expect(task.setOwner).toBeDefined()
  })

  it("intializes the foreign key with null", function() {
    Task.belongsTo(User)

    var task = Task.build({title: 'asd'})
    expect(task['UserId']).not.toBeDefined();
  })

  it("sets and gets the correct objects", function() {
    Task.belongsTo(User, {as: 'User'})

    Helpers.async(function(done) {
      User.sync({force: true}).success(function() {
        Task.sync({force: true}).success(done)
      })
    })

    Helpers.async(function(done) {
      User.create({username: 'asd'}).success(function(u) {
        Task.create({title: 'a task'}).success(function(t) {
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

  it('extends the id where param with the supplied where params', function() {
    Task.belongsTo(User, {as: 'User'})

    Helpers.async(function(done) {
      User.sync({force: true}).success(function() {
        Task.sync({force: true}).success(done)
      })
    })

    Helpers.async(function(done) {
      User.create({username: 'asd', enabled: false}).success(function(u) {
        Task.create({title: 'a task'}).success(function(t) {
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

  it("handles self associations", function() {
    Helpers.async(function(done) {
      var Person = sequelize.define('Person', { name: Sequelize.STRING })

      Person.belongsTo(Person, {as: 'Mother', foreignKey: 'MotherId'})
      Person.belongsTo(Person, {as: 'Father', foreignKey: 'FatherId'})

      Person.sync({force: true}).success(function() {
        var p = Person.build()
        expect(p.setFather).toBeDefined()
        expect(p.setMother).toBeDefined()
        done()
      })
    })
  })

  it("sets the foreign key in self associations", function() {
    var Person = sequelize.define('Person', { name: Sequelize.STRING })
    Person.belongsTo(Person, {as: 'Mother'})
    expect(Person.associations.MotherPersons.options.foreignKey).toEqual('MotherId')
  })
})
