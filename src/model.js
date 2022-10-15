'use strict';

import { isModelStatic, isSameInitialModel } from './utils/model-utils';

const assert = require('assert');
const NodeUtil = require('util');
const _ = require('lodash');
const Dottie = require('dottie');
const Utils = require('./utils');
const { logger } = require('./utils/logger');
const { BelongsTo, BelongsToMany, Association, HasMany, HasOne } = require('./associations');
const { AssociationSecret } = require('./associations/helpers');
const { InstanceValidator } = require('./instance-validator');
const { QueryTypes } = require('./query-types');
const sequelizeErrors = require('./errors');
const DataTypes = require('./data-types');
const Hooks = require('./hooks');
const { Op } = require('./operators');
const { _validateIncludedElements, combineIncludes, throwInvalidInclude, setTransactionFromCls } = require('./model-internals');
const { noDoubleNestedGroup, scopeRenamedToWithScope, schemaRenamedToWithSchema, noModelDropSchema } = require('./utils/deprecations');

// This list will quickly become dated, but failing to maintain this list just means
// we won't throw a warning when we should. At least most common cases will forever be covered
// so we stop throwing erroneous warnings when we shouldn't.
const validQueryKeywords = new Set(['where', 'attributes', 'paranoid', 'include', 'order', 'limit', 'offset',
  'transaction', 'lock', 'raw', 'logging', 'benchmark', 'having', 'searchPath', 'rejectOnEmpty', 'plain',
  'scope', 'group', 'through', 'defaults', 'distinct', 'primary', 'exception', 'type', 'hooks', 'force',
  'name']);

// List of attributes that should not be implicitly passed into subqueries/includes.
const nonCascadingOptions = ['include', 'attributes', 'originalAttributes', 'order', 'where', 'limit', 'offset', 'plain', 'group', 'having'];

/**
 * A Model represents a table in the database. Instances of this class represent a database row.
 *
 * Model instances operate with the concept of a `dataValues` property, which stores the actual values represented by the
 * instance. By default, the values from dataValues can also be accessed directly from the Instance, that is:
 * ```js
 * instance.field
 * // is the same as
 * instance.get('field')
 * // is the same as
 * instance.getDataValue('field')
 * ```
 * However, if getters and/or setters are defined for `field` they will be invoked, instead of returning the value from
 * `dataValues`. Accessing properties directly or using `get` is preferred for regular use, `getDataValue` should only be
 * used for custom getters.
 *
 * @see {Sequelize#define} for more information about getters and setters
 * @mixes Hooks
 */
export class Model {
  static get queryInterface() {
    return this.sequelize.getQueryInterface();
  }

  static get queryGenerator() {
    return this.queryInterface.queryGenerator;
  }

  /**
   * A reference to the sequelize instance
   *
   * @property sequelize
   *
   * @returns {Sequelize}
   */
  get sequelize() {
    return this.constructor.sequelize;
  }

  /**
   * Builds a new model instance.
   *
   * @param {object}  [values={}] an object of key value pairs
   * @param {object}  [options] instance construction options
   * @param {boolean} [options.raw=false] If set to true, values will ignore field and virtual setters.
   * @param {boolean} [options.isNewRecord=true] Is this a new record
   * @param {Array}   [options.include] an array of include options - Used to build prefetched/included model instances. See
   *   `set`
   */
  constructor(values = {}, options = {}) {
    if (!this.constructor._overwrittenAttributesChecked) {
      this.constructor._overwrittenAttributesChecked = true;

      // setTimeout is hacky but necessary.
      // Public Class Fields declared by descendants of this class
      // will not be available until after their call to super, so after
      // this constructor is done running.
      setTimeout(() => {
        const overwrittenAttributes = [];
        for (const key of Object.keys(this.constructor._attributeManipulation)) {
          if (Object.prototype.hasOwnProperty.call(this, key)) {
            overwrittenAttributes.push(key);
          }
        }

        if (overwrittenAttributes.length > 0) {
          logger.warn(`Model ${JSON.stringify(this.constructor.name)} is declaring public class fields for attribute(s): ${overwrittenAttributes.map(attr => JSON.stringify(attr)).join(', ')}.`
            + '\nThese class fields are shadowing Sequelize\'s attribute getters & setters.'
            + '\nSee https://sequelize.org/docs/v7/core-concepts/model-basics/#caveat-with-public-class-fields');
        }
      }, 0);
    }

    options = {
      isNewRecord: true,
      _schema: this.constructor._schema,
      _schemaDelimiter: this.constructor._schemaDelimiter,
      ...options,
      model: this.constructor,
    };

    if (options.attributes) {
      options.attributes = options.attributes.map(attribute => (Array.isArray(attribute) ? attribute[1] : attribute));
    }

    if (!options.includeValidated) {
      this.constructor._conformIncludes(options, this.constructor);
      if (options.include) {
        this.constructor._expandIncludeAll(options);
        _validateIncludedElements(options);
      }
    }

    this.dataValues = {};
    this._previousDataValues = {};
    this.uniqno = 1;
    this._changed = new Set();
    this._options = options;

    /**
     * Returns true if this instance has not yet been persisted to the database
     *
     * @property isNewRecord
     * @returns {boolean}
     */
    this.isNewRecord = options.isNewRecord;

    this._initValues(values, options);
  }

  _initValues(values, options) {
    let defaults;
    let key;

    values = { ...values };

    if (options.isNewRecord) {
      defaults = {};

      if (this.constructor._hasDefaultValues) {
        defaults = _.mapValues(this.constructor._defaultValues, valueFn => {
          const value = valueFn();

          return value && value instanceof Utils.SequelizeMethod ? value : _.cloneDeep(value);
        });
      }

      // set id to null if not passed as value, a newly created dao has no id
      // removing this breaks bulkCreate
      // do after default values since it might have UUID as a default value
      if (this.constructor.primaryKeyAttributes.length > 0) {
        for (const primaryKeyAttribute of this.constructor.primaryKeyAttributes) {
          if (!Object.prototype.hasOwnProperty.call(defaults, primaryKeyAttribute)) {
            defaults[primaryKeyAttribute] = null;
          }
        }
      }

      if (this.constructor._timestampAttributes.createdAt && defaults[this.constructor._timestampAttributes.createdAt]) {
        this.dataValues[this.constructor._timestampAttributes.createdAt] = Utils.toDefaultValue(defaults[this.constructor._timestampAttributes.createdAt], this.sequelize.dialect);
        delete defaults[this.constructor._timestampAttributes.createdAt];
      }

      if (this.constructor._timestampAttributes.updatedAt && defaults[this.constructor._timestampAttributes.updatedAt]) {
        this.dataValues[this.constructor._timestampAttributes.updatedAt] = Utils.toDefaultValue(defaults[this.constructor._timestampAttributes.updatedAt], this.sequelize.dialect);
        delete defaults[this.constructor._timestampAttributes.updatedAt];
      }

      if (this.constructor._timestampAttributes.deletedAt && defaults[this.constructor._timestampAttributes.deletedAt]) {
        this.dataValues[this.constructor._timestampAttributes.deletedAt] = Utils.toDefaultValue(defaults[this.constructor._timestampAttributes.deletedAt], this.sequelize.dialect);
        delete defaults[this.constructor._timestampAttributes.deletedAt];
      }

      for (key in defaults) {
        if (values[key] === undefined) {
          this.set(key, Utils.toDefaultValue(defaults[key], this.sequelize.dialect), { raw: true });
          delete values[key];
        }
      }
    }

    this.set(values, options);
  }

  // validateIncludedElements should have been called before this method
  static _paranoidClause(model, options = {}) {
    // Apply on each include
    // This should be handled before handling where conditions because of logic with returns
    // otherwise this code will never run on includes of a already conditionable where
    if (options.include) {
      for (const include of options.include) {
        this._paranoidClause(include.model, include);
      }
    }

    // apply paranoid when groupedLimit is used
    if (_.get(options, 'groupedLimit.on.through.model.options.paranoid')) {
      const throughModel = _.get(options, 'groupedLimit.on.through.model');
      if (throughModel) {
        options.groupedLimit.through = this._paranoidClause(throughModel, options.groupedLimit.through);
      }
    }

    if (!model.options.timestamps || !model.options.paranoid || options.paranoid === false) {
      // This model is not paranoid, nothing to do here;
      return options;
    }

    const deletedAtCol = model._timestampAttributes.deletedAt;
    const deletedAtAttribute = model.rawAttributes[deletedAtCol];
    const deletedAtObject = {};

    let deletedAtDefaultValue = Object.prototype.hasOwnProperty.call(deletedAtAttribute, 'defaultValue') ? deletedAtAttribute.defaultValue : null;

    deletedAtDefaultValue = deletedAtDefaultValue || {
      [Op.eq]: null,
    };

    deletedAtObject[deletedAtAttribute.field || deletedAtCol] = deletedAtDefaultValue;

    if (Utils.isWhereEmpty(options.where)) {
      options.where = deletedAtObject;
    } else {
      options.where = { [Op.and]: [deletedAtObject, options.where] };
    }

    return options;
  }

  static _addDefaultAttributes() {
    const tail = {};
    let head = {};

    // Add id if no primary key was manually added to definition
    if (!this.options.noPrimaryKey && !_.some(this.rawAttributes, 'primaryKey')) {
      if ('id' in this.rawAttributes && this.rawAttributes.id.primaryKey === undefined) {
        throw new Error(`An attribute called 'id' was defined in model '${this.tableName}' but primaryKey is not set. This is likely to be an error, which can be fixed by setting its 'primaryKey' option to true. If this is intended, explicitly set its 'primaryKey' option to false`);
      }

      head = {
        id: {
          type: new DataTypes.INTEGER(),
          allowNull: false,
          primaryKey: true,
          autoIncrement: true,
          _autoGenerated: true,
        },
      };
    }

    if (this._timestampAttributes.createdAt) {
      tail[this._timestampAttributes.createdAt] = {
        type: DataTypes.DATE,
        allowNull: false,
        _autoGenerated: true,
      };
    }

    if (this._timestampAttributes.updatedAt) {
      tail[this._timestampAttributes.updatedAt] = {
        type: DataTypes.DATE,
        allowNull: false,
        _autoGenerated: true,
      };
    }

    if (this._timestampAttributes.deletedAt) {
      tail[this._timestampAttributes.deletedAt] = {
        type: DataTypes.DATE,
        _autoGenerated: true,
      };
    }

    if (this._versionAttribute) {
      tail[this._versionAttribute] = {
        type: DataTypes.INTEGER,
        allowNull: false,
        defaultValue: 0,
        _autoGenerated: true,
      };
    }

    const newRawAttributes = {
      ...head,
      ...this.rawAttributes,
    };
    _.each(tail, (value, attr) => {
      if (newRawAttributes[attr] === undefined) {
        newRawAttributes[attr] = value;
      }
    });

    this.rawAttributes = newRawAttributes;
  }

  /**
   * Returns the attributes of the model.
   *
   * @returns {object|any}
  */
  static getAttributes() {
    return this.rawAttributes;
  }

  static _findAutoIncrementAttribute() {
    this.autoIncrementAttribute = null;

    for (const name in this.rawAttributes) {
      if (Object.prototype.hasOwnProperty.call(this.rawAttributes, name)) {
        const definition = this.rawAttributes[name];
        if (definition && definition.autoIncrement) {
          if (this.autoIncrementAttribute) {
            throw new Error('Invalid Instance definition. Only one autoincrement field allowed.');
          }

          this.autoIncrementAttribute = name;
        }
      }
    }
  }

  static _getAssociationDebugList() {
    return `The following associations are defined on "${this.name}": ${Object.keys(this.associations).map(associationName => `"${associationName}"`).join(', ')}`;
  }

  static getAssociation(associationName) {
    if (!Object.prototype.hasOwnProperty.call(this.associations, associationName)) {
      throw new Error(`Association with alias "${associationName}" does not exist on ${this.name}.
${this._getAssociationDebugList()}`);
    }

    return this.associations[associationName];
  }

  static _getAssociationsByModel(model) {
    const matchingAssociations = [];

    for (const associationName of Object.keys(this.associations)) {
      const association = this.associations[associationName];
      if (!isSameInitialModel(association.target, model)) {
        continue;
      }

      matchingAssociations.push(association);
    }

    return matchingAssociations;
  }

  static _normalizeIncludes(options, associationOwner) {
    this._conformIncludes(options, associationOwner);
    this._expandIncludeAll(options, associationOwner);
  }

  static _conformIncludes(options, associationOwner) {
    if (!options.include) {
      return;
    }

    // if include is not an array, wrap in an array
    if (!Array.isArray(options.include)) {
      options.include = [options.include];
    } else if (options.include.length === 0) {
      delete options.include;

      return;
    }

    // convert all included elements to { model: Model } form
    options.include = options.include.map(include => this._conformInclude(include, associationOwner));
  }

  static _conformInclude(include, associationOwner) {
    if (!include) {
      throwInvalidInclude(include);
    }

    if (!associationOwner || !isModelStatic(associationOwner)) {
      throw new TypeError(`Sequelize sanity check: associationOwner must be a model subclass. Got ${NodeUtil.inspect(associationOwner)} (${typeof associationOwner})`);
    }

    if (include._pseudo) {
      return include;
    }

    if (include.all) {
      this._conformIncludes(include, associationOwner);

      return include;
    }

    // normalize to IncludeOptions
    if (!_.isPlainObject(include)) {
      if (isModelStatic(include)) {
        include = {
          model: include,
        };
      } else {
        include = {
          association: include,
        };
      }
    } else {
      // copy object so we can mutate it without side effects
      include = { ...include };
    }

    if (include.as && !include.association) {
      include.association = include.as;
    }

    if (!include.association) {
      include.association = associationOwner.getAssociationWithModel(include.model, include.as);
    } else if (typeof include.association === 'string') {
      include.association = associationOwner.getAssociation(include.association);
    } else {
      if (!(include.association instanceof Association)) {
        throwInvalidInclude(include);
      }

      if (!isSameInitialModel(include.association.source, associationOwner)) {
        throw new Error(`Invalid Include received: the specified association "${include.association.as}" is not defined on model "${associationOwner.name}". It is owned by model "${include.association.source.name}".
${associationOwner._getAssociationDebugList()}`);
      }
    }

    if (!include.model) {
      include.model = include.association.target;
    }

    if (!isSameInitialModel(include.model, include.association.target)) {
      throw new TypeError(`Invalid Include received: the specified "model" option ("${include.model.name}") does not match the target ("${include.association.target.name}") of the "${include.association.as}" association.`);
    }

    if (!include.as) {
      include.as = include.association.as;
    }

    this._conformIncludes(include, include.model);

    return include;
  }

  static _expandIncludeAllElement(includes, include) {
    // check 'all' attribute provided is valid
    let { all, nested, ...includeOptions } = include;

    if (Object.keys(includeOptions).length > 0) {
      throw new Error('"include: { all: true }" does not allow extra options (except for "nested") because they are unsafe. Select includes one by one if you want to specify more options.');
    }

    if (all !== true) {
      if (!Array.isArray(all)) {
        all = [all];
      }

      const validTypes = {
        BelongsTo: true,
        HasOne: true,
        HasMany: true,
        One: ['BelongsTo', 'HasOne'],
        Has: ['HasOne', 'HasMany'],
        Many: ['HasMany'],
      };

      for (let i = 0; i < all.length; i++) {
        const type = all[i];
        if (type === 'All') {
          all = true;
          break;
        }

        const types = validTypes[type];
        if (!types) {
          throw new sequelizeErrors.EagerLoadingError(`include all '${type}' is not valid - must be BelongsTo, HasOne, HasMany, One, Has, Many or All`);
        }

        if (types !== true) {
          // replace type placeholder e.g. 'One' with its constituent types e.g. 'HasOne', 'BelongsTo'
          all.splice(i, 1);
          i--;
          for (const type_ of types) {
            if (!all.includes(type_)) {
              all.unshift(type_);
              i++;
            }
          }
        }
      }
    }

    const visitedModels = [];
    const addAllIncludes = (parent, includes) => {
      _.forEach(parent.associations, association => {
        if (all !== true && !all.includes(association.associationType)) {
          return;
        }

        // 'fromSourceToThroughOne' is a bit hacky and should not be included when { all: true } is specified
        //  because its parent 'belongsToMany' will be replaced by it in query generator.
        if (association.parentAssociation instanceof BelongsToMany
          && association === association.parentAssociation.fromSourceToThroughOne) {
          return;
        }

        // skip if the association is already included
        if (includes.some(existingInclude => existingInclude.association === association)) {
          return;
        }

        const newInclude = { association };

        const model = association.target;

        // skip if recursing over a model whose associations have already been included
        // to prevent infinite loops with associations such as this:
        // user -> projects -> user
        if (nested && visitedModels.includes(model)) {
          return;
        }

        // include this model
        const normalizedNewInclude = this._conformInclude(newInclude, parent);
        includes.push(normalizedNewInclude);

        // run recursively if nested
        if (nested) {
          visitedModels.push(parent);

          const subIncludes = [];
          addAllIncludes(model, subIncludes);
          visitedModels.pop();

          if (subIncludes.length > 0) {
            normalizedNewInclude.include = subIncludes;
          }
        }
      });
    };

    addAllIncludes(this, includes);
  }

