'use strict';

var Utils = require('./../utils')
  , Helpers = require('./helpers')
  , Association = require('./base')
  , util = require('util');

var HasOne = function(srcModel, targetModel, options) {
  Association.call(this);

  this.associationType = 'HasOne';
  this.source = srcModel;
  this.target = targetModel;
  this.options = options;
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
        Utils._.underscoredIf(Utils.singularize(this.source.name), this.target.options.underscored),
        this.source.primaryKeyAttribute
      ].join('_'),
      !this.source.options.underscored
    );
  }

  this.identifier = this.foreignKey || Utils._.camelizeIf(
    [
      Utils._.underscoredIf(this.source.options.name.singular, this.source.options.underscored),
      this.source.primaryKeyAttribute
    ].join('_'),
    !this.source.options.underscored
  );

  this.sourceIdentifier = this.source.primaryKeyAttribute;
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

util.inherits(HasOne, Association);

// the id is in the target table
HasOne.prototype.injectAttributes = function() {
  var newAttributes = {}
    , keyType = this.source.rawAttributes[this.sourceIdentifier].type;

  newAttributes[this.identifier] = Utils._.defaults(this.foreignKeyAttribute, { type: this.options.keyType || keyType });
  Utils.mergeDefaults(this.target.rawAttributes, newAttributes);

  this.identifierField = this.target.rawAttributes[this.identifier].field || this.identifier;

  if (this.options.constraints !== false) {
    this.options.onDelete = this.options.onDelete || 'SET NULL';
    this.options.onUpdate = this.options.onUpdate || 'CASCADE';
  }
  Helpers.addForeignKeyConstraints(this.target.rawAttributes[this.identifier], this.source, this.target, this.options);

  // Sync attributes and setters/getters to Model prototype
  this.target.refreshAttributes();

  Helpers.checkNamingCollision(this);

  return this;
};

HasOne.prototype.injectGetter = function(instancePrototype) {
  var association = this;

  instancePrototype[this.accessors.get] = function(options) {
    var where = {};
    where[association.identifier] = this.get(association.sourceIdentifier);

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

HasOne.prototype.injectSetter = function(instancePrototype) {
  var association = this;

  instancePrototype[this.accessors.set] = function(associatedInstance, options) {
    var instance = this;

    options = options || {};
    options.scope = false;
    return instance[association.accessors.get](options).then(function(oldInstance) {
      if (oldInstance) {
        oldInstance[association.identifier] = null;
        return oldInstance.save(Utils._.extend({}, options, {
          fields: [association.identifier],
          allowNull: [association.identifier],
          association: true
        }));
      }
    }).then(function() {
      if (associatedInstance) {
        if (!(associatedInstance instanceof association.target.Instance)) {
          var tmpInstance = {};
          tmpInstance[association.target.primaryKeyAttribute] = associatedInstance;
          associatedInstance = association.target.build(tmpInstance, {
            isNewRecord: false
          });
        }
        associatedInstance.set(association.identifier, instance.get(association.sourceIdentifier));
        return associatedInstance.save(options);
      }
      return null;
    });
  };

  return this;
};

HasOne.prototype.injectCreator = function(instancePrototype) {
  var association = this;

  instancePrototype[this.accessors.create] = function(values, options) {
    var instance = this;
    values = values || {};
    options = options || {};

    values[association.identifier] = instance.get(association.sourceIdentifier);
    if (options.fields) options.fields.push(association.identifier);
    return association.target.create(values, options);
  };

  return this;
};

module.exports = HasOne;
