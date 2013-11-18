var cJSON = require('circular-json')

var ParameterValidator = module.exports = {
  check: function(value, expectation, options) {
    options = Utils._.extend({
      throwError:         true,
      deprecated:         false,
      deprecationWarning: generateDeprecationWarning(value, expectation, options),
      onDeprecated:       function(s) { console.log('DEPRECATION WARNING:', s) },
      index:              null,
      method:             null,
      optional:           false
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

var generateDeprecationWarning = function(value, expectation, options) {
  options = options || {}

  if (options.method && options.index) {
    return [
      'The',
      {1:'first',2:'second',3:'third',4:'fourth',5:'fifth'}[options.index],
      'parameter of',
      options.method,
      'should be a',
      extractClassName(expectation) + '!'
    ].join(" ")
  } else {
    return ["Expected", cJSON.stringify(value), "to be", extractClassName(expectation) + '!'].join(" ")
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
      options.onDeprecated(options.deprecationWarning)
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
      , _expectation = extractClassName(expectation)

    throw new Error('The parameter (value: ' + _value + ') is no ' + _expectation + '.')
  }
}

var extractClassName = function(o) {
  if (typeof o === 'string') {
    return o
  } else if (!!o) {
    return o.toString().match(/function ([^\(]+)/)[1]
  } else {
    return 'undefined'
  }
}
