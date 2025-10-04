'use strict';

import { EMPTY_OBJECT, every, find } from '@sequelize/utils';
import Dottie from 'dottie';
import assignWith from 'lodash/assignWith';
import cloneDeepLodash from 'lodash/cloneDeep';
import defaultsLodash from 'lodash/defaults';
import difference from 'lodash/difference';
import each from 'lodash/each';
import flattenDepth from 'lodash/flattenDepth';
import forEach from 'lodash/forEach';
import forIn from 'lodash/forIn';
import get from 'lodash/get';
import intersection from 'lodash/intersection';
import isEmpty from 'lodash/isEmpty';
import isEqual from 'lodash/isEqual';
import isObject from 'lodash/isObject';
import isPlainObject from 'lodash/isPlainObject';
import mapValues from 'lodash/mapValues';
import omit from 'lodash/omit';
import omitBy from 'lodash/omitBy';
import pick from 'lodash/pick';
import pickBy from 'lodash/pickBy';
import remove from 'lodash/remove';
import union from 'lodash/union';
import unionBy from 'lodash/unionBy';
import uniq from 'lodash/uniq';
import without from 'lodash/without';
import assert from 'node:assert';
import NodeUtil from 'node:util';
import { AbstractDataType } from './abstract-dialect/data-types';
import {
  Association,
  BelongsToAssociation,
  BelongsToManyAssociation,
  HasManyAssociation,
  HasOneAssociation,
} from './associations';
import { AssociationSecret } from './associations/helpers';
import * as DataTypes from './data-types';
import { QueryTypes } from './enums.js';
import * as SequelizeErrors from './errors';
import { BaseSqlExpression } from './expression-builders/base-sql-expression.js';
import { InstanceValidator } from './instance-validator';
import {
  _validateIncludedElements,
  combineIncludes,
  getModelPkWhere,
  setTransactionFromCls,
  throwInvalidInclude,
} from './model-internals';
import { ModelTypeScript } from './model-typescript';
import { Op } from './operators';
import { intersects } from './utils/array';
import {
  noDoubleNestedGroup,
  noModelDropSchema,
  noNewModel,
  schemaRenamedToWithSchema,
  scopeRenamedToWithScope,
} from './utils/deprecations';
import { toDefaultValue } from './utils/dialect';
import { mapFinderOptions, mapOptionFieldNames, mapValueFieldNames } from './utils/format';
import { logger } from './utils/logger';
import { isModelStatic, isSameInitialModel } from './utils/model-utils';
import {
  cloneDeep,
  defaults,
  flattenObjectDeep,
  getObjectFromMap,
  mergeDefaults,
} from './utils/object';
import { isWhereEmpty } from './utils/query-builder-utils';
import { removeTrailingSemicolon } from './utils/string.js';
import { getComplexKeys } from './utils/where.js';

// This list will quickly become dated, but failing to maintain this list just means
// we won't throw a warning when we should. At least most common cases will forever be covered
// so we stop throwing erroneous warnings when we shouldn't.
const validQueryKeywords = new Set([
  'where',
  'attributes',
  'paranoid',
  'include',
  'order',
  'limit',
  'offset',
  'transaction',
  'lock',
  'raw',
  'logging',
  'benchmark',
  'having',
  'searchPath',
  'rejectOnEmpty',
  'plain',
  'scope',
  'group',
  'through',
  'defaults',
  'distinct',
  'primary',
  'exception',
  'type',
  'hooks',
  'force',
  'name',
]);

// List of attributes that should not be implicitly passed into subqueries/includes.
const nonCascadingOptions = [
  'include',
  'attributes',
  'originalAttributes',
  'order',
  'where',
  'limit',
  'offset',
  'plain',
  'group',
  'having',
];

/**
 * Used to ensure Model.build is used instead of new Model().
 * Do not expose.
 */
const CONSTRUCTOR_SECRET = Symbol('model-constructor-secret');

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
 */
