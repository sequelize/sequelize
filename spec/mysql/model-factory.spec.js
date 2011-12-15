var config    = require("../config/config")
  , Sequelize = require("../../index")
  , sequelize = new Sequelize(config.database, config.username, config.password, { logging: false })
  , Helpers   = new (require("../config/helpers"))(sequelize)

describe('ModelFactory', function() {
  beforeEach(function() { Helpers.sync() })
  afterEach(function() { Helpers.drop() })

  var User = sequelize.define('User', { age: Sequelize.INTEGER, name: Sequelize.STRING, bio: Sequelize.TEXT })

  //////////// constructor ////////

  describe('constructor', function() {
    it("handles extended attributes (unique)", function() {
      var User = sequelize.define('User' + config.rand(), {
        username: { type: Sequelize.STRING, unique: true }
      }, { timestamps: false })
      expect(User.attributes).toEqual({username:"VARCHAR(255) UNIQUE",id:"INT NOT NULL auto_increment PRIMARY KEY"})
    })

    it("handles extended attributes (default)", function() {
      var User = sequelize.define('User' + config.rand(), {
        username: {type: Sequelize.STRING, defaultValue: 'foo'}
      }, { timestamps: false })
      expect(User.attributes).toEqual({username:"VARCHAR(255) DEFAULT 'foo'",id:"INT NOT NULL auto_increment PRIMARY KEY"})
    })

    it("handles extended attributes (null)", function() {
      var User = sequelize.define('User' + config.rand(), {
        username: {type: Sequelize.STRING, allowNull: false}
      }, { timestamps: false })
      expect(User.attributes).toEqual({username:"VARCHAR(255) NOT NULL",id:"INT NOT NULL auto_increment PRIMARY KEY"})
    })

    it("handles extended attributes (primaryKey)", function() {
      var User = sequelize.define('User' + config.rand(), {
        username: {type: Sequelize.STRING, primaryKey: true}
      }, { timestamps: false })
      expect(User.attributes).toEqual({username:"VARCHAR(255) PRIMARY KEY"})
    })

    it("adds timestamps", function() {
      var User1 = sequelize.define('User' + config.rand(), {})
      var User2 = sequelize.define('User' + config.rand(), {}, { timestamps: true })

      expect(User1.attributes).toEqual({id:"INT NOT NULL auto_increment PRIMARY KEY", updatedAt:"DATETIME NOT NULL", createdAt:"DATETIME NOT NULL"})
      expect(User2.attributes).toEqual({id:"INT NOT NULL auto_increment PRIMARY KEY", updatedAt:"DATETIME NOT NULL", createdAt:"DATETIME NOT NULL"})
    })

    it("adds deletedAt if paranoid", function() {
      var User = sequelize.define('User' + config.rand(), {}, { paranoid: true })
      expect(User.attributes).toEqual({id:"INT NOT NULL auto_increment PRIMARY KEY", deletedAt:"DATETIME", updatedAt:"DATETIME NOT NULL", createdAt:"DATETIME NOT NULL"})
    })

    it("underscores timestamps if underscored", function() {
      var User = sequelize.define('User' + config.rand(), {}, { paranoid: true, underscored: true })
      expect(User.attributes).toEqual({id:"INT NOT NULL auto_increment PRIMARY KEY", deleted_at:"DATETIME", updated_at:"DATETIME NOT NULL", created_at:"DATETIME NOT NULL"})
    })

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

  describe('primaryKeys', function() {
    it("determines the correct primaryKeys", function() {
      var User = sequelize.define('User' + config.rand(), {
        foo: {type: Sequelize.STRING, primaryKey: true},
        bar: Sequelize.STRING
      })
      expect(User.primaryKeys).toEqual({"foo":"VARCHAR(255) PRIMARY KEY"})
    })
  })

  //////////// find //////////////

  describe('.find', function() {
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

  //////////// all //////////////

  describe('.all', function() {
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

  /////////// create ////////////

  describe('.create with options', function() {
    var Person = sequelize.define('Person', { name: Sequelize.STRING, options: Sequelize.TEXT })

    it('should allow the creation of an object with options as attribute', function() {
      var options = JSON.stringify({ foo: 'bar', bar: 'foo' })
      Helpers.Factories.Model('Person', {name: 'John Doe', options: options}, function(people) {
        expect(people[0].options).toEqual(options)
      })
    })
  })

  //////////// min //////////////

  describe('.min', function() {
    it("should return the min value", function() {
      for(var i = 2; i < 5; i++) Helpers.Factories.User({ age: i })

      Helpers.async(function(done) {
        User.min('age').on('success', function(min) {
          expect(min).toEqual(2); done()
        })
      })
    })
  })

  //////////// max //////////////

  describe('.max', function() {
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
