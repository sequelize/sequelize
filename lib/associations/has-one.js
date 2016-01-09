'use strict';

var Utils = require('./../utils')
  , Helpers = require('./helpers')
  , _ = require('lodash')
  , Association = require('./base')
  , util = require('util');

/**
 * One-to-one association
 *
 * In the API reference below, replace `Association` with the actual name of your association, e.g. for `User.hasOne(Project)` the getter will be `user.getProject()`.
 * This is almost the same as `belongsTo` with one exception. The foreign key will be defined on the target model.
 *
 * @mixin HasOne
 */
var HasOne = function(srcModel, targetModel, options) {
  Association.call(this);

  this.associationType = 'HasOne';
  this.source = srcModel;
  this.target = targetModel;
  this.options = options;
  this.scope = options.scope;
  this.isSingleAssociation = true;
  this.isSelfAssociation = (this.source === this.target);
  this.as = this.options.as;
  this.foreignKeyAttribute = {};

  if (this.as) {
    this.isAliased = true;
    this.options.name = {
      singular: this.as
    };
  } else {
    this.as = this.target.options.name.singular;
    this.options.name = this.target.options.name;
  }

  if (_.isObject(this.options.foreignKey)) {
    this.foreignKeyAttribute = this.options.foreignKey;
    this.foreignKey = this.foreignKeyAttribute.name || this.foreignKeyAttribute.fieldName;
  } else if (this.options.foreignKey) {
    this.foreignKey = this.options.foreignKey;
  }

  if (!this.foreignKey) {
    this.foreignKey = Utils.camelizeIf(
      [
        Utils.underscoredIf(Utils.singularize(this.source.name), this.target.options.underscored),
        this.source.primaryKeyAttribute
      ].join('_'),
      !this.source.options.underscored
    );
  }

  this.sourceIdentifier = this.source.primaryKeyAttribute;
  this.associationAccessor = this.as;
  this.options.useHooks = options.useHooks;

  if (this.target.rawAttributes[this.foreignKey]) {
    this.identifierField = this.target.rawAttributes[this.foreignKey].field || this.foreignKey;
  }

  // Get singular name, trying to uppercase the first letter, unless the model forbids it
  var singular = Utils.uppercaseFirst(this.options.name.singular);

  this.accessors = {
    /**
     * Get the associated instance.
     *
     * @param {Object} [options]
     * @param {String|Boolean} [options.scope] Apply a scope on the related model, or remove its default scope by passing false
     * @param {String} [options.schema] Apply a schema on the related model
     * @return {Promise<Instance>}
     * @method getAssociation
     */
    get: 'get' + singular,
    /**
     * Set the associated model.
     *
     * @param {Instance|String|Number} [newAssociation] An instance or the primary key of an instance to associate with this. Pass `null` or `undefined` to remove the association.
     * @param {Object} [options] Options passed to getAssociation and `target.save`
     * @return {Promise}
     * @method setAssociation
     */
    set: 'set' + singular,
    /**
     * Create a new instance of the associated model and associate it with this.
     *
     * @param {Object} [values]
     * @param {Object} [options] Options passed to `target.create` and setAssociation.
     * @return {Promise}
     * @method createAssociation
     */
    create: 'create' + singular
  };
};

util.inherits(HasOne, Association);

// the id is in the target table
HasOne.prototype.injectAttributes = function() {
  var newAttributes = {}
    , keyType = this.source.rawAttributes[this.source.primaryKeyAttribute].type;

  newAttributes[this.foreignKey] = _.defaults({}, this.foreignKeyAttribute, {
    type: this.options.keyType || keyType,
    allowNull : true
  });
  Utils.mergeDefaults(this.target.rawAttributes, newAttributes);

  this.identifierField = this.target.rawAttributes[this.foreignKey].field || this.foreignKey;

  if (this.options.constraints !== false) {
    var target = this.target.rawAttributes[this.foreignKey] || newAttributes[this.foreignKey];
    this.options.onDelete = this.options.onDelete || (target.allowNull ? 'SET NULL' : 'CASCADE');
    this.options.onUpdate = this.options.onUpdate || 'CASCADE';
  }

  Helpers.addForeignKeyConstraints(this.target.rawAttributes[this.foreignKey], this.source, this.target, this.options);

  // Sync attributes and setters/getters to Model prototype
  this.target.refreshAttributes();

  Helpers.checkNamingCollision(this);

  return this;
};

HasOne.prototype.injectGetter = function(instancePrototype) {
  var association = this;

  instancePrototype[this.accessors.get] = function(options) {
    var where = {};
    where[association.foreignKey] = this.get(association.sourceIdentifier);

    if (association.scope) {
      _.assign(where, association.scope);
    }

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

    if (options.hasOwnProperty('schema')) {
      model = model.schema(options.schema, options.schemaDelimiter);
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
        oldInstance[association.foreignKey] = null;
        return oldInstance.save(_.extend({}, options, {
          fields: [association.foreignKey],
          allowNull: [association.foreignKey],
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

        _.assign(associatedInstance, association.scope);
        associatedInstance.set(association.foreignKey, instance.get(association.sourceIdentifier));

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

    if (association.scope) {
      Object.keys(association.scope).forEach(function (attribute) {
        values[attribute] = association.scope[attribute];
        if (options.fields) options.fields.push(attribute);
      });
    }

    values[association.foreignKey] = instance.get(association.sourceIdentifier);
    if (options.fields) options.fields.push(association.foreignKey);
    return association.target.create(values, options);
  };

  return this;
};

module.exports = HasOne;
