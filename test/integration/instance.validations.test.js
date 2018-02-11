'use strict';

const chai = require('chai'),
  expect = chai.expect,
  Sequelize = require(__dirname + '/../../index'),
  Support = require(__dirname + '/support'),
  config = require(__dirname + '/../config/config');

describe(Support.getTestDialectTeaser('InstanceValidator'), () => {
  describe('#update', () => {
    it('should allow us to update specific columns without tripping the validations', function() {
      const User = this.sequelize.define('model', {
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

      return User.sync({ force: true }).then(() => {
        return User.create({ username: 'bob', email: 'hello@world.com' }).then(user => {
          return User
            .update({ username: 'toni' }, { where: {id: user.id }})
            .then(() => {
              return User.findById(1).then(user => {
                expect(user.username).to.equal('toni');
              });
            });
        });
      });
    });

    it('should be able to emit an error upon updating when a validation has failed from an instance', function() {
      const Model = this.sequelize.define('model', {
        name: {
          type: Sequelize.STRING,
          allowNull: false,
          validate: {
            notEmpty: true // don't allow empty strings
          }
        }
      });

      return Model.sync({ force: true }).then(() => {
        return Model.create({name: 'World'}).then(model => {
          return model.updateAttributes({name: ''}).catch(err => {
            expect(err).to.be.an.instanceOf(Error);
            expect(err.get('name')[0].message).to.equal('Validation notEmpty on name failed');
          });
        });
      });
    });

    it('should be able to emit an error upon updating when a validation has failed from the factory', function() {
      const Model = this.sequelize.define('model', {
        name: {
          type: Sequelize.STRING,
          allowNull: false,
          validate: {
            notEmpty: true // don't allow empty strings
          }
        }
      });

      return Model.sync({ force: true }).then(() => {
        return Model.create({name: 'World'}).then(() => {
          return Model.update({name: ''}, {where: {id: 1}}).catch(err => {
            expect(err).to.be.an.instanceOf(Error);
            expect(err.get('name')[0].message).to.equal('Validation notEmpty on name failed');
          });
        });
      });
    });

    it('should enforce a unique constraint', function() {
      const Model = this.sequelize.define('model', {
        uniqueName: { type: Sequelize.STRING, unique: 'uniqueName' }
      });
      const records = [
        { uniqueName: 'unique name one' },
        { uniqueName: 'unique name two' }
      ];
      return Model.sync({ force: true })
        .then(() => {
          return Model.create(records[0]);
        }).then(instance => {
          expect(instance).to.be.ok;
          return Model.create(records[1]);
        }).then(instance => {
          expect(instance).to.be.ok;
          return expect(Model.update(records[0], { where: { id: instance.id } })).to.be.rejected;
        }).then(err => {
          expect(err).to.be.an.instanceOf(Error);
          expect(err.errors).to.have.length(1);
          expect(err.errors[0].path).to.include('uniqueName');
          expect(err.errors[0].message).to.include('must be unique');
        });
    });

    it('should allow a custom unique constraint error message', function() {
      const Model = this.sequelize.define('model', {
        uniqueName: {
          type: Sequelize.STRING,
          unique: { msg: 'custom unique error message' }
        }
      });
      const records = [
        { uniqueName: 'unique name one' },
        { uniqueName: 'unique name two' }
      ];
      return Model.sync({ force: true })
        .then(() => {
          return Model.create(records[0]);
        }).then(instance => {
          expect(instance).to.be.ok;
          return Model.create(records[1]);
        }).then(instance => {
          expect(instance).to.be.ok;
          return expect(Model.update(records[0], { where: { id: instance.id } })).to.be.rejected;
        }).then(err => {
          expect(err).to.be.an.instanceOf(Error);
          expect(err.errors).to.have.length(1);
          expect(err.errors[0].path).to.include('uniqueName');
          expect(err.errors[0].message).to.equal('custom unique error message');
        });
    });

    it('should handle multiple unique messages correctly', function() {
      const Model = this.sequelize.define('model', {
        uniqueName1: {
          type: Sequelize.STRING,
          unique: { msg: 'custom unique error message 1' }
        },
        uniqueName2: {
          type: Sequelize.STRING,
          unique: { msg: 'custom unique error message 2' }
        }
      });
      const records = [
        { uniqueName1: 'unique name one', uniqueName2: 'unique name one' },
        { uniqueName1: 'unique name one', uniqueName2: 'this is ok' },
        { uniqueName1: 'this is ok', uniqueName2: 'unique name one' }
      ];
      return Model.sync({ force: true })
        .then(() => {
          return Model.create(records[0]);
        }).then(instance => {
          expect(instance).to.be.ok;
          return expect(Model.create(records[1])).to.be.rejected;
        }).then(err => {
          expect(err).to.be.an.instanceOf(Error);
          expect(err.errors).to.have.length(1);
          expect(err.errors[0].path).to.include('uniqueName1');
          expect(err.errors[0].message).to.equal('custom unique error message 1');

          return expect(Model.create(records[2])).to.be.rejected;
        }).then(err => {
          expect(err).to.be.an.instanceOf(Error);
          expect(err.errors).to.have.length(1);
          expect(err.errors[0].path).to.include('uniqueName2');
          expect(err.errors[0].message).to.equal('custom unique error message 2');
        });
    });
  });

  describe('#create', () => {
    describe('generic', () => {
      beforeEach(function() {
        const self = this;

        const Project = this.sequelize.define('Project', {
          name: {
            type: Sequelize.STRING,
            allowNull: false,
            defaultValue: 'unknown',
            validate: {
              isIn: [['unknown', 'hello', 'test']]
            }
          }
        });

        const Task = this.sequelize.define('Task', {
          something: Sequelize.INTEGER
        });

        Project.hasOne(Task);
        Task.belongsTo(Project);

        return this.sequelize.sync({ force: true }).then(() => {
          self.Project = Project;
          self.Task = Task;
        });
      });

      it('correctly throws an error using create method ', function() {
        return this.Project.create({name: 'nope'}).catch(err => {
          expect(err).to.have.ownProperty('name');
        });
      });

      it('correctly validates using create method ', function() {
        const self = this;
        return this.Project.create({}).then(project => {
          return self.Task.create({something: 1}).then(task => {
            return project.setTask(task).then(task => {
              expect(task.ProjectId).to.not.be.null;
              return task.setProject(project).then(project => {
                expect(project.ProjectId).to.not.be.null;
              });
            });
          });
        });
      });
    });

    describe('explicitly validating primary/auto incremented columns', () => {
      it('should emit an error when we try to enter in a string for the id key without validation arguments', function() {
        const User = this.sequelize.define('UserId', {
          id: {
            type: Sequelize.INTEGER,
            autoIncrement: true,
            primaryKey: true,
            validate: {
              isInt: true
            }
          }
        });

        return User.sync({ force: true }).then(() => {
          return User.create({id: 'helloworld'}).catch(err => {
            expect(err).to.be.an.instanceOf(Error);
            expect(err.get('id')[0].message).to.equal('Validation isInt on id failed');
          });
        });
      });

      it('should emit an error when we try to enter in a string for an auto increment key (not named id)', function() {
        const User = this.sequelize.define('UserId', {
          username: {
            type: Sequelize.INTEGER,
            autoIncrement: true,
            primaryKey: true,
            validate: {
              isInt: { args: true, msg: 'Username must be an integer!' }
            }
          }
        });

        return User.sync({ force: true }).then(() => {
          return User.create({username: 'helloworldhelloworld'}).catch(err => {
            expect(err).to.be.an.instanceOf(Error);
            expect(err.get('username')[0].message).to.equal('Username must be an integer!');
          });
        });
      });

      describe('primaryKey with the name as id with arguments for it\'s validatio', () => {
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
          return this.User.create({id: 'helloworld'}).catch(err => {
            expect(err).to.be.an.instanceOf(Error);
            expect(err.get('id')[0].message).to.equal('ID must be an integer!');
          });
        });

        it('should emit an error when we try to enter in a string for an auto increment key through .build().validate()', function() {
          const user = this.User.build({id: 'helloworld'});

          return expect(user.validate()).to.be.rejected.then(err => {
            expect(err.get('id')[0].message).to.equal('ID must be an integer!');
          });
        });

        it('should emit an error when we try to .save()', function() {
          const user = this.User.build({id: 'helloworld'});
          return user.save().catch(err => {
            expect(err).to.be.an.instanceOf(Error);
            expect(err.get('id')[0].message).to.equal('ID must be an integer!');
          });
        });
      });
    });

    describe('pass all paths when validating', () => {
      beforeEach(function() {
        const self = this;
        const Project = this.sequelize.define('Project', {
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

        const Task = this.sequelize.define('Task', {
          something: Sequelize.INTEGER
        });

        Project.hasOne(Task);
        Task.belongsTo(Project);

        return Project.sync({ force: true }).then(() => {
          return Task.sync({ force: true }).then(() => {
            self.Project = Project;
            self.Task = Task;
          });
        });
      });

      it('produce 3 errors', function() {
        return this.Project.create({}).catch(err => {
          expect(err).to.be.an.instanceOf(Error);
          delete err.stack; // longStackTraces
          expect(err.errors).to.have.length(3);
        });
      });
    });

    describe('not null schema validation', () => {
      beforeEach(function() {
        const Project = this.sequelize.define('Project', {
          name: {
            type: Sequelize.STRING,
            allowNull: false,
            validate: {
              isIn: [['unknown', 'hello', 'test']] // important to be
            }
          }
        });

        return this.sequelize.sync({ force: true }).then(() => {
          this.Project = Project;
        });
      });

      it('correctly throws an error using create method ', function() {
        return this.Project.create({})
          .then(() => {
            throw new Error('Validation must be failed');
          }, () => {
            // fail is ok
          });
      });

      it('correctly throws an error using create method with default generated messages', function() {
        return this.Project.create({}).catch(err => {
          expect(err).to.have.property('name', 'SequelizeValidationError');
          expect(err.message).equal('notNull Violation: Project.name cannot be null');
          expect(err.errors).to.be.an('array').and.have.length(1);
          expect(err.errors[0]).to.have.property('message', 'Project.name cannot be null');
        });
      });
    });
  });

  it('correctly validates using custom validation methods', function() {
    const User = this.sequelize.define('User' + config.rand(), {
      name: {
        type: Sequelize.STRING,
        validate: {
          customFn(val, next) {
            if (val !== '2') {
              next("name should equal '2'");
            } else {
              next();
            }
          }
        }
      }
    });

    const failingUser = User.build({ name: '3' });

    return expect(failingUser.validate()).to.be.rejected.then(error => {
      expect(error).to.be.an.instanceOf(Error);
      expect(error.get('name')[0].message).to.equal("name should equal '2'");

      const successfulUser = User.build({ name: '2' });
      return expect(successfulUser.validate()).not.to.be.rejected;
    });
  });

  it('supports promises with custom validation methods', function() {
    const self = this,
      User = this.sequelize.define('User' + config.rand(), {
        name: {
          type: Sequelize.STRING,
          validate: {
            customFn(val) {
              return User.findAll()
                .then(() => {
                  if (val === 'error') {
                    throw new Error('Invalid username');
                  }
                });
            }
          }
        }
      });

    return User.sync().then(() => {
      return expect(User.build({ name: 'error' }).validate()).to.be.rejected.then(error => {
        expect(error).to.be.instanceof(self.sequelize.ValidationError);
        expect(error.get('name')[0].message).to.equal('Invalid username');

        return expect(User.build({ name: 'no error' }).validate()).not.to.be.rejected;
      });
    });
  });

  it('skips other validations if allowNull is true and the value is null', function() {
    const User = this.sequelize.define('User' + config.rand(), {
      age: {
        type: Sequelize.INTEGER,
        allowNull: true,
        validate: {
          min: { args: 0, msg: 'must be positive' }
        }
      }
    });

    return expect(User
      .build({ age: -1 })
      .validate())
      .to.be.rejected
      .then(error => {
        expect(error.get('age')[0].message).to.equal('must be positive');
      });
  });

  it('validates a model with custom model-wide validation methods', function() {
    const Foo = this.sequelize.define('Foo' + config.rand(), {
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
        xnor() {
          if (this.field1 === null === (this.field2 === null)) {
            throw new Error('xnor failed');
          }
        }
      }
    });

    return expect(Foo
      .build({ field1: null, field2: null })
      .validate())
      .to.be.rejected
      .then(error => {
        expect(error.get('xnor')[0].message).to.equal('xnor failed');

        return expect(Foo
          .build({ field1: 33, field2: null })
          .validate())
          .not.to.be.rejected;
      });
  });

  it('validates model with a validator whose arg is an Array successfully twice in a row', function() {
    const Foo = this.sequelize.define('Foo' + config.rand(), {
        bar: {
          type: Sequelize.STRING,
          validate: {
            isIn: [['a', 'b']]
          }
        }
      }),
      foo = Foo.build({bar: 'a'});
    return expect(foo.validate()).not.to.be.rejected.then(() => {
      return expect(foo.validate()).not.to.be.rejected;
    });
  });

  it('validates enums', function() {
    const values = ['value1', 'value2'];

    const Bar = this.sequelize.define('Bar' + config.rand(), {
      field: {
        type: Sequelize.ENUM,
        values,
        validate: {
          isIn: [values]
        }
      }
    });

    const failingBar = Bar.build({ field: 'value3' });

    return expect(failingBar.validate()).to.be.rejected.then(errors => {
      expect(errors.get('field')).to.have.length(1);
      expect(errors.get('field')[0].message).to.equal('Validation isIn on field failed');
    });
  });

  it('skips validations for the given fields', function() {
    const values = ['value1', 'value2'];

    const Bar = this.sequelize.define('Bar' + config.rand(), {
      field: {
        type: Sequelize.ENUM,
        values,
        validate: {
          isIn: [values]
        }
      }
    });

    const failingBar = Bar.build({ field: 'value3' });

    return expect(failingBar.validate({ skip: ['field'] })).not.to.be.rejected;
  });

  it('raises an error if saving a different value into an immutable field', function() {
    const User = this.sequelize.define('User', {
      name: {
        type: Sequelize.STRING,
        validate: {
          isImmutable: true
        }
      }
    });

    return User.sync({force: true}).then(() => {
      return User.create({ name: 'RedCat' }).then(user => {
        expect(user.getDataValue('name')).to.equal('RedCat');
        user.setDataValue('name', 'YellowCat');
        return expect(user.save()).to.be.rejected.then(errors => {
          expect(errors.get('name')[0].message).to.eql('Validation isImmutable on name failed');
        });
      });
    });
  });

  it('allows setting an immutable field if the record is unsaved', function() {
    const User = this.sequelize.define('User', {
      name: {
        type: Sequelize.STRING,
        validate: {
          isImmutable: true
        }
      }
    });

    const user = User.build({ name: 'RedCat' });
    expect(user.getDataValue('name')).to.equal('RedCat');

    user.setDataValue('name', 'YellowCat');
    return expect(user.validate()).not.to.be.rejected;
  });

  it('raises an error for array on a STRING', function() {
    const User = this.sequelize.define('User', {
      'email': {
        type: Sequelize.STRING
      }
    });

    return expect(User.build({
      email: ['iama', 'dummy.com']
    }).validate()).to.be.rejectedWith(Sequelize.ValidationError);
  });

  it('raises an error for array on a STRING(20)', function() {
    const User = this.sequelize.define('User', {
      'email': {
        type: Sequelize.STRING(20)
      }
    });

    return expect(User.build({
      email: ['iama', 'dummy.com']
    }).validate()).to.be.rejectedWith(Sequelize.ValidationError);
  });

  it('raises an error for array on a TEXT', function() {
    const User = this.sequelize.define('User', {
      'email': {
        type: Sequelize.TEXT
      }
    });

    return expect(User.build({
      email: ['iama', 'dummy.com']
    }).validate()).to.be.rejectedWith(Sequelize.ValidationError);
  });

  it('raises an error for {} on a STRING', function() {
    const User = this.sequelize.define('User', {
      'email': {
        type: Sequelize.STRING
      }
    });

    return expect(User.build({
      email: {lol: true}
    }).validate()).to.be.rejectedWith(Sequelize.ValidationError);
  });

  it('raises an error for {} on a STRING(20)', function() {
    const User = this.sequelize.define('User', {
      'email': {
        type: Sequelize.STRING(20)
      }
    });

    return expect(User.build({
      email: {lol: true}
    }).validate()).to.be.rejectedWith(Sequelize.ValidationError);
  });

  it('raises an error for {} on a TEXT', function() {
    const User = this.sequelize.define('User', {
      'email': {
        type: Sequelize.TEXT
      }
    });

    return expect(User.build({
      email: {lol: true}
    }).validate()).to.be.rejectedWith(Sequelize.ValidationError);
  });

  it('does not raise an error for null on a STRING (where null is allowed)', function() {
    const User = this.sequelize.define('User', {
      'email': {
        type: Sequelize.STRING
      }
    });

    return expect(User.build({
      email: null
    }).validate()).not.to.be.rejected;
  });

  it('validates VIRTUAL fields', function() {
    const User = this.sequelize.define('user', {
      password_hash: Sequelize.STRING,
      salt: Sequelize.STRING,
      password: {
        type: Sequelize.VIRTUAL,
        set(val) {
          this.setDataValue('password', val);
          this.setDataValue('password_hash', this.salt + val);
        },
        validate: {
          isLongEnough(val) {
            if (val.length < 7) {
              throw new Error('Please choose a longer password');
            }
          }
        }
      }
    });

    return Sequelize.Promise.all([
      expect(User.build({
        password: 'short',
        salt: '42'
      }).validate()).to.be.rejected.then(errors => {
        expect(errors.get('password')[0].message).to.equal('Please choose a longer password');
      }),
      expect(User.build({
        password: 'loooooooong',
        salt: '42'
      }).validate()).not.to.be.rejected
    ]);
  });

  it('allows me to add custom validation functions to validator.js', function() {
    this.sequelize.Validator.extend('isExactly7Characters', val => {
      return val.length === 7;
    });

    const User = this.sequelize.define('User', {
      name: {
        type: Sequelize.STRING,
        validate: {
          isExactly7Characters: true
        }
      }
    });

    return expect(User.build({
      name: 'abcdefg'
    }).validate()).not.to.be.rejected.then(() => {
      return expect(User.build({
        name: 'a'
      }).validate()).to.be.rejected;
    }).then(errors => {
      expect(errors.get('name')[0].message).to.equal('Validation isExactly7Characters on name failed');
    });
  });
});
