'use strict';

var Utils = require('../../utils');

module.exports = (function() {
  var QueryGenerator = { dialect: 'mssql' };

  return Utils._.extend(Utils._.clone(require('../mysql/query-generator')), QueryGenerator);
})();
