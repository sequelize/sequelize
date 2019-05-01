'use strict';

const chai = require('chai');
const expect = chai.expect;
const Support = require('./support');
const InstanceValidator = require('../../lib/instance-validator');
const sinon = require('sinon');
const SequelizeValidationError = require('../../lib/errors').ValidationError;

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
      const instanceValidator = new InstanceValidator(new this.User(), { hooks: true });
      const _validate = sinon.spy(instanceValidator, '_validate');
      const _validateAndRunHooks = sinon.spy(instanceValidator, '_validateAndRunHooks');

      instanceValidator.validate();

      expect(_validateAndRunHooks).to.have.been.calledOnce;
      expect(_validate).to.not.have.been.called;
    });

    it('runs the validation sequence but skips hooks if the hooks option is false', function() {
      const instanceValidator = new InstanceValidator(new this.User(), { hooks: false });
      const _validate = sinon.spy(instanceValidator, '_validate');
      const _validateAndRunHooks = sinon.spy(instanceValidator, '_validateAndRunHooks');

      instanceValidator.validate();

      expect(_validate).to.have.been.calledOnce;
      expect(_validateAndRunHooks).to.not.have.been.called;
    });

    it('fulfills when validation is successful', function() {
      const instanceValidator = new InstanceValidator(new this.User());
      const result = instanceValidator.validate();

      return expect(result).to.be.fulfilled;
    });

    it('rejects with a validation error when validation fails', function() {
      const instanceValidator = new InstanceValidator(new this.User({ fails: true }));
      const result = instanceValidator.validate();

      return expect(result).to.be.rejectedWith(SequelizeValidationError);
    });

    it('has a useful default error message for not null validation failures', () => {
      const User = Support.sequelize.define('user', {
        name: {
          type: Support.Sequelize.STRING,
          allowNull: false
        }
      });

      const instanceValidator = new InstanceValidator(new User());
      const result = instanceValidator.validate();

      return expect(result).to.be.rejectedWith(SequelizeValidationError, /user\.name cannot be null/);
    });
  });

  describe('_validateAndRunHooks', () => {
    beforeEach(function() {
      this.successfulInstanceValidator = new InstanceValidator(new this.User());
      sinon.stub(this.successfulInstanceValidator, '_validate').resolves();
    });

    it('should run beforeValidate and afterValidate hooks when _validate is successful', function() {
      const beforeValidate = sinon.spy();
      const afterValidate = sinon.spy();
      this.User.addHook('beforeValidate', beforeValidate);
      this.User.addHook('afterValidate', afterValidate);

      return expect(this.successfulInstanceValidator._validateAndRunHooks()).to.be.fulfilled.then(() => {
        expect(beforeValidate).to.have.been.calledOnce;
        expect(afterValidate).to.have.been.calledOnce;
      });
    });

    it('should run beforeValidate hook but not afterValidate hook when _validate is unsuccessful', function() {
      const failingInstanceValidator = new InstanceValidator(new this.User());
      sinon.stub(failingInstanceValidator, '_validate').rejects(new Error());
      const beforeValidate = sinon.spy();
      const afterValidate = sinon.spy();
      this.User.addHook('beforeValidate', beforeValidate);
      this.User.addHook('afterValidate', afterValidate);

      return expect(failingInstanceValidator._validateAndRunHooks()).to.be.rejected.then(() => {
        expect(beforeValidate).to.have.been.calledOnce;
        expect(afterValidate).to.not.have.been.called;
      });
    });

    it('should emit an error from after hook when afterValidate fails', function() {
      this.User.addHook('afterValidate', () => {
        throw new Error('after validation error');
      });

      return expect(this.successfulInstanceValidator._validateAndRunHooks()).to.be.rejectedWith('after validation error');
    });

    describe('validatedFailed hook', () => {
      it('should call validationFailed hook when validation fails', function() {
        const failingInstanceValidator = new InstanceValidator(new this.User());
        sinon.stub(failingInstanceValidator, '_validate').rejects(new Error());
        const validationFailedHook = sinon.spy();
        this.User.addHook('validationFailed', validationFailedHook);

        return expect(failingInstanceValidator._validateAndRunHooks()).to.be.rejected.then(() => {
          expect(validationFailedHook).to.have.been.calledOnce;
        });
      });

      it('should not replace the validation error in validationFailed hook by default', function() {
        const failingInstanceValidator = new InstanceValidator(new this.User());
        sinon.stub(failingInstanceValidator, '_validate').rejects(new SequelizeValidationError());
        const validationFailedHook = sinon.stub().resolves();
        this.User.addHook('validationFailed', validationFailedHook);

        return expect(failingInstanceValidator._validateAndRunHooks()).to.be.rejected.then(err => {
          expect(err.name).to.equal('SequelizeValidationError');
        });
      });

      it('should replace the validation error if validationFailed hook creates a new error', function() {
        const failingInstanceValidator = new InstanceValidator(new this.User());
        sinon.stub(failingInstanceValidator, '_validate').rejects(new SequelizeValidationError());
        const validationFailedHook = sinon.stub().throws(new Error('validation failed hook error'));
        this.User.addHook('validationFailed', validationFailedHook);

        return expect(failingInstanceValidator._validateAndRunHooks()).to.be.rejected.then(err => {
          expect(err.message).to.equal('validation failed hook error');
        });
      });
    });
  });
});
