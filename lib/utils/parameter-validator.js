var ParameterValidator = module.exports = {
  check: function(value, expectation, options) {
    options = Utils._.extend({
      throwError: true,
      deprecated: false,
      onDeprecated: console.log
    }, options || {})

    if (value === undefined) {
      throw new Error('No value has been passed.')
    }

    if (expectation === undefined) {
      throw new Error('No expectation has been passed.')
    }

    validateDeprication(value, expectation, options)

    return validate(value, expectation, options)
  }
}

var matchesExpectation = function(value, expectation) {
  if (typeof expectation === 'string') {
    return (typeof value === expectation.toString())
  } else {
    return (value instanceof expectation)
  }
}

var validateDeprication = function(value, expectation, options) {
  if (options.deprecated) {
    if (matchesExpectation(value, options.deprecated)) {
      options.onDeprecated("Deprecated!")
    }
  }
}

var validate = function(value, expectation, options) {
  var result = matchesExpectation(value, expectation)

  if (result) {
    return result
  } else if (!options.throwError) {
    return false
  } else {
    throw new Error('The parameter (value: ' + value.toString() + ') is no ' + expectation + '.')
  }
}
