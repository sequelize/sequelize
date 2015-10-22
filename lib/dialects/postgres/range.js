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

  if (!Utils._.isArray(data)) return ''; // will throw error, since '' is not a valid PG range literal
  if (!data.length) return 'empty';
  if (data.length !== 2) return ''; // will throw error, since '' is not a valid PG range literal

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
          return parseRangeBound(value, function (value) { return moment(value).toDate(); });
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
