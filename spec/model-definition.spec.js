var config    = require("./config/config")
  , Sequelize = require("../index")
  , sequelize = new Sequelize(config.database, config.username, config.password, { logging: false })
  , Helpers   = new (require("./config/helpers"))(sequelize)

describe('ModelFactory', function() {
  beforeEach(function() { Helpers.sync() })
  afterEach(function() { Helpers.drop() })

  var User = sequelize.define('User', { age: Sequelize.INTEGER, name: Sequelize.STRING, bio: Sequelize.TEXT })

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
      Helpers.Factories.Model('Person', {name: 'John Doe', options: options}, function(person) {
        expect(person.options).toEqual(options)
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
        User.max('age').on('success', function(min) {
          expect(min).toEqual(5); done()
        })
      })
    })
  })
})
