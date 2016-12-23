'use strict';
const AssociationError = require('./../errors').AssociationError;

class Association {
  constructor(source, target, options) {
    if (source.hasAlias(options.as)) {
      throw new AssociationError(`You have used the alias ${options.as} in two separate associations. ` +
      `Aliased associations must have unique aliases.`
      );
    }
  }
  // Normalize input - may be array or single obj, instance or primary key - convert it to an array of built objects
  toInstanceArray(objs) {
    if (!Array.isArray(objs)) {
      objs = [objs];
    }
    return objs.map(function(obj) {
      if (!(obj instanceof this.target)) {
        var tmpInstance = {};
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
