'use strict';

module.exports = {
  stringify: function (data) {
    return 'ST_GeomFromGeoJSON(\'' + JSON.stringify(data) + '\')';
  },
  parse: function (data) {
    var ret = '';
    try {
      ret = JSON.parse(data);
    } catch (e) {
      ret = data;
    }
    return ret;
  }
};
