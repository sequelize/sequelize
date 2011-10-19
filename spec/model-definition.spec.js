var should    = require("should")
  , config    = require("./config/config")
  , Helpers   = require("./config/helpers")
  , Sequelize = require("../index")

describe('ModelDefinition', function() {
  var sequelize = new Sequelize(config.database, config.username, config.password, { logging: false })
    , User      = sequelize.define('User', { name: Sequelize.STRING, bio: Sequelize.TEXT })

  beforeEach(function() {
    var createUser  = function(num, cb) {
    console.log('create user')
      User.create({name: 'user' + num, bio: 'foobar'}).on('success', function(user){
        --num ? createUser(num, cb) : cb()
      })
    }

    Helpers.async(function(done) {
      User.sync({force: true}).on('success', function() { done() })
    })
    Helpers.async(function(done) { createUser(2, done) })
  })

  describe('.all', function() {
    it("should return all users", function() {

      Helpers.async(function(done) {
        User.all.on('success', function(users) {
          done()
          expect(users.length).toEqual(2)
        })
      })

    })
  })
})
