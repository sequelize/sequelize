'use strict';

var Promise = require('bluebird')
  , shimmer = require('shimmer');

// functionName: The Promise function that should be shimmed
// fnArgs: The arguments index that should be CLS enabled (typically all callbacks). Offset from last if negative
function shimCLS(object, functionName, fnArgs){
  shimmer.wrap(object, functionName, function(fn) {
    return function () {
      if (Promise.Sequelize && Promise.Sequelize.cls) {
        var ns = Promise.Sequelize.cls;
        for(var x=0; x<fnArgs.length; x++) {
          var argIndex = fnArgs[x] < 0 ? arguments.length + fnArgs[x] : fnArgs[x];
          if ( argIndex < arguments.length && typeof arguments[argIndex] === 'function' ) {
            arguments[argIndex] = ns.bind( arguments[argIndex] );
          }
        }
      }

      return fn.apply(this, arguments);
    };
  });
}

// Core
shimCLS(Promise, 'join', [-1]);
shimCLS(Promise.prototype, 'then', [0, 1, 2]);
shimCLS(Promise.prototype, 'spread', [0, 1]);
shimCLS(Promise.prototype, 'catch', [-1]);
shimCLS(Promise.prototype, 'error', [0]);
shimCLS(Promise.prototype, 'finally', [0]);

// Collections
shimCLS(Promise, 'map', [1]);
shimCLS(Promise, 'mapSeries', [1]);
shimCLS(Promise, 'reduce', [1]);
shimCLS(Promise, 'filter', [1]);
shimCLS(Promise, 'each', [1]);
shimCLS(Promise.prototype, 'map', [0]);
shimCLS(Promise.prototype, 'mapSeries', [0]);
shimCLS(Promise.prototype, 'reduce', [0]);
shimCLS(Promise.prototype, 'filter', [0]);
shimCLS(Promise.prototype, 'each', [0]);

// Promisification
shimCLS(Promise.prototype, 'nodeify', [0]);

// Utility
shimCLS(Promise.prototype, 'tap', [0]);

// Error management configuration
shimCLS(Promise.prototype, 'done', [0, 1]);

module.exports = Promise;