export class Model extends ModelTypeScript {
  /**
   * Builds a new model instance.
   *
   * Cannot be used directly. Use {@link Model.build} instead.
   *
   * @param {object}  [values={}] an object of key value pairs
   * @param {object}  [options] instance construction options
   * @param {boolean} [options.raw=false] If set to true, values will ignore field and virtual setters.
   * @param {boolean} [options.isNewRecord=true] Is this a new record
   * @param {Array}   [options.include] an array of include options - Used to build prefetched/included model instances. See
   *   `set`
   * @param {symbol}  secret Secret used to ensure Model.build is used instead of new Model(). Don't forget to pass it up if
   *   you define a custom constructor.
   */
  constructor(values = {}, options = {}, secret) {
    super();

    if (secret !== CONSTRUCTOR_SECRET) {
      noNewModel();
      // TODO [>=8]: throw instead of deprecation notice
      // throw new Error(`Use ${this.constructor.name}.build() instead of new ${this.constructor.name}()`);
    }

    this.constructor.assertIsInitialized();

    options = {
      isNewRecord: true,
      _schema: this.modelDefinition.table.schema,
      _schemaDelimiter: this.modelDefinition.table.delimiter,
      ...options,
      model: this.constructor,
    };

    if (options.attributes) {
      options.attributes = options.attributes.map(attribute => {
        return Array.isArray(attribute) ? attribute[1] : attribute;
      });
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
    this._options = omit(options, ['comesFromDatabase']);

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
    values = { ...values };

    if (options.isNewRecord) {
      const modelDefinition = this.modelDefinition;

      const defaults =
        modelDefinition.defaultValues.size > 0
          ? mapValues(getObjectFromMap(modelDefinition.defaultValues), getDefaultValue => {
              const value = getDefaultValue();

              return value && value instanceof BaseSqlExpression ? value : cloneDeepLodash(value);
            })
          : Object.create(null);

      // set id to null if not passed as value, a newly created dao has no id
      // removing this breaks bulkCreate
      // do after default values since it might have UUID as a default value
      if (modelDefinition.primaryKeysAttributeNames.size > 0) {
        for (const primaryKeyAttribute of modelDefinition.primaryKeysAttributeNames) {
          if (!Object.hasOwn(defaults, primaryKeyAttribute)) {
            defaults[primaryKeyAttribute] = null;
          }
        }
      }

      const {
        createdAt: createdAtAttrName,
        deletedAt: deletedAtAttrName,
        updatedAt: updatedAtAttrName,
      } = modelDefinition.timestampAttributeNames;

      if (createdAtAttrName && defaults[createdAtAttrName]) {
        this.dataValues[createdAtAttrName] = toDefaultValue(defaults[createdAtAttrName]);
        delete defaults[createdAtAttrName];
      }

      if (updatedAtAttrName && defaults[updatedAtAttrName]) {
        this.dataValues[updatedAtAttrName] = toDefaultValue(defaults[updatedAtAttrName]);
        delete defaults[updatedAtAttrName];
      }

      if (deletedAtAttrName && defaults[deletedAtAttrName]) {
        this.dataValues[deletedAtAttrName] = toDefaultValue(defaults[deletedAtAttrName]);
        delete defaults[deletedAtAttrName];
      }

      for (const key in defaults) {
        if (values[key] === undefined) {
          this.set(key, toDefaultValue(defaults[key]), { raw: true });
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
    if (get(options, 'groupedLimit.on.through.model.options.paranoid')) {
      const throughModel = get(options, 'groupedLimit.on.through.model');
      if (throughModel) {
        options.groupedLimit.through = this._paranoidClause(
          throughModel,
          options.groupedLimit.through,
        );
      }
    }

    if (!model.options.timestamps || !model.options.paranoid || options.paranoid === false) {
      // This model is not paranoid, nothing to do here;
      return options;
    }

    const modelDefinition = model.modelDefinition;

    const deletedAtCol = modelDefinition.timestampAttributeNames.deletedAt;
    const deletedAtAttribute = modelDefinition.attributes.get(deletedAtCol);
    const deletedAtObject = Object.create(null);

    let deletedAtDefaultValue = deletedAtAttribute.defaultValue ?? null;

    deletedAtDefaultValue ||= {
      [Op.eq]: null,
    };

    deletedAtObject[deletedAtAttribute.field || deletedAtCol] = deletedAtDefaultValue;

    if (isWhereEmpty(options.where)) {
      options.where = deletedAtObject;
    } else {
      options.where = { [Op.and]: [deletedAtObject, options.where] };
    }

    return options;
  }

  /**
   * Returns the attributes of the model.
   *
   * @returns {object|any}
   */
  static getAttributes() {
    return getObjectFromMap(this.modelDefinition.attributes);
  }

  get validators() {
    throw new Error(
      'Model#validators has been removed. Use the validators option on Model.modelDefinition.attributes instead.',
    );
  }

  static get _schema() {
    throw new Error('Model._schema has been removed. Use Model.modelDefinition instead.');
  }

  static get _schemaDelimiter() {
    throw new Error('Model._schemaDelimiter has been removed. Use Model.modelDefinition instead.');
  }

  static _getAssociationDebugList() {
    return `The following associations are defined on "${this.name}": ${Object.keys(
      this.associations,
    )
      .map(associationName => `"${associationName}"`)
      .join(', ')}`;
  }

  static getAssociation(associationName) {
    if (!Object.hasOwn(this.associations, associationName)) {
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
    options.include = options.include.map(include =>
      this._conformInclude(include, associationOwner),
    );
  }

  static _conformInclude(include, associationOwner) {
    if (!include) {
      throwInvalidInclude(include);
    }

    if (!associationOwner || !isModelStatic(associationOwner)) {
      throw new TypeError(
        `Sequelize sanity check: associationOwner must be a model subclass. Got ${NodeUtil.inspect(associationOwner)} (${typeof associationOwner})`,
      );
    }

    if (include._pseudo) {
      return include;
    }

    if (include.all) {
      this._conformIncludes(include, associationOwner);

      return include;
    }

    // normalize to IncludeOptions
    if (!isPlainObject(include)) {
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
      throw new TypeError(
        `Invalid Include received: the specified "model" option ("${include.model.name}") does not match the target ("${include.association.target.name}") of the "${include.association.as}" association.`,
      );
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
      throw new Error(
        '"include: { all: true }" does not allow extra options (except for "nested") because they are unsafe. Select includes one by one if you want to specify more options.',
      );
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
          throw new SequelizeErrors.EagerLoadingError(
            `include all '${type}' is not valid - must be BelongsTo, HasOne, HasMany, One, Has, Many or All`,
          );
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
      forEach(parent.associations, association => {
        if (all !== true && !all.includes(association.associationType)) {
          return;
        }

        // 'fromSourceToThroughOne' is a bit hacky and should not be included when { all: true } is specified
        //  because its parent 'belongsToMany' will be replaced by it in query generator.
        if (
          association.parentAssociation instanceof BelongsToManyAssociation &&
          association === association.parentAssociation.fromSourceToThroughOne
        ) {
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
    tableNames[include.model.table] = true;

    if (include.attributes && !options.raw) {
      include.model._expandAttributes(include);

      include.originalAttributes = include.model._injectDependentVirtualAttributes(
        include.attributes,
      );

      include = mapFinderOptions(include, include.model);

      if (include.attributes.length > 0) {
        each(include.model.primaryKeys, (attr, key) => {
          // Include the primary key if it's not already included - take into account that the pk might be aliased (due to a .field prop)
          if (
            !include.attributes.some(includeAttr => {
              if (attr.field !== key) {
                return (
                  Array.isArray(includeAttr) &&
                  includeAttr[0] === attr.field &&
                  includeAttr[1] === key
                );
              }

              return includeAttr === key;
            })
          ) {
            include.attributes.unshift(key);
          }
        });
      }
    } else {
      include = mapFinderOptions(include, include.model);
    }

    // pseudo include just needed the attribute logic, return
    if (include._pseudo) {
      if (!include.attributes) {
        include.attributes = Object.keys(include.model.tableAttributes);
      }

      return mapFinderOptions(include, include.model);
    }

    // check if the current Model is actually associated with the passed Model - or it's a pseudo include
    const association =
      include.association || this.getAssociationWithModel(include.model, include.as);

    include.association = association;
    include.as ||= association.as;

    // If through, we create a pseudo child include, to ease our parsing later on
    if (association instanceof BelongsToManyAssociation) {
      if (!include.include) {
        include.include = [];
      }

      const through = include.association.through;

      include.through = defaultsLodash(include.through || {}, {
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
        include.through.where = include.through.where
          ? { [Op.and]: [include.through.where, through.scope] }
          : through.scope;
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
      model =
        include.association.target.name === include.model.name
          ? include.association.target
          : include.association.source;
    }

    model._injectScope(include);

    // This check should happen after injecting the scope, since the scope may contain a .attributes
    if (!include.attributes) {
      include.attributes = Object.keys(include.model.tableAttributes);
    }

    include = mapFinderOptions(include, include.model);

    if (include.required === undefined) {
      include.required = Boolean(include.where);
    }

    if (include.association.scope) {
      include.where = include.where
        ? { [Op.and]: [include.where, include.association.scope] }
        : include.association.scope;
    }

    if (include.limit && include.separate === undefined) {
      include.separate = true;
    }

    if (include.separate === true) {
      if (!(include.association instanceof HasManyAssociation)) {
        throw new TypeError('Only HasMany associations support include.separate');
      }

      include.duplicating = false;

      if (
        options.attributes &&
        options.attributes.length > 0 &&
        !flattenDepth(options.attributes, 2).includes(association.sourceKey)
      ) {
        options.attributes.push(association.sourceKey);
      }

      if (
        include.attributes &&
        include.attributes.length > 0 &&
        !flattenDepth(include.attributes, 2).includes(association.foreignKey)
      ) {
        include.attributes.push(association.foreignKey);
      }
    }

    // Validate child includes
    if (Object.hasOwn(include, 'include')) {
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

  static _baseMerge(...args) {
    assignWith(...args);

    return args[0];
  }

  static _mergeFunction(objValue, srcValue, key) {
    if (key === 'include') {
      return combineIncludes(objValue, srcValue);
    }

    if (Array.isArray(objValue) && Array.isArray(srcValue)) {
      return union(objValue, srcValue);
    }

    if (['where', 'having'].includes(key)) {
      return combineWheresWithAnd(objValue, srcValue);
    } else if (key === 'attributes' && isPlainObject(objValue) && isPlainObject(srcValue)) {
      return assignWith(objValue, srcValue, (objValue, srcValue) => {
        if (Array.isArray(objValue) && Array.isArray(srcValue)) {
          return union(objValue, srcValue);
        }
      });
    }

    // If we have a possible object/array to clone, we try it.
    // Otherwise, we return the original value when it's not undefined,
    // or the resulting object in that case.
    if (srcValue) {
      return cloneDeep(srcValue, true);
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
   * Remove attribute from model definition.
   * Only use if you know what you're doing.
   *
   * @param {string} attribute name of attribute to remove
   */
  static removeAttribute(attribute) {
    delete this.modelDefinition.rawAttributes[attribute];
    this.modelDefinition.refreshAttributes();
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
    const rawAttributes = this.modelDefinition.rawAttributes;

    mergeDefaults(rawAttributes, newAttributes);

    this.modelDefinition.refreshAttributes();

    return rawAttributes;
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

    const modelDefinition = this.modelDefinition;
    const physicalAttributes = getObjectFromMap(modelDefinition.physicalAttributes);
    const columnDefs = getObjectFromMap(modelDefinition.columns);

    if (options.hooks) {
      await this.hooks.runAsync('beforeSync', options);
    }

    const tableName = { ...this.table };
    if (options.schema && options.schema !== tableName.schema) {
      // Some users sync the same set of tables in different schemas for various reasons
      // They then set `searchPath` when running a query to use different schemas.
      // See https://github.com/sequelize/sequelize/pull/15274#discussion_r1020770364
      // We only allow this if the tables are in the default schema, because we need to ensure that
      // all tables are in the same schema to prevent collisions and `searchPath` only works if we don't specify the schema
      // (which we don't for the default schema)
      if (tableName.schema !== this.sequelize.dialect.getDefaultSchema()) {
        throw new Error(
          `The "schema" option in sync can only be used on models that do not already specify a schema, or that are using the default schema. Model ${this.name} already specifies schema ${tableName.schema}`,
        );
      }

      tableName.schema = options.schema;
    }

    delete options.schema;

    let tableExists;
    if (options.force) {
      await this.drop({
        ...options,
        cascade: this.sequelize.dialect.supports.dropTable.cascade || undefined,
      });
      tableExists = false;
    } else {
      tableExists = await this.queryInterface.tableExists(tableName, options);
    }

    if (!tableExists) {
      await this.queryInterface.createTable(tableName, physicalAttributes, options, this);
    } else {
      // enums are always updated, even if alter is not set. createTable calls it too.
      await this.queryInterface.ensureEnums(tableName, physicalAttributes, options, this);
    }

    if (tableExists && options.alter) {
      const tableInfos = await Promise.all([
        this.queryInterface.describeTable(tableName, options),
        this.queryInterface.showConstraints(tableName, {
          ...options,
          constraintType: 'FOREIGN KEY',
        }),
      ]);

      const columns = tableInfos[0];
      // Use for alter foreign keys
      const foreignKeyReferences = tableInfos[1];
      const removedConstraints = {};

      for (const columnName in physicalAttributes) {
        if (!Object.hasOwn(physicalAttributes, columnName)) {
          continue;
        }

        if (!columns[columnName] && !columns[physicalAttributes[columnName].field]) {
          await this.queryInterface.addColumn(
            tableName,
            physicalAttributes[columnName].field || columnName,
            physicalAttributes[columnName],
            options,
          );
        }
      }

      if (
        options.alter === true ||
        (typeof options.alter === 'object' && options.alter.drop !== false)
      ) {
        for (const columnName in columns) {
          if (!Object.hasOwn(columns, columnName)) {
            continue;
          }

          const currentAttribute = columnDefs[columnName];
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
            const schema = tableName.schema;
            const database = this.sequelize.options.replication.write.database;
            const foreignReferenceSchema = currentAttribute.references.table.schema;
            const foreignReferenceTableName =
              typeof references.table === 'object' ? references.table.tableName : references.table;
            // Find existed foreign keys
            for (const foreignKeyReference of foreignKeyReferences) {
              const constraintName = foreignKeyReference.constraintName;
              if (
                (constraintName &&
                  (foreignKeyReference.tableCatalog
                    ? foreignKeyReference.tableCatalog === database
                    : true) &&
                  (schema ? foreignKeyReference.tableSchema === schema : true) &&
                  foreignKeyReference.referencedTableName === foreignReferenceTableName &&
                  foreignKeyReference.referencedColumnNames.includes(references.key) &&
                  (foreignReferenceSchema
                    ? foreignKeyReference.referencedTableSchema === foreignReferenceSchema
                    : true) &&
                  !removedConstraints[constraintName]) ||
                this.sequelize.dialect.name === 'ibmi'
              ) {
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
        if (this.sequelize.dialect.name === 'postgres') {
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
      // TODO: 'options' is ignored by addIndex, making Add Index queries impossible to log.
      await this.queryInterface.addIndex(tableName, index, options);
    }

    if (options.hooks) {
      await this.hooks.runAsync('afterSync', options);
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
    return await this.queryInterface.dropTable(this, options);
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
      throw new TypeError(
        'Unlike Model.schema, Model.withSchema only accepts 1 argument which may be either a string or an option bag.',
      );
    }

    const schemaOptions = typeof schema === 'string' || schema === null ? { schema } : schema;

    schemaOptions.schema ||=
      this.sequelize.options.schema || this.sequelize.dialect.getDefaultSchema();

    return this.getInitialModel()._withScopeAndSchema(schemaOptions, this._scope, this._scopeNames);
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
      throw new Error(
        `Model.addScope can only be called on the initial model. Use "${this.name}.getInitialModel()" to access the initial model.`,
      );
    }

    options = { override: false, ...options };

    if (
      ((name === 'defaultScope' && Object.keys(this.options.defaultScope).length > 0) ||
        name in this.options.scopes) &&
      options.override === false
    ) {
      throw new Error(
        `The scope ${name} already exists. Pass { override: true } as options to silence this error`,
      );
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
   * @example To invoke scope functions you can do
   * ```ts
   * Model.withScope({ method: ['complexFunction', 'dan@sequelize.com', 42]}).findAll()
   * // WHERE email like 'dan@sequelize.com%' AND access_level >= 42
   * ```
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

      if (isPlainObject(option)) {
        if (option.method) {
          if (
            Array.isArray(option.method) &&
            Boolean(initialModel.options.scopes[option.method[0]])
          ) {
            scopeName = option.method[0];
            scope = initialModel.options.scopes[scopeName].apply(
              initialModel,
              option.method.slice(1),
            );
          } else if (initialModel.options.scopes[option.method]) {
            scopeName = option.method;
            scope = initialModel.options.scopes[scopeName].apply(initialModel);
          }
        } else {
          scope = option;
        }
      } else if (option === 'defaultScope' && isPlainObject(initialModel.options.defaultScope)) {
        scope = initialModel.options.defaultScope;
      } else {
        scopeName = option;
        scope = initialModel.options.scopes[scopeName];
        if (typeof scope === 'function') {
          scope = scope();
        }
      }

      if (!scope) {
        throw new SequelizeErrors.SequelizeScopeError(
          `"${this.name}.withScope()" has been called with an invalid scope: "${scopeName}" does not exist.`,
        );
      }

      this._conformIncludes(scope, this);
      // clone scope so it doesn't get modified
      this._assignOptions(mergedScope, cloneDeep(scope) ?? {});
      scopeNames.push(scopeName ? scopeName : 'defaultScope');
    }

    const modelDefinition = this.modelDefinition;

    return initialModel._withScopeAndSchema(
      {
        schema: modelDefinition.table.schema || '',
        schemaDelimiter: modelDefinition.table.delimiter || '',
      },
      mergedScope,
      scopeNames,
    );
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

    const modelDefinition = this.modelDefinition;
    const initialModelDefinition = initialModel.modelDefinition;

    if (
      modelDefinition.table.schema !== initialModelDefinition.table.schema ||
      modelDefinition.table.delimiter !== initialModelDefinition.table.delimiter
    ) {
      return initialModel.withSchema({
        schema: modelDefinition.table.schema,
        schemaDelimiter: modelDefinition.table.delimiter,
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

    const newTable = this.queryGenerator.extractTableDetails({
      tableName: this.modelDefinition.table.tableName,
      schema: schemaOptions.schema,
      delimiter: schemaOptions.delimiter,
    });

    for (const modelVariantRef of this._modelVariantRefs) {
      const modelVariant = modelVariantRef.deref();

      if (!modelVariant) {
        this._modelVariantRefs.delete(modelVariantRef);
        continue;
      }

      const variantTable = modelVariant.table;

      if (variantTable.schema !== newTable.schema) {
        continue;
      }

      if (variantTable.delimiter !== newTable.delimiter) {
        continue;
      }

      // the item order of these arrays is important! scope('a', 'b') is not equal to scope('b', 'a')
      if (!isEqual(modelVariant._scopeNames, scopeNames)) {
        continue;
      }

      if (!isEqual(modelVariant._scope, mergedScope)) {
        continue;
      }

      return modelVariant;
    }

    const clone = this._createModelVariant({
      schema: schemaOptions.schema,
      schemaDelimiter: schemaOptions.schemaDelimiter,
    });
    // eslint-disable-next-line no-undef -- eslint doesn't know about WeakRef, this will be resolved once we migrate to TS.
    this._modelVariantRefs.add(new WeakRef(clone));

    clone._scope = mergedScope;
    clone._scopeNames = scopeNames;

    if (scopeNames.length !== 1 || scopeNames[0] !== 'defaultScope') {
      clone.scoped = true;
    }

    return clone;
  }

  static _createModelVariant(optionOverrides) {
    const model = class extends this {};
    model._initialModel = this;
    Object.defineProperty(model, 'name', { value: this.name });

    model.init(this.modelDefinition.rawAttributes, {
      ...this.options,
      ...optionOverrides,
    });

    // This is done for legacy reasons, where in a previous design both models shared the same association objects.
    // TODO: re-create the associations on the new model instead of sharing them.
    Object.assign(model.modelDefinition.associations, this.modelDefinition.associations);

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
    if (options !== undefined && !isPlainObject(options)) {
      throw new SequelizeErrors.QueryError(
        'The argument passed to findAll must be an options object, use findByPk if you wish to pass a single primary key value',
      );
    }

    if (
      options !== undefined &&
      options.attributes &&
      !Array.isArray(options.attributes) &&
      !isPlainObject(options.attributes)
    ) {
      throw new SequelizeErrors.QueryError(
        'The attributes option must be an array of column names or an object',
      );
    }

    const modelDefinition = this.modelDefinition;

    this._warnOnInvalidOptions(options, Object.keys(modelDefinition.attributes));

    const tableNames = {};

    tableNames[this.table] = true;
    options = cloneDeep(options) ?? {};

    setTransactionFromCls(options, this.sequelize);

    defaultsLodash(options, { hooks: true, model: this });

    // set rejectOnEmpty option, defaults to model options
    options.rejectOnEmpty = Object.hasOwn(options, 'rejectOnEmpty')
      ? options.rejectOnEmpty
      : this.options.rejectOnEmpty;

    this._conformIncludes(options, this);
    this._injectScope(options);

    if (options.hooks) {
      await this.hooks.runAsync('beforeFind', options);
      this._conformIncludes(options, this);
    }

    this._expandAttributes(options);
    this._expandIncludeAll(options, options.model);

    if (options.hooks) {
      await this.hooks.runAsync('beforeFindAfterExpandIncludeAll', options);
    }

    options.originalAttributes = this._injectDependentVirtualAttributes(options.attributes);

    if (options.include) {
      options.hasJoin = true;

      _validateIncludedElements(options, tableNames);

      // If we're not raw, we have to make sure we include the primary key for de-duplication
      if (
        options.attributes &&
        !options.raw &&
        this.primaryKeyAttribute &&
        !options.attributes.includes(this.primaryKeyAttribute) &&
        (!options.group || !options.hasSingleAssociation || options.hasMultiAssociation)
      ) {
        options.attributes = [this.primaryKeyAttribute].concat(options.attributes);
      }
    }

    if (!options.attributes) {
      options.attributes = Array.from(modelDefinition.attributes.keys());
      options.originalAttributes = this._injectDependentVirtualAttributes(options.attributes);
    }

    mapFinderOptions(options, this);

    options = this._paranoidClause(this, options);

    if (options.hooks) {
      await this.hooks.runAsync('beforeFindAfterOptions', options);
    }

    const selectOptions = { ...options, tableNames: Object.keys(tableNames) };
    const results = await this.queryInterface.select(this, this.table, selectOptions);
    if (options.hooks) {
      await this.hooks.runAsync('afterFind', results, options);
    }

    // rejectOnEmpty mode
    if (isEmpty(results) && options.rejectOnEmpty) {
      if (typeof options.rejectOnEmpty === 'function') {
        throw new options.rejectOnEmpty();
      }

      if (typeof options.rejectOnEmpty === 'object') {
        throw options.rejectOnEmpty;
      }

      throw new SequelizeErrors.EmptyResultError();
    }

    return await Model._findSeparate(results, options);
  }

  static _warnOnInvalidOptions(options, validColumnNames) {
    if (!isPlainObject(options)) {
      return;
    }

    const unrecognizedOptions = Object.keys(options).filter(k => !validQueryKeywords.has(k));
    const unexpectedModelAttributes = intersection(unrecognizedOptions, validColumnNames);
    if (!options.where && unexpectedModelAttributes.length > 0) {
      logger.warn(
        `Model attributes (${unexpectedModelAttributes.join(', ')}) passed into finder method options of model ${this.name}, but the options.where object is empty. Did you forget to use options.where?`,
      );
    }
  }

  static _injectDependentVirtualAttributes(attributes) {
    const modelDefinition = this.modelDefinition;

    if (modelDefinition.virtualAttributeNames.size === 0) {
      return attributes;
    }

    if (!attributes || !Array.isArray(attributes)) {
      return attributes;
    }

    for (const attribute of attributes) {
      if (
        modelDefinition.virtualAttributeNames.has(attribute) &&
        modelDefinition.attributes.get(attribute).type.attributeDependencies
      ) {
        attributes = attributes.concat(
          modelDefinition.attributes.get(attribute).type.attributeDependencies,
        );
      }
    }

    attributes = uniq(attributes);

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

    await Promise.all(
      options.include.map(async include => {
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
              ...omit(
                options,
                'include',
                'attributes',
                'order',
                'where',
                'limit',
                'offset',
                'plain',
                'scope',
              ),
              include: include.include || [],
            },
          );
        }

        const map = await include.association.get(results, {
          ...omit(options, nonCascadingOptions),
          ...omit(include, ['parent', 'association', 'as', 'originalAttributes']),
        });

        for (const result of results) {
          result.set(include.association.as, map.get(result.get(include.association.sourceKey)), {
            raw: true,
          });
        }
      }),
    );

    return original;
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
    if (options !== undefined && !isPlainObject(options)) {
      throw new Error(
        'The argument passed to findOne must be an options object, use findByPk if you wish to pass a single primary key value',
      );
    }

    options = cloneDeep(options) ?? {};
    // findOne only ever needs one result
    // conditional temporarily fixes 14618
    // https://github.com/sequelize/sequelize/issues/14618
    if (options.limit === undefined) {
      options.limit = 1;
    }

    // Bypass a possible overloaded findAll.
    return await Model.findAll.call(
      this,
      defaultsLodash(options, {
        model: this,
        plain: true,
      }),
    );
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
    options = cloneDeep(options) ?? {};
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

    const attrOptions = this.getAttributes()[attribute];
    const field = (attrOptions && attrOptions.field) || attribute;
    let aggregateColumn = this.sequelize.col(field);

    if (options.distinct) {
      aggregateColumn = this.sequelize.fn('DISTINCT', aggregateColumn);
    }

    let { group } = options;
    if (Array.isArray(group) && Array.isArray(group[0])) {
      noDoubleNestedGroup();
      group = group.flat();
    }

    options.attributes = unionBy(
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

    mapOptionFieldNames(options, this);
    options = this._paranoidClause(this, options);

    const value = await this.queryInterface.rawSelect(this.table, options, aggregateFunction, this);

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
    options = cloneDeep(options) ?? {};
    options = defaultsLodash(options, { hooks: true });

    setTransactionFromCls(options, this.sequelize);

    options.raw = true;
    if (options.hooks) {
      await this.hooks.runAsync('beforeCount', options);
    }

    options.plain = !options.group;
    options.dataType = new DataTypes.INTEGER();
    options.includeIgnoreAttributes = false;

    // No limit, offset or order for the options max be given to count()
    // Set them to null to prevent scopes setting those values
    options.limit = null;
    options.offset = null;
    options.order = null;

    // counting grouped rows is not possible with `this.aggregate`
    // use a subquery to get the count
    if (options.group && options.countGroupedRows) {
      const query = removeTrailingSemicolon(this.queryGenerator.selectQuery(this.table, options));

      const queryCountAll = `Select COUNT(*) AS count FROM (${query}) AS Z`;

      const result = await this.sequelize.query(queryCountAll);

      const count = Number(result[0][0].count || result[0][0].COUNT);

      return count;
    }

    let col = options.col || '*';
    if (options.include) {
      col = `${this.name}.${options.col || this.primaryKeyField}`;
    }

    if (options.distinct && col === '*') {
      col = this.primaryKeyField;
    }

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
    if (options !== undefined && !isPlainObject(options)) {
      throw new Error(
        'The argument passed to findAndCountAll must be an options object, use findByPk if you wish to pass a single primary key value',
      );
    }

    const countOptions = cloneDeep(options) ?? {};

    if (countOptions.attributes && !options.countGroupedRows) {
      countOptions.attributes = undefined;
    }

    const [count, rows] = await Promise.all([this.count(countOptions), this.findAll(options)]);

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

    const instance = new this(values, options, CONSTRUCTOR_SECRET);

    // Our Model class adds getters and setters for attributes on the prototype,
    // so they can be shadowed by native class properties that are defined on the class that extends Model (See #14300).
    // This deletes the instance properties, to un-shadow the getters and setters.
    for (const attributeName of this.modelDefinition.attributes.keys()) {
      delete instance[attributeName];
    }

    // If there are associations in the instance, we assign them as properties on the instance
    // so that they can be accessed directly, instead of having to call `get` and `set`.
    // class properties re-assign them to whatever value was set on the class property (or undefined if none)
    // so this workaround re-assigns the association after the instance was created.
    for (const associationName of Object.keys(this.modelDefinition.associations)) {
      instance[associationName] = instance.getDataValue(associationName);
    }

    return instance;
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
      options.attributes = options.attributes.map(attribute => {
        return Array.isArray(attribute) ? attribute[1] : attribute;
      });
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
   */
  static async create(values, options) {
    options = cloneDeep(options) ?? {};

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
        'Missing where attribute in the options parameter passed to findOrBuild. ' +
          'Please note that the API has changed, and is now options only (an object with where, defaults keys, transaction etc.)',
      );
    }

    let values;

    let instance = await this.findOne(options);
    if (instance === null) {
      values = { ...options.defaults };
      if (isPlainObject(options.where)) {
        values = defaults(values, options.where);
      }

      instance = this.build(values, options);

      return [instance, true];
    }

    return [instance, false];
  }

  /**
   * Find an entity that matches the query, or {@link Model.create} the entity if none is found.
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
        'Missing where attribute in the options parameter passed to findOrCreate. ' +
          'Please note that the API has changed, and is now options only (an object with where, defaults keys, transaction etc.)',
      );
    }

    if (options.connection) {
      throw new Error(
        'findOrCreate does not support specifying which connection must be used, because findOrCreate must run in a transaction.',
      );
    }

    options = { ...options };

    const modelDefinition = this.modelDefinition;

    if (options.defaults) {
      const defaults = Object.keys(options.defaults);
      const unknownDefaults = defaults.filter(name => !modelDefinition.attributes.has(name));

      if (unknownDefaults.length > 0) {
        logger.warn(
          `Unknown attributes (${unknownDefaults}) passed to defaults option of findOrCreate`,
        );
      }
    }

    setTransactionFromCls(options, this.sequelize);

    const internalTransaction = !options.transaction;
    let values;
    let transaction;

    try {
      // TODO: use managed sequelize.transaction() instead
      transaction = await this.sequelize.startUnmanagedTransaction(options);
      options.transaction = transaction;

      const found = await this.findOne(options);
      if (found !== null) {
        return [found, false];
      }

      values = { ...options.defaults };
      if (isPlainObject(options.where)) {
        values = defaults(values, options.where);
      }

      options.exception = true;
      options.returning = true;

      try {
        const created = await this.create(values, options);
        if (created.get(this.primaryKeyAttribute, { raw: true }) === null) {
          // If the query returned an empty result for the primary key, we know that this was actually a unique constraint violation
          throw new SequelizeErrors.UniqueConstraintError();
        }

        return [created, true];
      } catch (error) {
        if (!(error instanceof SequelizeErrors.UniqueConstraintError)) {
          throw error;
        }

        const flattenedWhere = flattenObjectDeep(options.where);
        const flattenedWhereKeys = Object.keys(flattenedWhere).map(name => name.split('.').at(-1));
        const whereFields = flattenedWhereKeys.map(
          name => modelDefinition.attributes.get(name)?.columnName ?? name,
        );
        const defaultFields =
          options.defaults &&
          Object.keys(options.defaults)
            .filter(name => modelDefinition.attributes.get(name))
            .map(name => modelDefinition.getColumnNameLoose(name));

        const errFieldKeys = Object.keys(error.fields);
        const errFieldsWhereIntersects = intersects(errFieldKeys, whereFields);
        if (defaultFields && !errFieldsWhereIntersects && intersects(errFieldKeys, defaultFields)) {
          throw error;
        }

        if (errFieldsWhereIntersects) {
          each(error.fields, (value, key) => {
            const name = modelDefinition.columns.get(key).attributeName;
            if (value.toString() !== options.where[name].toString()) {
              throw new Error(
                `${this.name}#findOrCreate: value used for ${name} was not equal for both the find and the create calls, '${options.where[name]}' vs '${value}'`,
              );
            }
          });
        }

        // Someone must have created a matching instance inside the same transaction since we last did a find. Let's find it!
        const otherCreated = await this.findOne(
          defaults(
            {
              transaction: internalTransaction ? null : transaction,
            },
            options,
          ),
        );

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
      throw new Error('Missing where attribute in the options parameter passed to findCreateFind.');
    }

    let values = { ...options.defaults };
    if (isPlainObject(options.where)) {
      values = defaults(values, options.where);
    }

    const found = await this.findOne(options);
    if (found) {
      return [found, false];
    }

    try {
      const createOptions = { ...options };

      // To avoid breaking a postgres transaction, run the create with `ignoreDuplicates`.
      if (this.sequelize.dialect.name === 'postgres' && options.transaction) {
        createOptions.ignoreDuplicates = true;
      }

      const created = await this.create(values, createOptions);

      return [created, true];
    } catch (error) {
      if (
        !(
          error instanceof SequelizeErrors.UniqueConstraintError ||
          error instanceof SequelizeErrors.EmptyResultError
        )
      ) {
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
      ...cloneDeep(options),
    };

    setTransactionFromCls(options, this.sequelize);

    const modelDefinition = this.modelDefinition;

    const createdAtAttr = modelDefinition.timestampAttributeNames.createdAt;
    const updatedAtAttr = modelDefinition.timestampAttributeNames.updatedAt;
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

    // Map conflict fields to column names
    if (options.conflictFields) {
      options.conflictFields = options.conflictFields.map(attrName => {
        return modelDefinition.getColumnName(attrName);
      });
    }

    // Map field names
    const updatedDataValues = pick(instance.dataValues, changed);
    const insertValues = mapValueFieldNames(
      instance.dataValues,
      modelDefinition.attributes.keys(),
      this,
    );
    const updateValues = mapValueFieldNames(updatedDataValues, options.fields, this);
    const now = new Date();

    // Attach createdAt
    if (createdAtAttr && !insertValues[createdAtAttr]) {
      const field = modelDefinition.attributes.get(createdAtAttr).columnName || createdAtAttr;
      insertValues[field] = this._getDefaultTimestamp(createdAtAttr) || now;
    }

    if (updatedAtAttr && !updateValues[updatedAtAttr]) {
      const field = modelDefinition.attributes.get(updatedAtAttr).columnName || updatedAtAttr;
      insertValues[field] = updateValues[field] = this._getDefaultTimestamp(updatedAtAttr) || now;
    }

    // Db2 does not allow NULL values for unique columns.
    // Add dummy values if not provided by test case or user.
    if (this.sequelize.dialect.name === 'db2') {
      // TODO: remove. This is fishy and is going to be a source of bugs (because it replaces null values with arbitrary values that could be actual data).
      //  If DB2 doesn't support NULL in unique columns, then it should error if the user tries to insert NULL in one.
      this.uniqno = this.sequelize.dialect.queryGenerator.addUniqueFields(
        insertValues,
        this.modelDefinition.rawAttributes,
        this.uniqno,
      );
    }

    // Build adds a null value for the primary key, if none was given by the user.
    // We need to remove that because of some Postgres technicalities.
    if (
      !hasPrimary &&
      this.primaryKeyAttribute &&
      !modelDefinition.attributes.get(this.primaryKeyAttribute).defaultValue
    ) {
      delete insertValues[this.primaryKeyField];
      delete updateValues[this.primaryKeyField];
    }

    if (options.hooks) {
      await this.hooks.runAsync('beforeUpsert', values, options);
    }

    const result = await this.queryInterface.upsert(
      this.table,
      insertValues,
      updateValues,
      // TODO: this is only used by DB2 & MSSQL, as these dialects require a WHERE clause in their UPSERT implementation.
      //  but the user should be able to specify a WHERE clause themselves (because we can't perfectly include all UNIQUE constraints in our implementation)
      //  there is also some incoherence in our implementation: This "where" returns the Primary Key constraint, but all other unique constraints
      //  are added inside of QueryInterface. Everything should be done inside of QueryInterface instead.
      instance.where(false, true) ?? {},
      options,
    );

    const [record] = result;
    record.isNewRecord = false;

    if (options.hooks) {
      await this.hooks.runAsync('afterUpsert', result, options);
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

    const dialect = this.sequelize.dialect.name;
    const now = new Date();
    options = cloneDeep(options) ?? {};

    setTransactionFromCls(options, this.sequelize);

    options.model = this;

    if (!options.includeValidated) {
      this._conformIncludes(options, this);
      if (options.include) {
        this._expandIncludeAll(options);
        _validateIncludedElements(options);
      }
    }

    const instances = records.map(values =>
      this.build(values, { isNewRecord: true, include: options.include }),
    );

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

      if (
        options.updateOnDuplicate &&
        !['mysql', 'mariadb', 'sqlite3', 'postgres', 'ibmi'].includes(dialect)
      ) {
        throw new Error(`${dialect} does not support the updateOnDuplicate option.`);
      }

      const model = options.model;
      const modelDefinition = model.modelDefinition;

      options.fields = options.fields || Array.from(modelDefinition.attributes.keys());
      const createdAtAttr = modelDefinition.timestampAttributeNames.createdAt;
      const updatedAtAttr = modelDefinition.timestampAttributeNames.updatedAt;

      if (options.updateOnDuplicate !== undefined) {
        if (Array.isArray(options.updateOnDuplicate) && options.updateOnDuplicate.length > 0) {
          options.updateOnDuplicate = intersection(
            without(Object.keys(model.tableAttributes), createdAtAttr),
            options.updateOnDuplicate,
          );
        } else {
          throw new Error('updateOnDuplicate option only supports non-empty array.');
        }
      }

      // Run before hook
      if (options.hooks) {
        await model.hooks.runAsync('beforeBulkCreate', instances, options);
      }

      // Validate
      if (options.validate) {
        const errors = [];
        const validateOptions = { ...options };
        validateOptions.hooks = options.individualHooks;

        await Promise.all(
          instances.map(async instance => {
            try {
              await instance.validate(validateOptions);
            } catch (error) {
              errors.push(new SequelizeErrors.BulkRecordError(error, instance));
            }
          }),
        );

        delete options.skip;
        if (errors.length > 0) {
          throw new SequelizeErrors.AggregateError(errors);
        }
      }

      if (options.individualHooks) {
        await Promise.all(
          instances.map(async instance => {
            const individualOptions = {
              ...options,
              validate: false,
              hooks: true,
            };
            delete individualOptions.fields;
            delete individualOptions.individualHooks;
            delete individualOptions.ignoreDuplicates;

            await instance.save(individualOptions);
          }),
        );
      } else {
        if (options.include && options.include.length > 0) {
          await Promise.all(
            options.include
              .filter(include => include.association instanceof BelongsToAssociation)
              .map(async include => {
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

                const includeOptions = defaultsLodash(omit(cloneDeep(include), ['association']), {
                  connection: options.connection,
                  transaction: options.transaction,
                  logging: options.logging,
                });

                const createdAssociationInstances = await recursiveBulkCreate(
                  associationInstances,
                  includeOptions,
                );
                for (const idx in createdAssociationInstances) {
                  const associationInstance = createdAssociationInstances[idx];
                  const instance = associationInstanceIndexToInstanceMap[idx];

                  await include.association.set(instance, associationInstance, {
                    save: false,
                    logging: options.logging,
                  });
                }
              }),
          );
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

          const out = mapValueFieldNames(values, options.fields, model);
          for (const key of modelDefinition.virtualAttributeNames) {
            delete out[key];
          }

          return out;
        });

        // Map attributes to fields for serial identification
        const fieldMappedAttributes = Object.create(null);
        for (const attrName in model.tableAttributes) {
          const attribute = modelDefinition.attributes.get(attrName);
          fieldMappedAttributes[attribute.columnName] = attribute;
        }

        // Map updateOnDuplicate attributes to fields
        if (options.updateOnDuplicate) {
          options.updateOnDuplicate = options.updateOnDuplicate.map(attrName => {
            return modelDefinition.getColumnName(attrName);
          });

          if (options.conflictAttributes) {
            options.upsertKeys = options.conflictAttributes.map(attrName =>
              modelDefinition.getColumnName(attrName),
            );
          } else {
            const upsertKeys = [];

            for (const i of model.getIndexes()) {
              if (i.unique && !i.where) {
                // Don't infer partial indexes
                upsertKeys.push(...i.fields);
              }
            }

            options.upsertKeys =
              upsertKeys.length > 0
                ? upsertKeys
                : Object.values(model.primaryKeys).map(x => x.field);
          }
        }

        // Map returning attributes to fields
        if (options.returning && Array.isArray(options.returning)) {
          options.returning = options.returning.map(attr =>
            modelDefinition.getColumnNameLoose(attr),
          );
        }

        const results = await model.queryInterface.bulkInsert(
          model.table,
          records,
          options,
          fieldMappedAttributes,
        );
        if (Array.isArray(results)) {
          for (const [i, result] of results.entries()) {
            const instance = instances[i];

            for (const key in result) {
              if (!Object.hasOwn(result, key)) {
                continue;
              }

              if (
                !instance ||
                (key === model.primaryKeyAttribute &&
                  instance.get(model.primaryKeyAttribute) &&
                  ['mysql', 'mariadb'].includes(dialect))
              ) {
                // The query.js for these DBs is blind, it autoincrements the
                // primarykey value, even if it was set manually. Also, it can
                // return more results than instances, bug?.
                continue;
              }

              const value = result[key];
              const attr = find(
                modelDefinition.attributes.values(),
                attribute => attribute.attributeName === key || attribute.columnName === key,
              );
              const attributeName = attr?.attributeName || key;
              instance.dataValues[attributeName] =
                value != null && attr?.type instanceof AbstractDataType
                  ? attr.type.parseDatabaseValue(value)
                  : value;
              instance._previousDataValues[attributeName] = instance.dataValues[attributeName];
            }
          }
        }
      }

      if (options.include && options.include.length > 0) {
        await Promise.all(
          options.include
            .filter(
              include =>
                !(
                  include.association instanceof BelongsToAssociation ||
                  (include.parent && include.parent.association instanceof BelongsToManyAssociation)
                ),
            )
            .map(async include => {
              const associationInstances = [];
              const associationInstanceIndexToInstanceMap = [];

              for (const instance of instances) {
                let associated = instance.get(include.as);
                if (!Array.isArray(associated)) {
                  associated = [associated];
                }

                for (const associationInstance of associated) {
                  if (associationInstance) {
                    if (!(include.association instanceof BelongsToManyAssociation)) {
                      associationInstance.set(
                        include.association.foreignKey,
                        instance.get(
                          include.association.sourceKey || instance.constructor.primaryKeyAttribute,
                          { raw: true },
                        ),
                        { raw: true },
                      );
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

              const includeOptions = defaultsLodash(omit(cloneDeep(include), ['association']), {
                connection: options.connection,
                transaction: options.transaction,
                logging: options.logging,
              });

              const createdAssociationInstances = await recursiveBulkCreate(
                associationInstances,
                includeOptions,
              );
              if (include.association instanceof BelongsToManyAssociation) {
                const valueSets = [];

                for (const idx in createdAssociationInstances) {
                  const associationInstance = createdAssociationInstances[idx];
                  const instance = associationInstanceIndexToInstanceMap[idx];

                  const values = {
                    [include.association.foreignKey]: instance.get(
                      instance.constructor.primaryKeyAttribute,
                      { raw: true },
                    ),
                    [include.association.otherKey]: associationInstance.get(
                      associationInstance.constructor.primaryKeyAttribute,
                      { raw: true },
                    ),
                    // Include values defined in the association
                    ...include.association.through.scope,
                  };
                  if (associationInstance[include.association.through.model.name]) {
                    const throughDefinition = include.association.through.model.modelDefinition;

                    for (const attributeName of throughDefinition.attributes.keys()) {
                      const attribute = throughDefinition.attributes.get(attributeName);

                      if (
                        attribute._autoGenerated ||
                        attributeName === include.association.foreignKey ||
                        attributeName === include.association.otherKey ||
                        typeof associationInstance[include.association.through.model.name][
                          attributeName
                        ] === 'undefined'
                      ) {
                        continue;
                      }

                      values[attributeName] =
                        associationInstance[include.association.through.model.name][attributeName];
                    }
                  }

                  valueSets.push(values);
                }

                const throughOptions = defaultsLodash(
                  omit(cloneDeep(include), ['association', 'attributes']),
                  {
                    connection: options.connection,
                    transaction: options.transaction,
                    logging: options.logging,
                  },
                );
                throughOptions.model = include.association.throughModel;
                const throughInstances = include.association.throughModel.bulkBuild(
                  valueSets,
                  throughOptions,
                );

                await recursiveBulkCreate(throughInstances, throughOptions);
              }
            }),
        );
      }

      // map fields back to attributes
      for (const instance of instances) {
        const attributeDefs = modelDefinition.attributes;

        for (const attribute of attributeDefs.values()) {
          if (
            instance.dataValues[attribute.columnName] !== undefined &&
            attribute.columnName !== attribute.attributeName
          ) {
            instance.dataValues[attribute.attributeName] =
              instance.dataValues[attribute.columnName];
            // TODO: if a column shares the same name as an attribute, this will cause a bug!
            delete instance.dataValues[attribute.columnName];
          }

          instance._previousDataValues[attribute.attributeName] =
            instance.dataValues[attribute.attributeName];
          instance.changed(attribute.attributeName, false);
        }

        instance.isNewRecord = false;
      }

      // Run after hook
      if (options.hooks) {
        await model.hooks.runAsync('afterBulkCreate', instances, options);
      }

      return instances;
    };

    return await recursiveBulkCreate(instances, options);
  }

  /**
   * Truncates the table associated with the model.
   *
   * __Danger__: This will completely empty your table!
   *
   * @param {object} [options] truncate options
   * @returns {Promise}
   */
  static async truncate(options) {
    await this.queryInterface.truncate(this, options);
  }

  /**
   * Deletes multiple instances, or set their deletedAt timestamp to the current time if `paranoid` is enabled.
   *
   * @param  {object} options destroy options
   * @returns {Promise<number>} The number of destroyed rows
   */
  // TODO: add _UNSTABLE_bulkDestroy, aimed to be a replacement,
  //  which does the same thing but uses `noHooks` instead of `hooks` and `hardDelete` instead of `force`,
  //  and does not accept `individualHooks`
  static async destroy(options) {
    options = cloneDeep(options) ?? {};

    setTransactionFromCls(options, this.sequelize);

    this._injectScope(options);

    if (options && 'truncate' in options) {
      throw new Error(
        'Model#destroy does not support the truncate option. Use Model#truncate instead.',
      );
    }

    if (!options?.where) {
      throw new Error(
        'As a safeguard, the "destroy" static model method requires explicitly specifying a "where" option. If you actually mean to delete all rows in the table, set the option to a dummy condition such as sql`1 = 1`.',
      );
    }

    const modelDefinition = this.modelDefinition;
    const attributes = modelDefinition.attributes;

    options = defaultsLodash(options, {
      hooks: true,
      individualHooks: false,
      force: false,
    });

    mapOptionFieldNames(options, this);
    options.model = this;

    // Run before hook
    if (options.hooks) {
      await this.hooks.runAsync('beforeBulkDestroy', options);
    }

    let instances;
    // Get daos and run beforeDestroy hook on each record individually
    if (options.individualHooks) {
      instances = await this.findAll({
        where: options.where,
        connection: options.connection,
        transaction: options.transaction,
        logging: options.logging,
        benchmark: options.benchmark,
      });

      await Promise.all(
        instances.map(instance => {
          return this.hooks.runAsync('beforeDestroy', instance, options);
        }),
      );
    }

    let result;
    // TODO: rename force -> paranoid: false, as that's how it's called in the instance version
    // Run delete query (or update if paranoid)
    if (modelDefinition.timestampAttributeNames.deletedAt && !options.force) {
      // Set query type appropriately when running soft delete
      options.type = QueryTypes.BULKUPDATE;

      const attrValueHash = {};
      const deletedAtAttribute = attributes.get(modelDefinition.timestampAttributeNames.deletedAt);
      const deletedAtColumnName = deletedAtAttribute.columnName;

      // FIXME: where must be joined with AND instead of using Object.assign. This won't work with literals!
      const where = {
        [deletedAtColumnName]: Object.hasOwn(deletedAtAttribute, 'defaultValue')
          ? deletedAtAttribute.defaultValue
          : null,
      };

      attrValueHash[deletedAtColumnName] = new Date();
      result = await this.queryInterface.bulkUpdate(
        this.table,
        attrValueHash,
        Object.assign(where, options.where),
        options,
        getObjectFromMap(modelDefinition.attributes),
      );
    } else {
      result = await this.queryInterface.bulkDelete(this, options);
    }

    // Run afterDestroy hook on each record individually
    if (options.individualHooks) {
      await Promise.all(
        instances.map(instance => {
          return this.hooks.runAsync('afterDestroy', instance, options);
        }),
      );
    }

    // Run after hook
    if (options.hooks) {
      await this.hooks.runAsync('afterBulkDestroy', options);
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
    const modelDefinition = this.modelDefinition;

    if (!modelDefinition.timestampAttributeNames.deletedAt) {
      throw new Error('Model is not paranoid');
    }

    options = {
      hooks: true,
      individualHooks: false,
      ...options,
    };

    setTransactionFromCls(options, this.sequelize);

    options.type = QueryTypes.RAW;
    options.model = this;

    mapOptionFieldNames(options, this);

    // Run before hook
    if (options.hooks) {
      await this.hooks.runAsync('beforeBulkRestore', options);
    }

    let instances;
    // Get daos and run beforeRestore hook on each record individually
    if (options.individualHooks) {
      instances = await this.findAll({
        where: options.where,
        connection: options.connection,
        transaction: options.transaction,
        logging: options.logging,
        benchmark: options.benchmark,
        paranoid: false,
      });

      await Promise.all(
        instances.map(instance => {
          return this.hooks.runAsync('beforeRestore', instance, options);
        }),
      );
    }

    // Run undelete query
    const attrValueHash = {};
    const deletedAtAttributeName = modelDefinition.timestampAttributeNames.deletedAt;
    const deletedAtAttribute = modelDefinition.attributes.get(deletedAtAttributeName);
    const deletedAtDefaultValue = deletedAtAttribute.defaultValue ?? null;

    attrValueHash[deletedAtAttribute.columnName || deletedAtAttributeName] = deletedAtDefaultValue;
    options.omitNull = false;
    const result = await this.queryInterface.bulkUpdate(
      this.table,
      attrValueHash,
      options.where,
      options,
      getObjectFromMap(modelDefinition.attributes),
    );
    // Run afterDestroy hook on each record individually
    if (options.individualHooks) {
      await Promise.all(
        instances.map(instance => {
          return this.hooks.runAsync('afterRestore', instance, options);
        }),
      );
    }

    // Run after hook
    if (options.hooks) {
      await this.hooks.runAsync('afterBulkRestore', options);
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
    options = cloneDeep(options) ?? {};

    setTransactionFromCls(options, this.sequelize);

    this._injectScope(options);
    this._optionsMustContainWhere(options);

    const modelDefinition = this.modelDefinition;

    options = this._paranoidClause(
      this,
      defaultsLodash(options, {
        validate: true,
        hooks: true,
        individualHooks: false,
        returning: false,
        force: false,
        sideEffects: true,
      }),
    );

    options.type = QueryTypes.BULKUPDATE;

    // Clone values so it doesn't get modified for caller scope and ignore undefined values
    values = omitBy(values, value => value === undefined);

    const updatedAtAttrName = modelDefinition.timestampAttributeNames.updatedAt;

    // Remove values that are not in the options.fields
    if (options.fields && Array.isArray(options.fields)) {
      for (const key of Object.keys(values)) {
        if (!options.fields.includes(key)) {
          delete values[key];
        }
      }
    } else {
      options.fields = intersection(
        Object.keys(values),
        Array.from(modelDefinition.physicalAttributes.keys()),
      );
      if (updatedAtAttrName && !options.fields.includes(updatedAtAttrName)) {
        options.fields.push(updatedAtAttrName);
      }
    }

    if (updatedAtAttrName && !options.silent) {
      values[updatedAtAttrName] = this._getDefaultTimestamp(updatedAtAttrName) || new Date();
    }

    options.model = this;

    let valuesUse;
    // Validate
    if (options.validate) {
      const build = this.build(values);
      build.set(updatedAtAttrName, values[updatedAtAttrName], { raw: true });

      if (options.sideEffects) {
        Object.assign(values, pick(build.get(), build.changed()));
        options.fields = union(options.fields, Object.keys(values));
      }

      // TODO: instead of setting "skip", set the "fields" property on a copy of options that's passed to "validate"
      // We want to skip validations for all other fields
      options.skip = difference(Array.from(modelDefinition.attributes.keys()), Object.keys(values));
      const attributes = await build.validate(options);
      options.skip = undefined;
      if (attributes && attributes.dataValues) {
        values = pick(attributes.dataValues, Object.keys(values));
      }
    }

    // Run before hook
    if (options.hooks) {
      options.attributes = values;
      await this.hooks.runAsync('beforeBulkUpdate', options);
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
        connection: options.connection,
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

        instances = await Promise.all(
          instances.map(async instance => {
            // Record updates in instances dataValues
            Object.assign(instance.dataValues, values);
            // Set the changed fields on the instance
            forIn(valuesUse, (newValue, attr) => {
              if (newValue !== instance._previousDataValues[attr]) {
                instance.setDataValue(attr, newValue);
              }
            });

            // Run beforeUpdate hook
            await this.hooks.runAsync('beforeUpdate', instance, options);
            await this.hooks.runAsync('beforeSave', instance, options);
            if (!different) {
              const thisChangedValues = {};
              forIn(instance.dataValues, (newValue, attr) => {
                if (newValue !== instance._previousDataValues[attr]) {
                  thisChangedValues[attr] = newValue;
                }
              });

              if (!changedValues) {
                changedValues = thisChangedValues;
              } else {
                different = !isEqual(changedValues, thisChangedValues);
              }
            }

            return instance;
          }),
        );

        if (!different) {
          const keys = Object.keys(changedValues);
          // Hooks do not change values or change them uniformly
          if (keys.length > 0) {
            // Hooks change values - record changes in valuesUse so they are executed
            valuesUse = changedValues;
            options.fields = union(options.fields, keys);
          }
        } else {
          instances = await Promise.all(
            instances.map(async instance => {
              const individualOptions = {
                ...options,
                hooks: false,
                validate: false,
              };
              delete individualOptions.individualHooks;

              return instance.save(individualOptions);
            }),
          );
          updateDoneRowByRow = true;
        }
      }
    }

    let result;
    if (updateDoneRowByRow) {
      result = [instances.length, instances];
    } else if (
      isEmpty(valuesUse) ||
      (Object.keys(valuesUse).length === 1 && valuesUse[updatedAtAttrName])
    ) {
      // only updatedAt is being passed, then skip update
      result = [0];
    } else {
      valuesUse = mapValueFieldNames(valuesUse, options.fields, this);
      options = mapOptionFieldNames(options, this);
      options.hasTrigger = this.options ? this.options.hasTrigger : false;

      const affectedRows = await this.queryInterface.bulkUpdate(
        this.table,
        valuesUse,
        options.where,
        options,
        getObjectFromMap(this.modelDefinition.physicalAttributes),
      );
      if (options.returning) {
        result = [affectedRows.length, affectedRows];
        instances = affectedRows;
      } else {
        result = [affectedRows];
      }
    }

    if (options.individualHooks) {
      await Promise.all(
        instances.map(async instance => {
          await this.hooks.runAsync('afterUpdate', instance, options);
          await this.hooks.runAsync('afterSave', instance, options);
        }),
      );
      result[1] = instances;
    }

    // Run after hook
    if (options.hooks) {
      options.attributes = values;
      await this.hooks.runAsync('afterBulkUpdate', options);
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
  // TODO: move "schema" to options
  static async describe(schema, options) {
    const table = this.modelDefinition.table;

    return await this.queryInterface.describeTable(
      { ...table, schema: schema || table.schema },
      options,
    );
  }

  static _getDefaultTimestamp(attributeName) {
    const attributes = this.modelDefinition.attributes;

    const attribute = attributes.get(attributeName);
    if (attribute?.defaultValue) {
      return toDefaultValue(attribute.defaultValue);
    }
  }

  static _expandAttributes(options) {
    if (!isPlainObject(options.attributes)) {
      return;
    }

    let attributes = Array.from(this.modelDefinition.attributes.keys());

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
    const scope = cloneDeep(this._scope) ?? {};
    this._normalizeIncludes(scope, this);
    this._defaultsOptions(options, scope);
  }

  static [Symbol.for('nodejs.util.inspect.custom')]() {
    return this.name;
  }

  static hasAlias(alias) {
    return Object.hasOwn(this.associations, alias);
  }

  static getAssociations(target) {
    return Object.values(this.associations).filter(
      association => association.target.name === target.name,
    );
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
      throw new SequelizeErrors.EagerLoadingError(
        `Invalid Include received: no associations exist between "${this.name}" and "${targetModel.name}"`,
      );
    }

    if (matchingAssociations.length > 1) {
      throw new SequelizeErrors.EagerLoadingError(
        `
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
`.trim(),
      );
    }

    return matchingAssociations[0];
  }

  /**
   * Increments the value of one or more attributes.
   *
   * The increment is done using a `SET column = column + X WHERE foo = 'bar'` query.
   *
   * @example increment number by 1
   * ```ts
   * Model.increment('number', { where: { foo: 'bar' });
   * ```
   *
   * @example increment number and count by 2
   * ```ts
   * Model.increment(['number', 'count'], { by: 2, where: { foo: 'bar' } });
   * ```
   *
   * @example increment answer by 42, and decrement tries by 1
   * ```ts
   * // `by` cannot be used, as each attribute specifies its own value
   * Model.increment({ answer: 42, tries: -1}, { where: { foo: 'bar' } });
   * ```
   *
   * @param  {string|Array|object} fields If a string is provided, that column is incremented by the
   *   value of `by` given in options. If an array is provided, the same is true for each column.
   *   If an object is provided, each key is incremented by the corresponding value, `by` is ignored.
   * @param  {object} options increment options
   * @param  {object} options.where conditions hash
   *
   * @returns {Promise<Model[],?number>} an array of affected rows and affected count with `options.returning` true,
   *   whenever supported by dialect
   */
  static async increment(fields, options) {
    options ||= {};
    if (typeof fields === 'string') {
      fields = [fields];
    }

    const modelDefinition = this.modelDefinition;
    const attributeDefs = modelDefinition.attributes;

    if (Array.isArray(fields)) {
      fields = fields.map(attributeName => {
        const attributeDef = attributeDefs.get(attributeName);
        if (attributeDef && attributeDef.columnName !== attributeName) {
          return attributeDef.columnName;
        }

        return attributeName;
      });
    } else if (fields && typeof fields === 'object') {
      fields = Object.keys(fields).reduce((rawFields, attributeName) => {
        const attributeDef = attributeDefs.get(attributeName);
        if (attributeDef && attributeDef.columnName !== attributeName) {
          rawFields[attributeDef.columnName] = fields[attributeName];
        } else {
          rawFields[attributeName] = fields[attributeName];
        }

        return rawFields;
      }, {});
    }

    this._injectScope(options);
    this._optionsMustContainWhere(options);

    options = defaults({}, options, {
      by: 1,
      where: {},
      increment: true,
    });
    const isSubtraction = !options.increment;

    mapOptionFieldNames(options, this);

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
    if (modelDefinition.versionAttributeName) {
      incrementAmountsByField[modelDefinition.versionAttributeName] = isSubtraction ? -1 : 1;
    }

    const extraAttributesToBeUpdated = {};

    const updatedAtAttrName = modelDefinition.timestampAttributeNames.updatedAt;
    if (!options.silent && updatedAtAttrName && !incrementAmountsByField[updatedAtAttrName]) {
      const columnName = modelDefinition.getColumnName(updatedAtAttrName);
      extraAttributesToBeUpdated[columnName] =
        this._getDefaultTimestamp(updatedAtAttrName) || new Date();
    }

    const tableName = this.table;
    let affectedRows;
    if (isSubtraction) {
      affectedRows = await this.queryInterface.decrement(
        this,
        tableName,
        where,
        incrementAmountsByField,
        extraAttributesToBeUpdated,
        options,
      );
    } else {
      affectedRows = await this.queryInterface.increment(
        this,
        tableName,
        where,
        incrementAmountsByField,
        extraAttributesToBeUpdated,
        options,
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
   * @example decrement number by 1
   * ```ts
   * Model.decrement('number', { where: { foo: 'bar' });
   * ```
   *
   * @example decrement number and count by 2
   * ```ts
   * Model.decrement(['number', 'count'], { by: 2, where: { foo: 'bar' } });
   * ```
   *
   * @example decrement answer by 42, and decrement tries by -1
   * ```ts
   * // `by` is ignored, since each column has its own value
   * Model.decrement({ answer: 42, tries: -1}, { by: 2, where: { foo: 'bar' } });
   * ```
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
    assert(
      isPlainObject(options.where) ||
        Array.isArray(options.where) ||
        options.where instanceof BaseSqlExpression,
      'Expected plain object, array or sequelize method in the options.where parameter',
    );
  }

  /**
   * Returns a Where Object that can be used to uniquely select this instance, using the instance's primary keys.
   *
   * @param {boolean} [checkVersion=false] include version attribute in where hash
   * @param {boolean} [nullIfImpossible=false] return null instead of throwing an error if the instance is missing its
   *   primary keys and therefore no Where object can be built.
   *
   * @returns {object}
   */
  where(checkVersion, nullIfImpossible) {
    return getModelPkWhere(this, checkVersion, nullIfImpossible);
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

    if (!isEqual(value, originalValue)) {
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
   * @param {string}  [attributeName] key to get value of
   * @param {object}  [options] get options
   *
   * @returns {object|any}
   */
  get(attributeName, options) {
    if (options === undefined && typeof attributeName === 'object') {
      options = attributeName;
      attributeName = undefined;
    }

    options ??= EMPTY_OBJECT;

    const { attributes, attributesWithGetters } = this.modelDefinition;

    if (attributeName) {
      const attribute = attributes.get(attributeName);
      if (attribute?.get && !options.raw) {
        return attribute.get.call(this, attributeName, options);
      }

      if (
        options.plain &&
        this._options.include &&
        this._options.includeNames.includes(attributeName)
      ) {
        if (Array.isArray(this.dataValues[attributeName])) {
          return this.dataValues[attributeName].map(instance => instance.get(options));
        }

        if (this.dataValues[attributeName] instanceof Model) {
          return this.dataValues[attributeName].get(options);
        }

        return this.dataValues[attributeName];
      }

      return this.dataValues[attributeName];
    }

    // TODO: move to its own method instead of overloading.
    if (
      attributesWithGetters.size > 0 ||
      (options.plain && this._options.include) ||
      options.clone
    ) {
      const values = Object.create(null);
      if (attributesWithGetters.size > 0) {
        for (const attributeName2 of attributesWithGetters) {
          if (!this._options.attributes?.includes(attributeName2)) {
            continue;
          }

          values[attributeName2] = this.get(attributeName2, options);
        }
      }

      for (const attributeName2 in this.dataValues) {
        if (
          !Object.hasOwn(values, attributeName2) &&
          Object.hasOwn(this.dataValues, attributeName2)
        ) {
          values[attributeName2] = this.get(attributeName2, options);
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

    const modelDefinition = this.modelDefinition;

    if (typeof key === 'object' && key !== null) {
      values = key;
      options = value || {};

      if (options.reset) {
        this.dataValues = {};
        for (const key in values) {
          this.changed(key, false);
        }
      }

      const hasDateAttributes = modelDefinition.dateAttributeNames.size > 0;
      const hasBooleanAttributes = modelDefinition.booleanAttributeNames.size > 0;

      // If raw, and we're not dealing with includes or special attributes, just set it straight on the dataValues object
      if (
        options.raw &&
        !(this._options && this._options.include) &&
        !(options && options.attributes) &&
        !hasDateAttributes &&
        !hasBooleanAttributes
      ) {
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

          const virtualAttributes = modelDefinition.virtualAttributeNames;
          if (virtualAttributes.size > 0) {
            setKeys(virtualAttributes);
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

    const attributeDefinition = modelDefinition.attributes.get(key);

    // If not raw, and there's a custom setter
    if (!options.raw && attributeDefinition?.set) {
      attributeDefinition.set.call(this, value, key);
      // custom setter should have changed value, get that changed value
      // TODO: v5 make setters return new value instead of changing internal store
      const newValue = this.dataValues[key];
      if (!isEqual(newValue, originalValue)) {
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
        // If the attribute is not in model definition, return
        if (!attributeDefinition) {
          const jsonAttributeNames = modelDefinition.jsonAttributeNames;

          if (key.includes('.') && jsonAttributeNames.has(key.split('.')[0])) {
            const previousNestedValue = Dottie.get(this.dataValues, key);
            if (!isEqual(previousNestedValue, value)) {
              Dottie.set(this.dataValues, key, value);
              this.changed(key.split('.')[0], true);
            }
          }

          return this;
        }

        // If attempting to set primary key and primary key is already defined, return
        const primaryKeyNames = modelDefinition.primaryKeysAttributeNames;
        if (originalValue && primaryKeyNames.has(key)) {
          return this;
        }

        // TODO: throw an error when trying to set a read only attribute with to a different value
        // If attempting to set read only attributes, return
        const readOnlyAttributeNames = modelDefinition.readOnlyAttributeNames;
        if (!this.isNewRecord && readOnlyAttributeNames.has(key)) {
          return this;
        }
      }

      // If there's a data type sanitizer
      const attributeType = attributeDefinition?.type;
      if (
        !options.comesFromDatabase &&
        value != null &&
        !(value instanceof BaseSqlExpression) &&
        attributeType &&
        // "type" can be a string
        attributeType instanceof AbstractDataType
      ) {
        value = attributeType.sanitize(value, options);
      }

      // Set when the value has changed and not raw
      if (
        !options.raw &&
        // True when sequelize method
        (value instanceof BaseSqlExpression ||
          // Otherwise, check for data type type comparators
          (value != null &&
            attributeType &&
            attributeType instanceof AbstractDataType &&
            !attributeType.areValuesEqual(value, originalValue, options)) ||
          ((value == null || !attributeType || !(attributeType instanceof AbstractDataType)) &&
            !isEqual(value, originalValue)))
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

    return pickBy(this._previousDataValues, (value, key) => this.changed(key));
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
    const primaryKeyAttribute = include.model.primaryKeyAttribute;
    const childOptions = {
      isNewRecord: this.isNewRecord,
      include: include.include,
      includeNames: include.includeNames,
      includeMap: include.includeMap,
      includeValidated: true,
      raw: options.raw,
      attributes: include.originalAttributes,
      comesFromDatabase: options.comesFromDatabase,
    };
    let isEmpty;

    if (include.originalAttributes === undefined || include.originalAttributes.length > 0) {
      if (association.isSingleAssociation) {
        if (Array.isArray(value)) {
          value = value[0];
        }

        isEmpty = (value && value[primaryKeyAttribute] === null) || value === null;
        this[key] = this.dataValues[key] = isEmpty
          ? null
          : include.model.build(value, childOptions);
      } else {
        isEmpty = value[0] && value[0][primaryKeyAttribute] === null;
        this[key] = this.dataValues[key] = isEmpty
          ? []
          : include.model.bulkBuild(value, childOptions);
      }
    }
  }

  /**
   * Validates this instance, and if the validation passes, persists it to the database.
   *
   * Returns a Promise that resolves to the saved instance (or rejects with a {@link ValidationError},
   * which will have a property for each of the fields for which the validation failed, with the error message for that
   * field).
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

    options = cloneDeep(options) ?? {};
    options = defaultsLodash(options, {
      hooks: true,
      validate: true,
    });

    setTransactionFromCls(options, this.sequelize);

    const modelDefinition = this.modelDefinition;

    if (!options.fields) {
      if (this.isNewRecord) {
        options.fields = Array.from(modelDefinition.attributes.keys());
      } else {
        options.fields = intersection(
          this.changed(),
          Array.from(modelDefinition.attributes.keys()),
        );
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

    // TODO: use modelDefinition.primaryKeyAttributes (plural!)
    const primaryKeyName = this.constructor.primaryKeyAttribute;
    const primaryKeyAttribute = primaryKeyName && modelDefinition.attributes.get(primaryKeyName);
    const createdAtAttr = modelDefinition.timestampAttributeNames.createdAt;
    const versionAttr = modelDefinition.versionAttributeName;
    const hook = this.isNewRecord ? 'Create' : 'Update';
    const wasNewRecord = this.isNewRecord;
    const now = new Date();
    let updatedAtAttr = modelDefinition.timestampAttributeNames.updatedAt;

    if (updatedAtAttr && options.fields.length > 0 && !options.fields.includes(updatedAtAttr)) {
      options.fields.push(updatedAtAttr);
    }

    if (versionAttr && options.fields.length > 0 && !options.fields.includes(versionAttr)) {
      options.fields.push(versionAttr);
    }

    if (options.silent === true && !(this.isNewRecord && this.get(updatedAtAttr, { raw: true }))) {
      // UpdateAtAttr might have been added as a result of Object.keys(Model.rawAttributes). In that case we have to remove it again
      remove(options.fields, val => val === updatedAtAttr);
      updatedAtAttr = false;
    }

    if (this.isNewRecord === true) {
      if (primaryKeyAttribute && primaryKeyAttribute.autoIncrement) {
        // Some dialects do not support returning the last inserted ID.
        // To overcome this limitation, we check if the dialect implements getNextPrimaryKeyValue,
        // so we get the next ID before the insert.
        const nextPrimaryKey = await this.constructor.queryInterface.getNextPrimaryKeyValue(
          this.constructor.table.tableName,
          primaryKeyName,
        );
        if (nextPrimaryKey) {
          this.set(primaryKeyName, nextPrimaryKey);
        }
      }

      if (createdAtAttr && !options.fields.includes(createdAtAttr)) {
        options.fields.push(createdAtAttr);
      }

      if (
        primaryKeyAttribute &&
        primaryKeyAttribute.defaultValue &&
        !options.fields.includes(primaryKeyName)
      ) {
        options.fields.unshift(primaryKeyName);
      }
    }

    if (
      this.isNewRecord === false &&
      primaryKeyName &&
      this.get(primaryKeyName, { raw: true }) === undefined
    ) {
      throw new Error(
        'You attempted to save an instance with no primary key, this is not allowed since it would result in a global update',
      );
    }

    if (updatedAtAttr && !options.silent && options.fields.includes(updatedAtAttr)) {
      this.dataValues[updatedAtAttr] = this.constructor._getDefaultTimestamp(updatedAtAttr) || now;
    }

    if (this.isNewRecord && createdAtAttr && !this.dataValues[createdAtAttr]) {
      this.dataValues[createdAtAttr] = this.constructor._getDefaultTimestamp(createdAtAttr) || now;
    }

    // Db2 does not allow NULL values for unique columns.
    // Add dummy values if not provided by test case or user.
    if (this.sequelize.dialect.name === 'db2' && this.isNewRecord) {
      // TODO: remove. This is fishy and is going to be a source of bugs (because it replaces null values with arbitrary values that could be actual data).
      //  If DB2 doesn't support NULL in unique columns, then it should error if the user tries to insert NULL in one.
      this.uniqno = this.sequelize.dialect.queryGenerator.addUniqueFields(
        this.dataValues,
        modelDefinition.rawAttributes,
        this.uniqno,
      );
    }

    // Validate
    if (options.validate) {
      await this.validate(options);
    }

    // Run before hook
    if (options.hooks) {
      const beforeHookValues = pick(this.dataValues, options.fields);
      let ignoreChanged = difference(this.changed(), options.fields); // In case of update where it's only supposed to update the passed values and the hook values
      let hookChanged;
      let afterHookValues;

      if (updatedAtAttr && options.fields.includes(updatedAtAttr)) {
        ignoreChanged = without(ignoreChanged, updatedAtAttr);
      }

      await this.constructor.hooks.runAsync(`before${hook}`, this, options);
      await this.constructor.hooks.runAsync(`beforeSave`, this, options);
      if (options.defaultFields && !this.isNewRecord) {
        afterHookValues = pick(this.dataValues, difference(this.changed(), ignoreChanged));

        hookChanged = [];
        for (const key of Object.keys(afterHookValues)) {
          if (afterHookValues[key] !== beforeHookValues[key]) {
            hookChanged.push(key);
          }
        }

        options.fields = uniq(options.fields.concat(hookChanged));
      }

      if (hookChanged && options.validate) {
        // Validate again

        options.skip = difference(Array.from(modelDefinition.attributes.keys()), hookChanged);
        await this.validate(options);
        delete options.skip;
      }
    }

    if (
      options.fields.length > 0 &&
      this.isNewRecord &&
      this._options.include &&
      this._options.include.length > 0
    ) {
      await Promise.all(
        this._options.include
          .filter(include => include.association instanceof BelongsToAssociation)
          .map(async include => {
            const instance = this.get(include.as);
            if (!instance) {
              return;
            }

            const includeOptions = defaultsLodash(omit(cloneDeep(include), ['association']), {
              connection: options.connection,
              transaction: options.transaction,
              logging: options.logging,
              parentRecord: this,
            });

            await instance.save(includeOptions);

            await this[include.association.accessors.set](instance, {
              save: false,
              logging: options.logging,
            });
          }),
      );
    }

    const realFields = options.fields.filter(
      attributeName => !modelDefinition.virtualAttributeNames.has(attributeName),
    );
    if (realFields.length === 0) {
      return this;
    }

    const versionColumnName = versionAttr && modelDefinition.getColumnName(versionAttr);
    const values = mapValueFieldNames(this.dataValues, options.fields, this.constructor);
    let query;
    let args;
    let where;

    if (!this.isNewRecord) {
      where = this.where(true);
      if (versionAttr) {
        values[versionColumnName] = Number.parseInt(values[versionColumnName], 10) + 1;
      }

      query = 'update';
      args = [this, this.constructor.table, values, where, options];
    }

    if (!this.changed() && !this.isNewRecord) {
      return this;
    }

    if (this.isNewRecord) {
      query = 'insert';
      args = [this, this.constructor.table, values, options];
    }

    const [result, rowsUpdated] = await this.constructor.queryInterface[query](...args);

    if (versionAttr) {
      // Check to see that a row was updated, otherwise it's an optimistic locking error.
      if (rowsUpdated < 1) {
        throw new SequelizeErrors.OptimisticLockError({
          modelName: this.constructor.name,
          values,
          where,
        });
      } else {
        result.dataValues[versionAttr] = values[versionColumnName];
      }
    }

    // Transfer database generated values (defaults, autoincrement, etc)
    for (const attribute of modelDefinition.attributes.values()) {
      if (
        attribute.columnName &&
        values[attribute.columnName] !== undefined &&
        attribute.columnName !== attribute.attributeName
      ) {
        values[attribute.attributeName] = values[attribute.columnName];
        // TODO: if a column uses the same name as an attribute, this will break!
        delete values[attribute.columnName];
      }
    }

    Object.assign(values, result.dataValues);

    Object.assign(result.dataValues, values);
    if (wasNewRecord && this._options.include && this._options.include.length > 0) {
      await Promise.all(
        this._options.include
          .filter(
            include =>
              !(
                include.association instanceof BelongsToAssociation ||
                (include.parent && include.parent.association instanceof BelongsToManyAssociation)
              ),
          )
          .map(async include => {
            let instances = this.get(include.as);

            if (!instances) {
              return;
            }

            if (!Array.isArray(instances)) {
              instances = [instances];
            }

            const includeOptions = defaultsLodash(omit(cloneDeep(include), ['association']), {
              connection: options.connection,
              transaction: options.transaction,
              logging: options.logging,
              parentRecord: this,
            });

            // Instances will be updated in place so we can safely treat HasOne like a HasMany
            await Promise.all(
              instances.map(async instance => {
                if (include.association instanceof BelongsToManyAssociation) {
                  await instance.save(includeOptions);
                  const values0 = {
                    [include.association.foreignKey]: this.get(
                      this.constructor.primaryKeyAttribute,
                      { raw: true },
                    ),
                    [include.association.otherKey]: instance.get(
                      instance.constructor.primaryKeyAttribute,
                      { raw: true },
                    ),
                    // Include values defined in the association
                    ...include.association.through.scope,
                  };

                  const throughModel = include.association.through.model;
                  if (instance[throughModel.name]) {
                    const throughDefinition = throughModel.modelDefinition;
                    for (const attribute of throughDefinition.attributes.values()) {
                      const { attributeName } = attribute;

                      if (
                        attribute._autoGenerated ||
                        attributeName === include.association.foreignKey ||
                        attributeName === include.association.otherKey ||
                        typeof instance[throughModel.name][attributeName] === 'undefined'
                      ) {
                        continue;
                      }

                      values0[attributeName] = instance[throughModel.name][attributeName];
                    }
                  }

                  await include.association.throughModel.create(values0, includeOptions);
                } else {
                  instance.set(
                    include.association.foreignKey,
                    this.get(
                      include.association.sourceKey || this.constructor.primaryKeyAttribute,
                      { raw: true },
                    ),
                    { raw: true },
                  );
                  Object.assign(instance, include.association.scope);
                  await instance.save(includeOptions);
                }
              }),
            );
          }),
      );
    }

    // Run after hook
    if (options.hooks) {
      await this.constructor.hooks.runAsync(`after${hook}`, result, options);
      await this.constructor.hooks.runAsync(`afterSave`, result, options);
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
    options = defaults({ where: this.where() }, options, {
      include: this._options.include || undefined,
    });

    const reloaded = await this.constructor.findOne(options);
    if (!reloaded) {
      throw new SequelizeErrors.InstanceError(
        'Instance could not be reloaded because it does not exist anymore (find call returned null)',
      );
    }

    // update the internal options of the instance
    this._options = reloaded._options;
    // re-set instance values
    this.set(reloaded.dataValues, {
      raw: true,
      reset: !options.attributes,
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
    values = omitBy(values, value => value === undefined);

    const changedBefore = this.changed() || [];

    if (this.isNewRecord) {
      throw new Error('You attempted to update an instance that is not persisted.');
    }

    options ??= EMPTY_OBJECT;
    if (Array.isArray(options)) {
      options = { fields: options };
    }

    options = cloneDeep(options);
    const setOptions = cloneDeep(options);
    setOptions.attributes = options.fields;
    this.set(values, setOptions);

    // Now we need to figure out which fields were actually affected by the setter.
    const sideEffects = without(this.changed(), ...changedBefore);
    const fields = union(Object.keys(values), sideEffects);

    if (!options.fields) {
      options.fields = intersection(fields, this.changed());
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

    setTransactionFromCls(options, this.sequelize);

    const modelDefinition = this.modelDefinition;

    // Run before hook
    if (options.hooks) {
      await modelDefinition.hooks.runAsync('beforeDestroy', this, options);
    }

    let result;
    if (modelDefinition.timestampAttributeNames.deletedAt && options.force === false) {
      const attributeName = modelDefinition.timestampAttributeNames.deletedAt;
      const attribute = modelDefinition.attributes.get(attributeName);
      const defaultValue = attribute.defaultValue ?? null;
      const currentValue = this.getDataValue(attributeName);
      const undefinedOrNull = currentValue == null && defaultValue == null;
      if (undefinedOrNull || isEqual(currentValue, defaultValue)) {
        // only update timestamp if it wasn't already set
        this.setDataValue(attributeName, new Date());
      }

      result = await this.save({ ...options, hooks: false });
    } else {
      // TODO: replace "hooks" with "noHooks" in this method and call ModelRepository.destroy instead of queryInterface.delete
      const where = this.where(true);

      result = await this.constructor.queryInterface.bulkDelete(this.constructor, {
        limit: null,
        ...options,
        where,
      });
    }

    // Run after hook
    if (options.hooks) {
      await modelDefinition.hooks.runAsync('afterDestroy', this, options);
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
    const modelDefinition = this.modelDefinition;

    const deletedAtAttributeName = modelDefinition.timestampAttributeNames.deletedAt;
    if (!deletedAtAttributeName) {
      throw new Error('Model is not paranoid');
    }

    const deletedAtAttribute = modelDefinition.attributes.get(deletedAtAttributeName);
    const defaultValue = deletedAtAttribute.defaultValue ?? null;
    const deletedAt = this.get(deletedAtAttributeName) || null;
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
    const modelDefinition = this.modelDefinition;
    const deletedAtAttributeName = modelDefinition.timestampAttributeNames.deletedAt;

    if (!deletedAtAttributeName) {
      throw new Error('Model is not paranoid');
    }

    options = {
      hooks: true,
      force: false,
      ...options,
    };

    setTransactionFromCls(options, this.sequelize);

    // Run before hook
    if (options.hooks) {
      await this.constructor.hooks.runAsync('beforeRestore', this, options);
    }

    const deletedAtAttribute = modelDefinition.attributes.get(deletedAtAttributeName);
    const deletedAtDefaultValue = deletedAtAttribute.defaultValue ?? null;

    this.setDataValue(deletedAtAttributeName, deletedAtDefaultValue);
    const result = await this.save({ ...options, hooks: false, omitNull: false });
    // Run after hook
    if (options.hooks) {
      await this.constructor.hooks.runAsync('afterRestore', this, options);

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

    options = cloneDeep(options) ?? {};
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
    if (!other || !(other instanceof Model)) {
      return false;
    }

    const modelDefinition = this.modelDefinition;
    const otherModelDefinition = this.modelDefinition;

    if (modelDefinition !== otherModelDefinition) {
      return false;
    }

    return every(modelDefinition.primaryKeysAttributeNames, attribute => {
      return this.get(attribute, { raw: true }) === other.get(attribute, { raw: true });
    });
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
    return cloneDeepLodash(
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
   * @returns {HasManyAssociation} The newly defined association (also available in {@link Model.associations}).
   */
  static hasMany(target, options) {
    return HasManyAssociation.associate(AssociationSecret, this, target, options);
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
   *   started: DataTypes.BOOLEAN
   * })
   * User.belongsToMany(Project, { through: UserProjects })
   * ```
   *
   * @param {Model} target Target model
   * @param {object} options belongsToMany association options
   * @returns {BelongsToManyAssociation} The newly defined association (also available in {@link Model.associations}).
   */
  static belongsToMany(target, options) {
    return BelongsToManyAssociation.associate(AssociationSecret, this, target, options);
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
   * @returns {HasOneAssociation} The newly defined association (also available in {@link Model.associations}).
   */
  static hasOne(target, options) {
    return HasOneAssociation.associate(AssociationSecret, this, target, options);
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
   * @returns {BelongsToAssociation} The newly defined association (also available in {@link Model.associations}).
   */
  static belongsTo(target, options) {
    return BelongsToAssociation.associate(AssociationSecret, this, target, options);
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
  if (!isObject(where)) {
    return where;
  }

  const keys = getComplexKeys(where);

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