  static _validateIncludedElement(include, tableNames, options) {
    tableNames[include.model.getTableName()] = true;

    if (include.attributes && !options.raw) {
      include.model._expandAttributes(include);

      include.originalAttributes = include.model._injectDependentVirtualAttributes(include.attributes);

      include = Utils.mapFinderOptions(include, include.model);

      if (include.attributes.length > 0) {
        _.each(include.model.primaryKeys, (attr, key) => {
          // Include the primary key if it's not already included - take into account that the pk might be aliased (due to a .field prop)
          if (!include.attributes.some(includeAttr => {
            if (attr.field !== key) {
              return Array.isArray(includeAttr) && includeAttr[0] === attr.field && includeAttr[1] === key;
            }

            return includeAttr === key;
          })) {
            include.attributes.unshift(key);
          }
        });
      }
    } else {
      include = Utils.mapFinderOptions(include, include.model);
    }

    // pseudo include just needed the attribute logic, return
    if (include._pseudo) {
      if (!include.attributes) {
        include.attributes = Object.keys(include.model.tableAttributes);
      }

      return Utils.mapFinderOptions(include, include.model);
    }

    // check if the current Model is actually associated with the passed Model - or it's a pseudo include
    const association = include.association || this.getAssociationWithModel(include.model, include.as);

    include.association = association;
    include.as ||= association.as;

    // If through, we create a pseudo child include, to ease our parsing later on
    if (association instanceof BelongsToMany) {
      if (!include.include) {
        include.include = [];
      }

      const through = include.association.through;

      include.through = _.defaults(include.through || {}, {
        model: through.model,
        // Through Models are a special case: we always want to load them as the name of the model, not the name of the association
        as: through.model.name,
        association: {
          isSingleAssociation: true,
        },
        _pseudo: true,
        parent: include,
      });

      if (through.scope) {
        include.through.where = include.through.where ? { [Op.and]: [include.through.where, through.scope] } : through.scope;
      }

      include.include.push(include.through);
      tableNames[through.tableName] = true;
    }

    // include.model may be the main model, while the association target may be scoped - thus we need to look at association.target/source
    let model;
    if (include.model.scoped === true) {
      // If the passed model is already scoped, keep that
      model = include.model;
    } else {
      // Otherwise use the model that was originally passed to the association
      model = include.association.target.name === include.model.name ? include.association.target : include.association.source;
    }

    model._injectScope(include);

    // This check should happen after injecting the scope, since the scope may contain a .attributes
    if (!include.attributes) {
      include.attributes = Object.keys(include.model.tableAttributes);
    }

    include = Utils.mapFinderOptions(include, include.model);

    if (include.required === undefined) {
      include.required = Boolean(include.where);
    }

    if (include.association.scope) {
      include.where = include.where ? { [Op.and]: [include.where, include.association.scope] } : include.association.scope;
    }

    if (include.limit && include.separate === undefined) {
      include.separate = true;
    }

    if (include.separate === true) {
      if (!(include.association instanceof HasMany)) {
        throw new TypeError('Only HasMany associations support include.separate');
      }

      include.duplicating = false;

      if (
        options.attributes
        && options.attributes.length > 0
        && !_.flattenDepth(options.attributes, 2).includes(association.sourceKey)
      ) {
        options.attributes.push(association.sourceKey);
      }

      if (
        include.attributes
        && include.attributes.length > 0
        && !_.flattenDepth(include.attributes, 2).includes(association.foreignKey)
      ) {
        include.attributes.push(association.foreignKey);
      }
    }

    // Validate child includes
    if (Object.prototype.hasOwnProperty.call(include, 'include')) {
      _validateIncludedElements(include, tableNames);
    }

    return include;
  }

  static _expandIncludeAll(options, associationOwner) {
    const includes = options.include;
    if (!includes) {
      return;
    }

    for (let index = 0; index < includes.length; index++) {
      const include = includes[index];

      if (include.all) {
        includes.splice(index, 1);
        index--;

        associationOwner._expandIncludeAllElement(includes, include);
      }
    }

    for (const include of includes) {
      this._expandIncludeAll(include, include.model);
    }
  }

  static _conformIndex(index) {
    if (!index.fields) {
      throw new Error('Missing "fields" property for index definition');
    }

    index = _.defaults(index, {
      type: '',
      parser: null,
    });

    if (index.type && index.type.toLowerCase() === 'unique') {
      index.unique = true;
      delete index.type;
    }

    return index;
  }

  static _baseMerge(...args) {
    _.assignWith(...args);

    return args[0];
  }

  static _mergeFunction(objValue, srcValue, key) {
    if (key === 'include') {
      return combineIncludes(objValue, srcValue);
    }

    if (Array.isArray(objValue) && Array.isArray(srcValue)) {
      return _.union(objValue, srcValue);
    }

    if (['where', 'having'].includes(key)) {
      return combineWheresWithAnd(objValue, srcValue);
    } else if (key === 'attributes' && _.isPlainObject(objValue) && _.isPlainObject(srcValue)) {
      return _.assignWith(objValue, srcValue, (objValue, srcValue) => {
        if (Array.isArray(objValue) && Array.isArray(srcValue)) {
          return _.union(objValue, srcValue);
        }
      });
    }

    // If we have a possible object/array to clone, we try it.
    // Otherwise, we return the original value when it's not undefined,
    // or the resulting object in that case.
    if (srcValue) {
      return Utils.cloneDeep(srcValue, true);
    }

    return srcValue === undefined ? objValue : srcValue;
  }

  static _assignOptions(...args) {
    return this._baseMerge(...args, this._mergeFunction);
  }

  static _defaultsOptions(target, opts) {
    return this._baseMerge(target, opts, (srcValue, objValue, key) => {
      return this._mergeFunction(objValue, srcValue, key);
    });
  }

  /**
   * Indexes created from options.indexes when calling Model.init
   */
  static _manualIndexes;

  /**
   * Indexes created from {@link ModelAttributeColumnOptions.unique}
   */
  static _attributeIndexes;

  static getIndexes() {
    return [
      ...(this._manualIndexes ?? []),
      ...(this._attributeIndexes ?? []),
      ...(this.uniqueKeys ? Object.values(this.uniqueKeys) : []),
    ];
  }

  static get _indexes() {
    throw new Error('Model._indexes has been replaced with Model.getIndexes()');
  }

  static _nameIndex(newIndex) {
    if (Object.prototype.hasOwnProperty.call(newIndex, 'name')) {
      return newIndex;
    }

    const newName = Utils.generateIndexName(this.getTableName(), newIndex);

    // TODO: check for collisions on *all* models, not just this one, as index names are global.
    for (const index of this.getIndexes()) {
      if (index.name === newName) {
        throw new Error(`Sequelize tried to give the name "${newName}" to index:
${NodeUtil.inspect(newIndex)}
on model "${this.name}", but that name is already taken by index:
${NodeUtil.inspect(index)}

Specify a different name for either index to resolve this issue.`);
      }
    }

    newIndex.name = newName;

    return newIndex;
  }

  /**
   * Initialize a model, representing a table in the DB, with attributes and options.
   *
   * The table columns are defined by the hash that is given as the first argument.
   * Each attribute of the hash represents a column.
   *
   * @example
   * ```javascript
   * Project.init({
   *   columnA: {
   *     type: Sequelize.BOOLEAN,
   *     validate: {
   *       is: ['[a-z]','i'],        // will only allow letters
   *       max: 23,                  // only allow values <= 23
   *       isIn: {
   *         args: [['en', 'zh']],
   *         msg: "Must be English or Chinese"
   *       }
   *     },
   *     field: 'column_a'
   *     // Other attributes here
   *   },
   *   columnB: Sequelize.STRING,
   *   columnC: 'MY VERY OWN COLUMN TYPE'
   * }, {sequelize})
   * ```
   *
   * sequelize.models.modelName // The model will now be available in models under the class name
   *
   * @see https://sequelize.org/docs/v7/core-concepts/model-basics/
   * @see https://sequelize.org/docs/v7/core-concepts/validations-and-constraints/
   *
   * @param {object} attributes An object, where each attribute is a column of the table. Each column can be either a
   *   DataType, a string or a type-description object.
   * @param {object} options These options are merged with the default define options provided to the Sequelize constructor
   * @returns {Model}
   */
  static init(attributes, options = {}) {
    if (!options.sequelize) {
      throw new Error('No Sequelize instance passed');
    }

    this.sequelize = options.sequelize;

    const globalOptions = this.sequelize.options;

    options = Utils.merge(_.cloneDeep(globalOptions.define), options);

    if (!options.modelName) {
      options.modelName = this.name;
    }

    options = Utils.merge({
      name: {
        plural: Utils.pluralize(options.modelName),
        singular: Utils.singularize(options.modelName),
      },
      indexes: [],
      omitNull: globalOptions.omitNull,
      schema: globalOptions.schema,
    }, options);

    this.sequelize.runHooks('beforeDefine', attributes, options);

    if (options.modelName !== this.name) {
      Object.defineProperty(this, 'name', { value: options.modelName });
    }

    delete options.modelName;

    this.options = {
      noPrimaryKey: false,
      timestamps: true,
      validate: {},
      freezeTableName: false,
      underscored: false,
      paranoid: false,
      rejectOnEmpty: false,
      whereCollection: null,
      schema: '',
      schemaDelimiter: '',
      defaultScope: {},
      scopes: {},
      indexes: [],
      ...options,
    };

    // if you call "define" multiple times for the same modelName, do not clutter the factory
    if (this.sequelize.isDefined(this.name)) {
      this.sequelize.modelManager.removeModel(this.sequelize.modelManager.getModel(this.name));
    }

    this.associations = Object.create(null);
    this._setupHooks(options.hooks);

    // TODO: use private field
    this.underscored = this.options.underscored;

    if (!this.options.tableName) {
      this.tableName = this.options.freezeTableName ? this.name : Utils.underscoredIf(Utils.pluralize(this.name), this.underscored);
    } else {
      this.tableName = this.options.tableName;
    }

    this._schema = this.options.schema || '';
    this._schemaDelimiter = this.options.schemaDelimiter || '';

    // error check options
    _.each(options.validate, (validator, validatorType) => {
      if (Object.prototype.hasOwnProperty.call(attributes, validatorType)) {
        throw new Error(`A model validator function must not have the same name as a field. Model: ${this.name}, field/validation name: ${validatorType}`);
      }

      if (typeof validator !== 'function') {
        throw new TypeError(`Members of the validate option must be functions. Model: ${this.name}, error with validate member ${validatorType}`);
      }
    });

    this.rawAttributes = _.mapValues(attributes, (attribute, name) => {
      attribute = this.sequelize.normalizeAttribute(attribute);

      // Checks whether the name is ambiguous with Utils.isColString
      // we check whether the attribute starts *or* ends because the following query:
      // { '$json.key$' }
      // could be interpreted as both
      // "json"."key" (accessible attribute 'key' on model 'json')
      // or
      // "$json" #>> {key$} (accessing key 'key$' on attribute '$json')
      if (name.startsWith('$') || name.endsWith('$')) {
        throw new Error(`Name of attribute "${name}" in model "${this.name}" cannot start or end with "$" as "$attribute$" is reserved syntax used to reference nested columns in queries.`);
      }

      if (name.includes('.')) {
        throw new Error(`Name of attribute "${name}" in model "${this.name}" cannot include the character "." as it would be ambiguous with the syntax used to reference nested columns, and nested json keys, in queries.`);
      }

      if (name.includes('::')) {
        throw new Error(`Name of attribute "${name}" in model "${this.name}" cannot include the character sequence "::" as it is reserved syntax used to cast attributes in queries.`);
      }

      if (name.includes('->')) {
        throw new Error(`Name of attribute "${name}" in model "${this.name}" cannot include the character sequence "->" as it is reserved syntax used in SQL generated by Sequelize to target nested associations.`);
      }

      if (attribute.type === undefined) {
        throw new Error(`Unrecognized datatype for attribute "${this.name}.${name}"`);
      }

      if (attribute.allowNull !== false && _.get(attribute, 'validate.notNull')) {
        throw new Error(`Invalid definition for "${this.name}.${name}", "notNull" validator is only allowed with "allowNull:false"`);
      }

      if (_.get(attribute, 'references.model.prototype') instanceof Model) {
        attribute.references.model = attribute.references.model.getTableName();
      }

      return attribute;
    });

    this._manualIndexes = this.options.indexes
      .map(index => this._nameIndex(this._conformIndex(index)));

    this.primaryKeys = Object.create(null);
    this._readOnlyAttributes = new Set();
    this._timestampAttributes = Object.create(null);

    // setup names of timestamp attributes
    if (this.options.timestamps) {
      for (const key of ['createdAt', 'updatedAt', 'deletedAt']) {
        if (!['undefined', 'string', 'boolean'].includes(typeof this.options[key])) {
          throw new Error(`Value for "${key}" option must be a string or a boolean, got ${typeof this.options[key]}`);
        }

        if (this.options[key] === '') {
          throw new Error(`Value for "${key}" option cannot be an empty string`);
        }
      }

      if (this.options.createdAt !== false) {
        this._timestampAttributes.createdAt
          = typeof this.options.createdAt === 'string' ? this.options.createdAt : 'createdAt';
        this._readOnlyAttributes.add(this._timestampAttributes.createdAt);
      }

      if (this.options.updatedAt !== false) {
        this._timestampAttributes.updatedAt
          = typeof this.options.updatedAt === 'string' ? this.options.updatedAt : 'updatedAt';
        this._readOnlyAttributes.add(this._timestampAttributes.updatedAt);
      }

      if (this.options.paranoid && this.options.deletedAt !== false) {
        this._timestampAttributes.deletedAt
          = typeof this.options.deletedAt === 'string' ? this.options.deletedAt : 'deletedAt';
        this._readOnlyAttributes.add(this._timestampAttributes.deletedAt);
      }
    }

    // setup name for version attribute
    if (this.options.version) {
      this._versionAttribute = typeof this.options.version === 'string' ? this.options.version : 'version';
      this._readOnlyAttributes.add(this._versionAttribute);
    }

    this._hasReadOnlyAttributes = this._readOnlyAttributes.size > 0;

    // Add head and tail default attributes (id, timestamps)
    this._addDefaultAttributes();
    this.refreshAttributes();
    this._findAutoIncrementAttribute();

    this._scope = this.options.defaultScope;
    this._scopeNames = ['defaultScope'];

    this.sequelize.modelManager.addModel(this);
    this.sequelize.runHooks('afterDefine', this);

    return this;
  }

  static refreshAttributes() {
    const attributeManipulation = {};

    this.prototype._customGetters = {};
    this.prototype._customSetters = {};

    for (const type of ['get', 'set']) {
      const opt = `${type}terMethods`;
      const funcs = { ...this.options[opt] };
      const _custom = type === 'get' ? this.prototype._customGetters : this.prototype._customSetters;

      _.each(funcs, (method, attribute) => {
        _custom[attribute] = method;

        if (type === 'get') {
          funcs[attribute] = function () {
            return this.get(attribute);
          };
        }

        if (type === 'set') {
          funcs[attribute] = function (value) {
            return this.set(attribute, value);
          };
        }
      });

      _.each(this.rawAttributes, (options, attribute) => {
        if (Object.prototype.hasOwnProperty.call(options, type)) {
          _custom[attribute] = options[type];
        }

        if (type === 'get') {
          funcs[attribute] = function () {
            return this.get(attribute);
          };
        }

        if (type === 'set') {
          funcs[attribute] = function (value) {
            return this.set(attribute, value);
          };
        }
      });

      _.each(funcs, (fct, name) => {
        if (!attributeManipulation[name]) {
          attributeManipulation[name] = {
            configurable: true,
          };
        }

        attributeManipulation[name][type] = fct;
      });
    }

    this._dataTypeChanges = {};
    this._dataTypeSanitizers = {};

    this._hasBooleanAttributes = false;
    this._hasDateAttributes = false;
    this._jsonAttributes = new Set();
    this._virtualAttributes = new Set();
    this._defaultValues = {};
    this.prototype.validators = {};

    this.fieldRawAttributesMap = Object.create(null);

    this.primaryKeys = Object.create(null);
    this.uniqueKeys = Object.create(null);

    this._attributeIndexes = [];

    _.each(this.rawAttributes, (definition, name) => {
      definition.type = this.sequelize.normalizeDataType(definition.type);

      definition.Model = this;
      definition.fieldName = name;
      definition._modelAttribute = true;

      if (definition.field === undefined) {
        definition.field = Utils.underscoredIf(name, this.underscored);
      }

      if (definition.primaryKey === true) {
        this.primaryKeys[name] = definition;
      }

      this.fieldRawAttributesMap[definition.field] = definition;

      if (definition.type._sanitize) {
        this._dataTypeSanitizers[name] = definition.type._sanitize;
      }

      if (definition.type._isChanged) {
        this._dataTypeChanges[name] = definition.type._isChanged;
      }

      if (definition.type instanceof DataTypes.BOOLEAN) {
        this._hasBooleanAttributes = true;
      } else if (definition.type instanceof DataTypes.DATE || definition.type instanceof DataTypes.DATEONLY) {
        this._hasDateAttributes = true;
      } else if (definition.type instanceof DataTypes.JSON) {
        this._jsonAttributes.add(name);
      } else if (definition.type instanceof DataTypes.VIRTUAL) {
        this._virtualAttributes.add(name);
      }

      if (Object.prototype.hasOwnProperty.call(definition, 'defaultValue')) {
        this._defaultValues[name] = () => Utils.toDefaultValue(definition.defaultValue, this.sequelize.dialect);
      }

      if (Object.prototype.hasOwnProperty.call(definition, 'unique') && definition.unique) {
        if (typeof definition.unique === 'string') {
          definition.unique = {
            name: definition.unique,
          };
        } else if (definition.unique === true) {
          definition.unique = {};
        }

        const index = definition.unique.name && this.uniqueKeys[definition.unique.name]
          ? this.uniqueKeys[definition.unique.name]
          : { fields: [] };

        index.fields.push(definition.field);
        index.msg = index.msg || definition.unique.msg || null;

        // TODO: remove this 'column'? It does not work with composite indexes, and is only used by db2 which should use fields instead.
        index.column = name;

        index.customIndex = definition.unique !== true;
        index.unique = true;

        if (definition.unique.name) {
          index.name = definition.unique.name;
        } else {
          this._nameIndex(index);
        }

        definition.unique.name ??= index.name;

        this.uniqueKeys[index.name] = index;
      }

      if (Object.prototype.hasOwnProperty.call(definition, 'validate')) {
        this.prototype.validators[name] = definition.validate;
      }

      if (definition.index === true && definition.type instanceof DataTypes.JSONB) {
        this._attributeIndexes.push(
          this._nameIndex(
            this._conformIndex({
              fields: [definition.field || name],
              using: 'gin',
            }),
          ),
        );

        delete definition.index;
      }
    });

    // Create a map of field to attribute names
    this.fieldAttributeMap = _.reduce(this.fieldRawAttributesMap, (map, value, key) => {
      if (key !== value.fieldName) {
        map[key] = value.fieldName;
      }

      return map;
    }, {});

    this._hasJsonAttributes = this._jsonAttributes.size > 0;

    this._hasVirtualAttributes = this._virtualAttributes.size > 0;

    this._hasDefaultValues = !_.isEmpty(this._defaultValues);

    this.tableAttributes = _.omitBy(this.rawAttributes, (_a, key) => this._virtualAttributes.has(key));

    this.prototype._hasCustomGetters = Object.keys(this.prototype._customGetters).length;
    this.prototype._hasCustomSetters = Object.keys(this.prototype._customSetters).length;

    for (const key of Object.keys(attributeManipulation)) {
      if (Object.prototype.hasOwnProperty.call(Model.prototype, key)) {
        this.sequelize.log(`Not overriding built-in method from model attribute: ${key}`);
        continue;
      }

      Object.defineProperty(this.prototype, key, attributeManipulation[key]);
    }

    this.prototype.rawAttributes = this.rawAttributes;
    this.prototype._isAttribute = key => Object.prototype.hasOwnProperty.call(this.prototype.rawAttributes, key);

    // Primary key convenience constiables
    this.primaryKeyAttributes = Object.keys(this.primaryKeys);
    this.primaryKeyAttribute = this.primaryKeyAttributes[0];
    if (this.primaryKeyAttribute) {
      this.primaryKeyField = this.rawAttributes[this.primaryKeyAttribute].field || this.primaryKeyAttribute;
    }

    this._hasPrimaryKeys = this.primaryKeyAttributes.length > 0;
    this._isPrimaryKey = key => this.primaryKeyAttributes.includes(key);

    this._attributeManipulation = attributeManipulation;
  }

