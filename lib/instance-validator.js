'use strict';

var Validator = require('validator')
  , Utils = require('./utils')
  , sequelizeError = require('./errors')
  , Promise = require('./promise')
  , DataTypes = require('./data-types')
  , _ = require('lodash');

function noop() {}

// Deprecate this.
Validator.notNull = function() {
  throw new Error('Warning "notNull" validation has been deprecated in favor of Schema based "allowNull"');
};

// https://github.com/chriso/validator.js/blob/1.5.0/lib/validators.js

Validator.extend('notEmpty', function(str) {
  return !str.match(/^[\s\t\r\n]*$/);
});

Validator.extend('len', function(str, min, max) {
  return this.isLength(str, min, max);
});

Validator.extend('isUrl', function(str) {
  return this.isURL(str);
});

Validator.extend('isIPv6', function(str) {
  return this.isIP(str, 6);
});

Validator.extend('isIPv4', function(str) {
  return this.isIP(str, 4);
});

Validator.extend('notIn', function(str, values) {
  return !this.isIn(str, values);
});

Validator.extend('regex', function(str, pattern, modifiers) {
  str += '';
  if (Object.prototype.toString.call(pattern).slice(8, -1) !== 'RegExp') {
    pattern = new RegExp(pattern, modifiers);
  }
  return str.match(pattern);
});

Validator.extend('notRegex', function(str, pattern, modifiers) {
  return !this.regex(str, pattern, modifiers);
});

Validator.extend('isDecimal', function(str) {
  return str !== '' && str.match(/^(?:-?(?:[0-9]+))?(?:\.[0-9]*)?(?:[eE][\+\-]?(?:[0-9]+))?$/);
});

Validator.extend('min', function(str, val) {
  var number = parseFloat(str);
  return isNaN(number) || number >= val;
});

Validator.extend('max', function(str, val) {
  var number = parseFloat(str);
  return isNaN(number) || number <= val;
});

Validator.extend('not', function(str, pattern, modifiers) {
  return this.notRegex(str, pattern, modifiers);
});

Validator.extend('contains', function(str, elem) {
  return str.indexOf(elem) >= 0 && !!elem;
});

Validator.extend('notContains', function(str, elem) {
  return !this.contains(str, elem);
});

Validator.extend('is', function(str, pattern, modifiers) {
  return this.regex(str, pattern, modifiers);
});

function extendModelValidations(modelInstance) {
  Validator.extend('isImmutable', function(str, param, field) {
    return (modelInstance.isNewRecord || modelInstance.dataValues[field] === modelInstance._previousDataValues[field]);
  });
}


/**
 * The Main DAO Validator.
 *
 * @param {DAO} modelInstance The model instance.
 * @param {Object} options A dict with options.
 * @constructor
 */
var InstanceValidator = module.exports = function(modelInstance, options) {
  options = options || {};

  // assign defined and default options
  this.options = Utils._.defaults(options, {
    skip: []
  });

  this.modelInstance = modelInstance;

  /**
   * Exposes a reference to validator.js. This allows you to add custom validations using `Validator.extend`
   * @name Validator
   */
  this.Validator = Validator;

  /**
   *  All errors will be stored here from the validations.
   *
   * @type {Array} Will contain keys that correspond to attributes which will
   *   be Arrays of Errors.
   */
  this.errors = [];

  /** @type {boolean} Indicates if validations are in progress */
  this.inProgress = false;

  extendModelValidations(modelInstance);
};

/** @define {string} The error key for arguments as passed by custom validators */
InstanceValidator.RAW_KEY_NAME = '__raw';

/**
 * The main entry point for the Validation module, invoke to start the dance.
 *
 * @return {Promise}
 */
InstanceValidator.prototype.validate = function() {
  if (this.inProgress) {
    throw new Error('Validations already in progress.');
  }
  this.inProgress = true;

  var self = this;
  return Promise.settle([
    self._builtinValidators(),
    self._customValidators()
  ]).then(function() {
    if (self.errors.length) {
      return new sequelizeError.ValidationError('Validation error', self.errors);
    }

    return new Promise(function(resolve) {
      resolve();
    });
  });
};

