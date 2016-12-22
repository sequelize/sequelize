'use strict';
const _ = require('lodash')
const AssociationError = require('./../errors').AssociationError;

var Association = function(source, options) {
  if (this.hasAlias(source, options.as)) {
    throw new AssociationError(`You have used the alias ${options.as} in two separate associations. ` +
    `Aliased associations must have unique aliases.`
    );
  }
};

Association.prototype.hasAlias = function(source, alias) {
  return _.values(source.associations).find(association => association.as === alias);
};

// Normalize input - may be array or single obj, instance or primary key - convert it to an array of built objects
Association.prototype.toInstanceArray = function(objs) {
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
};

Association.prototype.inspect = function() {
  return this.as;
};

module.exports = Association;
