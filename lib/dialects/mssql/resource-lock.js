'use strict';

var Promise = require('../../promise');

function ResourceLock(resource) {
  this.resource = resource;
  this.previous = Promise.resolve(resource);
}

ResourceLock.prototype.unwrap = function() {
  return this.resource;
};

ResourceLock.prototype.lock = function() {
  var lock = this.previous;
  var resolve;

  this.previous = new Promise(function(r) {
    resolve = r;
  });

  return lock.disposer(resolve);
};

module.exports = ResourceLock;
