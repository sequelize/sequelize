'use strict';

const Promise = require('../../promise');

class ResourceLock {
  constructor(resource) {
    this.resource = resource;
    this.previous = Promise.resolve(resource);
  }

  unwrap() {
    return this.resource;
  }

  lock() {
    const lock = this.previous;
    let resolve;
    this.previous = new Promise(r => {
      resolve = r;
    });
    return lock.disposer(resolve);
  }
}

module.exports = ResourceLock;
