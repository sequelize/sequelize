'use strict';

const chai = require('chai'),
  sinon = require('sinon'),
  expect = chai.expect,
  Sequelize = require('sequelize'),
  Op = Sequelize.Op,
  Support = require('../support'),
  current = Support.sequelize;


describe(Support.getTestDialectTeaser('InstanceValidator'), () => {
  describe('validations', () => {
    const checks = {
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
      },
      isUrl: {
        fail: 'abc',
        pass: 'http://abc.com'
      },
      isIP: {
        fail: 'abc',
        pass: '129.89.23.1'
      },
      isIPv4: {
        fail: 'abc',
        pass: '129.89.23.1'
      },
      isIPv6: {
        fail: '1111:2222:3333::5555:',
        pass: 'fe80:0000:0000:0000:0204:61ff:fe9d:f156'
      },
      isAlpha: {
        stringOrBoolean: true,
        spec: { args: 'en-GB' },
        fail: '012',
        pass: 'abc'
      },
      isAlphanumeric: {
        stringOrBoolean: true,
        spec: { args: 'en-GB' },
        fail: '_abc019',
        pass: 'abc019'
      },
      isNumeric: {
        fail: 'abc',
        pass: '019'
      },
      isInt: {
        fail: '9.2',
        pass: '-9'
      },
      isLowercase: {
        fail: 'AB',
        pass: 'ab'
      },
      isUppercase: {
        fail: 'ab',
        pass: 'AB'
      },
      isDecimal: {
        fail: 'a',
        pass: '0.2'
      },
      isFloat: {
        fail: 'a',
        pass: '9.2'
      },
      isNull: {
        fail: 0,
        pass: null
      },
      notEmpty: {
        fail: '       ',
        pass: 'a'
      },
      equals: {
        spec: { args: 'bla bla bla' },
        fail: 'bla',
        pass: 'bla bla bla'
      },
      contains: {
        spec: { args: 'bla' },
        fail: 'la',
        pass: '0bla23'
      },
      notContains: {
        spec: { args: 'bla' },
        fail: '0bla23',
        pass: 'la'
      },
      regex: {
        spec: { args: ['[a-z]', 'i'] },
        fail: '0',
        pass: 'a'
      },
      notRegex: {
        spec: { args: ['[a-z]', 'i'] },
        fail: 'a',
        pass: '0'
      },
      len: {
        spec: { args: [2, 4] },
        fail: ['1', '12345'],
        pass: ['12', '123', '1234'],
        raw: true
      },
      len$: {
        spec: [2, 4],
        fail: ['1', '12345'],
        pass: ['12', '123', '1234'],
        raw: true
      },
      isUUID: {
        spec: { args: 4 },
        fail: 'f47ac10b-58cc-3372-a567-0e02b2c3d479',
        pass: 'f47ac10b-58cc-4372-a567-0e02b2c3d479'
      },
      isDate: {
        fail: 'not a date',
        pass: '2011-02-04'
      },
      isAfter: {
        spec: { args: '2011-11-05' },
        fail: '2011-11-04',
        pass: '2011-11-06'
      },
      isBefore: {
        spec: { args: '2011-11-05' },
        fail: '2011-11-06',
        pass: '2011-11-04'
      },
      isIn: {
        spec: { args: 'abcdefghijk' },
        fail: 'ghik',
        pass: 'ghij'
      },
      notIn: {
        spec: { args: 'abcdefghijk' },
        fail: 'ghij',
        pass: 'ghik'
      },
      max: {
        spec: { args: 23 },
        fail: '24',
        pass: '23'
      },
      max$: {
        spec: 23,
        fail: '24',
        pass: '23'
      },
      min: {
        spec: { args: 23 },
        fail: '22',
        pass: '23'
      },
      min$: {
        spec: 23,
        fail: '22',
        pass: '23'
      },
      isCreditCard: {
        fail: '401288888888188f',
        pass: '4012888888881881'
      }
    };

    const applyFailTest = function applyFailTest(validatorDetails, i, validator) {
        const failingValue = validatorDetails.fail[i];
        it(`correctly specifies an instance as invalid using a value of "${failingValue}" for the validation "${validator}"`, async function() {
          const validations = {},
            message = `${validator}(${failingValue})`;

          validations[validator] = validatorDetails.spec || {};
          validations[validator].msg = message;

          const UserFail = this.sequelize.define(`User${Support.rand()}`, {
            name: {
              type: Sequelize.STRING,
              validate: validations
            }
          });

          const failingUser = UserFail.build({ name: failingValue });

          const _errors = await expect(failingUser.validate()).to.be.rejected;
          expect(_errors.get('name')[0].message).to.equal(message);
          expect(_errors.get('name')[0].value).to.equal(failingValue);
        });
      },
      applyPassTest = function applyPassTest(validatorDetails, j, validator, type) {
        const succeedingValue = validatorDetails.pass[j];
        it(`correctly specifies an instance as valid using a value of "${succeedingValue}" for the validation "${validator}"`, async function() {
          const validations = {},
            message = `${validator}(${succeedingValue})`;

          validations[validator] = validatorDetails.spec || {};

          if (type === 'msg') {
            validations[validator].msg = message;
          } else if (type === 'args') {
            validations[validator].args = validations[validator].args || true;
            validations[validator].msg = message;
          } else if (type === 'true') {
            validations[validator] = true;
          }

          const UserSuccess = this.sequelize.define(`User${Support.rand()}`, {
            name: {
              type: Sequelize.STRING,
              validate: validations
            }
          });
          const successfulUser = UserSuccess.build({ name: succeedingValue });
          await expect(successfulUser.validate()).not.to.be.rejected;
        });
      };

    for (let validator in checks) {
      if (checks.hasOwnProperty(validator)) {
        validator = validator.replace(/\$$/, '');
        const validatorDetails = checks[validator];

        if (!validatorDetails.raw) {
          validatorDetails.fail = Array.isArray(validatorDetails.fail) ? validatorDetails.fail : [validatorDetails.fail];
          validatorDetails.pass = Array.isArray(validatorDetails.pass) ? validatorDetails.pass : [validatorDetails.pass];
        }

        for (let i = 0; i < validatorDetails.fail.length; i++) {
          applyFailTest(validatorDetails, i, validator);
        }

        for (let i = 0; i < validatorDetails.pass.length; i++) {
          applyPassTest(validatorDetails, i, validator);
          applyPassTest(validatorDetails, i, validator, 'msg');
          applyPassTest(validatorDetails, i, validator, 'args');
          if (validatorDetails.stringOrBoolean || validatorDetails.spec === undefined) {
            applyPassTest(validatorDetails, i, validator, 'true');
          }
        }
      }
    }
  });

  describe('datatype validations', () => {
    const current = Support.createSequelizeInstance({
      typeValidation: true
    });

    const User = current.define('user', {
      age: Sequelize.INTEGER,
      name: Sequelize.STRING,
      awesome: Sequelize.BOOLEAN,
      number: Sequelize.DECIMAL,
      uid: Sequelize.UUID,
      date: Sequelize.DATE
    });

    before(function() {
      this.stub = sinon.stub(current, 'query').callsFake(async () => Promise.resolve([User.build({}), 1]));
    });

    after(function() {
      this.stub.restore();
    });

    describe('should not throw', () => {
      describe('create', () => {
        it('should allow number as a string', async () => {
          await expect(User.create({
            age: '12'
          })).not.to.be.rejected;
        });

        it('should allow decimal as a string', async () => {
          await expect(User.create({
            number: '12.6'
          })).not.to.be.rejected;
        });

        it('should allow dates as a string', async () => {
          await expect(User.findOne({
            where: {
              date: '2000-12-16'
            }
          })).not.to.be.rejected;
        });

        it('should allow decimal big numbers as a string', async () => {
          await expect(User.create({
            number: '2321312301230128391820831289123012'
          })).not.to.be.rejected;
        });

        it('should allow decimal as scientific notation', async () => {
          await Promise.all([expect(User.create({
            number: '2321312301230128391820e219'
          })).not.to.be.rejected, expect(User.create({
            number: '2321312301230128391820e+219'
          })).not.to.be.rejected, expect(User.create({
            number: '2321312301230128391820f219'
          })).to.be.rejected]);
        });

        it('should allow string as a number', async () => {
          await expect(User.create({
            name: 12
          })).not.to.be.rejected;
        });

        it('should allow 0/1 as a boolean', async () => {
          await expect(User.create({
            awesome: 1
          })).not.to.be.rejected;
        });

        it('should allow 0/1 string as a boolean', async () => {
          await expect(User.create({
            awesome: '1'
          })).not.to.be.rejected;
        });

        it('should allow true/false string as a boolean', async () => {
          await expect(User.create({
            awesome: 'true'
          })).not.to.be.rejected;
        });
      });

      describe('findAll', () => {
        it('should allow $in', async () => {
          await expect(User.findAll({
            where: {
              name: {
                [Op.like]: {
                  [Op.any]: ['foo%', 'bar%']
                }
              }
            }
          })).not.to.be.rejected;
        });

        it('should allow $like for uuid', async () => {
          await expect(User.findAll({
            where: {
              uid: {
                [Op.like]: '12345678%'
              }
            }
          })).not.to.be.rejected;
        });
      });
    });

    describe('should throw validationerror', () => {

      describe('create', () => {
        it('should throw when passing string', async () => {
          await expect(User.create({
            age: 'jan'
          })).to.be.rejectedWith(Sequelize.ValidationError)
            .which.eventually.have.property('errors')
            .that.is.an('array')
            .with.lengthOf(1)
            .and.with.property(0)
            .that.is.an.instanceOf(Sequelize.ValidationErrorItem)
            .and.include({
              type: 'Validation error',
              path: 'age',
              value: 'jan',
              instance: null,
              validatorKey: 'INTEGER validator'
            });
        });

        it('should throw when passing decimal', async () => {
          await expect(User.create({
            age: 4.5
          })).to.be.rejectedWith(Sequelize.ValidationError)
            .which.eventually.have.property('errors')
            .that.is.an('array')
            .with.lengthOf(1)
            .and.with.property(0)
            .that.is.an.instanceOf(Sequelize.ValidationErrorItem)
            .and.include({
              type: 'Validation error',
              path: 'age',
              value: 4.5,
              instance: null,
              validatorKey: 'INTEGER validator'
            });
        });
      });

      describe('update', () => {
        it('should throw when passing string', async () => {
          await expect(User.update({
            age: 'jan'
          }, { where: {} })).to.be.rejectedWith(Sequelize.ValidationError)
            .which.eventually.have.property('errors')
            .that.is.an('array')
            .with.lengthOf(1)
            .and.with.property(0)
            .that.is.an.instanceOf(Sequelize.ValidationErrorItem)
            .and.include({
              type: 'Validation error',
              path: 'age',
              value: 'jan',
              instance: null,
              validatorKey: 'INTEGER validator'
            });
        });

        it('should throw when passing decimal', async () => {
          await expect(User.update({
            age: 4.5
          }, { where: {} })).to.be.rejectedWith(Sequelize.ValidationError)
            .which.eventually.have.property('errors')
            .that.is.an('array')
            .with.lengthOf(1)
            .and.with.property(0)
            .that.is.an.instanceOf(Sequelize.ValidationErrorItem)
            .and.include({
              type: 'Validation error',
              path: 'age',
              value: 4.5,
              instance: null,
              validatorKey: 'INTEGER validator'
            });
        });
      });

    });
  });

  describe('custom validation functions', () => {

    const User = current.define('user', {
      age: {
        type: Sequelize.INTEGER,
        validate: {
          customFn(val, next) {
            if (val < 0) {
              next('age must be greater or equal zero');
            } else {
              next();
            }
          }
        }
      },
      name: Sequelize.STRING
    }, {
      validate: {
        customFn() {
          if (this.get('name') === 'error') {
            throw new Error('Error from model validation promise');
          }
        }
      }
    });

    before(function() {
      this.stub = sinon.stub(current, 'query').resolves([User.build(), 1]);
    });

    after(function() {
      this.stub.restore();
    });

    describe('should not throw', () => {
      describe('create', () => {
        it('custom validation functions are successful', async () => {
          await expect(User.create({
            age: 1,
            name: 'noerror'
          })).not.to.be.rejected;
        });
      });

      describe('update', () => {
        it('custom validation functions are successful', async () => {
          await expect(User.update({
            age: 1,
            name: 'noerror'
          }, { where: {} })).not.to.be.rejected;
        });
      });
    });

    describe('should throw validationerror', () => {

      describe('create', () => {
        it('custom attribute validation function fails', async () => {
          await expect(User.create({
            age: -1
          })).to.be.rejectedWith(Sequelize.ValidationError);
        });

        it('custom model validation function fails', async () => {
          await expect(User.create({
            name: 'error'
          })).to.be.rejectedWith(Sequelize.ValidationError);
        });
      });

      describe('update', () => {
        it('custom attribute validation function fails', async () => {
          await expect(User.update({
            age: -1
          }, { where: {} })).to.be.rejectedWith(Sequelize.ValidationError);
        });

        it('when custom model validation function fails', async () => {
          await expect(User.update({
            name: 'error'
          }, { where: {} })).to.be.rejectedWith(Sequelize.ValidationError);
        });
      });
    });
  });

  describe('custom validation functions returning promises', () => {

    const User = current.define('user', {
      name: Sequelize.STRING
    }, {
      validate: {
        async customFn() {
          if (this.get('name') === 'error') {
            throw new Error('Error from model validation promise');
          }
        }
      }
    });

    before(function() {
      this.stub = sinon.stub(current, 'query').resolves([User.build(), 1]);
    });

    after(function() {
      this.stub.restore();
    });

    describe('should not throw', () => {
      describe('create', () => {
        it('custom model validation functions are successful', async () => {
          await expect(User.create({
            name: 'noerror'
          })).not.to.be.rejected;
        });
      });

      describe('update', () => {
        it('custom model validation functions are successful', async () => {
          await expect(User.update({
            name: 'noerror'
          }, { where: {} })).not.to.be.rejected;
        });
      });
    });

    describe('should throw validationerror', () => {

      describe('create', () => {
        it('custom model validation function fails', async () => {
          await expect(User.create({
            name: 'error'
          })).to.be.rejectedWith(Sequelize.ValidationError);
        });
      });

      describe('update', () => {
        it('when custom model validation function fails', async () => {
          await expect(User.update({
            name: 'error'
          }, { where: {} })).to.be.rejectedWith(Sequelize.ValidationError);
        });
      });
    });
  });

  describe('custom validation functions and null values', () => {

    before(function() {
      this.customValidator = sinon.fake(function(value) {
        if (value === null && this.age !== 10) {
          throw new Error("name can't be null unless age is 10");
        }
      });
    });

    describe('with allowNull set to true', () => {

      before(function() {
        this.User = current.define('user', {
          age: Sequelize.INTEGER,
          name: {
            type: Sequelize.STRING,
            allowNull: true,
            validate: {
              customValidator: this.customValidator
            }
          }
        });

        this.stub = sinon.stub(current, 'query').resolves([this.User.build(), 1]);
      });

      after(function() {
        this.stub.restore();
      });

      describe('should call validator and not throw', () => {
        beforeEach(function() {
          this.customValidator.resetHistory();
        });

        it('on create', async function() {
          await expect(this.User.create({
            age: 10,
            name: null
          })).not.to.be.rejected;

          await expect(this.customValidator).to.have.been.calledOnce;
        });
        it('on update', async function() {
          await expect(this.User.update({
            age: 10,
            name: null
          }, { where: {} })).not.to.be.rejected;

          await expect(this.customValidator).to.have.been.calledOnce;
        });
      });

      describe('should call validator and throw ValidationError', () => {
        beforeEach(function() {
          this.customValidator.resetHistory();
        });

        it('on create', async function() {
          await expect(this.User.create({
            age: 11,
            name: null
          })).to.be.rejectedWith(Sequelize.ValidationError);

          await expect(this.customValidator).to.have.been.calledOnce;
        });
        it('on update', async function() {
          await expect(this.User.update({
            age: 11,
            name: null
          }, { where: {} })).to.be.rejectedWith(Sequelize.ValidationError);

          await expect(this.customValidator).to.have.been.calledOnce;
        });
      });

    });

    describe('with allowNull set to false', () => {

      before(function() {
        this.User = current.define('user', {
          age: Sequelize.INTEGER,
          name: {
            type: Sequelize.STRING,
            allowNull: false,
            validate: {
              customValidator: this.customValidator
            }
          }
        });

        this.stub = sinon.stub(current, 'query').resolves([this.User.build(), 1]);
      });

      after(function() {
        this.stub.restore();
      });

      describe('should not call validator and throw ValidationError', () => {
        beforeEach(function() {
          this.customValidator.resetHistory();
        });

        it('on create', async function() {
          await expect(this.User.create({
            age: 99,
            name: null
          })).to.be.rejectedWith(Sequelize.ValidationError);

          await expect(this.customValidator).to.have.not.been.called;
        });
        it('on update', async function() {
          await expect(this.User.update({
            age: 99,
            name: null
          }, { where: {} })).to.be.rejectedWith(Sequelize.ValidationError);

          await expect(this.customValidator).to.have.not.been.called;
        });
      });

      describe('should call validator and not throw', () => {
        beforeEach(function() {
          this.customValidator.resetHistory();
        });

        it('on create', async function() {
          await expect(this.User.create({
            age: 99,
            name: 'foo'
          })).not.to.be.rejected;

          await expect(this.customValidator).to.have.been.calledOnce;
        });
        it('on update', async function() {
          await expect(this.User.update({
            age: 99,
            name: 'foo'
          }, { where: {} })).not.to.be.rejected;

          await expect(this.customValidator).to.have.been.calledOnce;
        });
      });

    });

  });

});
