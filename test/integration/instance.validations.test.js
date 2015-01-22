'use strict';

var chai = require('chai')
  , expect = chai.expect
  , Sequelize = require(__dirname + '/../../index')
  , Support = require(__dirname + '/support')
  , config = require(__dirname + '/../config/config');

chai.config.includeStack = true;

describe(Support.getTestDialectTeaser('InstanceValidator'), function() {
  describe('validations', function() {
    var checks = {
      is: {
        spec: { args: ['[a-z]', 'i'] },
        fail: '0',
        pass: 'a'
      },
      not: {
        spec: { args: ['[a-z]', 'i'] },
        fail: 'a',
        pass: '0'
      },
      isEmail: {
        fail: 'a',
        pass: 'abc@abc.com'
      }
    , isUrl: {
        fail: 'abc',
        pass: 'http://abc.com'
      }
    , isIP: {
        fail: 'abc',
        pass: '129.89.23.1'
      }
    , isIPv6: {
        fail: '1111:2222:3333::5555:',
        pass: 'fe80:0000:0000:0000:0204:61ff:fe9d:f156'
      }
    , isAlpha: {
        fail: '012',
        pass: 'abc'
      }
    , isAlphanumeric: {
        fail: '_abc019',
        pass: 'abc019'
      }
    , isNumeric: {
        fail: 'abc',
        pass: '019'
      }
    , isInt: {
        fail: '9.2',
        pass: '-9'
      }
    , isLowercase: {
        fail: 'AB',
        pass: 'ab'
      }
    , isUppercase: {
        fail: 'ab',
        pass: 'AB'
      }
    , isDecimal: {
        fail: 'a',
        pass: '0.2'
      }
    , isFloat: {
        fail: 'a',
        pass: '9.2'
      }
    , isNull: {
        fail: 0,
        pass: null
      }
    , notEmpty: {
        fail: '       ',
        pass: 'a'
      }
    , equals: {
        spec: { args: 'bla bla bla' },
        fail: 'bla',
        pass: 'bla bla bla'
      }
    , contains: {
        spec: { args: 'bla' },
        fail: 'la',
        pass: '0bla23'
      }
    , notContains: {
        spec: { args: 'bla' },
        fail: '0bla23',
        pass: 'la'
      }
    , regex: {
        spec: { args: ['[a-z]', 'i'] },
        fail: '0',
        pass: 'a'
      }
    , notRegex: {
        spec: { args: ['[a-z]', 'i'] },
        fail: 'a',
        pass: '0'
      }
    , len: {
        spec: { args: [2, 4] },
        fail: ['1', '12345'],
        pass: ['12', '123', '1234'],
        raw: true
      }
    , len$: {
        spec: [2, 4],
        fail: ['1', '12345'],
        pass: ['12', '123', '1234'],
        raw: true
      }
    , isUUID: {
        spec: { args: 4 },
        fail: 'f47ac10b-58cc-3372-a567-0e02b2c3d479',
        pass: 'f47ac10b-58cc-4372-a567-0e02b2c3d479'
      }
    , isDate: {
        fail: 'not a date',
        pass: '2011-02-04'
      }
    , isAfter: {
        spec: { args: '2011-11-05' },
        fail: '2011-11-04',
        pass: '2011-11-06'
      }
    , isBefore: {
        spec: { args: '2011-11-05' },
        fail: '2011-11-06',
        pass: '2011-11-04'
      }
    , isIn: {
        spec: { args: 'abcdefghijk' },
        fail: 'ghik',
        pass: 'ghij'
      }
    , notIn: {
        spec: { args: 'abcdefghijk' },
        fail: 'ghij',
        pass: 'ghik'
      }
    , max: {
        spec: { args: 23 },
        fail: '24',
        pass: '23'
      }
    , max$: {
        spec: 23,
        fail: '24',
        pass: '23'
      }
    , min: {
        spec: { args: 23 },
        fail: '22',
        pass: '23'
      }
    , min$: {
        spec: 23,
        fail: '22',
        pass: '23'
      }
    , isCreditCard: {
        fail: '401288888888188f',
        pass: '4012888888881881'
      }
    };

    var applyFailTest = function applyFailTest(validatorDetails, i, validator) {
        var failingValue = validatorDetails.fail[i];
        it('correctly specifies an instance as invalid using a value of "' + failingValue + '" for the validation "' + validator + '"', function(done) {
          var validations = {}
            , message = validator + '(' + failingValue + ')';

          if (validatorDetails.hasOwnProperty('spec')) {
            validations[validator] = validatorDetails.spec;
          } else {
            validations[validator] = {};
          }

          validations[validator].msg = message;

          var UserFail = this.sequelize.define('User' + config.rand(), {
            name: {
              type: Sequelize.STRING,
              validate: validations
            }
          });

          var failingUser = UserFail.build({ name: failingValue });

          failingUser.validate().done(function(err, _errors) {
            expect(_errors).not.to.be.null;
            expect(_errors).to.be.an.instanceOf(Error);
            expect(_errors.get('name')[0].message).to.equal(message);
            done();
          });
        });
      }
      , applyPassTest = function applyPassTest(validatorDetails, j, validator) {
          var succeedingValue = validatorDetails.pass[j];
          it('correctly specifies an instance as valid using a value of "' + succeedingValue + '" for the validation "' + validator + '"', function(done) {
            var validations = {};

            if (validatorDetails.hasOwnProperty('spec')) {
              validations[validator] = validatorDetails.spec;
            } else {
              validations[validator] = {};
            }

            validations[validator].msg = validator + '(' + succeedingValue + ')';

            var UserSuccess = this.sequelize.define('User' + config.rand(), {
              name: {
                type: Sequelize.STRING,
                validate: validations
              }
            });
            var successfulUser = UserSuccess.build({ name: succeedingValue });
            successfulUser.validate().success(function(errors) {
              expect(errors).to.be.undefined;
              done();
            }).error(function(err) {
              expect(err).to.deep.equal({});
              done();
            });
          });
        };

    for (var validator in checks) {
      if (checks.hasOwnProperty(validator)) {
        validator = validator.replace(/\$$/, '');
        var validatorDetails = checks[validator];

        if (!validatorDetails.hasOwnProperty('raw')) {
          validatorDetails.fail = Array.isArray(validatorDetails.fail) ? validatorDetails.fail : [validatorDetails.fail];
          validatorDetails.pass = Array.isArray(validatorDetails.pass) ? validatorDetails.pass : [validatorDetails.pass];
        }

        for (var i = 0; i < validatorDetails.fail.length; i++) {
          applyFailTest(validatorDetails, i, validator);
        }

        for (var j = 0; j < validatorDetails.pass.length; j++) {
          applyPassTest(validatorDetails, j, validator);
        }
      }
    }

    describe('#update', function() {
      it('should allow us to update specific columns without tripping the validations', function(done) {
        var User = this.sequelize.define('model', {
          username: Sequelize.STRING,
          email: {
            type: Sequelize.STRING,
            allowNull: false,
            validate: {
              isEmail: {
                msg: 'You must enter a valid email address'
              }
            }
          }
        });

        User.sync({ force: true }).success(function() {
          User.create({ username: 'bob', email: 'hello@world.com' }).success(function(user) {
            User
              .update({ username: 'toni' }, { where: {id: user.id }})
              .error(function(err) { console.log(err); })
              .success(function() {
                User.find(1).success(function(user) {
                  expect(user.username).to.equal('toni');
                  done();
                });
              });
          });
        });
      });

      it('should be able to emit an error upon updating when a validation has failed from an instance', function(done) {
        var Model = this.sequelize.define('model', {
          name: {
            type: Sequelize.STRING,
            allowNull: false,
            validate: {
              notEmpty: true // don't allow empty strings
            }
          }
        });

        Model.sync({ force: true }).success(function() {
          Model.create({name: 'World'}).success(function(model) {
            model.updateAttributes({name: ''}).error(function(err) {
              expect(err).to.be.an.instanceOf(Error);
              expect(err.get('name')[0].message).to.equal('Validation notEmpty failed');
              done();
            });
          });
        });
      });

      it('should be able to emit an error upon updating when a validation has failed from the factory', function(done) {
        var Model = this.sequelize.define('model', {
          name: {
            type: Sequelize.STRING,
            allowNull: false,
            validate: {
              notEmpty: true // don't allow empty strings
            }
          }
        });

        Model.sync({ force: true }).success(function() {
          Model.create({name: 'World'}).success(function() {
            Model.update({name: ''}, {where: {id: 1}}).error(function(err) {
              expect(err).to.be.an.instanceOf(Error);
              expect(err.get('name')[0].message).to.equal('Validation notEmpty failed');
              done();
            });
          });
        });
      });
    });

    describe('#create', function() {
      describe('generic', function() {
        beforeEach(function(done) {
          var self = this;

          var Project = this.sequelize.define('Project', {
            name: {
              type: Sequelize.STRING,
              allowNull: false,
              defaultValue: 'unknown',
              validate: {
                isIn: [['unknown', 'hello', 'test']]
              }
            }
          });

          var Task = this.sequelize.define('Task', {
            something: Sequelize.INTEGER
          });

          Project.hasOne(Task);
          Task.belongsTo(Project);

          this.sequelize.sync({ force: true }).success(function() {
            self.Project = Project;
            self.Task = Task;
            done();
          });
        });

        it('correctly throws an error using create method ', function(done) {
          this.Project.create({name: 'nope'}).error(function(err) {
            expect(err).to.have.ownProperty('name');
            done();
          });
        });

        it('correctly validates using create method ', function(done) {
          var self = this;
          this.Project.create({}).success(function(project) {
            self.Task.create({something: 1}).success(function(task) {
              project.setTask(task).success(function(task) {
                expect(task.ProjectId).to.not.be.null;
                task.setProject(project).success(function(project) {
                  expect(project.ProjectId).to.not.be.null;
                  done();
                });
              });
            });
          });
        });
      });

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
          });

          User.sync({ force: true }).success(function() {
            User.create({id: 'helloworld'}).error(function(err) {
              expect(err).to.be.an.instanceOf(Error);
              expect(err.get('id')[0].message).to.equal('Validation isInt failed');
              done();
            });
          });
        });

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
          });

          User.sync({ force: true }).success(function() {
            User.create({username: 'helloworldhelloworld'}).error(function(err) {
              expect(err).to.be.an.instanceOf(Error);
              expect(err.get('username')[0].message).to.equal('Username must be an integer!');
              done();
            });
          });
        });

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
            });

            this.User.sync({ force: true }).success(function() {
              done();
            });
          });

          it('should emit an error when we try to enter in a string for the id key with validation arguments', function(done) {
            this.User.create({id: 'helloworld'}).error(function(err) {
              expect(err).to.be.an.instanceOf(Error);
              expect(err.get('id')[0].message).to.equal('ID must be an integer!');
              done();
            });
          });

          it('should emit an error when we try to enter in a string for an auto increment key through .build().validate()', function(done) {
            var user = this.User.build({id: 'helloworld'});

            user.validate().success(function(err) {
              expect(err).to.be.an.instanceOf(Error);
              expect(err.get('id')[0].message).to.equal('ID must be an integer!');
              done();
            });
          });

          it('should emit an error when we try to .save()', function(done) {
            var user = this.User.build({id: 'helloworld'});
            user.save().error(function(err) {
              expect(err).to.be.an.instanceOf(Error);
              expect(err.get('id')[0].message).to.equal('ID must be an integer!');
              done();
            });
          });
        });
      });
      describe('Pass all paths when validating', function() {
        beforeEach(function(done) {
          var self = this;
          var Project = this.sequelize.define('Project', {
            name: {
              type: Sequelize.STRING,
              allowNull: false,
              validate: {
                isIn: [['unknown', 'hello', 'test']]
              }
            },
            creatorName: {
              type: Sequelize.STRING,
              allowNull: false
            },
            cost: {
              type: Sequelize.INTEGER,
              allowNull: false
            }

          });

          var Task = this.sequelize.define('Task', {
            something: Sequelize.INTEGER
          });

          Project.hasOne(Task);
          Task.belongsTo(Project);

          Project.sync({ force: true }).success(function() {
            Task.sync({ force: true }).success(function() {
              self.Project = Project;
              self.Task = Task;
              done();
            });
          });
        });

        it('produce 3 errors', function(done) {
          this.Project.create({}).error(function(err) {
            expect(err).to.be.an.instanceOf(Error);
            delete err.stack; // longStackTraces
            expect(Object.keys(err)).to.have.length(3);
            done();
          });
        });
      });
    });

    it('correctly validates using custom validation methods', function(done) {
      var User = this.sequelize.define('User' + config.rand(), {
        name: {
          type: Sequelize.STRING,
          validate: {
            customFn: function(val, next) {
              if (val !== '2') {
                next("name should equal '2'");
              } else {
                next();
              }
            }
          }
        }
      });

      var failingUser = User.build({ name: '3' });

      failingUser.validate().success(function(error) {
        expect(error).to.be.an.instanceOf(Error);

        expect(error.get('name')[0].message).to.equal("name should equal '2'");

        var successfulUser = User.build({ name: '2' });
        successfulUser.validate().success(function(err) {
          expect(err).not.to.be.defined;
          done();
        });
      });
    });

    it('supports promises with custom validation methods', function(done) {
      var self = this
        , User = this.sequelize.define('User' + config.rand(), {
          name: {
            type: Sequelize.STRING,
            validate: {
              customFn: function(val) {
                return User.findAll()
                  .then(function() {
                    if (val === 'error') {
                      throw new Error('Invalid username');
                    }
                  });
              }
            }
          }
        });

      User.sync().success(function() {
        User.build({ name: 'error' }).validate().success(function(error)  {
          expect(error).to.be.an.instanceOf(self.sequelize.ValidationError);
          expect(error.get('name')[0].message).to.equal('Invalid username');

          User.build({ name: 'no error' }).validate().success(function(errors) {
            expect(errors).not.to.be.defined;
            done();
          });
        });
      });
    });

    it('skips other validations if allowNull is true and the value is null', function(done) {
      var User = this.sequelize.define('User' + config.rand(), {
        age: {
          type: Sequelize.INTEGER,
          allowNull: true,
          validate: {
            min: { args: 0, msg: 'must be positive' }
          }
        }
      });

      User
        .build({ age: -1 })
        .validate()
        .success(function(error) {
          expect(error).not.to.be.null;
          expect(error).to.be.an.instanceOf(Error);
          expect(error.get('age')[0].message).to.equal('must be positive');

          User.build({ age: null }).validate().success(function() {
            User.build({ age: 1 }).validate().success(function() {
              done();
            });
          });
        });
    });

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
              done('xnor failed');
            } else {
              done();
            }
          }
        }
      });

      Foo
        .build({ field1: null, field2: null })
        .validate()
        .success(function(error) {
          expect(error).not.to.be.null;
          expect(error).to.be.an.instanceOf(Error);
          expect(error.get('xnor')[0].message).to.equal('xnor failed');
          Foo
            .build({ field1: 33, field2: null })
            .validate()
            .success(function(errors) {
              expect(errors).not.exist;
              done();
            });
        });
    });

    it('validates a model with no async callback', function(done) {
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
          xnor: function() {
            if ((this.field1 === null) === (this.field2 === null)) {
              throw new Error('xnor failed');
            }
          }
        }
      });

      Foo
        .build({ field1: null, field2: null })
        .validate()
        .success(function(error) {
          expect(error).not.to.be.null;
          expect(error).to.be.an.instanceOf(Error);
          expect(error.get('xnor')[0].message).to.equal('xnor failed');

          Foo
            .build({ field1: 33, field2: null })
            .validate()
            .success(function(errors) {
              expect(errors).not.exist;
              done();
            });
        });
    });

    it('validates model with a validator whose arg is an Array successfully twice in a row', function(done) {
      var Foo = this.sequelize.define('Foo' + config.rand(), {
        bar: {
          type: Sequelize.STRING,
          validate: {
            isIn: [['a', 'b']]
          }
        }
      }), foo;

      foo = Foo.build({bar: 'a'});
      foo.validate().success(function(errors) {
        expect(errors).not.to.exist;
        foo.validate().success(function(errors) {
          expect(errors).not.to.exist;
          done();
        });
      });
    });

    it('validates enums', function() {
      var values = ['value1', 'value2'];

      var Bar = this.sequelize.define('Bar' + config.rand(), {
        field: {
          type: Sequelize.ENUM,
          values: values,
          validate: {
            isIn: [values]
          }
        }
      });

      var failingBar = Bar.build({ field: 'value3' });

      failingBar.validate().success(function(errors) {
        expect(errors).not.to.be.null;
        expect(errors.get('field')).to.have.length(1);
        expect(errors.get('field')[0].message).to.equal('Validation isIn failed');
      });
    });

    it('skips validations for the given fields', function(done) {
      var values = ['value1', 'value2'];

      var Bar = this.sequelize.define('Bar' + config.rand(), {
        field: {
          type: Sequelize.ENUM,
          values: values,
          validate: {
            isIn: [values]
          }
        }
      });

      var failingBar = Bar.build({ field: 'value3' });

      failingBar.validate({ skip: ['field'] }).success(function(errors) {
        expect(errors).not.to.exist;
        done();
      });
    });

    it('skips validation when asked', function() {
      var values = ['value1', 'value2'];
      var Bar = this.sequelize.define('Bar' + config.rand(), {
        field: {
          type: Sequelize.ENUM,
          values: values,
          validate: {
            isIn: [values]
          }
        }
      });

      return Bar.sync({force: true}).then(function() {
        return Bar.create({ field: 'value3' }, {validate: false})
          .catch(Sequelize.DatabaseError, function() {
          });
      });
    });

    it('raises an error if saving a different value into an immutable field', function(done) {
      var User = this.sequelize.define('User', {
        name: {
          type: Sequelize.STRING,
          validate: {
            isImmutable: true
          }
        }
      });

      User.sync({force: true}).success(function() {
        User.create({ name: 'RedCat' }).success(function(user) {
          expect(user.getDataValue('name')).to.equal('RedCat');
          user.setDataValue('name', 'YellowCat');
          user.save()
            .done(function(errors) {
              expect(errors).to.not.be.null;
              expect(errors).to.be.an.instanceOf(Error);
              expect(errors.get('name')[0].message).to.eql('Validation isImmutable failed');
              done();
            });
        });
      });
    });

    it('allows setting an immutable field if the record is unsaved', function(done) {
      var User = this.sequelize.define('User', {
        name: {
          type: Sequelize.STRING,
          validate: {
            isImmutable: true
          }
        }
      });

      var user = User.build({ name: 'RedCat' });
      expect(user.getDataValue('name')).to.equal('RedCat');

      user.setDataValue('name', 'YellowCat');
      user.validate().success(function(errors) {
        expect(errors).not.to.be.ok;
        done();
      });
    });

    it('raises an error for array on a STRING', function(done) {
      var User = this.sequelize.define('User', {
        'email': {
          type: Sequelize.STRING
        }
      });

      User.build({
        email: ['iama', 'dummy.com']
      }).validate().success(function(errors) {
        expect(errors).to.be.an.instanceof(Sequelize.ValidationError);
        done();
      });
    });

    it('raises an error for array on a STRING(20)', function(done) {
      var User = this.sequelize.define('User', {
        'email': {
          type: Sequelize.STRING(20)
        }
      });

      User.build({
        email: ['iama', 'dummy.com']
      }).validate().success(function(errors) {
        expect(errors).to.be.an.instanceof(Sequelize.ValidationError);
        done();
      });
    });

    it('raises an error for array on a TEXT', function(done) {
      var User = this.sequelize.define('User', {
        'email': {
          type: Sequelize.TEXT
        }
      });

      User.build({
        email: ['iama', 'dummy.com']
      }).validate().success(function(errors) {
        expect(errors).to.be.an.instanceof(Sequelize.ValidationError);
        done();
      });
    });

    it('raises an error for {} on a STRING', function(done) {
      var User = this.sequelize.define('User', {
        'email': {
          type: Sequelize.STRING
        }
      });

      User.build({
        email: {lol: true}
      }).validate().success(function(errors) {
        expect(errors).to.be.an.instanceof(Sequelize.ValidationError);
        done();
      });
    });

    it('raises an error for {} on a STRING(20)', function(done) {
      var User = this.sequelize.define('User', {
        'email': {
          type: Sequelize.STRING(20)
        }
      });

      User.build({
        email: {lol: true}
      }).validate().success(function(errors) {
        expect(errors).to.be.an.instanceof(Sequelize.ValidationError);
        done();
      });
    });

    it('raises an error for {} on a TEXT', function(done) {
      var User = this.sequelize.define('User', {
        'email': {
          type: Sequelize.TEXT
        }
      });

      User.build({
        email: {lol: true}
      }).validate().success(function(errors) {
        expect(errors).to.be.an.instanceof(Sequelize.ValidationError);
        done();
      });
    });

    it('does not raise an error for null on a STRING (where null is allowed)', function(done) {
      var User = this.sequelize.define('User', {
        'email': {
          type: Sequelize.STRING
        }
      });

      User.build({
        email: null
      }).validate().success(function(errors) {
        expect(errors).not.to.be.ok;
        done();
      });
    });

    it('validates VIRTUAL fields', function() {
      var User = this.sequelize.define('user', {
        password_hash: Sequelize.STRING,
        salt: Sequelize.STRING,
        password: {
          type: Sequelize.VIRTUAL,
          set: function(val) {
            this.setDataValue('password', val);
            this.setDataValue('password_hash', this.salt + val);
          },
          validate: {
            isLongEnough: function(val) {
              if (val.length < 7) {
                throw new Error('Please choose a longer password');
              }
            }
          }
        }
      });

      return Sequelize.Promise.all([
        User.build({
          password: 'short',
          salt: '42'
        }).validate().then(function(errors) {
          expect(errors).not.to.be.undefined;
          expect(errors.get('password')[0].message).to.equal('Please choose a longer password');
        }),
        User.build({
          password: 'loooooooong',
          salt: '42'
        }).validate().then(function(errors) {
          expect(errors).to.be.undefined;
        })
      ]);
    });

    it('allows me to add custom validation functions to validator.js', function() {
      this.sequelize.Validator.extend('isExactly7Characters', function(val) {
        return val.length === 7;
      });

      var User = this.sequelize.define('User', {
        name: {
          type: Sequelize.STRING,
          validate: {
            isExactly7Characters: true
          }
        }
      });

      return User.build({
        name: 'abcdefg'
      }).validate().then(function(errors) {
        expect(errors === undefined).to.be.ok;

        return User.build({
          name: 'a'
        }).validate();
      }).then(function(errors) {
        expect(errors.get('name')[0].message).to.equal('Validation isExactly7Characters failed');
      });
    });
  });
});
