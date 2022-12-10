import chai from 'chai';
import type {
  InferAttributes,
  CreationOptional,
  InferCreationAttributes,
  HasManyAddAssociationMixin,
  BelongsToSetAssociationMixin,
  HasMany,
  BelongsTo,
  Literal,
} from '@sequelize/core';
import {
  DataTypes,
  ValidationError,
  Model,
  Sequelize,
} from '@sequelize/core';
import {
  getTestDialectTeaser,
  getTestDialect,
  sequelize,
  beforeEach2,
} from './support';

const expect = chai.expect;

describe(getTestDialectTeaser('InstanceValidator'), async () => {
  describe('#update', async () => {
    it('should allow us to update specific columns without tripping the validations', async () => {
      class User extends Model<InferAttributes<User>, InferCreationAttributes<User>> {
        declare id?: CreationOptional<number>;
        declare username: string;
        declare email: string;
      }

      User.init({
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

      await Book.sync({ force: true });
      const book = await Book.create({ name: 'World' });

      try {
        await book.update({ name: '' });
      } catch (error) {
        expect(error).to.be.an.instanceOf(Error);
        if (error instanceof ValidationError) {
          expect(error.get('name')[0].message).to.equal('Validation notEmpty on name failed');
        }
      }
    });

    it('should be able to emit an error upon updating when a validation has failed from the factory', async () => {
      class Book extends Model<InferAttributes<Book>, InferCreationAttributes<Book>> {
        declare id?: CreationOptional<number>;
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

      await Book.sync({ force: true });
      await Book.create({ name: 'World' });

      try {
        await Book.update({ name: '' }, { where: { id: 1 } });
      } catch (error) {
        expect(error).to.be.an.instanceOf(Error);
        if (error instanceof ValidationError) {
          expect(error.get('name')[0].message).to.equal('Validation notEmpty on name failed');
        }
      }
    });

    it('should enforce a unique constraint', async () => {
      class Book extends Model<InferAttributes<Book>, InferCreationAttributes<Book>> {
        declare id?: CreationOptional<number>;
        declare uniqueName: string;
      }

      Book.init({
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
      expect(err).to.be.an.instanceOf(Error);
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
          declare id?: CreationOptional<number>;
          declare uniqueName: string;
        }

        Book.init({
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
        expect(err).to.be.an.instanceOf(Error);
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
        expect(err0).to.be.an.instanceOf(Error);
        expect(err0.errors).to.have.length(1);
        expect(err0.errors[0].path).to.include('uniqueName1');
        expect(err0.errors[0].message).to.equal('custom unique error message 1');

        const err = await expect(Book.create(records[2])).to.be.rejected;
        expect(err).to.be.an.instanceOf(Error);
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
        try {
          await vars.Project.create({ name: 'nope' });
        } catch (error) {
          expect(error).to.have.ownProperty('name');
        }
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
          expect(error).to.be.an.instanceOf(Error);
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
          expect(error).to.be.an.instanceOf(Error);
          if (error instanceof ValidationError) {
            expect(error.get('username')[0].message).to.equal('Username must be an integer!');
          }
        }
      });

      describe('primaryKey with the name as id with arguments for it\'s validatio', async () => {
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
            expect(error).to.be.an.instanceOf(Error);
            if (error instanceof ValidationError) {
              expect(error.get('id')[0].message).to.equal('ID must be an integer!');
            }
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
            expect(error).to.be.an.instanceOf(Error);
            if (error instanceof ValidationError) {
              expect(error.get('id')[0].message).to.equal('ID must be an integer!');
            }
          }
        });
      });
    });

    describe('pass all paths when validating', async () => {
      const vars = beforeEach2(async () => {
        class Project extends Model<InferAttributes<Project>, InferCreationAttributes<Project>> {
          static associations: {
            users: HasMany<Project, Task>,
          };

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

        class Task extends Model<InferAttributes<Task>, InferCreationAttributes<Task>> {
          static associations: {
            users: BelongsTo<Task, Project>,
          };

          declare something: number;
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

      it('produce 3 errors', async () => {
        try {
          await vars.Project.create({});
        } catch (error) {
          expect(error).to.be.an.instanceOf(Error);
          if (error instanceof ValidationError) {
            delete error.stack; // longStackTraces
            expect(error.errors).to.have.length(3);
          }
        }
      });
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

        return { Project };
      });

      it('correctly throws an error using create method ', async () => {
        await vars.Project.create({})
          .then(() => {
            throw new Error('Validation must be failed');
          }, async () => {
            // fail is ok
          });
      });

      it('correctly throws an error using create method with default generated messages', async () => {
        try {
          await vars.Project.create({});
        } catch (error) {
          if (error instanceof ValidationError) {
            expect(error).to.have.property('name', 'SequelizeValidationError');
            expect(error.message).equal('notNull violation: Project.name cannot be null');
            expect(error.errors).to.be.an('array').and.have.length(1);
            expect(error.errors[0]).to.have.property('message', 'Project.name cannot be null');
          }
        }
      });
    });
  });

  it('correctly validates using custom validation methods', async () => {
    class User extends Model<InferAttributes<User>, InferCreationAttributes<User>> {
      declare name: string;
    }

    User.init({
      name: {
        type: DataTypes.STRING,
        validate: {
          customFn(val: string, next: (arg0?: string | undefined) => void) {
            if (val !== '2') {
              next('name should equal \'2\'');
            } else {
              next();
            }
          },
        },
      },
    }, { sequelize });

    const failingUser = User.build({ name: '3' });

    const error = await expect(failingUser.validate()).to.be.rejected;

    expect(error).to.be.an.instanceOf(Error);

    if (error instanceof ValidationError) {
      expect(error.get('name')[0].message).to.equal('name should equal \'2\'');
    }

    const successfulUser = User.build({ name: '2' });

    await expect(successfulUser.validate()).not.to.be.rejected;
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
    expect(error).to.be.instanceof(ValidationError);
    if (error instanceof ValidationError) {
      expect(error.get('name')[0].message).to.equal('Invalid username');
    }

    await expect(User.build({ name: 'no error' }).validate()).not.to.be.rejected;
  });

  it('skips other validations if allowNull is true and the value is null', async () => {
    class User extends Model<InferAttributes<User>, InferCreationAttributes<User>> {
      declare age: number;
    }

    User.init({
      age: {
        type: DataTypes.INTEGER,
        allowNull: true,
        validate: {
          min: {
            args: [0],
            msg: 'must be positive',
          },
        },
      },
    }, { sequelize });

    const error = await expect(User
      .build({ age: -1 })
      .validate())
      .to.be.rejected;

    expect(error.get('age')[0].message).to.equal('must be positive');
  });

  it('validates a model with custom model-wide validation methods', async () => {
    class Foo extends Model<InferAttributes<Foo>, InferCreationAttributes<Foo>> {
      declare field1: number | null;
      declare field2: number | null;
    }

    Foo.init({
      field1: {
        type: DataTypes.INTEGER,
        allowNull: true,
      },
      field2: {
        type: DataTypes.INTEGER,
        allowNull: true,
      },
    }, {
      sequelize,
      validate: {
        xnor() {
          if (this.field1 === null === (this.field2 === null)) {
            throw new Error('xnor failed');
          }
        },
      },
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

  it('validates model with a validator whose arg is an Array successfully twice in a row', async () => {
    class Foo extends Model<InferAttributes<Foo>, InferCreationAttributes<Foo>> {
      declare bar: string;
    }

    Foo.init({
      bar: {
        type: DataTypes.STRING,
        validate: {
          isIn: [['a', 'b']],
        },
      },
    }, {
      sequelize,
    });

    const foo = Foo.build({ bar: 'a' });
    await expect(foo.validate()).not.to.be.rejected;
    await expect(foo.validate()).not.to.be.rejected;
  });

  it('validates enums', async () => {
    enum TestEnum {
      value1 = 'value1',
      value2 = 'value2',
    }
    enum FailingTestEnum {
      value3 = 'value3',
    }
    const values = Object.values(TestEnum);

    class Bar extends Model<InferAttributes<Bar>, InferCreationAttributes<Bar>> {
      declare field: TestEnum | FailingTestEnum;
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

    const failingBar = Bar.build({ field: FailingTestEnum.value3 });

    const errors = await expect(failingBar.validate()).to.be.rejected;
    expect(errors.get('field')).to.have.length(2);
    expect(errors.get('field')[0].message).to.equal(`'value3' is not a valid choice for enum [ 'value1', 'value2' ]`);
    expect(errors.get('field')[1].message).to.equal(`Validation isIn on field failed`);
  });

  it('skips validations for the given fields', async () => {
    enum TestEnum {
      value1 = 'value1',
      value2 = 'value2',
    }
    enum FailingTestEnum {
      value3 = 'value3',
    }
    const values = Object.values(TestEnum);

    class Bar extends Model<InferAttributes<Bar>, InferCreationAttributes<Bar>> {
      declare field: TestEnum | FailingTestEnum;
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

    const failingBar = Bar.build({ field: FailingTestEnum.value3 });

    await expect(failingBar.validate({ skip: ['field'] })).not.to.be.rejected;
  });

  it('skips validations for fields with value that is SequelizeMethod', async () => {
    enum TestEnum {
      value1 = 'value1',
      value2 = 'value2',
    }
    enum FailingTestEnum {
      value3 = 'value3',
    }
    const values = Object.values(TestEnum);

    class Bar extends Model<InferAttributes<Bar>, InferCreationAttributes<Bar>> {
      declare field: TestEnum | FailingTestEnum | Literal;
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

    const failingBar = Bar.build({ field: sequelize.literal('5 + 1') });

    await expect(failingBar.validate()).not.to.be.rejected;
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
    const errors = await expect(user.save()).to.be.rejected;
    expect(errors.get('name')[0].message).to.eql('Validation isImmutable on name failed');
  });

  it('allows setting an immutable field if the record is unsaved', async () => {
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

    const user = User.build({ name: 'RedCat' });
    expect(user.getDataValue('name')).to.equal('RedCat');

    user.setDataValue('name', 'OrangeCat');
    await expect(user.validate()).not.to.be.rejected;
  });

  it('raises an error for array on a STRING', async () => {
    class User extends Model<InferAttributes<User>, InferCreationAttributes<User>> {
      declare email: string | string[];
    }

    User.init({
      email: {
        type: DataTypes.STRING,
      },
    }, { sequelize });

    await expect(User.build({
      email: ['ilove', 'sequelize.com'],
    }).validate()).to.be.rejectedWith(ValidationError);
  });

  it('raises an error for array on a STRING(20)', async () => {
    class User extends Model<InferAttributes<User>, InferCreationAttributes<User>> {
      declare email: string | string[];
    }

    User.init({
      email: {
        type: DataTypes.STRING(20),
      },
    }, { sequelize });

    await expect(User.build({
      email: ['ilove', 'sequelize.com'],
    }).validate()).to.be.rejectedWith(ValidationError);
  });

  it('raises an error for array on a TEXT', async () => {
    class User extends Model<InferAttributes<User>, InferCreationAttributes<User>> {
      declare email: string | string[];
    }

    User.init({
      email: {
        type: DataTypes.TEXT,
      },
    }, { sequelize });

    await expect(User.build({
      email: ['ilove', 'sequelize.com'],
    }).validate()).to.be.rejectedWith(ValidationError);
  });

  it('raises an error for {} on a STRING', async () => {
    class User extends Model<InferAttributes<User>, InferCreationAttributes<User>> {
      declare email: string | object;
    }

    User.init({
      email: {
        type: DataTypes.STRING,
      },
    }, { sequelize });

    await expect(User.build({
      email: { wrongObject: true },
    }).validate()).to.be.rejectedWith(ValidationError);
  });

  it('raises an error for {} on a STRING(20)', async () => {
    class User extends Model<InferAttributes<User>, InferCreationAttributes<User>> {
      declare email: string | object;
    }

    User.init({
      email: {
        type: DataTypes.STRING(20),
      },
    }, { sequelize });

    await expect(User.build({
      email: { wrongObject: true },
    }).validate()).to.be.rejectedWith(ValidationError);
  });

  it('raises an error for {} on a TEXT', async () => {
    class User extends Model<InferAttributes<User>, InferCreationAttributes<User>> {
      declare email: string | object;
    }

    User.init({
      email: {
        type: DataTypes.TEXT,
      },
    }, { sequelize });

    await expect(User.build({
      email: { wrongObject: true },
    }).validate()).to.be.rejectedWith(ValidationError);
  });

  it('does not raise an error for null on a STRING (where null is allowed)', async () => {
    class User extends Model<InferAttributes<User>, InferCreationAttributes<User>> {
      declare email: string | null;
    }

    User.init({
      email: {
        type: DataTypes.STRING,
      },
    }, { sequelize });

    await expect(User.build({
      email: null,
    }).validate()).not.to.be.rejected;
  });

  it('validates VIRTUAL fields', async () => {
    class User extends Model<InferAttributes<User>, InferCreationAttributes<User>> {
      declare password_hash: CreationOptional<string>;
      declare salt: string;
      declare password: string;
    }

    User.init({
      password_hash: DataTypes.STRING,
      salt: DataTypes.STRING,
      password: {
        type: DataTypes.VIRTUAL,
        set(val: string) {
          this.setDataValue('password', val);
          this.setDataValue('password_hash', this.salt + val);
        },
        validate: {
          isLongEnough(val: string) {
            if (val.length < 7) {
              throw new Error('Please choose a longer password');
            }
          },
        },
      },
    }, { sequelize });

    await Promise.all([
      expect(User.build({
        password: 'short',
        salt: '42',
      }).validate()).to.be.rejected.then(errors => {
        expect(errors.get('password')[0].message).to.equal('Please choose a longer password');
      }),
      expect(User.build({
        password: 'loooooooong',
        salt: '42',
      }).validate()).not.to.be.rejected,
    ]);
  });

  it('allows me to add custom validation functions to validator.js', async () => {
    Sequelize.Validator.extend('isExactly7Characters', (val: string) => {
      return val.length === 7;
    });

    class User extends Model<InferAttributes<User>, InferCreationAttributes<User>> {
      declare name: string;
    }

    User.init({
      name: {
        type: DataTypes.STRING,
        validate: {
          isExactly7Characters: true,
        },
      },
    }, { sequelize });

    await expect(User.build({
      name: 'abcdefg',
    }).validate()).not.to.be.rejected;

    const errors = await expect(User.build({
      name: 'a',
    }).validate()).to.be.rejected;

    expect(errors.get('name')[0].message).to.equal('Validation isExactly7Characters on name failed');
  });
});
