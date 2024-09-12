'use strict';

const chai = require('chai');
const expect = chai.expect;
const Support = require('./support');
const InstanceValidator = require('sequelize/lib/instance-validator');
const sinon = require('sinon');
const SequelizeValidationError = require('sequelize/lib/errors').ValidationError;

describe(Support.getTestDialectTeaser('InstanceValidator'), () => {
  beforeEach(function() {
    this.User = Support.sequelize.define('user', {
      fails: {
        type: Support.Sequelize.BOOLEAN,
        validate: {
          isNotTrue(value) {
            if (value) {
              throw Error('Manual model validation failure');
            }
          }
        }
      }
    });
  });

  it('configures itself to run hooks by default', () => {
    const instanceValidator = new InstanceValidator();
    expect(instanceValidator.options.hooks).to.equal(true);
  });

  describe('validate', () => {
    it('runs the validation sequence and hooks when the hooks option is true', function() {
      const instanceValidator = new InstanceValidator(this.User.build(), { hooks: true });
      const _validate = sinon.spy(instanceValidator, '_validate');
      const _validateAndRunHooks = sinon.spy(instanceValidator, '_validateAndRunHooks');

      instanceValidator.validate();

      expect(_validateAndRunHooks).to.have.been.calledOnce;
      expect(_validate).to.not.have.been.called;
    });

    it('runs the validation sequence but skips hooks if the hooks option is false', function() {
      const instanceValidator = new InstanceValidator(this.User.build(), { hooks: false });
      const _validate = sinon.spy(instanceValidator, '_validate');
      const _validateAndRunHooks = sinon.spy(instanceValidator, '_validateAndRunHooks');

      instanceValidator.validate();

      expect(_validate).to.have.been.calledOnce;
      expect(_validateAndRunHooks).to.not.have.been.called;
    });

    it('fulfills when validation is successful', async function() {
      const instanceValidator = new InstanceValidator(this.User.build());
      const result = instanceValidator.validate();

      await expect(result).to.be.fulfilled;
    });

    it('rejects with a validation error when validation fails', async function() {
      const instanceValidator = new InstanceValidator(this.User.build({ fails: true }));
      const result = instanceValidator.validate();

      await expect(result).to.be.rejectedWith(SequelizeValidationError);
    });

    it('has a useful default error message for not null validation failures', async () => {
      const User = Support.sequelize.define('user', {
        name: {
          type: Support.Sequelize.STRING,
          allowNull: false
        }
      });

      const instanceValidator = new InstanceValidator(User.build());
      const result = instanceValidator.validate();

      await expect(result).to.be.rejectedWith(SequelizeValidationError, /user\.name cannot be null/);
    });
  });

  describe('_validateAndRunHooks', () => {
    beforeEach(function() {
      this.successfulInstanceValidator = new InstanceValidator(this.User.build());
      sinon.stub(this.successfulInstanceValidator, '_validate').resolves();
    });

    it('should run beforeValidate and afterValidate hooks when _validate is successful', async function() {
      const beforeValidate = sinon.spy();
      const afterValidate = sinon.spy();
      this.User.beforeValidate(beforeValidate);
      this.User.afterValidate(afterValidate);

      await expect(this.successfulInstanceValidator._validateAndRunHooks()).to.be.fulfilled;
      expect(beforeValidate).to.have.been.calledOnce;
      expect(afterValidate).to.have.been.calledOnce;
    });

    it('should run beforeValidate hook but not afterValidate hook when _validate is unsuccessful', async function() {
      const failingInstanceValidator = new InstanceValidator(this.User.build());
      sinon.stub(failingInstanceValidator, '_validate').rejects(new Error());
      const beforeValidate = sinon.spy();
      const afterValidate = sinon.spy();
      this.User.beforeValidate(beforeValidate);
      this.User.afterValidate(afterValidate);

      await expect(failingInstanceValidator._validateAndRunHooks()).to.be.rejected;
      expect(beforeValidate).to.have.been.calledOnce;
      expect(afterValidate).to.not.have.been.called;
    });

    it('should emit an error from after hook when afterValidate fails', async function() {
      this.User.afterValidate(() => {
        throw new Error('after validation error');
      });

      await expect(this.successfulInstanceValidator._validateAndRunHooks()).to.be.rejectedWith('after validation error');
    });

    describe('validatedFailed hook', () => {
      it('should call validationFailed hook when validation fails', async function() {
        const failingInstanceValidator = new InstanceValidator(this.User.build());
        sinon.stub(failingInstanceValidator, '_validate').rejects(new Error());
        const validationFailedHook = sinon.spy();
        this.User.validationFailed(validationFailedHook);

        await expect(failingInstanceValidator._validateAndRunHooks()).to.be.rejected;
        expect(validationFailedHook).to.have.been.calledOnce;
      });

      it('should not replace the validation error in validationFailed hook by default', async function() {
        const failingInstanceValidator = new InstanceValidator(this.User.build());
        sinon.stub(failingInstanceValidator, '_validate').rejects(new SequelizeValidationError());
        const validationFailedHook = sinon.stub().resolves();
        this.User.validationFailed(validationFailedHook);

        const err = await expect(failingInstanceValidator._validateAndRunHooks()).to.be.rejected;
        expect(err.name).to.equal('SequelizeValidationError');
      });

      it('should replace the validation error if validationFailed hook creates a new error', async function() {
        const failingInstanceValidator = new InstanceValidator(this.User.build());
        sinon.stub(failingInstanceValidator, '_validate').rejects(new SequelizeValidationError());
        const validationFailedHook = sinon.stub().throws(new Error('validation failed hook error'));
        this.User.validationFailed(validationFailedHook);

        const err = await expect(failingInstanceValidator._validateAndRunHooks()).to.be.rejected;
        expect(err.message).to.equal('validation failed hook error');
      });
    });
  });
});