  /**
   * Remove attribute from model definition.
   * Only use if you know what you're doing.
   *
   * @param {string} attribute name of attribute to remove
   */
  static removeAttribute(attribute) {
    delete this.rawAttributes[attribute];
    this.refreshAttributes();
  }

  /**
   * Merges new attributes with the existing ones.
   * Only use if you know what you're doing.
   *
   * Warning: Attributes are not replaced, they are merged.
   *
   * @param {object} newAttributes
   */
  static mergeAttributesDefault(newAttributes) {
    Utils.mergeDefaults(this.rawAttributes, newAttributes);

    this.refreshAttributes();

    return this.rawAttributes;
  }

  /**
   * Sync this Model to the DB, that is create the table.
   * See {@link Sequelize#sync} for options
   *
   * @param {object} [options] sync options
   *
   * @returns {Promise<Model>}
   */
  static async sync(options) {
    options = { ...this.options, ...options };
    options.hooks = options.hooks === undefined ? true : Boolean(options.hooks);

    const attributes = this.tableAttributes;
    const rawAttributes = this.fieldRawAttributesMap;

    if (options.hooks) {
      await this.runHooks('beforeSync', options);
    }

    const tableName = this.getTableName(options);

    let tableExists;
    if (options.force) {
      await this.drop(options);
      tableExists = false;
    } else {
      tableExists = await this.queryInterface.tableExists(tableName, options);
    }

    if (!tableExists) {
      await this.queryInterface.createTable(tableName, attributes, options, this);
    } else {
      // enums are always updated, even if alter is not set. createTable calls it too.
      await this.queryInterface.ensureEnums(tableName, attributes, options, this);
    }

    if (tableExists && options.alter) {
      const tableInfos = await Promise.all([
        this.queryInterface.describeTable(tableName, options),
        this.queryInterface.getForeignKeyReferencesForTable(tableName, options),
      ]);

      const columns = tableInfos[0];
      // Use for alter foreign keys
      const foreignKeyReferences = tableInfos[1];
      const removedConstraints = {};

      for (const columnName in attributes) {
        if (!Object.prototype.hasOwnProperty.call(attributes, columnName)) {
          continue;
        }

        if (!columns[columnName] && !columns[attributes[columnName].field]) {
          await this.queryInterface.addColumn(tableName, attributes[columnName].field || columnName, attributes[columnName], options);
        }
      }

      if (options.alter === true || typeof options.alter === 'object' && options.alter.drop !== false) {
        for (const columnName in columns) {
          if (!Object.prototype.hasOwnProperty.call(columns, columnName)) {
            continue;
          }

          const currentAttribute = rawAttributes[columnName];
          if (!currentAttribute) {
            await this.queryInterface.removeColumn(tableName, columnName, options);
            continue;
          }

          if (currentAttribute.primaryKey) {
            continue;
          }

          // Check foreign keys. If it's a foreign key, it should remove constraint first.
          const references = currentAttribute.references;
          if (currentAttribute.references) {
            let database = this.sequelize.config.database;
            const schema = tableName.schema;
            if (schema && this.sequelize.options.dialect === 'mariadb') {
              // because for mariadb schema is synonym for database
              database = schema;
            }

            const foreignReferenceSchema = currentAttribute.references.model.schema;
            const foreignReferenceTableName = typeof references.model === 'object'
              ? references.model.tableName : references.model;
            // Find existed foreign keys
            for (const foreignKeyReference of foreignKeyReferences) {
              const constraintName = foreignKeyReference.constraintName;
              if ((Boolean(constraintName)
                && foreignKeyReference.tableCatalog === database
                && (schema ? foreignKeyReference.tableSchema === schema : true)
                && foreignKeyReference.referencedTableName === foreignReferenceTableName
                && foreignKeyReference.referencedColumnName === references.key
                && (foreignReferenceSchema
                    ? foreignKeyReference.referencedTableSchema === foreignReferenceSchema
                    : true)
                && !removedConstraints[constraintName])
                || this.sequelize.options.dialect === 'ibmi') {
                // Remove constraint on foreign keys.
                await this.queryInterface.removeConstraint(tableName, constraintName, options);
                removedConstraints[constraintName] = true;
              }
            }
          }

          await this.queryInterface.changeColumn(tableName, columnName, currentAttribute, options);
        }
      }
    }

    const existingIndexes = await this.queryInterface.showIndex(tableName, options);
    const missingIndexes = this.getIndexes()
      .filter(item1 => !existingIndexes.some(item2 => item1.name === item2.name))
      .sort((index1, index2) => {
        if (this.sequelize.options.dialect === 'postgres') {
          // move concurrent indexes to the bottom to avoid weird deadlocks
          if (index1.concurrently === true) {
            return 1;
          }

          if (index2.concurrently === true) {
            return -1;
          }
        }

        return 0;
      });

    for (const index of missingIndexes) {
      await this.queryInterface.addIndex(tableName, index, options);
    }

    if (options.hooks) {
      await this.runHooks('afterSync', options);
    }

    return this;
  }

  /**
   * Drop the table represented by this Model
   *
   * @param {object} [options] drop options
   * @returns {Promise}
   */
  static async drop(options) {
    return await this.queryInterface.dropTable(this.getTableName(options), options);
  }

  /**
   * @param {object | string} schema
   * @deprecated use {@link Sequelize#dropSchema} or {@link QueryInterface#dropSchema}
   */
  // TODO [>=2023-01-01]: remove me in Sequelize >= 8
  static async dropSchema(schema) {
    noModelDropSchema();

    return await this.queryInterface.dropSchema(schema);
  }

  /**
   * Returns a copy of this model with the corresponding table located in the specified schema.
   *
   * For postgres, this will actually place the schema in front of the table name (`"schema"."tableName"`),
   * while the schema will be prepended to the table name for mysql and sqlite (`'schema.tablename'`).
   *
   * This method is intended for use cases where the same model is needed in multiple schemas.
   * In such a use case it is important to call {@link Model.sync} (or use migrations!) for each model created by this method
   * to ensure the models are created in the correct schema.
   *
   * If a single default schema per model is needed, set the {@link ModelOptions.schema} option instead.
   *
   * @param {string|object} schema The name of the schema
   *
   * @returns {Model}
   */
  static withSchema(schema) {
    if (arguments.length > 1) {
      throw new TypeError('Unlike Model.schema, Model.withSchema only accepts 1 argument which may be either a string or an option bag.');
    }

    const schemaOptions = typeof schema === 'string' ? { schema } : schema;

    return this.getInitialModel()
      ._withScopeAndSchema(schemaOptions, this._scope, this._scopeNames);
  }

  // TODO [>=2023-01-01]: remove in Sequelize 8
  static schema(schema, options) {
    schemaRenamedToWithSchema();

    return this.withSchema({
      schema,
      schemaDelimiter: typeof options === 'string' ? options : options?.schemaDelimiter,
    });
  }

  /**
   * Returns the initial model, the one returned by {@link Model.init} or {@link Sequelize#define},
   * before any scope or schema was applied.
   */
  static getInitialModel() {
    // '_initialModel' is set on model variants (withScope, withSchema, etc)
    return this._initialModel ?? this;
  }

  /**
   * Get the table name of the model, taking schema into account. The method will return The name as a string if the model
   * has no schema, or an object with `tableName`, `schema` and `delimiter` properties.
   *
   * @returns {string|object}
   */
  static getTableName() {
    return this.queryGenerator.addSchema(this);
  }

  /**
   * Add a new scope to the model
   *
   * This is especially useful for adding scopes with includes, when the model you want to
   * include is not available at the time this model is defined.
   *
   * By default, this will throw an error if a scope with that name already exists.
   * Use {@link AddScopeOptions.override} in the options object to silence this error.
   *
   * See {@link https://sequelize.org/docs/v7/other-topics/scopes/} to learn more about scopes.
   *
   * @param {string}          name The name of the scope. Use `defaultScope` to override the default scope
   * @param {object|Function} scope scope or options
   * @param {object}          [options] scope options
   */
  static addScope(name, scope, options) {
    if (this !== this.getInitialModel()) {
      throw new Error(`Model.addScope can only be called on the initial model. Use "${this.name}.getInitialModel()" to access the initial model.`);
    }

    options = { override: false, ...options };

    if ((name === 'defaultScope' && Object.keys(this.options.defaultScope).length > 0 || name in this.options.scopes) && options.override === false) {
      throw new Error(`The scope ${name} already exists. Pass { override: true } as options to silence this error`);
    }

    if (name === 'defaultScope') {
      this.options.defaultScope = this._scope = scope;
    } else {
      this.options.scopes[name] = scope;
    }
  }

  // TODO [>=2023-01-01]: remove in Sequelize 8
  static scope(...options) {
    scopeRenamedToWithScope();

    return this.withScope(...options);
  }

  /**
   * Creates a copy of this model, with one or more scopes applied.
   *
   * See {@link https://sequelize.org/docs/v7/other-topics/scopes/} to learn more about scopes.
   *
   * @param {?Array|object|string} [scopes] The scope(s) to apply. Scopes can either be passed as consecutive arguments, or
   *   as an array of arguments. To apply simple scopes and scope functions with no arguments, pass them as strings. For
   *   scope function, pass an object, with a `method` property. The value can either be a string, if the method does not
   *   take any arguments, or an array, where the first element is the name of the method, and consecutive elements are
   *   arguments to that method. Pass null to remove all scopes, including the default.
   *
   * @example <caption>To invoke scope functions you can do</caption>
   * Model.scope({ method: ['complexFunction', 'dan@sequelize.com', 42]}).findAll()
   * // WHERE email like 'dan@sequelize.com%' AND access_level >= 42
   *
   * @returns {Model} A reference to the model, with the scope(s) applied. Calling scope again on the returned model will
   *   clear the previous scope.
   */
  static withScope(...scopes) {
    scopes = scopes.flat().filter(Boolean);

    const initialModel = this.getInitialModel();

    const mergedScope = {};
    const scopeNames = [];

    for (const option of scopes) {
      let scope = null;
      let scopeName = null;

      if (_.isPlainObject(option)) {
        if (option.method) {
          if (Array.isArray(option.method) && Boolean(initialModel.options.scopes[option.method[0]])) {
            scopeName = option.method[0];
            scope = initialModel.options.scopes[scopeName].apply(initialModel, option.method.slice(1));
          } else if (initialModel.options.scopes[option.method]) {
            scopeName = option.method;
            scope = initialModel.options.scopes[scopeName].apply(initialModel);
          }
        } else {
          scope = option;
        }
      } else if (option === 'defaultScope' && _.isPlainObject(initialModel.options.defaultScope)) {
        scope = initialModel.options.defaultScope;
      } else {
        scopeName = option;
        scope = initialModel.options.scopes[scopeName];
        if (typeof scope === 'function') {
          scope = scope();
        }
      }

      if (!scope) {
        throw new sequelizeErrors.SequelizeScopeError(`"${this.name}.withScope()" has been called with an invalid scope: "${scopeName}" does not exist.`);
      }

      this._conformIncludes(scope, this);
      // clone scope so it doesn't get modified
      this._assignOptions(mergedScope, Utils.cloneDeep(scope));
      scopeNames.push(scopeName ? scopeName : 'defaultScope');
    }

    return initialModel._withScopeAndSchema({
      schema: this._schema || '',
      schemaDelimiter: this._schemaDelimiter || '',
    }, mergedScope, scopeNames);
  }

  // TODO [>=2023-01-01]: remove in Sequelize 8
  /**
   * Returns a model without scope. The default scope is also omitted.
   *
   * See {@link https://sequelize.org/docs/v7/other-topics/scopes/} to learn more about scopes.
   */
  static unscoped() {
    scopeRenamedToWithScope();

    return this.withoutScope();
  }

  /**
   * Returns a model without scope. The default scope is also omitted.
   *
   * See {@link https://sequelize.org/docs/v7/other-topics/scopes/} to learn more about scopes.
   */
  static withoutScope() {
    return this.withScope(null);
  }

  /**
   * Returns the base model, with its initial scope.
   */
  static withInitialScope() {
    const initialModel = this.getInitialModel();

    if (this._schema !== initialModel._schema || this._schemaDelimiter !== initialModel._schemaDelimiter) {
      return initialModel.withSchema({
        schema: this._schema,
        schemaDelimiter: this._schemaDelimiter,
      });
    }

    return initialModel;
  }

  static _withScopeAndSchema(schemaOptions, mergedScope, scopeNames) {
    if (!this._modelVariantRefs) {
      // technically this weakref is unnecessary because we're referencing ourselves but it simplifies the code
      // eslint-disable-next-line no-undef -- eslint doesn't know about WeakRef, this will be resolved once we migrate to TS.
      this._modelVariantRefs = new Set([new WeakRef(this)]);
    }

    for (const modelVariantRef of this._modelVariantRefs) {
      const modelVariant = modelVariantRef.deref();

      if (!modelVariant) {
        this._modelVariantRefs.delete(modelVariantRef);
        continue;
      }

      if (modelVariant._schema !== (schemaOptions.schema || '')) {
        continue;
      }

      if (modelVariant._schemaDelimiter !== (schemaOptions.schemaDelimiter || '')) {
        continue;
      }

      // the item order of these arrays is important! scope('a', 'b') is not equal to scope('b', 'a')
      if (!_.isEqual(modelVariant._scopeNames, scopeNames)) {
        continue;
      }

      if (!_.isEqual(modelVariant._scope, mergedScope)) {
        continue;
      }

      return modelVariant;
    }

    const clone = this._createModelVariant();
    // eslint-disable-next-line no-undef -- eslint doesn't know about WeakRef, this will be resolved once we migrate to TS.
    this._modelVariantRefs.add(new WeakRef(clone));

    clone._schema = schemaOptions.schema || '';
    clone._schemaDelimiter = schemaOptions.schemaDelimiter || '';
    clone._scope = mergedScope;
    clone._scopeNames = scopeNames;

    if (scopeNames.length !== 1 || scopeNames[0] !== 'defaultScope') {
      clone.scoped = true;
    }

    return clone;
  }

  static _createModelVariant() {
    const model = class extends this {};
    model._initialModel = this;
    Object.defineProperty(model, 'name', { value: this.name });

    return model;
  }

