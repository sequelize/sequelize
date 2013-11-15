var ParameterValidator = module.exports = {
  check: function(value, expectation, options) {
    options = Utils._.extend({
      throwError: true,
      deprecated: false,
      onDeprecated: console.log,
      optional: false
    }, options || {})

    if (options.optional && ((value === undefined) || (value === null)) ) {
      return true
    }

    if (value === undefined) {
      throw new Error('No value has been passed.')
    }

    if (expectation === undefined) {
      throw new Error('No expectation has been passed.')
    }

    return false
      || validateDeprication(value, expectation, options)
      || validate(value, expectation, options)
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
      return true
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
    var _value       = (value === null) ? 'null' : value.toString()
      , _expectation = expectation.toString().match(/function ([^\(]+)/)[1]

    throw new Error('The parameter (value: ' + _value + ') is no ' + _expectation + '.')
  }
}
