'use strict';

// Serializes access to a shared resource. Callers await `acquire` to take the
// lock and must invoke `release` when finished (use try/finally to guarantee
// release on error).

function ResourceLock(resource) {
  this.resource = resource;
  this.previous = Promise.resolve(resource);
}

ResourceLock.prototype.unwrap = function () {
  return this.resource;
};

ResourceLock.prototype.lock = function () {
  const acquire = this.previous;
  let release;
  this.previous = new Promise((resolve) => {
    release = resolve;
  });
  return { acquire, release };
};

module.exports = ResourceLock;
