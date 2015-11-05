'use strict';

var Utils = require('../../utils'),
  moment = require('moment');

function stringifyRangeBound (bound) {
  if (bound === null) {
    return '' ;
  } else if (bound === Infinity || bound === -Infinity) {
    return bound.toString().toLowerCase();
  } else {
    return JSON.stringify(bound);
  }
}

function parseRangeBound (bound, parseType) {
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

function stringify (data) {
  if (data === null) return null;

  if (!Utils._.isArray(data)) throw new Error('range must be an array');
  if (!data.length) return 'empty';
  if (data.length !== 2) throw new Error('range array length must be 0 (empty) or 2 (lower and upper bounds)');

  if (data.hasOwnProperty('inclusive')) {
    if (!data.inclusive) data.inclusive = [false, false];
    else if (data.inclusive === true) data.inclusive = [true, true];
  } else {
    data.inclusive = [false, false];
  }

  Utils._.each(data, function (value, index) {
    if (Utils._.isObject(value)) {
      if (value.hasOwnProperty('inclusive')) data.inclusive[index] = !!value.inclusive;
      if (value.hasOwnProperty('value')) data[index] = value.value;
    }
  });

  var lowerBound = stringifyRangeBound(data[0]);
  var upperBound = stringifyRangeBound(data[1]);

  return (data.inclusive[0] ? '[' : '(') + lowerBound + ',' + upperBound + (data.inclusive[1] ? ']' : ')');
}

function parse (value, AttributeType) {
  if (value === null) return null;
  if (value === 'empty') {
    var empty = [];
    empty.inclusive = [];
    return empty;
  }

  if(typeof AttributeType === 'function') AttributeType = new AttributeType();
  AttributeType = AttributeType || ''; // if attribute is not defined, assign empty string in order to prevent
                                       // AttributeType.toString() to fail with uncaught exception later in the code
  var result = value
    .substring(1, value.length - 1)
    .split(',', 2);

  if (result.length !== 2) return value;

  result = result
    .map(function (value) {
      switch (AttributeType.toString()) {
        case 'int4range':
          return parseRangeBound(value, function(value) { return parseInt(value, 10); });
        case 'numrange':
          return parseRangeBound(value, parseFloat);
        case 'daterange':
        case 'tsrange':
        case 'tstzrange':
          return parseRangeBound(value, function (value) {
            if (value.charAt(0) === '"') {
              value = value.substr(1, value.length-2); // remove quotes around date
            }
            if (value.match(/[\+\-]\d\d$/)) {
              // PG returns date in "2016-01-01 08:00:00-04" format
              // It must be transformed to "2016-01-01 08:00:00-0400" ("00 at the end) to be recognized by moment.js
              value = value + '00';
            }
            return moment(value).toDate();
          });
      }

      return value;
    });

  result.inclusive = [(value[0] === '['), (value[value.length - 1] === ']')];

  return result;
}

module.exports = {
  stringify: stringify,
  parse: parse
};
