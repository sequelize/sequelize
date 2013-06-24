var Validator = require("validator")
  , Utils     = require("./utils")

var DaoValidator = module.exports = function(model) {
  this.model = model
}

DaoValidator.prototype.validate = function() {
  var errors = {}

  errors = Utils._.extend(errors, validateAttributes.call(this))
  errors = Utils._.extend(errors, validateModel.call(this))

  return errors
}

// private

var validateModel = function() {
  var errors = {}

  // for each model validator for this DAO
  Utils._.each(this.model.__options.validate, function(validator, validatorType) {
    try {
      validator.apply(this.model)
    } catch (err) {
      errors[validatorType] = [err.message] // TODO: data structure needs to change for 2.0
    }
  }.bind(this))

  return errors
}

var validateAttributes = function() {
  var errors = {}

  // for each field and value
  Utils._.each(this.model.dataValues, function(value, field) {
    var rawAttribute   = this.model.rawAttributes[field]
      , hasAllowedNull = ((rawAttribute === undefined || rawAttribute.allowNull === true) && ((value === null) || (value === undefined)))

    if (this.model.validators.hasOwnProperty(field) && !hasAllowedNull) {
      errors = Utils._.merge(errors, validateAttribute.call(this, value, field))
    }
  }.bind(this)) // for each field

  return errors
}

var validateAttribute = function(value, field) {
  var errors = {}

  // for each validator
  Utils._.each(this.model.validators[field], function(details, validatorType) {
    var validator = prepareValidationOfAttribute.call(this, value, details, validatorType)

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
  }.bind(this)) // for each validator for this field

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
    errorMessage = details.hasOwnProperty("msg") ? details.msg : false

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

