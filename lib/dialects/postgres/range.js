'use strict';

const _ = require('lodash');

function stringifyRangeBound(bound) {
  if (bound === null) {
    return '' ;
  } else if (bound === Infinity || bound === -Infinity) {
    return bound.toString().toLowerCase();
  } else {
    return JSON.stringify(bound);
  }
}

function parseRangeBound(bound, parseType) {
  if (!bound) {
    return null;
  } else if (bound === 'infinity') {
    return Infinity;
  } else if (bound === '-infinity') {
    return -Infinity;
  } else {
    return parseType(bound);
  }
}

function stringify(data) {
  if (data === null) return null;

  if (!_.isArray(data)) throw new Error('range must be an array');
  if (!data.length) return 'empty';
  if (data.length !== 2) throw new Error('range array length must be 0 (empty) or 2 (lower and upper bounds)');

  if (data.hasOwnProperty('inclusive')) {
    if (data.inclusive === false) data.inclusive = [false, false];
    else if (!data.inclusive) data.inclusive = [true, false];
    else if (data.inclusive === true) data.inclusive = [true, true];
  } else {
    data.inclusive = [true, false];
  }

  _.each(data, (value, index) => {
    if (_.isObject(value)) {
      if (value.hasOwnProperty('inclusive')) data.inclusive[index] = !!value.inclusive;
      if (value.hasOwnProperty('value')) data[index] = value.value;
    }
  });

  const lowerBound = stringifyRangeBound(data[0]);
  const upperBound = stringifyRangeBound(data[1]);

  return (data.inclusive[0] ? '[' : '(') + lowerBound + ',' + upperBound + (data.inclusive[1] ? ']' : ')');
}
exports.stringify = stringify;

function parse(value, parser) {
  if (value === null) return null;
  if (value === 'empty') {
    const empty = [];
    empty.inclusive = [];
    return empty;
  }

  let result = value
    .substring(1, value.length - 1)
    .split(',', 2);

  if (result.length !== 2) return value;

  result = result.map(value => parseRangeBound(value, parser));

  result.inclusive = [(value[0] === '['), (value[value.length - 1] === ']')];

  return result;
}
exports.parse = parse;
