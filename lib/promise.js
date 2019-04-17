'use strict';

Promise.each =  async function(arr, fn) {
    for(const item of arr) await fn(item);
}

Promise.prototype.return = function(value) {
  return this.then(function(){ return value });
}

Promise.prototype.tap = function(fn) {
    return this.then(async function(value){
         await fn(value);
         return value;
    });
};

Promise.try = function(func) {
    return new Promise(function(resolve, reject) {
      try {
        resolve(func());
      } catch (e) {
        reject(e);
      }
    })
}

Promise.map = async function(input, mapper) {
  if(input instanceof Promise) {
    input = await Promise.resolve(input);
  }
  input = Array.isArray(input) ? input : [...input];
  return Promise.all(input.map(mapper));
}

function PromiseInspection(isFullfiled, value) {
    this._isFullfiled = isFullfiled;
    this._value = value;
}

PromiseInspection.prototype.value = function () {
    if (!this._isFullfiled) {
        throw new TypeError("cannot get fulfillment value of a non-fulfilled promise\n\n\
    See http://goo.gl/MqrFmX\n");
    }
    return this._value;
};

PromiseInspection.prototype.error =
PromiseInspection.prototype.reason = function () {
    if (this._isFullfiled) {
        throw new TypeError("cannot get rejection reason of a non-rejected promise\n\n\
    See http://goo.gl/MqrFmX\n");
    }
    return this._value;
};

PromiseInspection.prototype.isFulfilled = function() {
    return this._isFullfiled;
};

PromiseInspection.prototype.isRejected = function () {
    return !this._isFullfiled;
};

PromiseInspection.prototype.isPending = function () {
    return false;
};

PromiseInspection.prototype.isResolved = function () {
    return true;
};

PromiseInspection.prototype.isCancelled = function() {
    return false;
};


Promise.prototype.reflect = function() {
    return this.then(function(value) {
       return new PromiseInspection(true, value);
     })
     .catch(function(error) {
       return new PromiseInspection(false, error);
     });
};

module.exports = Promise;
module.exports.Promise = Promise;
module.exports.default = Promise;
