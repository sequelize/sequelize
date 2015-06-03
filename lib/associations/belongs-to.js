'use strict';

var Utils = require('./../utils')
  , Helpers = require('./helpers')
  , Transaction = require('../transaction')
  , Association = require('./base')
  , util = require('util');

var BelongsTo = function(source, target, options) {
  Association.call(this);

  this.associationType = 'BelongsTo';
  this.source = source;
  this.target = target;
  this.options = options;
  this.scope = options.scope;
  this.isSingleAssociation = true;
  this.isSelfAssociation = (this.source === this.target);
  this.as = this.options.as;

  if (Utils._.isObject(this.options.foreignKey)) {
    this.foreignKeyAttribute = this.options.foreignKey;
    this.foreignKey = this.foreignKeyAttribute.name || this.foreignKeyAttribute.fieldName;
  } else {
    this.foreignKeyAttribute = {};
    this.foreignKey = this.options.foreignKey;
  }

  if (this.as) {
    this.isAliased = true;
    this.options.name = {
      singular: this.as
    };
  } else {
    this.as = this.target.options.name.singular;
    this.options.name = this.target.options.name;
  }

  if (!this.options.foreignKey) {
    this.options.foreignKey = Utils._.camelizeIf(
      [
        Utils._.underscoredIf(this.as, this.source.options.underscored),
        this.target.primaryKeyAttribute
      ].join('_'),
      !this.source.options.underscored
    );
  }

  this.identifier = this.foreignKey || Utils._.camelizeIf(
    [
      Utils._.underscoredIf(this.options.name.singular, this.target.options.underscored),
      this.target.primaryKeyAttribute
    ].join('_'),
    !this.target.options.underscored
  );

  this.targetIdentifier = this.options.targetKey || this.target.primaryKeyAttribute;
  this.associationAccessor = this.as;
  this.options.useHooks = options.useHooks;

  // Get singular name, trying to uppercase the first letter, unless the model forbids it
  var singular = Utils.uppercaseFirst(this.options.name.singular);

  this.accessors = {
    get: 'get' + singular,
    set: 'set' + singular,
    create: 'create' + singular
  };
};

util.inherits(BelongsTo, Association);

// the id is in the source table
BelongsTo.prototype.injectAttributes = function() {
  var newAttributes = {};

  newAttributes[this.identifier] = Utils._.defaults(this.foreignKeyAttribute, { type: this.options.keyType || this.target.rawAttributes[this.targetIdentifier].type });
  if (this.options.constraints !== false) {
    this.options.onDelete = this.options.onDelete || 'SET NULL';
    this.options.onUpdate = this.options.onUpdate || 'CASCADE';
  }
  Helpers.addForeignKeyConstraints(newAttributes[this.identifier], this.target, this.source, this.options);
  Utils.mergeDefaults(this.source.rawAttributes, newAttributes);

  this.identifierField = this.source.rawAttributes[this.identifier].field || this.identifier;

  this.source.refreshAttributes();

  Helpers.checkNamingCollision(this);

  return this;
};

// Add getAssociation method to the prototype of the model instance
BelongsTo.prototype.injectGetter = function(instancePrototype) {
  var association = this;

  instancePrototype[this.accessors.get] = function(options) {
    var where = {};
    where[association.targetIdentifier] = this.get(association.identifier);

    options = association.target.__optClone(options) || {};

    options.where = {
      $and: [
        options.where,
        where
      ]
    };

    if (options.limit === undefined) options.limit = null;

    var model = association.target;
    if (options.hasOwnProperty('scope')) {
      if (!options.scope) {
        model = model.unscoped();
      } else {
        model = model.scope(options.scope);
      }
    }

    return model.find(options);
  };

  return this;
};

// Add setAssociaton method to the prototype of the model instance
BelongsTo.prototype.injectSetter = function(instancePrototype) {
  var association = this;

  instancePrototype[this.accessors.set] = function(associatedInstance, options) {
    options = options || {};

    var value = associatedInstance;
    if (associatedInstance instanceof association.target.Instance) {
      value = associatedInstance[association.targetIdentifier];
    }

    this.set(association.identifier, value);

    if (options.save === false) return;

    options = Utils._.extend({
      fields: [association.identifier],
      allowNull: [association.identifier],
      association: true
    }, options);


    // passes the changed field to save, so only that field get updated.
    return this.save(options);
  };

  return this;
};

// Add createAssociation method to the prototype of the model instance
BelongsTo.prototype.injectCreator = function(instancePrototype) {
  var association = this;

  instancePrototype[this.accessors.create] = function(values, fieldsOrOptions) {
    var instance = this
      , options = {};

    if ((fieldsOrOptions || {}).transaction instanceof Transaction) {
      options.transaction = fieldsOrOptions.transaction;
    }
    options.logging = (fieldsOrOptions || {}).logging;

    return association.target.create(values, fieldsOrOptions).then(function(newAssociatedObject) {
      return instance[association.accessors.set](newAssociatedObject, options);
    });
  };

  return this;
};

module.exports = BelongsTo;
