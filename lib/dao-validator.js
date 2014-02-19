var Validator = require("validator")
  , Utils     = require("./utils")

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

var DaoValidator = module.exports = function(model, options) {
  options = options || {}
  options.skip = options.skip || []

  this.model = model
  this.options = options

  /**
   * Expose validator.js to allow users to extend
   * @name Validator
   */
  this.Validator = Validator
}

DaoValidator.prototype.validate = function() {
  var errors = {}

  errors = Utils._.extend(errors, validateAttributes.call(this))
  errors = Utils._.extend(errors, validateModel.call(this))

  return errors
}

DaoValidator.prototype.hookValidate = function() {
  var self   = this
    , errors = {}

  return new Utils.CustomEventEmitter(function(emitter) {
    self.model.daoFactory.runHooks('beforeValidate', self.model, function(err) {
      if (!!err) {
        return emitter.emit('error', err)
      }

      errors = Utils._.extend(errors, validateAttributes.call(self))
      errors = Utils._.extend(errors, validateModel.call(self))

      if (Object.keys(errors).length > 0) {
        return emitter.emit('error', errors)
      }

      self.model.daoFactory.runHooks('afterValidate', self.model, function(err) {
        if (!!err) {
          return emitter.emit('error', err)
        }

        emitter.emit('success', self.model)
      })
    })
  }).run()
}

// private

var validateModel = function() {
  var self   = this
    , errors = {}

  // for each model validator for this DAO
  Utils._.each(this.model.__options.validate, function(validator, validatorType) {
    try {
      validator.apply(self.model)
    } catch (err) {
      errors[validatorType] = [err.message] // TODO: data structure needs to change for 2.0
    }
  })

  return errors
}

var validateAttributes = function() {
  var self   = this
    , errors = {}

  Utils._.each(this.model.rawAttributes, function(rawAttribute, field) {
    var value          = self.model.dataValues[field]
      , hasAllowedNull = ((rawAttribute === undefined || rawAttribute.allowNull === true) && ((value === null) || (value === undefined)))
      , isSkipped      = self.options.skip.length > 0 && self.options.skip.indexOf(field) !== -1

    if (self.model.validators.hasOwnProperty(field) && !hasAllowedNull && !isSkipped) {
      errors = Utils._.merge(errors, validateAttribute.call(self, value, field))
    }
  })

  return errors
}

var validateAttribute = function(value, field) {
  var self   = this
    , errors = {}

  // for each validator
  Utils._.each(this.model.validators[field], function(details, validatorType) {
    var validator = prepareValidationOfAttribute.call(self, value, details, validatorType)

    try {
      validator.fn.apply(null, validator.args)
    } catch (err) {
      var msg = err.message

      // if we didn't provide a custom error message then augment the default one returned by the validator
      if (!validator.msg && !validator.isCustom) {
        msg += ": " + field
      }

      // each field can have multiple validation errors stored against it
      errors[field] = errors[field] || []
      errors[field].push(msg)
    }
  })

  return errors
}

var prepareValidationOfAttribute = function(value, details, validatorType) {
  var isCustomValidator = false // if true then it's a custom validation method
    , validatorFunction = null  // the validation function to call
    , validatorArgs     = []    // extra arguments to pass to validation function
    , errorMessage      = ""    // the error message to return if validation fails

  if (typeof details === 'function') {
    // it is a custom validator function?
    isCustomValidator = true
    validatorFunction = Utils._.bind(details, this.model, value)
  } else {
    // it is a validator module function?

    // extract extra arguments for the validator
    validatorArgs = details.hasOwnProperty("args") ? details.args : details

    if (!Array.isArray(validatorArgs)) {
      validatorArgs = [validatorArgs]
    }

    // extract the error msg
    errorMessage = details.hasOwnProperty("msg") ? details.msg : undefined

    // check if Validator knows that kind of validation test
    if (!Utils._.isFunction(Validator[validatorType])) {
      throw new Error("Invalid validator function: " + validatorType)
    }

    validatorFunction = function () {
      if (!Validator[validatorType].apply(null, [value].concat(validatorArgs))) {
        throw new Error(errorMessage || "Validation "+validatorType+" failed")
      }
    }
  }

  return {
    fn:       validatorFunction,
    msg:      errorMessage,
    args:     validatorArgs,
    isCustom: isCustomValidator
  }
}

