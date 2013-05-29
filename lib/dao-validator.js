var Validator = require("validator")
  , Utils     = require("./utils")

var DaoValidator = module.exports = function(model) {
  this.model = model
}

DaoValidator.prototype.validate = function() {
  var self = this.model
  var failures = {}

  // for each field and value
  Utils._.each(self.values, function(value, field) {

    // if field has validators
    var hasAllowedNull = (self.rawAttributes[field].allowNull && self.rawAttributes[field].allowNull === true && (value === null || value === undefined));

    if (self.validators.hasOwnProperty(field) && !hasAllowedNull) {
      // for each validator
      Utils._.each(self.validators[field], function(details, validatorType) {

        var is_custom_fn = false  // if true then it's a custom validation method
        var fn_method = null      // the validation function to call
        var fn_args = []          // extra arguments to pass to validation function
        var fn_msg = ""           // the error message to return if validation fails

        // is it a custom validator function?
        if (Utils._.isFunction(details)) {
          is_custom_fn = true
          fn_method = Utils._.bind(details, self, value)
        }
        // is it a validator module function?
        else {
          // extra args
          fn_args = details.hasOwnProperty("args") ? details.args : details
          if (!Array.isArray(fn_args))
            fn_args = [fn_args]
          // error msg
          fn_msg = details.hasOwnProperty("msg") ? details.msg : false
          // check method exists
          var v = Validator.check(value, fn_msg)
          if (!Utils._.isFunction(v[validatorType]))
            throw new Error("Invalid validator function: " + validatorType)
          // bind to validator obj
          fn_method = Utils._.bind(v[validatorType], v)
        }

        try {
          fn_method.apply(null, fn_args)
        } catch (err) {
          err = err.message
          // if we didn't provide a custom error message then augment the default one returned by the validator
          if (!fn_msg && !is_custom_fn)
            err += ": " + field
          // each field can have multiple validation failures stored against it
          if (failures.hasOwnProperty(field)) {
            failures[field].push(err)
          } else {
            failures[field] = [err]
          }
        }

      }) // for each validator for this field
    } // if field has validator set
  }) // for each field

  // for each model validator for this DAO
  Utils._.each(self.__options.validate, function(validator, validatorType) {
    try {
      validator.apply(self)
    } catch (err) {
      failures[validatorType] = [err.message] // TODO: data structure needs to change for 2.0
    }
  })

  return failures
}