/**
 * Invoke the Validation sequence:
 *   - Before Validation Model Hooks
 *   - Validation
 *   - After Validation Model Hooks
 *
 * @return {Promise}
 */
InstanceValidator.prototype.hookValidate = function() {
  var self = this;
  return self.modelInstance.Model.runHooks('beforeValidate', self.modelInstance, self.options).then(function() {
    return self.validate().then(function(error) {
      if (error) {
        throw error;
      }
    });
  }).then(function() {
    return self.modelInstance.Model.runHooks('afterValidate', self.modelInstance, self.options);
  }).return(self.modelInstance);
};

/**
 * Will run all the built-in validators.
 *
 * @return {Promise(Array.<Promise.PromiseInspection>)} A promise from .settle().
 * @private
 */
InstanceValidator.prototype._builtinValidators = function() {
  var self = this;

  // promisify all attribute invocations
  var validators = [];
  Utils._.forIn(this.modelInstance.rawAttributes, function(rawAttribute, field) {
    if (self.options.skip.indexOf(field) >= 0) {
      return;
    }

    var value = self.modelInstance.dataValues[field];

    if (!rawAttribute._autoGenerated && !rawAttribute.autoIncrement) {
      // perform validations based on schema
      self._validateSchema(rawAttribute, field, value);
    }

    if (self.modelInstance.validators.hasOwnProperty(field)) {
      validators.push(self._builtinAttrValidate.call(self, value, field));
    }
  });

  return Promise.settle(validators);
};

/**
 * Will run all the custom validators.
 *
 * @return {Promise(Array.<Promise.PromiseInspection>)} A promise from .settle().
 * @private
 */
InstanceValidator.prototype._customValidators = function() {

  var validators = [];
  var self = this;
  Utils._.each(this.modelInstance.__options.validate, function(validator,
    validatorType) {

    var valprom = self._invokeCustomValidator(validator, validatorType)
      // errors are handled in settling, stub this
      .catch(noop);

    validators.push(valprom);
  });

  return Promise.settle(validators);
};

/**
 * Validate a single attribute with all the defined built-in validators.
 *
 * @param {*} value Anything.
 * @param {string} field The field name.
 * @return {Promise} A promise, will always resolve,
 *   auto populates error on this.error local object.
 * @private
 */
InstanceValidator.prototype._builtinAttrValidate = function(value, field) {
  var self = this;
  // check if value is null (if null not allowed the Schema pass will capture it)
  if (value === null || typeof value === 'undefined') {
    return Promise.resolve();
  }

  // Promisify each validator
  var validators = [];
  Utils._.forIn(this.modelInstance.validators[field], function(test,
    validatorType) {
    if (['isUrl', 'isURL'].indexOf(validatorType) !== -1 && test === true) {
      // Preserve backwards compat. Validator.js now expects the second param to isURL to be an object
      test = {};
    }


    // Check for custom validator.
    if (typeof test === 'function') {
      return validators.push(self._invokeCustomValidator(test, validatorType, true, value, field));
    }

    var validatorPromise = self._invokeBuiltinValidator(value, test, validatorType, field);
    // errors are handled in settling, stub this
    validatorPromise.catch(noop);
    validators.push(validatorPromise);
  });

  return Promise.settle(validators)
    .then(this._handleSettledResult.bind(this, field));
};

/**
 * Prepare and invoke a custom validator.
 *
 * @param {Function} validator The custom validator.
 * @param {string} validatorType the custom validator type (name).
 * @param {boolean=} optAttrDefined Set to true if custom validator was defined
 *   from the Attribute
 * @return {Promise} A promise.
 * @private
 */
