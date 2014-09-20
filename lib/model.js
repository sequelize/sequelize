"use strict";

var Utils = require('./utils')
  , Instance = require('./instance')
  , Attribute = require('./model/attribute')
  , Association = require('./associations/base')
  , DataTypes = require('./data-types')
  , Util = require('util')
  , sql = require('sql')
  , SqlString = require('./sql-string')
  , Transaction = require('./transaction')
  , Promise = require("./promise")
  , QueryTypes = require('./query-types');

module.exports = (function() {
  /**
   * A Model represents a table in the database. Sometimes you might also see it refererred to as model, or simply as factory. This class should _not_ be instantiated directly, it is created using `sequelize.define`, and already created models can be loaded using `sequelize.import`
   *
   * @class Model
   * @mixes Hooks
   * @mixes Associations
   */
  var Model = function(name, attributes, options) {
    this.options = Utils._.extend({
      timestamps: true,
      createdAt: 'createdAt',
      updatedAt: 'updatedAt',
      deletedAt: 'deletedAt',
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
      scopes: null,
      hooks: {
        beforeCreate: [],
        afterCreate: []
      }
    }, options || {});

    this.associations = {};
    this.modelManager = this.daoFactoryManager = null;
    this.name = name;
    this.options.hooks = this.replaceHookAliases(this.options.hooks);
    this.scopeObj = {};
    this.sequelize = options.sequelize;
    this.underscored = this.underscored || this.underscoredAll;

    if (!this.options.tableName) {
      this.tableName = this.options.freezeTableName ? name : Utils._.underscoredIf(Utils.pluralize(name), this.options.underscoredAll);
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

      if (attribute.references instanceof Model) {
        attribute.references = attribute.references.tableName;
      }

      if (attribute.type === undefined) {
        throw new Error('Unrecognized data type for field ' + name);
      }

      if (attribute.type.toString() === DataTypes.ENUM.toString()) {
        // The ENUM is a special case where the type is an object containing the values
        attribute.values = attribute.type.values || attribute.values || [];

        if (!attribute.values.length) {
          throw new Error('Values for ENUM haven\'t been defined.');
        }

        attributes[name].validate = attributes[name].validate || {
          _checkEnum: function(value, next) {
            var hasValue = value !== undefined
              , isMySQL = ['mysql', 'mariadb'].indexOf(options.sequelize.options.dialect) !== -1
              , ciCollation = !!options.collate && options.collate.match(/_ci$/i) !== null
              , valueOutOfScope;


            if (isMySQL && ciCollation && hasValue) {
              var scopeIndex = (attributes[name].values || []).map(function(d) { return d.toLowerCase(); }).indexOf(value.toLowerCase());
              valueOutOfScope = scopeIndex === -1;
            } else {
              valueOutOfScope = ((attributes[name].values || []).indexOf(value) === -1);
            }

            if (hasValue && valueOutOfScope && attributes[name].allowNull !== true) {
              return next('Value "' + value + '" for ENUM ' + name + ' is out of allowed scope. Allowed values: ' + attributes[name].values.join(', '));
            }
            next();
          }
        };
      }

      return attribute;
    });
  };

  Object.defineProperty(Model.prototype, 'QueryInterface', {
    get: function() { return this.modelManager.sequelize.getQueryInterface(); }
  });

  Object.defineProperty(Model.prototype, 'QueryGenerator', {
    get: function() { return this.QueryInterface.QueryGenerator; }
  });

  // inject the node-sql methods to the dao factory in order to
  // receive the syntax sugar ...

  (function() {
    var instance = sql.define({ name: 'dummy', columns: [] });

    for (var methodName in instance) {
     ;(function(methodName) {
        Model.prototype[methodName] = function() {
          var dataset = this.dataset()
            , result = dataset[methodName].apply(dataset, arguments)
            , dialect = this.modelManager.sequelize.options.dialect
            , self = this;

          result.toSql = function() {
            var query = result.toQuery();
            return SqlString.format(query.text.replace(/(\$\d)/g, '?'), query.values, null, dialect) + ';';
          };

          result.exec = function(options) {
            options = Utils._.extend({
              transaction: null,
              type: QueryTypes.SELECT
            }, options || {});

            return self.sequelize.query(result.toSql(), self, options);
          };

          return result;
        };
      })(methodName);
    }
  })();

  Model.prototype.toString = function () {
    return '[object SequelizeModel]';
  };

  Model.prototype.init = function(modelManager) {
    var self = this;

    this.modelManager =
    this.daoFactoryManager = modelManager;
    this.primaryKeys = {};
    self.options.uniqueKeys = {};

    // Setup names of timestamp attributes
    this._timestampAttributes = {};
    if (this.options.timestamps) {
      if (this.options.createdAt) {
        this._timestampAttributes.createdAt = Utils._.underscoredIf(this.options.createdAt, this.options.underscored);
      }
      if (this.options.updatedAt) {
        this._timestampAttributes.updatedAt = Utils._.underscoredIf(this.options.updatedAt, this.options.underscored);
      }
      if (this.options.paranoid && this.options.deletedAt) {
        this._timestampAttributes.deletedAt = Utils._.underscoredIf(this.options.deletedAt, this.options.underscored);
      }
    }

    // Identify primary and unique attributes
    Utils._.each(this.rawAttributes, function(options, attribute) {
      if (options.hasOwnProperty('unique') && options.unique !== true && options.unique !== false) {
        var idxName = options.unique;
        if (typeof options.unique === 'object') {
          idxName = options.unique.name;
        }

        self.options.uniqueKeys[idxName] = self.options.uniqueKeys[idxName] || {fields: [], msg: null};
        self.options.uniqueKeys[idxName].fields.push(attribute);
        self.options.uniqueKeys[idxName].msg = self.options.uniqueKeys[idxName].msg || options.unique.msg || null;
        self.options.uniqueKeys[idxName].name = idxName || false;
      }

      if (options.primaryKey === true) {
        self.primaryKeys[attribute] = self.attributes[attribute];
      }
    });

    // Add head and tail default attributes (id, timestamps)
    addDefaultAttributes.call(this);
    addOptionalClassMethods.call(this);

    // Primary key convenience variables
    this.primaryKeyAttributes = Object.keys(this.primaryKeys);
    this.primaryKeyAttribute = this.primaryKeyAttributes[0];
    this.primaryKeyCount = this.primaryKeyAttributes.length;
    this._hasPrimaryKeys = this.options.hasPrimaryKeys = this.hasPrimaryKeys = this.primaryKeyCount > 0;

    this._isPrimaryKey = Utils._.memoize(function(key) {
      return self.primaryKeyAttributes.indexOf(key) !== -1;
    });


    if (typeof this.options.defaultScope === 'object') {
      Utils.injectScope.call(this, this.options.defaultScope);
    }

    // Instance prototype
    this.Instance = this.DAO = function() {
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

    this.refreshAttributes();
    findAutoIncrementField.call(this);

    this._booleanAttributes = [];
    this._dateAttributes = [];
    this._hstoreAttributes = [];
    this._virtualAttributes = [];
    this._defaultValues = {};
    this.Instance.prototype.validators = {};

    Utils._.each(this.rawAttributes, function(definition, name) {
      var type = definition.type._typeName || definition.type;

      if (type === DataTypes.BOOLEAN) {
        self._booleanAttributes.push(name);
      } else if (type === DataTypes.DATE) {
        self._dateAttributes.push(name);
      } else if (type === DataTypes.HSTORE) {
        self._hstoreAttributes.push(name);
      } else if (type === DataTypes.VIRTUAL) {
        self._virtualAttributes.push(name);
      }

      if (definition.hasOwnProperty('defaultValue')) {
        self._defaultValues[name] = Utils._.partial(
          Utils.toDefaultValue, definition.defaultValue);
      }

      if (definition.hasOwnProperty('validate')) {
        self.Instance.prototype.validators[name] = definition.validate;
      }
    });

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

    this._hasVirtualAttributes = !!this._virtualAttributes.length;
    this._isVirtualAttribute = Utils._.memoize(function(key) {
      return self._virtualAttributes.indexOf(key) !== -1;
    });

    this.Instance.prototype.$Model =
    this.Instance.prototype.Model = this;

    this._hasDefaultValues = !Utils._.isEmpty(this._defaultValues);

    this.tableAttributes = Utils._.omit(this.rawAttributes, this._virtualAttributes);

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
        options.Model = self;
        options.fieldName = attribute;
        options._modelAttribute = true;

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

    return Promise.resolve().then(function () {
      if (options.force) {
        return self.drop(options);
      }
    }).then(function () {
      return self.QueryInterface.createTable(self.getTableName(), attributes, options);
    }).then(function () {
      return self.QueryInterface.showIndex(self.getTableName(), options);
    }).then(function (indexes) {
      // Assign an auto-generated name to indexes which are not named by the user
      self.options.indexes = self.QueryInterface.nameIndexes(self.options.indexes, self.tableName);

      indexes = Utils._.filter(self.options.indexes, function (item1) {
        return !Utils._.any(indexes, function (item2) {
          return item1.name === item2.name;
        });
      });

      return Promise.map(indexes, function (index) {
        return self.QueryInterface.addIndex(self.getTableName(), index.fields, index, self.tableName);
      });
    }).return(this);
  };

  /**
   * Drop the table represented by this Model
   * @param {Object}  [options]
   * @param {Boolean} [options.cascade=false] Also drop all objects depending on this table, such as views. Only works in postgres
   * @return {Promise}
   */
  Model.prototype.drop = function(options) {
    return this.QueryInterface.dropTable(this.getTableName(), options);
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
   * @return this
   */
  Model.prototype.schema = function(schema, options) {
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
   * @param {Object}  options  The hash of options from any query. You can use one model to access tables with matching schemas by overriding `getTableName` and using custom key/values to alter the name of the table. (eg. subscribers_1, subscribers_2)
   * @return {String|Object}
   */
  Model.prototype.getTableName = function() {
    return this.QueryGenerator.addSchema(this);
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
   *         where: ['email like ? AND access_level >= ?', email + '%', accessLevel]
   *       }
   *     },
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
   * @param {Array|Object|String|null}    options* The scope(s) to apply. Scopes can either be passed as consecutive arguments, or as an array of arguments. To apply simple scopes, pass them as strings. For scope function, pass an object, with a `method` property. The value can either be a string, if the method does not take any arguments, or an array, where the first element is the name of the method, and consecutive elements are arguments to that method. Pass null to remove all scopes, including the default.
   * @return {Model}                      A reference to the model, with the scope(s) applied. Calling scope again on the returned model will clear the previous scope.
   */
  Model.prototype.scope = function(option) {
    var self = Object.create(this)
      , type
      , options
      , merge
      , i
      , scope
      , scopeName
      , scopeOptions
      , argLength = arguments.length
      , lastArg = arguments[argLength - 1];

    self.scoped = true;

    // Set defaults
    scopeOptions = (typeof lastArg === 'object' && !Array.isArray(lastArg) ? lastArg : {}) || {}; // <-- for no arguments
    scopeOptions.silent = (scopeOptions !== null && scopeOptions.hasOwnProperty('silent') ? scopeOptions.silent : true);

    // Clear out any predefined scopes...
    self.scopeObj = {};

    // Possible formats for option:
    // String of arguments: 'hello', 'world', 'etc'
    // Array: ['hello', 'world', 'etc']
    // Object: {merge: 'hello'}, {method: ['scopeName' [, args1, args2..]]}, {merge: true, method: ...}

    if (argLength < 1 || !option) {
      return self;
    }

    for (i = 0; i < argLength; i++) {
      options = Array.isArray(arguments[i]) ? arguments[i] : [arguments[i]];

      options.forEach(function(o) {
        type = typeof o;
        scope = null;
        merge = false;
        scopeName = null;

        if (type === 'object') {
          // Right now we only support a merge functionality for objects
          if (!!o.merge) {
            merge = true;
            scopeName = o.merge[0];
            if (Array.isArray(o.merge) && !!self.options.scopes[scopeName]) {
              scope = self.options.scopes[scopeName].apply(self, o.merge.splice(1));
            }
            else if (typeof o.merge === 'string') {
              scopeName = o.merge;
              scope = self.options.scopes[scopeName];
            }
          }

          if (!!o.method) {
            if (Array.isArray(o.method) && !!self.options.scopes[o.method[0]]) {
              scopeName = o.method[0];
              scope = self.options.scopes[scopeName].apply(self, o.method.splice(1));
              merge = !!o.merge;
            }
            else if (!!self.options.scopes[o.method]) {
              scopeName = o.method;
              scope = self.options.scopes[scopeName].apply(self);
            }
          } else {
            scopeName = o;
            scope = self.options.scopes[scopeName];
          }

          if (o.where) {
            scope = o;
            merge = true;
          }
        } else {
          scopeName = o;
          scope = self.options.scopes[scopeName];
        }

        if (!!scope) {
          Utils.injectScope.call(self, scope, merge);
        }
        else if (scopeOptions.silent !== true && !!scopeName) {
          throw new Error('Invalid scope ' + scopeName + ' called.');
        }
      });
    }

    return self;
  };

  Model.prototype.all = function(options, queryOptions) {
    return this.findAll(options, queryOptions);
  };

  /**
   * Search for multiple instances.
   *
   * __Simple search using AND and =__
   * ```js
   * Model.find({
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
   * Model.find({
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
   * Possible options are: `gt, gte, lt, lte, ne, between/.., nbetween/notbetween/!.., in, not, like, nlike/notlike`
   *
   * __Queries using OR__
   * ```js
   * Model.find({
   *   where: Sequelize.and(
   *     { name: 'a project' },
   *     Sequelize.or(
   *       { id: [1,2,3] },
   *       { id: { gt: 10 } }
   *     )
   *   )
   * })
   * ```
   * ```sql
   * WHERE name = 'a project' AND (id` IN (1,2,3) OR id > 10)
   * ```
   *
   * The success listener is called with an array of instances if the query succeeds.
   *
   * @param  {Object}                    [options] A hash of options to describe the scope of the search
   * @param  {Object}                    [options.where] A hash of attributes to describe your search. See above for examples.
   * @param  {Array<String>}             [options.attributes] A list of the attributes that you want to select. To rename an attribute, you can pass an array, with two elements - the first is the name of the attribute in the DB (or some kind of expression such as `Sequelize.literal`, `Sequelize.fn` and so on), and the second is the name you want the attribute to have in the returned instance
   * @param  {Boolean}                   [options.paranoid=true] If false, will include columns which have a non-null deletedAt column.
   * @param  {Array<Object|Model>}       [options.include] A list of associations to eagerly load using a left join. Supported is either `{ include: [ Model1, Model2, ...]}` or `{ include: [{ model: Model1, as: 'Alias' }]}`. If your association are set up with an `as` (eg. `X.hasMany(Y, { as: 'Z }`, you need to specify Z in the as attribute when eager loading Y).
   * @param  {Model}                     [options.include[].model] The model you want to eagerly load
   * @param  {String}                    [options.include[].as] The alias of the relation, in case the model you want to eagerly load is aliassed. For `hasOne` / `belongsTo`, this should be the singular name, and for `hasMany`, it should be the plural
   * @param  {Association}               [options.include[].association] The association you want to eagerly load. (This can be used instead of providing a model/as pair)
   * @param  {Object}                    [options.include[].where] Where clauses to apply to the child models. Note that this converts the eager load to an inner join, unless you explicitly set `required: true`
   * @param  {Array<String>}             [options.include[].attributes] A list of attributes to select from the child model
   * @param  {Boolean}                   [options.include[].required] If true, converts to an inner join, which means that the parent model will only be loaded if it has any matching children. True if `include.where` is set, false otherwise.
   * @param  {Array<Object|Model>}       [options.include[].include] Load further nested related models
   * @param  {String|Array|Sequelize.fn} [options.order] Specifies an ordering. If a string is provided, it will be esacped. Using an array, you can provide several columns / functions to order by. Each element can be further wrapped in a two-element array. The first element is the column / function to order by, the second is the direction. For example: `order: [['name', 'DESC']]`. In this way the column will be escaped, but the direction will not.
   * @param  {Number}                    [options.limit]
   * @param  {Number}                    [options.offset]
   * @param  {Object}                    [queryOptions] Set the query options, e.g. raw, specifying that you want raw data instead of built Instances. See sequelize.query for options
   * @param  {Transaction}               [queryOptions.transaction]
   * @param  {String}                    [queryOptions.lock] Lock the selected rows in either share or update mode. Possible options are transaction.LOCK.UPDATE and transaction.LOCK.SHARE. See [transaction.LOCK for an example](https://github.com/sequelize/sequelize/wiki/API-Reference-Transaction#LOCK)
   *
   * @see    {Sequelize#query}
   * @return {Promise<Array<Instance>>}
   * @alias all
   */
  Model.prototype.findAll = function(options, queryOptions) {
    var hasJoin = false
      , tableNames = { };

    tableNames[this.getTableName()] = true;

    options = optClone(options || {});
    options = Utils._.defaults(options, {
      hooks: true
    });

    return Promise.bind(this).then(function() {
      conformOptions(options);

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
          hasJoin = true;

          validateIncludedElements.call(this, options, tableNames);

          if (options.attributes) {
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
      mapFieldNames.call(this, options, this);

      options = paranoidClause.call(this, options);

      if (options.hooks) {
        return this.runHooks('beforeFindAfterOptions', options);
      }
	}).then(function() {
      return this.QueryInterface.select(this, this.getTableName(), options, Utils._.defaults({
        type: QueryTypes.SELECT,
        hasJoin: hasJoin,
        tableNames: Object.keys(tableNames)
      }, queryOptions, { transaction: (options || {}).transaction }));
    }).tap(function(results) {
      if (options.hooks) {
        return this.runHooks('afterFind', results, options);
      }
    });
  };

  //right now, the caller (has-many-double-linked) is in charge of the where clause
  Model.prototype.findAllJoin = function(joinTableName, options, queryOptions) {
    options = optClone(options || {});
    options.attributes = options.attributes || [this.QueryInterface.quoteTable(this.name) + '.*'];
    // whereCollection is used for non-primary key updates
    this.options.whereCollection = options.where || null;

    return this.QueryInterface.select(this, [[this.getTableName(), this.name], joinTableName], options, Utils._.defaults({
      type: QueryTypes.SELECT
    }, queryOptions, { transaction: (options || {}).transaction }));
  };

 /**
  * Search for a single instance. This applies LIMIT 1, so the listener will always be called with a single instance.
  *
  * @param  {Object|Number}             [options] A hash of options to describe the scope of the search, or a number to search by id.
  * @param  {Object}                    [queryOptions]
  *
  * @see {Model#findAll}           for an explanation of options and queryOptions
  * @return {Promise<Instance>}
  * @alias find
  */
  Model.prototype.findOne = function(param, queryOptions) {
    // For sanity findOne will never return if no options are passed
    if ([null, undefined].indexOf(param) !== -1) {
      return Promise.resolve(null);
    }

    var options = {};
    if (typeof param === 'number' || typeof param === 'string' || Buffer.isBuffer(param)) {
      options.where = {};
      options.where[this.primaryKeyAttribute] = param;
    } else {
      options = optClone(param);
    }

    if (options.limit === undefined && !(options.where && options.where[this.primaryKeyAttribute])) {
      options.limit = 1;
    }

    return this.findAll(options, Utils._.defaults({
      plain: true
    }, queryOptions || {}));
  };
  Model.prototype.find = Model.prototype.findOne;

  /**
   * Run an aggregation method on the specified field
   *
   * @param {String}          field The field to aggregate over. Can be a field name or *
   * @param {String}          aggregateFunction The function to use for aggregation, e.g. sum, max etc.
   * @param {Object}          [options] Query options. See sequelize.query for full options
   * @param {DataType|String} [options.dataType] The type of the result. If `field` is a field in this Model, the default will be the type of that field, otherwise defaults to float.
   * @param {boolean}         [options.distinct] Applies DISTINCT to the field being aggregated over
   *
   * @return {Promise<options.dataType>}
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
        options.dataType = DataTypes.FLOAT;
      }
    }

    options = paranoidClause.call(this, options);

    return this.QueryInterface.rawSelect(this.getTableName(), options, aggregateFunction, this);
  };

  /**
   * Count the number of records matching the provided where clause.
   *
   * If you provide an `include` option, the number of matching associations will be counted instead.
   *
   * @param {Object}  [options]
   * @param {Object}  [options.include] Include options. See `find` for details
   * @param {boolean} [options.distinct] Appliy COUNT(DISTINCT(col))
   *
   * @return {Promise<Integer>}
   */
  Model.prototype.count = function(options) {
    options = Utils._.clone(options || {});
    conformOptions(options);

    var col = '*';
    if (options.include) {
      col = this.name + '.' + this.primaryKeyAttribute;
      expandIncludeAll.call(this, options);
      validateIncludedElements.call(this, options);
    }

    options.dataType = DataTypes.INTEGER;
    options.includeIgnoreAttributes = false;
    options.limit = null;

    return this.aggregate(col, 'COUNT', options);
  };

  /**
   * Find all the rows matching your query, within a specified offset / limit, and get the total number of rows matching your query. This is very usefull for paging
   *
   * ```js
   * Model.findAndCountAll({
   *   where: ...,
   *   limit: 12,
   *   offset: 12
   * }).success(function (result) {
   * })
   * ```
   * In the above example, `result.rows` will contain rows 13 through 24, while `result.count` will return the total number of rows that matched your query.
   *
   * @param {Object} [findOptions] See findAll
   * @param {Object} [queryOptions] See Sequelize.query
   *
   * @see {Model#findAll} for a specification of find and query options
   * @return {Promise<Object>}
   */
  Model.prototype.findAndCountAll = function(findOptions, queryOptions) {
    var self = this
      // no limit, offset, order, attributes for the options given to count()
      , countOptions = Utils._.omit(findOptions ? Utils._.merge({}, findOptions) : {}, ['offset', 'limit', 'order', 'attributes']);

    return self.count(countOptions).then(function(count) {
      if (count === 0) {
        return {
          count: count || 0,
          rows: []
        };
      }
      return self.findAll(findOptions, queryOptions).then(function(results) {
        return {
          count: count || 0,
          rows: (results && Array.isArray(results) ? results : [])
        };
      });
    });
  };

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
   * @param {Boolean} [options.isDirty=true]
   * @param {Array}   [options.include] an array of include options - Used to build prefetched/included model instances. See `set`
   *
   * @return {Instance}
   */
  Model.prototype.build = function(values, options) {
    if (Array.isArray(values)) {
      return this.bulkBuild(values, options);
    }
    options = options || { isNewRecord: true, isDirty: true };

    if (options.attributes) {
      options.attributes = options.attributes.map(function(attribute) {
        return Array.isArray(attribute) ? attribute[1] : attribute;
      });
    }

    if (!options.includeValidated) {
      conformOptions(options);
      if (options.include) {
        expandIncludeAll.call(this, options);
        validateIncludedElements.call(this, options);
      }
    }

    return new this.Instance(values, options);
  };


  Model.prototype.bulkBuild = function(valueSets, options) {
    options = options || { isNewRecord: true, isDirty: true };

    if (!options.includeValidated) {
      conformOptions(options);
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
   * @param {Boolean}       [options.isDirty=true]
   * @param {Array}         [options.fields] If set, only columns matching those in fields will be saved
   * @param {Array}         [options.include] an array of include options - Used to build prefetched/included model instances
   * @param {Transaction}   [options.transaction]
   *
   * @return {Promise<Instance>}
   */
  Model.prototype.create = function(values, options) {
    Utils.validateParameter(values, Object, { optional: true });
    Utils.validateParameter(options, Object, { deprecated: Array, optional: true, index: 2, method: 'Model#create' });
    if (options instanceof Array) {
      options = { fields: options };
    }

    options = Utils._.extend({
      transaction: null
    }, options || {});

    return this.build(values, {
      isNewRecord: true,
      attributes: options.fields
    }).save(options);
  };

  /**
   * Find a row that matches the query, or build (but don't save) the row if none is found.
   * The successfull result of the promise will be (instance, initialized) - Make sure to use .spread()
   *
   * @param {Object}  options
   * @param {Object}  options.where A hash of search attributes.
   * @param {Object}  [options.defaults] Default values to use if building a new instance
   * @param {Object}  [options.transaction] Transaction to run query under
   *
   * @return {Promise<Instance>}
   * @method
   * @alias findOrBuild
   */
  Model.prototype.findOrInitialize = Model.prototype.findOrBuild = function(options) {
    if (!options || !options.where) {
      throw new Error('Missing where attribute in the options parameter passed to findOrCreate. Please note that the API has changed, and is now options (an object with where and defaults keys), queryOptions (transaction etc.)');
    }

    var self = this
      , values;

    return self.find({
      where: options.where
    }, options).then(function(instance) {
      if (instance === null) {
        values = Utils._.clone(options.defaults) || {};
        if (Utils._.isPlainObject(options.where)) {
          values = Utils._.defaults(values, options.where);
        }

        instance = self.build(values);
        options.skip = Object.keys(values);

        return instance.hookValidate(options).then(function() {
          delete options.skip;
          return Promise.resolve([instance, true]);
        });
      }

      return Promise.resolve([instance, false]);
    });
  };

  /**
   * Find a row that matches the query, or build and save the row if none is found
   * The successfull result of the promise will be (instance, created) - Make sure to use .spread()
   *
   * If no transaction is passed in the `queryOptions` object, a new transaction will be created internally, to prevent the race condition where a matching row is created by another connection after the find but before the insert call.
   * However, it is not always possible to handle this case in SQLite, specifically if one transaction inserts and another tries to select before the first one has comitted. In this case, an instance of sequelize.TimeoutError will be thrown instead.
   * If a transaction is created, a savepoint will be created instead, and any unique constraint violation will be handled internally.
   *
   * @param {Object}  options
   * @param {Object}  options.where where A hash of search attributes.
   * @param {Object}  [options.defaults] Default values to use if creating a new instance
   * @param {Object}  [queryOptions] Options passed to the find and create calls
   *
   * @return {Promise<Instance,created>}
   */
  Model.prototype.findOrCreate = function(options, queryOptions) {
    var self = this
      , internalTransaction = !(queryOptions && queryOptions.transaction)
      , values;

    queryOptions = queryOptions ? Utils._.clone(queryOptions) : {};

    if (!options || !options.where) {
      throw new Error('Missing where attribute in the options parameter passed to findOrCreate. Please note that the API has changed, and is now options (an object with where and defaults keys), queryOptions (transaction etc.)');
    }

    // Create a transaction or a savepoint, depending on whether a transaction was passed in
    return self.sequelize.transaction(queryOptions).bind({}).then(function (transaction) {
      this.transaction = transaction;
      queryOptions.transaction = transaction;

      return self.find(options, {
        transaction: transaction,
      });
    }).then(function(instance) {
      if (instance !== null) {
        return [instance, false];
      }

      values = Utils._.clone(options.defaults) || {};
      if (Utils._.isPlainObject(options.where)) {
        values = Utils._.defaults(values, options.where);
      }

      // VERY PG specific
      // If a unique constraint is triggered inside a transaction, we cannot execute further queries inside that transaction, short of rolling back or committing.
      // To circumwent this, we add an EXCEPTION WHEN unique_violation clause, which always returns an empty result set
      queryOptions.exception = 'WHEN unique_violation THEN RETURN QUERY SELECT * FROM <%= table %> WHERE 1 <> 1;';

      return self.create(values, queryOptions).bind(this).then(function(instance) {
        if (instance.get(self.primaryKeyAttribute, { raw: true }) === null) {
          // If the query returned an empty result for the primary key, we know that this was actually a unique constraint violation
          throw new self.sequelize.UniqueConstraintError();
        }

        return [instance, true];
      }).catch(self.sequelize.UniqueConstraintError, function () {
        // Someone must have created a matching instance inside the same transaction since we last did a find. Let's find it!
        return self.find(options, {
          transaction: internalTransaction ? null : this.transaction,
        }).then(function(instance) {
          return [instance, false];
        });
      });
    }).finally(function () {
      if (internalTransaction) {
        // If we created a transaction internally, we should clean it up
        return this.transaction.commit();
      }
    });
  };

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
   *
   * @return {Promise<Array<Instance>>}
   */
  Model.prototype.bulkCreate = function(records, fieldsOrOptions, options) {
    Utils.validateParameter(fieldsOrOptions, Object, { deprecated: Array, optional: true, index: 2, method: 'Model#bulkCreate' });
    Utils.validateParameter(options, undefined, { deprecated: Object, optional: true, index: 3, method: 'Model#bulkCreate' });

    if (!records.length) {
      return Promise.resolve([]);
    }

    options = Utils._.extend({
      validate: false,
      hooks: true,
      individualHooks: false,
      ignoreDuplicates: false
    }, options || {});

    if (fieldsOrOptions instanceof Array) {
      options.fields = fieldsOrOptions;
    } else {
      options.fields = options.fields || Object.keys(this.tableAttributes);
      options = Utils._.extend(options, fieldsOrOptions);
    }

    if (this.sequelize.options.dialect === 'postgres' && options.ignoreDuplicates) {
      return Promise.reject(new Error('Postgres does not support the \'ignoreDuplicates\' option.'));
    }

    var self = this
      , createdAtAttr = this._timestampAttributes.createdAt
      , updatedAtAttr = this._timestampAttributes.updatedAt
      , now = Utils.now(self.modelManager.sequelize.options.dialect);

    // build DAOs
    var daos = records.map(function(values) {
      return self.build(values, {isNewRecord: true});
    });

    return Promise.try(function() {
      // Run before hook
      if (options.hooks) {
        return self.runHooks('beforeBulkCreate', daos, options);
      }
    }).then(function() {
      daos.forEach(function(dao) {
        // Filter dataValues by options.fields
        var values = {};
        options.fields.forEach(function(field) {
          values[field] = dao.dataValues[field];
        });

        // set createdAt/updatedAt attributes
        if (createdAtAttr && !values[createdAtAttr]) {
          values[createdAtAttr] = now;
        }
        if (updatedAtAttr && !values[updatedAtAttr]) {
          values[updatedAtAttr] = now;
        }

        dao.dataValues = values;
      });

      // Validate
      if (options.validate) {
        options.skip = Utils._.difference(Object.keys(self.attributes), options.fields);

        var errors = [];
        return Promise.map(daos, function(dao) {
          var fn = options.individualHooks ? 'hookValidate' : 'validate';
          return dao[fn](options).then(function(err) {
            if (!!err) {
              errors.push({record: dao, errors: err});
            }
          });
        }).then(function() {
          delete options.skip;
          if (errors.length) {
            return Promise.reject(errors);
          }
        });
      }
    }).then(function() {
      if (options.individualHooks) {
        // Create each dao individually
        return Promise.map(daos, function(dao) {
          var individualOptions = Utils._.clone(options);
          delete individualOptions.fields;
          delete individualOptions.individualHooks;
          delete individualOptions.ignoreDuplicates;
          individualOptions.validate = false;
          individualOptions.hooks = true;

          return dao.save(individualOptions);
        }).then(function(_daos) {
          daos = _daos;
        });
      } else {
        // Create all in one query
        // Recreate records from daos to represent any changes made in hooks or validation
        records = daos.map(function(dao) {
          return Utils._.omit(dao.dataValues, self._virtualAttributes);
        });

        // Map field names
        records.forEach(function(values) {
          for (var attr in values) {
            if (values.hasOwnProperty(attr)) {
              if (self.rawAttributes[attr].field) {
                values[self.rawAttributes[attr].field] = values[attr];
                delete values[attr];
              }
            }
          }
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
        return self.QueryInterface.bulkInsert(self.getTableName(), records, options, attributes);
      }
    }).then(function() {
      // Run after hook
      if (options.hooks) {
        return self.runHooks('afterBulkCreate', daos, options);
      }
    }).then(function() {
      return daos;
    });
  };

  /**
   * Delete multiple instances, or set their deletedAt timestamp to the current time if `paranoid` is enabled.
   *
   * @param  {Object}   [options.where]                 Filter the destroy
   * @param  {Boolean}  [options.hooks=true]            Run before / after bulk destroy hooks?
   * @param  {Boolean}  [options.individualHooks=false] If set to true, destroy will find all records within the where parameter and will execute before / after bulkDestroy hooks on each row
   * @param  {Number}   [options.limit]                 How many rows to delete
   * @param  {Boolean}  [options.force=false]           Delete instead of setting deletedAt to current timestamp (only applicable if `paranoid` is enabled)
   * @param  {Boolean}  [options.truncate=false]        If set to true, dialects that support it will use TRUNCATE instead of DELETE FROM. If a table is truncated the where and limit options are ignored
   * @param  {Boolean}  [options.cascade=false]         Only used in conjuction with TRUNCATE. Truncates  all tables that have foreign-key references to the named table, or to any tables added to the group due to CASCADE.
   *
   * @return {Promise<undefined>}
   */
  Model.prototype.destroy = function(options) {
    options = Utils._.extend({
      hooks: true,
      individualHooks: false,
      force: false,
      cascade: false
    }, options || {});

    options.type = QueryTypes.BULKDELETE;

    var self = this
      , instances;

    return Promise.try(function() {
      // Run before hook
      if (options.hooks) {
        return self.runHooks('beforeBulkDestroy', options);
      }
    }).then(function() {
      // Get daos and run beforeDestroy hook on each record individually
      if (options.individualHooks) {
        return self.findAll({where: options.where}, {transaction: options.transaction}).map(function(instance) {
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
        var attrValueHash = {};
        attrValueHash[self._timestampAttributes.deletedAt] = Utils.now(self.modelManager.sequelize.options.dialect);
        return self.QueryInterface.bulkUpdate(self.getTableName(), attrValueHash, options.where, options, self.rawAttributes);
      } else {
        return self.QueryInterface.bulkDelete(self.getTableName(), options.where, options, self);
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
   * Update multiple instances that match the where options. The promise returns an array with one or two elements. The first element is always the number
   * of affected rows, while the second element is the actual affected rows (only supported in postgres with `options.returning` true.)
   *
   * @param  {Object}   attrValueHash                   A hash of fields to change and their new values
   * @param  {Object}   options
   * @param  {Object    options.where                   Options to describe the scope of the search.
   * @param  {Boolean}  [options.validate=true]         Should each row be subject to validation before it is inserted. The whole insert will fail if one row fails validation
   * @param  {Boolean}  [options.hooks=true]            Run before / after bulk update hooks?
   * @param  {Boolean}  [options.individualHooks=false] Run before / after update hooks?
   * @param  {Boolean}  [options.returning=false]       Return the affected rows (only for postgres)
   * @param  {Number}   [options.limit]                 How many rows to update (only for mysql and mariadb)
   * @deprecated The syntax is due for change, in order to make `where` more consistent with the rest of the API
   *
   * @return {Promise<Array<affectedCount,affectedRows>>}
   */
  Model.prototype.update = function(attrValueHash, options) {
    var self = this;

    if (!options || !options.where) {
      throw new Error('Missing where attribute in the options parameter passed to update.');
    }

    options = Utils._.extend({
      validate: true,
      hooks: true,
      individualHooks: false,
      returning: false,
      force: false
    }, options || {});

    options.type = QueryTypes.BULKUPDATE;

    if (self._timestampAttributes.updatedAt) {
      attrValueHash[self._timestampAttributes.updatedAt] = Utils.now(self.modelManager.sequelize.options.dialect);
    }

    var daos
      , attrValueHashUse;

    return Promise.try(function() {
      // Validate
      if (options.validate) {
        var build = self.build(attrValueHash);
        build.set(self._timestampAttributes.updatedAt, attrValueHash[self._timestampAttributes.updatedAt], { raw: true });

        // We want to skip validations for all other fields
        options.skip = Utils._.difference(Object.keys(self.attributes), Object.keys(attrValueHash));
        return build.hookValidate(options).then(function(attributes) {
          delete options.skip;
          if (attributes && attributes.dataValues) {
            attrValueHash = Utils._.pick(attributes.dataValues, Object.keys(attrValueHash));
          }
        });
      }
    }).then(function() {
      // Run before hook
      if (options.hooks) {
        options.attributes = attrValueHash;
        return self.runHooks('beforeBulkUpdate', options).then(function() {
          attrValueHash = options.attributes;
          delete options.attributes;
        });
      }
    }).then(function() {
      attrValueHashUse = attrValueHash;

      // Get daos and run beforeUpdate hook on each record individually
      if (options.individualHooks) {
        return self.findAll({where: options.where}, {transaction: options.transaction}).then(function(_daos) {
          daos = _daos;
          if (!daos.length) {
            return [];
          }

          // Run beforeUpdate hooks on each record and check whether beforeUpdate hook changes values uniformly
          // i.e. whether they change values for each record in the same way
          var changedValues
            , different = false;

          return Promise.map(daos, function(dao) {
            // Record updates in dao's dataValues
            Utils._.extend(dao.dataValues, attrValueHash);

            // Run beforeUpdate hook
            return self.runHooks('beforeUpdate', dao, options).then(function() {
              if (!different) {
                var thisChangedValues = {};
                Utils._.forIn(dao.dataValues, function(newValue, attr) {
                  if (newValue !== dao._previousDataValues[attr]) {
                    thisChangedValues[attr] = newValue;
                  }
                });

                if (!changedValues) {
                  changedValues = thisChangedValues;
                } else {
                  different = !Utils._.isEqual(changedValues, thisChangedValues);
                }
              }

              return dao;
            });
          }).then(function(_daos) {
            daos = _daos;

            if (!different) {
              // Hooks do not change values or change them uniformly
              if (Object.keys(changedValues).length) {
                // Hooks change values - record changes in attrValueHashUse so they are executed
                attrValueHashUse = changedValues;
              }
              return;
            } else {
              // Hooks change values in a different way for each record
              // Do not run original query but save each record individually
              return Promise.map(daos, function(dao) {
                var individualOptions = Utils._.clone(options);
                delete individualOptions.individualHooks;
                individualOptions.hooks = false;
                individualOptions.validate = false;

                return dao.save(individualOptions);
              }).tap(function(_daos) {
                daos = _daos;
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

      // Run query to update all rows
      return self.QueryInterface.bulkUpdate(self.getTableName(), attrValueHashUse, options.where, options, self.tableAttributes).then(function(affectedRows) {
        if (options.returning) {
          daos = affectedRows;
          return [affectedRows.length, affectedRows];
        }

        return [affectedRows];
      });
    }).tap(function(result) {
      if (options.individualHooks) {
        return Promise.map(daos, function(dao) {
          return self.runHooks('afterUpdate', dao, options);
        }).then(function() {
          result[1] = daos;
        });
      }
    }).tap(function() {
      // Run after hook
      if (options.hooks) {
        options.attributes = attrValueHash;
        return self.runHooks('afterBulkUpdate', options).then(function() {
          delete options.attributes;
        });
      }
    }).then(function(result) {
      // Return result in form [affectedRows, daos] (daos missed off if options.individualHooks != true)
      return result;
    });
  };

  /**
   * Run a describe query on the table. The result will be return to the listener as a hash of attributes and their types.
   *
   * @return {Promise}
   */
  Model.prototype.describe = function(schema) {
    return this.QueryInterface.describeTable(this.tableName, schema || this.options.schema || undefined);
  };

  /**
   * A proxy to the node-sql query builder, which allows you to build your query through a chain of method calls.
   * The returned instance already has all the fields property populated with the field of the model.
   *
   * @see https://github.com/brianc/node-sql
   * @return {node-sql} A node-sql instance
   */
  Model.prototype.dataset = function() {
    if (!this.__sql) {
      this.__setSqlDialect();
    }

    var instance = this.__sql.define({ name: this.tableName, columns: [] })
      , attributes = this.attributes;

    Object.keys(attributes).forEach(function(key) {
      instance.addColumn(key, attributes[key]);
    });

    return instance;
  };

  Model.prototype.__setSqlDialect = function() {
    var dialect = this.modelManager.sequelize.options.dialect;
    this.__sql = sql.setDialect(dialect === 'mariadb' ? 'mysql' : dialect);
  };

  var mapFieldNames = function(options, Model) {
    if (options.attributes) {
      options.attributes = options.attributes.map(function(attr) {
        // Object lookups will force any variable to strings, we don't want that for special objects etc
        if (typeof attr !== "string") return attr;
        // Map attributes to aliased syntax attributes
        if (Model.rawAttributes[attr] && Model.rawAttributes[attr].field) {
          return [Model.rawAttributes[attr].field, attr];
        }
        return attr;
      });
    }

    if (options.where) {
      var attributes = options.where
        , attribute;

      if (options.where instanceof Utils.and || options.where instanceof Utils.or) {
        attributes = undefined;
        options.where.args = options.where.args.map(function (where) {
          return mapFieldNames({
            where: where
          }, Model).where;
        });
      }

      if (attributes) {
        for (attribute in attributes) {
          if (Model.rawAttributes[attribute] && Model.rawAttributes[attribute].field) {
            attributes[Model.rawAttributes[attribute].field] = attributes[attribute];
            delete attributes[attribute];
          }
        }
      }
    }
    return options;
  };

  // private

  var paranoidClause = function(options) {
    if (! this.options.timestamps || ! this.options.paranoid || options.paranoid === false) return options || {};

    options = options || {};
    options.where = options.where || {};

    // Apply on each include
    // This should be handled before handling where conditions because of logic with returns
    // otherwise this code will never run on includes of a already conditionable where
    if (options.include && options.include.length) {
      options.include.forEach(function(include) {
        if (Utils._.isPlainObject(include) && include.model) {
          paranoidClause.call(include.model, include);
        }
      });
    }

    var deletedAtCol = this._timestampAttributes.deletedAt
      , deletedAtObject = {};

    deletedAtObject[ deletedAtCol ] = null;

    // detect emptiness
    if(
      Utils._.isObject(options.where) && Object.keys( options.where ).length === 0 ||
      ( Utils._.isString(options.where) || Utils._.isArray(options.where) ) && options.where.length === 0
    ) {
      options.where = deletedAtObject;
      return options;
    }

    options.where = this.sequelize.and( deletedAtObject, options.where );
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
    if (!Object.keys(this.primaryKeys).length) {
      head = {
        id: {
          type: DataTypes.INTEGER,
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

  var conformOptions = function(options) {
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
      if (include instanceof Association) {
        include = { association: include };
      } else if (include instanceof Model) {
        include = { model: include };
      } else if (typeof include !== 'object') {
        throw new Error('Include unexpected. Element has to be either a Model, an Association or an object.');
      } else {
        // convert daoFactory to model (for backwards compatibility)
        if (include.hasOwnProperty('daoFactory')) {
          include.model = include.daoFactory;
          delete include.daoFactory;
        }

        conformOptions(include);
      }

      return include;
    });
  };

  var validateIncludedElements = function(options, tableNames) {
    tableNames = tableNames || {};
    options.includeNames = [];
    options.includeMap = {};
    options.hasSingleAssociation = false;
    options.hasMultiAssociation = false;

    // validate all included elements
    var includes = options.include;
    for (var index = 0; index < includes.length; index++) {
      var include = includes[index] = validateIncludedElement.call(this, includes[index], tableNames);

      include.parent = options;
      // associations that are required or have a required child as is not a ?:M association are candidates for the subquery
      include.subQuery = !include.association.isMultiAssociation && (include.hasIncludeRequired || include.required);
      include.hasParentWhere = options.hasParentWhere || !!options.where;
      include.hasParentRequired = options.hasParentRequired || !!options.required;

      options.includeMap[include.as] = include;
      options.includeNames.push(include.as);

      if (include.association.isMultiAssociation || include.hasMultiAssociation) {
        options.hasMultiAssociation = true;
      }
      if (include.association.isSingleAssociation || include.hasSingleAssociation) {
        options.hasSingleAssociation = true;
      }

      options.hasIncludeWhere = options.hasIncludeWhere || include.hasIncludeWhere || !!include.where;
      options.hasIncludeRequired = options.hasIncludeRequired || include.hasIncludeRequired || !!include.required;
    }
  };

  var validateIncludedElement = function(include, tableNames) {
    if (!include.hasOwnProperty('model') && !include.hasOwnProperty('association')) {
      throw new Error('Include malformed. Expected attributes: model or association');
    }

    if (include.association && !include._pseudo && !include.model) include.model = include.association.source;

    tableNames[include.model.getTableName()] = true;

    if (include.attributes) {
      include.originalAttributes = include.attributes.slice(0);
      include.model.primaryKeyAttributes.forEach(function(attr) {
        if (include.attributes.indexOf(attr) === -1) {
          include.attributes.unshift(attr);
        }
      });
    } else {
      include.attributes = Object.keys(include.model.tableAttributes);
    }

    include = mapFieldNames(include, include.model);

    // pseudo include just needed the attribute logic, return
    if (include._pseudo) {
      return include;
    }

    // check if the current Model is actually associated with the passed Model - or it's a pseudo include
    var association = include.association || this.getAssociation(include.model, include.as);
    if (association) {
      include.association = association;
      include.as = association.as;

      // If through, we create a pseudo child include, to ease our parsing later on
      if (include.association.through && Object(include.association.through.model) === include.association.through.model) {
        if (!include.include) include.include = [];
        var through = include.association.through;

        include.through = Utils._.defaults(include.through || {}, {
          model: through.model,
          as: Utils.singularize(through.model.tableName),
          association: {
            isSingleAssociation: true
          },
          _pseudo: true
        });

        include.include.push(include.through);
        tableNames[through.tableName] = true;
      }

      if (include.required === undefined) {
        include.required = !!include.where;
      }

      if (include.association.scope) {
        include.where = include.where ? new Util.and(include.where, include.association.scope) :  include.association.scope;
      }

      // Validate child includes
      if (include.hasOwnProperty('include')) {
        validateIncludedElements.call(include.model, include, tableNames);
      }

      return include;
    } else {
      var msg = include.model.name;

      if (include.as) {
        msg += ' (' + include.as + ')';
      }

      msg += ' is not associated to ' + this.name + '!';

      throw new Error(msg);
    }
  };

  var expandIncludeAll = function(options) {
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
      used.push(parent);
      Utils._.forEach(parent.associations, function(association) {
        if (all !== true && all.indexOf(association.associationType) === -1) {
          return;
        }

        // check if model already included, and skip if so
        var model = association.target;
        var as = association.options.as;
        if (Utils._.find(includes, {model: model, as: as})) {
          return;
        }

        // skip if recursing over a model already nested
        if (nested && used.indexOf(model) !== -1) {
          return;
        }

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

  var optClone = function(options) {
    return Utils._.cloneDeep(options, function(elem) {
      // The InstanceFactories used for include are pass by ref, so don't clone them.
      if (elem &&
        (
          elem._isSequelizeMethod ||
          elem instanceof Model ||
          elem instanceof Transaction ||
          elem instanceof Association
        )
      ) {
        return elem;
      }
      // Unfortunately, lodash.cloneDeep doesn't preserve Buffer.isBuffer, which we have to rely on for binary data
      if (Buffer.isBuffer(elem)) { return elem; }

      // Otherwise return undefined, meaning, 'handle this lodash'
      return undefined;
    });
  };

  Utils._.extend(Model.prototype, require('./associations/mixin'));
  Utils._.extend(Model.prototype, require(__dirname + '/hooks'));

  return Model;
})();
