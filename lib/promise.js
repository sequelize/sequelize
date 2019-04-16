'use strict';

Promise.each =  async function(arr, fn) {
    for(const item of arr) await fn(item);
}

Promise.prototype.return = function(value) {
  return this.then(function(){ return value; });
}

Promise.prototype.tap = function(fn) {
    return this.then(async function(value){
         await fn(value);
         return value;
    });
};

Promise.try = function(func) {
    return new Promise(function(resolve, reject) {
        var val = func();
        return !val ? reject(val) : resolve(val);
    })
}

Promise.map = function(fn, ctx) {
  return Promise.resolve(function(val) {
    val = Array.isArray(val) ? val : [val]
    return Promise.all(val.map(fn, ctx))
  });
}

Promise.prototype.reflect = function() {
 return this.then(data => {
       return {data: data, status: "resolved"}
     })
     .catch(error => {
       return {error: error, status: "rejected"}
     });
}

module.exports = Promise;
module.exports.Promise = Promise;
module.exports.default = Promise;
