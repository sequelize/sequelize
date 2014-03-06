var Validator = require("validator")
  , Utils     = require("./utils")
  , sequelizeError = require("./errors")
  , Promise = require("bluebird")

// Backwards compat for people using old validation function
// We cannot use .extend, since it coerces the first arg to string
Validator.notNull = function (val) {
  return [null, undefined].indexOf(val) === -1
}

// https://github.com/chriso/validator.js/blob/1.5.0/lib/validators.js

Validator.extend('notEmpty', function(str) {
  return !str.match(/^[\s\t\r\n]*$/);
})

Validator.extend('len', function(str, min, max) {
  return this.isLength(str, min, max)
})

Validator.extend('isUrl', function(str) {
  return this.isURL(str)
})

Validator.extend('isIPv6', function(str) {
  return this.isIP(str, 6)
})

Validator.extend('isIPv4', function(str) {
  return this.isIP(str, 4)
})

Validator.extend('notIn', function(str, values) {
  return !this.isIn(str, values)
})

Validator.extend('regex', function(str, pattern, modifiers) {
  str += '';
  if (Object.prototype.toString.call(pattern).slice(8, -1) !== 'RegExp') {
    pattern = new RegExp(pattern, modifiers);
  }
  return str.match(pattern);
})

Validator.extend('notRegex', function(str, pattern, modifiers) {
  return !this.regex(str, pattern, modifiers);
})

Validator.extend('isDecimal', function(str) {
  return str !== '' && str.match(/^(?:-?(?:[0-9]+))?(?:\.[0-9]*)?(?:[eE][\+\-]?(?:[0-9]+))?$/);
})

Validator.extend('min', function(str, val) {
  var number = parseFloat(str);
  return isNaN(number) || number >= val;
})

Validator.extend('max', function(str, val) {
  var number = parseFloat(str);
  return isNaN(number) || number <= val;
})

Validator.extend('not', function(str, pattern, modifiers) {
  return this.notRegex(str, pattern, modifiers);
})

Validator.extend('contains', function(str, elem) {
  return str.indexOf(elem) >= 0 && !!elem;
})

Validator.extend('notContains', function(str, elem) {
  return !this.contains(str, elem);
})

Validator.extend('is', function(str, pattern, modifiers) {
  return this.regex(str, pattern, modifiers);
})

/**
 * The Main DAO Validator.
 *
 * @param {sequelize.Model} modelInstance The model instance.
 * @param {Object} options A dict with options.
 * @constructor
 */
var DaoValidator = module.exports = function(modelInstance, options) {
  options = options || {}
  options.skip = options.skip || []

  this.modelInstance   = modelInstance
  this.chainer = new Utils.QueryChainer()
  this.options = options

  /**
   * Expose validator.js to allow users to extend
   * @name Validator
   */
  this.Validator = Validator

  /**
   *  All errors will be stored here from the validations.
   *
   * @type {Object} Will contain keys that correspond to attributes which will
   *   be Arrays of Errors.
   */
  this.errors = {};

  /** @type {boolean} Indicates if validations are in progress */
  this.inProgress = false;
}

/** @define {string} The error key for arguments as passed by custom validators */
DaoValidator.RAW_KEY_NAME = '__raw'

/**
 * The main entry point for the Validation module, invoke to start the dance.
 *
 * @return {sequelize.Utils.CustomEventEmitter} That thing...
 */
DaoValidator.prototype.validate = function() {
  if (this.inProgress) {
    throw new Error('Validations already in progress.');
  }
  this.inProgress = true;
  this.errors = [];

  var self = this
  return new Utils.CustomEventEmitter(function(emitter) {
    Promise.settle([
      self._validateAttributes(),
      self._validateSchema(),
    ]).then(function () {
      emitter.emit('success')
    }).catch(function(err) {
        var error = new sequelizeError.ValidationError('Validation error')
        error[DaoValidator.RAW_KEY_NAME] = []

        Utils._.each(err, function (value) {
	  error[DaoValidator.RAW_KEY_NAME].push(value[DaoValidator.RAW_KEY_NAME]);
          delete value[DaoValidator.RAW_KEY_NAME]
          Utils._.extend(error, value)
        })

        emitter.emit('success', error)
      })
  }).run()
}

/**
 * Invoke the Validation sequence:
 *   - Before Validation Model Hooks
 *   - Validation
 *   - After Validation Model Hooks
 *
 * @return {sequelize.Utils.CustomEventEmitter} An eventemitter.
 */
