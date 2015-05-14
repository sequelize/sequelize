'use strict';

var Promise = require('bluebird')
  , _then = Promise.prototype._then;

Promise.prototype._then = function (didFulfill, didReject, didProgress, receiver, internalData) {
  if (Promise.Sequelize.cls) {
    var ns = Promise.Sequelize.cls;
    if (typeof didFulfill === 'function') didFulfill = ns.bind(didFulfill);
    if (typeof didReject === 'function') didReject = ns.bind(didReject);
    if (typeof didProgress === 'function') didProgress = ns.bind(didProgress);
  }
  
  return _then.call(this, didFulfill, didReject, didProgress, receiver, internalData);
};

module.exports = Promise;