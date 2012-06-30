var config    = require("../config/config")
  , Sequelize = require("../../index")
  , dbFile    = __dirname + '/test.sqlite'
  , storages  = [':memory:', dbFile]

describe('DAOFactory', function() {
  storages.forEach(function(storage) {
    describe('with storage "' + storage + '"', function() {
      var User      = null
        , sequelize = null
        , Helpers   = null

      beforeEach(function() {
        sequelize = new Sequelize(config.database, config.username, config.password, {
          logging: false,
          dialect: 'sqlite',
          storage: storage
        })

        Helpers = new (require("../config/helpers"))(sequelize)

        User = sequelize.define('User', {
          age: Sequelize.INTEGER,
          name: Sequelize.STRING,
          bio: Sequelize.TEXT
        })

        Helpers.sync()
      })

      afterEach(function() {
        Helpers.dropAllTables()
        if(storage == dbFile) {
          Helpers.async(function(done) {
            require("fs").unlink(__dirname + '/test.sqlite', done)
          })
        }
      })

      describe('create', function() {
        it('creates a table entry', function() {
          Helpers.async(function(done) {
            User
              .create({ age: 21, name: 'John Wayne', bio: 'noot noot' })
              .success(done)
              .error(function(err) { console.log(err) })
          })

          Helpers.async(function(done) {
            User.all().success(function(users) {
              var usernames = users.map(function(user) {
                return user.name
              })
              expect(usernames).toEqual(['John Wayne'])
              done()
            }).error(function(err){ console.log(err) })
          })
        })

        it('should allow the creation of an object with options as attribute', function() {
          var Person = sequelize.define('Person', {
            name: Sequelize.STRING,
            options: Sequelize.TEXT
          })

          Helpers.async(function(done) {
            Person.sync({force: true}).success(done)
          })

          Helpers.async(function(done) {
            var options = JSON.stringify({ foo: 'bar', bar: 'foo' })
            Helpers.Factories.DAO('Person', {
              name: 'John Doe',
              options: options
            }, function(people) {
              expect(people[0].options).toEqual(options)
              done()
            })
          })
        })

        it('should allow the creation of an object with a boolean (true) as attribute', function() {
          var Person = sequelize.define('Person', {
            name: Sequelize.STRING,
            has_swag: Sequelize.BOOLEAN
          })

          Helpers.async(function(done) {
            Person.sync({force: true}).success(done)
          })

          Helpers.async(function(done) {
            Helpers.Factories.DAO('Person', {
              name: 'John Doe',
              has_swag: true
            }, function(people) {
              expect(people[0].has_swag).toBeTruthy();
              done()
            })
          })
        })

        it('should allow the creation of an object with a boolean (false) as attribute', function() {
          var Person = sequelize.define('Person', {
            name: Sequelize.STRING,
            has_swag: Sequelize.BOOLEAN
          })

          Helpers.async(function(done) {
            Person.sync({force: true}).success(done)
          })

          Helpers.async(function(done) {
            Helpers.Factories.DAO('Person', {
              name: 'John Doe',
              has_swag: false
            }, function(people) {
              expect(people[0].has_swag).toBeFalsy();
              done()
            })
          })
        })
      })


      ////////// find //////////////

      describe('.find', function() {
        beforeEach(function() {
          Helpers.Factories.User({name: 'user', bio: 'foobar'}, null, 2)
        })

        it("finds normal lookups", function() {
          Helpers.async(function(done) {
            User.find({ where: { name:'user' } }).success(function(user) {
              expect(user.name).toEqual('user')
              done()
            })
          })
        })

        it("should make aliased attributes available", function() {
          Helpers.async(function(done) {
            User.find({ where: { name:'user' }, attributes: ['id', ['name', 'username']] }).success(function(user) {
              expect(user.username).toEqual('user')
              done()
            })
          })
        })
      })

      ////////// all //////////////

      describe('.all', function() {
        beforeEach(function() {
          Helpers.Factories.User({name: 'user', bio: 'foobar'}, null, 2)
        })

        it("should return all users", function() {
          Helpers.async(function(done) {
            User.all().on('success', function(users) {
              done()
              expect(users.length).toEqual(2)
            }).on('error', function(err) { console.log(err) })
          })
        })
      })

      ////////// min //////////////

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

      ////////// max //////////////

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
  })
})
