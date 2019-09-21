'use strict';

const _ = require('lodash');

function stringifyRangeBound(bound) {
  if (bound === null) {
    return '' ;
  }
  if (bound === Infinity || bound === -Infinity) {
    return bound.toString().toLowerCase();
  }
  return JSON.stringify(bound);
}

function parseRangeBound(bound, parseType) {
  if (!bound) {
    return null;
  }
  if (bound === 'infinity') {
    return Infinity;
  }
  if (bound === '-infinity') {
    return -Infinity;
  }
  return parseType(bound);

}

function stringify(data) {
  if (data === null) return null;

  if (!Array.isArray(data)) throw new Error('range must be an array');
  if (!data.length) return 'empty';
  if (data.length !== 2) throw new Error('range array length must be 0 (empty) or 2 (lower and upper bounds)');

  if (Object.prototype.hasOwnProperty.call(data, 'inclusive')) {
    if (data.inclusive === false) data.inclusive = [false, false];
    else if (!data.inclusive) data.inclusive = [true, false];
    else if (data.inclusive === true) data.inclusive = [true, true];
  } else {
    data.inclusive = [true, false];
  }

  _.each(data, (value, index) => {
    if (_.isObject(value)) {
      if (Object.prototype.hasOwnProperty.call(value, 'inclusive')) data.inclusive[index] = !!value.inclusive;
      if (Object.prototype.hasOwnProperty.call(value, 'value')) data[index] = value.value;
    }
  });

  const lowerBound = stringifyRangeBound(data[0]);
  const upperBound = stringifyRangeBound(data[1]);

  return `${(data.inclusive[0] ? '[' : '(') + lowerBound},${upperBound}${data.inclusive[1] ? ']' : ')'}`;
}
exports.stringify = stringify;

function parse(value, parser) {
  if (value === null) return null;
  if (value === 'empty') {
    return [];
  }

  let result = value
    .substring(1, value.length - 1)
    .split(',', 2);

  if (result.length !== 2) return value;

  result = result.map((item, index) => {
    return {
      value: parseRangeBound(item, parser),
      inclusive: index === 0 ? value[0] === '[' : value[value.length - 1] === ']'
    };
  });

  return result;
}
exports.parse = parse;
