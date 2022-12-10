import assert from 'node:assert';
import { expect } from 'chai';
import sinon from 'sinon';
import type {
  InferAttributes,
  CreationOptional,
  InferCreationAttributes,
} from '@sequelize/core';
import {
  DataTypes,
  ValidationError,
  Model,
  Sequelize,
  literal,
} from '@sequelize/core';
import { InstanceValidator } from '@sequelize/core/_non-semver-use-at-your-own-risk_/instance-validator.js';
import {
  getTestDialectTeaser,
  sequelize,
  beforeEach2,
} from '../support';

describe(getTestDialectTeaser('InstanceValidator'), () => {
  const vars = beforeEach2(() => {
    const User = sequelize.define('user', {
      fails: {
        type: DataTypes.BOOLEAN,
        validate: {
          isNotTrue(value: boolean) {
            if (value) {
              throw new Error('Manual model validation failure');
            }
          },
        },
      },
    });

    return { User };
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
      declare email: string;
    }

    User.init({
      email: {
        type: DataTypes.STRING,
      },
    }, { sequelize });

    await expect(
      User
        // @ts-expect-error -- testing that this input will get rejected
        .build({ email: ['ilove', 'sequelize.com'] })
        .validate(),
    ).to.be.rejectedWith(ValidationError);
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
              next(`name should equal '2'`);
            } else {
              next();
            }
          },
        },
      },
    }, { sequelize });

    const failingUser = User.build({ name: '3' });

    const error = await expect(failingUser.validate()).to.be.rejected;

    assert(error instanceof ValidationError);
    expect(error.get('name')[0].message).to.equal(`name should equal '2'`);

    const successfulUser = User.build({ name: '2' });

    await expect(successfulUser.validate()).not.to.be.rejected;
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

    const error = await expect(
      User.build({ age: -1 }).validate(),
    ).to.be.rejected;

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
          if ((this.field1 === null) === (this.field2 === null)) {
            throw new Error('xnor failed');
          }
        },
      },
    });

    const error = await expect(
      Foo.build({ field1: null, field2: null }).validate(),
    ).to.be.rejected;

    expect(error.get('xnor')[0].message).to.equal('xnor failed');

    await expect(
      Foo.build({ field1: 33, field2: null }).validate(),
    ).not.to.be.rejected;
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

    const errors = await expect(failingBar.validate()).to.be.rejected;
    expect(errors.get('field')).to.have.length(2);
    expect(errors.get('field')[0].message).to.equal(`'value3' is not a valid choice for enum [ 'value1', 'value2' ]`);
    expect(errors.get('field')[1].message).to.equal(`Validation isIn on field failed`);
  });

  it('skips validations for fields with value that is SequelizeMethod', async () => {
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

    // @ts-expect-error -- TODO: "literal" should be accepted
    const failingBar = Bar.build({ field: literal('5 + 1') });

    await expect(failingBar.validate()).not.to.be.rejected;
  });

  it('configures itself to run hooks by default', () => {
    const instanceValidator = new InstanceValidator();
    expect(instanceValidator.options.hooks).to.equal(true);
  });

  describe('validate', () => {
    it('runs the validation sequence and hooks when the hooks option is true', () => {
      const instanceValidator = new InstanceValidator(vars.User.build(), { hooks: true });
      const _validate = sinon.spy(instanceValidator, '_validate');
      const _validateAndRunHooks = sinon.spy(instanceValidator, '_validateAndRunHooks');

      instanceValidator.validate();

      expect(_validateAndRunHooks).to.have.been.calledOnce;
      expect(_validate).to.not.have.been.called;
    });

    it('runs the validation sequence but skips hooks if the hooks option is false', () => {
      const instanceValidator = new InstanceValidator(vars.User.build(), { hooks: false });
      const _validate = sinon.spy(instanceValidator, '_validate');
      const _validateAndRunHooks = sinon.spy(instanceValidator, '_validateAndRunHooks');

      instanceValidator.validate();

      expect(_validate).to.have.been.calledOnce;
      expect(_validateAndRunHooks).to.not.have.been.called;
    });

    it('fulfills when validation is successful', async () => {
      const instanceValidator = new InstanceValidator(vars.User.build());
      const result = instanceValidator.validate();

      await expect(result).to.be.fulfilled;
    });

    it('rejects with a validation error when validation fails', async () => {
      const instanceValidator = new InstanceValidator(vars.User.build({ fails: true }));
      const result = instanceValidator.validate();

      await expect(result).to.be.rejectedWith(ValidationError);
    });

    it('has a useful default error message for not null validation failures', async () => {
      const User = sequelize.define('user', {
        name: {
          type: DataTypes.STRING,
          allowNull: false,
        },
      });

      const instanceValidator = new InstanceValidator(User.build());
      const result = instanceValidator.validate();

      await expect(result).to.be.rejectedWith(ValidationError, /user\.name cannot be null/);
    });
  });

  describe('_validateAndRunHooks', () => {
    const validatorVars = beforeEach2(() => {
      const successfulInstanceValidator = new InstanceValidator(vars.User.build());
      sinon.stub(successfulInstanceValidator, '_validate').resolves();

      return { successfulInstanceValidator };
    });

    it('should run beforeValidate and afterValidate hooks when _validate is successful', async () => {
      const beforeValidate = sinon.spy();
      const afterValidate = sinon.spy();
      vars.User.beforeValidate(beforeValidate);
      vars.User.afterValidate(afterValidate);

      await expect(validatorVars.successfulInstanceValidator._validateAndRunHooks()).to.be.fulfilled;
      expect(beforeValidate).to.have.been.calledOnce;
      expect(afterValidate).to.have.been.calledOnce;
    });

    it('should run beforeValidate hook but not afterValidate hook when _validate is unsuccessful', async () => {
      const failingInstanceValidator = new InstanceValidator(vars.User.build());
      sinon.stub(failingInstanceValidator, '_validate').rejects(Error);
      const beforeValidate = sinon.spy();
      const afterValidate = sinon.spy();
      vars.User.beforeValidate(beforeValidate);
      vars.User.afterValidate(afterValidate);

      await expect(failingInstanceValidator._validateAndRunHooks()).to.be.rejected;
      expect(beforeValidate).to.have.been.calledOnce;
      expect(afterValidate).to.not.have.been.called;
    });

    it('should emit an error from after hook when afterValidate fails', async () => {
      vars.User.afterValidate(() => {
        throw new Error('after validation error');
      });

      await expect(validatorVars.successfulInstanceValidator._validateAndRunHooks()).to.be.rejectedWith('after validation error');
    });

    describe('validatedFailed hook', () => {
      it('should call validationFailed hook when validation fails', async () => {
        const failingInstanceValidator = new InstanceValidator(vars.User.build());
        sinon.stub(failingInstanceValidator, '_validate').rejects(Error);
        const validationFailedHook = sinon.spy();
        vars.User.validationFailed(validationFailedHook);

        await expect(failingInstanceValidator._validateAndRunHooks()).to.be.rejected;
        expect(validationFailedHook).to.have.been.calledOnce;
      });

      it('should not replace the validation error in validationFailed hook by default', async () => {
        const failingInstanceValidator = new InstanceValidator(vars.User.build());
        sinon.stub(failingInstanceValidator, '_validate').rejects(ValidationError);
        const validationFailedHook = sinon.stub().resolves();
        vars.User.validationFailed(validationFailedHook);

        const err = await expect(failingInstanceValidator._validateAndRunHooks()).to.be.rejected;
        expect(err.name).to.equal('ValidationError');
      });

      it('should replace the validation error if validationFailed hook creates a new error', async () => {
        const failingInstanceValidator = new InstanceValidator(vars.User.build());
        sinon.stub(failingInstanceValidator, '_validate').rejects(ValidationError);
        const validationFailedHook = sinon.stub().throws(new Error('validation failed hook error'));
        vars.User.validationFailed(validationFailedHook);

        const err = await expect(failingInstanceValidator._validateAndRunHooks()).to.be.rejected;
        expect(err.message).to.equal('validation failed hook error');
      });
    });
  });
});
