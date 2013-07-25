/* jshint camelcase: false */
var chai      = require('chai')
  , expect    = chai.expect
  , Support   = require(__dirname + '/../support')
  , DataTypes = require(__dirname + "/../../lib/data-types")
  , dialect   = Support.getTestDialect()
  , dbFile    = __dirname + '/test.sqlite'
  , storages  = [dbFile]

chai.Assertion.includeStack = true

if (dialect === 'sqlite') {
  describe('[SQLITE Specific] DAOFactory', function() {
    after(function(done) {
      this.sequelize.options.storage = ':memory:'
      done()
    })

    beforeEach(function(done) {
      this.sequelize.options.storage = dbFile
      this.User = this.sequelize.define('User', {
        age: DataTypes.INTEGER,
        name: DataTypes.STRING,
        bio: DataTypes.TEXT
      })
      this.User.sync({ force: true }).success(function() {
        done()
      })
    })

    storages.forEach(function(storage) {
      describe('with storage "' + storage + '"', function() {
        after(function(done) {
          if (storage === dbFile) {
            require("fs").writeFile(dbFile, '', function() {
              done()
            })
          }
        })

        describe('create', function() {
          it('creates a table entry', function(done) {
            var self = this
            this.User.create({ age: 21, name: 'John Wayne', bio: 'noot noot' }).success(function(user) {
              expect(user.age).to.equal(21)
              expect(user.name).to.equal('John Wayne')
              expect(user.bio).to.equal('noot noot')

              self.User.all().success(function(users) {
                var usernames = users.map(function(user) {
                  return user.name
                })
                expect(usernames).to.contain('John Wayne')
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
                expect(people.options).to.deep.equal(options)
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
                expect(people.has_swag).to.be.ok
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
                expect(people.has_swag).to.not.be.ok
                done()
              })
            })
          })
        })

        describe('.find', function() {
          beforeEach(function(done) {
            this.User.create({name: 'user', bio: 'footbar'}).success(function() {
              done()
            })
          })

          it("finds normal lookups", function(done) {
            this.User.find({ where: { name:'user' } }).success(function(user) {
              expect(user.name).to.equal('user')
              done()
            })
          })

          it("should make aliased attributes available", function(done) {
            this.User.find({ where: { name:'user' }, attributes: ['id', ['name', 'username']] }).success(function(user) {
              expect(user.username).to.equal('user')
              done()
            })
          })
        })

        describe('.all', function() {
          beforeEach(function(done) {
            this.User.bulkCreate([
              {name: 'user', bio: 'foobar'},
              {name: 'user', bio: 'foobar'}
            ]).success(function() {
              done()
            })
          })

          it("should return all users", function(done) {
            this.User.all().on('success', function(users) {
              expect(users).to.have.length(2)
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
                expect(min).to.equal(2)
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
                expect(min).to.equal(5)
                done()
              })
            })
          })
        })
      })
    })
  })
}
