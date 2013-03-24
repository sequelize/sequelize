var config    = require("./config/config")
  , Sequelize = require("../index")
  , dialects  = ['sqlite', 'mysql', 'postgres']

describe('DAO', function() {
  dialects.forEach(function(dialect) {
    describe('with dialect "' + dialect + '"', function() {
      var User      = null
        , sequelize = new Sequelize(
            config[dialect].database,
            config[dialect].username,
            config[dialect].password,
            {
              logging: false,
              dialect: dialect,
              port: config[dialect].port
            }
          )
        , Helpers   = new (require("./config/helpers"))(sequelize)

      var setup = function() {
        Helpers.async(function(done) {
          User = sequelize.define('User', {
            username: Sequelize.STRING,
            birthDate: Sequelize.DATE
          })
          User.sync({ force: true }).success(done)
        })
      }

      beforeEach(function() { Helpers.dropAllTables(); setup() })
      afterEach(function() { Helpers.dropAllTables() })

      describe('Escaping', function() {
        it('is done properly for special characters', function() {
          var User = sequelize.define('User', {
            bio: Sequelize.TEXT
          }, { timestamps: false, logging: false })

          Helpers.async(function(done) {
            User.sync({ force: true }).success(done)
          })

          Helpers.async(function(done) {
            // Ideally we should test more: "\0\n\r\b\t\\\'\"\x1a"
            // But this causes sqlite to fail and exits the entire test suite immediately
            var bio = dialect + "'\"\n"; // Need to add the dialect here so in case of failure I know what DB it failed for
            User.create({ bio: bio }).success(function(u1) {
              User.find(u1.id).success(function(u2) {
                expect(u2.bio).toEqual(bio)
                done()
              })
            })
          })
        })
      })

      describe('isNewRecord', function() {
        it('returns true for non-saved objects', function() {
          var user = User.build({ username: 'user' })
          expect(user.id).toBeNull()
          expect(user.isNewRecord).toBeTruthy()
        })

        it("returns false for saved objects", function() {
          Helpers.async(function(done) {
            User.build({ username: 'user' }).save().success(function(user) {
              expect(user.isNewRecord).toBeFalsy()
              done()
            })
          })
        })

        it("returns false for created objects", function() {
          Helpers.async(function(done) {
            User.create({ username: 'user' }).success(function(user) {
              expect(user.isNewRecord).toBeFalsy()
              done()
            })
          })
        })

        it("returns false for objects found by find method", function() {
          Helpers.async(function(done) {
            User.create({ username: 'user' }).success(function(user) {
              User.create({ username: 'user' }).success(function(user) {
                User.find(user.id).success(function(user) {
                  expect(user.isNewRecord).toBeFalsy()
                  done()
                })
              })
            })
          })
        })

        it("returns false for objects found by findAll method", function() {
          var chainer = new Sequelize.Utils.QueryChainer

          for(var i = 0; i < 10; i++)
            chainer.add(User.create({ username: 'user' }))

          Helpers.async(function(done) {
            chainer.run().success(function() {
              User.findAll().success(function(users) {
                users.forEach(function(u) {
                  expect(u.isNewRecord).toBeFalsy()
                })
                done()
              })
            })
          })
        })
      })

      describe('save', function() {
        it('only updates fields in passed array', function() {
          var user   = null
            , user2  = null
            , userId = null
            , date   = new Date(1990, 01, 01)

          Helpers.async(function(done) {
            User.create({
              username: 'foo',
              birthDate: new Date()
            }).success(function(_user) {
              user = _user
              done()
            }).error(function(err) {
              console.log(err)
            })
          })

          Helpers.async(function(done) {
            user.username = 'fizz'
            user.birthDate = date

            done()
          })

          Helpers.async(function(done) {
            user.save(['username']).success(function(){
              // re-select user
              User.find(user.id).success(function(_user2) {
                user2 = _user2
                done()
              })
            })
          })

          Helpers.async(function(done) {
            // name should have changed
            expect(user2.username).toEqual('fizz')
            // bio should be unchanged
            expect(user2.birthDate).toNotEqual(date)

            done()
          })
        })

        it("stores an entry in the database", function() {
          var username = 'user'
            , user     = User.build({
              username: username,
              birthDate: new Date(1984, 8, 23)
            })

          Helpers.async(function(done) {
            User.all().success(function(users) {
              expect(users.length).toEqual(0)
              done()
            })
          })

          Helpers.async(function(done) {
            user.save().success(done)
          })

          Helpers.async(function(done) {
            User.all().success(function(users) {
              expect(users.length).toEqual(1)
              expect(users[0].username).toEqual(username)
              expect(users[0].birthDate instanceof Date).toBe(true)
              expect(users[0].birthDate).toEqual(new Date(1984, 8, 23))
              done()
            })
          })
        })

        it("updates the timestamps", function() {
          var now       = Date.now()
            , user      = null
            , updatedAt = null

          Helpers.async(function(done) {
            // timeout is needed, in order to check the update of the timestamp
            setTimeout(function() {
              user      = User.build({ username: 'user' })
              updatedAt = user.updatedAt
              expect(updatedAt.getTime()).toBeGreaterThan(now)
              done()
            }, 1000)
          })

          Helpers.async(function(done) {
            setTimeout(function() {
              user.save().success(function() {
                expect(updatedAt.getTime()).toBeLessThan(user.updatedAt.getTime())
                done()
              })
            }, 1000)
          })
        })

        describe('without timestamps option', function() {
          var User2 = sequelize.define('User2', {
            username: Sequelize.STRING,
            updatedAt: Sequelize.DATE
          }, {
            timestamps: false
          })

          beforeEach(function() {
            Helpers.async(function(done) {
              User2.sync({ force: true }).success(done)
            })
          })

          it("doesn't update the updatedAt column", function() {
            Helpers.async(function(done) {
              User2.create({ username: 'john doe' }).success(function(johnDoe) {
                // sqlite and mysql return undefined, whereas postgres returns null
                expect([undefined, null].indexOf(johnDoe.updatedAt)).not.toBe(-1);
                done()
              })
            })
          })
        })
      })

      describe('updateAttributes', function() {
        it("updates attributes in the database", function() {
          Helpers.async(function(done) {
            User.create({ username: 'user' }).success(function(user) {
              expect(user.username).toEqual('user')
              user.updateAttributes({ username: 'person' }).success(function(user) {
                expect(user.username).toEqual('person')
                done()
              })
            })
          })
        })

        it("ignores unknown attributes", function() {
          Helpers.async(function(done) {
            User.create({ username: 'user' }).success(function(user) {
              user.updateAttributes({ username: 'person', foo: 'bar'}).success(function(user) {
                expect(user.username).toEqual('person')
                expect(user.foo).toBeUndefined()
                done()
              })
            })
          })
        })

        it("doesn't update primary keys or timestamps", function() {
          var User = sequelize.define('User' + config.rand(), {
            name: Sequelize.STRING, bio: Sequelize.TEXT, identifier: {type: Sequelize.STRING, primaryKey: true}
          })

          Helpers.async(function(done) {
            User.sync({ force: true }).success(done)
          })

          Helpers.async(function(done) {
            User.create({
              name: 'snafu',
              identifier: 'identifier'
            }).success(function(user) {
              var oldCreatedAt  = user.createdAt
                , oldIdentifier = user.identifier

              user.updateAttributes({
                name: 'foobar',
                createdAt: new Date(2000, 1, 1),
                identifier: 'another identifier'
              }).success(function(user) {
                expect(user.createdAt).toEqual(oldCreatedAt)
                expect(user.identifier).toEqual(oldIdentifier)
                done()
              })
            })
          })
        })

        it("uses primary keys in where clause", function() {
          var User = sequelize.define('User' + config.rand(), {
            name: Sequelize.STRING, bio: Sequelize.TEXT, identifier: {type: Sequelize.STRING, primaryKey: true}
          })

          Helpers.async(function(done) {
            User.sync({ force:true }).success(done)
          })

          Helpers.async(function(done) {
            User.create({
              name: 'snafu',
              identifier: 'identifier'
            }).success(function(user) {
              var emitter = user.updateAttributes({name: 'foobar'})
              emitter.success(function() {
                expect(emitter.query.sql).toMatch(/WHERE [`"]identifier[`"]..identifier./)
                done()
              })
            })
          })
        })
      })

      describe('values', function() {
        it('returns all values', function() {
          var User = sequelize.define('User', {
            username: Sequelize.STRING
          }, { timestamps: false, logging: false })

          Helpers.async(function(done) {
            User.sync({ force: true }).success(done)
          })

          Helpers.async(function(done) {
            var user = User.build({ username: 'foo' })
            expect(user.values).toEqual({ username: "foo", id: null })
            done()
          })
        })
      })
    })
  })
})
