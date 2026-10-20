import type { ModelStatic } from '@sequelize/core';
import { DataTypes, Op, ValidationError, ValidationErrorItem } from '@sequelize/core';
import { expect } from 'chai';
import { inspect } from 'node:util';
import type { SinonSpy, SinonStub } from 'sinon';
import sinon from 'sinon';
import { rand, sequelize } from '../../support';

const dialect = sequelize.dialect;

interface ValidatorCheck {
  /** The arguments of the validator, if it accepts any */
  args?: unknown;
  /** Whether the validator can also be enabled with `true` even though it accepts arguments */
  allowTrue?: boolean;
  fail: string[];
  pass: Array<string | null>;
}

describe('InstanceValidator', () => {
  describe('validations', () => {
    const checks: Record<string, ValidatorCheck> = {
      is: {
        args: ['[a-z]', 'i'],
        fail: ['0'],
        pass: ['a'],
      },
      not: {
        args: ['[a-z]', 'i'],
        fail: ['a'],
        pass: ['0'],
      },
      isEmail: {
        fail: ['a'],
        pass: ['abc@abc.com'],
      },
      isUrl: {
        fail: ['abc'],
        pass: ['http://abc.com'],
      },
      isIP: {
        fail: ['abc'],
        pass: ['129.89.23.1'],
      },
      isIPv4: {
        fail: ['abc'],
        pass: ['129.89.23.1'],
      },
      isIPv6: {
        fail: ['1111:2222:3333::5555:'],
        pass: ['fe80:0000:0000:0000:0204:61ff:fe9d:f156'],
      },
      isAlpha: {
        allowTrue: true,
        args: 'en-GB',
        fail: ['012'],
        pass: ['abc'],
      },
      isAlphanumeric: {
        allowTrue: true,
        args: 'en-GB',
        fail: ['_abc019'],
        pass: ['abc019'],
      },
      isNumeric: {
        fail: ['abc'],
        pass: ['019'],
      },
      isInt: {
        fail: ['9.2'],
        pass: ['-9'],
      },
      isLowercase: {
        fail: ['AB'],
        pass: ['ab'],
      },
      isUppercase: {
        fail: ['ab'],
        pass: ['AB'],
      },
      isDecimal: {
        fail: ['a'],
        pass: ['0.2'],
      },
      isFloat: {
        fail: ['a'],
        pass: ['9.2'],
      },
      isNull: {
        fail: ['0'],
        pass: [null],
      },
      notEmpty: {
        fail: ['       '],
        pass: ['a'],
      },
      equals: {
        args: 'bla bla bla',
        fail: ['bla'],
        pass: ['bla bla bla'],
      },
      contains: {
        args: 'bla',
        fail: ['la'],
        pass: ['0bla23'],
      },
      notContains: {
        args: 'bla',
        fail: ['0bla23'],
        pass: ['la'],
      },
      regex: {
        args: ['[a-z]', 'i'],
        fail: ['0'],
        pass: ['a'],
      },
      notRegex: {
        args: ['[a-z]', 'i'],
        fail: ['a'],
        pass: ['0'],
      },
      len: {
        args: [2, 4],
        fail: ['1', '12345'],
        pass: ['12', '123', '1234'],
      },
      isUUID: {
        args: 4,
        fail: ['f47ac10b-58cc-3372-a567-0e02b2c3d479'],
        pass: ['f47ac10b-58cc-4372-a567-0e02b2c3d479'],
      },
      isDate: {
        fail: ['not a date'],
        pass: ['2011-02-04'],
      },
      isAfter: {
        args: '2011-11-05',
        fail: ['2011-11-04'],
        pass: ['2011-11-06'],
      },
      isBefore: {
        args: '2011-11-05',
        fail: ['2011-11-06'],
        pass: ['2011-11-04'],
      },
      isIn: {
        args: 'abcdefghijk',
        fail: ['ghik'],
        pass: ['ghij'],
      },
      notIn: {
        args: 'abcdefghijk',
        fail: ['ghij'],
        pass: ['ghik'],
      },
      max: {
        args: 23,
        fail: ['24'],
        pass: ['23'],
      },
      min: {
        args: 23,
        fail: ['22'],
        pass: ['23'],
      },
      isCreditCard: {
        fail: ['401288888888188f'],
        pass: ['4012888888881881'],
      },
    };

    async function validateWith(validator: string, spec: unknown, value: string | null) {
      const User = sequelize.define(`User${rand()}`, {
        name: {
          type: DataTypes.STRING,
          validate: { [validator]: spec },
        },
      });

      return User.build({ name: value }).validate();
    }

    for (const [validator, check] of Object.entries(checks)) {
      describe(validator, () => {
        // An options object is created for each test, as the validator could mutate it
        const getOptions = () => (check.args === undefined ? {} : { args: check.args });

        // Validators can also be enabled without an options object, by passing their arguments directly, or true
        const shorthands: Array<{ title: string; spec: unknown }> = [];
        if (check.args !== undefined) {
          shorthands.push({ title: `${validator}: ${inspect(check.args)}`, spec: check.args });
        }

        if (check.args === undefined || check.allowTrue) {
          shorthands.push({ title: `${validator}: true`, spec: true });
        }

        for (const value of check.fail) {
          it(`rejects ${inspect(value)} with a custom message`, async () => {
            const message = `${validator}(${value})`;

            const error = await expect(
              validateWith(validator, { ...getOptions(), msg: message }, value),
            ).to.be.rejectedWith(ValidationError);
            expect(error.get('name')[0].message).to.equal(message);
            expect(error.get('name')[0].value).to.equal(value);
          });

          for (const { title, spec } of shorthands) {
            it(`rejects ${inspect(value)} using ${title}`, async () => {
              const error = await expect(validateWith(validator, spec, value)).to.be.rejectedWith(
                ValidationError,
              );
              expect(error.get('name')[0].message).to.equal(
                `Validation ${validator} on name failed`,
              );
              expect(error.get('name')[0].value).to.equal(value);
            });
          }
        }

        for (const value of check.pass) {
          it(`accepts ${inspect(value)}`, async () => {
            await expect(validateWith(validator, getOptions(), value)).to.be.fulfilled;
          });

          it(`accepts ${inspect(value)} with a custom message`, async () => {
            await expect(
              validateWith(validator, { ...getOptions(), msg: `${validator}(${value})` }, value),
            ).to.be.fulfilled;
          });

          for (const { title, spec } of shorthands) {
            it(`accepts ${inspect(value)} using ${title}`, async () => {
              await expect(validateWith(validator, spec, value)).to.be.fulfilled;
            });
          }
        }
      });
    }
  });

  if (dialect.supports.dataTypes.DECIMAL) {
    describe('DECIMAL validator', () => {
      let User: ModelStatic;
      let stub: SinonStub;

      before(() => {
        User = sequelize.define('user', {
          decimal: DataTypes.DECIMAL(10, 2),
        });

        // The typings of queryRaw don't cover the instance being returned when "instance" is set
        stub = sinon.stub(sequelize, 'queryRaw').callsFake(async () => [User.build({}), 1] as any);
      });

      after(() => {
        stub.restore();
      });

      it('should allow decimal as a string', async () => {
        await expect(
          User.create({
            decimal: '12.6',
          }),
        ).not.to.be.rejected;
      });

      it('should allow decimal big numbers as a string', async () => {
        await expect(
          User.create({
            decimal: '2321312301230128391820831289123012',
          }),
        ).not.to.be.rejected;
      });

      it('should allow decimal as scientific notation', async () => {
        await Promise.all([
          expect(
            User.create({
              decimal: '2321312301230128391820e219',
            }),
          ).not.to.be.rejected,
          expect(
            User.create({
              decimal: '2321312301230128391820e+219',
            }),
          ).not.to.be.rejected,
        ]);
      });
    });
  }

  describe('datatype validations', () => {
    let User: ModelStatic;
    let stub: SinonStub;

    before(() => {
      User = sequelize.define('user', {
        integer: DataTypes.INTEGER,
        name: DataTypes.STRING,
        awesome: DataTypes.BOOLEAN,
        uid: DataTypes.UUID,
        date: DataTypes.DATE,
      });

      // The typings of queryRaw don't cover the instance being returned when "instance" is set
      stub = sinon.stub(sequelize, 'queryRaw').callsFake(async () => [User.build({}), 1] as any);
    });

    after(() => {
      stub.restore();
    });

    describe('should not throw', () => {
      describe('create', () => {
        it('should allow number as a string', async () => {
          await expect(
            User.create({
              integer: '12',
            }),
          ).not.to.be.rejected;
        });

        it('should allow dates as a string', async () => {
          await expect(
            User.findOne({
              where: {
                date: '2000-12-16',
              },
            }),
          ).not.to.be.rejected;
        });
      });

      describe('findAll', () => {
        if (dialect.supports.dataTypes.ARRAY) {
          it('should allow $in', async () => {
            await expect(
              User.findAll({
                where: {
                  name: {
                    [Op.like]: {
                      [Op.any]: ['foo%', 'bar%'],
                    },
                  },
                },
              }),
            ).not.to.be.rejected;
          });
        }

        it('should allow $like for uuid if cast', async () => {
          await expect(
            User.findAll({
              where: {
                'uid::text': {
                  [Op.like]: '12345678%',
                },
              },
            }),
          ).not.to.be.rejected;
        });
      });
    });

    describe('should throw validationError', () => {
      describe('create', () => {
        it('should throw when passing string', async () => {
          const error = await expect(
            User.create({
              integer: 'jan',
            }),
          ).to.be.rejectedWith(ValidationError, `'jan' is not a valid integer`);

          expect(error)
            .to.have.property('errors')
            .that.is.an('array')
            .with.lengthOf(1)
            .and.with.property('0')
            .that.is.an.instanceOf(ValidationErrorItem)
            .and.include({
              type: 'Validation error',
              path: 'integer',
              value: 'jan',
              validatorKey: 'INTEGER validator',
            });
        });

        it('should throw when passing decimal', async () => {
          await expect(
            User.create({
              integer: 4.5,
            }),
          )
            .to.be.rejectedWith(ValidationError)
            .which.eventually.have.property('errors')
            .that.is.an('array')
            .with.lengthOf(1)
            .and.with.property('0')
            .that.is.an.instanceOf(ValidationErrorItem)
            .and.include({
              type: 'Validation error',
              path: 'integer',
              value: 4.5,
              validatorKey: 'INTEGER validator',
            });
        });
      });

      describe('update', () => {
        it('should throw when passing string', async () => {
          await expect(User.update({ integer: 'jan' }, { where: {} }))
            .to.be.rejectedWith(ValidationError)
            .which.eventually.have.property('errors')
            .that.is.an('array')
            .with.lengthOf(1)
            .and.with.property('0')
            .that.is.an.instanceOf(ValidationErrorItem)
            .and.include({
              type: 'Validation error',
              path: 'integer',
              value: 'jan',
              validatorKey: 'INTEGER validator',
            });
        });

        it('should throw when passing decimal', async () => {
          await expect(
            User.update(
              {
                integer: 4.5,
              },
              { where: {} },
            ),
          )
            .to.be.rejectedWith(ValidationError)
            .which.eventually.have.property('errors')
            .that.is.an('array')
            .with.lengthOf(1)
            .and.with.property('0')
            .that.is.an.instanceOf(ValidationErrorItem)
            .and.include({
              type: 'Validation error',
              path: 'integer',
              value: 4.5,
              validatorKey: 'INTEGER validator',
            });
        });
      });
    });
  });

  describe('custom validation functions', () => {
    let User: ModelStatic;
    let stub: SinonStub;

    before(() => {
      User = sequelize.define(
        'user',
        {
          integer: {
            type: DataTypes.INTEGER,
            validate: {
              customFn(val: number, next: (err?: string) => void) {
                if (val < 0) {
                  next('integer must be greater or equal zero');
                } else {
                  next();
                }
              },
            },
          },
          name: DataTypes.STRING,
        },
        {
          validate: {
            customFn() {
              if (this.get('name') === 'error') {
                throw new Error('Error from model validation promise');
              }
            },
          },
        },
      );

      // The typings of queryRaw don't cover the instance being returned when "instance" is set
      stub = sinon.stub(sequelize, 'queryRaw').resolves([User.build(), 1] as any);
    });

    after(() => {
      stub.restore();
    });

    describe('should not throw', () => {
      describe('create', () => {
        it('custom validation functions are successful', async () => {
          await expect(
            User.create({
              integer: 1,
              name: 'noerror',
            }),
          ).not.to.be.rejected;
        });
      });

      describe('update', () => {
        it('custom validation functions are successful', async () => {
          await expect(
            User.update(
              {
                integer: 1,
                name: 'noerror',
              },
              { where: {} },
            ),
          ).not.to.be.rejected;
        });
      });
    });

    describe('should throw validationerror', () => {
      describe('create', () => {
        it('custom attribute validation function fails', async () => {
          await expect(
            User.create({
              integer: -1,
            }),
          ).to.be.rejectedWith(ValidationError);
        });

        it('custom model validation function fails', async () => {
          await expect(
            User.create({
              name: 'error',
            }),
          ).to.be.rejectedWith(ValidationError);
        });
      });

      describe('update', () => {
        it('custom attribute validation function fails', async () => {
          await expect(
            User.update(
              {
                integer: -1,
              },
              { where: {} },
            ),
          ).to.be.rejectedWith(ValidationError);
        });

        it('when custom model validation function fails', async () => {
          await expect(
            User.update(
              {
                name: 'error',
              },
              { where: {} },
            ),
          ).to.be.rejectedWith(ValidationError);
        });
      });
    });
  });

  describe('custom validation functions returning promises', () => {
    let User: ModelStatic;
    let stub: SinonStub;

    before(() => {
      User = sequelize.define(
        'user',
        {
          name: DataTypes.STRING,
        },
        {
          validate: {
            async customFn() {
              if (this.get('name') === 'error') {
                throw new Error('Error from model validation promise');
              }
            },
          },
        },
      );

      // The typings of queryRaw don't cover the instance being returned when "instance" is set
      stub = sinon.stub(sequelize, 'queryRaw').resolves([User.build(), 1] as any);
    });

    after(() => {
      stub.restore();
    });

    describe('should not throw', () => {
      describe('create', () => {
        it('custom model validation functions are successful', async () => {
          await expect(
            User.create({
              name: 'noerror',
            }),
          ).not.to.be.rejected;
        });
      });

      describe('update', () => {
        it('custom model validation functions are successful', async () => {
          await expect(
            User.update(
              {
                name: 'noerror',
              },
              { where: {} },
            ),
          ).not.to.be.rejected;
        });
      });
    });

    describe('should throw validationerror', () => {
      describe('create', () => {
        it('custom model validation function fails', async () => {
          await expect(
            User.create({
              name: 'error',
            }),
          ).to.be.rejectedWith(ValidationError);
        });
      });

      describe('update', () => {
        it('when custom model validation function fails', async () => {
          await expect(
            User.update(
              {
                name: 'error',
              },
              { where: {} },
            ),
          ).to.be.rejectedWith(ValidationError);
        });
      });
    });
  });

  describe('custom validation functions and null values', () => {
    let customValidator: SinonSpy;

    before(() => {
      customValidator = sinon.fake(function (this: { integer: unknown }, value: unknown) {
        if (value === null && this.integer !== 10) {
          throw new Error("name can't be null unless integer is 10");
        }
      });
    });

    describe('with allowNull set to true', () => {
      let User: ModelStatic;
      let stub: SinonStub;

      before(() => {
        User = sequelize.define('user', {
          integer: DataTypes.INTEGER,
          name: {
            type: DataTypes.STRING,
            allowNull: true,
            validate: {
              customValidator,
            },
          },
        });

        // The typings of queryRaw don't cover the instance being returned when "instance" is set
        stub = sinon.stub(sequelize, 'queryRaw').resolves([User.build(), 1] as any);
      });

      after(() => {
        stub.restore();
      });

      describe('should call validator and not throw', () => {
        beforeEach(() => {
          customValidator.resetHistory();
        });

        it('on create', async () => {
          await expect(
            User.create({
              integer: 10,
              name: null,
            }),
          ).not.to.be.rejected;

          expect(customValidator).to.have.been.calledOnce;
        });

        it('on update', async () => {
          await expect(
            User.update(
              {
                integer: 10,
                name: null,
              },
              { where: {} },
            ),
          ).not.to.be.rejected;

          expect(customValidator).to.have.been.calledOnce;
        });
      });

      describe('should call validator and throw ValidationError', () => {
        beforeEach(() => {
          customValidator.resetHistory();
        });

        it('on create', async () => {
          await expect(
            User.create({
              integer: 11,
              name: null,
            }),
          ).to.be.rejectedWith(ValidationError);

          expect(customValidator).to.have.been.calledOnce;
        });

        it('on update', async () => {
          await expect(
            User.update(
              {
                integer: 11,
                name: null,
              },
              { where: {} },
            ),
          ).to.be.rejectedWith(ValidationError);

          expect(customValidator).to.have.been.calledOnce;
        });
      });
    });

    describe('with allowNull set to false', () => {
      let User: ModelStatic;
      let stub: SinonStub;

      before(() => {
        User = sequelize.define('user', {
          integer: DataTypes.INTEGER,
          name: {
            type: DataTypes.STRING,
            allowNull: false,
            validate: {
              customValidator,
            },
          },
        });

        // The typings of queryRaw don't cover the instance being returned when "instance" is set
        stub = sinon.stub(sequelize, 'queryRaw').resolves([User.build(), 1] as any);
      });

      after(() => {
        stub.restore();
      });

      describe('should not call validator and throw ValidationError', () => {
        beforeEach(() => {
          customValidator.resetHistory();
        });

        it('on create', async () => {
          await expect(
            User.create({
              integer: 99,
              name: null,
            }),
          ).to.be.rejectedWith(ValidationError);

          expect(customValidator).to.have.not.been.called;
        });

        it('on update', async () => {
          await expect(
            User.update(
              {
                integer: 99,
                name: null,
              },
              { where: {} },
            ),
          ).to.be.rejectedWith(ValidationError);

          expect(customValidator).to.have.not.been.called;
        });
      });

      describe('should call validator and not throw', () => {
        beforeEach(() => {
          customValidator.resetHistory();
        });

        it('on create', async () => {
          await expect(
            User.create({
              integer: 99,
              name: 'foo',
            }),
          ).not.to.be.rejected;

          expect(customValidator).to.have.been.calledOnce;
        });

        it('on update', async () => {
          await expect(
            User.update(
              {
                integer: 99,
                name: 'foo',
              },
              { where: {} },
            ),
          ).not.to.be.rejected;

          expect(customValidator).to.have.been.calledOnce;
        });
      });
    });
  });
});
