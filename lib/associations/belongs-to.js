'use strict';

const Utils = require('./../utils');
const Helpers = require('./helpers');
const _ = require('lodash');
const Transaction = require('../transaction');
const Association = require('./base');

/**
 * One-to-one association
 *
 * In the API reference below, replace `Assocation` with the actual name of your association, e.g. for `User.belongsTo(Project)` the getter will be `user.getProject()`.
 *
 * @mixin BelongsTo
 */
class BelongsTo extends Association {
  constructor(source, target, options) {
    super();

    this.associationType = 'BelongsTo';
    this.source = source;
    this.target = target;
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
          Utils.underscoredIf(this.as, this.source.options.underscored),
          this.target.primaryKeyAttribute
        ].join('_'),
        !this.source.options.underscored
      );
    }

    this.identifier = this.foreignKey;

    if (this.source.rawAttributes[this.identifier]) {
      this.identifierField = this.source.rawAttributes[this.identifier].field || this.identifier;
    }

    this.targetKey = this.options.targetKey || this.target.primaryKeyAttribute;
    this.targetKeyField = this.target.rawAttributes[this.targetKey].field || this.targetKey;
    this.targetKeyIsPrimary = this.targetKey === this.target.primaryKeyAttribute;

    this.targetIdentifier = this.targetKey;
    this.associationAccessor = this.as;
    this.options.useHooks = options.useHooks;

    // Get singular name, trying to uppercase the first letter, unless the model forbids it
    const singular = Utils.uppercaseFirst(this.options.name.singular);

    this.accessors = {
      /**
       * Get the associated instance.
       *
       * @param {Object} [options]
       * @param {String|Boolean} [options.scope] Apply a scope on the related model, or remove its default scope by passing false.
       * @param {String} [options.schema] Apply a schema on the related model
       * @see {Model#findOne} for a full explanation of options
       * @return {Promise<Instance>}
       * @method getAssociation
       */
      get: 'get' + singular,
      /**
       * Set the associated model.
       *
       * @param {Instance|String|Number} [newAssociation] An persisted instance or the primary key of an instance to associate with this. Pass `null` or `undefined` to remove the association.
       * @param {Object} [options] Options passed to `this.save`
       * @param {Boolean} [options.save=true] Skip saving this after setting the foreign key if false.
       * @return {Promise}
       * @method setAssociation
       */
      set: 'set' + singular,
      /**
       * Create a new instance of the associated model and associate it with this.
       *
       * @param {Object} [values]
       * @param {Object} [options] Options passed to `target.create` and setAssociation.
       * @see {Model#create}  for a full explanation of options
       * @return {Promise}
       * @method createAssociation
       */
      create: 'create' + singular
    };
  }

  // the id is in the source table
  injectAttributes() {
    const newAttributes = {};

    newAttributes[this.foreignKey] = _.defaults({}, this.foreignKeyAttribute, {
      type: this.options.keyType || this.target.rawAttributes[this.targetKey].type,
      allowNull : true
    });

    if (this.options.constraints !== false) {
      const source = this.source.rawAttributes[this.foreignKey] || newAttributes[this.foreignKey];
      this.options.onDelete = this.options.onDelete || (source.allowNull ? 'SET NULL' : 'NO ACTION');
      this.options.onUpdate = this.options.onUpdate || 'CASCADE';
    }

    Helpers.addForeignKeyConstraints(newAttributes[this.foreignKey], this.target, this.source, this.options, this.targetKeyField);
    Utils.mergeDefaults(this.source.rawAttributes, newAttributes);

    this.identifierField = this.source.rawAttributes[this.foreignKey].field || this.foreignKey;

    this.source.refreshAttributes();

    Helpers.checkNamingCollision(this);

    return this;
  }

  mixin(obj) {
    const association = this;

    obj[this.accessors.get] = function(options) {
      return association.get(this, options);
    };

    association.injectSetter(obj);
    association.injectCreator(obj);
  }

  get(instances, options) {
    const association = this;
    const where = {};
    let Target = association.target;
    let instance;

    options = Utils.cloneDeep(options);

    if (options.hasOwnProperty('scope')) {
      if (!options.scope) {
        Target = Target.unscoped();
      } else {
        Target = Target.scope(options.scope);
      }
    }

    if (options.hasOwnProperty('schema')) {
      Target = Target.schema(options.schema, options.schemaDelimiter);
    }

    if (!Array.isArray(instances)) {
      instance = instances;
      instances = undefined;
    }

    if (instances) {
      where[association.targetKey] = {
        $in: instances.map(instance => instance.get(association.foreignKey))
      };
    } else {
      if (association.targetKeyIsPrimary && !options.where) {
        return Target.findById(instance.get(association.foreignKey), options);
      } else {
        where[association.targetKey] = instance.get(association.foreignKey);
        options.limit = null;
      }
    }

    options.where = options.where ?
                    {$and: [where, options.where]} :
                    where;

    if (instances) {
      return Target.findAll(options).then(results => {
        const result = {};
        for (const instance of instances) {
          result[instance.get(association.foreignKey, {raw: true})] = null;
        }

        for (const instance of results) {
          result[instance.get(association.targetKey, {raw: true})] = instance;
        }

        return result;
      });
    }
    return Target.findOne(options);
  }

  // Add setAssociation method to the prototype of the model instance
  injectSetter(instancePrototype) {
    const association = this;

    instancePrototype[this.accessors.set] = function(associatedInstance, options) {
      options = options || {};

      let value = associatedInstance;
      if (associatedInstance instanceof association.target) {
        value = associatedInstance[association.targetKey];
      }

      this.set(association.foreignKey, value);

      if (options.save === false) return;

      options = _.extend({
        fields: [association.foreignKey],
        allowNull: [association.foreignKey],
        association: true
      }, options);


      // passes the changed field to save, so only that field get updated.
      return this.save(options);
    };

    return this;
  }

  // Add createAssociation method to the prototype of the model instance
  injectCreator(instancePrototype) {
    const association = this;

    instancePrototype[this.accessors.create] = function(values, fieldsOrOptions) {
      const options = {};

      if ((fieldsOrOptions || {}).transaction instanceof Transaction) {
        options.transaction = fieldsOrOptions.transaction;
      }
      options.logging = (fieldsOrOptions || {}).logging;

      return association.target.create(values, fieldsOrOptions).then(newAssociatedObject =>
        this[association.accessors.set](newAssociatedObject, options)
      );
    };

    return this;
  }
}

module.exports = BelongsTo;
module.exports.BelongsTo = BelongsTo;
module.exports.default = BelongsTo;
