'use strict';

var Utils = require('../../utils'),
  moment = require('moment');

module.exports = {
  stringify: function (data) {
    if (data === null) return null;

    if (!Utils._.isArray(data) || data.length !== 2)
      return '';

    if (Utils._.any(data, Utils._.isNull))
      return '';

    if (data.hasOwnProperty('inclusive')) {
      if (!data.inclusive)
        data.inclusive = [false, false];
      else if (data.inclusive === true)
        data.inclusive = [true, true];
    } else
      data.inclusive = [false, false];
    Utils._.each(data, function (value, index) {
      if (Utils._.isObject(value)) {
        if (value.hasOwnProperty('inclusive'))
          data.inclusive[index] = !!value.inclusive;

        if (value.hasOwnProperty('value'))
          data[index] = value.value;
      }
    });

    return (data.inclusive[0] ? '[' : '(') + JSON.stringify(data[0]) + ',' + JSON.stringify(data[1]) +
           (data.inclusive[1] ? ']' : ')');
  },
  parse:     function (value, attrType) {
    if (value === null) return null;

    if(typeof attrType === 'function') attrType = new attrType();
    attrType = attrType || '';

    var result = value
      .slice(1, -1)
      .split(',', 2);

    if (result.length !== 2)
      return value;

    result = result
      .map(function (value) {
        switch (attrType.toString()) {
          case 'int4range':
            return parseInt(value, 10);
          case 'numrange':
            return parseFloat(value);
          case 'daterange':
          case 'tsrange':
          case 'tstzrange':
            return moment(value).toDate();
        }

        return value;
      });

    result.inclusive = [(value[0] === '['), (value[value.length - 1] === ']')];

    return result;
  }
};