  /**
   * Search for multiple instances.
   * See {@link https://sequelize.org/docs/v7/core-concepts/model-querying-basics/} for more information about querying.
   *
   * __Example of a simple search:__
   * ```js
   * Model.findAll({
   *   where: {
   *     attr1: 42,
   *     attr2: 'cake'
   *   }
   * })
   * ```
   *
   * See also:
   * - {@link Model.findOne}
   * - {@link Sequelize#query}
   *
   * @param {object} options
   * @returns {Promise} A promise that will resolve with the array containing the results of the SELECT query.
   */
  static async findAll(options) {
    if (options !== undefined && !_.isPlainObject(options)) {
      throw new sequelizeErrors.QueryError('The argument passed to findAll must be an options object, use findByPk if you wish to pass a single primary key value');
    }

    if (options !== undefined && options.attributes && !Array.isArray(options.attributes) && !_.isPlainObject(options.attributes)) {
      throw new sequelizeErrors.QueryError('The attributes option must be an array of column names or an object');
    }

    this._warnOnInvalidOptions(options, Object.keys(this.rawAttributes));

    const tableNames = {};

    tableNames[this.getTableName(options)] = true;
    options = Utils.cloneDeep(options);

    // Add CLS transaction
    setTransactionFromCls(options, this.sequelize);

    _.defaults(options, { hooks: true, model: this });

    // set rejectOnEmpty option, defaults to model options
    options.rejectOnEmpty = Object.prototype.hasOwnProperty.call(options, 'rejectOnEmpty')
      ? options.rejectOnEmpty
      : this.options.rejectOnEmpty;

    this._conformIncludes(options, this);
    this._injectScope(options);

    if (options.hooks) {
      await this.runHooks('beforeFind', options);
      this._conformIncludes(options, this);
    }

    this._expandAttributes(options);
    this._expandIncludeAll(options, options.model);

    if (options.hooks) {
      await this.runHooks('beforeFindAfterExpandIncludeAll', options);
    }

    options.originalAttributes = this._injectDependentVirtualAttributes(options.attributes);

    if (options.include) {
      options.hasJoin = true;

      _validateIncludedElements(options, tableNames);

      // If we're not raw, we have to make sure we include the primary key for de-duplication
      if (
        options.attributes
        && !options.raw
        && this.primaryKeyAttribute
        && !options.attributes.includes(this.primaryKeyAttribute)
        && (!options.group || !options.hasSingleAssociation || options.hasMultiAssociation)
      ) {
        options.attributes = [this.primaryKeyAttribute].concat(options.attributes);
      }
    }

    if (!options.attributes) {
      options.attributes = Object.keys(this.rawAttributes);
      options.originalAttributes = this._injectDependentVirtualAttributes(options.attributes);
    }

    // whereCollection is used for non-primary key updates
    this.options.whereCollection = options.where || null;

    Utils.mapFinderOptions(options, this);

    options = this._paranoidClause(this, options);

    if (options.hooks) {
      await this.runHooks('beforeFindAfterOptions', options);
    }

    const selectOptions = { ...options, tableNames: Object.keys(tableNames) };
    const results = await this.queryInterface.select(this, this.getTableName(selectOptions), selectOptions);
    if (options.hooks) {
      await this.runHooks('afterFind', results, options);
    }

    // rejectOnEmpty mode
    if (_.isEmpty(results) && options.rejectOnEmpty) {
      if (typeof options.rejectOnEmpty === 'function') {
        throw new options.rejectOnEmpty();
      }

      if (typeof options.rejectOnEmpty === 'object') {
        throw options.rejectOnEmpty;
      }

      throw new sequelizeErrors.EmptyResultError();
    }

    return await Model._findSeparate(results, options);
  }

  static _warnOnInvalidOptions(options, validColumnNames) {
    if (!_.isPlainObject(options)) {
      return;
    }

    const unrecognizedOptions = Object.keys(options).filter(k => !validQueryKeywords.has(k));
    const unexpectedModelAttributes = _.intersection(unrecognizedOptions, validColumnNames);
    if (!options.where && unexpectedModelAttributes.length > 0) {
      logger.warn(`Model attributes (${unexpectedModelAttributes.join(', ')}) passed into finder method options of model ${this.name}, but the options.where object is empty. Did you forget to use options.where?`);
    }
  }

  static _injectDependentVirtualAttributes(attributes) {
    if (!this._hasVirtualAttributes) {
      return attributes;
    }

    if (!attributes || !Array.isArray(attributes)) {
      return attributes;
    }

    for (const attribute of attributes) {
      if (
        this._virtualAttributes.has(attribute)
        && this.rawAttributes[attribute].type.fields
      ) {
        attributes = attributes.concat(this.rawAttributes[attribute].type.fields);
      }
    }

    attributes = _.uniq(attributes);

    return attributes;
  }

  static async _findSeparate(results, options) {
    if (!options.include || options.raw || !results) {
      return results;
    }

    const original = results;
    if (options.plain) {
      results = [results];
    }

    if (!Array.isArray(results) || results.length === 0) {
      return original;
    }

    await Promise.all(options.include.map(async include => {
      if (!include.separate) {
        return await Model._findSeparate(
          results.reduce((memo, result) => {
            let associations = result.get(include.association.as);

            // Might be an empty belongsTo relation
            if (!associations) {
              return memo;
            }

            // Force array so we can concat no matter if it's 1:1 or :M
            if (!Array.isArray(associations)) {
              associations = [associations];
            }

            for (let i = 0, len = associations.length; i !== len; ++i) {
              memo.push(associations[i]);
            }

            return memo;
          }, []),
          {

            ..._.omit(options, 'include', 'attributes', 'order', 'where', 'limit', 'offset', 'plain', 'scope'),
            include: include.include || [],
          },
        );
      }

      const map = await include.association.get(results, {

        ..._.omit(options, nonCascadingOptions),
        ..._.omit(include, ['parent', 'association', 'as', 'originalAttributes']),
      });

      for (const result of results) {
        result.set(
          include.association.as,
          map.get(result.get(include.association.sourceKey)),
          { raw: true },
        );
      }
    }));

    return original;
  }

  /**
   * Search for a single instance by its primary key.
   *
   * This applies LIMIT 1, only a single instance will be returned.
   *
   * Returns the model with the matching primary key.
   * If not found, returns null or throws an error if {@link FindOptions.rejectOnEmpty} is set.
   *
   * @param  {number|bigint|string|Buffer}      param The value of the desired instance's primary key.
   * @param  {object}                           [options] find options
   * @returns {Promise<Model|null>}
   */
  static async findByPk(param, options) {
    // return Promise resolved with null if no arguments are passed
    if ([null, undefined].includes(param)) {
      return null;
    }

    options = Utils.cloneDeep(options) || {};

    if (typeof param === 'number' || typeof param === 'bigint' || typeof param === 'string' || Buffer.isBuffer(param)) {
      options.where = {
        [this.primaryKeyAttribute]: param,
      };
    } else {
      throw new TypeError(`Argument passed to findByPk is invalid: ${param}`);
    }

    // Bypass a possible overloaded findOne
    return await Model.findOne.call(this, options);
  }

  /**
   * Search for a single instance.
   *
   * Returns the first instance corresponding matching the query.
   * If not found, returns null or throws an error if {@link FindOptions.rejectOnEmpty} is set.
   *
   * @param  {object}       [options] A hash of options to describe the scope of the search
   * @returns {Promise<Model|null>}
   */
  static async findOne(options) {
    if (options !== undefined && !_.isPlainObject(options)) {
      throw new Error('The argument passed to findOne must be an options object, use findByPk if you wish to pass a single primary key value');
    }

    options = Utils.cloneDeep(options);
    // findOne only ever needs one result
    // conditional temporarily fixes 14618
    // https://github.com/sequelize/sequelize/issues/14618
    if (options.limit === undefined) {
      options.limit = 1;
    }

    // Bypass a possible overloaded findAll.
    return await Model.findAll.call(this, (_.defaults(options, {
      model: this,
      plain: true,
    })));
  }

  /**
   * Run an aggregation method on the specified field.
   *
   * Returns the aggregate result cast to {@link AggregateOptions.dataType},
   * unless `options.plain` is false, in which case the complete data result is returned.
   *
   * @param {string}          attribute The attribute to aggregate over. Can be a field name or *
   * @param {string}          aggregateFunction The function to use for aggregation, e.g. sum, max etc.
   * @param {object}          [options] Query options. See sequelize.query for full options
   *
   * @returns {Promise<DataTypes|object>}
   */
  static async aggregate(attribute, aggregateFunction, options) {
    options = Utils.cloneDeep(options);
    options.model = this;

    // We need to preserve attributes here as the `injectScope` call would inject non aggregate columns.
    const prevAttributes = options.attributes;
    this._injectScope(options);
    options.attributes = prevAttributes;
    this._conformIncludes(options, this);

    if (options.include) {
      this._expandIncludeAll(options);
      _validateIncludedElements(options);
    }

    const attrOptions = this.rawAttributes[attribute];
    const field = attrOptions && attrOptions.field || attribute;
    let aggregateColumn = this.sequelize.col(field);

    if (options.distinct) {
      aggregateColumn = this.sequelize.fn('DISTINCT', aggregateColumn);
    }

    let { group } = options;
    if (Array.isArray(group) && Array.isArray(group[0])) {
      noDoubleNestedGroup();
      group = group.flat();
    }

    options.attributes = _.unionBy(
      options.attributes,
      group,
      [[this.sequelize.fn(aggregateFunction, aggregateColumn), aggregateFunction]],
      a => (Array.isArray(a) ? a[1] : a),
    );

    if (!options.dataType) {
      if (attrOptions) {
        options.dataType = attrOptions.type;
      } else {
        // Use FLOAT as fallback
        options.dataType = new DataTypes.FLOAT();
      }
    } else {
      options.dataType = this.sequelize.normalizeDataType(options.dataType);
    }

    Utils.mapOptionFieldNames(options, this);
    options = this._paranoidClause(this, options);

    const value = await this.queryInterface.rawSelect(this.getTableName(options), options, aggregateFunction, this);

    return value;
  }

  /**
   * Count the number of records matching the provided where clause.
   *
   * If you provide an `include` option, the number of matching associations will be counted instead.
   *
   * @param {object}        [options] options
   * @returns {Promise<number>}
   */
  static async count(options) {
    options = Utils.cloneDeep(options);
    options = _.defaults(options, { hooks: true });

    // Add CLS transaction
    setTransactionFromCls(options, this.sequelize);

    options.raw = true;
    if (options.hooks) {
      await this.runHooks('beforeCount', options);
    }

    let col = options.col || '*';
    if (options.include) {
      col = `${this.name}.${options.col || this.primaryKeyField}`;
    }

    if (options.distinct && col === '*') {
      col = this.primaryKeyField;
    }

    options.plain = !options.group;
    options.dataType = new DataTypes.INTEGER();
    options.includeIgnoreAttributes = false;

    // No limit, offset or order for the options max be given to count()
    // Set them to null to prevent scopes setting those values
    options.limit = null;
    options.offset = null;
    options.order = null;

    const result = await this.aggregate(col, 'count', options);

    // When grouping is used, some dialects such as PG are returning the count as string
    // --> Manually convert it to number
    if (Array.isArray(result)) {
      return result.map(item => ({
        ...item,
        count: Number(item.count),
      }));
    }

    return result;
  }

  /**
   * Finds all the rows matching your query, within a specified offset / limit, and get the total number of
   * rows matching your query. This is very useful for pagination.
   *
   * ```js
   * Model.findAndCountAll({
   *   where: ...,
   *   limit: 12,
   *   offset: 12
   * }).then(result => {
   *   ...
   * })
   * ```
   * In the above example, `result.rows` will contain rows 13 through 24, while `result.count` will return
   * the total number of rows that matched your query.
   *
   * When you add includes, only those which are required (either because they have a where clause, or
   * because required` is explicitly set to true on the include) will be added to the count part.
   *
   * Suppose you want to find all users who have a profile attached:
   * ```js
   * User.findAndCountAll({
   *   include: [
   *      { model: Profile, required: true}
   *   ],
   *   limit: 3
   * });
   * ```
   * Because the include for `Profile` has `required` set it will result in an inner join, and only the users
   * who have a profile will be counted. If we remove `required` from the include, both users with and
   * without profiles will be counted
   *
   * This function also support grouping, when `group` is provided, the count will be an array of objects
   * containing the count for each group and the projected attributes.
   * ```js
   * User.findAndCountAll({
   *   group: 'type'
   * });
   * ```
   *
   * @param {object} [options] See findAll options
   * @returns {Promise<{count: number | number[], rows: Model[]}>}
   */
  static async findAndCountAll(options) {
    if (options !== undefined && !_.isPlainObject(options)) {
      throw new Error('The argument passed to findAndCountAll must be an options object, use findByPk if you wish to pass a single primary key value');
    }

    const countOptions = Utils.cloneDeep(options);

    if (countOptions.attributes) {
      countOptions.attributes = undefined;
    }

    const [count, rows] = await Promise.all([
      this.count(countOptions),
      this.findAll(options),
    ]);

    return {
      count,
      rows: count === 0 ? [] : rows,
    };
  }

  /**
   * Finds the maximum value of field
   *
   * @param {string} field attribute / field name
   * @param {object} [options] See aggregate
   * @returns {Promise<*>}
   */
  static async max(field, options) {
    return await this.aggregate(field, 'max', options);
  }

  /**
   * Finds the minimum value of field
   *
   * @param {string} field attribute / field name
   * @param {object} [options] See aggregate
   * @returns {Promise<*>}
   */
  static async min(field, options) {
    return await this.aggregate(field, 'min', options);
  }

  /**
   * Retrieves the sum of field
   *
   * @param {string} field attribute / field name
   * @param {object} [options] See aggregate
   * @returns {Promise<number>}
   */
  static async sum(field, options) {
    return await this.aggregate(field, 'sum', options);
  }

  /**
   * Builds a new model instance.
   * Unlike {@link Model.create}, the instance is not persisted, you need to call {@link Model#save} yourself.
   *
   * @param {object|Array} values An object of key value pairs or an array of such. If an array, the function will return an
   *   array of instances.
   * @param {object}  [options] Instance build options
   *
   * @returns {Model|Array<Model>}
   */
  static build(values, options) {
    if (Array.isArray(values)) {
      return this.bulkBuild(values, options);
    }

    return new this(values, options);
  }

  /**
   * Builds multiple new model instances.
   * Unlike {@link Model.create}, the instances are not persisted, you need to call {@link Model#save} yourself.
   *
   * @param {Array} valueSets An array of objects with key value pairs.
   * @param {object}  [options] Instance build options
   */
  static bulkBuild(valueSets, options) {
    options = { isNewRecord: true, ...options };

    if (!options.includeValidated) {
      this._conformIncludes(options, this);
      if (options.include) {
        this._expandIncludeAll(options);
        _validateIncludedElements(options);
      }
    }

    if (options.attributes) {
      options.attributes = options.attributes.map(attribute => (Array.isArray(attribute) ? attribute[1] : attribute));
    }

    return valueSets.map(values => this.build(values, options));
  }

  /**
   * Builds a new model instance and persists it.
   * Equivalent to calling {@link Model.build} then {@link Model.save}.
   *
   * @param {object} values
   * @param {object} options
   * @returns {Promise<Model>}
   *
   */
  static async create(values, options) {
    options = Utils.cloneDeep(options || {});

    return await this.build(values, {
      isNewRecord: true,
      attributes: options.fields,
      include: options.include,
      raw: options.raw,
      silent: options.silent,
    }).save(options);
  }

  /**
   * Find an entity that matches the query, or build (but don't save) the entity if none is found.
   * The successful result of the promise will be the tuple [instance, initialized].
   *
   * @param {object} options find options
   * @returns {Promise<Model,boolean>}
   */
  static async findOrBuild(options) {
    if (!options || !options.where || arguments.length > 1) {
      throw new Error(
        'Missing where attribute in the options parameter passed to findOrBuild. '
        + 'Please note that the API has changed, and is now options only (an object with where, defaults keys, transaction etc.)',
      );
    }

    let values;

    let instance = await this.findOne(options);
    if (instance === null) {
      values = { ...options.defaults };
      if (_.isPlainObject(options.where)) {
        values = Utils.defaults(values, options.where);
      }

      instance = this.build(values, options);

      return [instance, true];
    }

    return [instance, false];
  }

  /**
   * Find an entity that matches the query, or {@link Model.create} the entity if none is found
   * The successful result of the promise will be the tuple [instance, initialized].
   *
   * If no transaction is passed in the `options` object, a new transaction will be created internally, to
   * prevent the race condition where a matching row is created by another connection after the find but
   * before the insert call.
   * However, it is not always possible to handle this case in SQLite, specifically if one transaction inserts
   * and another tries to select before the first one has committed.
   * In this case, an instance of {@link TimeoutError} will be thrown instead.
   *
   * If a transaction is passed, a savepoint will be created instead,
   * and any unique constraint violation will be handled internally.
   *
   * @param {object} options find and create options
   * @returns {Promise<Model,boolean>}
   */
  static async findOrCreate(options) {
    if (!options || !options.where || arguments.length > 1) {
      throw new Error(
        'Missing where attribute in the options parameter passed to findOrCreate. '
        + 'Please note that the API has changed, and is now options only (an object with where, defaults keys, transaction etc.)',
      );
    }

    options = { ...options };

    if (options.defaults) {
      const defaults = Object.keys(options.defaults);
      const unknownDefaults = defaults.filter(name => !this.rawAttributes[name]);

      if (unknownDefaults.length > 0) {
        logger.warn(`Unknown attributes (${unknownDefaults}) passed to defaults option of findOrCreate`);
      }
    }

    if (options.transaction === undefined && this.sequelize.constructor._cls) {
      const t = this.sequelize.constructor._cls.get('transaction');
      if (t) {
        options.transaction = t;
      }
    }

    const internalTransaction = !options.transaction;
    let values;
    let transaction;

    try {
      const t = await this.sequelize.transaction(options);
      transaction = t;
      options.transaction = t;

      const found = await this.findOne(Utils.defaults({ transaction }, options));
      if (found !== null) {
        return [found, false];
      }

      values = { ...options.defaults };
      if (_.isPlainObject(options.where)) {
        values = Utils.defaults(values, options.where);
      }

      options.exception = true;
      options.returning = true;

      try {
        const created = await this.create(values, options);
        if (created.get(this.primaryKeyAttribute, { raw: true }) === null) {
          // If the query returned an empty result for the primary key, we know that this was actually a unique constraint violation
          throw new sequelizeErrors.UniqueConstraintError();
        }

        return [created, true];
      } catch (error) {
        if (!(error instanceof sequelizeErrors.UniqueConstraintError)) {
          throw error;
        }

        const flattenedWhere = Utils.flattenObjectDeep(options.where);
        const flattenedWhereKeys = Object.keys(flattenedWhere).map(name => _.last(name.split('.')));
        const whereFields = flattenedWhereKeys.map(name => _.get(this.rawAttributes, `${name}.field`, name));
        const defaultFields = options.defaults && Object.keys(options.defaults)
          .filter(name => this.rawAttributes[name])
          .map(name => this.rawAttributes[name].field || name);

        const errFieldKeys = Object.keys(error.fields);
        const errFieldsWhereIntersects = Utils.intersects(errFieldKeys, whereFields);
        if (defaultFields && !errFieldsWhereIntersects && Utils.intersects(errFieldKeys, defaultFields)) {
          throw error;
        }

        if (errFieldsWhereIntersects) {
          _.each(error.fields, (value, key) => {
            const name = this.fieldRawAttributesMap[key].fieldName;
            if (value.toString() !== options.where[name].toString()) {
              throw new Error(`${this.name}#findOrCreate: value used for ${name} was not equal for both the find and the create calls, '${options.where[name]}' vs '${value}'`);
            }
          });
        }

        // Someone must have created a matching instance inside the same transaction since we last did a find. Let's find it!
        const otherCreated = await this.findOne(Utils.defaults({
          transaction: internalTransaction ? null : transaction,
        }, options));

        // Sanity check, ideally we caught this at the defaultFeilds/err.fields check
        // But if we didn't and instance is null, we will throw
        if (otherCreated === null) {
          throw error;
        }

        return [otherCreated, false];
      }
    } finally {
      if (internalTransaction && transaction) {
        await transaction.commit();
      }
    }
  }

