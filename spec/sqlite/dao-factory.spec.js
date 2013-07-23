/* jshint camelcase: false */
var buster  = require("buster")
  , Helpers = require('../buster-helpers')
  , dialect = Helpers.getTestDialect()
  , dbFile    = __dirname + '/test.sqlite'
  , storages  = [dbFile]
  , DataTypes = require(__dirname + "/../../lib/data-types")

buster.spec.expose()
buster.testRunner.timeout = 1000

var sequelize = Helpers.createSequelizeInstance({dialect: dialect})

if (dialect === 'sqlite') {
  describe('[SQLITE] DAOFactory', function() {
    before(function(done) {
      var self = this
      this.sequelize = sequelize
      Helpers.clearDatabase(this.sequelize, function() {
        self.User = sequelize.define('User', {
          age: DataTypes.INTEGER,
          name: DataTypes.STRING,
          bio: DataTypes.TEXT
        })
        self.User.sync({ force: true }).success(done)
      })
    })

    storages.forEach(function(storage) {
      describe('with storage "' + storage + '"', function() {
        after(function(done) {
          if (storage == dbFile) {
            require("fs").unlink(__dirname + '/test.sqlite', done)
          }
        })

        describe('create', function() {
          it('creates a table entry', function(done) {
            var self = this

            this.User.create({ age: 21, name: 'John Wayne', bio: 'noot noot' }).success(function(user) {
              expect(user.age).toEqual(21)
              expect(user.name).toEqual('John Wayne')
              expect(user.bio).toEqual('noot noot')

              self.User.all().success(function(users) {
                var usernames = users.map(function(user) {
                  return user.name
                })
                expect(usernames).toEqual(['John Wayne'])
                done()
              })
            })
          })

          it('should allow the creation of an object with options as attribute', function(done) {
            var Person = this.sequelize.define('Person', {
              name: DataTypes.STRING,
              options: DataTypes.TEXT
            })

            Person.sync({ force: true }).success(function() {
              var options = JSON.stringify({ foo: 'bar', bar: 'foo' })

              Person.create({
                name: 'John Doe',
                options: options
              }).success(function(people) {
                expect(people.options).toEqual(options)
                done()
              })
            })
          })

          it('should allow the creation of an object with a boolean (true) as attribute', function(done) {
            var Person = this.sequelize.define('Person', {
              name: DataTypes.STRING,
              has_swag: DataTypes.BOOLEAN
            })

            Person.sync({ force: true }).success(function() {
              Person.create({
                name: 'John Doe',
                has_swag: true
              }).success(function(people) {
                expect(people.has_swag).toBeTruthy();
                done()
              })
            })
          })

          it('should allow the creation of an object with a boolean (false) as attribute', function(done) {
            var Person = this.sequelize.define('Person', {
              name: DataTypes.STRING,
              has_swag: DataTypes.BOOLEAN
            })

            Person.sync({ force: true }).success(function() {
              Person.create({
                name: 'John Doe',
                has_swag: false
              }).success(function(people) {
                expect(people.has_swag).toBeFalsy();
                done()
              })
            })
          })
        })

        describe('.find', function() {
          before(function(done) {
            this.User.create({name: 'user', bio: 'footbar'}).success(done)
          })

          it("finds normal lookups", function(done) {
            this.User.find({ where: { name:'user' } }).success(function(user) {
              expect(user.name).toEqual('user')
              done()
            })
          })

          it("should make aliased attributes available", function(done) {
            this.User.find({ where: { name:'user' }, attributes: ['id', ['name', 'username']] }).success(function(user) {
              expect(user.username).toEqual('user')
              done()
            })
          })
        })

        describe('.all', function() {
          before(function(done) {
            this.User.bulkCreate([
              {name: 'user', bio: 'foobar'},
              {name: 'user', bio: 'foobar'}
            ]).success(done)
          })

          it("should return all users", function(done) {
            this.User.all().on('success', function(users) {
              expect(users.length).toEqual(2)
              done()
            })
          })
        })

        describe('.min', function() {
          it("should return the min value", function(done) {
            var self = this
              , users = []

            for (var i = 2; i < 5; i++) {
              users[users.length] = {age: i}
            }

            this.User.bulkCreate(users).success(function() {
              self.User.min('age').on('success', function(min) {
                expect(min).toEqual(2)
                done()
              })
            })
          })
        })

        describe('.max', function() {
          it("should return the max value", function(done) {
            var self = this
              , users = []

            for (var i = 2; i <= 5; i++) {
              users[users.length] = {age: i}
            }

            this.User.bulkCreate(users).success(function() {
              self.User.max('age').on('success', function(min) {
                expect(min).toEqual(5);
                done()
              })
            })
          })
        })
      })
    })
  })
}
