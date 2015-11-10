'use strict';

var _ = require('lodash');

function stringify (data) {
  if (data === null) return null;

  if (!_.isArray(data) || data.length !== 2) return '';

  if (_.any(data, _.isNull)) return '';

  if (data.hasOwnProperty('inclusive')) {
    if (!data.inclusive) data.inclusive = [false, false];
    else if (data.inclusive === true) data.inclusive = [true, true];
  } else {
    data.inclusive = [false, false];
  }

  _.each(data, function (value, index) {
    if (_.isObject(value)) {
      if (value.hasOwnProperty('inclusive')) data.inclusive[index] = !!value.inclusive;
      if (value.hasOwnProperty('value')) data[index] = value.value;
    }
  });

  return (data.inclusive[0] ? '[' : '(') + JSON.stringify(data[0]) + ',' + JSON.stringify(data[1]) + (data.inclusive[1] ? ']' : ')');
}

function parse (value, parser) {
  if (value === null) return null;

  var result = value
    .substring(1, value.length - 1)
    .split(',', 2);

  if (result.length !== 2) return value;

  result = result
    .map(function (value) {
      return parser(value);
    });

  result.inclusive = [(value[0] === '['), (value[value.length - 1] === ']')];

  return result;
}

module.exports = {
  stringify: stringify,
  parse: parse
};
