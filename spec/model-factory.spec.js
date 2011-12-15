var config    = require("./config/config")
  , Sequelize = require("../index")
  , sequelize = new Sequelize(config.database, config.username, config.password, { logging: false })
  , Helpers   = new (require("./config/helpers"))(sequelize)

describe('ModelFactory', function() {
  var User = null

  var setup = function() {
    Helpers.async(function(done) {
      User = sequelize.define('User', {
        age: Sequelize.INTEGER,
        name: Sequelize.STRING,
        bio: Sequelize.TEXT
      })
      User.sync({force: true}).success(done)
    })
  }

  beforeEach(function() { Helpers.dropAllTables(); setup() })
  afterEach(function() { Helpers.dropAllTables() })

  describe('constructor', function() {
    it("uses the passed model name as tablename if freezeTableName", function() {
      var User = sequelize.define('User', {}, {freezeTableName: true})
      expect(User.tableName).toEqual('User')
    })

    it("uses the pluralized modelname as tablename unless freezeTableName", function() {
      var User = sequelize.define('User', {}, {freezeTableName: false})
      expect(User.tableName).toEqual('Users')
    })

    it("attaches class and instance methods", function() {
      var User = sequelize.define('User', {}, {
        classMethods: { doSmth: function(){ return 1 } },
        instanceMethods: { makeItSo: function(){ return 2}}
      })
      expect(User.doSmth).toBeDefined()
      expect(User.doSmth()).toEqual(1)
      expect(User.makeItSo).toBeUndefined()

      expect(User.build().makeItSo).toBeDefined()
      expect(User.build().makeItSo()).toEqual(2)
    })

    it("throws an error if 2 autoIncrements are passed", function() {
      expect(function () {
        var User = sequelize.define('User', {
          userid: {type: Sequelize.INTEGER, primaryKey: true, autoIncrement: true},
          userscore: {type: Sequelize.INTEGER, primaryKey: true, autoIncrement: true},
        })
      }).toThrow('Invalid model definition. Only one autoincrement field allowed.')

    })
  })

  describe('build', function() {
    it("doesn't create database entries", function() {
      Helpers.async(function(done) {
        User.build({ name: 'John Wayne', bio: 'noot' })
        User.all().success(function(users) {
          expect(users.length).toEqual(0)
          done()
        })
      })
    })

    it("fills the objects with default values", function() {
      var Task = sequelize.define('Task' + config.rand(), {
        title:  {type: Sequelize.STRING, defaultValue: 'a task!'},
        foo:    {type: Sequelize.INTEGER, defaultValue: 2},
        bar:    {type: Sequelize.DATE},
        foobar: {type: Sequelize.TEXT, defaultValue: 'asd'},
        flag:   {type: Sequelize.BOOLEAN, defaultValue: false}
      })
      expect(Task.build().title).toEqual('a task!')
      expect(Task.build().foo).toEqual(2)
      expect(Task.build().bar).toEqual(null)
      expect(Task.build().foobar).toEqual('asd')
      expect(Task.build().flag).toEqual(false)
    })
  })

  describe('find', function() {
    beforeEach(function() {
      Helpers.Factories.User({name: 'user', bio: 'foobar'}, null, 2)
    })

    it("should make aliased attributes available", function() {
      Helpers.async(function(done) {
        User.find({ where: 'id = 1', attributes: ['id', ['name', 'username']] }).success(function(user) {
          expect(user.username).toEqual('user')
          done()
        })
      })
    })
  })

  describe('all', function() {
    beforeEach(function() {
      Helpers.Factories.User({name: 'user', bio: 'foobar'}, null, 2)
    })

    it("should return all users", function() {
      Helpers.async(function(done) {
        User.all().on('success', function(users) {
          done()
          expect(users.length).toEqual(2)
        }).on('failure', function(err) { console.log(err) })
      })
    })
  })

  describe('create with options', function() {
    var Person = sequelize.define('Person', { name: Sequelize.STRING, options: Sequelize.TEXT })

    beforeEach(function() {
      Helpers.async(function(done) {
        Person.sync({ force: true }).success(done)
      })
    })

    it('should allow the creation of an object with options as attribute', function() {
      var options = JSON.stringify({ foo: 'bar', bar: 'foo' })
      Helpers.Factories.Model('Person', {name: 'John Doe', options: options}, function(people) {
        expect(people[0].options).toEqual(options)
      })
    })
  })

  describe('min', function() {
    it("should return the min value", function() {
      for(var i = 2; i < 5; i++) Helpers.Factories.User({ age: i })

      Helpers.async(function(done) {
        User.min('age').on('success', function(min) {
          expect(min).toEqual(2); done()
        })
      })
    })
  })

  describe('max', function() {
    it("should return the max value", function() {
      for(var i = 2; i <= 5; i++) Helpers.Factories.User({ age: i })

      Helpers.async(function(done) {
        User.max('age').on('success', function(max) {
          expect(max).toEqual(5); done()
        })
      })
    })
  })
})
