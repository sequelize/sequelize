'use strict';

const chai = require('chai'),
  expect = chai.expect,
  Sequelize = require('../../index'),
  Support = require('./support');

describe(Support.getTestDialectTeaser('InstanceValidator'), () => {
  describe('#update', () => {
    it('should allow us to update specific columns without tripping the validations', async function() {
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

      await User.sync({ force: true });
      const user = await User.create({ username: 'bob', email: 'hello@world.com' });

      await User
        .update({ username: 'toni' }, { where: { id: user.id } });

      const user0 = await User.findByPk(1);
      expect(user0.username).to.equal('toni');
    });

    it('should be able to emit an error upon updating when a validation has failed from an instance', async function() {
      const Model = this.sequelize.define('model', {
        name: {
          type: Sequelize.STRING,
          allowNull: false,
          validate: {
            notEmpty: true // don't allow empty strings
          }
        }
      });

      await Model.sync({ force: true });
      const model = await Model.create({ name: 'World' });

      try {
        await model.update({ name: '' });
      } catch (err) {
        expect(err).to.be.an.instanceOf(Error);
        expect(err.get('name')[0].message).to.equal('Validation notEmpty on name failed');
      }
    });

    it('should be able to emit an error upon updating when a validation has failed from the factory', async function() {
      const Model = this.sequelize.define('model', {
        name: {
          type: Sequelize.STRING,
          allowNull: false,
          validate: {
            notEmpty: true // don't allow empty strings
          }
        }
      });

      await Model.sync({ force: true });
      await Model.create({ name: 'World' });

      try {
        await Model.update({ name: '' }, { where: { id: 1 } });
      } catch (err) {
        expect(err).to.be.an.instanceOf(Error);
        expect(err.get('name')[0].message).to.equal('Validation notEmpty on name failed');
      }
    });

    it('should enforce a unique constraint', async function() {
      const Model = this.sequelize.define('model', {
        uniqueName: { type: Sequelize.STRING, unique: 'uniqueName' }
      });
      const records = [
        { uniqueName: 'unique name one' },
        { uniqueName: 'unique name two' }
      ];
      await Model.sync({ force: true });
      const instance0 = await Model.create(records[0]);
      expect(instance0).to.be.ok;
      const instance = await Model.create(records[1]);
      expect(instance).to.be.ok;
      const err = await expect(Model.update(records[0], { where: { id: instance.id } })).to.be.rejected;
      expect(err).to.be.an.instanceOf(Error);
      expect(err.errors).to.have.length(1);
      expect(err.errors[0].path).to.include('uniqueName');
      expect(err.errors[0].message).to.include('must be unique');
    });

    it('should allow a custom unique constraint error message', async function() {
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
      await Model.sync({ force: true });
      const instance0 = await Model.create(records[0]);
      expect(instance0).to.be.ok;
      const instance = await Model.create(records[1]);
      expect(instance).to.be.ok;
      const err = await expect(Model.update(records[0], { where: { id: instance.id } })).to.be.rejected;
      expect(err).to.be.an.instanceOf(Error);
      expect(err.errors).to.have.length(1);
      expect(err.errors[0].path).to.include('uniqueName');
      expect(err.errors[0].message).to.equal('custom unique error message');
    });

    it('should handle multiple unique messages correctly', async function() {
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
      await Model.sync({ force: true });
      const instance = await Model.create(records[0]);
      expect(instance).to.be.ok;
      const err0 = await expect(Model.create(records[1])).to.be.rejected;
      expect(err0).to.be.an.instanceOf(Error);
      expect(err0.errors).to.have.length(1);
      expect(err0.errors[0].path).to.include('uniqueName1');
      expect(err0.errors[0].message).to.equal('custom unique error message 1');

      const err = await expect(Model.create(records[2])).to.be.rejected;
      expect(err).to.be.an.instanceOf(Error);
      expect(err.errors).to.have.length(1);
      expect(err.errors[0].path).to.include('uniqueName2');
      expect(err.errors[0].message).to.equal('custom unique error message 2');
    });
  });

  describe('#create', () => {
    describe('generic', () => {
      beforeEach(async function() {
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

        await this.sequelize.sync({ force: true });
        this.Project = Project;
        this.Task = Task;
      });

      it('correctly throws an error using create method ', async function() {
        try {
          await this.Project.create({ name: 'nope' });
        } catch (err) {
          expect(err).to.have.ownProperty('name');
        }
      });

      it('correctly validates using create method ', async function() {
        const project = await this.Project.create({});
        const task = await this.Task.create({ something: 1 });
        const task0 = await project.setTask(task);
        expect(task0.ProjectId).to.not.be.null;
        const project0 = await task0.setProject(project);
        expect(project0.ProjectId).to.not.be.null;
      });
    });

    describe('explicitly validating primary/auto incremented columns', () => {
      it('should emit an error when we try to enter in a string for the id key without validation arguments', async function() {
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

        await User.sync({ force: true });

        try {
          await User.create({ id: 'helloworld' });
        } catch (err) {
          expect(err).to.be.an.instanceOf(Error);
          expect(err.get('id')[0].message).to.equal('Validation isInt on id failed');
        }
      });

      it('should emit an error when we try to enter in a string for an auto increment key (not named id)', async function() {
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

        await User.sync({ force: true });

        try {
          await User.create({ username: 'helloworldhelloworld' });
        } catch (err) {
          expect(err).to.be.an.instanceOf(Error);
          expect(err.get('username')[0].message).to.equal('Username must be an integer!');
        }
      });

      describe('primaryKey with the name as id with arguments for it\'s validatio', () => {
        beforeEach(async function() {
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

          await this.User.sync({ force: true });
        });

        it('should emit an error when we try to enter in a string for the id key with validation arguments', async function() {
          try {
            await this.User.create({ id: 'helloworld' });
          } catch (err) {
            expect(err).to.be.an.instanceOf(Error);
            expect(err.get('id')[0].message).to.equal('ID must be an integer!');
          }
        });

        it('should emit an error when we try to enter in a string for an auto increment key through .build().validate()', async function() {
          const user = this.User.build({ id: 'helloworld' });

          const err = await expect(user.validate()).to.be.rejected;
          expect(err.get('id')[0].message).to.equal('ID must be an integer!');
        });

        it('should emit an error when we try to .save()', async function() {
          const user = this.User.build({ id: 'helloworld' });

          try {
            await user.save();
          } catch (err) {
            expect(err).to.be.an.instanceOf(Error);
            expect(err.get('id')[0].message).to.equal('ID must be an integer!');
          }
        });
      });
    });

    describe('pass all paths when validating', () => {
      beforeEach(async function() {
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

        await Project.sync({ force: true });
        await Task.sync({ force: true });
        this.Project = Project;
        this.Task = Task;
      });

      it('produce 3 errors', async function() {
        try {
          await this.Project.create({});
        } catch (err) {
          expect(err).to.be.an.instanceOf(Error);
          delete err.stack; // longStackTraces
          expect(err.errors).to.have.length(3);
        }
      });
    });

    describe('not null schema validation', () => {
      beforeEach(async function() {
        const Project = this.sequelize.define('Project', {
          name: {
            type: Sequelize.STRING,
            allowNull: false,
            validate: {
              isIn: [['unknown', 'hello', 'test']] // important to be
            }
          }
        });

        await this.sequelize.sync({ force: true });
        this.Project = Project;
      });

      it('correctly throws an error using create method ', async function() {
        await this.Project.create({})
          .then(() => {
            throw new Error('Validation must be failed');
          }, () => {
            // fail is ok
          });
      });

      it('correctly throws an error using create method with default generated messages', async function() {
        try {
          await this.Project.create({});
        } catch (err) {
          expect(err).to.have.property('name', 'SequelizeValidationError');
          expect(err.message).equal('notNull Violation: Project.name cannot be null');
          expect(err.errors).to.be.an('array').and.have.length(1);
          expect(err.errors[0]).to.have.property('message', 'Project.name cannot be null');
        }
      });
    });
  });

  it('correctly validates using custom validation methods', async function() {
    const User = this.sequelize.define(`User${Support.rand()}`, {
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

    const error = await expect(failingUser.validate()).to.be.rejected;
    expect(error).to.be.an.instanceOf(Error);
    expect(error.get('name')[0].message).to.equal("name should equal '2'");

    const successfulUser = User.build({ name: '2' });

    await expect(successfulUser.validate()).not.to.be.rejected;
  });

  it('supports promises with custom validation methods', async function() {
    const User = this.sequelize.define(`User${Support.rand()}`, {
      name: {
        type: Sequelize.STRING,
        validate: {
          async customFn(val) {
            await User.findAll();
            if (val === 'error') {
              throw new Error('Invalid username');
            }
          }
        }
      }
    });

    await User.sync();
    const error = await expect(User.build({ name: 'error' }).validate()).to.be.rejected;
    expect(error).to.be.instanceof(Sequelize.ValidationError);
    expect(error.get('name')[0].message).to.equal('Invalid username');

    await expect(User.build({ name: 'no error' }).validate()).not.to.be.rejected;
  });

  it('skips other validations if allowNull is true and the value is null', async function() {
    const User = this.sequelize.define(`User${Support.rand()}`, {
      age: {
        type: Sequelize.INTEGER,
        allowNull: true,
        validate: {
          min: { args: 0, msg: 'must be positive' }
        }
      }
    });

    const error = await expect(User
      .build({ age: -1 })
      .validate())
      .to.be.rejected;

    expect(error.get('age')[0].message).to.equal('must be positive');
  });

  it('validates a model with custom model-wide validation methods', async function() {
    const Foo = this.sequelize.define(`Foo${Support.rand()}`, {
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

    const error = await expect(Foo
      .build({ field1: null, field2: null })
      .validate())
      .to.be.rejected;

    expect(error.get('xnor')[0].message).to.equal('xnor failed');

    await expect(Foo
      .build({ field1: 33, field2: null })
      .validate())
      .not.to.be.rejected;
  });

  it('validates model with a validator whose arg is an Array successfully twice in a row', async function() {
    const Foo = this.sequelize.define(`Foo${Support.rand()}`, {
        bar: {
          type: Sequelize.STRING,
          validate: {
            isIn: [['a', 'b']]
          }
        }
      }),
      foo = Foo.build({ bar: 'a' });
    await expect(foo.validate()).not.to.be.rejected;
    await expect(foo.validate()).not.to.be.rejected;
  });

  it('validates enums', async function() {
    const values = ['value1', 'value2'];

    const Bar = this.sequelize.define(`Bar${Support.rand()}`, {
      field: {
        type: Sequelize.ENUM,
        values,
        validate: {
          isIn: [values]
        }
      }
    });

    const failingBar = Bar.build({ field: 'value3' });

    const errors = await expect(failingBar.validate()).to.be.rejected;
    expect(errors.get('field')).to.have.length(1);
    expect(errors.get('field')[0].message).to.equal('Validation isIn on field failed');
  });

  it('skips validations for the given fields', async function() {
    const values = ['value1', 'value2'];

    const Bar = this.sequelize.define(`Bar${Support.rand()}`, {
      field: {
        type: Sequelize.ENUM,
        values,
        validate: {
          isIn: [values]
        }
      }
    });

    const failingBar = Bar.build({ field: 'value3' });

    await expect(failingBar.validate({ skip: ['field'] })).not.to.be.rejected;
  });

  it('skips validations for fields with value that is SequelizeMethod', async function() {
    const values = ['value1', 'value2'];

    const Bar = this.sequelize.define(`Bar${Support.rand()}`, {
      field: {
        type: Sequelize.ENUM,
        values,
        validate: {
          isIn: [values]
        }
      }
    });

    const failingBar = Bar.build({ field: this.sequelize.literal('5 + 1') });

    await expect(failingBar.validate()).not.to.be.rejected;
  });

  it('raises an error if saving a different value into an immutable field', async function() {
    const User = this.sequelize.define('User', {
      name: {
        type: Sequelize.STRING,
        validate: {
          isImmutable: true
        }
      }
    });

    await User.sync({ force: true });
    const user = await User.create({ name: 'RedCat' });
    expect(user.getDataValue('name')).to.equal('RedCat');
    user.setDataValue('name', 'YellowCat');
    const errors = await expect(user.save()).to.be.rejected;
    expect(errors.get('name')[0].message).to.eql('Validation isImmutable on name failed');
  });

  it('allows setting an immutable field if the record is unsaved', async function() {
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
    await expect(user.validate()).not.to.be.rejected;
  });

  it('raises an error for array on a STRING', async function() {
    const User = this.sequelize.define('User', {
      'email': {
        type: Sequelize.STRING
      }
    });

    await expect(User.build({
      email: ['iama', 'dummy.com']
    }).validate()).to.be.rejectedWith(Sequelize.ValidationError);
  });

  it('raises an error for array on a STRING(20)', async function() {
    const User = this.sequelize.define('User', {
      'email': {
        type: Sequelize.STRING(20)
      }
    });

    await expect(User.build({
      email: ['iama', 'dummy.com']
    }).validate()).to.be.rejectedWith(Sequelize.ValidationError);
  });

  it('raises an error for array on a TEXT', async function() {
    const User = this.sequelize.define('User', {
      'email': {
        type: Sequelize.TEXT
      }
    });

    await expect(User.build({
      email: ['iama', 'dummy.com']
    }).validate()).to.be.rejectedWith(Sequelize.ValidationError);
  });

  it('raises an error for {} on a STRING', async function() {
    const User = this.sequelize.define('User', {
      'email': {
        type: Sequelize.STRING
      }
    });

    await expect(User.build({
      email: { lol: true }
    }).validate()).to.be.rejectedWith(Sequelize.ValidationError);
  });

  it('raises an error for {} on a STRING(20)', async function() {
    const User = this.sequelize.define('User', {
      'email': {
        type: Sequelize.STRING(20)
      }
    });

    await expect(User.build({
      email: { lol: true }
    }).validate()).to.be.rejectedWith(Sequelize.ValidationError);
  });

  it('raises an error for {} on a TEXT', async function() {
    const User = this.sequelize.define('User', {
      'email': {
        type: Sequelize.TEXT
      }
    });

    await expect(User.build({
      email: { lol: true }
    }).validate()).to.be.rejectedWith(Sequelize.ValidationError);
  });

  it('does not raise an error for null on a STRING (where null is allowed)', async function() {
    const User = this.sequelize.define('User', {
      'email': {
        type: Sequelize.STRING
      }
    });

    await expect(User.build({
      email: null
    }).validate()).not.to.be.rejected;
  });

  it('validates VIRTUAL fields', async function() {
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

    await Promise.all([
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

  it('allows me to add custom validation functions to validator.js', async function() {
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

    await expect(User.build({
      name: 'abcdefg'
    }).validate()).not.to.be.rejected;

    const errors = await expect(User.build({
      name: 'a'
    }).validate()).to.be.rejected;

    expect(errors.get('name')[0].message).to.equal('Validation isExactly7Characters on name failed');
  });
});
