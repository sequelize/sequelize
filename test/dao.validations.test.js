var chai      = require('chai')
  , expect    = chai.expect
  , Sequelize = require(__dirname + '/../index')
  , Support   = require(__dirname + '/support')
  , config    = require(__dirname + '/config/config')

chai.Assertion.includeStack = true

describe(Support.getTestDialectTeaser("DaoValidator"), function() {
  describe('validations', function() {
    var checks = {
      is: {
        spec: { args: ["[a-z]",'i'] },
        fail: "0",
        pass: "a"
      },
      not: {
        spec: { args: ["[a-z]",'i'] },
        fail: "a",
        pass: "0"
      },
      isEmail : {
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
    , isIPv6 : {
        fail: '1111:2222:3333::5555:',
        pass: 'fe80:0000:0000:0000:0204:61ff:fe9d:f156'
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
    , len: {
        spec: { args: [2,4] },
        fail: ["1", "12345"],
        pass: ["12", "123", "1234"],
        raw: true
      }
    , len$: {
        spec: [2,4],
        fail: ["1", "12345"],
        pass: ["12", "123", "1234"],
        raw: true
      }
    , isUUID: {
        spec: { args: 4 },
        fail: "f47ac10b-58cc-3372-a567-0e02b2c3d479",
        pass: "f47ac10b-58cc-4372-a567-0e02b2c3d479"
      }
    , isDate: {
        fail: "not a date",
        pass: "2011-02-04"
      }
    , isAfter: {
        spec: { args: "2011-11-05" },
        fail: "2011-11-04",
        pass: "2011-11-05"
      }
    , isBefore: {
        spec: { args: "2011-11-05" },
        fail: "2011-11-06",
        pass: "2011-11-05"
      }
    , isIn: {
        spec: { args: "abcdefghijk" },
        fail: "ghik",
        pass: "ghij"
      }
    , notIn: {
        spec: { args: "abcdefghijk" },
        fail: "ghij",
        pass: "ghik"
      }
    , max: {
        spec: { args: 23 },
        fail: "24",
        pass: "23"
      }
    , max$: {
        spec: 23,
        fail: "24",
        pass: "23"
      }
    , min: {
        spec: { args: 23 },
        fail: "22",
        pass: "23"
      }
    , min$: {
        spec: 23,
        fail: "22",
        pass: "23"
      }
    , isArray: {
        fail: 22,
        pass: [22]
      }
    , isCreditCard: {
        fail: "401288888888188f",
        pass: "4012888888881881"
      }
    }

    for (var validator in checks) {
      if (checks.hasOwnProperty(validator)) {
        validator = validator.replace(/\$$/, '')

        var validatorDetails = checks[validator]

        if (!validatorDetails.hasOwnProperty("raw")) {
          validatorDetails.fail = [ validatorDetails.fail ]
          validatorDetails.pass = [ validatorDetails.pass ]
        }

        //////////////////////////
        // test the error cases //
        //////////////////////////
        for (var i = 0; i < validatorDetails.fail.length; i++) {
          var failingValue = validatorDetails.fail[i]

          it('correctly specifies an instance as invalid using a value of "' + failingValue + '" for the validation "' + validator + '"', function(done) {
            var validations = {}
              , message     = validator + "(" + failingValue + ")"

            if (validatorDetails.hasOwnProperty('spec')) {
              validations[validator] = validatorDetails.spec
            } else {
              validations[validator] = {}
            }

            validations[validator].msg = message

            var UserFail = this.sequelize.define('User' + config.rand(), {
              name: {
                type:     Sequelize.STRING,
                validate: validations
              }
            })

            var failingUser = UserFail.build({ name : failingValue })
              , errors      = undefined

            failingUser.validate().done( function(err,_errors) {
              expect(_errors).to.not.be.null
              expect(_errors).to.deep.eql({ name : [message] })
              done()
            })
          })
        }

        ////////////////////////////
        // test the success cases //
        ////////////////////////////

        for (var j = 0; j < validatorDetails.pass.length; j++) {
          var succeedingValue = validatorDetails.pass[j]

          it('correctly specifies an instance as valid using a value of "' + succeedingValue + '" for the validation "' + validator + '"', function(done) {
            var validations = {}

            if (validatorDetails.hasOwnProperty('spec')) {
              validations[validator] = validatorDetails.spec
            } else {
              validations[validator] = {}
            }

            validations[validator].msg = validator + "(" + succeedingValue + ")"

            var UserSuccess = this.sequelize.define('User' + config.rand(), {
              name: {
                type:     Sequelize.STRING,
                validate: validations
              }
            })

            var successfulUser = UserSuccess.build({ name: succeedingValue })
            successfulUser.validate().success( function() {
              expect(arguments).to.have.length(0)
              done()
            }).error(function(err) {
              expect(err).to.be.deep.equal({})
              done()
            })
          })
        }
      }
    }

    describe('#update', function() {
      it('should be able to emit an error upon updating when a validation has failed from an instance', function(done) {
        var Model = this.sequelize.define('model', {
          name: {
            type: Sequelize.STRING,
            validate: {
              notNull: true, // won't allow null
              notEmpty: true // don't allow empty strings
            }
          }
        })

        Model.sync({ force: true }).success(function() {
          Model.create({name: 'World'}).success(function(model) {
            model.updateAttributes({name: ''}).error(function(err) {
              expect(err).to.deep.equal({ name: [ 'String is empty' ] })
              done()
            })
          })
        })
      })

      it('should be able to emit an error upon updating when a validation has failed from the factory', function(done) {
        var Model = this.sequelize.define('model', {
          name: {
            type: Sequelize.STRING,
            validate: {
              notNull: true, // won't allow null
              notEmpty: true // don't allow empty strings
            }
          }
        })

        Model.sync({ force: true }).success(function() {
          Model.create({name: 'World'}).success(function(model) {
            Model.update({name: ''}, {id: 1}).error(function(err) {
              expect(err).to.deep.equal({ name: [ 'String is empty' ] })
              done()
            })
          })
        })
      })
    })

    describe('#create', function() {
      describe('generic', function() {
        beforeEach(function(done) {
          var self = this

          var Project = this.sequelize.define('Project', {
            name: {
              type: Sequelize.STRING,
              allowNull: false,
              defaultValue: 'unknown',
              validate: {
                isIn: [['unknown', 'hello', 'test']]
              }
            }
          })

          var Task = this.sequelize.define('Task', {
            something: Sequelize.INTEGER
          })

          Project.hasOne(Task)
          Task.hasOne(Project)

          Project.sync({ force: true }).success(function() {
            Task.sync({ force: true }).success(function() {
              self.Project = Project
              self.Task = Task
              done()
            })
          })
        })

        it('correctly throws an error using create method ', function(done) {
          this.Project.create({name: 'nope'}).error(function(err) {
            expect(err).to.have.ownProperty('name')
            done()
          })
        })

        it('correctly validates using create method ', function(done) {
          var self = this
          this.Project.create({}).success(function(project) {
            self.Task.create({something: 1}).success(function(task) {
              project.setTask(task).success(function(task) {
                expect(task.ProjectId).to.not.be.null
                task.setProject(project).success(function(project) {
                  expect(project.ProjectId).to.not.be.null
                  done()
                })
              })
            })
          })
        })
      })

      describe('explicitly validating primary/auto incremented columns', function() {
        it('should emit an error when we try to enter in a string for the id key without validation arguments', function(done) {
          var User = this.sequelize.define('UserId', {
            id: {
              type: Sequelize.INTEGER,
              autoIncrement: true,
              primaryKey: true,
              validate: {
                isInt: true
              }
            }
          })

          User.sync({ force: true }).success(function() {
            User.create({id: 'helloworld'}).error(function(err) {
              expect(err).to.deep.equal({id: ['Invalid integer']})
              done()
            })
          })
        })

        it('should emit an error when we try to enter in a string for an auto increment key (not named id)', function(done) {
          var User = this.sequelize.define('UserId', {
            username: {
              type: Sequelize.INTEGER,
              autoIncrement: true,
              primaryKey: true,
              validate: {
                isInt: { args: true, msg: 'Username must be an integer!' }
              }
            }
          })

          User.sync({ force: true }).success(function() {
            User.create({username: 'helloworldhelloworld'}).error(function(err) {
              expect(err).to.deep.equal({username: ['Username must be an integer!']})
              done()
            })
          })
        })

        describe("primaryKey with the name as id with arguments for it's validation", function() {
          beforeEach(function(done) {
            this.User = this.sequelize.define('UserId', {
              id: {
                type: Sequelize.INTEGER,
                autoIncrement: true,
                primaryKey: true,
                validate: {
                  isInt: { args: true, msg: 'ID must be an integer!' }
                }
              }
            })

            this.User.sync({ force: true }).success(function() {
              done()
            })
          })

          it('should emit an error when we try to enter in a string for the id key with validation arguments', function(done) {
            this.User.create({id: 'helloworld'}).error(function(err) {
              expect(err).to.deep.equal({id: ['ID must be an integer!']})
              done()
            })
          })

          it('should emit an error when we try to enter in a string for an auto increment key through .build().validate()', function(done) {
            var user = this.User.build({id: 'helloworld'})

            user.validate().success(function(errors) {
              expect(errors).to.deep.equal({ id: [ 'ID must be an integer!' ] })
              done()
            })
          })

          it('should emit an error when we try to .save()', function(done) {
            var user = this.User.build({id: 'helloworld'})
            user.save().error(function(err) {
              expect(err).to.deep.equal({ id: [ 'ID must be an integer!' ] })
              done()
            })
          })
        })
      })
    })

    it('correctly validates using custom validation methods', function(done) {
      var User = this.sequelize.define('User' + config.rand(), {
        name: {
          type: Sequelize.STRING,
          validate: {
            customFn: function(val, next) {
              if (val !== "2") {
                next("name should equal '2'")
              } else {
                next()
              }
            }
          }
        }
      })

      var failingUser = User.build({ name : "3" })

      failingUser.validate().success(function(errors) {
        expect(errors).to.deep.equal({ name: ["name should equal '2'"] })

         var successfulUser = User.build({ name : "2" })
        successfulUser.validate().success(function() {
          expect(arguments).to.have.length(0)
          done()
        }).error(function(err) {
          expect(err).to.deep.equal({})
          done()
        })
      })
    })

    it('skips other validations if allowNull is true and the value is null', function(done) {
      var User = this.sequelize.define('User' + config.rand(), {
        age: {
          type: Sequelize.INTEGER,
          allowNull: true,
          validate: {
            min: { args: 0, msg: 'must be positive' }
          }
        }
      })

      User
        .build({ age: -1 })
        .validate()
        .success(function(errors) {
          expect(errors).not.to.be.null
          expect(errors).to.deep.equal({ age: ['must be positive'] })

          User.build({ age: null }).validate().success(function() {
            User.build({ age: 1 }).validate().success(function() {
              done()
            })
          })
        })
    })

    it('validates a model with custom model-wide validation methods', function(done) {
      var Foo = this.sequelize.define('Foo' + config.rand(), {
        field1: {
          type: Sequelize.INTEGER,
          allowNull: true
        },
        field2: {
          type: Sequelize.INTEGER,
          allowNull: true
        }
      }, {
        validate: {
          xnor: function(done) {
            if ((this.field1 === null) === (this.field2 === null)) {
              done('xnor failed')
            } else {
              done()
            }
          }
        }
      })

      Foo
        .build({ field1: null, field2: null })
        .validate()
        .success(function(errors) {
          expect(errors).not.to.be.null
          expect(errors).to.deep.equal({ 'xnor': ['xnor failed'] })

          Foo
            .build({ field1: 33, field2: null })
            .validate()
            .success(function(errors) {
              expect(errors).not.exist
              done()
            })
        })
    })

    it('validates model with a validator whose arg is an Array successfully twice in a row', function(done){
      var Foo = this.sequelize.define('Foo' + config.rand(), {
        bar: {
          type: Sequelize.STRING,
          validate: {
            isIn: [['a', 'b']]
          }
        }
      }), foo

      foo = Foo.build({bar:'a'})
      foo.validate().success(function(errors){
        expect(errors).not.to.exist
        foo.validate().success(function(errors){
          expect(errors).not.to.exist
          done()
        })
      })
    })

    it('validates enums', function() {
      var values = ['value1', 'value2']

      var Bar = this.sequelize.define('Bar' + config.rand(), {
        field: {
          type: Sequelize.ENUM,
          values: values,
          validate: {
            isIn: [values]
          }
        }
      })

      var failingBar = Bar.build({ field: 'value3' })

      failingBar.validate().success(function(errors) {
        expect(errors).not.to.be.null
        expect(errors.field).to.have.length(1)
        expect(errors.field[0]).to.equal("Unexpected value or invalid argument")
      })
    })
  })
})
