'use strict';

/* jshint -W030 */
/* jshint -W110 */
var chai = require('chai')
  , expect = chai.expect
  , Sequelize = require(__dirname + '/../../index')
  , Support = require(__dirname + '/support')
  , config = require(__dirname + '/../config/config');

describe(Support.getTestDialectTeaser('InstanceValidator'), function() {
  describe('#update', function() {
    it('should allow us to update specific columns without tripping the validations', function() {
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

      return User.sync({ force: true }).then(function() {
        return User.create({ username: 'bob', email: 'hello@world.com' }).then(function(user) {
          return User
            .update({ username: 'toni' }, { where: {id: user.id }})
            .then(function() {
              return User.findById(1).then(function(user) {
                expect(user.username).to.equal('toni');
              });
            });
        });
      });
    });

    it('should be able to emit an error upon updating when a validation has failed from an instance', function() {
      var Model = this.sequelize.define('model', {
        name: {
          type: Sequelize.STRING,
          allowNull: false,
          validate: {
            notEmpty: true // don't allow empty strings
          }
        }
      });

      return Model.sync({ force: true }).then(function() {
        return Model.create({name: 'World'}).then(function(model) {
          return model.updateAttributes({name: ''}).catch(function(err) {
            expect(err).to.be.an.instanceOf(Error);
            expect(err.get('name')[0].message).to.equal('Validation notEmpty failed');
          });
        });
      });
    });

    it('should be able to emit an error upon updating when a validation has failed from the factory', function() {
      var Model = this.sequelize.define('model', {
        name: {
          type: Sequelize.STRING,
          allowNull: false,
          validate: {
            notEmpty: true // don't allow empty strings
          }
        }
      });

      return Model.sync({ force: true }).then(function() {
        return Model.create({name: 'World'}).then(function() {
          return Model.update({name: ''}, {where: {id: 1}}).catch(function(err) {
            expect(err).to.be.an.instanceOf(Error);
            expect(err.get('name')[0].message).to.equal('Validation notEmpty failed');
          });
        });
      });
    });

    it('should enforce a unique constraint', function() {
      var Model = this.sequelize.define('model', {
        uniqueName: { type: Sequelize.STRING, unique: true }
      });
      var records = [
        { uniqueName: 'unique name one' },
        { uniqueName: 'unique name two' }
      ];
      return Model.sync({ force: true })
        .then(function() {
          return Model.create(records[0]);
        }).then(function(instance) {
          expect(instance).to.be.ok;
          return Model.create(records[1]);
        }).then(function(instance) {
          expect(instance).to.be.ok;
          return expect(Model.update(records[0], { where: { id: instance.id } })).to.be.rejected;
        }).then(function(err) {
          expect(err).to.be.an.instanceOf(Error);
          expect(err.errors).to.have.length(1);
          expect(err.errors[0].path).to.include('uniqueName');
          expect(err.errors[0].message).to.include('must be unique');
        });
    });

    it('should allow a custom unique constraint error message', function() {
      var Model = this.sequelize.define('model', {
        uniqueName: {
          type: Sequelize.STRING,
          unique: { msg: 'custom unique error message' }
        }
      });
      var records = [
        { uniqueName: 'unique name one' },
        { uniqueName: 'unique name two' }
      ];
      return Model.sync({ force: true })
        .then(function() {
          return Model.create(records[0]);
        }).then(function(instance) {
          expect(instance).to.be.ok;
          return Model.create(records[1]);
        }).then(function(instance) {
          expect(instance).to.be.ok;
          return expect(Model.update(records[0], { where: { id: instance.id } })).to.be.rejected;
        }).then(function(err) {
          expect(err).to.be.an.instanceOf(Error);
          expect(err.errors).to.have.length(1);
          expect(err.errors[0].path).to.include('uniqueName');
          expect(err.errors[0].message).to.equal('custom unique error message');
        });
    });

    it('should handle multiple unique messages correctly', function() {
      var Model = this.sequelize.define('model', {
        uniqueName1: {
          type: Sequelize.STRING,
          unique: { msg: 'custom unique error message 1' }
        },
        uniqueName2: {
          type: Sequelize.STRING,
          unique: { msg: 'custom unique error message 2' }
        },
      });
      var records = [
        { uniqueName1: 'unique name one', uniqueName2: 'unique name one' },
        { uniqueName1: 'unique name one', uniqueName2: 'this is ok' },
        { uniqueName1: 'this is ok', uniqueName2: 'unique name one' },
      ];
      return Model.sync({ force: true })
        .then(function() {
          return Model.create(records[0]);
        }).then(function(instance) {
          expect(instance).to.be.ok;
          return expect(Model.create(records[1])).to.be.rejected;
        }).then(function(err) {
          expect(err).to.be.an.instanceOf(Error);
          expect(err.errors).to.have.length(1);
          expect(err.errors[0].path).to.include('uniqueName1');
          expect(err.errors[0].message).to.equal('custom unique error message 1');

          return expect(Model.create(records[2])).to.be.rejected;
        }).then(function(err) {
          expect(err).to.be.an.instanceOf(Error);
          expect(err.errors).to.have.length(1);
          expect(err.errors[0].path).to.include('uniqueName2');
          expect(err.errors[0].message).to.equal('custom unique error message 2');
        });
    });
  });

  describe('#create', function() {
    describe('generic', function() {
      beforeEach(function() {
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

        return this.sequelize.sync({ force: true }).then(function() {
          self.Project = Project;
          self.Task = Task;
        });
      });

      it('correctly throws an error using create method ', function() {
        return this.Project.create({name: 'nope'}).catch(function(err) {
          expect(err).to.have.ownProperty('name');
        });
      });

      it('correctly validates using create method ', function() {
        var self = this;
        return this.Project.create({}).then(function(project) {
          return self.Task.create({something: 1}).then(function(task) {
            return project.setTask(task).then(function(task) {
              expect(task.ProjectId).to.not.be.null;
              return task.setProject(project).then(function(project) {
                expect(project.ProjectId).to.not.be.null;
              });
            });
          });
        });
      });
    });

    describe('explicitly validating primary/auto incremented columns', function() {
      it('should emit an error when we try to enter in a string for the id key without validation arguments', function() {
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

        return User.sync({ force: true }).then(function() {
          return User.create({id: 'helloworld'}).catch(function(err) {
            expect(err).to.be.an.instanceOf(Error);
            expect(err.get('id')[0].message).to.equal('Validation isInt failed');
          });
        });
      });

      it('should emit an error when we try to enter in a string for an auto increment key (not named id)', function() {
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

        return User.sync({ force: true }).then(function() {
          return User.create({username: 'helloworldhelloworld'}).catch(function(err) {
            expect(err).to.be.an.instanceOf(Error);
            expect(err.get('username')[0].message).to.equal('Username must be an integer!');
          });
        });
      });

      describe('primaryKey with the name as id with arguments for it\'s validatio', function() {
        beforeEach(function() {
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

          return this.User.sync({ force: true });
        });

        it('should emit an error when we try to enter in a string for the id key with validation arguments', function() {
          return this.User.create({id: 'helloworld'}).catch(function(err) {
            expect(err).to.be.an.instanceOf(Error);
            expect(err.get('id')[0].message).to.equal('ID must be an integer!');
          });
        });

        it('should emit an error when we try to enter in a string for an auto increment key through .build().validate()', function() {
          var user = this.User.build({id: 'helloworld'});

          return user.validate().then(function(err) {
            expect(err).to.be.an.instanceOf(Error);
            expect(err.get('id')[0].message).to.equal('ID must be an integer!');
          });
        });

        it('should emit an error when we try to .save()', function() {
          var user = this.User.build({id: 'helloworld'});
          return user.save().catch(function(err) {
            expect(err).to.be.an.instanceOf(Error);
            expect(err.get('id')[0].message).to.equal('ID must be an integer!');
          });
        });
      });
    });
    describe('Pass all paths when validating', function() {
      beforeEach(function() {
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

        return Project.sync({ force: true }).then(function() {
          return Task.sync({ force: true }).then(function() {
            self.Project = Project;
            self.Task = Task;
          });
        });
      });

      it('produce 3 errors', function() {
        return this.Project.create({}).catch(function(err) {
          expect(err).to.be.an.instanceOf(Error);
          delete err.stack; // longStackTraces
          expect(Object.keys(err)).to.have.length(3);
        });
      });
    });
  });

  it('correctly validates using custom validation methods', function() {
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

    return failingUser.validate().then(function(error) {
      expect(error).to.be.an.instanceOf(Error);
      expect(error.get('name')[0].message).to.equal("name should equal '2'");

      var successfulUser = User.build({ name: '2' });
      return successfulUser.validate().then(function(err) {
        expect(err).to.be.null;
      });
    });
  });

  it('supports promises with custom validation methods', function() {
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

    return User.sync().then(function() {
      return User.build({ name: 'error' }).validate().then(function(error)  {
        expect(error).to.be.an.instanceOf(self.sequelize.ValidationError);
        expect(error.get('name')[0].message).to.equal('Invalid username');

        return User.build({ name: 'no error' }).validate().then(function(errors) {
          expect(errors).to.be.null;
        });
      });
    });
  });

  it('skips other validations if allowNull is true and the value is null', function() {
    var User = this.sequelize.define('User' + config.rand(), {
      age: {
        type: Sequelize.INTEGER,
        allowNull: true,
        validate: {
          min: { args: 0, msg: 'must be positive' }
        }
      }
    });

    return User
      .build({ age: -1 })
      .validate()
      .then(function(error) {
        expect(error).not.to.be.null;
        expect(error).to.be.an.instanceOf(Error);
        expect(error.get('age')[0].message).to.equal('must be positive');

        // TODO: This does not test anything
        // Check what the original intention was
        return User.build({ age: null }).validate().then(function() {
          return User.build({ age: 1 }).validate();
        });
      });
  });

  it('validates a model with custom model-wide validation methods', function() {
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

    return Foo
      .build({ field1: null, field2: null })
      .validate()
      .then(function(error) {
        expect(error).not.to.be.null;
        expect(error).to.be.an.instanceOf(Error);
        expect(error.get('xnor')[0].message).to.equal('xnor failed');
        return Foo
          .build({ field1: 33, field2: null })
          .validate()
          .then(function(errors) {
            expect(errors).not.exist;
          });
      });
  });

  it('validates model with a validator whose arg is an Array successfully twice in a row', function() {
    var Foo = this.sequelize.define('Foo' + config.rand(), {
      bar: {
        type: Sequelize.STRING,
        validate: {
          isIn: [['a', 'b']]
        }
      }
    }), foo;

    foo = Foo.build({bar: 'a'});
    return foo.validate().then(function(errors) {
      expect(errors).not.to.exist;
      return foo.validate().then(function(errors) {
        expect(errors).not.to.exist;
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

    return failingBar.validate().then(function(errors) {
      expect(errors).not.to.be.null;
      expect(errors.get('field')).to.have.length(1);
      expect(errors.get('field')[0].message).to.equal('Validation isIn failed');
    });
  });

  it('skips validations for the given fields', function() {
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

    return failingBar.validate({ skip: ['field'] }).then(function(errors) {
      expect(errors).not.to.exist;
    });
  });

  it('raises an error if saving a different value into an immutable field', function() {
    var User = this.sequelize.define('User', {
      name: {
        type: Sequelize.STRING,
        validate: {
          isImmutable: true
        }
      }
    });

    return User.sync({force: true}).then(function() {
      return User.create({ name: 'RedCat' }).then(function(user) {
        expect(user.getDataValue('name')).to.equal('RedCat');
        user.setDataValue('name', 'YellowCat');
        return user.save()
          .catch(function(errors) {
            expect(errors).to.not.be.null;
            expect(errors).to.be.an.instanceOf(Error);
            expect(errors.get('name')[0].message).to.eql('Validation isImmutable failed');
          });
      });
    });
  });

  it('allows setting an immutable field if the record is unsaved', function() {
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
    return user.validate().then(function(errors) {
      expect(errors).not.to.be.ok;
    });
  });

  it('raises an error for array on a STRING', function() {
    var User = this.sequelize.define('User', {
      'email': {
        type: Sequelize.STRING
      }
    });

    return User.build({
      email: ['iama', 'dummy.com']
    }).validate().then(function(errors) {
      expect(errors).to.be.an.instanceof(Sequelize.ValidationError);
    });
  });

  it('raises an error for array on a STRING(20)', function() {
    var User = this.sequelize.define('User', {
      'email': {
        type: Sequelize.STRING(20)
      }
    });

    return User.build({
      email: ['iama', 'dummy.com']
    }).validate().then(function(errors) {
      expect(errors).to.be.an.instanceof(Sequelize.ValidationError);
    });
  });

  it('raises an error for array on a TEXT', function() {
    var User = this.sequelize.define('User', {
      'email': {
        type: Sequelize.TEXT
      }
    });

    return User.build({
      email: ['iama', 'dummy.com']
    }).validate().then(function(errors) {
      expect(errors).to.be.an.instanceof(Sequelize.ValidationError);
    });
  });

  it('raises an error for {} on a STRING', function() {
    var User = this.sequelize.define('User', {
      'email': {
        type: Sequelize.STRING
      }
    });

    return User.build({
      email: {lol: true}
    }).validate().then(function(errors) {
      expect(errors).to.be.an.instanceof(Sequelize.ValidationError);
    });
  });

  it('raises an error for {} on a STRING(20)', function() {
    var User = this.sequelize.define('User', {
      'email': {
        type: Sequelize.STRING(20)
      }
    });

    return User.build({
      email: {lol: true}
    }).validate().then(function(errors) {
      expect(errors).to.be.an.instanceof(Sequelize.ValidationError);
    });
  });

  it('raises an error for {} on a TEXT', function() {
    var User = this.sequelize.define('User', {
      'email': {
        type: Sequelize.TEXT
      }
    });

    return User.build({
      email: {lol: true}
    }).validate().then(function(errors) {
      expect(errors).to.be.an.instanceof(Sequelize.ValidationError);
    });
  });

  it('does not raise an error for null on a STRING (where null is allowed)', function() {
    var User = this.sequelize.define('User', {
      'email': {
        type: Sequelize.STRING
      }
    });

    return User.build({
      email: null
    }).validate().then(function(errors) {
      expect(errors).not.to.be.ok;
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
        expect(errors).not.to.be.null;
        expect(errors.get('password')[0].message).to.equal('Please choose a longer password');
      }),
      User.build({
        password: 'loooooooong',
        salt: '42'
      }).validate().then(function(errors) {
        expect(errors).to.be.null;
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
      expect(errors).to.be.null;

      return User.build({
        name: 'a'
      }).validate();
    }).then(function(errors) {
      expect(errors.get('name')[0].message).to.equal('Validation isExactly7Characters failed');
    });
  });
});
