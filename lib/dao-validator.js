var Validator = require("validator")
  , Utils     = require("./utils")

var DaoValidator = module.exports = function(model, options) {
  options = options || {}
  options.skip = options.skip || []

  this.model   = model
  this.chainer = new Utils.QueryChainer()
  this.options = options
}

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
        var errors = {}

        Utils._.each(err, function (value) {
          Utils._.extend(errors, value)
        })

        emitter.emit('success', errors)
      })
  }).run()
}

// private

var validateModel = function() {
  Utils._.each(this.model.__options.validate, function(_validator, validatorType) {
    var validator = prepareValidationOfAttribute.call(this, undefined, _validator, validatorType, { omitValue: true })

    this.chainer.add(new Utils.CustomEventEmitter(function(emitter) {
      var next = function(err) {
        if (err) {
          var error = {}
          error[validatorType] = [err]
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
  var self = this
    , errors = {}

  // for each field and value
  Utils._.each(this.model.dataValues, function(value, field) {
    var rawAttribute   = self.model.rawAttributes[field]
      , hasAllowedNull = ((rawAttribute === undefined || rawAttribute.allowNull === true) && ((value === null) || (value === undefined)))
      , isSkipped      = self.options.skip.length > 0 && self.options.skip.indexOf(field) === -1

    if (self.model.validators.hasOwnProperty(field) && !hasAllowedNull && !isSkipped) {
      errors = Utils._.merge(errors, validateAttribute.call(self, value, field))
    }
  })

  return errors
}

var validateAttribute = function(value, field) {
  // for each validator
  Utils._.each(this.model.validators[field], function(details, validatorType) {
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
    validatorFunction = function(next) {
      details.apply(this.model, ((options || {}).omitValue) ? [next] : [value, next])
    }.bind(this)
  } else {
    // it is a validator module function?

    // extract extra arguments for the validator
    validatorArgs = details.hasOwnProperty("args") ? details.args : details

    if (!Array.isArray(validatorArgs)) {
      validatorArgs = [validatorArgs]
    } else {
      validatorArgs = validatorArgs.slice(0);
    }

    // extract the error msg
    errorMessage = details.hasOwnProperty("msg") ? details.msg : undefined

    // check method exists
    var validator = Validator.check(value, errorMessage)

    // check if Validator knows that kind of validation test
    if (!Utils._.isFunction(validator[validatorType])) {
      throw new Error("Invalid validator function: " + validatorType)
    }

    // bind to validator obj
    validatorFunction = function(next) {
      var args = Array.prototype.slice.call(arguments, 1)

      try {
        validator[validatorType].apply(validator, args)
        next()
      } catch (err) {
        next(err.message)
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

