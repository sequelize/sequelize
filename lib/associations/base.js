'use strict';

var Association = function() {};

// Normalize input - may be array or single obj, instance or primary key - convert it to an array of built objects
Association.prototype.toInstanceArray = function (objs) {
  if (!Array.isArray(objs)) {
    objs = [objs];
  }
  return objs.map(function(obj) {
    if (!(obj instanceof this.target.Instance)) {
      var tmpInstance = {};
      tmpInstance[this.target.primaryKeyAttribute] = obj;
      return this.target.build(tmpInstance, {
        isNewRecord: false
      });
    }
    return obj;
  }, this);
};
module.exports = Association;