  /**
   * A more performant {@link Model.findOrCreate} that will not start its own transaction or savepoint (at least not in
   * postgres)
   *
   * It will execute a find call, attempt to create if empty, then attempt to find again if a unique constraint fails.
   *
   * The successful result of the promise will be the tuple [instance, initialized].
   *
   * @param {object} options find options
   * @returns {Promise<Model,boolean>}
   */
  static async findCreateFind(options) {
    if (!options || !options.where) {
      throw new Error(
        'Missing where attribute in the options parameter passed to findCreateFind.',
      );
    }

    let values = { ...options.defaults };
    if (_.isPlainObject(options.where)) {
      values = Utils.defaults(values, options.where);
    }

    const found = await this.findOne(options);
    if (found) {
      return [found, false];
    }

    try {
      const createOptions = { ...options };

      // To avoid breaking a postgres transaction, run the create with `ignoreDuplicates`.
      if (this.sequelize.options.dialect === 'postgres' && options.transaction) {
        createOptions.ignoreDuplicates = true;
      }

      const created = await this.create(values, createOptions);

      return [created, true];
    } catch (error) {
      if (!(error instanceof sequelizeErrors.UniqueConstraintError || error instanceof sequelizeErrors.EmptyResultError)) {
        throw error;
      }

      const foundAgain = await this.findOne(options);

      return [foundAgain, false];
    }
  }

  /**
   * Inserts or updates a single entity. An update will be executed if a row which matches the supplied values on
   * either the primary key or a unique key is found. Note that the unique index must be defined in your
   * sequelize model and not just in the table. Otherwise, you may experience a unique constraint violation,
   * because sequelize fails to identify the row that should be updated.
   *
   * **Implementation details:**
   *
   * * MySQL - Implemented as a single query `INSERT values ON DUPLICATE KEY UPDATE values`
   * * PostgreSQL - Implemented as a temporary function with exception handling: INSERT EXCEPTION WHEN
   *   unique_constraint UPDATE
   * * SQLite - Implemented as two queries `INSERT; UPDATE`. This means that the update is executed regardless
   *   of whether the row already existed or not
   *
   * **Note:** SQLite returns null for created, no matter if the row was created or updated. This is
   * because SQLite always runs INSERT OR IGNORE + UPDATE, in a single query, so there is no way to know
   * whether the row was inserted or not.
   *
   * @param  {object} values hash of values to upsert
   * @param  {object} [options] upsert options
   * @returns {Promise<Array<Model, boolean | null>>} an array with two elements, the first being the new record and
   *   the second being `true` if it was just created or `false` if it already existed (except on Postgres and SQLite, which
   *   can't detect this and will always return `null` instead of a boolean).
   */
  static async upsert(values, options) {
    options = {
      hooks: true,
      returning: true,
      validate: true,
      ...Utils.cloneDeep(options),
    };

    // Add CLS transaction
    setTransactionFromCls(options, this.sequelize);

    const createdAtAttr = this._timestampAttributes.createdAt;
    const updatedAtAttr = this._timestampAttributes.updatedAt;
    const hasPrimary = this.primaryKeyField in values || this.primaryKeyAttribute in values;
    const instance = this.build(values);

    options.model = this;
    options.instance = instance;

    const changed = [...instance._changed];
    if (!options.fields) {
      options.fields = changed;
    }

    if (options.validate) {
      await instance.validate(options);
    }

    // Map field names
    const updatedDataValues = _.pick(instance.dataValues, changed);
    const insertValues = Utils.mapValueFieldNames(instance.dataValues, Object.keys(instance.rawAttributes), this);
    const updateValues = Utils.mapValueFieldNames(updatedDataValues, options.fields, this);
    const now = Utils.now(this.sequelize.dialect);

    // Attach createdAt
    if (createdAtAttr && !insertValues[createdAtAttr]) {
      const field = this.rawAttributes[createdAtAttr].field || createdAtAttr;
      insertValues[field] = this._getDefaultTimestamp(createdAtAttr) || now;
    }

    if (updatedAtAttr && !updateValues[updatedAtAttr]) {
      const field = this.rawAttributes[updatedAtAttr].field || updatedAtAttr;
      insertValues[field] = updateValues[field] = this._getDefaultTimestamp(updatedAtAttr) || now;
    }

    // Db2 does not allow NULL values for unique columns.
    // Add dummy values if not provided by test case or user.
    if (this.sequelize.options.dialect === 'db2') {
      this.uniqno = this.sequelize.dialect.queryGenerator.addUniqueFields(
        insertValues, this.rawAttributes, this.uniqno,
      );
    }

    // Build adds a null value for the primary key, if none was given by the user.
    // We need to remove that because of some Postgres technicalities.
    if (!hasPrimary && this.primaryKeyAttribute && !this.rawAttributes[this.primaryKeyAttribute].defaultValue) {
      delete insertValues[this.primaryKeyField];
      delete updateValues[this.primaryKeyField];
    }

    if (options.hooks) {
      await this.runHooks('beforeUpsert', values, options);
    }

    const result = await this.queryInterface.upsert(this.getTableName(options), insertValues, updateValues, instance.where(), options);

    const [record] = result;
    record.isNewRecord = false;

    if (options.hooks) {
      await this.runHooks('afterUpsert', result, options);

      return result;
    }

    return result;
  }

  /**
   * Creates and inserts multiple instances in bulk.
   *
   * The promise resolves with an array of instances.
   *
   * Please note that, depending on your dialect, the resulting instances may not accurately
   * represent the state of their rows in the database.
   * This is because MySQL and SQLite do not make it easy to obtain back automatically generated IDs
   * and other default values in a way that can be mapped to multiple records.
   * To obtain the correct data for the newly created instance, you will need to query for them again.
   *
   * If validation fails, the promise is rejected with {@link AggregateError}
   *
   * @param  {Array}          records                          List of objects (key/value pairs) to create instances from
   * @param  {object}         [options]                        Bulk create options
   * @returns {Promise<Array<Model>>}
   */
  static async bulkCreate(records, options = {}) {
    if (records.length === 0) {
      return [];
    }

    const dialect = this.sequelize.options.dialect;
    const now = Utils.now(this.sequelize.dialect);
    options = Utils.cloneDeep(options);

    // Add CLS transaction
    setTransactionFromCls(options, this.sequelize);

    options.model = this;

    if (!options.includeValidated) {
      this._conformIncludes(options, this);
      if (options.include) {
        this._expandIncludeAll(options);
        _validateIncludedElements(options);
      }
    }

    const instances = records.map(values => this.build(values, { isNewRecord: true, include: options.include }));

    const recursiveBulkCreate = async (instances, options) => {
      options = {
        validate: false,
        hooks: true,
        individualHooks: false,
        ignoreDuplicates: false,
        ...options,
      };

      if (options.returning === undefined) {
        if (options.association) {
          options.returning = false;
        } else {
          options.returning = true;
        }
      }

      if (options.ignoreDuplicates && ['mssql', 'db2', 'ibmi'].includes(dialect)) {
        throw new Error(`${dialect} does not support the ignoreDuplicates option.`);
      }

      if (options.updateOnDuplicate && !['mysql', 'mariadb', 'sqlite', 'postgres', 'ibmi'].includes(dialect)) {
        throw new Error(`${dialect} does not support the updateOnDuplicate option.`);
      }

      const model = options.model;

      options.fields = options.fields || Object.keys(model.rawAttributes);
      const createdAtAttr = model._timestampAttributes.createdAt;
      const updatedAtAttr = model._timestampAttributes.updatedAt;

      if (options.updateOnDuplicate !== undefined) {
        if (Array.isArray(options.updateOnDuplicate) && options.updateOnDuplicate.length > 0) {
          options.updateOnDuplicate = _.intersection(
            _.without(Object.keys(model.tableAttributes), createdAtAttr),
            options.updateOnDuplicate,
          );
        } else {
          throw new Error('updateOnDuplicate option only supports non-empty array.');
        }
      }

      // Run before hook
      if (options.hooks) {
        await model.runHooks('beforeBulkCreate', instances, options);
      }

      // Validate
      if (options.validate) {
        const errors = [];
        const validateOptions = { ...options };
        validateOptions.hooks = options.individualHooks;

        await Promise.all(instances.map(async instance => {
          try {
            await instance.validate(validateOptions);
          } catch (error) {
            errors.push(new sequelizeErrors.BulkRecordError(error, instance));
          }
        }));

        delete options.skip;
        if (errors.length > 0) {
          throw new sequelizeErrors.AggregateError(errors);
        }
      }

      if (options.individualHooks) {
        await Promise.all(instances.map(async instance => {
          const individualOptions = {
            ...options,
            validate: false,
            hooks: true,
          };
          delete individualOptions.fields;
          delete individualOptions.individualHooks;
          delete individualOptions.ignoreDuplicates;

          await instance.save(individualOptions);
        }));
      } else {
        if (options.include && options.include.length > 0) {
          await Promise.all(options.include.filter(include => include.association instanceof BelongsTo).map(async include => {
            const associationInstances = [];
            const associationInstanceIndexToInstanceMap = [];

            for (const instance of instances) {
              const associationInstance = instance.get(include.as);
              if (associationInstance) {
                associationInstances.push(associationInstance);
                associationInstanceIndexToInstanceMap.push(instance);
              }
            }

            if (associationInstances.length === 0) {
              return;
            }

            const includeOptions = _(Utils.cloneDeep(include))
              .omit(['association'])
              .defaults({
                transaction: options.transaction,
                logging: options.logging,
              })
              .value();

            const createdAssociationInstances = await recursiveBulkCreate(associationInstances, includeOptions);
            for (const idx in createdAssociationInstances) {
              const associationInstance = createdAssociationInstances[idx];
              const instance = associationInstanceIndexToInstanceMap[idx];

              await include.association.set(instance, associationInstance, { save: false, logging: options.logging });
            }
          }));
        }

        // Create all in one query
        // Recreate records from instances to represent any changes made in hooks or validation
        records = instances.map(instance => {
          const values = instance.dataValues;

          // set createdAt/updatedAt attributes
          if (createdAtAttr && !values[createdAtAttr]) {
            values[createdAtAttr] = now;
            if (!options.fields.includes(createdAtAttr)) {
              options.fields.push(createdAtAttr);
            }
          }

          if (updatedAtAttr && !values[updatedAtAttr]) {
            values[updatedAtAttr] = now;
            if (!options.fields.includes(updatedAtAttr)) {
              options.fields.push(updatedAtAttr);
            }
          }

          const out = Utils.mapValueFieldNames(values, options.fields, model);
          for (const key of model._virtualAttributes) {
            delete out[key];
          }

          return out;
        });

        // Map attributes to fields for serial identification
        const fieldMappedAttributes = {};
        for (const attr in model.tableAttributes) {
          fieldMappedAttributes[model.rawAttributes[attr].field || attr] = model.rawAttributes[attr];
        }

        // Map updateOnDuplicate attributes to fields
        if (options.updateOnDuplicate) {
          options.updateOnDuplicate = options.updateOnDuplicate.map(attr => model.rawAttributes[attr].field || attr);

          const upsertKeys = [];

          for (const i of model.getIndexes()) {
            if (i.unique && !i.where) { // Don't infer partial indexes
              upsertKeys.push(...i.fields);
            }
          }

          options.upsertKeys = upsertKeys.length > 0
            ? upsertKeys
            : Object.values(model.primaryKeys).map(x => x.field);
        }

        // Map returning attributes to fields
        if (options.returning && Array.isArray(options.returning)) {
          options.returning = options.returning.map(attr => _.get(model.rawAttributes[attr], 'field', attr));
        }

        const results = await model.queryInterface.bulkInsert(model.getTableName(options), records, options, fieldMappedAttributes);
        if (Array.isArray(results)) {
          for (const [i, result] of results.entries()) {
            const instance = instances[i];

            for (const key in result) {
              if (!instance || key === model.primaryKeyAttribute
                && instance.get(model.primaryKeyAttribute)
                && ['mysql', 'mariadb', 'sqlite'].includes(dialect)) {
                // The query.js for these DBs is blind, it autoincrements the
                // primarykey value, even if it was set manually. Also, it can
                // return more results than instances, bug?.
                continue;
              }

              if (Object.prototype.hasOwnProperty.call(result, key)) {
                const record = result[key];

                const attr = _.find(model.rawAttributes, attribute => attribute.fieldName === key || attribute.field === key);

                instance.dataValues[attr && attr.fieldName || key] = record;
              }
            }
          }
        }
      }

      if (options.include && options.include.length > 0) {
        await Promise.all(options.include.filter(include => !(include.association instanceof BelongsTo
          || include.parent && include.parent.association instanceof BelongsToMany)).map(async include => {
          const associationInstances = [];
          const associationInstanceIndexToInstanceMap = [];

          for (const instance of instances) {
            let associated = instance.get(include.as);
            if (!Array.isArray(associated)) {
              associated = [associated];
            }

            for (const associationInstance of associated) {
              if (associationInstance) {
                if (!(include.association instanceof BelongsToMany)) {
                  associationInstance.set(include.association.foreignKey, instance.get(include.association.sourceKey || instance.constructor.primaryKeyAttribute, { raw: true }), { raw: true });
                  Object.assign(associationInstance, include.association.scope);
                }

                associationInstances.push(associationInstance);
                associationInstanceIndexToInstanceMap.push(instance);
              }
            }
          }

          if (associationInstances.length === 0) {
            return;
          }

          const includeOptions = _(Utils.cloneDeep(include))
            .omit(['association'])
            .defaults({
              transaction: options.transaction,
              logging: options.logging,
            })
            .value();

          const createdAssociationInstances = await recursiveBulkCreate(associationInstances, includeOptions);
          if (include.association instanceof BelongsToMany) {
            const valueSets = [];

            for (const idx in createdAssociationInstances) {
              const associationInstance = createdAssociationInstances[idx];
              const instance = associationInstanceIndexToInstanceMap[idx];

              const values = {
                [include.association.foreignKey]: instance.get(instance.constructor.primaryKeyAttribute, { raw: true }),
                [include.association.otherKey]: associationInstance.get(associationInstance.constructor.primaryKeyAttribute, { raw: true }),
                // Include values defined in the association
                ...include.association.through.scope,
              };
              if (associationInstance[include.association.through.model.name]) {
                for (const attr of Object.keys(include.association.through.model.rawAttributes)) {
                  if (include.association.through.model.rawAttributes[attr]._autoGenerated
                    || attr === include.association.foreignKey
                    || attr === include.association.otherKey
                    || typeof associationInstance[include.association.through.model.name][attr] === 'undefined') {
                    continue;
                  }

                  values[attr] = associationInstance[include.association.through.model.name][attr];
                }
              }

              valueSets.push(values);
            }

            const throughOptions = _(Utils.cloneDeep(include))
              .omit(['association', 'attributes'])
              .defaults({
                transaction: options.transaction,
                logging: options.logging,
              })
              .value();
            throughOptions.model = include.association.throughModel;
            const throughInstances = include.association.throughModel.bulkBuild(valueSets, throughOptions);

            await recursiveBulkCreate(throughInstances, throughOptions);
          }
        }));
      }

      // map fields back to attributes
      for (const instance of instances) {
        for (const attr in model.rawAttributes) {
          if (model.rawAttributes[attr].field
              && instance.dataValues[model.rawAttributes[attr].field] !== undefined
              && model.rawAttributes[attr].field !== attr
          ) {
            instance.dataValues[attr] = instance.dataValues[model.rawAttributes[attr].field];
            delete instance.dataValues[model.rawAttributes[attr].field];
          }

          instance._previousDataValues[attr] = instance.dataValues[attr];
          instance.changed(attr, false);
        }

        instance.isNewRecord = false;
      }

      // Run after hook
      if (options.hooks) {
        await model.runHooks('afterBulkCreate', instances, options);
      }

      return instances;
    };

    return await recursiveBulkCreate(instances, options);
  }

  /**
   * Destroys all instances of the model.
   * This is a convenient method for `MyModel.destroy({ truncate: true })`.
   *
   * __Danger__: This will completely empty your table!
   *
   * @param {object} [options] truncate options
   * @returns {Promise}
   */
  static async truncate(options) {
    options = Utils.cloneDeep(options) || {};
    options.truncate = true;

    return await this.destroy(options);
  }

