'use strict';

const Utils = require('./../utils');
const Helpers = require('./helpers');
const _ = require('lodash');
const Association = require('./base');

/**
 * One-to-one association
 *
 * In the API reference below, add the name of the association to the method, e.g. for `User.hasOne(Project)` the getter will be `user.getProject()`.
 * This is almost the same as `belongsTo` with one exception - The foreign key will be defined on the target model.
 *
 * @see {@link Model.hasOne}
 */
class HasOne extends Association {
  constructor(source, target, options) {
    super(source, target, options);

    this.associationType = 'HasOne';
    this.isSingleAssociation = true;
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
          Utils.underscoredIf(Utils.singularize(this.options.as || this.source.name), this.target.options.underscored),
          this.source.primaryKeyAttribute
        ].join('_'),
        !this.source.options.underscored
      );
    }

    this.sourceIdentifier = this.source.primaryKeyAttribute;
    this.sourceKey = this.source.primaryKeyAttribute;
    this.sourceKeyIsPrimary = this.sourceKey === this.source.primaryKeyAttribute;

    this.associationAccessor = this.as;
    this.options.useHooks = options.useHooks;

    if (this.target.rawAttributes[this.foreignKey]) {
      this.identifierField = this.target.rawAttributes[this.foreignKey].field || this.foreignKey;
    }

    // Get singular name, trying to uppercase the first letter, unless the model forbids it
    const singular = Utils.uppercaseFirst(this.options.name.singular);

    this.accessors = {
      get: 'get' + singular,
      set: 'set' + singular,
      create: 'create' + singular
    };
  }

  // the id is in the target table
  injectAttributes() {
    const newAttributes = {};
    const keyType = this.source.rawAttributes[this.source.primaryKeyAttribute].type;

    newAttributes[this.foreignKey] = _.defaults({}, this.foreignKeyAttribute, {
      type: this.options.keyType || keyType,
      allowNull : true
    });
    Utils.mergeDefaults(this.target.rawAttributes, newAttributes);

    this.identifierField = this.target.rawAttributes[this.foreignKey].field || this.foreignKey;

    if (this.options.constraints !== false) {
      const target = this.target.rawAttributes[this.foreignKey] || newAttributes[this.foreignKey];
      this.options.onDelete = this.options.onDelete || (target.allowNull ? 'SET NULL' : 'CASCADE');
      this.options.onUpdate = this.options.onUpdate || 'CASCADE';
    }

    Helpers.addForeignKeyConstraints(this.target.rawAttributes[this.foreignKey], this.source, this.target, this.options);

    // Sync attributes and setters/getters to Model prototype
    this.target.refreshAttributes();

    Helpers.checkNamingCollision(this);

    return this;
  }

  mixin(obj) {
    const methods = ['get', 'set', 'create'];

    Helpers.mixinMethods(this, obj, methods);
  }

  /**
   * Get the associated instance.
   *
   * @param {Object} [options]
   * @param {String|Boolean} [options.scope] Apply a scope on the related model, or remove its default scope by passing false
   * @param {String} [options.schema] Apply a schema on the related model
   * @see {@link Model.findOne} for a full explanation of options
   * @return {Promise<Model>}
   */
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
      where[association.foreignKey] = {
        $in: instances.map(instance => instance.get(association.sourceKey))
      };
    } else {
      where[association.foreignKey] = instance.get(association.sourceKey);
    }

    if (association.scope) {
      _.assign(where, association.scope);
    }

    options.where = options.where ?
      {$and: [where, options.where]} :
      where;

    if (instances) {
      return Target.findAll(options).then(results => {
        const result = {};
        for (const instance of instances) {
          result[instance.get(association.sourceKey, {raw: true})] = null;
        }

        for (const instance of results) {
          result[instance.get(association.foreignKey, {raw: true})] = instance;
        }

        return result;
      });
    }
    return Target.findOne(options);
  }

  /**
   * Set the associated model.
   *
   * @param {Model|String|Number} [newAssociation] An persisted instance or the primary key of a persisted instance to associate with this. Pass `null` or `undefined` to remove the association.
   * @param {Object} [options] Options passed to getAssociation and `target.save`
   * @return {Promise}
   */
  set(sourceInstance, associatedInstance, options) {
    const association = this;

    let alreadyAssociated;

    options = _.assign({}, options, {
      scope: false
    });

    return sourceInstance[association.accessors.get](options).then(oldInstance => {
      // TODO Use equals method once #5605 is resolved
      alreadyAssociated = oldInstance && associatedInstance && _.every(association.target.primaryKeyAttributes, attribute =>
        oldInstance.get(attribute, {raw: true}) === (associatedInstance.get ? associatedInstance.get(attribute, {raw: true}) : associatedInstance)
      );

      if (oldInstance && !alreadyAssociated) {
        oldInstance[association.foreignKey] = null;
        return oldInstance.save(_.extend({}, options, {
          fields: [association.foreignKey],
          allowNull: [association.foreignKey],
          association: true
        }));
      }
    }).then(() => {
      if (associatedInstance && !alreadyAssociated) {
        if (!(associatedInstance instanceof association.target)) {
          const tmpInstance = {};
          tmpInstance[association.target.primaryKeyAttribute] = associatedInstance;
          associatedInstance = association.target.build(tmpInstance, {
            isNewRecord: false
          });
        }

        _.assign(associatedInstance, association.scope);
        associatedInstance.set(association.foreignKey, sourceInstance.get(association.sourceIdentifier));

        return associatedInstance.save(options);
      }

      return null;
    });
  }

  /**
   * Create a new instance of the associated model and associate it with this.
   *
   * @param {Object} [values]
   * @param {Object} [options] Options passed to `target.create` and setAssociation.
   * @see {@link Model#create} for a full explanation of options
   * @return {Promise}
   */
  create(sourceInstance, values, options) {
    const association = this;

    values = values || {};
    options = options || {};

    if (association.scope) {
      for (const attribute of Object.keys(association.scope)) {
        values[attribute] = association.scope[attribute];
        if (options.fields) {
          options.fields.push(attribute);
        }
      }
    }

    values[association.foreignKey] = sourceInstance.get(association.sourceIdentifier);
    if (options.fields) {
      options.fields.push(association.foreignKey);
    }

    return association.target.create(values, options);
  }
}

module.exports = HasOne;
