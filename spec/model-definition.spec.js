var config    = require("./config/config")
  , Helpers   = require("./config/helpers")
  , Sequelize = require("../index")

describe('ModelDefinition', function() {
  var sequelize = new Sequelize(config.database, config.username, config.password, { logging: false })
    , User      = sequelize.define('User', { name: Sequelize.STRING, bio: Sequelize.TEXT })

  beforeEach(function() {
    Helpers.async(function(done) {
      sequelize.sync({force: true}).on('success', done).on('failure', function(err) { console.log(err) })
    })
  })

  afterEach(function() {
    Helpers.async(function(done) {
      sequelize.drop().on('success', done).on('failure', function(err) { console.log(err) })
    })
  })

  //////////// all //////////////

  describe('.all', function() {
    beforeEach(function() {
      var UserFactory = function(options, callback, count) {
        count = count || 1

        User.create(options).on('success', function(user){
          --count ? UserFactory(options, callback, count) : callback(user)
        }).on('failure', function(err) {
          console.log(err)
        })
      }
      Helpers.async(function(done) { UserFactory({name: 'user', bio: 'foobar'}, done, 2) })
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

  /////////// create ////////////

  describe('.create with options', function() {
    var Person = sequelize.define('Person', { name: Sequelize.STRING, options: Sequelize.TEXT })

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

  /////////// many-to-many with same prefix ////////////

  describe('many-to-many', function() {
    describe('where tables have the same prefix', function() {
      var Table2 = sequelize.define('wp_table2', {foo: Sequelize.STRING})
        , Table1 = sequelize.define('wp_table1', {foo: Sequelize.STRING})

      Table1.hasMany(Table2)
      Table2.hasMany(Table1)

      it("should create a table wp_table1wp_table2s", function() {
        var models = sequelize.modelManager.models.filter(function(model) {
          return model.tableName.indexOf('wp_table1swp_table2s') > -1
        })
        expect(models.length).toBe(1)
      })
    })
  })
})
