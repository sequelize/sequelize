'use strict';

class Association {

  // Normalize input - may be array or single obj, instance or primary key - convert it to an array of built objects
  toInstanceArray(objs) {
    if (!Array.isArray(objs)) {
      objs = [objs];
    }
    return objs.map(function(obj) {
      if (!(obj instanceof this.target)) {
        const tmpInstance = {};
        tmpInstance[this.target.primaryKeyAttribute] = obj;
        return this.target.build(tmpInstance, {
          isNewRecord: false
        });
      }
      return obj;
    }, this);
  }

  inspect() {
    return this.as;
  }
}

module.exports = Association;
