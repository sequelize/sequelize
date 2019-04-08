'use strict';

Promise.each =  async function(arr, fn) {
   for(const item of arr) await fn(item);
}

Promise.prototype.return = func => {
  return Promise.resolve(func);
}

Promise.prototype.tap = function(fn) {
    return this.then(function(value) {
         fn(value);
         return value;
    });
};

Promise.try = func => {
  return new Promise((resolve, reject) => {
  		resolve(func());
  	});
  }

Promise.map = (fn, ctx) => {
  return Promise.resolve(function(val) {
    val = Array.isArray(val) ? val : [val]
    return Promise.all(val.map(fn, ctx))
  });
}

module.exports = Promise;
module.exports.Promise = Promise;
module.exports.default = Promise;
