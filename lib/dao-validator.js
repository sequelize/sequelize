var Validator = require("validator")
  , Utils     = require("./utils")
  , sequelizeError = require("./errors")

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
}

/** @define {string} The error key for arguments as passed by custom validators */
DaoValidator.RAW_KEY_NAME = '__raw'

DaoValidator.prototype.validate = function() {
  var self = this

  return new Utils.CustomEventEmitter(function(emitter) {
    validateAttributes.call(self)
    validateModel.call(self)

    self
      .chainer
      .run()
      .success(function () {
        emitter.emit('success')
      })
      .error(function(err) {
        var error = new sequelizeError.ValidationError('Validation error')
        error[DaoValidator.RAW_KEY_NAME] = []

        Utils._.each(err, function (value) {
          error[DaoValidator.RAW_KEY_NAME].push(value[DaoValidator.RAW_KEY_NAME])
          delete value[DaoValidator.RAW_KEY_NAME]
          Utils._.extend(error, value)
        })

        emitter.emit('success', error)
      })
  }).run()
}

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

// private
var validateModel = function() {
  Utils._.each(this.modelInstance.__options.validate, function(_validator, validatorType) {
    var validator = prepareValidationOfAttribute.call(this, undefined, _validator, validatorType, { omitValue: true })

    this.chainer.add(new Utils.CustomEventEmitter(function(emitter) {
      var next = function(err) {

        if (err) {
          var error = {};
          error[DaoValidator.RAW_KEY_NAME] = err

          var msg = ((err instanceof Error) ? err.message : err)
          error[validatorType] = [msg]
          emitter.emit('error', error)
        } else {
          emitter.emit('success')
        }
      }

      validator.args.unshift(next);
      validator.fn.apply(null, validator.args)
    }.bind(this)).run())
  }.bind(this))
}

var validateAttributes = function() {
  var self   = this
    , errors = {}

  Utils._.each(this.modelInstance.rawAttributes, function(rawAttribute, field) {
    var value          = self.modelInstance.dataValues[field]
      , hasAllowedNull = ((rawAttribute === undefined || rawAttribute.allowNull === true) && ((value === null) || (value === undefined)))
      , isSkipped      = self.options.skip.length > 0 && self.options.skip.indexOf(field) !== -1

    if (self.modelInstance.validators.hasOwnProperty(field) && !hasAllowedNull && !isSkipped) {
      errors = Utils._.merge(errors, validateAttribute.call(self, value, field))
    }
  })

  return errors
}

var validateAttribute = function(value, field) {
  // for each validator
  Utils._.each(this.modelInstance.validators[field], function(details, validatorType) {
    var validator = prepareValidationOfAttribute.call(this, value, details, validatorType)

    this.chainer.add(new Utils.CustomEventEmitter(function(emitter) {
      var next = function(err) {
        if (err) {
          var error = {}
          error[field] = [err]
          emitter.emit('error', error)
        } else {
          emitter.emit('success')
        }
      }

      validator.args.unshift(next);
      validator.fn.apply(null, validator.args)
    }.bind(this)).run())
  }.bind(this)) // for each validator for this field
}

var prepareValidationOfAttribute = function(value, details, validatorType, options) {
  var isCustomValidator = false // if true then it's a custom validation method
    , validatorFunction = null  // the validation function to call
    , validatorArgs     = []    // extra arguments to pass to validation function
    , errorMessage      = ""    // the error message to return if validation fails

  if (typeof details === 'function') {
    // it is a custom validator function?
    isCustomValidator = true

    var callArgs = []
    var validatorArity = details.length

    var omitValue = !!(options || {}).omitValue
    if (!omitValue) {
      callArgs.push(value)
    }

    // check if validator is async and requires a callback
    var isAsync = omitValue && validatorArity === 1 ||
      !omitValue && validatorArity === 2

    validatorFunction = function(next) {
      if (isAsync) {
        callArgs.push(next)
      }

      try {
        details.apply(this.modelInstance, callArgs)
      } catch(ex) {
        return next(ex)
      }

      if (!isAsync) {
        next()
      }
    }.bind(this)
  } else {
    // extract extra arguments for the validator
    validatorArgs = details.hasOwnProperty("args") ? details.args : details

    if (!Array.isArray(validatorArgs)) {
      validatorArgs = [validatorArgs]
    } else {
      validatorArgs = validatorArgs.slice(0);
    }

    // extract the error msg
    errorMessage = details.hasOwnProperty("msg") ? details.msg : 'Validation ' + validatorType + ' failed'

    // check if Validator knows that kind of validation test
    if (!Utils._.isFunction(Validator[validatorType])) {
      throw new Error("Invalid validator function: " + validatorType)
    }

    // bind to validator obj
    validatorFunction = function(next) {
      var args = Array.prototype.slice.call(arguments, 1)

      if (Validator[validatorType].apply(Validator, [value].concat(args))) {
        next()  
      } else {
        next(errorMessage)
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

