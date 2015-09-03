'use strict';

/* jshint -W110 */

var Utils = require('./utils')
  , Instance = require('./instance')
  , Association = require('./associations/base')
  , HasMany = require('./associations/has-many')
  , DataTypes = require('./data-types')
  , Util = require('util')
  , Transaction = require('./transaction')
  , Promise = require('./promise')
  , QueryTypes = require('./query-types')
  , Hooks = require('./hooks')
  , _ = require('lodash')
  , associationsMixin = require('./associations/mixin');

/**
 * A Model represents a table in the database. Sometimes you might also see it referred to as model, or simply as factory.
 * This class should _not_ be instantiated directly, it is created using `sequelize.define`, and already created models can be loaded using `sequelize.import`
 *
 * @class Model
 * @mixes Hooks
 * @mixes Associations
 */
var Model = function(name, attributes, options) {

  this.options = Utils._.extend({
    timestamps: true,
    instanceMethods: {},
    classMethods: {},
    validate: {},
    freezeTableName: false,
    underscored: false,
    underscoredAll: false,
    paranoid: false,
    whereCollection: null,
    schema: null,
    schemaDelimiter: '',
    defaultScope: null,
    scopes: [],
    hooks: {},
    indexes: []
  }, options || {});

  this.associations = {};
  this.modelManager = null;
  this.name = name;
  this.options.hooks = _.mapValues(this.replaceHookAliases(this.options.hooks), function (hooks) {
    if (!Array.isArray(hooks)) hooks = [hooks];
    return hooks;
  });

  this.sequelize = options.sequelize;
  this.underscored = this.underscored || this.underscoredAll;

  if (!this.options.tableName) {
    this.tableName = this.options.freezeTableName ? name : Utils.underscoredIf(Utils.pluralize(name), this.options.underscoredAll);
  } else {
    this.tableName = this.options.tableName;
  }

  // error check options
  Utils._.each(options.validate, function(validator, validatorType) {
    if (Utils._.contains(Utils._.keys(attributes), validatorType)) {
      throw new Error('A model validator function must not have the same name as a field. Model: ' + name + ', field/validation name: ' + validatorType);
    }

    if (!Utils._.isFunction(validator)) {
      throw new Error('Members of the validate option must be functions. Model: ' + name + ', error with validate member ' + validatorType);
    }
  });

  this.attributes = this.rawAttributes = Utils._.mapValues(attributes, function(attribute, name) {
    if (!Utils._.isPlainObject(attribute)) {
      attribute = { type: attribute };
    }

    attribute = this.sequelize.normalizeAttribute(attribute);

    if (attribute.references) {
      attribute = Utils.formatReferences(attribute);

      if (attribute.references.model instanceof Model) {
        attribute.references.model = attribute.references.model.tableName;
      }
    }

    if (attribute.type === undefined) {
      throw new Error('Unrecognized data type for field ' + name);
    }

    if (attribute.type instanceof DataTypes.ENUM) {
      if (!attribute.values.length) {
        throw new Error('Values for ENUM have not been defined.');
      }

      // BC compatible.
      attribute.type.values = attribute.values;
    }

    return attribute;
  }, this);
};

Object.defineProperty(Model.prototype, 'QueryInterface', {
  get: function() { return this.modelManager.sequelize.getQueryInterface(); }
});

Object.defineProperty(Model.prototype, 'QueryGenerator', {
  get: function() { return this.QueryInterface.QueryGenerator; }
});

Model.prototype.toString = function () {
  return '[object SequelizeModel:'+this.name+']';
};

// private

// validateIncludedElements should have been called before this method
var paranoidClause = function(model, options) {
  options = options || {};

  // Apply on each include
  // This should be handled before handling where conditions because of logic with returns
  // otherwise this code will never run on includes of a already conditionable where
  if (options.include) {
    options.include.forEach(function(include) {
      paranoidClause(include.model, include);
    });
  }

  if (!model.options.timestamps || !model.options.paranoid || options.paranoid === false) {
    // This model is not paranoid, nothing to do here;
    return options;
  }

  var deletedAtCol = model._timestampAttributes.deletedAt
    , deletedAtObject = {};

  deletedAtObject[model.rawAttributes[deletedAtCol].field || deletedAtCol] = null;

  if (Utils._.isEmpty(options.where)) {
    options.where = deletedAtObject;
  } else {
    options.where = { $and: [deletedAtObject, options.where] };
  }

  return options;
};

var addOptionalClassMethods = function() {
  var self = this;
  Utils._.each(this.options.classMethods || {}, function(fct, name) { self[name] = fct; });
};

