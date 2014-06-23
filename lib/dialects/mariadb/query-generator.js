'use strict';

var Utils = require('../../utils');

module.exports = (function() {
  var QueryGenerator = {
   dialect: 'mariadb',
     uniqueConstraintMapping: {
      code: 1062,
      map: function(str) {
        // we're manually remvoving uniq_ here for a future capability of defining column names explicitly
        var match = str.replace('uniq_', '').match(/Duplicate entry .* for key '(.*?)'$/);
        if (match === null || match.length < 2) {
          return false;
        }

        return {
          indexName: match[1],
          fields: match[1].split('_')
        };
      }
    }
  };
  // "MariaDB is a drop-in replacement for MySQL." - so thats exactly what we do, drop in the mysql query generator

  return Utils._.extend(Utils._.clone(require('../mysql/query-generator')), QueryGenerator);
})();