InstanceValidator.prototype._invokeCustomValidator = Promise.method(function(validator, validatorType, optAttrDefined, optValue, optField) {
  var validatorFunction = null;  // the validation function to call
  var isAsync = false;

  var validatorArity = validator.length;
  // check if validator is async and requires a callback
  var asyncArity = 1;
  var errorKey = validatorType;
  var invokeArgs;
  if (optAttrDefined) {
    asyncArity = 2;
    invokeArgs = optValue;
    errorKey = optField;
  }
  if (validatorArity === asyncArity) {
    isAsync = true;
  }

  if (isAsync) {
    if (optAttrDefined) {
      validatorFunction = Promise.promisify(validator.bind(this.modelInstance, invokeArgs));
    } else {
      validatorFunction = Promise.promisify(validator.bind(this.modelInstance));
    }
    return validatorFunction()
      .catch(this._pushError.bind(this, false, errorKey));
  } else {
    return Promise.try(validator.bind(this.modelInstance, invokeArgs))
      .catch(this._pushError.bind(this, false, errorKey));
  }
});

/**
 * Prepare and invoke a build-in validator.
 *
 * @param {*} value Anything.
 * @param {*} test The test case.
 * @param {string} validatorType One of known to Sequelize validators.
 * @param {string} field The field that is being validated
 * @return {Object} An object with specific keys to invoke the validator.
 * @private
 */
InstanceValidator.prototype._invokeBuiltinValidator = Promise.method(function(value, test, validatorType, field) {

  // check if Validator knows that kind of validation test
  if (typeof Validator[validatorType] !== 'function') {
    throw new Error('Invalid validator function: ' + validatorType);
  }

  // extract extra arguments for the validator
  var validatorArgs = test.hasOwnProperty('args') || test.hasOwnProperty('msg') ? test.args : test;

  // extract the error msg
  var errorMessage = test.hasOwnProperty('msg') && test.msg ? test.msg :
    'Validation ' + validatorType + ' failed';

  if (!Array.isArray(validatorArgs)) {
    validatorArgs = [validatorArgs];
  } else {
    validatorArgs = validatorArgs.slice(0);
  }
  validatorArgs.push(field);
  if (!Validator[validatorType].apply(Validator, [value].concat(validatorArgs))) {
    throw errorMessage;
  }
});

/**
 * Will validate a single field against its schema definition (isnull).
 *
 * @param {Object} rawAttribute As defined in the Schema.
 * @param {string} field The field name.
 * @param {*} value anything.
 * @private
 */
InstanceValidator.prototype._validateSchema = function(rawAttribute, field, value) {
  var error;

  if (rawAttribute.allowNull === false && ((value === null) || (value === undefined))) {
    error = new sequelizeError.ValidationErrorItem(field + ' cannot be null', 'notNull Violation', field, value);
    this.errors.push(error);
  }

  if (rawAttribute.type === DataTypes.STRING || rawAttribute.type instanceof DataTypes.STRING || rawAttribute.type === DataTypes.TEXT) {
    if (Array.isArray(value) || (_.isObject(value) && !value._isSequelizeMethod) && !Buffer.isBuffer(value)) {
      error = new sequelizeError.ValidationErrorItem(field + ' cannot be an array or an object', 'string violation', field, value);
      this.errors.push(error);
    }
  }
};


/**
 * Handles the returned result of a Promise.settle.
 *
 * If errors are found it populates this.error.
 *
 * @param {string} field The attribute name.
 * @param {Array.<Promise.PromiseInspection>} Promise inspection objects.
 * @private
 */
InstanceValidator.prototype._handleSettledResult = function(field, promiseInspections) {
  var self = this;
  promiseInspections.forEach(function(promiseInspection) {
    if (promiseInspection.isRejected()) {
      var rejection = promiseInspection.error();
      self._pushError(true, field, rejection);
    }
  });
};

/**
 * Signs all errors retaining the original.
 *
 * @param {boolean} isBuiltin Determines if error is from builtin validator.
 * @param {string} errorKey The error key to assign on this.errors object.
 * @param {Error|string} rawError The original error.
 * @private
 */
InstanceValidator.prototype._pushError = function(isBuiltin, errorKey, rawError) {
  var message = rawError.message || rawError || 'Validation error';
  var error = new sequelizeError.ValidationErrorItem(message, 'Validation error', errorKey, rawError);
  error[InstanceValidator.RAW_KEY_NAME] = rawError;

  this.errors.push(error);
};
