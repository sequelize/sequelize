import assert from 'node:assert';
import { expect } from 'chai';
import type {
  InferAttributes,
  CreationOptional,
  InferCreationAttributes,
  HasManyAddAssociationMixin,
  BelongsToSetAssociationMixin,
  HasMany,
  BelongsTo,
} from '@sequelize/core';
import {
  DataTypes,
  ValidationError,
  Model,
} from '@sequelize/core';
import {
  sequelize,
  getTestDialectTeaser,
  getTestDialect,
  beforeEach2,
} from './support';

describe(getTestDialectTeaser('InstanceValidator'), async () => {
  describe('#update', async () => {
    it('should allow us to update specific columns without tripping the validations', async () => {
      class User extends Model<InferAttributes<User>, InferCreationAttributes<User>> {
        declare id: CreationOptional<number>;
        declare username: string;
        declare email: string;
      }

      User.init({
        id: {
          type: DataTypes.INTEGER,
          primaryKey: true,
          autoIncrement: true,
        },
        username: DataTypes.STRING,
        email: {
          type: DataTypes.STRING,
          allowNull: false,
          validate: {
            isEmail: {
              msg: 'You must enter a valid email address',
            },
          },
        },
      }, { sequelize });

      await User.sync({ force: true });

      const user = await User.create({ username: 'bob', email: 'hello@world.com' });

      await User
        .update({ username: 'toni' }, { where: { id: user.id } });

      const user0 = await User.findByPk(1);
      expect(user0?.username).to.equal('toni');
    });

    it('should be able to emit an error upon updating when a validation has failed from an instance', async () => {
      class Book extends Model<InferAttributes<Book>, InferCreationAttributes<Book>> {
        declare name: string;
      }

      Book.init({
        name: {
          type: DataTypes.STRING,
          allowNull: false,
          validate: {
            notEmpty: true, // don't allow empty strings
          },
        },
      }, { sequelize });

      await expect(Book.build({
        name: '',
      }).validate()).to.be.rejectedWith(ValidationError);
    });

    it('should be able to emit an error upon updating when a validation has failed from the factory', async () => {
      class Book extends Model<InferAttributes<Book>, InferCreationAttributes<Book>> {
        declare id: CreationOptional<number>;
        declare name: string;
      }

      Book.init({
        id: {
          type: DataTypes.INTEGER,
          primaryKey: true,
          autoIncrement: true,
        },
        name: {
          type: DataTypes.STRING,
          allowNull: false,
          validate: {
            notEmpty: true, // don't allow empty strings
          },
        },
      }, { sequelize });

      await Book.sync({ force: true });
      const book = await Book.create({ name: 'World' });

      await expect(Book.update({ name: '' }, { where: { id: book.id } })).to.be.rejectedWith(ValidationError);
    });

    it('should enforce a unique constraint', async () => {
      class Book extends Model<InferAttributes<Book>, InferCreationAttributes<Book>> {
        declare id: CreationOptional<number>;
        declare uniqueName: string;
      }

      Book.init({
        id: {
          type: DataTypes.INTEGER,
          primaryKey: true,
          autoIncrement: true,
        },
        uniqueName: { type: DataTypes.STRING, unique: 'uniqueName' },
      }, { sequelize });

      const records = [
        { uniqueName: 'unique name one' },
        { uniqueName: 'unique name two' },
      ];
      await Book.sync({ force: true });
      const instance0 = await Book.create(records[0]);
      expect(instance0).to.be.ok;
      const instance = await Book.create(records[1]);
      expect(instance).to.be.ok;
      const err = await expect(Book.update(records[0], { where: { id: instance.id } })).to.be.rejected;
      assert(err instanceof ValidationError);
      expect(err.errors).to.have.length(1);
      if (getTestDialect() === 'ibmi') {
        expect(err.errors[0].message).to.include('Duplicate key value specified');
      } else {
        expect(err.errors[0].path).to.include('uniqueName');
        expect(err.errors[0].message).to.include('must be unique');
      }
    });

    if (getTestDialect() !== 'ibmi') {
      it('should allow a custom unique constraint error message', async () => {
        class Book extends Model<InferAttributes<Book>, InferCreationAttributes<Book>> {
          declare id: CreationOptional<number>;
          declare uniqueName: string;
        }

        Book.init({
          id: {
            type: DataTypes.INTEGER,
            primaryKey: true,
            autoIncrement: true,
          },
          uniqueName: {
            type: DataTypes.STRING,
            unique: {
              name: 'name',
              msg: 'custom unique error message',
            },
          },
        }, { sequelize });

        const records = [
          { uniqueName: 'unique name one' },
          { uniqueName: 'unique name two' },
        ];
        await Book.sync({ force: true });
        const instance0 = await Book.create(records[0]);
        expect(instance0).to.be.ok;
        const instance = await Book.create(records[1]);
        expect(instance).to.be.ok;
        const err = await expect(Book.update(records[0], { where: { id: instance.id } })).to.be.rejected;
        expect(err instanceof ValidationError);
        expect(err.errors).to.have.length(1);
        expect(err.errors[0].path).to.include('uniqueName');
        expect(err.errors[0].message).to.equal('custom unique error message');
      });

      it('should handle multiple unique messages correctly', async () => {
        class Book extends Model<InferAttributes<Book>, InferCreationAttributes<Book>> {
          declare uniqueName1: string;
          declare uniqueName2: string;
        }

        Book.init({
          uniqueName1: {
            type: DataTypes.STRING,
            unique: {
              name: 'uniqueName1',
              msg: 'custom unique error message 1',
            },
          },
          uniqueName2: {
            type: DataTypes.STRING,
            unique: {
              name: 'uniqueName2',
              msg: 'custom unique error message 2',
            },
          },
        }, { sequelize });

        const records = [
          { uniqueName1: 'unique name one', uniqueName2: 'unique name one' },
          { uniqueName1: 'unique name one', uniqueName2: 'this is ok' },
          { uniqueName1: 'this is ok', uniqueName2: 'unique name one' },
        ];
        await Book.sync({ force: true });
        const instance = await Book.create(records[0]);
        expect(instance).to.be.ok;
        const err0 = await expect(Book.create(records[1])).to.be.rejected;
        expect(err0 instanceof ValidationError);
        expect(err0.errors).to.have.length(1);
        expect(err0.errors[0].path).to.include('uniqueName1');
        expect(err0.errors[0].message).to.equal('custom unique error message 1');

        const err = await expect(Book.create(records[2])).to.be.rejected;
        expect(err instanceof ValidationError);
        expect(err.errors).to.have.length(1);
        expect(err.errors[0].path).to.include('uniqueName2');
        expect(err.errors[0].message).to.equal('custom unique error message 2');
      });
    }
  });

  describe('#create', async () => {
    describe('generic', async () => {
      const vars = beforeEach2(async () => {
        class Project extends Model<InferAttributes<Project>, InferCreationAttributes<Project>> {
          static associations: {
            users: HasMany<Project, Task>,
          };

          declare name: CreationOptional<string>;

          declare setTask: HasManyAddAssociationMixin<Task, number>;
        }

        Project.init({
          name: {
            type: DataTypes.STRING,
            allowNull: false,
            defaultValue: 'unknown',
            validate: {
              isIn: [['unknown', 'hello', 'test']],
            },
          },
        }, { sequelize });

        class Task extends Model<InferAttributes<Task>, InferCreationAttributes<Task>> {
          static associations: {
            users: BelongsTo<Task, Project>,
          };

          declare ProjectId?: CreationOptional<number | null>;
          declare something: number;

          declare setProject: BelongsToSetAssociationMixin<Project, number>;
        }

        Task.init({
          something: DataTypes.INTEGER,
        }, { sequelize });

        Project.hasOne(Task);
        Task.belongsTo(Project);

        await Project.sync({ force: true });
        await Task.sync({ force: true });

        return { Project, Task };
      });

      it('correctly throws an error using create method ', async () => {
        await expect(vars.Project.create({ name: 'nope' })).to.be.rejected;
      });

      it('correctly validates using create method ', async () => {
        const project = await vars.Project.create({});
        const task = await vars.Task.create({ something: 1 });
        await project.setTask(task);
        await task.reload();

        expect(task.ProjectId).to.not.be.null;
        await task.setProject(project);
        await task.reload();
        expect(task.ProjectId).to.not.be.null;
      });
    });

    describe('explicitly validating primary/auto incremented columns', async () => {
      it('should emit an error when we try to enter in a string for the id key without validation arguments', async () => {
        class User extends Model<InferAttributes<User>, InferCreationAttributes<User>> {
          declare id: number | string;
        }

        User.init({
          id: {
            type: DataTypes.INTEGER,
            autoIncrement: true,
            primaryKey: true,
            validate: {
              isInt: true,
            },
          },
        }, { sequelize });

        await User.sync({ force: true });

        try {
          await User.create({ id: 'helloworld' });
        } catch (error) {
          assert(error instanceof Error);
          if (error instanceof ValidationError) {
            expect(error.get('id')[0].message).to.equal('Validation isInt on id failed');
          }
        }
      });

      it('should emit an error when we try to enter in a string for an auto increment key (not named id)', async () => {
        class User extends Model<InferAttributes<User>, InferCreationAttributes<User>> {
          declare username: string;
        }

        User.init({
          username: {
            type: DataTypes.INTEGER,
            autoIncrement: true,
            primaryKey: true,
            validate: {
              isInt: {
                msg: 'Username must be an integer!',
              },
            },
          },
        }, { sequelize });

        await User.sync({ force: true });

        try {
          await User.create({ username: 'helloworldhelloworld' });
        } catch (error) {
          assert(error instanceof ValidationError);
          expect(error.get('username')[0].message).to.equal('Username must be an integer!');
        }
      });

      describe('primaryKey with the name as id with arguments for its validation', async () => {
        const vars = beforeEach2(async () => {
          class User extends Model<InferAttributes<User>, InferCreationAttributes<User>> {
            declare id: number | string;
          }

          User.init({
            id: {
              type: DataTypes.INTEGER,
              autoIncrement: true,
              primaryKey: true,
              validate: {
                isInt: {
                  msg: 'ID must be an integer!',
                },
              },
            },
          }, { sequelize });

          await User.sync({ force: true });

          return { User };
        });

        it('should emit an error when we try to enter in a string for the id key with validation arguments', async () => {
          try {
            await vars.User.create({ id: 'helloworld' });
          } catch (error) {
            assert(error instanceof ValidationError);
            expect(error.get('id')[0].message).to.equal('ID must be an integer!');
          }
        });

        it('should emit an error when we try to enter in a string for an auto increment key through .build().validate()', async () => {
          const user = vars.User.build({ id: 'helloworld' });

          const err = await expect(user.validate()).to.be.rejected;
          expect(err.get('id')[0].message).to.equal('ID must be an integer!');
        });

        it('should emit an error when we try to .save()', async () => {
          const user = vars.User.build({ id: 'helloworld' });

          try {
            await user.save();
          } catch (error) {
            assert(error instanceof ValidationError);
            expect(error.get('id')[0].message).to.equal('ID must be an integer!');
          }
        });
      });
    });

    describe('pass all paths when validating', async () => {
      it('produce 3 errors', async () => {
        try {
          class Project extends Model<InferAttributes<Project>, InferCreationAttributes<Project>> {
            declare name: CreationOptional<string>;
          }

          Project.init({
            name: {
              type: DataTypes.STRING,
              allowNull: false,
              defaultValue: 'unknown',
              validate: {
                isIn: [['unknown', 'hello', 'test']],
              },
            },
          }, { sequelize });

          await Project.sync({ force: true });

          await Project.create({});
        } catch (error) {
          assert(error instanceof ValidationError);
          delete error.stack; // longStackTraces
          expect(error.errors).to.have.length(3);
        }
      });
    });
  });

  it('supports promises with custom validation methods', async () => {
    class User extends Model<InferAttributes<User>, InferCreationAttributes<User>> {
      declare name: string;
    }

    User.init({
      name: {
        type: DataTypes.STRING,
        validate: {
          async customFn(val: string) {
            await User.findAll();
            if (val === 'error') {
              throw new Error('Invalid username');
            }
          },
        },
      },
    }, { sequelize });

    await User.sync();
    const error = await expect(User.build({ name: 'error' }).validate()).to.be.rejected;
    assert(error instanceof ValidationError);
    expect(error.get('name')[0].message).to.equal('Invalid username');

    await expect(User.build({ name: 'no error' }).validate()).not.to.be.rejected;
  });

  it('skips validations for the given fields', async () => {
    enum TestEnum {
      value1 = 'value1',
      value2 = 'value2',
    }
    const values = Object.values(TestEnum);

    class Bar extends Model<InferAttributes<Bar>, InferCreationAttributes<Bar>> {
      declare field: TestEnum;
    }

    Bar.init({
      field: {
        type: DataTypes.ENUM(values),
        validate: {
          isIn: [values],
        },
      },
    }, {
      sequelize,
    });

    // @ts-expect-error -- testing that invalid enum values get rejected
    const failingBar = Bar.build({ field: 'value3' });

    await expect(failingBar.validate({ skip: ['field'] })).not.to.be.rejected;
  });

  it('raises an error if saving a different value into an immutable field', async () => {
    class User extends Model<InferAttributes<User>, InferCreationAttributes<User>> {
      declare name: string;
    }

    User.init({
      name: {
        type: DataTypes.STRING,
        validate: {
          isImmutable: true,
        },
      },
    }, { sequelize });

    await User.sync({ force: true });
    const user = await User.create({ name: 'RedCat' });
    expect(user.getDataValue('name')).to.equal('RedCat');
    user.setDataValue('name', 'YellowCat');
    const error = await expect(user.save()).to.be.rejected;
    expect(error.get('name')[0].message).to.eql('Validation isImmutable on name failed');
  });

  describe('not null schema validation', async () => {
    const vars = beforeEach2(async () => {
      class Project extends Model<InferAttributes<Project>, InferCreationAttributes<Project>> {
        declare name: CreationOptional<string>;
      }

      Project.init({
        name: {
          type: DataTypes.STRING,
          allowNull: false,
          defaultValue: 'unknown',
          validate: {
            isIn: [['unknown', 'hello', 'test']],
          },
        },
      }, { sequelize });

      await Project.sync({ force: true });

      return { Project };
    });

    it('correctly throws an error using create method ', async () => {
      await expect(vars.Project.create({ name: '' })).to.be.rejected;
    });

    it('correctly throws an error using create method with default generated messages', async () => {
      try {
        await vars.Project.create({});
      } catch (error) {
        assert(error instanceof ValidationError);
        expect(error).to.have.property('name', 'SequelizeDatabaseError');
        expect(error.message).equal('notNull violation: Project.name cannot be null');
        expect(error.errors).to.be.an('array').and.have.length(1);
        expect(error.errors[0]).to.have.property('message', 'Project.name cannot be null');
      }
    });
  });
});