  /**
   * Deletes multiple instances, or set their deletedAt timestamp to the current time if `paranoid` is enabled.
   *
   * @param  {object} options destroy options
   * @returns {Promise<number>} The number of destroyed rows
   */
  static async destroy(options) {
    options = Utils.cloneDeep(options);

    // Add CLS transaction
    setTransactionFromCls(options, this.sequelize);

    this._injectScope(options);

    if (!options || !(options.where || options.truncate)) {
      throw new Error('Missing where or truncate attribute in the options parameter of model.destroy.');
    }

    if (!options.truncate && !_.isPlainObject(options.where) && !Array.isArray(options.where) && !(options.where instanceof Utils.SequelizeMethod)) {
      throw new Error('Expected plain object, array or sequelize method in the options.where parameter of model.destroy.');
    }

    options = _.defaults(options, {
      hooks: true,
      individualHooks: false,
      force: false,
      cascade: false,
      restartIdentity: false,
    });

    options.type = QueryTypes.BULKDELETE;

    Utils.mapOptionFieldNames(options, this);
    options.model = this;

    // Run before hook
    if (options.hooks) {
      await this.runHooks('beforeBulkDestroy', options);
    }

    let instances;
    // Get daos and run beforeDestroy hook on each record individually
    if (options.individualHooks) {
      instances = await this.findAll({ where: options.where, transaction: options.transaction, logging: options.logging, benchmark: options.benchmark });

      await Promise.all(instances.map(instance => this.runHooks('beforeDestroy', instance, options)));
    }

    let result;
    // Run delete query (or update if paranoid)
    if (this._timestampAttributes.deletedAt && !options.force) {
      // Set query type appropriately when running soft delete
      options.type = QueryTypes.BULKUPDATE;

      const attrValueHash = {};
      const deletedAtAttribute = this.rawAttributes[this._timestampAttributes.deletedAt];
      const field = this.rawAttributes[this._timestampAttributes.deletedAt].field;
      const where = {
        [field]: Object.prototype.hasOwnProperty.call(deletedAtAttribute, 'defaultValue') ? deletedAtAttribute.defaultValue : null,
      };

      attrValueHash[field] = Utils.now(this.sequelize.dialect);
      result = await this.queryInterface.bulkUpdate(this.getTableName(options), attrValueHash, Object.assign(where, options.where), options, this.rawAttributes);
    } else {
      result = await this.queryInterface.bulkDelete(this.getTableName(options), options.where, options, this);
    }

    // Run afterDestroy hook on each record individually
    if (options.individualHooks) {
      await Promise.all(
        instances.map(instance => this.runHooks('afterDestroy', instance, options)),
      );
    }

    // Run after hook
    if (options.hooks) {
      await this.runHooks('afterBulkDestroy', options);
    }

    return result;
  }

  /**
   * Restores multiple paranoid instances.
   * Only usable if {@link ModelOptions.paranoid} is true.
   *
   * @param {object} options restore options
   * @returns {Promise}
   */
  static async restore(options) {
    if (!this._timestampAttributes.deletedAt) {
      throw new Error('Model is not paranoid');
    }

    options = {
      hooks: true,
      individualHooks: false,
      ...options,
    };

    // Add CLS transaction
    setTransactionFromCls(options, this.sequelize);

    options.type = QueryTypes.RAW;
    options.model = this;

    Utils.mapOptionFieldNames(options, this);

    // Run before hook
    if (options.hooks) {
      await this.runHooks('beforeBulkRestore', options);
    }

    let instances;
    // Get daos and run beforeRestore hook on each record individually
    if (options.individualHooks) {
      instances = await this.findAll({ where: options.where, transaction: options.transaction, logging: options.logging, benchmark: options.benchmark, paranoid: false });

      await Promise.all(instances.map(instance => this.runHooks('beforeRestore', instance, options)));
    }

    // Run undelete query
    const attrValueHash = {};
    const deletedAtCol = this._timestampAttributes.deletedAt;
    const deletedAtAttribute = this.rawAttributes[deletedAtCol];
    const deletedAtDefaultValue = Object.prototype.hasOwnProperty.call(deletedAtAttribute, 'defaultValue') ? deletedAtAttribute.defaultValue : null;

    attrValueHash[deletedAtAttribute.field || deletedAtCol] = deletedAtDefaultValue;
    options.omitNull = false;
    const result = await this.queryInterface.bulkUpdate(this.getTableName(options), attrValueHash, options.where, options, this.rawAttributes);
    // Run afterDestroy hook on each record individually
    if (options.individualHooks) {
      await Promise.all(
        instances.map(instance => this.runHooks('afterRestore', instance, options)),
      );
    }

    // Run after hook
    if (options.hooks) {
      await this.runHooks('afterBulkRestore', options);
    }

    return result;
  }

  /**
   * Updates multiple instances that match the where options.
   *
   * The promise resolves with an array of one or two elements:
   * - The first element is always the number of affected rows,
   * - the second element is the list of affected entities (only supported in postgres and mssql with
   * {@link UpdateOptions.returning} true.)
   *
   * @param  {object} values hash of values to update
   * @param  {object} options update options
   * @returns {Promise<Array<number,number>>}
   */
  static async update(values, options) {
    options = Utils.cloneDeep(options);

    // Add CLS transaction
    setTransactionFromCls(options, this.sequelize);

    this._injectScope(options);
    this._optionsMustContainWhere(options);

    options = this._paranoidClause(this, _.defaults(options, {
      validate: true,
      hooks: true,
      individualHooks: false,
      returning: false,
      force: false,
      sideEffects: true,
    }));

    options.type = QueryTypes.BULKUPDATE;

    // Clone values so it doesn't get modified for caller scope and ignore undefined values
    values = _.omitBy(values, value => value === undefined);

    // Remove values that are not in the options.fields
    if (options.fields && Array.isArray(options.fields)) {
      for (const key of Object.keys(values)) {
        if (!options.fields.includes(key)) {
          delete values[key];
        }
      }
    } else {
      const updatedAtAttr = this._timestampAttributes.updatedAt;
      options.fields = _.intersection(Object.keys(values), Object.keys(this.tableAttributes));
      if (updatedAtAttr && !options.fields.includes(updatedAtAttr)) {
        options.fields.push(updatedAtAttr);
      }
    }

    if (this._timestampAttributes.updatedAt && !options.silent) {
      values[this._timestampAttributes.updatedAt] = this._getDefaultTimestamp(this._timestampAttributes.updatedAt) || Utils.now(this.sequelize.dialect);
    }

    options.model = this;

    let valuesUse;
    // Validate
    if (options.validate) {
      const build = this.build(values);
      build.set(this._timestampAttributes.updatedAt, values[this._timestampAttributes.updatedAt], { raw: true });

      if (options.sideEffects) {
        Object.assign(values, _.pick(build.get(), build.changed()));
        options.fields = _.union(options.fields, Object.keys(values));
      }

      // We want to skip validations for all other fields
      options.skip = _.difference(Object.keys(this.rawAttributes), Object.keys(values));
      const attributes = await build.validate(options);
      options.skip = undefined;
      if (attributes && attributes.dataValues) {
        values = _.pick(attributes.dataValues, Object.keys(values));
      }
    }

    // Run before hook
    if (options.hooks) {
      options.attributes = values;
      await this.runHooks('beforeBulkUpdate', options);
      values = options.attributes;
      delete options.attributes;
    }

    valuesUse = values;

    // Get instances and run beforeUpdate hook on each record individually
    let instances;
    let updateDoneRowByRow = false;
    if (options.individualHooks) {
      instances = await this.findAll({
        where: options.where,
        transaction: options.transaction,
        logging: options.logging,
        benchmark: options.benchmark,
        paranoid: options.paranoid,
      });

      if (instances.length > 0) {
        // Run beforeUpdate hooks on each record and check whether beforeUpdate hook changes values uniformly
        // i.e. whether they change values for each record in the same way
        let changedValues;
        let different = false;

        instances = await Promise.all(instances.map(async instance => {
          // Record updates in instances dataValues
          Object.assign(instance.dataValues, values);
          // Set the changed fields on the instance
          _.forIn(valuesUse, (newValue, attr) => {
            if (newValue !== instance._previousDataValues[attr]) {
              instance.setDataValue(attr, newValue);
            }
          });

          // Run beforeUpdate hook
          await this.runHooks('beforeUpdate', instance, options);
          if (!different) {
            const thisChangedValues = {};
            _.forIn(instance.dataValues, (newValue, attr) => {
              if (newValue !== instance._previousDataValues[attr]) {
                thisChangedValues[attr] = newValue;
              }
            });

            if (!changedValues) {
              changedValues = thisChangedValues;
            } else {
              different = !_.isEqual(changedValues, thisChangedValues);
            }
          }

          return instance;
        }));

        if (!different) {
          const keys = Object.keys(changedValues);
          // Hooks do not change values or change them uniformly
          if (keys.length > 0) {
            // Hooks change values - record changes in valuesUse so they are executed
            valuesUse = changedValues;
            options.fields = _.union(options.fields, keys);
          }
        } else {
          instances = await Promise.all(instances.map(async instance => {
            const individualOptions = {
              ...options,
              hooks: false,
              validate: false,
            };
            delete individualOptions.individualHooks;

            return instance.save(individualOptions);
          }));
          updateDoneRowByRow = true;
        }
      }
    }

    let result;
    if (updateDoneRowByRow) {
      result = [instances.length, instances];
    } else if (_.isEmpty(valuesUse)
       || Object.keys(valuesUse).length === 1 && valuesUse[this._timestampAttributes.updatedAt]) {
      // only updatedAt is being passed, then skip update
      result = [0];
    } else {
      valuesUse = Utils.mapValueFieldNames(valuesUse, options.fields, this);
      options = Utils.mapOptionFieldNames(options, this);
      options.hasTrigger = this.options ? this.options.hasTrigger : false;

      const affectedRows = await this.queryInterface.bulkUpdate(this.getTableName(options), valuesUse, options.where, options, this.tableAttributes);
      if (options.returning) {
        result = [affectedRows.length, affectedRows];
        instances = affectedRows;
      } else {
        result = [affectedRows];
      }
    }

    if (options.individualHooks) {
      await Promise.all(instances.map(instance => this.runHooks('afterUpdate', instance, options)));
      result[1] = instances;
    }

    // Run after hook
    if (options.hooks) {
      options.attributes = values;
      await this.runHooks('afterBulkUpdate', options);
      delete options.attributes;
    }

    return result;
  }

  /**
   * Runs a describe query on the table.
   *
   * @param {string} [schema] schema name to search table in
   * @param {object} [options] query options
   *
   * @returns {Promise} hash of attributes and their types
   */
  static async describe(schema, options) {
    return await this.queryInterface.describeTable(this.tableName, { schema: schema || this._schema || '', ...options });
  }

  static _getDefaultTimestamp(attr) {
    if (Boolean(this.rawAttributes[attr]) && Boolean(this.rawAttributes[attr].defaultValue)) {
      return Utils.toDefaultValue(this.rawAttributes[attr].defaultValue, this.sequelize.dialect);
    }

  }

  static _expandAttributes(options) {
    if (!_.isPlainObject(options.attributes)) {
      return;
    }

    let attributes = Object.keys(this.rawAttributes);

    if (options.attributes.exclude) {
      attributes = attributes.filter(elem => !options.attributes.exclude.includes(elem));
    }

    if (options.attributes.include) {
      attributes = attributes.concat(options.attributes.include);
    }

    options.attributes = attributes;
  }

  // Inject _scope into options.
  static _injectScope(options) {
    const scope = Utils.cloneDeep(this._scope);
    this._normalizeIncludes(scope, this);
    this._defaultsOptions(options, scope);
  }

  static [Symbol.for('nodejs.util.inspect.custom')]() {
    return this.name;
  }

  static hasAlias(alias) {
    return Object.prototype.hasOwnProperty.call(this.associations, alias);
  }

  static getAssociations(target) {
    return Object.values(this.associations).filter(association => association.target.name === target.name);
  }

  static getAssociationWithModel(targetModel, targetAlias) {
    if (targetAlias) {
      return this.getAssociation(targetAlias);
    }

    if (!targetModel) {
      throwInvalidInclude({ model: targetModel, as: targetAlias });
    }

    const matchingAssociations = this._getAssociationsByModel(targetModel);
    if (matchingAssociations.length === 0) {
      throw new sequelizeErrors.EagerLoadingError(`Invalid Include received: no associations exist between "${this.name}" and "${targetModel.name}"`);
    }

    if (matchingAssociations.length > 1) {
      throw new sequelizeErrors.EagerLoadingError(`
Ambiguous Include received:
You're trying to include the model "${targetModel.name}", but is associated to "${this.name}" multiple times.

Instead of specifying a Model, either:
1. pass one of the Association object (available in "${this.name}.associations") in the "association" option, e.g.:
   include: {
     association: ${this.name}.associations.${matchingAssociations[0].as},
   },

2. pass the name of one of the associations in the "association" option, e.g.:
   include: {
     association: '${matchingAssociations[0].as}',
   },

"${this.name}" is associated to "${targetModel.name}" through the following associations: ${matchingAssociations.map(association => `"${association.as}"`).join(', ')}
`.trim());
    }

    return matchingAssociations[0];
  }

  /**
   * Increments the value of one or more attributes.
   *
   * The increment is done using a `SET column = column + X WHERE foo = 'bar'` query.
   *
   * @example <caption>increment number by 1</caption>
   * Model.increment('number', { where: { foo: 'bar' });
   *
   * @example <caption>increment number and count by 2</caption>
   * Model.increment(['number', 'count'], { by: 2, where: { foo: 'bar' } });
   *
   * @example <caption>increment answer by 42, and decrement tries by 1</caption>
   * // `by` cannot be used, as each attribute specifies its own value
   * Model.increment({ answer: 42, tries: -1}, { where: { foo: 'bar' } });
   *
   * @param  {string|Array|object} fields If a string is provided, that column is incremented by the
   *   value of `by` given in options. If an array is provided, the same is true for each column.
   *   If an object is provided, each key is incremented by the corresponding value, `by` is ignored.
   * @param  {object} options increment options
   * @param  {object} options.where conditions hash
   *
   * @returns {Promise<Model[],?number>} an array of affected rows and affected count with `options.returning` true,  whenever supported by dialect
   */
  static async increment(fields, options) {
    options = options || {};
    if (typeof fields === 'string') {
      fields = [fields];
    }

    if (Array.isArray(fields)) {
      fields = fields.map(f => {
        if (this.rawAttributes[f] && this.rawAttributes[f].field && this.rawAttributes[f].field !== f) {
          return this.rawAttributes[f].field;
        }

        return f;
      });
    } else if (fields && typeof fields === 'object') {
      fields = Object.keys(fields).reduce((rawFields, f) => {
        if (this.rawAttributes[f] && this.rawAttributes[f].field && this.rawAttributes[f].field !== f) {
          rawFields[this.rawAttributes[f].field] = fields[f];
        } else {
          rawFields[f] = fields[f];
        }

        return rawFields;
      }, {});
    }

    this._injectScope(options);
    this._optionsMustContainWhere(options);

    options = Utils.defaults({}, options, {
      by: 1,
      where: {},
      increment: true,
    });
    const isSubtraction = !options.increment;

    Utils.mapOptionFieldNames(options, this);

    const where = { ...options.where };

    // A plain object whose keys are the fields to be incremented and whose values are
    // the amounts to be incremented by.
    let incrementAmountsByField = {};
    if (Array.isArray(fields)) {
      incrementAmountsByField = {};
      for (const field of fields) {
        incrementAmountsByField[field] = options.by;
      }
    } else {
      // If the `fields` argument is not an array, then we assume it already has the
      // form necessary to be placed directly in the `incrementAmountsByField` variable.
      incrementAmountsByField = fields;
    }

    // If optimistic locking is enabled, we can take advantage that this is an
    // increment/decrement operation and send it here as well. We put `-1` for
    // decrementing because it will be subtracted, getting `-(-1)` which is `+1`
    if (this._versionAttribute) {
      incrementAmountsByField[this._versionAttribute] = isSubtraction ? -1 : 1;
    }

    const extraAttributesToBeUpdated = {};

    const updatedAtAttr = this._timestampAttributes.updatedAt;
    if (!options.silent && updatedAtAttr && !incrementAmountsByField[updatedAtAttr]) {
      const attrName = this.rawAttributes[updatedAtAttr].field || updatedAtAttr;
      extraAttributesToBeUpdated[attrName] = this._getDefaultTimestamp(updatedAtAttr) || Utils.now(this.sequelize.dialect);
    }

    const tableName = this.getTableName(options);
    let affectedRows;
    if (isSubtraction) {
      affectedRows = await this.queryInterface.decrement(
        this, tableName, where, incrementAmountsByField, extraAttributesToBeUpdated, options,
      );
    } else {
      affectedRows = await this.queryInterface.increment(
        this, tableName, where, incrementAmountsByField, extraAttributesToBeUpdated, options,
      );
    }

    if (options.returning) {
      return [affectedRows, affectedRows.length];
    }

    return [affectedRows];
  }

  /**
   * Decrement the value of one or more columns. This is done in the database, which means it does not use the values
   * currently stored on the Instance. The decrement is done using a
   * ```sql SET column = column - X WHERE foo = 'bar'``` query. To get the correct value after a decrement into the Instance
   * you should do a reload.
   *
   * @example <caption>decrement number by 1</caption>
   * Model.decrement('number', { where: { foo: 'bar' });
   *
   * @example <caption>decrement number and count by 2</caption>
   * Model.decrement(['number', 'count'], { by: 2, where: { foo: 'bar' } });
   *
   * @example <caption>decrement answer by 42, and decrement tries by -1</caption>
   * // `by` is ignored, since each column has its own value
   * Model.decrement({ answer: 42, tries: -1}, { by: 2, where: { foo: 'bar' } });
   *
   * @param {string|Array|object} fields If a string is provided, that column is incremented by the value of `by` given in
   *   options. If an array is provided, the same is true for each column. If and object is provided, each column is
   *   incremented by the value given.
   * @param {object} options decrement options, similar to increment
   *
   * @since 4.36.0
   *
   * @returns {Promise<Model[],?number>} returns an array of affected rows and affected count with `options.returning` true,
   *   whenever supported by dialect
   */
  static async decrement(fields, options) {
    return this.increment(fields, {
      by: 1,
      ...options,
      increment: false,
    });
  }