DaoValidator.prototype.hookValidate = function() {
  var self   = this

  return new Utils.CustomEventEmitter(function(emitter) {
    self.modelInstance.Model.runHooks('beforeValidate', self.modelInstance, function(err) {
      if (!!err) {
        return emitter.emit('error', err)
      }

      self.validate().success(function (error) {
        if (!!error) {
          return emitter.emit('error', error)
        }

        self.modelInstance.Model.runHooks('afterValidate', self.modelInstance, function(err) {
          if (!!err) {
            return emitter.emit('error', err)
          }

          emitter.emit('success', self.modelInstance)
        })
      })
    })
  }).run()
}

/**
 * Will validate all attributes based on their schema rules and defined validators.
 *
 * @return {Promise(Array.<Promise.PromiseInspection>)} A promise from .settle().
 * @private
 */
DaoValidator.prototype._validateAttributes = function() {
  var self = this

  // promisify all attribute invocations
  var validators = [];
  _.forIn(this.modelInstance.rawAttributes, function(rawAttribute, field) {
    var value = self.modelInstance.dataValues[field]
    if (self.modelInstance.validators.hasOwnProperty(field)) {

      validators.push(self._validateAttribute(value, field))

    }
  })

  return Promise.settle(validators)
}

/**
 * Will validate a single field against its schema definition (isnull).
 *
 * @param {string} field The field name.
 * @param {*} value anything.
      throw error;
 * @return {Promise} A promise, will always resolve,
 *   auto populates error on this.error local object.
 * @private
 */
DaoValidator.prototype._validateSchema = function(field, value) {
  var self = this;
  return new Promise(function(resolve) {

    var hasAllowedNull = ((rawAttribute === undefined ||
      rawAttribute.allowNull === true) && ((value === null) ||
      (value === undefined)))
    var isSkipped = self.options.skip.length > 0 &&
      self.options.skip.indexOf(field) !== -1

    if (!hasAllowedNull && !isSkipped) {
      var error = new sequelizeError.ValidationError(field + ' cannot be null')
      error.path = field
      error.value = value
      error.type = 'notNull Violation'
      if (!self.errors[field]) {
	self.errors[field] = [];
      }
      self.errors[field].push(error);
    }

    resolve();
  });
};

/**
 * Validate a single attribute with all the defined validators.
 *
 * @param {*} value Anything.
 * @param {string} field The field name.
 * @return {Promise} A promise, will always resolve,
 *   auto populates error on this.error local object.
 * @private
 */
DaoValidator.prototype._validateAttribute = function(value, field) {
  var self = this;
  // Promisify each validator
  var validators = [];
  Utils._.forIn(this.modelInstance.validators[field], function(details,
    validatorType) {

    var validator = self._prepareValidationOfAttribute.call(self, value, details,
      validatorType);

    validators.push(Promise.nodeify(validator));
  });

  return Promise.settle(validators)
    .then(this._handleSettledResult.bind(this, field));
};

/**
 * Prepare Attribute for validation.
 *
 * @param {*} value Anything
 * @param {Function} validator The validator.
 * @param {string} validatorType One of known to Sequelize validators.
 * @param {Object=} optOptions Options
 * @return {Object} An object with specific keys to invoke the validator.
 * @private
 */
DaoValidator.prototype._prepareValidationOfAttribute = function(value, validator,
  validatorType, optOptions) {
  var isCustomValidator = false // if true then it's a custom validation method
    , validatorFunction = null  // the validation function to call

  // it is a custom validator function?
  isCustomValidator = true

  var validatorArity = validator.length;
  var callArgs = []
  var options = optOptions || {}
  var omitValue = !!options.omitValue

  if (!omitValue) {
    callArgs.push(value)
  }

  // check if validator is async and requires a callback
  var isAsync = false
  if (omitValue && validatorArity === 1 || !omitValue && validatorArity === 2) {
    isAsync = true;
  }

  validatorFunction = Promise.nodeify(validator.bind(this.modelInstance))

  return {
    fn:       validatorFunction,
    msg:      errorMessage,
    args:     validatorArgs,
    isCustom: isCustomValidator
  }
}

/**
 * Handles the returned result of a Promise.settle.
 *
 * If errors are found it populates this.error and throws an Array of the errors.
 *
 * @param {string} field The attribute name.
 * @param {Array.<Promise.PromiseInspection>} Promise inspection objects.
 * @private
 */
DaoValidator.prototype._handleSettleResult = function(field, promiseInspections) {
  var self = this;
  promiseInspections.forEach(function(promiseInspection) {
    if (promiseInspection.isRejected) {
      var rejection = promiseInspection.error();
      var error = new sequelizeError.ValidationError('Validation error')
      error[DaoValidator.RAW_KEY_NAME] = rejection
      if (!self.errors[field]) {
	self.errors[field] = [];
      }
      self.errors[field].push(error);
    }
  });
};
