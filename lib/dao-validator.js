var Validator = require("validator")
  , Utils     = require("./utils")

var DaoValidator = module.exports = function(model, options) {
  options = options || {}
  options.skip = options.skip || []

  this.model = model
  this.options = options
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

    // check method exists
    var validator = Validator.check(value, errorMessage)

    // check if Validator knows that kind of validation test
    if (!Utils._.isFunction(validator[validatorType])) {
      throw new Error("Invalid validator function: " + validatorType)
    }

    // bind to validator obj
    validatorFunction = Utils._.bind(validator[validatorType], validator)
  }

  return {
    fn:       validatorFunction,
    msg:      errorMessage,
    args:     validatorArgs,
    isCustom: isCustomValidator
  }
}

