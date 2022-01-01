'use strict';

const assert = require('assert');
const _ = require('lodash');
const Dottie = require('dottie');

const Utils = require('./utils');
const { logger } = require('./utils/logger');
const BelongsTo = require('./associations/belongs-to');
const BelongsToMany = require('./associations/belongs-to-many');
const InstanceValidator = require('./instance-validator');
const QueryTypes = require('./query-types');
const sequelizeErrors = require('./errors');
const Association = require('./associations/base');
const HasMany = require('./associations/has-many');
const DataTypes = require('./data-types');
const Hooks = require('./hooks');
const associationsMixin = require('./associations/mixin');
const Op = require('./operators');
const { noDoubleNestedGroup } = require('./utils/deprecations');


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
 * Model instances operate with the concept of a `dataValues` property, which stores the actual values represented by the instance.
 * By default, the values from dataValues can also be accessed directly from the Instance, that is:
 * ```js
 * instance.field
 * // is the same as
 * instance.get('field')
 * // is the same as
 * instance.getDataValue('field')
 * ```
 * However, if getters and/or setters are defined for `field` they will be invoked, instead of returning the value from `dataValues`.
 * Accessing properties directly or using `get` is preferred for regular use, `getDataValue` should only be used for custom getters.
 *
 * @see
   * {@link Sequelize#define} for more information about getters and setters
 * @mixes Hooks
 */
class Model {
  static get queryInterface() {
    return this.sequelize.getQueryInterface();
  }

  static get queryGenerator() {
    return this.queryInterface.queryGenerator;
  }

  /**
   * A reference to the sequelize instance
   *
   * @see
   * {@link Sequelize}
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
   * @param {Array}   [options.include] an array of include options - Used to build prefetched/included model instances. See `set`
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
          logger.warn(`Model ${JSON.stringify(this.constructor.name)} is declaring public class fields for attribute(s): ${overwrittenAttributes.map(attr => JSON.stringify(attr)).join(', ')}.` +
            '\nThese class fields are shadowing Sequelize\'s attribute getters & setters.' +
            '\nSee https://sequelize.org/main/manual/model-basics.html#caveat-with-public-class-fields');
        }
      }, 0);
    }

    options = {
      isNewRecord: true,
      _schema: this.constructor._schema,
      _schemaDelimiter: this.constructor._schemaDelimiter,
      ...options
    };

    if (options.attributes) {
      options.attributes = options.attributes.map(attribute => Array.isArray(attribute) ? attribute[1] : attribute);
    }

    if (!options.includeValidated) {
      this.constructor._conformIncludes(options, this.constructor);
      if (options.include) {
        this.constructor._expandIncludeAll(options);
        this.constructor._validateIncludedElements(options);
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
      if (this.constructor.primaryKeyAttributes.length) {
        this.constructor.primaryKeyAttributes.forEach(primaryKeyAttribute => {
          if (!Object.prototype.hasOwnProperty.call(defaults, primaryKeyAttribute)) {
            defaults[primaryKeyAttribute] = null;
          }
        });
      }

      if (this.constructor._timestampAttributes.createdAt && defaults[this.constructor._timestampAttributes.createdAt]) {
        this.dataValues[this.constructor._timestampAttributes.createdAt] = Utils.toDefaultValue(defaults[this.constructor._timestampAttributes.createdAt], this.sequelize.options.dialect);
        delete defaults[this.constructor._timestampAttributes.createdAt];
      }

      if (this.constructor._timestampAttributes.updatedAt && defaults[this.constructor._timestampAttributes.updatedAt]) {
        this.dataValues[this.constructor._timestampAttributes.updatedAt] = Utils.toDefaultValue(defaults[this.constructor._timestampAttributes.updatedAt], this.sequelize.options.dialect);
        delete defaults[this.constructor._timestampAttributes.updatedAt];
      }

      if (this.constructor._timestampAttributes.deletedAt && defaults[this.constructor._timestampAttributes.deletedAt]) {
        this.dataValues[this.constructor._timestampAttributes.deletedAt] = Utils.toDefaultValue(defaults[this.constructor._timestampAttributes.deletedAt], this.sequelize.options.dialect);
        delete defaults[this.constructor._timestampAttributes.deletedAt];
      }

      for (key in defaults) {
        if (values[key] === undefined) {
          this.set(key, Utils.toDefaultValue(defaults[key], this.sequelize.options.dialect), { raw: true });
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
    if (_.get(options, 'groupedLimit.on.options.paranoid')) {
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
      [Op.eq]: null
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
    // Can't use this.primaryKeys here, since this function is called before PKs are identified
    if (!_.some(this.rawAttributes, 'primaryKey')) {
      if ('id' in this.rawAttributes) {
        // Something is fishy here!
        throw new Error(`A column called 'id' was added to the attributes of '${this.tableName}' but not marked with 'primaryKey: true'`);
      }

      head = {
        id: {
          type: new DataTypes.INTEGER(),
          allowNull: false,
          primaryKey: true,
          autoIncrement: true,
          _autoGenerated: true
        }
      };
    }

    if (this._timestampAttributes.createdAt) {
      tail[this._timestampAttributes.createdAt] = {
        type: DataTypes.DATE,
        allowNull: false,
        _autoGenerated: true
      };
    }

    if (this._timestampAttributes.updatedAt) {
      tail[this._timestampAttributes.updatedAt] = {
        type: DataTypes.DATE,
        allowNull: false,
        _autoGenerated: true
      };
    }

    if (this._timestampAttributes.deletedAt) {
      tail[this._timestampAttributes.deletedAt] = {
        type: DataTypes.DATE,
        _autoGenerated: true
      };
    }

    if (this._versionAttribute) {
      tail[this._versionAttribute] = {
        type: DataTypes.INTEGER,
        allowNull: false,
        defaultValue: 0,
        _autoGenerated: true
      };
    }

    const newRawAttributes = {
      ...head,
      ...this.rawAttributes
    };
    _.each(tail, (value, attr) => {
      if (newRawAttributes[attr] === undefined) {
        newRawAttributes[attr] = value;
      }
    });

    this.rawAttributes = newRawAttributes;

    if (!Object.keys(this.primaryKeys).length) {
      this.primaryKeys.id = this.rawAttributes.id;
    }
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

  static _conformIncludes(options, self) {
    if (!options.include) return;

    // if include is not an array, wrap in an array
    if (!Array.isArray(options.include)) {
      options.include = [options.include];
    } else if (!options.include.length) {
      delete options.include;
      return;
    }

    // convert all included elements to { model: Model } form
    options.include = options.include.map(include => this._conformInclude(include, self));
  }

  static _transformStringAssociation(include, self) {
    if (self && typeof include === 'string') {
      if (!Object.prototype.hasOwnProperty.call(self.associations, include)) {
        throw new Error(`Association with alias "${include}" does not exist on ${self.name}`);
      }
      return self.associations[include];
    }
    return include;
  }

  static _conformInclude(include, self) {
    if (include) {
      let model;

      if (include._pseudo) return include;

      include = this._transformStringAssociation(include, self);

      if (include instanceof Association) {
        if (self && include.target.name === self.name) {
          model = include.source;
        } else {
          model = include.target;
        }

        return { model, association: include, as: include.as };
      }

      if (include.prototype && include.prototype instanceof Model) {
        return { model: include };
      }

      if (_.isPlainObject(include)) {
        if (include.association) {
          include.association = this._transformStringAssociation(include.association, self);

          if (self && include.association.target.name === self.name) {
            model = include.association.source;
          } else {
            model = include.association.target;
          }

          if (!include.model) include.model = model;
          if (!include.as) include.as = include.association.as;

          this._conformIncludes(include, model);
          return include;
        }

        if (include.model) {
          this._conformIncludes(include, include.model);
          return include;
        }

        if (include.all) {
          this._conformIncludes(include);
          return include;
        }
      }
    }

    throw new Error('Include unexpected. Element has to be either a Model, an Association or an object.');
  }

  static _expandIncludeAllElement(includes, include) {
    // check 'all' attribute provided is valid
    let all = include.all;
    delete include.all;

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
        Many: ['HasMany']
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
          for (let j = 0; j < types.length; j++) {
            if (!all.includes(types[j])) {
              all.unshift(types[j]);
              i++;
            }
          }
        }
      }
    }

    // add all associations of types specified to includes
    const nested = include.nested;
    if (nested) {
      delete include.nested;

      if (!include.include) {
        include.include = [];
      } else if (!Array.isArray(include.include)) {
        include.include = [include.include];
      }
    }

    const used = [];
    (function addAllIncludes(parent, includes) {
      _.forEach(parent.associations, association => {
        if (all !== true && !all.includes(association.associationType)) {
          return;
        }

        // check if model already included, and skip if so
        const model = association.target;
        const as = association.options.as;

        const predicate = { model };
        if (as) {
          // We only add 'as' to the predicate if it actually exists
          predicate.as = as;
        }

        if (_.some(includes, predicate)) {
          return;
        }

        // skip if recursing over a model already nested
        if (nested && used.includes(model)) {
          return;
        }
        used.push(parent);

        // include this model
        const thisInclude = Utils.cloneDeep(include);
        thisInclude.model = model;
        if (as) {
          thisInclude.as = as;
        }
        includes.push(thisInclude);

        // run recursively if nested
        if (nested) {
          addAllIncludes(model, thisInclude.include);
          if (thisInclude.include.length === 0) delete thisInclude.include;
        }
      });
      used.pop();
    })(this, includes);
  }

  static _validateIncludedElements(options, tableNames) {
    if (!options.model) options.model = this;

    tableNames = tableNames || {};
    options.includeNames = [];
    options.includeMap = {};

    /* Legacy */
    options.hasSingleAssociation = false;
    options.hasMultiAssociation = false;

    if (!options.parent) {
      options.topModel = options.model;
      options.topLimit = options.limit;
    }

    options.include = options.include.map(include => {
      include = this._conformInclude(include);
      include.parent = options;
      include.topLimit = options.topLimit;

      this._validateIncludedElement.call(options.model, include, tableNames, options);

      if (include.duplicating === undefined) {
        include.duplicating = include.association.isMultiAssociation;
      }

      include.hasDuplicating = include.hasDuplicating || include.duplicating;
      include.hasRequired = include.hasRequired || include.required;

      options.hasDuplicating = options.hasDuplicating || include.hasDuplicating;
      options.hasRequired = options.hasRequired || include.required;

      options.hasWhere = options.hasWhere || include.hasWhere || !!include.where;
      return include;
    });

    for (const include of options.include) {
      include.hasParentWhere = options.hasParentWhere || !!options.where;
      include.hasParentRequired = options.hasParentRequired || !!options.required;

      if (include.subQuery !== false && options.hasDuplicating && options.topLimit) {
        if (include.duplicating) {
          include.subQuery = include.subQuery || false;
          include.subQueryFilter = include.hasRequired;
        } else {
          include.subQuery = include.hasRequired;
          include.subQueryFilter = false;
        }
      } else {
        include.subQuery = include.subQuery || false;
        if (include.duplicating) {
          include.subQueryFilter = include.subQuery;
        } else {
          include.subQueryFilter = false;
          include.subQuery = include.subQuery || include.hasParentRequired && include.hasRequired && !include.separate;
        }
      }

      options.includeMap[include.as] = include;
      options.includeNames.push(include.as);

      // Set top level options
      if (options.topModel === options.model && options.subQuery === undefined && options.topLimit) {
        if (include.subQuery) {
          options.subQuery = include.subQuery;
        } else if (include.hasDuplicating) {
          options.subQuery = true;
        }
      }

      /* Legacy */
      options.hasIncludeWhere = options.hasIncludeWhere || include.hasIncludeWhere || !!include.where;
      options.hasIncludeRequired = options.hasIncludeRequired || include.hasIncludeRequired || !!include.required;

      if (include.association.isMultiAssociation || include.hasMultiAssociation) {
        options.hasMultiAssociation = true;
      }
      if (include.association.isSingleAssociation || include.hasSingleAssociation) {
        options.hasSingleAssociation = true;
      }
    }

    if (options.topModel === options.model && options.subQuery === undefined) {
      options.subQuery = false;
    }
    return options;
  }

  static _validateIncludedElement(include, tableNames, options) {
    tableNames[include.model.getTableName()] = true;

    if (include.attributes && !options.raw) {
      include.model._expandAttributes(include);

      include.originalAttributes = include.model._injectDependentVirtualAttributes(include.attributes);

      include = Utils.mapFinderOptions(include, include.model);

      if (include.attributes.length) {
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
    const association = include.association || this._getIncludedAssociation(include.model, include.as);

    include.association = association;
    include.as = association.as;

    // If through, we create a pseudo child include, to ease our parsing later on
    if (include.association.through && Object(include.association.through.model) === include.association.through.model) {
      if (!include.include) include.include = [];
      const through = include.association.through;

      include.through = _.defaults(include.through || {}, {
        model: through.model,
        as: through.model.name,
        association: {
          isSingleAssociation: true
        },
        _pseudo: true,
        parent: include
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
      include.required = !!include.where;
    }

    if (include.association.scope) {
      include.where = include.where ? { [Op.and]: [include.where, include.association.scope] } : include.association.scope;
    }

    if (include.limit && include.separate === undefined) {
      include.separate = true;
    }

    if (include.separate === true) {
      if (!(include.association instanceof HasMany)) {
        throw new Error('Only HasMany associations support include.separate');
      }

      include.duplicating = false;

      if (
        options.attributes
        && options.attributes.length
        && !_.flattenDepth(options.attributes, 2).includes(association.sourceKey)
      ) {
        options.attributes.push(association.sourceKey);
      }

      if (
        include.attributes
        && include.attributes.length
        && !_.flattenDepth(include.attributes, 2).includes(association.foreignKey)
      ) {
        include.attributes.push(association.foreignKey);
      }
    }

    // Validate child includes
    if (Object.prototype.hasOwnProperty.call(include, 'include')) {
      this._validateIncludedElements.call(include.model, include, tableNames);
    }

    return include;
  }

  static _getIncludedAssociation(targetModel, targetAlias) {
    const associations = this.getAssociations(targetModel);
    let association = null;
    if (associations.length === 0) {
      throw new sequelizeErrors.EagerLoadingError(`${targetModel.name} is not associated to ${this.name}!`);
    }
    if (associations.length === 1) {
      association = this.getAssociationForAlias(targetModel, targetAlias);
      if (association) {
        return association;
      }
      if (targetAlias) {
        const existingAliases = this.getAssociations(targetModel).map(association => association.as);
        throw new sequelizeErrors.EagerLoadingError(`${targetModel.name} is associated to ${this.name} using an alias. ` +
          `You've included an alias (${targetAlias}), but it does not match the alias(es) defined in your association (${existingAliases.join(', ')}).`);
      }
      throw new sequelizeErrors.EagerLoadingError(`${targetModel.name} is associated to ${this.name} using an alias. ` +
        'You must use the \'as\' keyword to specify the alias within your include statement.');
    }
    association = this.getAssociationForAlias(targetModel, targetAlias);
    if (!association) {
      throw new sequelizeErrors.EagerLoadingError(`${targetModel.name} is associated to ${this.name} multiple times. ` +
        'To identify the correct association, you must use the \'as\' keyword to specify the alias of the association you want to include.');
    }
    return association;
  }


  static _expandIncludeAll(options) {
    const includes = options.include;
    if (!includes) {
      return;
    }

    for (let index = 0; index < includes.length; index++) {
      const include = includes[index];

      if (include.all) {
        includes.splice(index, 1);
        index--;

        this._expandIncludeAllElement(includes, include);
      }
    }

    includes.forEach(include => {
      this._expandIncludeAll.call(include.model, include);
    });
  }

  static _conformIndex(index) {
    if (!index.fields) {
      throw new Error('Missing "fields" property for index definition');
    }

    index = _.defaults(index, {
      type: '',
      parser: null
    });

    if (index.type && index.type.toLowerCase() === 'unique') {
      index.unique = true;
      delete index.type;
    }

    return index;
  }


  static _uniqIncludes(options) {
    if (!options.include) return;

    options.include = _(options.include)
      .groupBy(include => `${include.model && include.model.name}-${include.as}`)
      .map(includes => this._assignOptions(...includes))
      .value();
  }

  static _baseMerge(...args) {
    _.assignWith(...args);
    this._conformIncludes(args[0], this);
    this._uniqIncludes(args[0]);
    return args[0];
  }

  static _mergeFunction(objValue, srcValue, key) {
    if (Array.isArray(objValue) && Array.isArray(srcValue)) {
      return _.union(objValue, srcValue);
    }
    if (['where', 'having'].includes(key)) {
      if (srcValue instanceof Utils.SequelizeMethod) {
        srcValue = { [Op.and]: srcValue };
      }
      if (_.isPlainObject(objValue) && _.isPlainObject(srcValue)) {
        return Object.assign(objValue, srcValue);
      }
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
   * Initialize a model, representing a table in the DB, with attributes and options.
   *
   * The table columns are defined by the hash that is given as the first argument.
   * Each attribute of the hash represents a column.
   *
   * @example
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
   *
   * sequelize.models.modelName // The model will now be available in models under the class name
   *
   * @see
   * <a href="/master/manual/model-basics.html">Model Basics</a> guide
   *
   * @see
   * <a href="/master/manual/model-basics.html">Hooks</a> guide
   *
   * @see
   * <a href="/master/manual/validations-and-constraints.html"/>Validations & Constraints</a> guide
   *
   * @param {object}                  attributes An object, where each attribute is a column of the table. Each column can be either a DataType, a string or a type-description object, with the properties described below:
   * @param {string|DataTypes|object} attributes.column The description of a database column
   * @param {string|DataTypes}        attributes.column.type A string or a data type
   * @param {boolean}                 [attributes.column.allowNull=true] If false, the column will have a NOT NULL constraint, and a not null validation will be run before an instance is saved.
   * @param {any}                     [attributes.column.defaultValue=null] A literal default value, a JavaScript function, or an SQL function (see `sequelize.fn`)
   * @param {string|boolean}          [attributes.column.unique=false] If true, the column will get a unique constraint. If a string is provided, the column will be part of a composite unique index. If multiple columns have the same string, they will be part of the same unique index
   * @param {boolean}                 [attributes.column.primaryKey=false] If true, this attribute will be marked as primary key
   * @param {string}                  [attributes.column.field=null] If set, sequelize will map the attribute name to a different name in the database
   * @param {boolean}                 [attributes.column.autoIncrement=false] If true, this column will be set to auto increment
   * @param {boolean}                 [attributes.column.autoIncrementIdentity=false] If true, combined with autoIncrement=true, will use Postgres `GENERATED BY DEFAULT AS IDENTITY` instead of `SERIAL`. Postgres 10+ only.
   * @param {string}                  [attributes.column.comment=null] Comment for this column
   * @param {string|Model}            [attributes.column.references=null] An object with reference configurations
   * @param {string|Model}            [attributes.column.references.model] If this column references another table, provide it here as a Model, or a string
   * @param {string}                  [attributes.column.references.key='id'] The column of the foreign table that this column references
   * @param {string}                  [attributes.column.onUpdate] What should happen when the referenced key is updated. One of CASCADE, RESTRICT, SET DEFAULT, SET NULL or NO ACTION
   * @param {string}                  [attributes.column.onDelete] What should happen when the referenced key is deleted. One of CASCADE, RESTRICT, SET DEFAULT, SET NULL or NO ACTION
   * @param {Function}                [attributes.column.get] Provide a custom getter for this column. Use `this.getDataValue(String)` to manipulate the underlying values.
   * @param {Function}                [attributes.column.set] Provide a custom setter for this column. Use `this.setDataValue(String, Value)` to manipulate the underlying values.
   * @param {object}                  [attributes.column.validate] An object of validations to execute for this column every time the model is saved. Can be either the name of a validation provided by validator.js, a validation function provided by extending validator.js (see the `DAOValidator` property for more details), or a custom validation function. Custom validation functions are called with the value of the field and the instance itself as the `this` binding, and can possibly take a second callback argument, to signal that they are asynchronous. If the validator is sync, it should throw in the case of a failed validation; if it is async, the callback should be called with the error text.
   * @param {object}                  options These options are merged with the default define options provided to the Sequelize constructor
   * @param {object}                  options.sequelize Define the sequelize instance to attach to the new Model. Throw error if none is provided.
   * @param {string}                  [options.modelName] Set name of the model. By default its same as Class name.
   * @param {object}                  [options.defaultScope={}] Define the default search scope to use for this model. Scopes have the same form as the options passed to find / findAll
   * @param {object}                  [options.scopes] More scopes, defined in the same way as defaultScope above. See `Model.scope` for more information about how scopes are defined, and what you can do with them
   * @param {boolean}                 [options.omitNull] Don't persist null values. This means that all columns with null values will not be saved
   * @param {boolean}                 [options.timestamps=true] Adds createdAt and updatedAt timestamps to the model.
   * @param {boolean}                 [options.paranoid=false] Calling `destroy` will not delete the model, but instead set a `deletedAt` timestamp if this is true. Needs `timestamps=true` to work
   * @param {boolean}                 [options.underscored=false] Add underscored field to all attributes, this covers user defined attributes, timestamps and foreign keys. Will not affect attributes with explicitly set `field` option
   * @param {boolean}                 [options.freezeTableName=false] If freezeTableName is true, sequelize will not try to alter the model name to get the table name. Otherwise, the model name will be pluralized
   * @param {object}                  [options.name] An object with two attributes, `singular` and `plural`, which are used when this model is associated to others.
   * @param {string}                  [options.name.singular=Utils.singularize(modelName)] Singular name for model
   * @param {string}                  [options.name.plural=Utils.pluralize(modelName)] Plural name for model
   * @param {Array<object>}           [options.indexes] indexes definitions
   * @param {string}                  [options.indexes[].name] The name of the index. Defaults to model name + _ + fields concatenated
   * @param {string}                  [options.indexes[].type] Index type. Only used by mysql. One of `UNIQUE`, `FULLTEXT` and `SPATIAL`
   * @param {string}                  [options.indexes[].using] The method to create the index by (`USING` statement in SQL). BTREE and HASH are supported by mysql and postgres, and postgres additionally supports GIST and GIN.
   * @param {string}                  [options.indexes[].operator] Specify index operator.
   * @param {boolean}                 [options.indexes[].unique=false] Should the index by unique? Can also be triggered by setting type to `UNIQUE`
   * @param {boolean}                 [options.indexes[].concurrently=false] PostgresSQL will build the index without taking any write locks. Postgres only
   * @param {Array<string|object>}    [options.indexes[].fields] An array of the fields to index. Each field can either be a string containing the name of the field, a sequelize object (e.g `sequelize.fn`), or an object with the following attributes: `attribute` (field name), `length` (create a prefix index of length chars), `order` (the direction the column should be sorted in), `collate` (the collation (sort order) for the column)
   * @param {string|boolean}          [options.createdAt] Override the name of the createdAt attribute if a string is provided, or disable it if false. Timestamps must be true. Underscored field will be set with underscored setting.
   * @param {string|boolean}          [options.updatedAt] Override the name of the updatedAt attribute if a string is provided, or disable it if false. Timestamps must be true. Underscored field will be set with underscored setting.
   * @param {string|boolean}          [options.deletedAt] Override the name of the deletedAt attribute if a string is provided, or disable it if false. Timestamps must be true. Underscored field will be set with underscored setting.
   * @param {string}                  [options.tableName] Defaults to pluralized model name, unless freezeTableName is true, in which case it uses model name verbatim
   * @param {string}                  [options.schema='public'] schema
   * @param {string}                  [options.engine] Specify engine for model's table
   * @param {string}                  [options.charset] Specify charset for model's table
   * @param {string}                  [options.comment] Specify comment for model's table
   * @param {string}                  [options.collate] Specify collation for model's table
   * @param {string}                  [options.initialAutoIncrement] Set the initial AUTO_INCREMENT value for the table in MySQL.
   * @param {object}                  [options.hooks] An object of hook function that are called before and after certain lifecycle events. The possible hooks are: beforeValidate, afterValidate, validationFailed, beforeBulkCreate, beforeBulkDestroy, beforeBulkUpdate, beforeCreate, beforeDestroy, beforeUpdate, afterCreate, beforeSave, afterDestroy, afterUpdate, afterBulkCreate, afterSave, afterBulkDestroy and afterBulkUpdate. See Hooks for more information about hook functions and their signatures. Each property can either be a function, or an array of functions.
   * @param {object}                  [options.validate] An object of model wide validations. Validations have access to all model values via `this`. If the validator function takes an argument, it is assumed to be async, and is called with a callback that accepts an optional error.
   *
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
        singular: Utils.singularize(options.modelName)
      },
      indexes: [],
      omitNull: globalOptions.omitNull,
      schema: globalOptions.schema
    }, options);

    this.sequelize.runHooks('beforeDefine', attributes, options);

    if (options.modelName !== this.name) {
      Object.defineProperty(this, 'name', { value: options.modelName });
    }
    delete options.modelName;

    this.options = {
      timestamps: true,
      validate: {},
      freezeTableName: false,
      underscored: false,
      paranoid: false,
      rejectOnEmpty: false,
      whereCollection: null,
      schema: null,
      schemaDelimiter: '',
      defaultScope: {},
      scopes: {},
      indexes: [],
      ...options
    };

    // if you call "define" multiple times for the same modelName, do not clutter the factory
    if (this.sequelize.isDefined(this.name)) {
      this.sequelize.modelManager.removeModel(this.sequelize.modelManager.getModel(this.name));
    }

    this.associations = {};
    this._setupHooks(options.hooks);

    this.underscored = this.options.underscored;

    if (!this.options.tableName) {
      this.tableName = this.options.freezeTableName ? this.name : Utils.underscoredIf(Utils.pluralize(this.name), this.underscored);
    } else {
      this.tableName = this.options.tableName;
    }

    this._schema = this.options.schema;
    this._schemaDelimiter = this.options.schemaDelimiter;

    // error check options
    _.each(options.validate, (validator, validatorType) => {
      if (Object.prototype.hasOwnProperty.call(attributes, validatorType)) {
        throw new Error(`A model validator function must not have the same name as a field. Model: ${this.name}, field/validation name: ${validatorType}`);
      }

      if (typeof validator !== 'function') {
        throw new Error(`Members of the validate option must be functions. Model: ${this.name}, error with validate member ${validatorType}`);
      }
    });

    this.rawAttributes = _.mapValues(attributes, (attribute, name) => {
      attribute = this.sequelize.normalizeAttribute(attribute);

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

    const tableName = this.getTableName();
    this._indexes = this.options.indexes
      .map(index => Utils.nameIndex(this._conformIndex(index), tableName));

    this.primaryKeys = {};
    this._readOnlyAttributes = new Set();
    this._timestampAttributes = {};

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
        this._timestampAttributes.createdAt =
          typeof this.options.createdAt === 'string' ? this.options.createdAt : 'createdAt';
        this._readOnlyAttributes.add(this._timestampAttributes.createdAt);
      }
      if (this.options.updatedAt !== false) {
        this._timestampAttributes.updatedAt =
          typeof this.options.updatedAt === 'string' ? this.options.updatedAt : 'updatedAt';
        this._readOnlyAttributes.add(this._timestampAttributes.updatedAt);
      }
      if (this.options.paranoid && this.options.deletedAt !== false) {
        this._timestampAttributes.deletedAt =
          typeof this.options.deletedAt === 'string' ? this.options.deletedAt : 'deletedAt';
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

    ['get', 'set'].forEach(type => {
      const opt = `${type}terMethods`;
      const funcs = { ...this.options[opt] };
      const _custom = type === 'get' ? this.prototype._customGetters : this.prototype._customSetters;

      _.each(funcs, (method, attribute) => {
        _custom[attribute] = method;

        if (type === 'get') {
          funcs[attribute] = function() {
            return this.get(attribute);
          };
        }
        if (type === 'set') {
          funcs[attribute] = function(value) {
            return this.set(attribute, value);
          };
        }
      });

      _.each(this.rawAttributes, (options, attribute) => {
        if (Object.prototype.hasOwnProperty.call(options, type)) {
          _custom[attribute] = options[type];
        }

        if (type === 'get') {
          funcs[attribute] = function() {
            return this.get(attribute);
          };
        }
        if (type === 'set') {
          funcs[attribute] = function(value) {
            return this.set(attribute, value);
          };
        }
      });

      _.each(funcs, (fct, name) => {
        if (!attributeManipulation[name]) {
          attributeManipulation[name] = {
            configurable: true
          };
        }
        attributeManipulation[name][type] = fct;
      });
    });

    this._dataTypeChanges = {};
    this._dataTypeSanitizers = {};

    this._hasBooleanAttributes = false;
    this._hasDateAttributes = false;
    this._jsonAttributes = new Set();
    this._virtualAttributes = new Set();
    this._defaultValues = {};
    this.prototype.validators = {};

    this.fieldRawAttributesMap = {};

    this.primaryKeys = {};
    this.uniqueKeys = {};

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
        this._defaultValues[name] = () => Utils.toDefaultValue(definition.defaultValue, this.sequelize.options.dialect);
      }

      if (Object.prototype.hasOwnProperty.call(definition, 'unique') && definition.unique) {
        let idxName;
        if (
          typeof definition.unique === 'object' &&
          Object.prototype.hasOwnProperty.call(definition.unique, 'name')
        ) {
          idxName = definition.unique.name;
        } else if (typeof definition.unique === 'string') {
          idxName = definition.unique;
        } else {
          idxName = `${this.tableName}_${name}_unique`;
        }

        const idx = this.uniqueKeys[idxName] || { fields: [] };

        idx.fields.push(definition.field);
        idx.msg = idx.msg || definition.unique.msg || null;
        idx.name = idxName || false;
        idx.column = name;
        idx.customIndex = definition.unique !== true;

        this.uniqueKeys[idxName] = idx;
      }

      if (Object.prototype.hasOwnProperty.call(definition, 'validate')) {
        this.prototype.validators[name] = definition.validate;
      }

      if (definition.index === true && definition.type instanceof DataTypes.JSONB) {
        this._indexes.push(
          Utils.nameIndex(
            this._conformIndex({
              fields: [definition.field || name],
              using: 'gin'
            }),
            this.getTableName()
          )
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

    this._hasJsonAttributes = !!this._jsonAttributes.size;

    this._hasVirtualAttributes = !!this._virtualAttributes.size;

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
   * Remove attribute from model definition
   *
   * @param {string} attribute name of attribute to remove
   */
  static removeAttribute(attribute) {
    delete this.rawAttributes[attribute];
    this.refreshAttributes();
  }

  /**
   * Sync this Model to the DB, that is create the table.
   *
   * @param {object} [options] sync options
   *
   * @see
   * {@link Sequelize#sync} for options
   *
   * @returns {Promise<Model>}
   */
  static async sync(options) {
    options = { ...this.options, ...options };
    options.hooks = options.hooks === undefined ? true : !!options.hooks;

    const attributes = this.tableAttributes;
    const rawAttributes = this.fieldRawAttributesMap;

    if (options.hooks) {
      await this.runHooks('beforeSync', options);
    }
    if (options.force) {
      await this.drop(options);
    }

    const tableName = this.getTableName(options);

    await this.queryInterface.createTable(tableName, attributes, options, this);

    if (options.alter) {
      const tableInfos = await Promise.all([
        this.queryInterface.describeTable(tableName, options),
        this.queryInterface.getForeignKeyReferencesForTable(tableName, options)
      ]);
      const columns = tableInfos[0];
      // Use for alter foreign keys
      const foreignKeyReferences = tableInfos[1];
      const removedConstraints = {};

      for (const columnName in attributes) {
        if (!Object.prototype.hasOwnProperty.call(attributes, columnName)) continue;
        if (!columns[columnName] && !columns[attributes[columnName].field]) {
          await this.queryInterface.addColumn(tableName, attributes[columnName].field || columnName, attributes[columnName], options);
        }
      }

      if (options.alter === true || typeof options.alter === 'object' && options.alter.drop !== false) {
        for (const columnName in columns) {
          if (!Object.prototype.hasOwnProperty.call(columns, columnName)) continue;
          const currentAttribute = rawAttributes[columnName];
          if (!currentAttribute) {
            await this.queryInterface.removeColumn(tableName, columnName, options);
            continue;
          }
          if (currentAttribute.primaryKey) continue;
          // Check foreign keys. If it's a foreign key, it should remove constraint first.
          const references = currentAttribute.references;
          if (currentAttribute.references) {
            const database = this.sequelize.config.database;
            const schema = this.sequelize.config.schema;
            // Find existed foreign keys
            for (const foreignKeyReference of foreignKeyReferences) {
              const constraintName = foreignKeyReference.constraintName;
              if (!!constraintName
                && foreignKeyReference.tableCatalog === database
                && (schema ? foreignKeyReference.tableSchema === schema : true)
                && foreignKeyReference.referencedTableName === references.model
                && foreignKeyReference.referencedColumnName === references.key
                && (schema ? foreignKeyReference.referencedTableSchema === schema : true)
                && !removedConstraints[constraintName]) {
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
    let indexes = await this.queryInterface.showIndex(tableName, options);
    indexes = this._indexes.filter(item1 =>
      !indexes.some(item2 => item1.name === item2.name)
    ).sort((index1, index2) => {
      if (this.sequelize.options.dialect === 'postgres') {
      // move concurrent indexes to the bottom to avoid weird deadlocks
        if (index1.concurrently === true) return 1;
        if (index2.concurrently === true) return -1;
      }

      return 0;
    });

    for (const index of indexes) {
      await this.queryInterface.addIndex(tableName, { ...options, ...index });
    }

    if (options.hooks) {
      await this.runHooks('afterSync', options);
    }

    return this;
  }

  /**
   * Drop the table represented by this Model
   *
   * @param {object}   [options] drop options
   * @param {boolean}  [options.cascade=false]   Also drop all objects depending on this table, such as views. Only works in postgres
   * @param {Function} [options.logging=false]   A function that gets executed while running the query to log the sql.
   * @param {boolean}  [options.benchmark=false] Pass query execution time in milliseconds as second argument to logging function (options.logging).
   *
   * @returns {Promise}
   */
  static async drop(options) {
    return await this.queryInterface.dropTable(this.getTableName(options), options);
  }

  static async dropSchema(schema) {
    return await this.queryInterface.dropSchema(schema);
  }

  /**
   * Apply a schema to this model. For postgres, this will actually place the schema in front of the table name - `"schema"."tableName"`,
   * while the schema will be prepended to the table name for mysql and sqlite - `'schema.tablename'`.
   *
   * This method is intended for use cases where the same model is needed in multiple schemas. In such a use case it is important
   * to call `model.schema(schema, [options]).sync()` for each model to ensure the models are created in the correct schema.
   *
   * If a single default schema per model is needed, set the `options.schema='schema'` parameter during the `define()` call
   * for the model.
   *
   * @param {string}   schema The name of the schema
   * @param {object}   [options] schema options
   * @param {string}   [options.schemaDelimiter='.'] The character(s) that separates the schema name from the table name
   * @param {Function} [options.logging=false] A function that gets executed while running the query to log the sql.
   * @param {boolean}  [options.benchmark=false] Pass query execution time in milliseconds as second argument to logging function (options.logging).
   *
   * @see
   * {@link Sequelize#define} for more information about setting a default schema.
   *
   * @returns {Model}
   */
  static schema(schema, options) {

    const clone = class extends this {};
    Object.defineProperty(clone, 'name', { value: this.name });

    clone._schema = schema;

    if (options) {
      if (typeof options === 'string') {
        clone._schemaDelimiter = options;
      } else if (options.schemaDelimiter) {
        clone._schemaDelimiter = options.schemaDelimiter;
      }
    }

    return clone;
  }

  /**
   * Get the table name of the model, taking schema into account. The method will return The name as a string if the model has no schema,
   * or an object with `tableName`, `schema` and `delimiter` properties.
   *
   * @returns {string|object}
   */
  static getTableName() {
    return this.queryGenerator.addSchema(this);
  }

  /**
   * Get un-scoped model
   *
   * @returns {Model}
   */
  static unscoped() {
    return this.scope();
  }

  /**
   * Add a new scope to the model. This is especially useful for adding scopes with includes, when the model you want to include is not available at the time this model is defined.
   *
   * By default this will throw an error if a scope with that name already exists. Pass `override: true` in the options object to silence this error.
   *
   * @param {string}          name The name of the scope. Use `defaultScope` to override the default scope
   * @param {object|Function} scope scope or options
   * @param {object}          [options] scope options
   * @param {boolean}         [options.override=false] override old scope if already defined
   */
  static addScope(name, scope, options) {
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

  /**
   * Apply a scope created in `define` to the model.
   *
   * @example <caption>how to create scopes</caption>
   * const Model = sequelize.define('model', attributes, {
   *   defaultScope: {
   *     where: {
   *       username: 'dan'
   *     },
   *     limit: 12
   *   },
   *   scopes: {
   *     isALie: {
   *       where: {
   *         stuff: 'cake'
   *       }
   *     },
   *     complexFunction: function(email, accessLevel) {
   *       return {
   *         where: {
   *           email: {
   *             [Op.like]: email
   *           },
   *           access_level {
   *             [Op.gte]: accessLevel
   *           }
   *         }
   *       }
   *     }
   *   }
   * })
   *
   * # As you have defined a default scope, every time you do Model.find, the default scope is appended to your query. Here's a couple of examples:
   *
   * Model.findAll() // WHERE username = 'dan'
   * Model.findAll({ where: { age: { [Op.gt]: 12 } } }) // WHERE age > 12 AND username = 'dan'
   *
   * @example <caption>To invoke scope functions you can do</caption>
   * Model.scope({ method: ['complexFunction', 'dan@sequelize.com', 42]}).findAll()
   * // WHERE email like 'dan@sequelize.com%' AND access_level >= 42
   *
   * @param {?Array|object|string} [option] The scope(s) to apply. Scopes can either be passed as consecutive arguments, or as an array of arguments. To apply simple scopes and scope functions with no arguments, pass them as strings. For scope function, pass an object, with a `method` property. The value can either be a string, if the method does not take any arguments, or an array, where the first element is the name of the method, and consecutive elements are arguments to that method. Pass null to remove all scopes, including the default.
   *
   * @returns {Model} A reference to the model, with the scope(s) applied. Calling scope again on the returned model will clear the previous scope.
   */
  static scope(option) {
    const self = class extends this {};
    let scope;
    let scopeName;

    Object.defineProperty(self, 'name', { value: this.name });

    self._scope = {};
    self._scopeNames = [];
    self.scoped = true;

    if (!option) {
      return self;
    }

    const options = _.flatten(arguments);

    for (const option of options) {
      scope = null;
      scopeName = null;

      if (_.isPlainObject(option)) {
        if (option.method) {
          if (Array.isArray(option.method) && !!self.options.scopes[option.method[0]]) {
            scopeName = option.method[0];
            scope = self.options.scopes[scopeName].apply(self, option.method.slice(1));
          }
          else if (self.options.scopes[option.method]) {
            scopeName = option.method;
            scope = self.options.scopes[scopeName].apply(self);
          }
        } else {
          scope = option;
        }
      } else if (option === 'defaultScope' && _.isPlainObject(self.options.defaultScope)) {
        scope = self.options.defaultScope;
      } else {
        scopeName = option;
        scope = self.options.scopes[scopeName];
        if (typeof scope === 'function') {
          scope = scope();
        }
      }

      if (scope) {
        this._conformIncludes(scope, this);
        // clone scope so it doesn't get modified
        this._assignOptions(self._scope, Utils.cloneDeep(scope));
        self._scopeNames.push(scopeName ? scopeName : 'defaultScope');
      } else {
        throw new sequelizeErrors.SequelizeScopeError(`Invalid scope ${scopeName} called.`);
      }
    }

    return self;
  }

  /**
   * Search for multiple instances.
   *
   * @example <caption>Simple search using AND and =</caption>
   * Model.findAll({
   *   where: {
   *     attr1: 42,
   *     attr2: 'cake'
   *   }
   * })
   *
   * # WHERE attr1 = 42 AND attr2 = 'cake'
   *
   * @example <caption>Using greater than, less than etc.</caption>
   * const {gt, lte, ne, in: opIn} = Sequelize.Op;
   *
   * Model.findAll({
   *   where: {
   *     attr1: {
   *       [gt]: 50
   *     },
   *     attr2: {
   *       [lte]: 45
   *     },
   *     attr3: {
   *       [opIn]: [1,2,3]
   *     },
   *     attr4: {
   *       [ne]: 5
   *     }
   *   }
   * })
   *
   * # WHERE attr1 > 50 AND attr2 <= 45 AND attr3 IN (1,2,3) AND attr4 != 5
   *
   * @example <caption>Queries using OR</caption>
   * const {or, and, gt, lt} = Sequelize.Op;
   *
   * Model.findAll({
   *   where: {
   *     name: 'a project',
   *     [or]: [
   *       {id: [1, 2, 3]},
   *       {
   *         [and]: [
   *           {id: {[gt]: 10}},
   *           {id: {[lt]: 100}}
   *         ]
   *       }
   *     ]
   *   }
   * });
   *
   * # WHERE `Model`.`name` = 'a project' AND (`Model`.`id` IN (1, 2, 3) OR (`Model`.`id` > 10 AND `Model`.`id` < 100));
   *
   * @see
   * {@link Operators} for possible operators
   * __Alias__: _all_
   *
   * The promise is resolved with an array of Model instances if the query succeeds._
   *
   * @param  {object}                                                    [options] A hash of options to describe the scope of the search
   * @param  {object}                                                    [options.where] A hash of attributes to describe your search. See above for examples.
   * @param  {Array<string>|object}                                      [options.attributes] A list of the attributes that you want to select, or an object with `include` and `exclude` keys. To rename an attribute, you can pass an array, with two elements - the first is the name of the attribute in the DB (or some kind of expression such as `Sequelize.literal`, `Sequelize.fn` and so on), and the second is the name you want the attribute to have in the returned instance
   * @param  {Array<string>}                                             [options.attributes.include] Select all the attributes of the model, plus some additional ones. Useful for aggregations, e.g. `{ attributes: { include: [[sequelize.fn('COUNT', sequelize.col('id')), 'total']] }`
   * @param  {Array<string>}                                             [options.attributes.exclude] Select all the attributes of the model, except some few. Useful for security purposes e.g. `{ attributes: { exclude: ['password'] } }`
   * @param  {boolean}                                                   [options.paranoid=true] If true, only non-deleted records will be returned. If false, both deleted and non-deleted records will be returned. Only applies if `options.paranoid` is true for the model.
   * @param  {Array<object|Model|string>}                                [options.include] A list of associations to eagerly load using a left join. Supported is either `{ include: [ Model1, Model2, ...]}` or `{ include: [{ model: Model1, as: 'Alias' }]}` or `{ include: ['Alias']}`. If your association are set up with an `as` (eg. `X.hasMany(Y, { as: 'Z }`, you need to specify Z in the as attribute when eager loading Y).
   * @param  {Model}                                                     [options.include[].model] The model you want to eagerly load
   * @param  {string}                                                    [options.include[].as] The alias of the relation, in case the model you want to eagerly load is aliased. For `hasOne` / `belongsTo`, this should be the singular name, and for `hasMany`, it should be the plural
   * @param  {Association}                                               [options.include[].association] The association you want to eagerly load. (This can be used instead of providing a model/as pair)
   * @param  {object}                                                    [options.include[].where] Where clauses to apply to the child models. Note that this converts the eager load to an inner join, unless you explicitly set `required: false`
   * @param  {boolean}                                                   [options.include[].or=false] Whether to bind the ON and WHERE clause together by OR instead of AND.
   * @param  {object}                                                    [options.include[].on] Supply your own ON condition for the join.
   * @param  {Array<string>}                                             [options.include[].attributes] A list of attributes to select from the child model
   * @param  {boolean}                                                   [options.include[].required] If true, converts to an inner join, which means that the parent model will only be loaded if it has any matching children. True if `include.where` is set, false otherwise.
   * @param  {boolean}                                                   [options.include[].right] If true, converts to a right join if dialect support it. Ignored if `include.required` is true.
   * @param  {boolean}                                                   [options.include[].separate] If true, runs a separate query to fetch the associated instances, only supported for hasMany associations
   * @param  {number}                                                    [options.include[].limit] Limit the joined rows, only supported with include.separate=true
   * @param  {string}                                                    [options.include[].through.as] The alias for the join model, in case you want to give it a different name than the default one.
   * @param  {boolean}                                                   [options.include[].through.paranoid] If true, only non-deleted records will be returned from the join table. If false, both deleted and non-deleted records will be returned. Only applies if through model is paranoid.
   * @param  {object}                                                    [options.include[].through.where] Filter on the join model for belongsToMany relations
   * @param  {Array}                                                     [options.include[].through.attributes] A list of attributes to select from the join model for belongsToMany relations
   * @param  {Array<object|Model|string>}                                [options.include[].include] Load further nested related models
   * @param  {boolean}                                                   [options.include[].duplicating] Mark the include as duplicating, will prevent a subquery from being used.
   * @param  {Array|Sequelize.fn|Sequelize.col|Sequelize.literal}        [options.order] Specifies an ordering. Using an array, you can provide several columns / functions to order by. Each element can be further wrapped in a two-element array. The first element is the column / function to order by, the second is the direction. For example: `order: [['name', 'DESC']]`. In this way the column will be escaped, but the direction will not.
   * @param  {number}                                                    [options.limit] Limit for result
   * @param  {number}                                                    [options.offset] Offset for result
   * @param  {Transaction}                                               [options.transaction] Transaction to run query under
   * @param  {string|object}                                             [options.lock] Lock the selected rows. Possible options are transaction.LOCK.UPDATE and transaction.LOCK.SHARE. Postgres also supports transaction.LOCK.KEY_SHARE, transaction.LOCK.NO_KEY_UPDATE and specific model locks with joins.
   * @param  {boolean}                                                   [options.skipLocked] Skip locked rows. Only supported in Postgres.
   * @param  {boolean}                                                   [options.raw] Return raw result. See sequelize.query for more information.
   * @param  {Function}                                                  [options.logging=false] A function that gets executed while running the query to log the sql.
   * @param  {boolean}                                                   [options.benchmark=false] Pass query execution time in milliseconds as second argument to logging function (options.logging).
   * @param  {object}                                                    [options.having] Having options
   * @param  {string}                                                    [options.searchPath=DEFAULT] An optional parameter to specify the schema search_path (Postgres only)
   * @param  {boolean|Error}                                             [options.rejectOnEmpty=false] Throws an error when no records found
   * @param  {boolean}                                                   [options.dotNotation] Allows including tables having the same attribute/column names - which have a dot in them.
   *
   * @see
   * {@link Sequelize#query}
   *
   * @returns {Promise<Array<Model>>}
   */
  static async findAll(options) {
    if (options !== undefined && !_.isPlainObject(options)) {
      throw new sequelizeErrors.QueryError('The argument passed to findAll must be an options object, use findByPk if you wish to pass a single primary key value');
    }

    if (options !== undefined && options.attributes) {
      if (!Array.isArray(options.attributes) && !_.isPlainObject(options.attributes)) {
        throw new sequelizeErrors.QueryError('The attributes option must be an array of column names or an object');
      }
    }

    this.warnOnInvalidOptions(options, Object.keys(this.rawAttributes));

    const tableNames = {};

    tableNames[this.getTableName(options)] = true;
    options = Utils.cloneDeep(options);

    _.defaults(options, { hooks: true });

    // set rejectOnEmpty option, defaults to model options
    options.rejectOnEmpty = Object.prototype.hasOwnProperty.call(options, 'rejectOnEmpty')
      ? options.rejectOnEmpty
      : this.options.rejectOnEmpty;

    this._injectScope(options);

    if (options.hooks) {
      await this.runHooks('beforeFind', options);
    }
    this._conformIncludes(options, this);
    this._expandAttributes(options);
    this._expandIncludeAll(options);

    if (options.hooks) {
      await this.runHooks('beforeFindAfterExpandIncludeAll', options);
    }
    options.originalAttributes = this._injectDependentVirtualAttributes(options.attributes);

    if (options.include) {
      options.hasJoin = true;

      this._validateIncludedElements(options, tableNames);

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

    //rejectOnEmpty mode
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

  static warnOnInvalidOptions(options, validColumnNames) {
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
    if (!this._hasVirtualAttributes) return attributes;
    if (!attributes || !Array.isArray(attributes)) return attributes;

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
    if (!options.include || options.raw || !results) return results;

    const original = results;
    if (options.plain) results = [results];

    if (!results.length) return original;

    await Promise.all(options.include.map(async include => {
      if (!include.separate) {
        return await Model._findSeparate(
          results.reduce((memo, result) => {
            let associations = result.get(include.association.as);

            // Might be an empty belongsTo relation
            if (!associations) return memo;

            // Force array so we can concat no matter if it's 1:1 or :M
            if (!Array.isArray(associations)) associations = [associations];

            for (let i = 0, len = associations.length; i !== len; ++i) {
              memo.push(associations[i]);
            }
            return memo;
          }, []),
          {

            ..._.omit(options, 'include', 'attributes', 'order', 'where', 'limit', 'offset', 'plain', 'scope'),
            include: include.include || []
          }
        );
      }

      const map = await include.association.get(results, {

        ..._.omit(options, nonCascadingOptions),
        ..._.omit(include, ['parent', 'association', 'as', 'originalAttributes'])
      });

      for (const result of results) {
        result.set(
          include.association.as,
          map[result.get(include.association.sourceKey)],
          { raw: true }
        );
      }
    }));

    return original;
  }

  /**
   * Search for a single instance by its primary key._
   *
   * @param  {number|string|Buffer}      param The value of the desired instance's primary key.
   * @param  {object}                    [options] find options
   * @param  {Transaction}               [options.transaction] Transaction to run query under
   * @param  {string}                    [options.searchPath=DEFAULT] An optional parameter to specify the schema search_path (Postgres only)
   *
   * @see
   * {@link Model.findAll}           for a full explanation of options, Note that options.where is not supported.
   *
   * @returns {Promise<Model>}
   */
  static async findByPk(param, options) {
    // return Promise resolved with null if no arguments are passed
    if ([null, undefined].includes(param)) {
      return null;
    }

    options = Utils.cloneDeep(options) || {};

    if (typeof param === 'number' || typeof param === 'string' || Buffer.isBuffer(param)) {
      options.where = {
        [this.primaryKeyAttribute]: param
      };
    } else {
      throw new Error(`Argument passed to findByPk is invalid: ${param}`);
    }

    // Bypass a possible overloaded findOne
    return await this.findOne(options);
  }

  /**
   * Search for a single instance. Returns the first instance found, or null if none can be found.
   *
   * @param  {object}       [options] A hash of options to describe the scope of the search
   * @param  {Transaction}  [options.transaction] Transaction to run query under
   * @param  {string}       [options.searchPath=DEFAULT] An optional parameter to specify the schema search_path (Postgres only)
   *
   * @see
   * {@link Model.findAll} for an explanation of options
   *
   * @returns {Promise<Model|null>}
   */
  static async findOne(options) {
    if (options !== undefined && !_.isPlainObject(options)) {
      throw new Error('The argument passed to findOne must be an options object, use findByPk if you wish to pass a single primary key value');
    }
    options = Utils.cloneDeep(options);

    if (options.limit === undefined) {
      const uniqueSingleColumns = _.chain(this.uniqueKeys).values().filter(c => c.fields.length === 1).map('column').value();

      // Don't add limit if querying directly on the pk or a unique column
      if (!options.where || !_.some(options.where, (value, key) =>
        (key === this.primaryKeyAttribute || uniqueSingleColumns.includes(key)) &&
          (Utils.isPrimitive(value) || Buffer.isBuffer(value))
      )) {
        options.limit = 1;
      }
    }

    // Bypass a possible overloaded findAll.
    return await this.findAll(_.defaults(options, {
      plain: true
    }));
  }

  /**
   * Run an aggregation method on the specified field
   *
   * @param {string}          attribute The attribute to aggregate over. Can be a field name or *
   * @param {string}          aggregateFunction The function to use for aggregation, e.g. sum, max etc.
   * @param {object}          [options] Query options. See sequelize.query for full options
   * @param {object}          [options.where] A hash of search attributes.
   * @param {Function}        [options.logging=false] A function that gets executed while running the query to log the sql.
   * @param {boolean}         [options.benchmark=false] Pass query execution time in milliseconds as second argument to logging function (options.logging).
   * @param {DataTypes|string} [options.dataType] The type of the result. If `field` is a field in this Model, the default will be the type of that field, otherwise defaults to float.
   * @param {boolean}         [options.distinct] Applies DISTINCT to the field being aggregated over
   * @param {Transaction}     [options.transaction] Transaction to run query under
   * @param {boolean}         [options.plain] When `true`, the first returned value of `aggregateFunction` is cast to `dataType` and returned. If additional attributes are specified, along with `group` clauses, set `plain` to `false` to return all values of all returned rows.  Defaults to `true`
   *
   * @returns {Promise<DataTypes|object>} Returns the aggregate result cast to `options.dataType`, unless `options.plain` is false, in which case the complete data result is returned.
   */
  static async aggregate(attribute, aggregateFunction, options) {
    options = Utils.cloneDeep(options);

    // We need to preserve attributes here as the `injectScope` call would inject non aggregate columns.
    const prevAttributes = options.attributes;
    this._injectScope(options);
    options.attributes = prevAttributes;
    this._conformIncludes(options, this);

    if (options.include) {
      this._expandIncludeAll(options);
      this._validateIncludedElements(options);
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
      group = _.flatten(group);
    }
    options.attributes = _.unionBy(
      options.attributes,
      group,
      [[this.sequelize.fn(aggregateFunction, aggregateColumn), aggregateFunction]],
      a => Array.isArray(a) ? a[1] : a
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
   * @param {object}        [options.where] A hash of search attributes.
   * @param {object}        [options.include] Include options. See `find` for details
   * @param {boolean}       [options.paranoid=true] Set `true` to count only non-deleted records. Can be used on models with `paranoid` enabled
   * @param {boolean}       [options.distinct] Apply COUNT(DISTINCT(col)) on primary key or on options.col.
   * @param {string}        [options.col] Column on which COUNT() should be applied
   * @param {Array}         [options.attributes] Used in conjunction with `group`
   * @param {Array}         [options.group] For creating complex counts. Will return multiple rows as needed.
   * @param {Transaction}   [options.transaction] Transaction to run query under
   * @param {Function}      [options.logging=false] A function that gets executed while running the query to log the sql.
   * @param {boolean}       [options.benchmark=false] Pass query execution time in milliseconds as second argument to logging function (options.logging).
   * @param {string}        [options.searchPath=DEFAULT] An optional parameter to specify the schema search_path (Postgres only)
   *
   * @returns {Promise<number>}
   */
  static async count(options) {
    options = Utils.cloneDeep(options);
    options = _.defaults(options, { hooks: true });
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
        count: Number(item.count)
      }));
    }

    return result;
  }

  /**
   * Find all the rows matching your query, within a specified offset / limit, and get the total number of rows matching your query. This is very useful for paging
   *
   * @example
   * const result = await Model.findAndCountAll({
   *   where: ...,
   *   limit: 12,
   *   offset: 12
   * });
   *
   * # In the above example, `result.rows` will contain rows 13 through 24, while `result.count` will return the total number of rows that matched your query.
   *
   * # When you add includes, only those which are required (either because they have a where clause, or because `required` is explicitly set to true on the include) will be added to the count part.
   *
   * # Suppose you want to find all users who have a profile attached:
   *
   * User.findAndCountAll({
   *   include: [
   *      { model: Profile, required: true}
   *   ],
   *   limit: 3
   * });
   *
   * # Because the include for `Profile` has `required` set it will result in an inner join, and only the users who have a profile will be counted. If we remove `required` from the include, both users with and without profiles will be counted
   *
   * @param {object} [options] See findAll options
   *
   * @see
   * {@link Model.findAll} for a specification of find and query options
   * @see
   * {@link Model.count} for a specification of count options
   *
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
      this.findAll(options)
    ]);

    return {
      count,
      rows: count === 0 ? [] : rows
    };
  }

  /**
   * Find the maximum value of field
   *
   * @param {string} field attribute / field name
   * @param {object} [options] See aggregate
   *
   * @see
   * {@link Model.aggregate} for options
   *
   * @returns {Promise<*>}
   */
  static async max(field, options) {
    return await this.aggregate(field, 'max', options);
  }

  /**
   * Find the minimum value of field
   *
   * @param {string} field attribute / field name
   * @param {object} [options] See aggregate
   *
   * @see
   * {@link Model.aggregate} for options
   *
   * @returns {Promise<*>}
   */
  static async min(field, options) {
    return await this.aggregate(field, 'min', options);
  }

  /**
   * Find the sum of field
   *
   * @param {string} field attribute / field name
   * @param {object} [options] See aggregate
   *
   * @see
   * {@link Model.aggregate} for options
   *
   * @returns {Promise<number>}
   */
  static async sum(field, options) {
    return await this.aggregate(field, 'sum', options);
  }

  /**
   * Builds a new model instance.
   *
   * @param {object|Array} values An object of key value pairs or an array of such. If an array, the function will return an array of instances.
   * @param {object}  [options] Instance build options
   * @param {boolean} [options.raw=false] If set to true, values will ignore field and virtual setters.
   * @param {boolean} [options.isNewRecord=true] Is this new record
   * @param {Array}   [options.include] an array of include options - Used to build prefetched/included model instances. See `set`
   *
   * @returns {Model|Array<Model>}
   */
  static build(values, options) {
    if (Array.isArray(values)) {
      return this.bulkBuild(values, options);
    }

    return new this(values, options);
  }

  static bulkBuild(valueSets, options) {
    options = { isNewRecord: true, ...options };

    if (!options.includeValidated) {
      this._conformIncludes(options, this);
      if (options.include) {
        this._expandIncludeAll(options);
        this._validateIncludedElements(options);
      }
    }

    if (options.attributes) {
      options.attributes = options.attributes.map(attribute => Array.isArray(attribute) ? attribute[1] : attribute);
    }

    return valueSets.map(values => this.build(values, options));
  }

  /**
   * Builds a new model instance and calls save on it.
   *
   * @see
   * {@link Model.build}
   * @see
   * {@link Model.save}
   *
   * @param  {object}         values                       Hash of data values to create new record with
   * @param  {object}         [options]                    Build and query options
   * @param  {boolean}        [options.raw=false]          If set to true, values will ignore field and virtual setters.
   * @param  {boolean}        [options.isNewRecord=true]   Is this new record
   * @param  {Array}          [options.include]            An array of include options - Used to build prefetched/included model instances. See `set`
   * @param  {string[]}       [options.fields]             An optional array of strings, representing database columns. If fields is provided, only those columns will be validated and saved.
   * @param  {boolean}        [options.silent=false]       If true, the updatedAt timestamp will not be updated.
   * @param  {boolean}        [options.validate=true]      If false, validations won't be run.
   * @param  {boolean}        [options.hooks=true]         Run before and after create / update + validate hooks
   * @param  {Function}       [options.logging=false]      A function that gets executed while running the query to log the sql.
   * @param  {boolean}        [options.benchmark=false]    Pass query execution time in milliseconds as second argument to logging function (options.logging).
   * @param  {Transaction}    [options.transaction]        Transaction to run query under
   * @param  {string}         [options.searchPath=DEFAULT] An optional parameter to specify the schema search_path (Postgres only)
   * @param  {boolean|Array}  [options.returning=true]     Appends RETURNING <model columns> to get back all defined values; if an array of column names, append RETURNING <columns> to get back specific columns (Postgres only)
   *
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
      silent: options.silent
    }).save(options);
  }

  /**
   * Find a row that matches the query, or build (but don't save) the row if none is found.
   * The successful result of the promise will be (instance, built)
   *
   * @param {object}   options find options
   * @param {object}   options.where A hash of search attributes. If `where` is a plain object it will be appended with defaults to build a new instance.
   * @param {object}   [options.defaults] Default values to use if building a new instance
   * @param {object}   [options.transaction] Transaction to run query under
   *
   * @returns {Promise<Model,boolean>}
   */
  static async findOrBuild(options) {
    if (!options || !options.where || arguments.length > 1) {
      throw new Error(
        'Missing where attribute in the options parameter passed to findOrBuild. ' +
        'Please note that the API has changed, and is now options only (an object with where, defaults keys, transaction etc.)'
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
   * Find a row that matches the query, or build and save the row if none is found
   * The successful result of the promise will be (instance, created)
   *
   * If no transaction is passed in the `options` object, a new transaction will be created internally, to prevent the race condition where a matching row is created by another connection after the find but before the insert call.
   * However, it is not always possible to handle this case in SQLite, specifically if one transaction inserts and another tries to select before the first one has committed. In this case, an instance of sequelize. TimeoutError will be thrown instead.
   * If a transaction is created, a savepoint will be created instead, and any unique constraint violation will be handled internally.
   *
   * @see
   * {@link Model.findAll} for a full specification of find and options
   *
   * @param {object}      options find and create options
   * @param {object}      options.where where A hash of search attributes. If `where` is a plain object it will be appended with defaults to build a new instance.
   * @param {object}      [options.defaults] Default values to use if creating a new instance
   * @param {Transaction} [options.transaction] Transaction to run query under
   *
   * @returns {Promise<Model,boolean>}
   */
  static async findOrCreate(options) {
    if (!options || !options.where || arguments.length > 1) {
      throw new Error(
        'Missing where attribute in the options parameter passed to findOrCreate. ' +
        'Please note that the API has changed, and is now options only (an object with where, defaults keys, transaction etc.)'
      );
    }

    options = { ...options };

    if (options.defaults) {
      const defaults = Object.keys(options.defaults);
      const unknownDefaults = defaults.filter(name => !this.rawAttributes[name]);

      if (unknownDefaults.length) {
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
      } catch (err) {
        if (!(err instanceof sequelizeErrors.UniqueConstraintError)) throw err;
        const flattenedWhere = Utils.flattenObjectDeep(options.where);
        const flattenedWhereKeys = Object.keys(flattenedWhere).map(name => _.last(name.split('.')));
        const whereFields = flattenedWhereKeys.map(name => _.get(this.rawAttributes, `${name}.field`, name));
        const defaultFields = options.defaults && Object.keys(options.defaults)
          .filter(name => this.rawAttributes[name])
          .map(name => this.rawAttributes[name].field || name);

        const errFieldKeys = Object.keys(err.fields);
        const errFieldsWhereIntersects = Utils.intersects(errFieldKeys, whereFields);
        if (defaultFields && !errFieldsWhereIntersects && Utils.intersects(errFieldKeys, defaultFields)) {
          throw err;
        }

        if (errFieldsWhereIntersects) {
          _.each(err.fields, (value, key) => {
            const name = this.fieldRawAttributesMap[key].fieldName;
            if (value.toString() !== options.where[name].toString()) {
              throw new Error(`${this.name}#findOrCreate: value used for ${name} was not equal for both the find and the create calls, '${options.where[name]}' vs '${value}'`);
            }
          });
        }

        // Someone must have created a matching instance inside the same transaction since we last did a find. Let's find it!
        const otherCreated = await this.findOne(Utils.defaults({
          transaction: internalTransaction ? null : transaction
        }, options));

        // Sanity check, ideally we caught this at the defaultFeilds/err.fields check
        // But if we didn't and instance is null, we will throw
        if (otherCreated === null) throw err;

        return [otherCreated, false];
      }
    } finally {
      if (internalTransaction && transaction) {
        await transaction.commit();
      }
    }
  }

  /**
   * A more performant findOrCreate that may not work under a transaction (working in postgres)
   * Will execute a find call, if empty then attempt to create, if unique constraint then attempt to find again
   *
   * @see
   * {@link Model.findAll} for a full specification of find and options
   *
   * @param {object} options find options
   * @param {object} options.where A hash of search attributes. If `where` is a plain object it will be appended with defaults to build a new instance.
   * @param {object} [options.defaults] Default values to use if creating a new instance
   *
   * @returns {Promise<Model,boolean>}
   */
  static async findCreateFind(options) {
    if (!options || !options.where) {
      throw new Error(
        'Missing where attribute in the options parameter passed to findCreateFind.'
      );
    }

    let values = { ...options.defaults };
    if (_.isPlainObject(options.where)) {
      values = Utils.defaults(values, options.where);
    }


    const found = await this.findOne(options);
    if (found) return [found, false];

    try {
      const createOptions = { ...options };

      // To avoid breaking a postgres transaction, run the create with `ignoreDuplicates`.
      if (this.sequelize.options.dialect === 'postgres' && options.transaction) {
        createOptions.ignoreDuplicates = true;
      }

      const created = await this.create(values, createOptions);
      return [created, true];
    } catch (err) {
      if (!(err instanceof sequelizeErrors.UniqueConstraintError || err instanceof sequelizeErrors.EmptyResultError)) {
        throw err;
      }

      const foundAgain = await this.findOne(options);
      return [foundAgain, false];
    }
  }

  /**
   * Insert or update a single row. An update will be executed if a row which matches the supplied values on either the primary key or a unique key is found. Note that the unique index must be defined in your sequelize model and not just in the table. Otherwise you may experience a unique constraint violation, because sequelize fails to identify the row that should be updated.
   *
   * **Implementation details:**
   *
   * * MySQL - Implemented with ON DUPLICATE KEY UPDATE`
   * * PostgreSQL - Implemented with ON CONFLICT DO UPDATE. If update data contains PK field, then PK is selected as the default conflict key. Otherwise first unique constraint/index will be selected, which can satisfy conflict key requirements.
   * * SQLite - Implemented with ON CONFLICT DO UPDATE
   * * MSSQL - Implemented as a single query using `MERGE` and `WHEN (NOT) MATCHED THEN`
   *
   * **Note** that Postgres/SQLite returns null for created, no matter if the row was created or updated
   *
   * @param  {object}        values                                        hash of values to upsert
   * @param  {object}        [options]                                     upsert options
   * @param  {boolean}       [options.validate=true]                       Run validations before the row is inserted
   * @param  {Array}         [options.fields=Object.keys(this.attributes)] The fields to update if the record already exists. Defaults to all changed fields.  If none of the specified fields are present on the provided `values` object, an insert will still be attempted, but duplicate key conflicts will be ignored.
   * @param  {boolean}       [options.hooks=true]                          Run before / after upsert hooks?
   * @param  {boolean}       [options.returning=true]                      If true, fetches back auto generated values
   * @param  {Transaction}   [options.transaction]                         Transaction to run query under
   * @param  {Function}      [options.logging=false]                       A function that gets executed while running the query to log the sql.
   * @param  {boolean}       [options.benchmark=false]                     Pass query execution time in milliseconds as second argument to logging function (options.logging).
   * @param  {string}        [options.searchPath=DEFAULT]                  An optional parameter to specify the schema search_path (Postgres only)
   * @param  {Array<string>} [options.conflictFields]                      Optional override for the conflict fields in the ON CONFLICT part of the query. Only supported in Postgres >= 9.5 and SQLite >= 3.24.0
   *
   * @returns {Promise<Array<Model, boolean | null>>} returns an array with two elements, the first being the new record and the second being `true` if it was just created or `false` if it already existed (except on Postgres and SQLite, which can't detect this and will always return `null` instead of a boolean).
   */
  static async upsert(values, options) {
    options = {
      hooks: true,
      returning: true,
      validate: true,
      ...Utils.cloneDeep(options)
    };

    const createdAtAttr = this._timestampAttributes.createdAt;
    const updatedAtAttr = this._timestampAttributes.updatedAt;
    const hasPrimary = this.primaryKeyField in values || this.primaryKeyAttribute in values;
    const instance = this.build(values);

    options.model = this;
    options.instance = instance;

    const changed = Array.from(instance._changed);
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
    const now = Utils.now(this.sequelize.options.dialect);

    // Attach createdAt
    if (createdAtAttr && !insertValues[createdAtAttr]) {
      const field = this.rawAttributes[createdAtAttr].field || createdAtAttr;
      insertValues[field] = this._getDefaultTimestamp(createdAtAttr) || now;
    }
    if (updatedAtAttr && !insertValues[updatedAtAttr]) {
      const field = this.rawAttributes[updatedAtAttr].field || updatedAtAttr;
      insertValues[field] = updateValues[field] = this._getDefaultTimestamp(updatedAtAttr) || now;
    }

    // Db2 does not allow NULL values for unique columns.
    // Add dummy values if not provided by test case or user.
    if (this.sequelize.options.dialect === 'db2') {
      this.uniqno = this.sequelize.dialect.queryGenerator.addUniqueFields(
        insertValues, this.rawAttributes, this.uniqno);
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
   * Create and insert multiple instances in bulk.
   *
   * The success handler is passed an array of instances, but please notice that these may not completely represent the state of the rows in the DB. This is because MySQL
   * and SQLite do not make it easy to obtain back automatically generated IDs and other default values in a way that can be mapped to multiple records.
   * To obtain Instances for the newly created values, you will need to query for them again.
   *
   * If validation fails, the promise is rejected with an array-like AggregateError
   *
   * @param  {Array}          records                          List of objects (key/value pairs) to create instances from
   * @param  {object}         [options]                        Bulk create options
   * @param  {Array}          [options.fields]                 Fields to insert (defaults to all fields)
   * @param  {boolean}        [options.validate=false]         Should each row be subject to validation before it is inserted. The whole insert will fail if one row fails validation
   * @param  {boolean}        [options.hooks=true]             Run before / after bulk create hooks?
   * @param  {boolean}        [options.individualHooks=false]  Run before / after create hooks for each individual Instance? BulkCreate hooks will still be run if options.hooks is true.
   * @param  {boolean}        [options.ignoreDuplicates=false] Ignore duplicate values for primary keys? (not supported by MSSQL or Postgres < 9.5)
   * @param  {Array}          [options.updateOnDuplicate]      Fields to update if row key already exists (on duplicate key update)? (only supported by MySQL, MariaDB, SQLite >= 3.24.0 & Postgres >= 9.5). 
   * @param  {Transaction}    [options.transaction]            Transaction to run query under
   * @param  {Function}       [options.logging=false]          A function that gets executed while running the query to log the sql.
   * @param  {boolean}        [options.benchmark=false]        Pass query execution time in milliseconds as second argument to logging function (options.logging).
   * @param  {boolean|Array}  [options.returning=false]        If true, append RETURNING <model columns> to get back all defined values; if an array of column names, append RETURNING <columns> to get back specific columns (Postgres only)
   * @param  {string}         [options.searchPath=DEFAULT]     An optional parameter to specify the schema search_path (Postgres only)
   *
   * @returns {Promise<Array<Model>>}
   */
  static async bulkCreate(records, options = {}) {
    if (!records.length) {
      return [];
    }

    const dialect = this.sequelize.options.dialect;
    const now = Utils.now(this.sequelize.options.dialect);
    options = Utils.cloneDeep(options);

    options.model = this;

    if (!options.includeValidated) {
      this._conformIncludes(options, this);
      if (options.include) {
        this._expandIncludeAll(options);
        this._validateIncludedElements(options);
      }
    }

    const instances = records.map(values => this.build(values, { isNewRecord: true, include: options.include }));

    const recursiveBulkCreate = async (instances, options) => {
      options = {
        validate: false,
        hooks: true,
        individualHooks: false,
        ignoreDuplicates: false,
        ...options
      };

      if (options.returning === undefined) {
        if (options.association) {
          options.returning = false;
        } else {
          options.returning = true;
        }
      }

      if (options.ignoreDuplicates && ['mssql', 'db2'].includes(dialect)) {
        throw new Error(`${dialect} does not support the ignoreDuplicates option.`);
      }
      if (options.updateOnDuplicate && (dialect !== 'mysql' && dialect !== 'mariadb' && dialect !== 'sqlite' && dialect !== 'postgres')) {
        throw new Error(`${dialect} does not support the updateOnDuplicate option.`);
      }

      const model = options.model;

      options.fields = options.fields || Object.keys(model.rawAttributes);
      const createdAtAttr = model._timestampAttributes.createdAt;
      const updatedAtAttr = model._timestampAttributes.updatedAt;

      if (options.updateOnDuplicate !== undefined) {
        if (Array.isArray(options.updateOnDuplicate) && options.updateOnDuplicate.length) {
          options.updateOnDuplicate = _.intersection(
            _.without(Object.keys(model.tableAttributes), createdAtAttr),
            options.updateOnDuplicate
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
          } catch (err) {
            errors.push(new sequelizeErrors.BulkRecordError(err, instance));
          }
        }));

        delete options.skip;
        if (errors.length) {
          throw new sequelizeErrors.AggregateError(errors);
        }
      }
      if (options.individualHooks) {
        await Promise.all(instances.map(async instance => {
          const individualOptions = {
            ...options,
            validate: false,
            hooks: true
          };
          delete individualOptions.fields;
          delete individualOptions.individualHooks;
          delete individualOptions.ignoreDuplicates;

          await instance.save(individualOptions);
        }));
      } else {
        if (options.include && options.include.length) {
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

            if (!associationInstances.length) {
              return;
            }

            const includeOptions = _(Utils.cloneDeep(include))
              .omit(['association'])
              .defaults({
                transaction: options.transaction,
                logging: options.logging
              }).value();

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

          for (const i of model._indexes) {
            if (i.unique && !i.where) { // Don't infer partial indexes
              upsertKeys.push(...i.fields);
            }
          }

          const firstUniqueKey = Object.values(model.uniqueKeys).find(c => c.fields.length > 0);

          if (firstUniqueKey && firstUniqueKey.fields) {
            upsertKeys.push(...firstUniqueKey.fields);
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
          results.forEach((result, i) => {
            const instance = instances[i];

            for (const key in result) {
              if (!instance || key === model.primaryKeyAttribute &&
                instance.get(model.primaryKeyAttribute) &&
                ['mysql', 'mariadb', 'sqlite'].includes(dialect)) {
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
          });
        }
      }

      if (options.include && options.include.length) {
        await Promise.all(options.include.filter(include => !(include.association instanceof BelongsTo ||
          include.parent && include.parent.association instanceof BelongsToMany)).map(async include => {
          const associationInstances = [];
          const associationInstanceIndexToInstanceMap = [];

          for (const instance of instances) {
            let associated = instance.get(include.as);
            if (!Array.isArray(associated)) associated = [associated];

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

          if (!associationInstances.length) {
            return;
          }

          const includeOptions = _(Utils.cloneDeep(include))
            .omit(['association'])
            .defaults({
              transaction: options.transaction,
              logging: options.logging
            }).value();

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
                ...include.association.through.scope
              };
              if (associationInstance[include.association.through.model.name]) {
                for (const attr of Object.keys(include.association.through.model.rawAttributes)) {
                  if (include.association.through.model.rawAttributes[attr]._autoGenerated ||
                    attr === include.association.foreignKey ||
                    attr === include.association.otherKey ||
                    typeof associationInstance[include.association.through.model.name][attr] === undefined) {
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
                logging: options.logging
              }).value();
            throughOptions.model = include.association.throughModel;
            const throughInstances = include.association.throughModel.bulkBuild(valueSets, throughOptions);

            await recursiveBulkCreate(throughInstances, throughOptions);
          }
        }));
      }

      // map fields back to attributes
      instances.forEach(instance => {
        for (const attr in model.rawAttributes) {
          if (model.rawAttributes[attr].field &&
              instance.dataValues[model.rawAttributes[attr].field] !== undefined &&
              model.rawAttributes[attr].field !== attr
          ) {
            instance.dataValues[attr] = instance.dataValues[model.rawAttributes[attr].field];
            delete instance.dataValues[model.rawAttributes[attr].field];
          }
          instance._previousDataValues[attr] = instance.dataValues[attr];
          instance.changed(attr, false);
        }
        instance.isNewRecord = false;
      });

      // Run after hook
      if (options.hooks) {
        await model.runHooks('afterBulkCreate', instances, options);
      }

      return instances;
    };

    return await recursiveBulkCreate(instances, options);
  }

  /**
   * Truncate all instances of the model. This is a convenient method for Model.destroy({ truncate: true }).
   *
   * @param {object}           [options] The options passed to Model.destroy in addition to truncate
   * @param {boolean|Function} [options.cascade = false] Truncates all tables that have foreign-key references to the named table, or to any tables added to the group due to CASCADE.
   * @param {boolean}          [options.restartIdentity=false] Automatically restart sequences owned by columns of the truncated table.
   * @param {Transaction}      [options.transaction] Transaction to run query under
   * @param {boolean|Function} [options.logging] A function that logs sql queries, or false for no logging
   * @param {boolean}          [options.benchmark=false] Pass query execution time in milliseconds as second argument to logging function (options.logging).
   * @param {string}           [options.searchPath=DEFAULT] An optional parameter to specify the schema search_path (Postgres only)
   *
   * @returns {Promise}
   *
   * @see
   * {@link Model.destroy} for more information
   */
  static async truncate(options) {
    options = Utils.cloneDeep(options) || {};
    options.truncate = true;
    return await this.destroy(options);
  }

  /**
   * Delete multiple instances, or set their deletedAt timestamp to the current time if `paranoid` is enabled.
   *
   * @param  {object}       options                         destroy options
   * @param  {object}       [options.where]                 Filter the destroy
   * @param  {boolean}      [options.hooks=true]            Run before / after bulk destroy hooks?
   * @param  {boolean}      [options.individualHooks=false] If set to true, destroy will SELECT all records matching the where parameter and will execute before / after destroy hooks on each row
   * @param  {number}       [options.limit]                 How many rows to delete
   * @param  {boolean}      [options.force=false]           Delete instead of setting deletedAt to current timestamp (only applicable if `paranoid` is enabled)
   * @param  {boolean}      [options.truncate=false]        If set to true, dialects that support it will use TRUNCATE instead of DELETE FROM. If a table is truncated the where and limit options are ignored
   * @param  {boolean}      [options.cascade=false]         Only used in conjunction with TRUNCATE. Truncates  all tables that have foreign-key references to the named table, or to any tables added to the group due to CASCADE.
   * @param  {boolean}      [options.restartIdentity=false] Only used in conjunction with TRUNCATE. Automatically restart sequences owned by columns of the truncated table.
   * @param  {Transaction}  [options.transaction] Transaction to run query under
   * @param  {Function}     [options.logging=false]         A function that gets executed while running the query to log the sql.
   * @param  {boolean}      [options.benchmark=false]       Pass query execution time in milliseconds as second argument to logging function (options.logging).
   *
   * @returns {Promise<number>} The number of destroyed rows
   */
  static async destroy(options) {
    options = Utils.cloneDeep(options);

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
      restartIdentity: false
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
        [field]: Object.prototype.hasOwnProperty.call(deletedAtAttribute, 'defaultValue') ? deletedAtAttribute.defaultValue : null
      };


      attrValueHash[field] = Utils.now(this.sequelize.options.dialect);
      result = await this.queryInterface.bulkUpdate(this.getTableName(options), attrValueHash, Object.assign(where, options.where), options, this.rawAttributes);
    } else {
      result = await this.queryInterface.bulkDelete(this.getTableName(options), options.where, options, this);
    }
    // Run afterDestroy hook on each record individually
    if (options.individualHooks) {
      await Promise.all(
        instances.map(instance => this.runHooks('afterDestroy', instance, options))
      );
    }
    // Run after hook
    if (options.hooks) {
      await this.runHooks('afterBulkDestroy', options);
    }
    return result;
  }

  /**
   * Restore multiple instances if `paranoid` is enabled.
   *
   * @param  {object}       options                         restore options
   * @param  {object}       [options.where]                 Filter the restore
   * @param  {boolean}      [options.hooks=true]            Run before / after bulk restore hooks?
   * @param  {boolean}      [options.individualHooks=false] If set to true, restore will find all records within the where parameter and will execute before / after bulkRestore hooks on each row
   * @param  {number}       [options.limit]                 How many rows to undelete (only for mysql)
   * @param  {Function}     [options.logging=false]         A function that gets executed while running the query to log the sql.
   * @param  {boolean}      [options.benchmark=false]       Pass query execution time in milliseconds as second argument to logging function (options.logging).
   * @param  {Transaction}  [options.transaction]           Transaction to run query under
   *
   * @returns {Promise}
   */
  static async restore(options) {
    if (!this._timestampAttributes.deletedAt) throw new Error('Model is not paranoid');

    options = {
      hooks: true,
      individualHooks: false,
      ...options
    };

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
        instances.map(instance => this.runHooks('afterRestore', instance, options))
      );
    }
    // Run after hook
    if (options.hooks) {
      await this.runHooks('afterBulkRestore', options);
    }
    return result;
  }

  /**
   * Update multiple instances that match the where options.
   *
   * @param  {object}         values                          hash of values to update
   * @param  {object}         options                         update options
   * @param  {object}         options.where                   Options to describe the scope of the search.
   * @param  {boolean}        [options.paranoid=true]         If true, only non-deleted records will be updated. If false, both deleted and non-deleted records will be updated. Only applies if `options.paranoid` is true for the model.
   * @param  {Array}          [options.fields]                Fields to update (defaults to all fields)
   * @param  {boolean}        [options.validate=true]         Should each row be subject to validation before it is inserted. The whole insert will fail if one row fails validation
   * @param  {boolean}        [options.hooks=true]            Run before / after bulk update hooks?
   * @param  {boolean}        [options.sideEffects=true]      Whether or not to update the side effects of any virtual setters.
   * @param  {boolean}        [options.individualHooks=false] Run before / after update hooks?. If true, this will execute a SELECT followed by individual UPDATEs. A select is needed, because the row data needs to be passed to the hooks
   * @param  {boolean|Array}  [options.returning=false]       If true, append RETURNING <model columns> to get back all defined values; if an array of column names, append RETURNING <columns> to get back specific columns (Postgres only)
   * @param  {number}         [options.limit]                 How many rows to update (only for mysql and mariadb, implemented as TOP(n) for MSSQL; for sqlite it is supported only when rowid is present)
   * @param  {Function}       [options.logging=false]         A function that gets executed while running the query to log the sql.
   * @param  {boolean}        [options.benchmark=false]       Pass query execution time in milliseconds as second argument to logging function (options.logging).
   * @param  {Transaction}    [options.transaction]           Transaction to run query under
   * @param  {boolean}        [options.silent=false]          If true, the updatedAt timestamp will not be updated.
   *
   * @returns {Promise<Array<number,number>>}  The promise returns an array with one or two elements. The first element is always the number
   * of affected rows, while the second element is the actual affected rows (only supported in postgres with `options.returning` true).
   *
   */
  static async update(values, options) {
    options = Utils.cloneDeep(options);

    this._injectScope(options);
    this._optionsMustContainWhere(options);

    options = this._paranoidClause(this, _.defaults(options, {
      validate: true,
      hooks: true,
      individualHooks: false,
      returning: false,
      force: false,
      sideEffects: true
    }));

    options.type = QueryTypes.BULKUPDATE;

    // Clone values so it doesn't get modified for caller scope and ignore undefined values
    values = _.omitBy(values, value => value === undefined);

    // Remove values that are not in the options.fields
    if (options.fields && options.fields instanceof Array) {
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
      values[this._timestampAttributes.updatedAt] = this._getDefaultTimestamp(this._timestampAttributes.updatedAt) || Utils.now(this.sequelize.options.dialect);
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
        paranoid: options.paranoid
      });

      if (instances.length) {
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
          if (keys.length) {
            // Hooks change values - record changes in valuesUse so they are executed
            valuesUse = changedValues;
            options.fields = _.union(options.fields, keys);
          }
        } else {
          instances = await Promise.all(instances.map(async instance => {
            const individualOptions = {
              ...options,
              hooks: false,
              validate: false
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
   * Run a describe query on the table.
   *
   * @param {string} [schema] schema name to search table in
   * @param {object} [options] query options
   *
   * @returns {Promise} hash of attributes and their types
   */
  static async describe(schema, options) {
    return await this.queryInterface.describeTable(this.tableName, { schema: schema || this._schema || undefined, ...options });
  }

  static _getDefaultTimestamp(attr) {
    if (!!this.rawAttributes[attr] && !!this.rawAttributes[attr].defaultValue) {
      return Utils.toDefaultValue(this.rawAttributes[attr].defaultValue, this.sequelize.options.dialect);
    }
    return undefined;
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
    this._defaultsOptions(options, scope);
  }

  static [Symbol.for('nodejs.util.inspect.custom')]() {
    return this.name;
  }

  static hasAlias(alias) {
    return Object.prototype.hasOwnProperty.call(this.associations, alias);
  }

  /**
   * Increment the value of one or more columns. This is done in the database, which means it does not use the values currently stored on the Instance. The increment is done using a
   * ``` SET column = column + X WHERE foo = 'bar' ``` query. To get the correct value after an increment into the Instance you should do a reload.
   *
   * @example <caption>increment number by 1</caption>
   * Model.increment('number', { where: { foo: 'bar' });
   *
   * @example <caption>increment number and count by 2</caption>
   * Model.increment(['number', 'count'], { by: 2, where: { foo: 'bar' } });
   *
   * @example <caption>increment answer by 42, and decrement tries by 1</caption>
   * // `by` is ignored, as each column has its own value
   * Model.increment({ answer: 42, tries: -1}, { by: 2, where: { foo: 'bar' } });
   *
   * @see
   * {@link Model#reload}
   *
   * @param  {string|Array|object}  fields                       If a string is provided, that column is incremented by the value of `by` given in options. If an array is provided, the same is true for each column. If and object is provided, each column is incremented by the value given.
   * @param  {object}               options                      increment options
   * @param  {object}               options.where                conditions hash
   * @param  {number}               [options.by=1]               The number to increment by
   * @param  {boolean}              [options.silent=false]       If true, the updatedAt timestamp will not be updated.
   * @param  {Function}             [options.logging=false]      A function that gets executed while running the query to log the sql.
   * @param  {Transaction}          [options.transaction]        Transaction to run query under
   * @param  {string}               [options.searchPath=DEFAULT] An optional parameter to specify the schema search_path (Postgres only)
   *
   * @returns {Promise<Model[],?number>} returns an array of affected rows and affected count with `options.returning` true, whenever supported by dialect
   */
  static async increment(fields, options) {
    options = options || {};
    if (typeof fields === 'string') fields = [fields];
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
      increment: true
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
      extraAttributesToBeUpdated[attrName] = this._getDefaultTimestamp(updatedAtAttr) || Utils.now(this.sequelize.options.dialect);
    }

    const tableName = this.getTableName(options);
    let affectedRows;
    if (isSubtraction) {
      affectedRows = await this.queryInterface.decrement(
        this, tableName, where, incrementAmountsByField, extraAttributesToBeUpdated, options
      );
    } else {
      affectedRows = await this.queryInterface.increment(
        this, tableName, where, incrementAmountsByField, extraAttributesToBeUpdated, options
      );
    }

    if (options.returning) {
      return [affectedRows, affectedRows.length];
    }

    return [affectedRows];
  }

  /**
   * Decrement the value of one or more columns. This is done in the database, which means it does not use the values currently stored on the Instance. The decrement is done using a
   * ```sql SET column = column - X WHERE foo = 'bar'``` query. To get the correct value after a decrement into the Instance you should do a reload.
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
   * @param {string|Array|object} fields If a string is provided, that column is incremented by the value of `by` given in options. If an array is provided, the same is true for each column. If and object is provided, each column is incremented by the value given.
   * @param {object} options decrement options, similar to increment
   *
   * @see
   * {@link Model.increment}
   * @see
   * {@link Model#reload}
   * @since 4.36.0
   *
   * @returns {Promise<Model[],?number>} returns an array of affected rows and affected count with `options.returning` true, whenever supported by dialect
   */
  static async decrement(fields, options) {
    return this.increment(fields, {
      by: 1,
      ...options,
      increment: false
    });
  }

  static _optionsMustContainWhere(options) {
    assert(options && options.where, 'Missing where attribute in the options parameter');
    assert(_.isPlainObject(options.where) || Array.isArray(options.where) || options.where instanceof Utils.SequelizeMethod,
      'Expected plain object, array or sequelize method in the options.where parameter');
  }

  /**
   * Get an object representing the query for this instance, use with `options.where`
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
   * Get the value of the underlying data value
   *
   * @param {string} key key to look in instance data store
   *
   * @returns {any}
   */
  getDataValue(key) {
    return this.dataValues[key];
  }

  /**
   * Update the underlying data value
   *
   * @param {string} key key to set in instance data store
   * @param {any} value new value for given key
   *
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
   * If key is given and a field or virtual getter is present for the key it will call that getter - else it will return the value for key.
   *
   * @param {string}  [key] key to get value of
   * @param {object}  [options] get options
   * @param {boolean} [options.plain=false] If set to true, included instances will be returned as plain objects
   * @param {boolean} [options.raw=false] If set to true, field and virtual setters will be ignored
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
   * Set is used to update values on the instance (the sequelize representation of the instance that is, remember that nothing will be persisted before you actually call `save`).
   * In its most basic form `set` will update a value stored in the underlying `dataValues` object. However, if a custom setter function is defined for the key, that function
   * will be called instead. To bypass the setter, you can pass `raw: true` in the options object.
   *
   * If set is called with an object, it will loop over the object, and call set recursively for each key, value pair. If you set raw to true, the underlying dataValues will either be
   * set directly to the object passed, or used to extend dataValues, if dataValues already contain values.
   *
   * When set is called, the previous value of the field is stored and sets a changed flag(see `changed`).
   *
   * Set can also be used to build instances for associations, if you have values for those.
   * When using set with associations you need to make sure the property key matches the alias of the association
   * while also making sure that the proper include options have been set (from .build() or .findOne())
   *
   * If called with a dot.separated key on a JSON/JSONB attribute it will set the value nested and flag the entire object as changed.
   *
   * @see
   * {@link Model.findAll} for more information about includes
   *
   * @param {string|object} key key to set, it can be string or object. When string it will set that key, for object it will loop over all object properties nd set them.
   * @param {any} value value to set
   * @param {object} [options] set options
   * @param {boolean} [options.raw=false] If set to true, field and virtual setters will be ignored
   * @param {boolean} [options.reset=false] Clear all previously set data values
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
        if (Object.keys(this.dataValues).length) {
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
    if (!options)
      options = {};
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
        !options.raw &&
        (
          // True when sequelize method
          value instanceof Utils.SequelizeMethod ||
          // Check for data type type comparators
          !(value instanceof Utils.SequelizeMethod) && this.constructor._dataTypeChanges[key] && this.constructor._dataTypeChanges[key].call(this, value, originalValue, options) || // Check default
          !this.constructor._dataTypeChanges[key] && !_.isEqual(value, originalValue)
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
   * If changed is called with a string it will return a boolean indicating whether the value of that key in `dataValues` is different from the value in `_previousDataValues`.
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
        return Array.from(this._changed);
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
    if (!Array.isArray(value)) value = [value];
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
      attributes: include.originalAttributes
    };
    let isEmpty;

    if (include.originalAttributes === undefined || include.originalAttributes.length) {
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
   * Returns a Promise that resolves to the saved instance (or rejects with a `Sequelize.ValidationError`, which will have a property for each of the fields for which the validation failed, with the error message for that field).
   *
   * This method is optimized to perform an UPDATE only into the fields that changed. If nothing has changed, no SQL query will be performed.
   *
   * This method is not aware of eager loaded associations. In other words, if some other model instance (child) was eager loaded with this instance (parent), and you change something in the child, calling `save()` will simply ignore the change that happened on the child.
   *
   * @param {object}      [options] save options
   * @param {string[]}    [options.fields] An optional array of strings, representing database columns. If fields is provided, only those columns will be validated and saved.
   * @param {boolean}     [options.silent=false] If true, the updatedAt timestamp will not be updated.
   * @param {boolean}     [options.validate=true] If false, validations won't be run.
   * @param {boolean}     [options.hooks=true] Run before and after create / update + validate hooks
   * @param {Function}    [options.logging=false] A function that gets executed while running the query to log the sql.
   * @param {Transaction} [options.transaction] Transaction to run query under
   * @param {string}      [options.searchPath=DEFAULT] An optional parameter to specify the schema search_path (Postgres only)
   * @param {boolean}     [options.returning] Append RETURNING * to get back auto generated values (Postgres only)
   *
   * @returns {Promise<Model>}
   */
  async save(options) {
    if (arguments.length > 1) {
      throw new Error('The second argument was removed in favor of the options object.');
    }

    options = Utils.cloneDeep(options);
    options = _.defaults(options, {
      hooks: true,
      validate: true
    });

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
    const now = Utils.now(this.sequelize.options.dialect);
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

    if (this.isNewRecord === false) {
      if (primaryKeyName && this.get(primaryKeyName, { raw: true }) === undefined) {
        throw new Error('You attempted to save an instance with no primary key, this is not allowed since it would result in a global update');
      }
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
        this.dataValues, this.constructor.rawAttributes, this.uniqno);
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

      if (hookChanged) {
        if (options.validate) {
          // Validate again

          options.skip = _.difference(Object.keys(this.constructor.rawAttributes), hookChanged);
          await this.validate(options);
          delete options.skip;
        }
      }
    }
    if (options.fields.length && this.isNewRecord && this._options.include && this._options.include.length) {
      await Promise.all(this._options.include.filter(include => include.association instanceof BelongsTo).map(async include => {
        const instance = this.get(include.as);
        if (!instance) return;

        const includeOptions = _(Utils.cloneDeep(include))
          .omit(['association'])
          .defaults({
            transaction: options.transaction,
            logging: options.logging,
            parentRecord: this
          }).value();

        await instance.save(includeOptions);

        await this[include.association.accessors.set](instance, { save: false, logging: options.logging });
      }));
    }
    const realFields = options.fields.filter(field => !this.constructor._virtualAttributes.has(field));
    if (!realFields.length) return this;
    if (!this.changed() && !this.isNewRecord) return this;

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
        values[versionFieldName] = parseInt(values[versionFieldName], 10) + 1;
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
          where
        });
      } else {
        result.dataValues[versionAttr] = values[versionFieldName];
      }
    }

    // Transfer database generated values (defaults, autoincrement, etc)
    for (const attr of Object.keys(this.constructor.rawAttributes)) {
      if (this.constructor.rawAttributes[attr].field &&
          values[this.constructor.rawAttributes[attr].field] !== undefined &&
          this.constructor.rawAttributes[attr].field !== attr
      ) {
        values[attr] = values[this.constructor.rawAttributes[attr].field];
        delete values[this.constructor.rawAttributes[attr].field];
      }
    }
    Object.assign(values, result.dataValues);

    Object.assign(result.dataValues, values);
    if (wasNewRecord && this._options.include && this._options.include.length) {
      await Promise.all(
        this._options.include.filter(include => !(include.association instanceof BelongsTo ||
          include.parent && include.parent.association instanceof BelongsToMany)).map(async include => {
          let instances = this.get(include.as);

          if (!instances) return;
          if (!Array.isArray(instances)) instances = [instances];

          const includeOptions = _(Utils.cloneDeep(include))
            .omit(['association'])
            .defaults({
              transaction: options.transaction,
              logging: options.logging,
              parentRecord: this
            }).value();

          // Instances will be updated in place so we can safely treat HasOne like a HasMany
          await Promise.all(instances.map(async instance => {
            if (include.association instanceof BelongsToMany) {
              await instance.save(includeOptions);
              const values0 = {
                [include.association.foreignKey]: this.get(this.constructor.primaryKeyAttribute, { raw: true }),
                [include.association.otherKey]: instance.get(instance.constructor.primaryKeyAttribute, { raw: true }),
                // Include values defined in the association
                ...include.association.through.scope
              };

              if (instance[include.association.through.model.name]) {
                for (const attr of Object.keys(include.association.through.model.rawAttributes)) {
                  if (include.association.through.model.rawAttributes[attr]._autoGenerated ||
                    attr === include.association.foreignKey ||
                    attr === include.association.otherKey ||
                    typeof instance[include.association.through.model.name][attr] === undefined) {
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
        })
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
   * Refresh the current instance in-place, i.e. update the object with current data from the DB and return the same object.
   * This is different from doing a `find(Instance.id)`, because that would create and return a new instance. With this method,
   * all references to the Instance are updated with the new data and no new objects are created.
   *
   * @see
   * {@link Model.findAll}
   *
   * @param {object} [options] Options that are passed on to `Model.find`
   * @param {Function} [options.logging=false] A function that gets executed while running the query to log the sql.
   *
   * @returns {Promise<Model>}
   */
  async reload(options) {
    options = Utils.defaults({
      where: this.where()
    }, options, {
      include: this._options.include || undefined
    });

    const reloaded = await this.constructor.findOne(options);
    if (!reloaded) {
      throw new sequelizeErrors.InstanceError(
        'Instance could not be reloaded because it does not exist anymore (find call returned null)'
      );
    }
    // update the internal options of the instance
    this._options = reloaded._options;
    // re-set instance values
    this.set(reloaded.dataValues, {
      raw: true,
      reset: true && !options.attributes
    });

    return this;
  }

  /**
  * Validate the attributes of this instance according to validation rules set in the model definition.
  *
  * The promise fulfills if and only if validation successful; otherwise it rejects an Error instance containing { field name : [error msgs] } entries.
  *
  * @param {object} [options] Options that are passed to the validator
  * @param {Array} [options.skip] An array of strings. All properties that are in this array will not be validated
  * @param {Array} [options.fields] An array of strings. Only the properties that are in this array will be validated
  * @param {boolean} [options.hooks=true] Run before and after validate hooks
  *
  * @returns {Promise}
  */
  async validate(options) {
    return new InstanceValidator(this, options).validate();
  }

  /**
   * This is the same as calling `set` and then calling `save` but it only saves the
   * exact values passed to it, making it more atomic and safer.
   *
   * @see
   * {@link Model#set}
   * @see
   * {@link Model#save}
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
    if (Array.isArray(options)) options = { fields: options };

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
   * Destroy the row corresponding to this instance. Depending on your setting for paranoid, the row will either be completely deleted, or have its deletedAt timestamp set to the current time.
   *
   * @param {object}      [options={}] destroy options
   * @param {boolean}     [options.force=false] If set to true, paranoid models will actually be deleted
   * @param {Function}    [options.logging=false] A function that gets executed while running the query to log the sql.
   * @param {Transaction} [options.transaction] Transaction to run query under
   * @param {string}      [options.searchPath=DEFAULT] An optional parameter to specify the schema search_path (Postgres only)
   *
   * @returns {Promise}
   */
  async destroy(options) {
    options = {
      hooks: true,
      force: false,
      ...options
    };

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
   * Helper method to determine if a instance is "soft deleted".  This is
   * particularly useful if the implementer renamed the `deletedAt` attribute
   * to something different.  This method requires `paranoid` to be enabled.
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
   * Restore the row corresponding to this instance. Only available for paranoid models.
   *
   * @param {object}      [options={}] restore options
   * @param {Function}    [options.logging=false] A function that gets executed while running the query to log the sql.
   * @param {Transaction} [options.transaction] Transaction to run query under
   *
   * @returns {Promise}
   */
  async restore(options) {
    if (!this.constructor._timestampAttributes.deletedAt) throw new Error('Model is not paranoid');

    options = {
      hooks: true,
      force: false,
      ...options
    };

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
   * Increment the value of one or more columns. This is done in the database, which means it does not use the values currently stored on the Instance. The increment is done using a
   * ```sql
   * SET column = column + X
   * ```
   * query. The updated instance will be returned by default in Postgres. However, in other dialects, you will need to do a reload to get the new values.
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
   * @see
   * {@link Model#reload}
   *
   * @param {string|Array|object} fields If a string is provided, that column is incremented by the value of `by` given in options. If an array is provided, the same is true for each column. If and object is provided, each column is incremented by the value given.
   * @param {object} [options] options
   * @param {number} [options.by=1] The number to increment by
   * @param {boolean} [options.silent=false] If true, the updatedAt timestamp will not be updated.
   * @param {Function} [options.logging=false] A function that gets executed while running the query to log the sql.
   * @param {Transaction} [options.transaction] Transaction to run query under
   * @param {string} [options.searchPath=DEFAULT] An optional parameter to specify the schema search_path (Postgres only)
   * @param {boolean} [options.returning=true] Append RETURNING * to get back auto generated values (Postgres only)
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
   * Decrement the value of one or more columns. This is done in the database, which means it does not use the values currently stored on the Instance. The decrement is done using a
   * ```sql
   * SET column = column - X
   * ```
   * query. The updated instance will be returned by default in Postgres. However, in other dialects, you will need to do a reload to get the new values.
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
   * @see
   * {@link Model#reload}
   * @param {string|Array|object} fields If a string is provided, that column is decremented by the value of `by` given in options. If an array is provided, the same is true for each column. If and object is provided, each column is decremented by the value given
   * @param {object}      [options] decrement options
   * @param {number}      [options.by=1] The number to decrement by
   * @param {boolean}     [options.silent=false] If true, the updatedAt timestamp will not be updated.
   * @param {Function}    [options.logging=false] A function that gets executed while running the query to log the sql.
   * @param {Transaction} [options.transaction] Transaction to run query under
   * @param {string}      [options.searchPath=DEFAULT] An optional parameter to specify the schema search_path (Postgres only)
   * @param {boolean}     [options.returning=true] Append RETURNING * to get back auto generated values (Postgres only)
   *
   * @returns {Promise}
   */
  async decrement(fields, options) {
    return this.increment(fields, {
      by: 1,
      ...options,
      increment: false
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
        plain: true
      })
    );
  }

  /**
   * Creates a 1:m association between this (the source) and the provided target.
   * The foreign key is added on the target.
   *
   * @param {Model}               target Target model
   * @param {object}              [options] hasMany association options
   * @param {boolean}             [options.hooks=false] Set to true to run before-/afterDestroy hooks when an associated model is deleted because of a cascade. For example if `User.hasOne(Profile, {onDelete: 'cascade', hooks:true})`, the before-/afterDestroy hooks for profile will be called when a user is deleted. Otherwise the profile will be deleted without invoking any hooks
   * @param {string|object}       [options.as] The alias of this model. If you provide a string, it should be plural, and will be singularized using node.inflection. If you want to control the singular version yourself, provide an object with `plural` and `singular` keys. See also the `name` option passed to `sequelize.define`. If you create multiple associations between the same tables, you should provide an alias to be able to distinguish between them. If you provide an alias when creating the association, you should provide the same alias when eager loading and when getting associated models. Defaults to the pluralized name of target
   * @param {string|object}       [options.foreignKey] The name of the foreign key in the target table or an object representing the type definition for the foreign column (see `Sequelize.define` for syntax). When using an object, you can add a `name` property to set the name of the column. Defaults to the name of source + primary key of source
   * @param {string}              [options.sourceKey] The name of the field to use as the key for the association in the source table. Defaults to the primary key of the source table
   * @param {object}              [options.scope] A key/value set that will be used for association create and find defaults on the target. (sqlite not supported for N:M)
   * @param {string}              [options.onDelete='SET&nbsp;NULL|CASCADE'] SET NULL if foreignKey allows nulls, CASCADE if otherwise
   * @param {string}              [options.onUpdate='CASCADE'] Set `ON UPDATE`
   * @param {boolean}             [options.constraints=true] Should on update and on delete constraints be enabled on the foreign key.
   *
   * @returns {HasMany}
   *
   * @example
   * User.hasMany(Profile) // This will add userId to the profile table
   */
  static hasMany(target, options) {} // eslint-disable-line

  /**
   * Create an N:M association with a join table. Defining `through` is required.
   *
   * @param {Model}               target Target model
   * @param {object}              options belongsToMany association options
   * @param {boolean}             [options.hooks=false] Set to true to run before-/afterDestroy hooks when an associated model is deleted because of a cascade. For example if `User.hasOne(Profile, {onDelete: 'cascade', hooks:true})`, the before-/afterDestroy hooks for profile will be called when a user is deleted. Otherwise the profile will be deleted without invoking any hooks
   * @param {Model|string|object} options.through The name of the table that is used to join source and target in n:m associations. Can also be a sequelize model if you want to define the junction table yourself and add extra attributes to it.
   * @param {Model}               [options.through.model] The model used to join both sides of the N:M association.
   * @param {object}              [options.through.scope] A key/value set that will be used for association create and find defaults on the through model. (Remember to add the attributes to the through model)
   * @param {boolean}             [options.through.unique=true] If true a unique key will be generated from the foreign keys used (might want to turn this off and create specific unique keys when using scopes)
   * @param {string|object}       [options.as] The alias of this association. If you provide a string, it should be plural, and will be singularized using node.inflection. If you want to control the singular version yourself, provide an object with `plural` and `singular` keys. See also the `name` option passed to `sequelize.define`. If you create multiple associations between the same tables, you should provide an alias to be able to distinguish between them. If you provide an alias when creating the association, you should provide the same alias when eager loading and when getting associated models. Defaults to the pluralized name of target
   * @param {string|object}       [options.foreignKey] The name of the foreign key in the join table (representing the source model) or an object representing the type definition for the foreign column (see `Sequelize.define` for syntax). When using an object, you can add a `name` property to set the name of the column. Defaults to the name of source + primary key of source
   * @param {string|object}       [options.otherKey] The name of the foreign key in the join table (representing the target model) or an object representing the type definition for the other column (see `Sequelize.define` for syntax). When using an object, you can add a `name` property to set the name of the column. Defaults to the name of target + primary key of target
   * @param {object}              [options.scope] A key/value set that will be used for association create and find defaults on the target. (sqlite not supported for N:M)
   * @param {boolean}             [options.timestamps=sequelize.options.timestamps] Should the join model have timestamps
   * @param {string}              [options.onDelete='SET&nbsp;NULL|CASCADE'] Cascade if this is a n:m, and set null if it is a 1:m
   * @param {string}              [options.onUpdate='CASCADE'] Sets `ON UPDATE`
   * @param {boolean}             [options.constraints=true] Should on update and on delete constraints be enabled on the foreign key.
   *
   * @returns {BelongsToMany}
   *
   * @example
   * // Automagically generated join model
   * User.belongsToMany(Project, { through: 'UserProjects' })
   * Project.belongsToMany(User, { through: 'UserProjects' })
   *
   * // Join model with additional attributes
   * const UserProjects = sequelize.define('UserProjects', {
   *   started: Sequelize.BOOLEAN
   * })
   * User.belongsToMany(Project, { through: UserProjects })
   * Project.belongsToMany(User, { through: UserProjects })
   */
  static belongsToMany(target, options) {} // eslint-disable-line

  /**
   * Creates an association between this (the source) and the provided target. The foreign key is added on the target.
   *
   * @param {Model}           target Target model
   * @param {object}          [options] hasOne association options
   * @param {boolean}         [options.hooks=false] Set to true to run before-/afterDestroy hooks when an associated model is deleted because of a cascade. For example if `User.hasOne(Profile, {onDelete: 'cascade', hooks:true})`, the before-/afterDestroy hooks for profile will be called when a user is deleted. Otherwise the profile will be deleted without invoking any hooks
   * @param {string}          [options.as] The alias of this model, in singular form. See also the `name` option passed to `sequelize.define`. If you create multiple associations between the same tables, you should provide an alias to be able to distinguish between them. If you provide an alias when creating the association, you should provide the same alias when eager loading and when getting associated models. Defaults to the singularized name of target
   * @param {string|object}   [options.foreignKey] The name of the foreign key attribute in the target model or an object representing the type definition for the foreign column (see `Sequelize.define` for syntax). When using an object, you can add a `name` property to set the name of the column. Defaults to the name of source + primary key of source
   * @param {string}          [options.sourceKey] The name of the attribute to use as the key for the association in the source table. Defaults to the primary key of the source table
   * @param {string}          [options.onDelete='SET&nbsp;NULL|CASCADE'] SET NULL if foreignKey allows nulls, CASCADE if otherwise
   * @param {string}          [options.onUpdate='CASCADE'] Sets 'ON UPDATE'
   * @param {boolean}         [options.constraints=true] Should on update and on delete constraints be enabled on the foreign key.
   * @param {string}          [options.uniqueKey] The custom name for unique constraint.
   *
   * @returns {HasOne}
   *
   * @example
   * User.hasOne(Profile) // This will add userId to the profile table
   */
  static hasOne(target, options) {} // eslint-disable-line

  /**
   * Creates an association between this (the source) and the provided target. The foreign key is added on the source.
   *
   * @param {Model}           target The target model
   * @param {object}          [options] belongsTo association options
   * @param {boolean}         [options.hooks=false] Set to true to run before-/afterDestroy hooks when an associated model is deleted because of a cascade. For example if `User.hasOne(Profile, {onDelete: 'cascade', hooks:true})`, the before-/afterDestroy hooks for profile will be called when a user is deleted. Otherwise the profile will be deleted without invoking any hooks
   * @param {string}          [options.as] The alias of this model, in singular form. See also the `name` option passed to `sequelize.define`. If you create multiple associations between the same tables, you should provide an alias to be able to distinguish between them. If you provide an alias when creating the association, you should provide the same alias when eager loading and when getting associated models. Defaults to the singularized name of target
   * @param {string|object}   [options.foreignKey] The name of the foreign key attribute in the source table or an object representing the type definition for the foreign column (see `Sequelize.define` for syntax). When using an object, you can add a `name` property to set the name of the column. Defaults to the name of target + primary key of target
   * @param {string}          [options.targetKey] The name of the attribute to use as the key for the association in the target table. Defaults to the primary key of the target table
   * @param {string}          [options.onDelete='SET&nbsp;NULL|NO&nbsp;ACTION'] SET NULL if foreignKey allows nulls, NO ACTION if otherwise
   * @param {string}          [options.onUpdate='CASCADE'] Sets 'ON UPDATE'
   * @param {boolean}         [options.constraints=true] Should on update and on delete constraints be enabled on the foreign key.
   *
   * @returns {BelongsTo}
   *
   * @example
   * Profile.belongsTo(User) // This will add userId to the profile table
   */
  static belongsTo(target, options) {} // eslint-disable-line
}

Object.assign(Model, associationsMixin);
Hooks.applyTo(Model, true);

module.exports = Model;
