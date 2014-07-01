'use strict';

var Utils = require('./../utils')
  , Helpers = require('./helpers')
  , Transaction = require('../transaction');

module.exports = (function() {
  var HasOne = function(srcDAO, targetDAO, options) {
    this.associationType = 'HasOne';
    this.source = srcDAO;
    this.target = targetDAO;
    this.options = options;
    this.isSingleAssociation = true;
    this.isSelfAssociation = (this.source === this.target);
    this.as = this.options.as;

    if (Utils._.isObject(this.options.foreignKey)) {
      this.foreignKeyAttribute = this.options.foreignKey;
      this.foreignKey = this.foreignKeyAttribute.fieldName;
    } else {
      this.foreignKeyAttribute = {};
      this.foreignKey = this.options.foreignKey;
    }

    if (this.as) {
      this.isAliased = true;
    } else {
      this.as = Utils.singularize(this.target.name, this.target.options.language);
    }

    if (!this.options.foreignKey) {
      this.options.foreignKey = Utils._.camelizeIf(
        [
          Utils._.underscoredIf(Utils.singularize(this.source.name, this.target.options.language), this.target.options.underscored),
          this.source.primaryKeyAttribute
        ].join('_'),
        !this.source.options.underscored
      );
    }

    this.identifier = this.options.foreignKey;
    this.sourceIdentifier = this.source.primaryKeyAttribute;
    this.associationAccessor = this.as;
    this.options.useHooks = options.useHooks;

    this.accessors = {
      get: Utils._.camelize('get_' + this.as),
      set: Utils._.camelize('set_' + this.as),
      create: Utils._.camelize('create_' + this.as)
    };
  };

  // the id is in the target table
  HasOne.prototype.injectAttributes = function() {
    var newAttributes = {}
      , keyType = this.source.rawAttributes[this.sourceIdentifier].type;

    newAttributes[this.identifier] = Utils._.defaults(this.foreignKeyAttribute, { type: this.options.keyType || keyType });
    Utils._.defaults(this.target.rawAttributes, newAttributes);

    if (this.options.constraints !== false) {
      this.options.onDelete = this.options.onDelete || 'SET NULL';
      this.options.onUpdate = this.options.onUpdate || 'CASCADE';
    }
    Helpers.addForeignKeyConstraints(this.target.rawAttributes[this.identifier], this.source, this.target, this.options);

    // Sync attributes and setters/getters to DAO prototype
    this.target.refreshAttributes();

    Helpers.checkNamingCollision(this);

    return this;
  };

  HasOne.prototype.injectGetter = function(instancePrototype) {
    var association = this;

    instancePrototype[this.accessors.get] = function(params) {
      var where = {};

      params = params || {};
      params.where = (params.where && [params.where]) || [];

      where[association.identifier] = this.get(association.sourceIdentifier);
      params.where.push(where);

      params.where = new Utils.and(params.where);

      return association.target.find(params);
    };

    return this;
  };

  HasOne.prototype.injectSetter = function(instancePrototype) {
    var association = this;

    instancePrototype[this.accessors.set] = function(associatedInstance, options) {
      var instance = this;

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

    instancePrototype[this.accessors.create] = function(values, fieldsOrOptions) {
      var instance = this
        , options = {};

      if ((fieldsOrOptions || {}).transaction instanceof Transaction) {
        options.transaction = fieldsOrOptions.transaction;
      }

      return association.target.create(values, fieldsOrOptions).then(function(associationInstance) {
        return instance[association.accessors.set](associationInstance, options);
      });
    };

    return this;
  };

  return HasOne;
})();
