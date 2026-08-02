import * as Utils from '../utils.js';
import * as Helpers from './helpers.js';
import Transaction from '../transaction.js';
import Association from './base.js';
import Op from '../operators.js';

/**
 * One-to-one association
 *
 * In the API reference below, add the name of the association to the method, e.g. for `User.belongsTo(Project)` the getter will be `user.getProject()`.
 *
 * @see {@link Model.belongsTo}
 */
export class BelongsTo extends Association {
  constructor(source, target, options) {
    super(source, target, options);

    this.associationType = 'BelongsTo';
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

    if (typeof this.options.foreignKey === 'object' && this.options.foreignKey !== null) {
      this.foreignKeyAttribute = this.options.foreignKey;
      this.foreignKey = this.foreignKeyAttribute.name || this.foreignKeyAttribute.fieldName;
    } else if (this.options.foreignKey) {
      this.foreignKey = this.options.foreignKey;
    }

    if (!this.foreignKey) {
      this.foreignKey = Utils.camelizeIf(
        [Utils.underscoredIf(this.as, this.source.options.underscored), this.target.primaryKeyAttribute].join('_'),
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
      get: 'get' + singular,
      set: 'set' + singular,
      create: 'create' + singular
    };
  }

  // the id is in the source table
  injectAttributes() {
    const newAttributes = {};

    newAttributes[this.foreignKey] = Object.assign(
      {
        type: this.options.keyType || this.target.rawAttributes[this.targetKey].type,
        allowNull: true
      },
      this.foreignKeyAttribute
    );

    if (this.options.constraints !== false) {
      const source = this.source.rawAttributes[this.foreignKey] || newAttributes[this.foreignKey];
      this.options.onDelete = this.options.onDelete || (source.allowNull ? 'SET NULL' : 'NO ACTION');
      this.options.onUpdate = this.options.onUpdate || 'CASCADE';
    }

    Helpers.addForeignKeyConstraints(
      newAttributes[this.foreignKey],
      this.target,
      this.source,
      this.options,
      this.targetKeyField
    );
    Utils.mergeDefaults(this.source.rawAttributes, newAttributes);

    this.identifierField = this.source.rawAttributes[this.foreignKey].field || this.foreignKey;

    this.source.refreshAttributes();

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
   * @param {String|Boolean} [options.scope] Apply a scope on the related model, or remove its default scope by passing false.
   * @param {String} [options.schema] Apply a schema on the related model
   * @see {@link Model.findOne} for a full explanation of options
   * @return {Promise<Model>}
   */
  async get(instances, options) {
    const association = this;
    const where = {};
    let Target = association.target;
    let instance;

    options = Utils.cloneDeep(options);

    if (Object.hasOwn(options, 'scope')) {
      if (!options.scope) {
        Target = Target.unscoped();
      } else {
        Target = Target.scope(options.scope);
      }
    }

    if (Object.hasOwn(options, 'schema')) {
      Target = Target.schema(options.schema, options.schemaDelimiter);
    }

    if (!Array.isArray(instances)) {
      instance = instances;
      instances = undefined;
    }

    if (instances) {
      where[association.targetKey] = {
        [Op.in]: instances.map((inst) => inst.get(association.foreignKey))
      };
    } else {
      if (association.targetKeyIsPrimary && !options.where) {
        return Target.findByPk(instance.get(association.foreignKey), options);
      } else {
        where[association.targetKey] = instance.get(association.foreignKey);
        options.limit = null;
      }
    }

    options.where = options.where ? { [Op.and]: [where, options.where] } : where;

    if (instances) {
      const results = await Target.findAll(options);
      const result = {};

      for (const inst of instances) {
        result[inst.get(association.foreignKey, { raw: true })] = null;
      }

      for (const inst of results) {
        result[inst.get(association.targetKey, { raw: true })] = inst;
      }

      return result;
    }

    return Target.findOne(options);
  }

  /**
   * Set the associated model.
   *
   * @param {Model|String|Number} [newAssociation] An persisted instance or the primary key of an instance to associate with this. Pass `null` or `undefined` to remove the association.
   * @param {Object} [options] Options passed to `this.save`
   * @param {Boolean} [options.save=true] Skip saving this after setting the foreign key if false.
   * @return {Promise}
   */
  set(sourceInstance, associatedInstance, options) {
    const association = this;

    options = options || {};

    let value = associatedInstance;
    if (associatedInstance instanceof association.target) {
      value = associatedInstance[association.targetKey];
    }

    sourceInstance.set(association.foreignKey, value);

    if (options.save === false) {
      return;
    }

    options = Object.assign(
      {
        fields: [association.foreignKey],
        allowNull: [association.foreignKey],
        association: true
      },
      options
    );

    // passes the changed field to save, so only that field get updated.
    return sourceInstance.save(options);
  }

  /**
   * Create a new instance of the associated model and associate it with this.
   *
   * @param {Object} [values]
   * @param {Object} [options] Options passed to `target.create` and setAssociation.
   * @see {@link Model#create}  for a full explanation of options
   * @return {Promise}
   */
  async create(sourceInstance, values, fieldsOrOptions) {
    const association = this;

    const options = {};

    if ((fieldsOrOptions || {}).transaction instanceof Transaction) {
      options.transaction = fieldsOrOptions.transaction;
    }

    options.logging = (fieldsOrOptions || {}).logging;

    const newAssociatedObject = await association.target.create(values, fieldsOrOptions);

    return sourceInstance[association.accessors.set](newAssociatedObject, options);
  }
}

export default BelongsTo;
