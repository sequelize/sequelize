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

      describe('Validations', function() {
        var checks = {
          is : {
            spec : { args: ["[a-z]",'i'] },
            fail: "0",
            pass: "a"
          }
        , not : {
            spec: { args: ["[a-z]",'i'] },
            fail: "a",
            pass: "0"
          }
        , isEmail : {
            fail: "a",
            pass: "abc@abc.com"
          }
        , isUrl : {
            fail: "abc",
            pass: "http://abc.com"
          }
        , isIP : {
            fail: "abc",
            pass: "129.89.23.1"
          }
        , isAlpha : {
            fail: "012",
            pass: "abc"
          }
        , isAlphanumeric : {
            fail: "_abc019",
            pass: "abc019"
          }
        , isNumeric : {
            fail: "abc",
            pass: "019"
          }
        , isInt : {
            fail: "9.2",
            pass: "-9"
          }
        , isLowercase : {
            fail: "AB",
            pass: "ab"
          }
        , isUppercase : {
            fail: "ab",
            pass: "AB"
          }
        , isDecimal : {
            fail: "a",
            pass: "0.2"
          }
        , isFloat : {
            fail: "a",
            pass: "9.2"
          }
        , notNull : {
            fail: null,
            pass: 0
          }
        , isNull : {
            fail: 0,
            pass: null
          }
        , notEmpty : {
            fail: "       ",
            pass: "a"
          }
        , equals : {
            spec : { args : "bla bla bla" },
            fail: "bla",
            pass: "bla bla bla"
          }
        , contains : {
            spec : { args : "bla" },
            fail: "la",
            pass: "0bla23"
          }
        , notContains : {
            spec : { args : "bla" },
            fail: "0bla23",
            pass: "la"
          }
        , regex : {
            spec : { args: ["[a-z]",'i'] },
            fail: "0",
            pass: "a"
          }
        , notRegex : {
            spec: { args: ["[a-z]",'i'] },
            fail: "a",
            pass: "0"
          }
        , len : {
            spec: { args: [2,4] },
            fail: ["1", "12345"],
            pass: ["12", "123", "1234"],
            raw: true
          }
        , isUUID : {
            spec: { args: 4 },
            fail: "f47ac10b-58cc-3372-a567-0e02b2c3d479",
            pass: "f47ac10b-58cc-4372-a567-0e02b2c3d479"
          }
        , isDate : {
            fail: "not a date",
            pass: "2011-02-04"
          }
        , isAfter : {
            spec: { args: "2011-11-05" },
            fail: "2011-11-04",
            pass: "2011-11-05"
          }
        , isBefore : {
            spec: { args: "2011-11-05" },
            fail: "2011-11-06",
            pass: "2011-11-05"
          }
        , isIn : {
            spec: { args: "abcdefghijk" },
            fail: "ghik",
            pass: "ghij"
          }
        , notIn : {
            spec: { args: "abcdefghijk" },
            fail: "ghij",
            pass: "ghik"
          }
        , max : {
            spec: { args: 23 },
            fail: "24",
            pass: "23"
          }
        , min : {
            spec: { args: 23 },
            fail: "22",
            pass: "23"
          }
        , isArray : {
            fail: 22,
            pass: [22]
          }
        , isCreditCard : {
            fail: "401288888888188f",
            pass: "4012888888881881"
          }
        };

        var User, i;

        it('should correctly validate using node-validator methods', function() {
          Helpers.async(function(done) {
            for (var validator in checks) {
              if (checks.hasOwnProperty(validator)) {
                // build spec
                var v = {};
                v[validator] = checks[validator].hasOwnProperty("spec") ? checks[validator].spec : {};

                var check = checks[validator];

                // test for failure
                if (!check.hasOwnProperty("raw"))
                  check.fail = new Array(check.fail);

                for (i=0; i<check.fail.length; ++i) {
                  v[validator].msg = validator + "(" + check.fail[i] + ")";

                  // define user
                  User = sequelize.define('User' + Math.random(), {
                    name: {
                      type: Sequelize.STRING,
                      validate: v
                    }
                  });

                  var u_fail = User.build({
                    name : check.fail[i]
                  });
                  var errors = u_fail.validate();
                  expect(errors).toNotBe(null);
                  expect(errors).toEqual({
                    name : [v[validator].msg]
                  });
                }
                // test for success
                if (!check.hasOwnProperty("raw"))
                  check.pass = new Array(check.pass);

                for (i=0; i<check.pass.length; ++i) {
                  v[validator].msg = validator + "(" + check.pass[i] + ")";

                  // define user
                  User = sequelize.define('User' + Math.random(), {
                    name: {
                      type: Sequelize.STRING,
                      validate: v
                    }
                  });

                  var u_success = User.build({
                    name : check.pass[i]
                  });
                  expect(u_success.validate()).toBe(null);
                }
              }
            } // for each check

            done();
          });
        });

        it('should correctly validate using custom validation methods', function() {
          Helpers.async(function(done) {
            User = sequelize.define('User' + Math.random(), {
              name: {
                type: Sequelize.STRING,
                validate: {
                  customFn: function(val) {
                    if (val !== "2")
                      throw new Error("name should equal '2'")
                  }
                }
              }
            });

            var u_fail = User.build({
              name : "3"
            });
            var errors = u_fail.validate();
            expect(errors).toNotBe(null);
            expect(errors).toEqual({
              name : ["name should equal '2'"]
            });

            var u_success = User.build({
              name : "2"
            });
            expect(u_success.validate()).toBe(null);

            done();
          });
        });
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
              expect(users[0].birthDate.getTime()).toEqual(new Date(1984, 8, 23).getTime())
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
            }, 10)
          })

          Helpers.async(function(done) {
            setTimeout(function() {
              user.save().success(function() {
                expect(updatedAt.getTime()).toBeLessThan(user.updatedAt.getTime())
                done()
              })
            }, 10)
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
                expect(johnDoe.updatedAt).toBeNull()
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

      describe('toJSON', function() {
        it('returns an object containing all values', function() {
          var self = this

          var User = sequelize.define('User', {
            username: Sequelize.STRING, age: Sequelize.INTEGER, isAdmin: Sequelize.BOOLEAN
          }, { timestamps: false, logging: false })

          Helpers.async(function(done) {
            User.sync({ force: true }).success(done)
          })

          Helpers.async(function(done) {
            var user = User.build({ username: 'test.user', age: 99, isAdmin: true })
            expect(user.toJSON()).toEqual({ username: 'test.user', age: 99, isAdmin: true, id: null })
            done()
          })
        })

        it('returns a response that can be stringified', function() {
          var self = this

          var User = sequelize.define('User', {
            username: Sequelize.STRING, age: Sequelize.INTEGER, isAdmin: Sequelize.BOOLEAN
          }, { timestamps: false, logging: false })

          Helpers.async(function(done) {
            User.sync({ force: true }).success(done)
          })

          Helpers.async(function(done) {
            var user = User.build({ username: 'test.user', age: 99, isAdmin: true })
            expect(JSON.stringify(user)).toEqual('{"username":"test.user","age":99,"isAdmin":true,"id":null}')
            done()
          })
        })

        it('returns a response that can be stringified and then parsed', function() {
          var self = this
          var User = sequelize.define('User', {
            username: Sequelize.STRING, age: Sequelize.INTEGER, isAdmin: Sequelize.BOOLEAN
          }, { timestamps: false, logging: false })

          Helpers.async(function(done) {
            User.sync({ force: true }).success(done)
          })

          Helpers.async(function(done) {
            var user = User.build({ username: 'test.user', age: 99, isAdmin: true })
            expect(JSON.parse(JSON.stringify(user))).toEqual({ username: 'test.user', age: 99, isAdmin: true, id: null })
            done()
          })
        })
      })
    })
  })
})