  static _optionsMustContainWhere(options) {
    assert(options && options.where, 'Missing where attribute in the options parameter');
    assert(_.isPlainObject(options.where) || Array.isArray(options.where) || options.where instanceof Utils.SequelizeMethod,
      'Expected plain object, array or sequelize method in the options.where parameter');
  }

  /**
   * Returns an object representing the query for this instance, use with `options.where`
   *
   * @param {boolean} [checkVersion=false] include version attribute in where hash
   *
   * @returns {object}
   */
  where(checkVersion) {
    const where = this.constructor.primaryKeyAttributes.reduce((result, attribute) => {
      result[attribute] = this.get(attribute, { raw: true });

      return result;
    }, {});

    if (_.size(where) === 0) {
      return this.constructor.options.whereCollection;
    }

    const versionAttr = this.constructor._versionAttribute;
    if (checkVersion && versionAttr) {
      where[versionAttr] = this.get(versionAttr, { raw: true });
    }

    return Utils.mapWhereFieldNames(where, this.constructor);
  }

  toString() {
    return `[object SequelizeInstance:${this.constructor.name}]`;
  }

  /**
   * Returns the underlying data value
   *
   * Unlike {@link Model#get}, this method returns the value as it was retrieved, bypassing
   * getters, cloning, virtual attributes.
   *
   * @param {string} key The name of the attribute to return.
   * @returns {any}
   */
  getDataValue(key) {
    return this.dataValues[key];
  }

  /**
   * Updates the underlying data value
   *
   * Unlike {@link Model#set}, this method skips any special behavior and directly replaces the raw value.
   *
   * @param {string} key The name of the attribute to update.
   * @param {any} value The new value for that attribute.
   */
  setDataValue(key, value) {
    const originalValue = this._previousDataValues[key];

    if (!_.isEqual(value, originalValue)) {
      this.changed(key, true);
    }

    this.dataValues[key] = value;
  }

  /**
   * If no key is given, returns all values of the instance, also invoking virtual getters.
   *
   * If key is given and a field or virtual getter is present for the key it will call that getter - else it will return the
   * value for key.
   *
   * @param {string}  [key] key to get value of
   * @param {object}  [options] get options
   *
   * @returns {object|any}
   */
  get(key, options) {
    if (options === undefined && typeof key === 'object') {
      options = key;
      key = undefined;
    }

    options = options || {};

    if (key) {
      if (Object.prototype.hasOwnProperty.call(this._customGetters, key) && !options.raw) {
        return this._customGetters[key].call(this, key, options);
      }

      if (options.plain && this._options.include && this._options.includeNames.includes(key)) {
        if (Array.isArray(this.dataValues[key])) {
          return this.dataValues[key].map(instance => instance.get(options));
        }

        if (this.dataValues[key] instanceof Model) {
          return this.dataValues[key].get(options);
        }

        return this.dataValues[key];
      }

      return this.dataValues[key];
    }

    if (
      this._hasCustomGetters
      || options.plain && this._options.include
      || options.clone
    ) {
      const values = {};
      let _key;

      if (this._hasCustomGetters) {
        for (_key in this._customGetters) {
          if (
            this._options.attributes
            && !this._options.attributes.includes(_key)
          ) {
            continue;
          }

          if (Object.prototype.hasOwnProperty.call(this._customGetters, _key)) {
            values[_key] = this.get(_key, options);
          }
        }
      }

      for (_key in this.dataValues) {
        if (
          !Object.prototype.hasOwnProperty.call(values, _key)
          && Object.prototype.hasOwnProperty.call(this.dataValues, _key)
        ) {
          values[_key] = this.get(_key, options);
        }
      }

      return values;
    }

    return this.dataValues;
  }

  /**
   * Set is used to update values on the instance (the Sequelize representation of the instance that is, remember that
   * nothing will be persisted before you actually call `save`). In its most basic form `set` will update a value stored in
   * the underlying `dataValues` object. However, if a custom setter function is defined for the key, that function will be
   * called instead. To bypass the setter, you can pass `raw: true` in the options object.
   *
   * If set is called with an object, it will loop over the object, and call set recursively for each key, value pair. If
   * you set raw to true, the underlying dataValues will either be set directly to the object passed, or used to extend
   * dataValues, if dataValues already contain values.
   *
   * When set is called, the previous value of the field is stored and sets a changed flag(see `changed`).
   *
   * Set can also be used to build instances for associations, if you have values for those.
   * When using set with associations you need to make sure the property key matches the alias of the association
   * while also making sure that the proper include options have been set (from .build() or .findOne())
   *
   * If called with a dot.separated key on a JSON/JSONB attribute it will set the value nested and flag the entire object as
   * changed.
   *
   * @param {string|object} key key to set, it can be string or object. When string it will set that key, for object it will
   *   loop over all object properties nd set them.
   * @param {any} value value to set
   * @param {object} [options] set options
   *
   * @returns {Model}
   */
  set(key, value, options) {
    let values;
    let originalValue;

    if (typeof key === 'object' && key !== null) {
      values = key;
      options = value || {};

      if (options.reset) {
        this.dataValues = {};
        for (const key in values) {
          this.changed(key, false);
        }
      }

      // If raw, and we're not dealing with includes or special attributes, just set it straight on the dataValues object
      if (options.raw && !(this._options && this._options.include) && !(options && options.attributes) && !this.constructor._hasDateAttributes && !this.constructor._hasBooleanAttributes) {
        if (Object.keys(this.dataValues).length > 0) {
          Object.assign(this.dataValues, values);
        } else {
          this.dataValues = values;
        }

        // If raw, .changed() shouldn't be true
        this._previousDataValues = { ...this.dataValues };
      } else {
        // Loop and call set
        if (options.attributes) {
          const setKeys = data => {
            for (const k of data) {
              if (values[k] === undefined) {
                continue;
              }

              this.set(k, values[k], options);
            }
          };

          setKeys(options.attributes);
          if (this.constructor._hasVirtualAttributes) {
            setKeys(this.constructor._virtualAttributes);
          }

          if (this._options.includeNames) {
            setKeys(this._options.includeNames);
          }
        } else {
          for (const key in values) {
            this.set(key, values[key], options);
          }
        }

        if (options.raw) {
          // If raw, .changed() shouldn't be true
          this._previousDataValues = { ...this.dataValues };
        }
      }

      return this;
    }

    if (!options) {
      options = {};
    }

    if (!options.raw) {
      originalValue = this.dataValues[key];
    }

    // If not raw, and there's a custom setter
    if (!options.raw && this._customSetters[key]) {
      this._customSetters[key].call(this, value, key);
      // custom setter should have changed value, get that changed value
      // TODO: v5 make setters return new value instead of changing internal store
      const newValue = this.dataValues[key];
      if (!_.isEqual(newValue, originalValue)) {
        this._previousDataValues[key] = originalValue;
        this.changed(key, true);
      }
    } else {
      // Check if we have included models, and if this key matches the include model names/aliases
      if (this._options && this._options.include && this._options.includeNames.includes(key)) {
        // Pass it on to the include handler
        this._setInclude(key, value, options);

        return this;
      }

      // Bunch of stuff we won't do when it's raw
      if (!options.raw) {
        // If attribute is not in model definition, return
        if (!this._isAttribute(key)) {
          if (key.includes('.') && this.constructor._jsonAttributes.has(key.split('.')[0])) {
            const previousNestedValue = Dottie.get(this.dataValues, key);
            if (!_.isEqual(previousNestedValue, value)) {
              Dottie.set(this.dataValues, key, value);
              this.changed(key.split('.')[0], true);
            }
          }

          return this;
        }

        // If attempting to set primary key and primary key is already defined, return
        if (this.constructor._hasPrimaryKeys && originalValue && this.constructor._isPrimaryKey(key)) {
          return this;
        }

        // If attempting to set read only attributes, return
        if (!this.isNewRecord && this.constructor._hasReadOnlyAttributes && this.constructor._readOnlyAttributes.has(key)) {
          return this;
        }
      }

      // If there's a data type sanitizer
      if (
        !(value instanceof Utils.SequelizeMethod)
        && Object.prototype.hasOwnProperty.call(this.constructor._dataTypeSanitizers, key)
      ) {
        value = this.constructor._dataTypeSanitizers[key].call(this, value, options);
      }

      // Set when the value has changed and not raw
      if (
        !options.raw
        && (
          // True when sequelize method
          value instanceof Utils.SequelizeMethod
          // Check for data type type comparators
          || !(value instanceof Utils.SequelizeMethod) && this.constructor._dataTypeChanges[key] && this.constructor._dataTypeChanges[key].call(this, value, originalValue, options) // Check default
          || !this.constructor._dataTypeChanges[key] && !_.isEqual(value, originalValue)
        )
      ) {
        this._previousDataValues[key] = originalValue;
        this.changed(key, true);
      }

      // set data value
      this.dataValues[key] = value;
    }

    return this;
  }

  setAttributes(updates) {
    return this.set(updates);
  }

  /**
   * If changed is called with a string it will return a boolean indicating whether the value of that key in `dataValues` is
   * different from the value in `_previousDataValues`.
   *
   * If changed is called without an argument, it will return an array of keys that have changed.
   *
   * If changed is called without an argument and no keys have changed, it will return `false`.
   *
   * Please note that this function will return `false` when a property from a nested (for example JSON) property
   * was edited manually, you must call `changed('key', true)` manually in these cases.
   * Writing an entirely new object (eg. deep cloned) will be detected.
   *
   * @example
   * ```
   * const mdl = await MyModel.findOne();
   * mdl.myJsonField.a = 1;
   * console.log(mdl.changed()) => false
   * mdl.save(); // this will not save anything
   * mdl.changed('myJsonField', true);
   * console.log(mdl.changed()) => ['myJsonField']
   * mdl.save(); // will save
   * ```
   *
   * @param {string} [key] key to check or change status of
   * @param {any} [value] value to set
   *
   * @returns {boolean|Array}
   */
  changed(key, value) {
    if (key === undefined) {
      if (this._changed.size > 0) {
        return [...this._changed];
      }

      return false;
    }

    if (value === true) {
      this._changed.add(key);

      return this;
    }

    if (value === false) {
      this._changed.delete(key);

      return this;
    }

    return this._changed.has(key);
  }

  /**
   * Returns the previous value for key from `_previousDataValues`.
   *
   * If called without a key, returns the previous values for all values which have changed
   *
   * @param {string} [key] key to get previous value of
   *
   * @returns {any|Array<any>}
   */
  previous(key) {
    if (key) {
      return this._previousDataValues[key];
    }

    return _.pickBy(this._previousDataValues, (value, key) => this.changed(key));
  }

  _setInclude(key, value, options) {
    if (!Array.isArray(value)) {
      value = [value];
    }

    if (value[0] instanceof Model) {
      value = value.map(instance => instance.dataValues);
    }

    const include = this._options.includeMap[key];
    const association = include.association;
    const accessor = key;
    const primaryKeyAttribute = include.model.primaryKeyAttribute;
    const childOptions = {
      isNewRecord: this.isNewRecord,
      include: include.include,
      includeNames: include.includeNames,
      includeMap: include.includeMap,
      includeValidated: true,
      raw: options.raw,
      attributes: include.originalAttributes,
    };
    let isEmpty;

    if (include.originalAttributes === undefined || include.originalAttributes.length > 0) {
      if (association.isSingleAssociation) {
        if (Array.isArray(value)) {
          value = value[0];
        }

        isEmpty = value && value[primaryKeyAttribute] === null || value === null;
        this[accessor] = this.dataValues[accessor] = isEmpty ? null : include.model.build(value, childOptions);
      } else {
        isEmpty = value[0] && value[0][primaryKeyAttribute] === null;
        this[accessor] = this.dataValues[accessor] = isEmpty ? [] : include.model.bulkBuild(value, childOptions);
      }
    }
  }

  /**
   * Validates this instance, and if the validation passes, persists it to the database.
   *
   * Returns a Promise that resolves to the saved instance (or rejects with a {@link ValidationError},
   * which will have a property for each of the fields for which the validation failed, with the error message for that field).
   *
   * This method is optimized to perform an UPDATE only into the fields that changed.
   * If nothing has changed, no SQL query will be performed.
   *
   * This method is not aware of eager loaded associations.
   * In other words, if some other model instance (child) was eager loaded with this instance (parent),
   * and you change something in the child, calling `save()` will simply ignore the change that happened on the child.
   *
   * @param {object} [options] save options
   * @returns {Promise<Model>}
   */
  async save(options) {
    if (arguments.length > 1) {
      throw new Error('The second argument was removed in favor of the options object.');
    }

    options = Utils.cloneDeep(options);
    options = _.defaults(options, {
      hooks: true,
      validate: true,
    });

    // Add CLS transaction
    setTransactionFromCls(options, this.sequelize);

    if (!options.fields) {
      if (this.isNewRecord) {
        options.fields = Object.keys(this.constructor.rawAttributes);
      } else {
        options.fields = _.intersection(this.changed(), Object.keys(this.constructor.rawAttributes));
      }

      options.defaultFields = options.fields;
    }

    if (options.returning === undefined) {
      if (options.association) {
        options.returning = false;
      } else if (this.isNewRecord) {
        options.returning = true;
      }
    }

    const primaryKeyName = this.constructor.primaryKeyAttribute;
    const primaryKeyAttribute = primaryKeyName && this.constructor.rawAttributes[primaryKeyName];
    const createdAtAttr = this.constructor._timestampAttributes.createdAt;
    const versionAttr = this.constructor._versionAttribute;
    const hook = this.isNewRecord ? 'Create' : 'Update';
    const wasNewRecord = this.isNewRecord;
    const now = Utils.now(this.sequelize.dialect);
    let updatedAtAttr = this.constructor._timestampAttributes.updatedAt;

    if (updatedAtAttr && options.fields.length > 0 && !options.fields.includes(updatedAtAttr)) {
      options.fields.push(updatedAtAttr);
    }

    if (versionAttr && options.fields.length > 0 && !options.fields.includes(versionAttr)) {
      options.fields.push(versionAttr);
    }

    if (options.silent === true && !(this.isNewRecord && this.get(updatedAtAttr, { raw: true }))) {
      // UpdateAtAttr might have been added as a result of Object.keys(Model.rawAttributes). In that case we have to remove it again
      _.remove(options.fields, val => val === updatedAtAttr);
      updatedAtAttr = false;
    }

    if (this.isNewRecord === true) {
      if (createdAtAttr && !options.fields.includes(createdAtAttr)) {
        options.fields.push(createdAtAttr);
      }

      if (primaryKeyAttribute && primaryKeyAttribute.defaultValue && !options.fields.includes(primaryKeyName)) {
        options.fields.unshift(primaryKeyName);
      }
    }

    if (this.isNewRecord === false && primaryKeyName && this.get(primaryKeyName, { raw: true }) === undefined) {
      throw new Error('You attempted to save an instance with no primary key, this is not allowed since it would result in a global update');
    }

    if (updatedAtAttr && !options.silent && options.fields.includes(updatedAtAttr)) {
      this.dataValues[updatedAtAttr] = this.constructor._getDefaultTimestamp(updatedAtAttr) || now;
    }

    if (this.isNewRecord && createdAtAttr && !this.dataValues[createdAtAttr]) {
      this.dataValues[createdAtAttr] = this.constructor._getDefaultTimestamp(createdAtAttr) || now;
    }

    // Db2 does not allow NULL values for unique columns.
    // Add dummy values if not provided by test case or user.
    if (this.sequelize.options.dialect === 'db2' && this.isNewRecord) {
      this.uniqno = this.sequelize.dialect.queryGenerator.addUniqueFields(
        this.dataValues, this.constructor.rawAttributes, this.uniqno,
      );
    }

    // Validate
    if (options.validate) {
      await this.validate(options);
    }

    // Run before hook
    if (options.hooks) {
      const beforeHookValues = _.pick(this.dataValues, options.fields);
      let ignoreChanged = _.difference(this.changed(), options.fields); // In case of update where it's only supposed to update the passed values and the hook values
      let hookChanged;
      let afterHookValues;

      if (updatedAtAttr && options.fields.includes(updatedAtAttr)) {
        ignoreChanged = _.without(ignoreChanged, updatedAtAttr);
      }

      await this.constructor.runHooks(`before${hook}`, this, options);
      if (options.defaultFields && !this.isNewRecord) {
        afterHookValues = _.pick(this.dataValues, _.difference(this.changed(), ignoreChanged));

        hookChanged = [];
        for (const key of Object.keys(afterHookValues)) {
          if (afterHookValues[key] !== beforeHookValues[key]) {
            hookChanged.push(key);
          }
        }

        options.fields = _.uniq(options.fields.concat(hookChanged));
      }

      if (hookChanged && options.validate) {
        // Validate again

        options.skip = _.difference(Object.keys(this.constructor.rawAttributes), hookChanged);
        await this.validate(options);
        delete options.skip;
      }
    }

    if (options.fields.length > 0 && this.isNewRecord && this._options.include && this._options.include.length > 0) {
      await Promise.all(this._options.include.filter(include => include.association instanceof BelongsTo).map(async include => {
        const instance = this.get(include.as);
        if (!instance) {
          return;
        }

        const includeOptions = _(Utils.cloneDeep(include))
          .omit(['association'])
          .defaults({
            transaction: options.transaction,
            logging: options.logging,
            parentRecord: this,
          })
          .value();

        await instance.save(includeOptions);

        await this[include.association.accessors.set](instance, { save: false, logging: options.logging });
      }));
    }

    const realFields = options.fields.filter(field => !this.constructor._virtualAttributes.has(field));
    if (realFields.length === 0) {
      return this;
    }

    if (!this.changed() && !this.isNewRecord) {
      return this;
    }

    const versionFieldName = _.get(this.constructor.rawAttributes[versionAttr], 'field') || versionAttr;
    const values = Utils.mapValueFieldNames(this.dataValues, options.fields, this.constructor);
    let query = null;
    let args = [];
    let where;

    if (this.isNewRecord) {
      query = 'insert';
      args = [this, this.constructor.getTableName(options), values, options];
    } else {
      where = this.where(true);
      if (versionAttr) {
        values[versionFieldName] = Number.parseInt(values[versionFieldName], 10) + 1;
      }

      query = 'update';
      args = [this, this.constructor.getTableName(options), values, where, options];
    }

    const [result, rowsUpdated] = await this.constructor.queryInterface[query](...args);
    if (versionAttr) {
      // Check to see that a row was updated, otherwise it's an optimistic locking error.
      if (rowsUpdated < 1) {
        throw new sequelizeErrors.OptimisticLockError({
          modelName: this.constructor.name,
          values,
          where,
        });
      } else {
        result.dataValues[versionAttr] = values[versionFieldName];
      }
    }

    // Transfer database generated values (defaults, autoincrement, etc)
    for (const attr of Object.keys(this.constructor.rawAttributes)) {
      if (this.constructor.rawAttributes[attr].field
          && values[this.constructor.rawAttributes[attr].field] !== undefined
          && this.constructor.rawAttributes[attr].field !== attr
      ) {
        values[attr] = values[this.constructor.rawAttributes[attr].field];
        delete values[this.constructor.rawAttributes[attr].field];
      }
    }

    Object.assign(values, result.dataValues);

    Object.assign(result.dataValues, values);
    if (wasNewRecord && this._options.include && this._options.include.length > 0) {
      await Promise.all(
        this._options.include.filter(include => !(include.association instanceof BelongsTo
          || include.parent && include.parent.association instanceof BelongsToMany)).map(async include => {
          let instances = this.get(include.as);

          if (!instances) {
            return;
          }

          if (!Array.isArray(instances)) {
            instances = [instances];
          }

          const includeOptions = _(Utils.cloneDeep(include))
            .omit(['association'])
            .defaults({
              transaction: options.transaction,
              logging: options.logging,
              parentRecord: this,
            })
            .value();

          // Instances will be updated in place so we can safely treat HasOne like a HasMany
          await Promise.all(instances.map(async instance => {
            if (include.association instanceof BelongsToMany) {
              await instance.save(includeOptions);
              const values0 = {
                [include.association.foreignKey]: this.get(this.constructor.primaryKeyAttribute, { raw: true }),
                [include.association.otherKey]: instance.get(instance.constructor.primaryKeyAttribute, { raw: true }),
                // Include values defined in the association
                ...include.association.through.scope,
              };

              if (instance[include.association.through.model.name]) {
                for (const attr of Object.keys(include.association.through.model.rawAttributes)) {
                  if (include.association.through.model.rawAttributes[attr]._autoGenerated
                    || attr === include.association.foreignKey
                    || attr === include.association.otherKey
                    || typeof instance[include.association.through.model.name][attr] === 'undefined') {
                    continue;
                  }

                  values0[attr] = instance[include.association.through.model.name][attr];
                }
              }

              await include.association.throughModel.create(values0, includeOptions);
            } else {
              instance.set(include.association.foreignKey, this.get(include.association.sourceKey || this.constructor.primaryKeyAttribute, { raw: true }), { raw: true });
              Object.assign(instance, include.association.scope);
              await instance.save(includeOptions);
            }
          }));
        }),
      );
    }

    // Run after hook
    if (options.hooks) {
      await this.constructor.runHooks(`after${hook}`, result, options);
    }

    for (const field of options.fields) {
      result._previousDataValues[field] = result.dataValues[field];
      this.changed(field, false);
    }

    this.isNewRecord = false;

    return result;
  }

