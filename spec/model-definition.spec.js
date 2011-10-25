var should    = require("should")
  , config    = require("./config/config")
  , Helpers   = require("./config/helpers")
  , Sequelize = require("../index")

describe('ModelDefinition', function() {
  var sequelize = new Sequelize(config.database, config.username, config.password, { logging: false })
    , User      = sequelize.define('User', { name: Sequelize.STRING, bio: Sequelize.TEXT })

  afterEach(function() {
    Helpers.async(function(done) {
      sequelize.drop().on('success', done).on('failure', function(err) { console.log(err) })
    })
  })

  describe('.all', function() {
    beforeEach(function() {
      var createUser  = function(num, cb) {
      console.log('create user')
        User.create({name: 'user' + num, bio: 'foobar'}).on('success', function(user){
          --num ? createUser(num, cb) : cb()
        })
      }

      Helpers.async(function(done) {
        User.sync({force: true})
            .on('success', function() { done() })
            .on('failure', function(err) { console.log(err) })
      })
      Helpers.async(function(done) { createUser(2, done) })
    })

    it("should return all users", function() {

      Helpers.async(function(done) {
        User.all.on('success', function(users) {
          done()
          expect(users.length).toEqual(2)
        }).on('failure', function(err) { console.log(err) })
      })

    })
  })

  describe('.create with options', function() {
    var Person = sequelize.define('Person', { name: Sequelize.STRING, options: Sequelize.TEXT })

    beforeEach(function() {
      Helpers.async(function(done) {
        Person.sync({force: true})
              .on('success', function() { done() })
              .on('failure', function(err) { console.log(err) })
      })
    })

    it('should allow the creation of an object with options as attribute', function() {
      Helpers.async(function(done) {
        var options = JSON.stringify({ foo: 'bar', bar: 'foo' })
        Person.create({name: 'John Doe', options: options}).on('success', function(person) {
          expect(person.options).toEqual(options)
          done()
        }).on('failure', function(err) { console.log(err) })
      })
    })
  })
})