var addDefaultAttributes = function() {
  var self = this
    , tail = {}
    , head = {};

  // Add id if no primary key was manually added to definition
  // Can't use this.primaryKeys here, since this function is called before PKs are identified
  if (!_.any(this.rawAttributes, 'primaryKey')) {
    if ('id' in this.rawAttributes) {
      // Something is fishy here!
      throw new Error("A column called 'id' was added to the attributes of '" + this.tableName + "' but not marked with 'primaryKey: true'");
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

  var existingAttributes = Utils._.clone(self.rawAttributes);
  self.rawAttributes = {};

  Utils._.each(head, function(value, attr) {
    self.rawAttributes[attr] = value;
  });

  Utils._.each(existingAttributes, function(value, attr) {
    self.rawAttributes[attr] = value;
  });

  Utils._.each(tail, function(value, attr) {
    if (Utils._.isUndefined(self.rawAttributes[attr])) {
      self.rawAttributes[attr] = value;
    }
  });

  if (!Object.keys(this.primaryKeys).length) {
    self.primaryKeys.id = self.rawAttributes.id;
  }
};

var findAutoIncrementField = function() {
  var fields = this.QueryGenerator.findAutoIncrementField(this);

  this.autoIncrementField = null;

  fields.forEach(function(field) {
    if (this.autoIncrementField) {
      throw new Error('Invalid Instance definition. Only one autoincrement field allowed.');
    } else {
      this.autoIncrementField = field;
    }
  }.bind(this));
};

function conformOptions(options, self) {
  if (!options.include) {
    return;
  }
  // if include is not an array, wrap in an array
  if (!Array.isArray(options.include)) {
    options.include = [options.include];
  } else if (!options.include.length) {
    delete options.include;
    return;
  }

  // convert all included elements to { model: Model } form
  options.include = options.include.map(function(include) {
    include = conformInclude(include, self);

    return include;
  });
}

function conformInclude(include, self) {
  var model;

  if (include._pseudo) return include;

  if (include instanceof Association) {
    if (self && include.target.name === self.name) {
      model = include.source;
    } else {
      model = include.target;
    }

    include = { model: model, association: include, as: include.as };
  } else if (include instanceof Model) {
    model = include;

    include = { model: include };
  } else if (_.isPlainObject(include)) {
    if (include.association) {
      if (self && include.association.target.name === self.name) {
        model = include.association.source;
      } else {
        model = include.association.target;
      }

      if (!include.model) {
        include.model = model;
      }
      if (!include.as) {
        include.as = include.association.as;
      }
    } else {
      model = include.model;
    }

    conformOptions(include, model);
  } else {
    throw new Error('Include unexpected. Element has to be either a Model, an Association or an object.');
  }

  return include;
}

var optClone = Model.prototype.__optClone = Model.prototype.$optClone = function(options) {
  options = options || {};
  return Utils.cloneDeep(options, function(elem) {
    // The InstanceFactories used for include are pass by ref, so don't clone them.
    if (elem &&
      (
        elem._isSequelizeMethod ||
        elem instanceof Model ||
        elem instanceof Instance ||
        elem instanceof Transaction ||
        elem instanceof Association
      )
    ) {
      return elem;
    }

    // Otherwise return undefined, meaning, 'handle this lodash'
    return undefined;
  });
};

var expandIncludeAllElement = function(includes, include) {
  // check 'all' attribute provided is valid
  var all = include.all;
  delete include.all;

  if (all !== true) {
    if (!Array.isArray(all)) {
      all = [all];
    }

    var validTypes = {
      BelongsTo: true,
      HasOne: true,
      HasMany: true,
      One: ['BelongsTo', 'HasOne'],
      Has: ['HasOne', 'HasMany'],
      Many: ['HasMany']
    };

    for (var i = 0; i < all.length; i++) {
      var type = all[i];
      if (type === 'All') {
        all = true;
        break;
      }

      var types = validTypes[type];
      if (!types) {
        throw new Error('include all \'' + type + '\' is not valid - must be BelongsTo, HasOne, HasMany, One, Has, Many or All');
      }

      if (types !== true) {
        // replace type placeholder e.g. 'One' with it's constituent types e.g. 'HasOne', 'BelongsTo'
        all.splice(i, 1);
        i--;
        for (var j = 0; j < types.length; j++) {
          if (all.indexOf(types[j]) === -1) {
            all.unshift(types[j]);
            i++;
          }
        }
      }
    }
  }

  // add all associations of types specified to includes
  var nested = include.nested;
  if (nested) {
    delete include.nested;

    if (!include.include) {
      include.include = [];
    } else if (!Array.isArray(include.include)) {
      include.include = [include.include];
    }
  }

  var used = [];
  (function addAllIncludes(parent, includes) {
    Utils._.forEach(parent.associations, function(association) {
      if (all !== true && all.indexOf(association.associationType) === -1) {
        return;
      }

      // check if model already included, and skip if so
      var model = association.target;
      var as = association.options.as;

      var predicate = {model: model};
      if (as) {
        // We only add 'as' to the predicate if it actually exists
        predicate.as = as;
      }

      if (Utils._.find(includes, predicate)) {
        return;
      }

      // skip if recursing over a model already nested
      if (nested && used.indexOf(model) !== -1) {
        return;
      }
      used.push(parent);

      // include this model
      var thisInclude = optClone(include);
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
};

var validateIncludedElement;
var validateIncludedElements = function(options, tableNames) {
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

  options.include = options.include.map(function (include) {
    include = conformInclude(include);
    include.parent = options;

    validateIncludedElement.call(options.model, include, tableNames, options);

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

  options.include.forEach(function (include) {
    include.hasParentWhere = options.hasParentWhere || !!options.where;
    include.hasParentRequired = options.hasParentRequired || !!options.required;

    if (include.subQuery !== false && options.hasDuplicating && options.topLimit) {
      if (include.duplicating) {
        include.subQuery = false;
        include.subQueryFilter = include.hasRequired;
      } else {
        include.subQuery = include.hasRequired;
        include.subQueryFilter = false;
      }
    } else {
      include.subQuery = include.subQuery || false;
      if (include.duplicating) {
        include.subQueryFilter = include.subQuery;
        include.subQuery = false;
      } else {
        include.subQueryFilter = false;
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

    return include;
  });

  if (options.topModel === options.model && options.subQuery === undefined) {
    options.subQuery = false;
  }
  return options;
};
Model.$validateIncludedElements = validateIncludedElements;

validateIncludedElement = function(include, tableNames, options) {
  tableNames[include.model.getTableName()] = true;

  // Need to make sure virtuals are mapped before setting originalAttributes
  include = Utils.mapFinderOptions(include, include.model);

  if (include.attributes && !options.raw) {
    include.originalAttributes = include.attributes.slice(0);

    if (include.attributes.length) {
      _.each(include.model.primaryKeys, function (attr, key) {
        // Include the primary key if its not already take - take into account that the pk might be aliassed (due to a .field prop)
        if (!_.any(include.attributes, function (includeAttr) {
          if (attr.field !== key) {
            return Array.isArray(includeAttr) && includeAttr[0] === attr.field && includeAttr[1] === key;
          }
          return includeAttr === key;
        })) {
          include.attributes.unshift(key);
        }
      });
    }
  } else if (!include.attributes) {
    include.attributes = Object.keys(include.model.tableAttributes);
  }

  // pseudo include just needed the attribute logic, return
  if (include._pseudo) {
    return Utils.mapFinderOptions(include, include.model);
  }

  // check if the current Model is actually associated with the passed Model - or it's a pseudo include
  var association = include.association || this.getAssociation(include.model, include.as);

  if (!association) {
    var msg = include.model.name;

    if (include.as) {
      msg += ' (' + include.as + ')';
    }

    msg += ' is not associated to ' + this.name + '!';

    throw new Error(msg);
  }

  include.association = association;
  include.as = association.as;

  // If through, we create a pseudo child include, to ease our parsing later on
  if (include.association.through && Object(include.association.through.model) === include.association.through.model) {
    if (!include.include) include.include = [];
    var through = include.association.through;

    include.through = Utils._.defaults(include.through || {}, {
      model: through.model,
      as: through.model.name,
      association: {
        isSingleAssociation: true
      },
      _pseudo: true,
      parent: include
    });


    if (through.scope) {
      include.through.where = include.through.where ? { $and: [include.through.where, through.scope]} :  through.scope;
    }

    include.include.push(include.through);
    tableNames[through.tableName] = true;
  }

  // include.model may be the main model, while the association target may be scoped - thus we need to look at association.target/source
  var model;
  if (include.model.scoped === true) {
    // If the passed model is already scoped, keep that
    model = include.model;
  } else {
    // Otherwise use the model that was originally passed to the association
    model = include.association.target.name === include.model.name ? include.association.target : include.association.source;
  }

  Model.$injectScope(model.$scope, include);

  include = Utils.mapFinderOptions(include, include.model);

  if (include.required === undefined) {
    include.required = !!include.where;
  }

  if (include.association.scope) {
    include.where = include.where ? { $and: [include.where, include.association.scope] }:  include.association.scope;
  }

  if (include.limit && include.separate === undefined) {
    include.separate = true;
  }

  if (include.separate === true && !(include.association instanceof HasMany)) {
    throw new Error('Only HasMany associations support include.separate');
  }

  if (include.separate === true) {
    include.duplicating = false;
  }

  if (include.separate === true && options.attributes && options.attributes.length && !_.includes(options.attributes, association.source.primaryKeyAttribute)) {
    options.attributes.push(association.source.primaryKeyAttribute);
  }

  // Validate child includes
  if (include.hasOwnProperty('include')) {
    validateIncludedElements.call(include.model, include, tableNames, options);
  }

  return include;
};

var expandIncludeAll = Model.$expandIncludeAll = function(options) {
  var includes = options.include;
  if (!includes) {
    return;
  }

 for (var index = 0; index < includes.length; index++) {
    var include = includes[index];

    if (include.all) {
      includes.splice(index, 1);
      index--;

      expandIncludeAllElement.call(this, includes, include);
    }
  }

  Utils._.forEach(includes, function(include) {
    expandIncludeAll.call(include.model, include);
  });
};

Model.prototype.init = function(modelManager) {
  var self = this;

  this.modelManager = modelManager;
  this.primaryKeys = {};

  // Setup names of timestamp attributes
  this._timestampAttributes = {};
  if (this.options.timestamps) {
    if (this.options.createdAt !== false) {
      this._timestampAttributes.createdAt = this.options.createdAt || Utils.underscoredIf('createdAt', this.options.underscored);
    }
    if (this.options.updatedAt !== false) {
      this._timestampAttributes.updatedAt = this.options.updatedAt || Utils.underscoredIf('updatedAt', this.options.underscored);
    }
    if (this.options.paranoid && this.options.deletedAt !== false) {
      this._timestampAttributes.deletedAt = this.options.deletedAt || Utils.underscoredIf('deletedAt', this.options.underscored);
    }
  }

  // Add head and tail default attributes (id, timestamps)
  addOptionalClassMethods.call(this);

  this.$scope = this.options.defaultScope || {};

  if (_.isPlainObject(this.$scope)) {
    conformOptions(this.$scope);
  }

  _.each(this.options.scopes, function (scope) {
    if (_.isPlainObject(scope)) {
      conformOptions(scope);
    }
  });

  // Instance prototype
  this.Instance = function() {
    Instance.apply(this, arguments);
  };

  Util.inherits(this.Instance, Instance);

  this._readOnlyAttributes = Utils._.values(this._timestampAttributes);
  this._hasReadOnlyAttributes = this._readOnlyAttributes && this._readOnlyAttributes.length;
  this._isReadOnlyAttribute = Utils._.memoize(function(key) {
    return self._hasReadOnlyAttributes && self._readOnlyAttributes.indexOf(key) !== -1;
  });

  if (this.options.instanceMethods) {
    Utils._.each(this.options.instanceMethods, function(fct, name) {
      self.Instance.prototype[name] = fct;
    });
  }

  addDefaultAttributes.call(this);
  this.refreshAttributes();

  findAutoIncrementField.call(this);

  this.Instance.prototype.$Model =
  this.Instance.prototype.Model = this;

  return this;
};

Model.prototype.refreshAttributes = function() {
  var self = this
    , attributeManipulation = {};

  this.Instance.prototype._customGetters = {};
  this.Instance.prototype._customSetters = {};

  Utils._.each(['get', 'set'], function(type) {
    var opt = type + 'terMethods'
      , funcs = Utils._.clone(Utils._.isObject(self.options[opt]) ? self.options[opt] : {})
      , _custom = type === 'get' ? self.Instance.prototype._customGetters : self.Instance.prototype._customSetters;

    Utils._.each(funcs, function(method, attribute) {
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

    Utils._.each(self.rawAttributes, function(options, attribute) {
      if (options.hasOwnProperty(type)) {
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

    Utils._.each(funcs, function(fct, name) {
      if (!attributeManipulation[name]) {
        attributeManipulation[name] = {
          configurable: true
        };
      }
      attributeManipulation[name][type] = fct;
    });
  });

  this._booleanAttributes = [];
  this._dateAttributes = [];
  this._hstoreAttributes = [];
  this._rangeAttributes = [];
  this._jsonAttributes = [];
  this._geometryAttributes = [];
  this._virtualAttributes = [];
  this._defaultValues = {};
  this.Instance.prototype.validators = {};

  this.fieldRawAttributesMap = {};

  this.primaryKeys = {};
  self.options.uniqueKeys = {};

  Utils._.each(this.rawAttributes, function(definition, name) {
    definition.type = self.sequelize.normalizeDataType(definition.type);

    definition.Model = self;
    definition.fieldName = name;
    definition._modelAttribute = true;

    if (definition.field === undefined) {
      definition.field = name;
    }

    if (definition.primaryKey === true) {
      self.primaryKeys[name] = definition;
    }

    self.fieldRawAttributesMap[definition.field] = definition;

    if (definition.type instanceof DataTypes.BOOLEAN) {
      self._booleanAttributes.push(name);
    } else if (definition.type instanceof DataTypes.DATE) {
      self._dateAttributes.push(name);
    } else if (definition.type instanceof DataTypes.HSTORE || DataTypes.ARRAY.is(definition.type, DataTypes.HSTORE)) {
      self._hstoreAttributes.push(name);
    } else if (definition.type instanceof DataTypes.RANGE || DataTypes.ARRAY.is(definition.type, DataTypes.RANGE)) {
      self._rangeAttributes.push(name);
    } else if (definition.type instanceof DataTypes.JSON) {
      self._jsonAttributes.push(name);
    } else if (definition.type instanceof DataTypes.VIRTUAL) {
      self._virtualAttributes.push(name);
    } else if (definition.type instanceof DataTypes.GEOMETRY) {
      self._geometryAttributes.push(name);
    }

    if (definition.hasOwnProperty('defaultValue')) {
      if (typeof definition.defaultValue === 'function' && (
          definition.defaultValue === DataTypes.NOW ||
          definition.defaultValue === DataTypes.UUIDV1 ||
          definition.defaultValue === DataTypes.UUIDV4
      )) {
        definition.defaultValue = new definition.defaultValue();
      }

      self._defaultValues[name] = Utils._.partial(Utils.toDefaultValue, definition.defaultValue);
    }

    if (definition.hasOwnProperty('unique')) {
      var idxName;
      if (definition.unique === true) {
        idxName = self.tableName + '_' + name + '_unique';
        self.options.uniqueKeys[idxName] = {
          name: idxName,
          fields: [definition.field],
          singleField: true
        };
      } else if (definition.unique !== false) {
        idxName = definition.unique;
        if (typeof definition.unique === 'object') {
          idxName = definition.unique.name;
        }

        self.options.uniqueKeys[idxName] = self.options.uniqueKeys[idxName] || {fields: [], msg: null};
        self.options.uniqueKeys[idxName].fields.push(definition.field);
        self.options.uniqueKeys[idxName].msg = self.options.uniqueKeys[idxName].msg || definition.unique.msg || null;
        self.options.uniqueKeys[idxName].name = idxName || false;
      }
    }

    if (definition.hasOwnProperty('validate')) {
      self.Instance.prototype.validators[name] = definition.validate;
    }

    if (definition.index === true && definition.type instanceof DataTypes.JSONB) {
      self.options.indexes.push({
        fields: [definition.field || name],
        using: 'gin'
      });

      delete definition.index;
    }
  });

  this.uniqueKeys = this.options.uniqueKeys;

  this._hasBooleanAttributes = !!this._booleanAttributes.length;
  this._isBooleanAttribute = Utils._.memoize(function(key) {
    return self._booleanAttributes.indexOf(key) !== -1;
  });

  this._hasDateAttributes = !!this._dateAttributes.length;
  this._isDateAttribute = Utils._.memoize(function(key) {
    return self._dateAttributes.indexOf(key) !== -1;
  });

  this._hasHstoreAttributes = !!this._hstoreAttributes.length;
  this._isHstoreAttribute = Utils._.memoize(function(key) {
    return self._hstoreAttributes.indexOf(key) !== -1;
  });

  this._hasRangeAttributes = !!this._rangeAttributes.length;
  this._isRangeAttribute = Utils._.memoize(function(key) {
    return self._rangeAttributes.indexOf(key) !== -1;
  });

  this._hasJsonAttributes = !!this._jsonAttributes.length;
  this._isJsonAttribute = Utils._.memoize(function(key) {
    return self._jsonAttributes.indexOf(key) !== -1;
  });

  this._hasVirtualAttributes = !!this._virtualAttributes.length;
  this._isVirtualAttribute = Utils._.memoize(function(key) {
    return self._virtualAttributes.indexOf(key) !== -1;
  });

  this._hasGeometryAttributes = !!this._geometryAttributes.length;
  this._isGeometryAttribute = Utils._.memoize(function(key) {
    return self._geometryAttributes.indexOf(key) !== -1;
  });

  this._hasDefaultValues = !Utils._.isEmpty(this._defaultValues);

  this.attributes = this.rawAttributes;
  this.tableAttributes = Utils._.omit(this.rawAttributes, this._virtualAttributes);

  this.Instance.prototype._hasCustomGetters = Object.keys(this.Instance.prototype._customGetters).length;
  this.Instance.prototype._hasCustomSetters = Object.keys(this.Instance.prototype._customSetters).length;

  Object.defineProperties(this.Instance.prototype, attributeManipulation);

  this.Instance.prototype.rawAttributes = this.rawAttributes;
  this.Instance.prototype.attributes = Object.keys(this.Instance.prototype.rawAttributes);
  this.Instance.prototype._isAttribute = Utils._.memoize(function(key) {
    return self.Instance.prototype.attributes.indexOf(key) !== -1;
  });

  // Primary key convenience variables
  this.primaryKeyAttributes = Object.keys(this.primaryKeys);
  this.primaryKeyAttribute = this.primaryKeyAttributes[0];
  if (this.primaryKeyAttribute) {
    this.primaryKeyField = this.rawAttributes[this.primaryKeyAttribute].field || this.primaryKeyAttribute;
  }

  this.primaryKeyCount = this.primaryKeyAttributes.length;
  this._hasPrimaryKeys = this.options.hasPrimaryKeys = this.hasPrimaryKeys = this.primaryKeyCount > 0;

  this._isPrimaryKey = Utils._.memoize(function(key) {
    return self.primaryKeyAttributes.indexOf(key) !== -1;
  });

};

/**
 * Remove attribute from model definition
 * @param {String} [attribute]
 */
Model.prototype.removeAttribute = function(attribute) {
  delete this.rawAttributes[attribute];
  this.refreshAttributes();
};

/**
 * Sync this Model to the DB, that is create the table. Upon success, the callback will be called with the model instance (this)
 * @see {Sequelize#sync} for options
 * @return {Promise<this>}
 */
Model.prototype.sync = function(options) {
  options = Utils._.extend({}, this.options, options || {});

  var self = this
    , attributes = this.tableAttributes;

  return Promise.try(function () {
    if (options.force) {
      return self.drop(options);
    }
  }).then(function () {
    return self.QueryInterface.createTable(self.getTableName(options), attributes, options, self);
  }).then(function () {
    return self.QueryInterface.showIndex(self.getTableName(options), options);
  }).then(function (indexes) {
    // Assign an auto-generated name to indexes which are not named by the user
    self.options.indexes = self.QueryInterface.nameIndexes(self.options.indexes, self.tableName);

    indexes = Utils._.filter(self.options.indexes, function (item1) {
      return !Utils._.any(indexes, function (item2) {
        return item1.name === item2.name;
      });
    });

    return Promise.map(indexes, function (index) {
      return self.QueryInterface.addIndex(self.getTableName(options), _.assign({logging: options.logging}, index), self.tableName);
    });
  }).return(this);
};

/**
 * Drop the table represented by this Model
 * @param {Object}  [options]
 * @param {Boolean} [options.cascade=false] Also drop all objects depending on this table, such as views. Only works in postgres
 * @param {Function} [options.logging=false] A function that gets executed while running the query to log the sql.
 * @return {Promise}
 */
Model.prototype.drop = function(options) {
  return this.QueryInterface.dropTable(this.getTableName(options), options);
};

Model.prototype.dropSchema = function(schema) {
  return this.QueryInterface.dropSchema(schema);
};

/**
 * Apply a schema to this model. For postgres, this will actually place the schema in front of the table name - `"schema"."tableName"`,
 * while the schema will be prepended to the table name for mysql and sqlite - `'schema.tablename'`.
 *
 * @param {String} schema The name of the schema
 * @param {Object} [options]
 * @param {String} [options.schemaDelimiter='.'] The character(s) that separates the schema name from the table name
 * @param {Function} [options.logging=false] A function that gets executed while running the query to log the sql.
 * @return {this}
 */
Model.prototype.schema = function(schema, options) { // testhint options:none
  this.options.schema = schema;

  if (!!options) {
    if (typeof options === 'string') {
      this.options.schemaDelimiter = options;
    } else {
      if (!!options.schemaDelimiter) {
        this.options.schemaDelimiter = options.schemaDelimiter;
      }
    }
  }

  return this;
};

/**
 * Get the tablename of the model, taking schema into account. The method will return The name as a string if the model has no schema,
 * or an object with `tableName`, `schema` and `delimiter` properties.
 *
 * @param {Object}   [options] The hash of options from any query. You can use one model to access tables with matching schemas by overriding `getTableName` and using custom key/values to alter the name of the table. (eg. subscribers_1, subscribers_2)
 * @param {Function} [options.logging=false] A function that gets executed while running the query to log the sql.
 * @return {String|Object}
 */
Model.prototype.getTableName = function(options) { // testhint options:none
  return this.QueryGenerator.addSchema(this);
};

/**
 * @return {Model}
 */
Model.prototype.unscoped = function () {
  return this.scope();
};

/**
 * Add a new scope to the model. This is especially useful for adding scopes with includes, when the model you want to include is not available at the time this model is defined.
 *
 * By default this will throw an error if a scope with that name already exists. Pass `override: true` in the options object to silence this error.
 *
 * @param {String}          name The name of the scope. Use `defaultScope` to override the default scope
 * @param {Object|Function} scope
 * @param {Object}          [options]
 * @param {Boolean}         [options.override=false]
 */
Model.prototype.addScope = function (name, scope, options) {
  options = _.assign({
    override: false
  }, options);

  if ((name === 'defaultScope' || name in this.options.scopes) && options.override === false) {
    throw new Error('The scope ' + name + ' already exists. Pass { override: true } as options to silence this error');
  }

  conformOptions(scope);

  if (name === 'defaultScope') {
    this.options.defaultScope = this.$scope = scope;
  } else {
    this.options.scopes[name] = scope;
  }
};

/**
 * Apply a scope created in `define` to the model. First let's look at how to create scopes:
 * ```js
 * var Model = sequelize.define('model', attributes, {
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
 *             $like: email
 *           },
 *           accesss_level {
 *             $gte: accessLevel
 *           }
 *         }
 *       }
 *     }
 *   }
 * })
 * ```
 * Now, since you defined a default scope, every time you do Model.find, the default scope is appended to your query. Here's a couple of examples:
 * ```js
 * Model.findAll() // WHERE username = 'dan'
 * Model.findAll({ where: { age: { gt: 12 } } }) // WHERE age > 12 AND username = 'dan'
 * ```
 *
 * To invoke scope functions you can do:
 * ```js
 * Model.scope({ method: ['complexFunction' 'dan@sequelize.com', 42]}).findAll()
 * // WHERE email like 'dan@sequelize.com%' AND access_level >= 42
 * ```
 *
 * @param {Array|Object|String|null}    options* The scope(s) to apply. Scopes can either be passed as consecutive arguments, or as an array of arguments. To apply simple scopes and scope functions with no arguments, pass them as strings. For scope function, pass an object, with a `method` property. The value can either be a string, if the method does not take any arguments, or an array, where the first element is the name of the method, and consecutive elements are arguments to that method. Pass null to remove all scopes, including the default.
 * @return {Model}                      A reference to the model, with the scope(s) applied. Calling scope again on the returned model will clear the previous scope.
 */
Model.prototype.scope = function(option) {
  var self = Object.create(this)
    , options
    , scope
    , scopeName;

  self.$scope = {};

  if (!option) {
    return self;
  }

  options = _.flatten(arguments);
  options.forEach(function(option) {
    scope = null;
    scopeName = null;

    if (_.isPlainObject(option)) {
      if (!!option.method) {
        if (Array.isArray(option.method) && !!self.options.scopes[option.method[0]]) {
          scopeName = option.method[0];
          scope = self.options.scopes[scopeName].apply(self, option.method.splice(1));
        }
        else if (!!self.options.scopes[option.method]) {
          scopeName = option.method;
          scope = self.options.scopes[scopeName].apply(self);
        }
      } else {
        scope = option;
      }
    } else {
      if (option === 'defaultScope' && _.isPlainObject(self.options.defaultScope)) {
        scope = self.options.defaultScope;
      } else {
        scopeName = option;
        scope = self.options.scopes[scopeName];

        if (_.isFunction(scope)) {
          scope = scope();
          conformOptions(scope);
        }
      }
    }

    if (!!scope) {
      _.assign(self.$scope, scope, function scopeCustomizer(objectValue, sourceValue, key) {
        if (key === 'where') {
          return Array.isArray(sourceValue) ? sourceValue : _.assign(objectValue || {}, sourceValue);
        } else if (key === 'include' && Array.isArray(objectValue) && Array.isArray(sourceValue)) {
          return objectValue.concat(sourceValue);
        }

        return objectValue ? objectValue : sourceValue;
      });
    } else {
      throw new Error('Invalid scope ' + scopeName + ' called.');
    }
  });

  self.scoped = true;

  return self;
};

Model.prototype.all = function(options) {
  return this.findAll(options);
};

/**
 * Search for multiple instances.
 *
 * __Simple search using AND and =__
 * ```js
 * Model.findAll({
 *   where: {
 *     attr1: 42,
 *     attr2: 'cake'
 *   }
 * })
 * ```
 * ```sql
 * WHERE attr1 = 42 AND attr2 = 'cake'
 *```
 *
 * __Using greater than, less than etc.__
 * ```js
 *
 * Model.findAll({
 *   where: {
 *     attr1: {
 *       gt: 50
 *     },
 *     attr2: {
 *       lte: 45
 *     },
 *     attr3: {
 *       in: [1,2,3]
 *     },
 *     attr4: {
 *       ne: 5
 *     }
 *   }
 * })
 * ```
 * ```sql
 * WHERE attr1 > 50 AND attr2 <= 45 AND attr3 IN (1,2,3) AND attr4 != 5
 * ```
 * Possible options are: `$ne, $in, $not, $notIn, $gte, $gt, $lte, $lt, $like, $ilike/$iLike, $notLike, $notILike, '..'/$between, '!..'/$notBetween, '&&'/$overlap, '@>'/$contains, '<@'/$contained`
 *
 * __Queries using OR__
 * ```js
 * Model.findAll({
 *   where: {
 *     name: 'a project',
 *     $or: [
 *       {id: [1, 2, 3]},
 *       {
 *         $and: [
 *           {id: {gt: 10}},
 *           {id: {lt: 100}}
 *         ]
 *       }
 *     ]
 *   }
 * });
 * ```
 * ```sql
 * WHERE `Model`.`name` = 'a project' AND (`Model`.`id` IN (1, 2, 3) OR (`Model`.`id` > 10 AND `Model`.`id` < 100));
 * ```
 *
 * The success listener is called with an array of instances if the query succeeds.
 *
 * @param  {Object}                    [options] A hash of options to describe the scope of the search
 * @param  {Object}                    [options.where] A hash of attributes to describe your search. See above for examples.
 * @param  {Array<String>}             [options.attributes] A list of the attributes that you want to select. To rename an attribute, you can pass an array, with two elements - the first is the name of the attribute in the DB (or some kind of expression such as `Sequelize.literal`, `Sequelize.fn` and so on), and the second is the name you want the attribute to have in the returned instance
 * @param  {Boolean}                   [options.paranoid=true] If true, only non-deleted records will be returned. If false, both deleted and non-deleted records will be returned. Only applies if `options.paranoid` is true for the model.
 * @param  {Array<Object|Model>}       [options.include] A list of associations to eagerly load using a left join. Supported is either `{ include: [ Model1, Model2, ...]}` or `{ include: [{ model: Model1, as: 'Alias' }]}`. If your association are set up with an `as` (eg. `X.hasMany(Y, { as: 'Z }`, you need to specify Z in the as attribute when eager loading Y).
 * @param  {Model}                     [options.include[].model] The model you want to eagerly load
 * @param  {String}                    [options.include[].as] The alias of the relation, in case the model you want to eagerly load is aliassed. For `hasOne` / `belongsTo`, this should be the singular name, and for `hasMany`, it should be the plural
 * @param  {Association}               [options.include[].association] The association you want to eagerly load. (This can be used instead of providing a model/as pair)
 * @param  {Object}                    [options.include[].where] Where clauses to apply to the child models. Note that this converts the eager load to an inner join, unless you explicitly set `required: false`
 * @param  {Array<String>}             [options.include[].attributes] A list of attributes to select from the child model
 * @param  {Boolean}                   [options.include[].required] If true, converts to an inner join, which means that the parent model will only be loaded if it has any matching children. True if `include.where` is set, false otherwise.
 * @param  {Boolean}                   [options.include[].separate] If true, runs a separate query to fetch the associated instances, only supported for hasMany associations
 * @param  {Number}                    [options.include[].limit] Limit the joined rows, only supported with include.separate=true
 * @param  {Object}                    [options.include[].through.where] Filter on the join model for belongsToMany relations
 * @param  {Array}                     [options.include[].through.attributes] A list of attributes to select from the join model for belongsToMany relations
 * @param  {Array<Object|Model>}       [options.include[].include] Load further nested related models
 * @param  {String|Array|Sequelize.fn} [options.order] Specifies an ordering. If a string is provided, it will be escaped. Using an array, you can provide several columns / functions to order by. Each element can be further wrapped in a two-element array. The first element is the column / function to order by, the second is the direction. For example: `order: [['name', 'DESC']]`. In this way the column will be escaped, but the direction will not.
 * @param  {Number}                    [options.limit]
 * @param  {Number}                    [options.offset]
 * @param  {Transaction}               [options.transaction] Transaction to run query under
 * @param  {String|Object}             [options.lock] Lock the selected rows. Possible options are transaction.LOCK.UPDATE and transaction.LOCK.SHARE. Postgres also supports transaction.LOCK.KEY_SHARE, transaction.LOCK.NO_KEY_UPDATE and specific model locks with joins. See [transaction.LOCK for an example](transaction#lock)
 * @param  {Boolean}                   [options.raw] Return raw result. See sequelize.query for more information.
 * @param  {Function}                  [options.logging=false] A function that gets executed while running the query to log the sql.
 * @param  {Object}                    [options.having]
 *
 * @see    {Sequelize#query}
 * @return {Promise<Array<Instance>>}
 * @alias all
 */

Model.prototype.findAll = function(options) {
  if (options !== undefined && !_.isPlainObject(options)) {
    throw new Error('The argument passed to findAll must be an options object, use findById if you wish to pass a single primary key value');
  }
  // TODO: Remove this in the next major version (4.0)
  if (arguments.length > 1) {
    throw new Error('Please note that find* was refactored and uses only one options object from now on.');
  }
  var tableNames = {}
    , originalOptions;

  tableNames[this.getTableName(options)] = true;
  options = optClone(options);

  _.defaults(options, { hooks: true });

  return Promise.bind(this).then(function() {
    conformOptions(options, this);
    Model.$injectScope(this.$scope, options);

    if (options.hooks) {
      return this.runHooks('beforeFind', options);
    }
  }).then(function() {
    expandIncludeAll.call(this, options);

    if (options.hooks) {
      return this.runHooks('beforeFindAfterExpandIncludeAll', options);
    }
  }).then(function() {
    if (typeof options === 'object') {
      if (options.include) {
        options.hasJoin = true;

        validateIncludedElements.call(this, options, tableNames);

        // If we're not raw, we have to make sure we include the primary key for deduplication
        if (options.attributes && !options.raw) {
          if (options.attributes.indexOf(this.primaryKeyAttribute) === -1) {
            options.originalAttributes = options.attributes;
            options.attributes = [this.primaryKeyAttribute].concat(options.attributes);
          }
        }
      }

      // whereCollection is used for non-primary key updates
      this.options.whereCollection = options.where || null;
    }

    if (options.attributes === undefined) {
      options.attributes = Object.keys(this.tableAttributes);
    }

    Utils.mapFinderOptions(options, this);

    options = paranoidClause(this, options);

    if (options.hooks) {
      return this.runHooks('beforeFindAfterOptions', options);
    }
  }).then(function() {
    originalOptions = optClone(options);
    options.tableNames = Object.keys(tableNames);

    return this.QueryInterface.select(this, this.getTableName(options), options);
  }).tap(function(results) {
    if (options.hooks) {
      return this.runHooks('afterFind', results, options);
    }
  }).then(function (results) {
    return Model.$findSeperate(results, originalOptions);
  });
};

Model.$findSeperate = function(results, options) {
  if (!options.include || options.raw || !results) return Promise.resolve(results);

  var original = results;
  if (options.plain) results = [results];

  if (!results.length) return original;

  return Promise.map(options.include, function (include) {
    if (!include.separate) {
      return Model.$findSeperate(
        results.reduce(function (memo, result) {
          var associations = result.get(include.association.as);

          // Might be an empty belongsTo relation
          if (!associations) return memo;

          // Force array so we can concat no matter if it's 1:1 or :M
          if (!Array.isArray(associations)) associations = [associations];

          return memo.concat(associations);
        }, []),
        _.assign(
          {},
          _.omit(options, 'include', 'attributes', 'order', 'where', 'limit', 'plain'),
          {include: include.include || []}
        )
      );
    }

    return include.association.get(results, _.assign(
      {},
      _.omit(options, 'include', 'attributes', 'order', 'where', 'limit', 'plain'),
      include
    )).then(function (map) {
      results.forEach(function (result) {
        result.set(
          include.association.as,
          map[result.get(include.association.source.primaryKeyAttribute)]
        );
      });
    });
  }).return(original);
};

/**
* Search for a single instance by its primary key. This applies LIMIT 1, so the listener will always be called with a single instance.
*
* @param  {Number|String|Buffer}      [options] A hash of options to describe the scope of the search, or a number to search by id.
* @param  {Object}             '      [options]
* @param  {Transaction}               [options.transaction] Transaction to run query under
*
* @see {Model#findAll}           for an explanation of options
* @return {Promise<Instance>}
* @alias findByPrimary
*/
Model.prototype.findById = function(param, options) {
  // For sanity findById will never return if no options are passed
  if ([null, undefined].indexOf(param) !== -1) {
    return Promise.resolve(null);
  }

  options = optClone(options) || {};

  if (typeof param === 'number' || typeof param === 'string' || Buffer.isBuffer(param)) {
    options.where = {};
    options.where[this.primaryKeyAttribute] = param;
  } else {
    throw new Error('Argument passed to findById is invalid: '+param);
  }

  options.limit = 1;

  // Bypass a possible overloaded findAll.
  return Model.prototype.findAll.call(this, _.defaults(options, {
    plain: true
  }));
};
Model.prototype.findByPrimary = Model.prototype.findById;

/**
* Search for a single instance. This applies LIMIT 1, so the listener will always be called with a single instance.
*
* @param  {Object}                    [options] A hash of options to describe the scope of the search
* @param  {Transaction}               [options.transaction] Transaction to run query under
*
* @see {Model#findAll}           for an explanation of options
* @return {Promise<Instance>}
* @alias find
*/
Model.prototype.findOne = function(options) {
  if (options !== undefined && !_.isPlainObject(options)) {
    throw new Error('The argument passed to findOne must be an options object, use findById if you wish to pass a single primary key value');
  }
  options = optClone(options);

  if (options.limit === undefined && !(options.where && options.where[this.primaryKeyAttribute])) {
    options.limit = 1;
  }

  // Bypass a possible overloaded findAll.
  return Model.prototype.findAll.call(this, _.defaults(options, {
    plain: true
  }));
};
Model.prototype.find = Model.prototype.findOne;

/**
 * Run an aggregation method on the specified field
 *
 * @param {String}          field The field to aggregate over. Can be a field name or *
 * @param {String}          aggregateFunction The function to use for aggregation, e.g. sum, max etc.
 * @param {Object}          [options] Query options. See sequelize.query for full options
 * @param {Object}          [options.where] A hash of search attributes.
 * @param {Function}        [options.logging=false] A function that gets executed while running the query to log the sql.
 * @param {DataType|String} [options.dataType] The type of the result. If `field` is a field in this Model, the default will be the type of that field, otherwise defaults to float.
 * @param {boolean}         [options.distinct] Applies DISTINCT to the field being aggregated over
 * @param {Transaction}     [options.transaction] Transaction to run query under
 * @param {boolean}         [options.plain] When `true`, the first returned value of `aggregateFunction` is cast to `dataType` and returned. If additional attributes are specified, along with `group` clauses, set `plain` to `false` to return all values of all returned rows.  Defaults to `true`
 *
 * @return {Promise<options.dataType|object>}                Returns the aggregate result cast to `options.dataType`, unless `options.plain` is false, in which case the complete data result is returned.
 */
Model.prototype.aggregate = function(field, aggregateFunction, options) {
  options = Utils._.extend({ attributes: [] }, options || {});

  var aggregateColumn = this.sequelize.col(field);
  if (options.distinct) {
    aggregateColumn = this.sequelize.fn('DISTINCT', aggregateColumn);
  }
  options.attributes.push([this.sequelize.fn(aggregateFunction, aggregateColumn), aggregateFunction]);

  if (!options.dataType) {
    if (this.rawAttributes[field]) {
      options.dataType = this.rawAttributes[field].type;
    } else {
      // Use FLOAT as fallback
      options.dataType = new DataTypes.FLOAT();
    }
  } else {
    options.dataType = this.sequelize.normalizeDataType(options.dataType);
  }

  options = paranoidClause(this, options);

  return this.QueryInterface.rawSelect(this.getTableName(options), options, aggregateFunction, this);
};

/**
 * Count the number of records matching the provided where clause.
 *
 * If you provide an `include` option, the number of matching associations will be counted instead.
 *
 * @param {Object}        [options]
 * @param {Object}        [options.where] A hash of search attributes.
 * @param {Object}        [options.include] Include options. See `find` for details
 * @param {boolean}       [options.distinct] Apply COUNT(DISTINCT(col))
 * @param {Object}        [options.attributes] Used in conjustion with `group`
 * @param {Object}        [options.group] For creating complex counts. Will return multiple rows as needed.
 * @param  {Transaction}  [options.transaction] Transaction to run query under
 * @param {Function}      [options.logging=false] A function that gets executed while running the query to log the sql.
 *
 * @return {Promise<Integer>}
 */
Model.prototype.count = function(options) {
  options = Utils._.clone(options || {});
  conformOptions(options, this);
  Model.$injectScope(this.$scope, options);

  var col = '*';

  if (options.include) {
    col = this.name + '.' + this.primaryKeyField;
    expandIncludeAll.call(this, options);
    validateIncludedElements.call(this, options);
  }

  Utils.mapOptionFieldNames(options, this);

  options.plain = options.group ? false : true;
  options.dataType = new DataTypes.INTEGER();
  options.includeIgnoreAttributes = false;
  options.limit = null;
  options.offset = null;
  options.order = null;

  return this.aggregate(col, 'count', options);
};

/**
 * Find all the rows matching your query, within a specified offset / limit, and get the total number of rows matching your query. This is very usefull for paging
 *
 * ```js
 * Model.findAndCountAll({
 *   where: ...,
 *   limit: 12,
 *   offset: 12
 * }).then(function (result) {
 *   ...
 * })
 * ```
 * In the above example, `result.rows` will contain rows 13 through 24, while `result.count` will return the total number of rows that matched your query.
 *
 * When you add includes, only those which are required (either because they have a where clause, or because `required` is explicitly set to true on the include) will be added to the count part.
 *
 * Suppose you want to find all users who have a profile attached:
 * ```js
 * User.findAndCountAll({
 *   include: [
 *      { model: Profile, required: true}
 *   ],
 *   limit 3
 * });
 * ```
 * Because the include for `Profile` has `required` set it will result in an inner join, and only the users who have a profile will be counted. If we remove `required` from the include, both users with and without profiles will be counted
 *
 * @param {Object} [findOptions] See findAll
 *
 * @see {Model#findAll} for a specification of find and query options
 * @return {Promise<Object>}
 * @alias findAndCountAll
 */
Model.prototype.findAndCount = function(options) {
  if (options !== undefined && !_.isPlainObject(options)) {
    throw new Error('The argument passed to findAndCount must be an options object, use findById if you wish to pass a single primary key value');
  }

  var self = this
    // no limit, offset, order, attributes for the options given to count()
    , countOptions = _.omit(_.clone(options), ['offset', 'limit', 'order', 'attributes']);

  conformOptions(countOptions, this);

  if (countOptions.include) {
    countOptions.include = _.cloneDeep(countOptions.include, function (element) {
      if (element instanceof Model) return element;
      if (element instanceof Association) return element;
      return undefined;
    });

    expandIncludeAll.call(this, countOptions);

    validateIncludedElements.call(this, countOptions);

    var keepNeeded = function(includes) {
      return includes.filter(function (include) {
        if (include.include) include.include = keepNeeded(include.include);

        return include.required || include.hasIncludeRequired;
      });
    };
    countOptions.include = keepNeeded(countOptions.include);

    if (countOptions.include.length) {
      // Use distinct to count the number of parent rows, instead of the number of matched includes
      countOptions.distinct = true;
    }
  }

  return self.count(countOptions).then(function(count) {
    if (count === 0) {
      return {
        count: count || 0,
        rows: []
      };
    }
    return self.findAll(options).then(function(results) {
      return {
        count: count || 0,
        rows: (results && Array.isArray(results) ? results : [])
      };
    });
  });
};
Model.prototype.findAndCountAll = Model.prototype.findAndCount;


/**
 * Find the maximum value of field
 *
 * @param {String} field
 * @param {Object} [options] See aggregate
 * @see {Model#aggregate} for options
 *
 * @return {Promise<Any>}
 */
Model.prototype.max = function(field, options) {
  return this.aggregate(field, 'max', options);
};

/**
 * Find the minimum value of field
 *
 * @param {String} field
 * @param {Object} [options] See aggregate
 * @see {Model#aggregate} for options
 *
 * @return {Promise<Any>}
 */
Model.prototype.min = function(field, options) {
  return this.aggregate(field, 'min', options);
};

/**
 * Find the sum of field
 *
 * @param {String} field
 * @param {Object} [options] See aggregate
 * @see {Model#aggregate} for options
 *
 * @return {Promise<Number>}
 */
Model.prototype.sum = function(field, options) {
  return this.aggregate(field, 'sum', options);
};

/**
 * Builds a new model instance. Values is an object of key value pairs, must be defined but can be empty.

 * @param {Object}  values
 * @param {Object}  [options]
 * @param {Boolean} [options.raw=false] If set to true, values will ignore field and virtual setters.
 * @param {Boolean} [options.isNewRecord=true]
 * @param {Array}   [options.include] an array of include options - Used to build prefetched/included model instances. See `set`
 *
 * @return {Instance}
 */
Model.prototype.build = function(values, options) { // testhint options:none
  if (Array.isArray(values)) {
    return this.bulkBuild(values, options);
  }
  options = _.extend({
    isNewRecord: true
  }, options || {});

  if (options.attributes) {
    options.attributes = options.attributes.map(function(attribute) {
      return Array.isArray(attribute) ? attribute[1] : attribute;
    });
  }

  if (!options.includeValidated) {
    conformOptions(options, this);
    if (options.include) {
      expandIncludeAll.call(this, options);
      validateIncludedElements.call(this, options);
    }
  }

  return new this.Instance(values, options);
};


Model.prototype.bulkBuild = function(valueSets, options) { // testhint options:none
  options = _.extend({
    isNewRecord: true
  }, options || {});

  if (!options.includeValidated) {
    conformOptions(options, this);
    if (options.include) {
      expandIncludeAll.call(this, options);
      validateIncludedElements.call(this, options);
    }
  }

  if (options.attributes) {
    options.attributes = options.attributes.map(function(attribute) {
      return Array.isArray(attribute) ? attribute[1] : attribute;
    });
  }

  return valueSets.map(function(values) {
    return this.build(values, options);
  }.bind(this));
};

/**
 * Builds a new model instance and calls save on it.

 * @see {Instance#build}
 * @see {Instance#save}
 *
 * @param {Object}        values
 * @param {Object}        [options]
 * @param {Boolean}       [options.raw=false] If set to true, values will ignore field and virtual setters.
 * @param {Boolean}       [options.isNewRecord=true]
 * @param {Array}         [options.fields] If set, only columns matching those in fields will be saved
 * @param {Array}         [options.include] an array of include options - Used to build prefetched/included model instances
 * @param {String}        [options.onDuplicate]
 * @param {Transaction}   [options.transaction] Transaction to run query under
 * @param {Function}      [options.logging=false] A function that gets executed while running the query to log the sql.
 *
 * @return {Promise<Instance>}
 */
Model.prototype.create = function(values, options) {
  options = optClone(options || {});

  return this.build(values, {
    isNewRecord: true,
    attributes: options.fields,
    include: options.include,
    raw: options.raw,
    silent: options.silent
  }).save(options);
};

/**
 * Find a row that matches the query, or build (but don't save) the row if none is found.
 * The successfull result of the promise will be (instance, initialized) - Make sure to use .spread()
 *
 * @param {Object}   options
 * @param {Object}   options.where A hash of search attributes.
 * @param {Object}   [options.defaults] Default values to use if building a new instance
 * @param {Object}   [options.transaction] Transaction to run query under
 * @param {Function} [options.logging=false] A function that gets executed while running the query to log the sql.
 *
 * @return {Promise<Instance,initialized>}
 * @alias findOrBuild
 */
Model.prototype.findOrInitialize = Model.prototype.findOrBuild = function(options) {
  if (!options || !options.where || arguments.length > 1) {
    throw new Error(
      'Missing where attribute in the options parameter passed to findOrInitialize. ' +
      'Please note that the API has changed, and is now options only (an object with where, defaults keys, transaction etc.)'
    );
  }

  var self = this
    , values;

  return self.find(options).then(function(instance) {
    if (instance === null) {
      values = Utils._.clone(options.defaults) || {};
      if (Utils._.isPlainObject(options.where)) {
        values = Utils._.defaults(values, options.where);
      }

      instance = self.build(values);

      return Promise.resolve([instance, true]);
    }

    return Promise.resolve([instance, false]);
  });
};

/**
 * Find a row that matches the query, or build and save the row if none is found
 * The successfull result of the promise will be (instance, created) - Make sure to use .spread()
 *
 * If no transaction is passed in the `options` object, a new transaction will be created internally, to prevent the race condition where a matching row is created by another connection after the find but before the insert call.
 * However, it is not always possible to handle this case in SQLite, specifically if one transaction inserts and another tries to select before the first one has comitted. In this case, an instance of sequelize.TimeoutError will be thrown instead.
 * If a transaction is created, a savepoint will be created instead, and any unique constraint violation will be handled internally.
 *
 * @param {Object}      options
 * @param {Object}      options.where where A hash of search attributes.
 * @param {Object}      [options.defaults] Default values to use if creating a new instance
 * @param {Transaction} [options.transaction] Transaction to run query under
 * @see {Model#findAll} for a full specification of find and options
 * @return {Promise<Instance,created>}
 */
Model.prototype.findOrCreate = function(options) {
  if (!options || !options.where || arguments.length > 1) {
    throw new Error(
      'Missing where attribute in the options parameter passed to findOrCreate. '+
      'Please note that the API has changed, and is now options only (an object with where, defaults keys, transaction etc.)'
    );
  }

  if (options.transaction === undefined && this.sequelize.constructor.cls) {
    var t = this.sequelize.constructor.cls.get('transaction');
    if (t) {
      options.transaction = t;
    }
  }

  var self = this
    , internalTransaction = !options.transaction
    , values
    , whereFields = Object.keys(options.where)
    , defaultFields
    , transaction;

  if (options.defaults) defaultFields = Object.keys(options.defaults);

  // Create a transaction or a savepoint, depending on whether a transaction was passed in
  return self.sequelize.transaction(options).bind({}).then(function (t) {
    transaction = t;
    options.transaction = t;

    return self.findOne(_.defaults({
      transaction: transaction
    }, options));
  }).then(function(instance) {
    if (instance !== null) {
      return [instance, false];
    }

    values = Utils._.clone(options.defaults) || {};
    if (Utils._.isPlainObject(options.where)) {
      values = _.defaults(values, options.where);
    }

    options.exception = true;

    return self.create(values, options).bind(this).then(function(instance) {
      if (instance.get(self.primaryKeyAttribute, { raw: true }) === null) {
        // If the query returned an empty result for the primary key, we know that this was actually a unique constraint violation
        throw new self.sequelize.UniqueConstraintError();
      }

      return [instance, true];
    }).catch(self.sequelize.UniqueConstraintError, function (err) {
      if (defaultFields) {
        if (!_.intersection(err.fields, whereFields).length && _.intersection(err.fields, defaultFields).length) {
          throw err;
        }
      }

      // Someone must have created a matching instance inside the same transaction since we last did a find. Let's find it!
      return self.findOne(_.defaults({
        transaction: internalTransaction ? null : transaction
      }, options)).then(function(instance) {
        // Sanity check, ideally we caught this at the defaultFeilds/err.fields check
        // But if we didn't and instance is null, we will throw
        if (instance === null) throw err;
        return [instance, false];
      });
    });
  }).finally(function () {
    if (internalTransaction && transaction) {
      // If we created a transaction internally, we should clean it up
      return transaction.commit();
    }
  }).uncancellable(); // Don't allow the user to cancel the chain, we want to make sure the transaction is comitted
};

/**
 * A more performant findOrCreate that will not work under a transaction (atleast not in postgres)
 * Will execute a find call, if empty then attempt to create, if unique constraint then attempt to find again
 *
 * @param {Object}      options
 * @param {Object}      options.where where A hash of search attributes.
 * @param {Object}      [options.defaults] Default values to use if creating a new instance
 * @see {Model#findAll} for a full specification of find and options
 * @return {Promise<Instance,created>}
 */
Model.prototype.findCreateFind = function(options) {
  if (!options || !options.where) {
    throw new Error(
      'Missing where attribute in the options parameter passed to findOrCreate.'
    );
  }

  var values = Utils._.clone(options.defaults) || {};
  if (Utils._.isPlainObject(options.where)) {
    values = _.defaults(values, options.where);
  }


  return this.findOne(options).bind(this).then(function (result) {
    if (result) return [result, false];

    return this.create(values, options).bind(this).then(function (result) {
      return [result, true];
    }).catch(this.sequelize.UniqueConstraintError, function (err) {
      return this.findOne(options).then(function (result) {
        return [result, false];
      });
    });
  });
};

/**
 * Insert or update a single row. An update will be executed if a row which matches the supplied values on either the primary key or a unique key is found. Note that the unique index must be defined in your sequelize model and not just in the table. Otherwise you may experience a unique constraint violation, because sequelize fails to identify the row that should be updated.
 *
 * **Implementation details:**
 *
 * * MySQL - Implemented as a single query `INSERT values ON DUPLICATE KEY UPDATE values`
 * * PostgreSQL - Implemented as a temporary function with exception handling: INSERT EXCEPTION WHEN unique_constraint UPDATE
 * * SQLite - Implemented as two queries `INSERT; UPDATE`. This means that the update is executed regardless of whether the row already existed or not
 *
 * **Note** that SQLite returns undefined for created, no matter if the row was created or updated. This is because SQLite always runs INSERT OR IGNORE + UPDATE, in a single query, so there is no way to know whether the row was inserted or not.
 *
 * @param  {Object}       values
 * @param  {Object}       [options]
 * @param  {Boolean}      [options.validate=true] Run validations before the row is inserted
 * @param  {Array}        [options.fields=Object.keys(this.attributes)] The fields to insert / update. Defaults to all fields
 * @param  {Transaction}  [options.transaction] Transaction to run query under
 * @param  {Function}     [options.logging=false] A function that gets executed while running the query to log the sql.
 *
 * @alias insertOrUpdate
 * @return {Promise<created>} Returns a boolean indicating whether the row was created or updated.
 */
Model.prototype.upsert = function (values, options) {
  options = optClone(options) || {};

  if (!options.fields) {
    options.fields = Object.keys(this.attributes);
  }

  var createdAtAttr = this._timestampAttributes.createdAt
    , updatedAtAttr = this._timestampAttributes.updatedAt
    , hadPrimary = this.primaryKeyField in values || this.primaryKeyAttribute in values
    , instance = this.build(values);

  return instance.hookValidate(options).bind(this).then(function () {
    // Map field names
    var updatedDataValues = _.pick(instance.dataValues, Object.keys(instance._changed))
      , insertValues = Utils.mapValueFieldNames(instance.dataValues, options.fields, this)
      , updateValues = Utils.mapValueFieldNames(updatedDataValues, options.fields, this)
      , now = Utils.now(this.sequelize.options.dialect);

    // Attach createdAt
    if (createdAtAttr && !updateValues[createdAtAttr]) {
      insertValues[createdAtAttr] = this.$getDefaultTimestamp(createdAtAttr) || now;
    }
    if (updatedAtAttr && !insertValues[updatedAtAttr]) {
      insertValues[updatedAtAttr] = updateValues[updatedAtAttr] = this.$getDefaultTimestamp(updatedAtAttr) || now;
    }

    // Build adds a null value for the primary key, if none was given by the user.
    // We need to remove that because of some Postgres technicalities.
    if (!hadPrimary && this.primaryKeyAttribute && !this.rawAttributes[this.primaryKeyAttribute].defaultValue) {
      delete insertValues[this.primaryKeyField];
      delete updateValues[this.primaryKeyField];
    }

    return this.QueryInterface.upsert(this.getTableName(options), insertValues, updateValues, this, options);
  });
};

Model.prototype.insertOrUpdate = Model.prototype.upsert;

/**
 * Create and insert multiple instances in bulk.
 *
 * The success handler is passed an array of instances, but please notice that these may not completely represent the state of the rows in the DB. This is because MySQL
 * and SQLite do not make it easy to obtain back automatically generated IDs and other default values in a way that can be mapped to multiple records.
 * To obtain Instances for the newly created values, you will need to query for them again.
 *
 * @param  {Array}        records                          List of objects (key/value pairs) to create instances from
 * @param  {Object}       [options]
 * @param  {Array}        [options.fields]                 Fields to insert (defaults to all fields)
 * @param  {Boolean}      [options.validate=false]         Should each row be subject to validation before it is inserted. The whole insert will fail if one row fails validation
 * @param  {Boolean}      [options.hooks=true]             Run before / after bulk create hooks?
 * @param  {Boolean}      [options.individualHooks=false]  Run before / after create hooks for each individual Instance? BulkCreate hooks will still be run if options.hooks is true.
 * @param  {Boolean}      [options.ignoreDuplicates=false] Ignore duplicate values for primary keys? (not supported by postgres)
 * @param  {Array}        [options.updateOnDuplicate]      Fields to update if row key already exists (on duplicate key update)? (only supported by mysql & mariadb). By default, all fields are updated.
 * @param  {Transaction}  [options.transaction] Transaction to run query under
 * @param  {Function}     [options.logging=false]          A function that gets executed while running the query to log the sql.
 *
 * @return {Promise<Array<Instance>>}
 */
Model.prototype.bulkCreate = function(records, options) {
  if (!records.length) {
    return Promise.resolve([]);
  }

  options = Utils._.extend({
    validate: false,
    hooks: true,
    individualHooks: false,
    ignoreDuplicates: false
  }, options || {});

  options.fields = options.fields || Object.keys(this.tableAttributes);

  var dialect = this.sequelize.options.dialect;
  if (options.ignoreDuplicates && ['postgres', 'mssql'].indexOf(dialect) !== -1) {
    return Promise.reject(new Error(dialect + ' does not support the \'ignoreDuplicates\' option.'));
  }
  if (options.updateOnDuplicate && ['mysql', 'mariadb'].indexOf(dialect) === -1) {
    return Promise.reject(new Error(dialect + ' does not support the \'updateOnDuplicate\' option.'));
  }

  if (options.updateOnDuplicate) {
    // By default, all attributes except 'createdAt' can be updated
    var updatableFields = Utils._.pull(Object.keys(this.tableAttributes), 'createdAt');
    if (Utils._.isArray(options.updateOnDuplicate) && !Utils._.isEmpty(options.updateOnDuplicate)) {
      updatableFields = Utils._.intersection(updatableFields, options.updateOnDuplicate);
    }
    options.updateOnDuplicate = updatableFields;
  }

  var self = this
    , createdAtAttr = this._timestampAttributes.createdAt
    , updatedAtAttr = this._timestampAttributes.updatedAt
    , now = Utils.now(self.modelManager.sequelize.options.dialect);

  var instances = records.map(function(values) {
    return self.build(values, {isNewRecord: true});
  });

  return Promise.try(function() {
    // Run before hook
    if (options.hooks) {
      return self.runHooks('beforeBulkCreate', instances, options);
    }
  }).then(function() {
    instances.forEach(function(instance) {
      var values = Utils.mapValueFieldNames(instance.dataValues, options.fields, self);

      // set createdAt/updatedAt attributes
      if (createdAtAttr && !values[createdAtAttr]) {
        values[createdAtAttr] = now;
      }
      if (updatedAtAttr && !values[updatedAtAttr]) {
        values[updatedAtAttr] = now;
      }

      instance.dataValues = values;
    });

    // Validate
    if (options.validate) {
      var errors = [];
      return Promise.map(instances, function(instance) {
        // hookValidate rejects with errors, validate returns with errors
        if (options.individualHooks) {
          return instance.hookValidate(options).catch(function (err) {
            if (err) {
              errors.push({record: instance, errors: err});
            }
          });
        } else {
          return instance.validate(options).then(function (err) {
            if (err) {
              errors.push({record: instance, errors: err});
            }
          });
        }
      }).then(function() {
        delete options.skip;
        if (errors.length) {
          return Promise.reject(errors);
        }
      });
    }
  }).then(function() {
    if (options.individualHooks) {
      // Create each instance individually
      return Promise.map(instances, function(instance) {
        var individualOptions = Utils._.clone(options);
        delete individualOptions.fields;
        delete individualOptions.individualHooks;
        delete individualOptions.ignoreDuplicates;
        individualOptions.validate = false;
        individualOptions.hooks = true;

        return instance.save(individualOptions);
      }).then(function(_instances) {
        instances = _instances;
      });
    } else {
      // Create all in one query
      // Recreate records from instances to represent any changes made in hooks or validation
      records = instances.map(function(instance) {
        return Utils._.omit(instance.dataValues, self._virtualAttributes);
      });

      // Map attributes for serial identification
      var attributes = {};
      for (var attr in self.tableAttributes) {
        attributes[attr] = self.rawAttributes[attr];
        if (self.rawAttributes[attr].field) {
          attributes[self.rawAttributes[attr].field] = self.rawAttributes[attr];
        }
      }

      // Insert all records at once
      options.model = self;
      return self.QueryInterface.bulkInsert(self.getTableName(options), records, options, attributes).then(function (results) {
        if (Array.isArray(results)) {
          results.forEach(function (result, i) {
            instances[i].set(self.primaryKeyAttribute, result[self.rawAttributes[self.primaryKeyAttribute].field], {raw: true});
          });
        }
        return results;
      });
    }
  }).then(function() {
    // Run after hook
    if (options.hooks) {
      return self.runHooks('afterBulkCreate', instances, options);
    }
  }).then(function() {
    return instances;
  });
};

/**
 * Truncate all instances of the model. This is a convenient method for Model.destroy({ truncate: true }).
 *
 * @param {object} [options] The options passed to Model.destroy in addition to truncate
 * @param {Boolean|function} [options.transaction] Transaction to run query under
 * @param {Boolean|function} [options.cascade = false] Only used in conjuction with TRUNCATE. Truncates  all tables that have foreign-key references to the named table, or to any tables added to the group due to CASCADE.
 * @param {Transaction}      [options.transaction] Transaction to run query under
 * @param {Boolean|function} [options.logging] A function that logs sql queries, or false for no logging
 * @return {Promise}
 *
 * @see {Model#destroy} for more information
 */
Model.prototype.truncate = function(options) {
  options = optClone(options) || {};
  options.truncate = true;
  return this.destroy(options);
};

/**
 * Delete multiple instances, or set their deletedAt timestamp to the current time if `paranoid` is enabled.
 *
 * @param  {Object}       options
 * @param  {Object}       [options.where]                 Filter the destroy
 * @param  {Boolean}      [options.hooks=true]            Run before / after bulk destroy hooks?
 * @param  {Boolean}      [options.individualHooks=false] If set to true, destroy will SELECT all records matching the where parameter and will execute before / after destroy hooks on each row
 * @param  {Number}       [options.limit]                 How many rows to delete
 * @param  {Boolean}      [options.force=false]           Delete instead of setting deletedAt to current timestamp (only applicable if `paranoid` is enabled)
 * @param  {Boolean}      [options.truncate=false]        If set to true, dialects that support it will use TRUNCATE instead of DELETE FROM. If a table is truncated the where and limit options are ignored
 * @param  {Boolean}      [options.cascade=false]         Only used in conjuction with TRUNCATE. Truncates  all tables that have foreign-key references to the named table, or to any tables added to the group due to CASCADE.
 * @param  {Transaction}  [options.transaction] Transaction to run query under
 * @param  {Function}     [options.logging=false]         A function that gets executed while running the query to log the sql.
 * @return {Promise<Integer>} The number of destroyed rows
 */
Model.prototype.destroy = function(options) {
  var self = this
    , instances;

  if (!options || !(options.where || options.truncate)) {
    throw new Error('Missing where or truncate attribute in the options parameter of model.destroy.');
  }

  options = Utils._.extend({
    hooks: true,
    individualHooks: false,
    force: false,
    cascade: false
  }, options || {});

  options.type = QueryTypes.BULKDELETE;
  Model.$injectScope(this.$scope, options);

  Utils.mapOptionFieldNames(options, this);

  return Promise.try(function() {
    // Run before hook
    if (options.hooks) {
      return self.runHooks('beforeBulkDestroy', options);
    }
  }).then(function() {
    // Get daos and run beforeDestroy hook on each record individually
    if (options.individualHooks) {
      return self.findAll({where: options.where, transaction: options.transaction, logging: options.logging}).map(function(instance) {
        return self.runHooks('beforeDestroy', instance, options).then(function() {
          return instance;
        });
      }).then(function(_instances) {
        instances = _instances;
      });
    }
  }).then(function() {
    // Run delete query (or update if paranoid)
    if (self._timestampAttributes.deletedAt && !options.force) {
      var attrValueHash = {}
        , field = self.rawAttributes[self._timestampAttributes.deletedAt].field || self._timestampAttributes.deletedAt;

      attrValueHash[field] = Utils.now(self.modelManager.sequelize.options.dialect);
      return self.QueryInterface.bulkUpdate(self.getTableName(options), attrValueHash, options.where, options, self.rawAttributes);
    } else {
      return self.QueryInterface.bulkDelete(self.getTableName(options), options.where, options, self);
    }
  }).tap(function() {
    // Run afterDestroy hook on each record individually
    if (options.individualHooks) {
      return Promise.map(instances, function(instance) {
        return self.runHooks('afterDestroy', instance, options);
      });
    }
  }).tap(function() {
    // Run after hook
    if (options.hooks) {
      return self.runHooks('afterBulkDestroy', options);
    }
  }).then(function(affectedRows) {
    return affectedRows;
  });
};

/**
 * Restore multiple instances if `paranoid` is enabled.
 *
 * @param  {Object}       options
 * @param  {Object}       [options.where]                 Filter the restore
 * @param  {Boolean}      [options.hooks=true]            Run before / after bulk restore hooks?
 * @param  {Boolean}      [options.individualHooks=false] If set to true, restore will find all records within the where parameter and will execute before / after bulkRestore hooks on each row
 * @param  {Number}       [options.limit]                 How many rows to undelete
 * @param  {Function}     [options.logging=false]         A function that gets executed while running the query to log the sql.
 * @param  {Transaction}  [options.transaction] Transaction to run query under
 *
 * @return {Promise<undefined>}
 */
Model.prototype.restore = function(options) {
  if (!this._timestampAttributes.deletedAt) throw new Error('Model is not paranoid');

  options = Utils._.extend({
    hooks: true,
    individualHooks: false
  }, options || {});

  options.type = QueryTypes.RAW;

  var self = this
    , instances;

  Utils.mapOptionFieldNames(options, this);

  return Promise.try(function() {
    // Run before hook
    if (options.hooks) {
      return self.runHooks('beforeBulkRestore', options);
    }
  }).then(function() {
    // Get daos and run beforeDestroy hook on each record individually
    if (options.individualHooks) {
      return self.findAll({where: options.where, transaction: options.transaction, logging: options.logging}).map(function(instance) {
        return self.runHooks('beforeRestore', instance, options).then(function() {
          return instance;
        });
      }).then(function(_instances) {
        instances = _instances;
      });
    }
  }).then(function() {
    // Run undelete query
    var attrValueHash = {};
    attrValueHash[self._timestampAttributes.deletedAt] = null;
    options.omitNull = false;
    return self.QueryInterface.bulkUpdate(self.getTableName(options), attrValueHash, options.where, options, self._timestampAttributes.deletedAt);
  }).tap(function() {
    // Run afterDestroy hook on each record individually
    if (options.individualHooks) {
      return Promise.map(instances, function(instance) {
        return self.runHooks('afterRestore', instance, options);
      });
    }
  }).tap(function() {
    // Run after hook
    if (options.hooks) {
      return self.runHooks('afterBulkRestore', options);
    }
  }).then(function(affectedRows) {
    return affectedRows;
  });
};

/**
 * Update multiple instances that match the where options. The promise returns an array with one or two elements. The first element is always the number
 * of affected rows, while the second element is the actual affected rows (only supported in postgres with `options.returning` true.)
 *
 * @param  {Object}       values
 * @param  {Object}       options
 * @param  {Object}       options.where                   Options to describe the scope of the search.
 * @param  {Array}        [options.fields]                Fields to update (defaults to all fields)
 * @param  {Boolean}      [options.validate=true]         Should each row be subject to validation before it is inserted. The whole insert will fail if one row fails validation
 * @param  {Boolean}      [options.hooks=true]            Run before / after bulk update hooks?
 * @param  {Boolean}      [options.sideEffects=true] Whether or not to update the side effects of any virtual setters.
 * @param  {Boolean}      [options.individualHooks=false] Run before / after update hooks?. If true, this will execute a SELECT followed by individual UPDATEs. A select is needed, because the row data needs to be passed to the hooks
 * @param  {Boolean}      [options.returning=false]       Return the affected rows (only for postgres)
 * @param  {Number}       [options.limit]                 How many rows to update (only for mysql and mariadb)
 * @param  {Function}     [options.logging=false] A function that gets executed while running the query to log the sql.
 * @param  {Transaction}  [options.transaction] Transaction to run query under
 *
 * @return {Promise<Array<affectedCount,affectedRows>>}
 */
Model.prototype.update = function(values, options) {
  var self = this;

  if (!options || !options.where) {
    throw new Error('Missing where attribute in the options parameter passed to update.');
  }

  options = Utils._.extend({
    validate: true,
    hooks: true,
    individualHooks: false,
    returning: false,
    force: false,
    sideEffects: true
  }, options || {});

  options.type = QueryTypes.BULKUPDATE;

  Model.$injectScope(this.$scope, options);

  // Remove values that are not in the options.fields
  if (options.fields && options.fields instanceof Array) {
    Object.keys(values).forEach(function(key) {
      if (options.fields.indexOf(key) < 0) {
        delete values[key];
      }
    });
  } else {
    var updatedAtAttr = this._timestampAttributes.updatedAt;
    options.fields = _.intersection(Object.keys(values), Object.keys(this.tableAttributes));
    if (updatedAtAttr && options.fields.indexOf(updatedAtAttr) === -1) {
      options.fields.push(updatedAtAttr);
    }
  }

  if (this._timestampAttributes.updatedAt) {
    values[this._timestampAttributes.updatedAt] = this.$getDefaultTimestamp(this._timestampAttributes.updatedAt) || Utils.now(this.sequelize.options.dialect);
  }

  var instances
    , valuesUse;

  return Promise.try(function() {
    // Validate
    if (options.validate) {
      var build = self.build(values);
      build.set(self._timestampAttributes.updatedAt, values[self._timestampAttributes.updatedAt], { raw: true });

      if (options.sideEffects) {
        values = Utils._.assign(values, Utils._.pick(build.get(), build.changed()));
        options.fields = Utils._.union(options.fields, Object.keys(values));
      }

      // We want to skip validations for all other fields
      options.skip = Utils._.difference(Object.keys(self.attributes), Object.keys(values));
      return build.hookValidate(options).then(function(attributes) {
        options.skip = undefined;
        if (attributes && attributes.dataValues) {
          values = Utils._.pick(attributes.dataValues, Object.keys(values));
        }
      });
    }
  }).then(function() {
    // Run before hook
    if (options.hooks) {
      options.attributes = values;
      return self.runHooks('beforeBulkUpdate', options).then(function() {
        values = options.attributes;
        delete options.attributes;
      });
    }
  }).then(function() {
    valuesUse = values;

    // Get instances and run beforeUpdate hook on each record individually
    if (options.individualHooks) {
      return self.findAll({where: options.where, transaction: options.transaction, logging: options.logging}).then(function(_instances) {
        instances = _instances;
        if (!instances.length) {
          return [];
        }

        // Run beforeUpdate hooks on each record and check whether beforeUpdate hook changes values uniformly
        // i.e. whether they change values for each record in the same way
        var changedValues
          , different = false;

        return Promise.map(instances, function(instance) {
          // Record updates in instances dataValues
          Utils._.extend(instance.dataValues, values);
          // Set the changed fields on the instance
          Utils._.forIn(valuesUse, function(newValue, attr) {
            if (newValue !== instance._previousDataValues[attr]) {
              instance.setDataValue(attr, newValue);
            }
          });

          // Run beforeUpdate hook
          return self.runHooks('beforeUpdate', instance, options).then(function() {
            if (!different) {
              var thisChangedValues = {};
              Utils._.forIn(instance.dataValues, function(newValue, attr) {
                if (newValue !== instance._previousDataValues[attr]) {
                  thisChangedValues[attr] = newValue;
                }
              });

              if (!changedValues) {
                changedValues = thisChangedValues;
              } else {
                different = !Utils._.isEqual(changedValues, thisChangedValues);
              }
            }

            return instance;
          });
        }).then(function(_instances) {
          instances = _instances;

          if (!different) {
            // Hooks do not change values or change them uniformly
            if (Object.keys(changedValues).length) {
              // Hooks change values - record changes in valuesUse so they are executed
              valuesUse = changedValues;
            }
            return;
          } else {
            // Hooks change values in a different way for each record
            // Do not run original query but save each record individually
            return Promise.map(instances, function(instance) {
              var individualOptions = Utils._.clone(options);
              delete individualOptions.individualHooks;
              individualOptions.hooks = false;
              individualOptions.validate = false;

              return instance.save(individualOptions);
            }).tap(function(_instances) {
              instances = _instances;
            });
          }
        });
      });
    }
  }).then(function(results) {
    if (results) {
      // Update already done row-by-row - exit
      return [results.length, results];
    }

    valuesUse = Utils.mapValueFieldNames(valuesUse, options.fields, self);
    options = Utils.mapOptionFieldNames(options, self);
    options.hasTrigger =  self.options ? self.options.hasTrigger : false;

    // Run query to update all rows
    return self.QueryInterface.bulkUpdate(self.getTableName(options), valuesUse, options.where, options, self.tableAttributes).then(function(affectedRows) {
      if (options.returning) {
        instances = affectedRows;
        return [affectedRows.length, affectedRows];
      }

      return [affectedRows];
    });
  }).tap(function(result) {
    if (options.individualHooks) {
      return Promise.map(instances, function(instance) {
        return self.runHooks('afterUpdate', instance, options);
      }).then(function() {
        result[1] = instances;
      });
    }
  }).tap(function() {
    // Run after hook
    if (options.hooks) {
      options.attributes = values;
      return self.runHooks('afterBulkUpdate', options).then(function() {
        delete options.attributes;
      });
    }
  }).then(function(result) {
    // Return result in form [affectedRows, instances] (instances missed off if options.individualHooks != true)
    return result;
  });
};

/**
 * Run a describe query on the table. The result will be return to the listener as a hash of attributes and their types.
 *
 * @return {Promise}
 */
Model.prototype.describe = function(schema, options) {
  return this.QueryInterface.describeTable(this.tableName, _.assign({schema: schema || this.options.schema || undefined}, options));
};

Model.prototype.$getDefaultTimestamp = function(attr) {
  if (!!this.rawAttributes[attr] && !!this.rawAttributes[attr].defaultValue) {
    return Utils.toDefaultValue(this.rawAttributes[attr].defaultValue);
  }
  return undefined;
};

// Inject current scope into options. Includes should have been conformed (conformOptions) before calling this
Model.$injectScope = function (scope, options) {
  var filteredScope = _.omit(scope, 'include'); // Includes need special treatment

  _.defaults(options, filteredScope);
  _.defaults(options.where, filteredScope.where);

  if (scope.include) {
    options.include = options.include || [];

    // Reverse so we consider the latest include first.
    // This is used if several scopes specify the same include - the last scope should take precendence
    scope.include.reverse().forEach(function (scopeInclude) {
      if (!_.any(options.include, function matchesModelAndAlias(item) {
        var sameModel = item.model.name === scopeInclude.model.name;

        if (sameModel && item.as) {
          return item.as === scopeInclude.as;
        }
        return sameModel;
      })) {
        options.include.push(scopeInclude);
      }
    });
  }
};

Model.prototype.inspect = function() {
  return this.name;
};

Utils._.extend(Model.prototype, associationsMixin);
Hooks.applyTo(Model);

module.exports = Model;