  /**
   * Refreshes the current instance in-place, i.e. update the object with current data from the DB and return
   * the same object. This is different from doing a `find(Instance.id)`, because that would create and
   * return a new instance. With this method, all references to the Instance are updated with the new data
   * and no new objects are created.
   *
   * @param {object} [options] Options that are passed on to `Model.find`
   *
   * @returns {Promise<Model>}
   */
  async reload(options) {
    options = Utils.defaults({
      where: this.where(),
    }, options, {
      include: this._options.include || undefined,
    });

    const reloaded = await this.constructor.findOne(options);
    if (!reloaded) {
      throw new sequelizeErrors.InstanceError(
        'Instance could not be reloaded because it does not exist anymore (find call returned null)',
      );
    }

    // update the internal options of the instance
    this._options = reloaded._options;
    // re-set instance values
    this.set(reloaded.dataValues, {
      raw: true,
      reset: true && !options.attributes,
    });

    return this;
  }

  /**
   * Validate the attribute of this instance according to validation rules set in the model definition.
   *
   * Emits null if and only if validation successful; otherwise an Error instance containing
   * { field name : [error msgs] } entries.
  *
  * @param {object} [options] Options that are passed to the validator
  * @returns {Promise}
  */
  async validate(options) {
    return new InstanceValidator(this, options).validate();
  }

  /**
   * This is the same as calling {@link Model#set} followed by calling {@link Model#save},
   * but it only saves attributes values passed to it, making it safer.
   *
   * @param {object} values See `set`
   * @param {object} options See `save`
   *
   * @returns {Promise<Model>}
   */
  async update(values, options) {
    // Clone values so it doesn't get modified for caller scope and ignore undefined values
    values = _.omitBy(values, value => value === undefined);

    const changedBefore = this.changed() || [];

    options = options || {};
    if (Array.isArray(options)) {
      options = { fields: options };
    }

    options = Utils.cloneDeep(options);
    const setOptions = Utils.cloneDeep(options);
    setOptions.attributes = options.fields;
    this.set(values, setOptions);

    // Now we need to figure out which fields were actually affected by the setter.
    const sideEffects = _.without(this.changed(), ...changedBefore);
    const fields = _.union(Object.keys(values), sideEffects);

    if (!options.fields) {
      options.fields = _.intersection(fields, this.changed());
      options.defaultFields = options.fields;
    }

    return await this.save(options);
  }

  /**
   * Destroys the row corresponding to this instance. Depending on your setting for paranoid, the row will either be
   * completely deleted, or have its deletedAt timestamp set to the current time.
   *
   * @param {object} [options={}] destroy options
   * @returns {Promise}
   */
  async destroy(options) {
    options = {
      hooks: true,
      force: false,
      ...options,
    };

    // Add CLS transaction
    setTransactionFromCls(options, this.sequelize);

    // Run before hook
    if (options.hooks) {
      await this.constructor.runHooks('beforeDestroy', this, options);
    }

    const where = this.where(true);

    let result;
    if (this.constructor._timestampAttributes.deletedAt && options.force === false) {
      const attributeName = this.constructor._timestampAttributes.deletedAt;
      const attribute = this.constructor.rawAttributes[attributeName];
      const defaultValue = Object.prototype.hasOwnProperty.call(attribute, 'defaultValue')
        ? attribute.defaultValue
        : null;
      const currentValue = this.getDataValue(attributeName);
      const undefinedOrNull = currentValue == null && defaultValue == null;
      if (undefinedOrNull || _.isEqual(currentValue, defaultValue)) {
        // only update timestamp if it wasn't already set
        this.setDataValue(attributeName, new Date());
      }

      result = await this.save({ ...options, hooks: false });
    } else {
      result = await this.constructor.queryInterface.delete(this, this.constructor.getTableName(options), where, { type: QueryTypes.DELETE, limit: null, ...options });
    }

    // Run after hook
    if (options.hooks) {
      await this.constructor.runHooks('afterDestroy', this, options);
    }

    return result;
  }

  /**
   * Returns true if this instance is "soft deleted".
   * Throws an error if {@link ModelOptions.paranoid} is not enabled.
   *
   * See {@link https://sequelize.org/docs/v7/core-concepts/paranoid/} to learn more about soft deletion / paranoid models.
   *
   * @returns {boolean}
   */
  isSoftDeleted() {
    if (!this.constructor._timestampAttributes.deletedAt) {
      throw new Error('Model is not paranoid');
    }

    const deletedAtAttribute = this.constructor.rawAttributes[this.constructor._timestampAttributes.deletedAt];
    const defaultValue = Object.prototype.hasOwnProperty.call(deletedAtAttribute, 'defaultValue') ? deletedAtAttribute.defaultValue : null;
    const deletedAt = this.get(this.constructor._timestampAttributes.deletedAt) || null;
    const isSet = deletedAt !== defaultValue;

    return isSet;
  }

  /**
   * Restores the row corresponding to this instance.
   * Only available for paranoid models.
   *
   * See {@link https://sequelize.org/docs/v7/core-concepts/paranoid/} to learn more about soft deletion / paranoid models.
   *
   * @param {object}      [options={}] restore options
   * @returns {Promise}
   */
  async restore(options) {
    if (!this.constructor._timestampAttributes.deletedAt) {
      throw new Error('Model is not paranoid');
    }

    options = {
      hooks: true,
      force: false,
      ...options,
    };

    // Add CLS transaction
    setTransactionFromCls(options, this.sequelize);

    // Run before hook
    if (options.hooks) {
      await this.constructor.runHooks('beforeRestore', this, options);
    }

    const deletedAtCol = this.constructor._timestampAttributes.deletedAt;
    const deletedAtAttribute = this.constructor.rawAttributes[deletedAtCol];
    const deletedAtDefaultValue = Object.prototype.hasOwnProperty.call(deletedAtAttribute, 'defaultValue') ? deletedAtAttribute.defaultValue : null;

    this.setDataValue(deletedAtCol, deletedAtDefaultValue);
    const result = await this.save({ ...options, hooks: false, omitNull: false });
    // Run after hook
    if (options.hooks) {
      await this.constructor.runHooks('afterRestore', this, options);

      return result;
    }

    return result;
  }

  /**
   * Increment the value of one or more columns. This is done in the database, which means it does not use the values
   * currently stored on the Instance. The increment is done using a
   * ```sql
   * SET column = column + X
   * ```
   * query. The updated instance will be returned by default in Postgres. However, in other dialects, you will need to do a
   * reload to get the new values.
   *
   * @example
   * instance.increment('number') // increment number by 1
   *
   * instance.increment(['number', 'count'], { by: 2 }) // increment number and count by 2
   *
   * // increment answer by 42, and tries by 1.
   * // `by` is ignored, since each column has its own value
   * instance.increment({ answer: 42, tries: 1}, { by: 2 })
   *
   * @param {string|Array|object} fields If a string is provided, that column is incremented by the value of `by` given in
   *   options. If an array is provided, the same is true for each column. If and object is provided, each column is
   *   incremented by the value given.
   * @param {object} [options] options
   *
   * @returns {Promise<Model>}
   * @since 4.0.0
   */
  async increment(fields, options) {
    const identifier = this.where();

    options = Utils.cloneDeep(options);
    options.where = { ...options.where, ...identifier };
    options.instance = this;

    await this.constructor.increment(fields, options);

    return this;
  }

  /**
   * Decrement the value of one or more columns. This is done in the database, which means it does not use the values
   * currently stored on the Instance. The decrement is done using a
   * ```sql
   * SET column = column - X
   * ```
   * query. The updated instance will be returned by default in Postgres. However, in other dialects, you will need to do a
   * reload to get the new values.
   *
   * @example
   * instance.decrement('number') // decrement number by 1
   *
   * instance.decrement(['number', 'count'], { by: 2 }) // decrement number and count by 2
   *
   * // decrement answer by 42, and tries by 1.
   * // `by` is ignored, since each column has its own value
   * instance.decrement({ answer: 42, tries: 1}, { by: 2 })
   *
   * @param {string|Array|object} fields If a string is provided, that column is decremented by the value of `by` given in
   *   options. If an array is provided, the same is true for each column. If and object is provided, each column is
   *   decremented by the value given
   * @param {object}      [options] decrement options
   * @returns {Promise}
   */
  async decrement(fields, options) {
    return this.increment(fields, {
      by: 1,
      ...options,
      increment: false,
    });
  }

  /**
   * Check whether this and `other` Instance refer to the same row
   *
   * @param {Model} other Other instance to compare against
   *
   * @returns {boolean}
   */
  equals(other) {
    if (!other || !other.constructor) {
      return false;
    }

    if (!(other instanceof this.constructor)) {
      return false;
    }

    return this.constructor.primaryKeyAttributes.every(attribute => this.get(attribute, { raw: true }) === other.get(attribute, { raw: true }));
  }

  /**
   * Check if this is equal to one of `others` by calling equals
   *
   * @param {Array<Model>} others An array of instances to check against
   *
   * @returns {boolean}
   */
  equalsOneOf(others) {
    return others.some(other => this.equals(other));
  }

  setValidators(attribute, validators) {
    this.validators[attribute] = validators;
  }

  /**
   * Convert the instance to a JSON representation.
   * Proxies to calling `get` with no keys.
   * This means get all values gotten from the DB, and apply all custom getters.
   *
   * @see
   * {@link Model#get}
   *
   * @returns {object}
   */
  toJSON() {
    return _.cloneDeep(
      this.get({
        plain: true,
      }),
    );
  }

  /**
   * Defines a 1:n association between two models.
   * The foreign key is added on the target model.
   *
   * See {@link https://sequelize.org/docs/v7/core-concepts/assocs/} to learn more about associations.
   *
   * @example
   * ```javascript
   * Profile.hasMany(User)
   * ```
   *
   * @param {Model} target The model that will be associated with a hasMany relationship
   * @param {object} options Options for the association
   * @returns {HasMany} The newly defined association (also available in {@link Model.associations}).
   */
  static hasMany(target, options) {
    return HasMany.associate(AssociationSecret, this, target, options);
  }

  /**
   * Create an N:M association with a join table. Defining `through` is required.
   * The foreign keys are added on the through model.
   *
   * See {@link https://sequelize.org/docs/v7/core-concepts/assocs/} to learn more about associations.
   *
   * @example
   * ```javascript
   * // Automagically generated join model
   * User.belongsToMany(Project, { through: 'UserProjects' })
   *
   * // Join model with additional attributes
   * const UserProjects = sequelize.define('UserProjects', {
   *   started: Sequelize.BOOLEAN
   * })
   * User.belongsToMany(Project, { through: UserProjects })
   * ```
   *
   * @param {Model} target Target model
   * @param {object} options belongsToMany association options
   * @returns {BelongsToMany} The newly defined association (also available in {@link Model.associations}).
   */
  static belongsToMany(target, options) {
    return BelongsToMany.associate(AssociationSecret, this, target, options);
  }

  /**
   * Creates a 1:1 association between this model (the source) and the provided target.
   * The foreign key is added on the target model.
   *
   * See {@link https://sequelize.org/docs/v7/core-concepts/assocs/} to learn more about associations.
   *
   * @example
   * ```javascript
   * User.hasOne(Profile)
   * ```
   *
   * @param {Model} target The model that will be associated with hasOne relationship
   * @param {object} [options] hasOne association options
   * @returns {HasOne} The newly defined association (also available in {@link Model.associations}).
   */
  static hasOne(target, options) {
    return HasOne.associate(AssociationSecret, this, target, options);
  }

  /**
   * Creates an association between this (the source) and the provided target.
   * The foreign key is added on the source Model.
   *
   * See {@link https://sequelize.org/docs/v7/core-concepts/assocs/} to learn more about associations.
   *
   * @example
   * ```javascript
   * Profile.belongsTo(User)
   * ```
   *
   * @param {Model} target The target model
   * @param {object} [options] belongsTo association options
   * @returns {BelongsTo} The newly defined association (also available in {@link Model.associations}).
   */
  static belongsTo(target, options) {
    return BelongsTo.associate(AssociationSecret, this, target, options);
  }
}

/**
 * Unpacks an object that only contains a single Op.and key to the value of Op.and
 *
 * Internal method used by {@link combineWheresWithAnd}
 *
 * @param {WhereOptions} where The object to unpack
 * @example `{ [Op.and]: [a, b] }` becomes `[a, b]`
 * @example `{ [Op.and]: { key: val } }` becomes `{ key: val }`
 * @example `{ [Op.or]: [a, b] }` remains as `{ [Op.or]: [a, b] }`
 * @example `{ [Op.and]: [a, b], key: c }` remains as `{ [Op.and]: [a, b], key: c }`
 * @private
 */
function unpackAnd(where) {
  if (!_.isObject(where)) {
    return where;
  }

  const keys = Utils.getComplexKeys(where);

  // object is empty, remove it.
  if (keys.length === 0) {
    return;
  }

  // we have more than just Op.and, keep as-is
  if (keys.length !== 1 || keys[0] !== Op.and) {
    return where;
  }

  const andParts = where[Op.and];

  return andParts;
}

function combineWheresWithAnd(whereA, whereB) {
  const unpackedA = unpackAnd(whereA);

  if (unpackedA === undefined) {
    return whereB;
  }

  const unpackedB = unpackAnd(whereB);

  if (unpackedB === undefined) {
    return whereA;
  }

  return {
    [Op.and]: [unpackedA, unpackedB].flat(),
  };
}

Hooks.applyTo(Model, true);
