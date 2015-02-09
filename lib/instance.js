'use strict';

var Utils = require('./utils')
  , Mixin = require('./associations/mixin')
  , InstanceValidator = require('./instance-validator')
  , DataTypes = require('./data-types')
  , Promise = require("./promise")
  , _ = require('lodash')
  , defaultsOptions = { raw: true };


module.exports = (function() {
  /**
   * This class represents an single instance, a database row. You might see it referred to as both Instance and instance. You should not
   * instantiate the Instance class directly, instead you access it using the finder and creation methods on the model.
   *
   * Instance instances operate with the concept of a `dataValues` property, which stores the actual values represented by the instance.
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
   * @see {Sequelize#define} for more information about getters and setters
   * @class Instance
   */
  var Instance = function(values, options) {
    this.dataValues = {};
    this._previousDataValues = {};
    this.__options = this.Model.options;
    this.options = options || {};
    this.hasPrimaryKeys = this.Model.options.hasPrimaryKeys;
    this.__eagerlyLoadedAssociations = [];
    /**
     * Returns true if this instance has not yet been persisted to the database
     * @property isNewRecord
     * @return {Boolean}
     */
    this.isNewRecord = options.isNewRecord;

    /**
     * Returns the Model the instance was created from.
     * @see {Model}
     * @property Model
     * @return Model
     */

    initValues.call(this, values, options);
  };

  /**
   * A reference to the sequelize instance
   * @see {Sequelize}
   * @property sequelize
   * @return {Sequelize}
   */
  Object.defineProperty(Instance.prototype, 'sequelize', {
    get: function() { return this.Model.modelManager.sequelize; }
  });

  Object.defineProperty(Instance.prototype, 'QueryInterface', {
    get: function() { return this.sequelize.getQueryInterface(); }
  });

  /**
   * If timestamps and paranoid are enabled, returns whether the deletedAt timestamp of this instance is set. Otherwise, always returns false.
   * @property isDeleted
   * @return {Boolean}
   */
  Object.defineProperty(Instance.prototype, 'isDeleted', {
    get: function() {
      return this.Model._timestampAttributes.deletedAt && this.dataValues[this.Model._timestampAttributes.deletedAt] !== null;
    }
  });

  /**
   * Get the values of this Instance. Proxies to `this.get`
   * @see {Instance#get}
   * @property values
   * @return {Object}
   */
  Object.defineProperty(Instance.prototype, 'values', {
    get: function() {
      return this.get();
    }
  });

  /**
   * A getter for `this.changed()`. Returns true if any keys have changed.
   *
   * @see {Instance#changed}
   * @property isDirty
   * @return {Boolean}
   */
  Object.defineProperty(Instance.prototype, 'isDirty', {
    get: function() {
      return !!this.changed();
    }
  });

  /**
   * Get the values of the primary keys of this instance.
   *
   * @property primaryKeyValues
   * @return {Object}
   */
  Object.defineProperty(Instance.prototype, 'primaryKeyValues', {
    get: function() {
      var result = {}
        , self = this;

      Utils._.each(this.Model.primaryKeys, function(_, attr) {
        result[attr] = self.dataValues[attr];
      });

      return result;
    }
  });

  Object.defineProperty(Instance.prototype, 'identifiers', {
    get: function() {
      var primaryKeys = Object.keys(this.Model.primaryKeys)
        , result = {}
        , self = this;
      primaryKeys.forEach(function(identifier) {
        result[identifier] = self.dataValues[identifier];
      });

      return result;
    }
  });

  Instance.prototype.toString = function () {
    return '[object SequelizeInstance]';
  };

  /**
   * Get the value of the underlying data value
   *
   * @param {String} key
   * @return {any}
   */
  Instance.prototype.getDataValue = function(key) {
    return this.dataValues[key];
  };

  /**
   * Update the underlying data value
   *
   * @param {String} key
   * @param {any} value
   */
  Instance.prototype.setDataValue = function(key, value) {
    this.dataValues[key] = value;
  };

  /**
   * If no key is given, returns all values of the instance, also invoking virtual getters.
   *
   * If key is given and a field or virtual getter is present for the key it will call that getter - else it will return the value for key.
   *
   * @param {String} [key]
   * @param {Object} [options]
   * @param {Boolean} [options.plain=false] If set to true, included instances will be returned as plain objects
   * @return {Object|any}
   */
  Instance.prototype.get = function(key, options) {
    if (options === undefined && typeof key === "object") {
      options = key;
      key = undefined;
    }

    if (key) {
      if (this._customGetters[key]) {
        return this._customGetters[key].call(this, key);
      }
      if (options && options.plain && this.options.include && this.options.includeNames.indexOf(key) !== -1) {
        if (Array.isArray(this.dataValues[key])) {
          return this.dataValues[key].map(function (instance) {
            return instance.get({plain: options.plain});
          });
        } else if (this.dataValues[key] instanceof Instance) {
          return this.dataValues[key].get({plain: options.plain});
        } else {
          return this.dataValues[key];
        }
      }
      return this.dataValues[key];
    }

    if (this._hasCustomGetters || (options && options.plain && this.options.include) || (options && options.clone)) {
      var values = {}
        , _key;

      if (this._hasCustomGetters) {
        for (_key in this._customGetters) {
          if (this._customGetters.hasOwnProperty(_key)) {
            values[_key] = this.get(_key);
          }
        }
      }

      for (_key in this.dataValues) {
        if (!values.hasOwnProperty(_key) && this.dataValues.hasOwnProperty(_key)) {
          if (options && options.plain && this.options.include && this.options.includeNames.indexOf(_key) !== -1) {
            if (Array.isArray(this.dataValues[_key])) {
              values[_key] = this.dataValues[_key].map(function (instance) {
                return instance.get({plain: options.plain});
              });
            } else if (this.dataValues[_key] instanceof Instance) {
              values[_key] = this.dataValues[_key].get({plain: options.plain});
            } else {
              values[_key] = this.dataValues[_key];
            }
          } else {
            values[_key] = this.dataValues[_key];
          }
        }
      }
      return values;
    }
    return this.dataValues;
  };

  /**
   * Set is used to update values on the instance (the sequelize representation of the instance that is, remember that nothing will be persisted before you actually call `save`).
   * In its most basic form `set` will update a value stored in the underlying `dataValues` object. However, if a custom setter function is defined for the key, that function
   * will be called instead. To bypass the setter, you can pass `raw: true` in the options object.
   *
   * If set is called with an object, it will loop over the object, and call set recursively for each key, value pair. If you set raw to true, the underlying dataValues will either be
   * set directly to the object passed, or used to extend dataValues, if dataValues already contain values.
   *
   * When set is called, the previous value of the field is stored, so that you can later see which fields changed (see `changed`).
   *
   * Set can also be used to build instances for associations, if you have values for those. TODO - mick should probably write something here about how includes in set works - perhaps also even some tests?
   *
   * @see {Model#find} for more information about includes
   * @param {String|Object} key
   * @param {any} value
   * @param {Object} [options]
   * @param {Boolean} [options.raw=false] If set to true, field and virtual setters will be ignored
   * @param {Boolean} [options.reset=false] Clear all previously set data values
   * @param {Object}  [options.include]
   * @alias setAttributes
   */
  Instance.prototype.set = function(key, value, options) {
    var values
      , originalValue
      , keys
      , i
      , length;

    if (typeof key === 'object') {
      values = key;
      options = value;
      options || (options = {});

      if (options.reset) {
        this.dataValues = {};
      }

      // If raw, and we're not dealing with includes or special attributes, just set it straight on the dataValues object
      if (options.raw && !(this.options && this.options.include) && !(options && options.attributes) && !this.Model._hasBooleanAttributes && !this.Model._hasDateAttributes) {
        if (Object.keys(this.dataValues).length) {
          this.dataValues = _.extend(this.dataValues, values);
        } else {
          this.dataValues = values;
        }
        // If raw, .changed() shouldn't be true
        this._previousDataValues = _.clone(this.dataValues);
      } else {
        // Loop and call set

        if (options.attributes) {
          keys = options.attributes;
          if (this.Model._hasVirtualAttributes) {
            keys = keys.concat(this.Model._virtualAttributes);
          }

          if (this.options.includeNames) {
            keys = keys.concat(this.options.includeNames);
          }

          for (i = 0, length = keys.length; i < length; i++) {
            if (values[keys[i]] !== undefined) {
              this.set(keys[i], values[keys[i]], options);
            }
          }
        } else {
          for (key in values) {
            this.set(key, values[key], options);
          }
        }

        if (options.raw) {
          // If raw, .changed() shouldn't be true
          this._previousDataValues = _.clone(this.dataValues);
        }
      }
    } else {
      options || (options = {});
      if (!options.raw) {
        originalValue = this.dataValues[key];
      }

      // If not raw, and there's a customer setter
      if (!options.raw && this._customSetters[key]) {
        this._customSetters[key].call(this, value, key);
      } else {
        // Check if we have included models, and if this key matches the include model names/aliases

        if (this.options && this.options.include && this.options.includeNames.indexOf(key) !== -1 && value) {
          // Pass it on to the include handler
          this._setInclude(key, value, options);
          return;
        } else {
          // Bunch of stuff we won't do when its raw
          if (!options.raw) {
            // If attribute is not in model definition, return
            if (!this._isAttribute(key)) {
              return;
            }

            // If attempting to set primary key and primary key is already defined, return
            if (this.Model._hasPrimaryKeys && originalValue && this.Model._isPrimaryKey(key)) {
              return;
            }

            // If attempting to set read only attributes, return
            if (!this.isNewRecord && this.Model._hasReadOnlyAttributes && this.Model._isReadOnlyAttribute(key)) {
              return;
            }

            // Convert date fields to real date objects
            if (this.Model._hasDateAttributes && this.Model._isDateAttribute(key) && value !== null && value !== undefined && !(value instanceof Date) && !value._isSequelizeMethod) {
              value = new Date(value);
            }
          }

          // Convert boolean-ish values to booleans
          if (this.Model._hasBooleanAttributes && this.Model._isBooleanAttribute(key) && value !== null && value !== undefined && !value._isSequelizeMethod) {
            if (Buffer.isBuffer(value) && value.length === 1) {
              // Bit fields are returned as buffers
              value = value[0];
            }
            value = _.isString(value) ? !!parseInt(value, 10) : !!value;
          }

          if (!options.raw && originalValue !== value) {
            this._previousDataValues[key] = originalValue;
          }
          this.dataValues[key] = value;
        }
      }
    }

    return this;
  };

  Instance.prototype.setAttributes = function(updates) {
    return this.set(updates);
  };

  /**
   * If changed is called with a string it will return a boolean indicating whether the value of that key in `dataValues` is different from the value in `_previousDataValues`.
   *
   * If changed is called without an argument, it will return an array of keys that have changed.
   *
   * @param {String} [key]
   * @return {Boolean|Array}
   */
  Instance.prototype.changed = function(key) {
    if (key) {
      if (this.Model._isDateAttribute(key) && this._previousDataValues[key] && this.dataValues[key]) {
        return this._previousDataValues[key].valueOf() !== this.dataValues[key].valueOf();
      }
      return this._previousDataValues[key] !== this.dataValues[key];
    }
    var changed = Object.keys(this.dataValues).filter(function(key) {
      return this.changed(key);
    }.bind(this));

    return changed.length ? changed : false;
  };

  /**
   * Returns the previous value for key from `_previousDataValues`.
   * @param {String} key
   * @return {any}
   */
  Instance.prototype.previous = function(key) {
    return this._previousDataValues[key];
  };

  Instance.prototype._setInclude = function(key, value, options) {
    if (!Array.isArray(value)) value = [value];
    if (value[0] instanceof Instance) {
      value = value.map(function(instance) {
        return instance.dataValues;
      });
    }

    var include = this.options.includeMap[key]
      , association = include.association
      , self = this
      , accessor = key
      , childOptions
      , primaryKeyAttribute  = include.model.primaryKeyAttribute
      , isEmpty;

    if (!isEmpty) {
      childOptions = {
        isNewRecord: false,
        isDirty: false,
        include: include.include,
        includeNames: include.includeNames,
        includeMap: include.includeMap,
        includeValidated: true,
        raw: options.raw,
        attributes: include.originalAttributes
      };
    }
    if (include.originalAttributes === undefined || include.originalAttributes.length) {
      if (association.isSingleAssociation) {
        if (Array.isArray(value)) {
          value = value[0];
        }

        isEmpty = value && value[primaryKeyAttribute] === null;
        self[accessor] = self.dataValues[accessor] = isEmpty ? null : include.model.build(value, childOptions);
      } else {
        isEmpty = value[0] && value[0][primaryKeyAttribute] === null;
        self[accessor] = self.dataValues[accessor] = isEmpty ? [] : include.model.bulkBuild(value, childOptions);
      }
    }
  };

  /**
   * Validate this instance, and if the validation passes, persist it to the database.
   *
   * On success, the callback will be called with this instance. On validation error, the callback will be called with an instance of `Sequelize.ValidationError`.
   * This error will have a property for each of the fields for which validation failed, with the error message for that field.
   *
   * @param {Object} [options]
   * @param {Object} [options.fields] An optional array of strings, representing database columns. If fields is provided, only those columns will be validated and saved.
   * @param {Boolean} [options.silent=false] If true, the updatedAt timestamp will not be updated.
   * @param {Boolean} [options.validate=true] If false, validations won't be run.
   * @param {Transaction} [options.transaction]
   *
   * @return {Promise<this|Errors.ValidationError>}
   */
  Instance.prototype.save = function(options, deprecated) {
    if (options instanceof Array) {
      options = { fields: options };
    }

    options = Utils._.extend({
      hooks: true,
      validate: true
    }, options, deprecated);

    if (!options.fields) {
      if (this.isNewRecord) {
        options.fields = Object.keys(this.Model.attributes);
      } else {
        options.fields = _.intersection(this.changed(), Object.keys(this.Model.attributes));
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

    var self = this
      , updatedAtAttr = this.Model._timestampAttributes.updatedAt
      , createdAtAttr = this.Model._timestampAttributes.createdAt
      , hook = self.isNewRecord ? 'Create' : 'Update';

    if (updatedAtAttr && options.fields.indexOf(updatedAtAttr) === -1) {
      options.fields.push(updatedAtAttr);
    }

    if (options.silent === true && !(this.isNewRecord && this.get(updatedAtAttr, {raw: true}))) {
      // UpdateAtAttr might have been added as a result of Object.keys(Model.attributes). In that case we have to remove it again
      Utils._.remove(options.fields, function(val) {
        return val === updatedAtAttr;
      });
      updatedAtAttr = false;
    }

    if (this.isNewRecord === true && createdAtAttr && options.fields.indexOf(createdAtAttr) === -1) {
      options.fields.push(createdAtAttr);
    }

    return Promise.bind(this).then(function() {
      // Validate
      if (options.validate) {
        return Promise.bind(this).then(function () {
          // hookValidate rejects with errors, validate returns with errors
          if (options.hooks) return this.hookValidate(options);

          return this.validate(options).then(function (err) {
            if (err) throw err;
          });
        });
      }
    }).then(function() {
      return Promise.bind(this).then(function() {
        // Run before hook
        if (options.hooks) {
          var beforeHookValues = _.pick(this.dataValues, options.fields)
            , afterHookValues
            , hookChanged
            , ignoreChanged = _.difference(this.changed(), options.fields); // In case of update where it's only supposed to update the passed values and the hook values

          if (updatedAtAttr && options.fields.indexOf(updatedAtAttr) !== -1) {
            ignoreChanged = _.without(ignoreChanged, updatedAtAttr);
          }

          return this.Model.runHooks('before' + hook, this, options).bind(this).then(function() {
            if (options.defaultFields && !this.isNewRecord) {
              afterHookValues = _.pick(this.dataValues, _.difference(this.changed(), ignoreChanged));

              hookChanged = [];
              Object.keys(afterHookValues).forEach(function (key) {
                if (afterHookValues[key] !== beforeHookValues[key]) {
                  hookChanged.push(key);
                }
              });

              options.fields = _.unique(options.fields.concat(hookChanged));
            }

            if (hookChanged) {
              if (options.validate) {
                // Validate again

                options.skip = _.difference(Object.keys(this.Model.rawAttributes), hookChanged);
                return Promise.bind(this).then(function () {
                  // hookValidate rejects with errors, validate returns with errors
                  if (options.hooks) return this.hookValidate(options);

                  return this.validate(options).then(function (err) {
                    if (err) throw err;
                  });
                }).then(function() {
                  delete options.skip;
                });
              }
            }
          });
        }
      }).then(function() {
        if (!options.fields.length) return this;

        var values = Utils.mapValueFieldNames(this.dataValues, options.fields, this.Model)
          , query = null
          , args = [];

        if (updatedAtAttr && !options.silent) {
          self.dataValues[updatedAtAttr] = values[self.Model.rawAttributes[updatedAtAttr].field || updatedAtAttr] = self.Model.__getTimestamp(updatedAtAttr);
        }

        if (self.isNewRecord && createdAtAttr && !values[createdAtAttr]) {
          self.dataValues[createdAtAttr] = values[self.Model.rawAttributes[createdAtAttr].field || createdAtAttr] = self.Model.__getTimestamp(createdAtAttr);
        }

        if (self.isNewRecord) {
          query = 'insert';
          args = [self, self.Model.getTableName(options), values, options];
        } else {
          var identifier = self.primaryKeyValues;

          if (identifier) {
            identifier = Utils.mapValueFieldNames(identifier, Object.keys(identifier), this.Model);

          } else if (identifier === null && self.__options.whereCollection !== null) {
            identifier = self.__options.whereCollection;
          }

          query = 'update';
          args = [self, self.Model.getTableName(options), values, identifier, options];
        }

        return self.QueryInterface[query].apply(self.QueryInterface, args)
          .then(function(result) {
            // Transfer database generated values (defaults, autoincrement, etc)
            Object.keys(self.Model.rawAttributes).forEach(function (attr) {
              if (self.Model.rawAttributes[attr].field &&
                  values[self.Model.rawAttributes[attr].field] !== undefined &&
                  self.Model.rawAttributes[attr].field !== attr
              ) {
                values[attr] = values[self.Model.rawAttributes[attr].field];
                delete values[self.Model.rawAttributes[attr].field];
              }
            });
            values = _.extend(values, result.dataValues);

            result.dataValues = _.extend(result.dataValues, values);
            return result;
          })
          .tap(function(result) {
            // Run after hook
            if (options.hooks) {
              return self.Model.runHooks('after' + hook, result, options);
            }
          })
          .then(function(result) {
            options.fields.forEach(function (field) {
              result._previousDataValues[field] = result.dataValues[field];
            });
            self.isNewRecord = false;
            return result;
          });
      });
    });
  };

 /*
  * Refresh the current instance in-place, i.e. update the object with current data from the DB and return the same object.
  * This is different from doing a `find(Instance.id)`, because that would create and return a new instance. With this method,
  * all references to the Instance are updated with the new data and no new objects are created.
  *
  * @see {Model#find}
  * @param {Object} [options] Options that are passed on to `Model.find`
  * @return {Promise<this>}
  */
  Instance.prototype.reload = function(options) {
    var self = this
      , where = [
        this.QueryInterface.quoteTable(this.Model.name) + '.' + this.QueryInterface.quoteIdentifier(this.Model.primaryKeyField) + '=?',
        this.get(this.Model.primaryKeyAttribute, {raw: true})
      ];

    return this.Model.find({
      where: where,
      limit: 1,
      include: this.options.include || null
    }, options).then(function(reload) {
      self.set(reload.dataValues, {raw: true, reset: true});
    }).return(self);
  };

  /*
   * Validate the attribute of this instance according to validation rules set in the model definition.
   *
   * Emits null if and only if validation successful; otherwise an Error instance containing { field name : [error msgs] } entries.
   *
   * @param {Object} [options] Options that are passed to the validator
   * @param {Array} [options.skip] An array of strings. All properties that are in this array will not be validated
   * @see {InstanceValidator}
   *
   * @return {Promise<undefined|Errors.ValidationError}
   */
  Instance.prototype.validate = function(options) {
    return new InstanceValidator(this, options).validate();
  };

  Instance.prototype.hookValidate = function(options) {
    return new InstanceValidator(this, options).hookValidate();
  };

  /**
   * This is the same as calling `set` and then calling `save`.
   *
   * @see {Instance#set}
   * @see {Instance#save}
   * @param {Object} updates See `set`
   * @param {Object} options See `save`
   *
   * @return {Promise<this>}
   * @alias updateAttributes
   */
  Instance.prototype.update = function(values, options) {
    options = options || {};
    if (Array.isArray(options)) options = {fields: options};

    this.set(values, {attributes: options.fields});

    if (!options.fields) {
      options.fields = _.intersection(Object.keys(values), this.changed());
      options.defaultFields = options.fields;
    }

    return this.save(options);
  };
  Instance.prototype.updateAttributes = Instance.prototype.update;

  /**
   * Destroy the row corresponding to this instance. Depending on your setting for paranoid, the row will either be completely deleted, or have its deletedAt timestamp set to the current time.
   *
   * @param {Object}      [options={}]
   * @param {Boolean}     [options.force=false] If set to true, paranoid models will actually be deleted
   * @param {Transaction} [options.transaction]
   *
   * @return {Promise<undefined>}
   */
  Instance.prototype.destroy = function(options) {
    options = Utils._.extend({
      hooks: true,
      force: false
    }, options || {});

    var self = this;

    // This semi awkward syntax where we can't return the chain directly but have to return the last .then() call is to allow sql proxying
    return Promise.try(function() {
      // Run before hook
      if (options.hooks) {
        return self.Model.runHooks('beforeDestroy', self, options);
      }
    }).then(function() {
      var where;

      if (self.Model._timestampAttributes.deletedAt && options.force === false) {
        self.dataValues[self.Model._timestampAttributes.deletedAt] = new Date();
        return self.save(_.extend(_.clone(options), {hooks : false}));
      } else {
        where = {};
        where[self.Model.rawAttributes[self.Model.primaryKeyAttribute].field] = self.get(self.Model.primaryKeyAttribute, {raw: true});
        return self.QueryInterface.delete(self, self.Model.getTableName(options), where, _.defaults(options, {limit: null}));
      }
    }).tap(function(result) {
      // Run after hook
      if (options.hooks) {
        return self.Model.runHooks('afterDestroy', self, options);
      }
    }).then(function(result) {
      return result;
    });
  };

  /**
   * Restore the row corresponding to this instance. Only available for paranoid models.
   *
   * @param {Object}      [options={}]
   * @param {Transaction} [options.transaction]
   *
   * @return {Promise<undefined>}
   */
  Instance.prototype.restore = function(options) {
    if (!this.Model._timestampAttributes.deletedAt) throw new Error("Model is not paranoid");

    options = Utils._.extend({
      hooks: true,
      force: false
    }, options || {});

    var self = this;

    return Promise.try(function() {
      // Run before hook
      if (options.hooks) {
        return self.Model.runHooks('beforeRestore', self, options);
      }
    }).then(function() {
      self.dataValues[self.Model._timestampAttributes.deletedAt] = null;
      return self.save(_.extend(_.clone(options), {hooks : false, omitNull : false}));
    }).tap(function(result) {
      // Run after hook
      if (options.hooks) {
        return self.Model.runHooks('afterRestore', self, options);
      }
    });
  };

  /**
   * Increment the value of one or more columns. This is done in the database, which means it does not use the values currently stored on the Instance. The increment is done using a
   * ```sql
   * SET column = column + X
   * ```
   * query. To get the correct value after an increment into the Instance you should do a reload.
   *
   *```js
   * instance.increment('number') // increment number by 1
   * instance.increment(['number', 'count'], { by: 2 }) // increment number and count by 2
   * instance.increment({ answer: 42, tries: 1}, { by: 2 }) // increment answer by 42, and tries by 1.
   *                                                        // `by` is ignored, since each column has its own value
   * ```
   *
   * @see {Instance#reload}
   * @param {String|Array|Object} fields If a string is provided, that column is incremented by the value of `by` given in options. If an array is provided, the same is true for each column. If and object is provided, each column is incremented by the value given
   * @param {Object} [options]
   * @param {Integer} [options.by=1] The number to increment by
   * @param {Transaction} [options.transaction]
   *
   * @return {Promise<this>}
   */
  Instance.prototype.increment = function(fields, countOrOptions) {
    Utils.validateParameter(countOrOptions, Object, {
      optional: true,
      deprecated: Number,
      deprecationWarning: 'Increment expects an object as second parameter. Please pass the incrementor as option! ~> instance.increment(' + JSON.stringify(fields) + ', { by: ' + countOrOptions + ' })'
    });

    var identifier = this.primaryKeyValues
      , updatedAtAttr = this.Model._timestampAttributes.updatedAt
      , values = {}
      , where;

    if (identifier) {
      for (var attrName in identifier) {
        // Field name mapping
        var rawAttribute = this.Model.rawAttributes[attrName];
        if (rawAttribute.field && rawAttribute.field !== rawAttribute.fieldName) {
          identifier[this.Model.rawAttributes[attrName].field] = identifier[attrName];
          delete identifier[attrName];
        }
      }
    }
    if (identifier === null && this.__options.whereCollection !== null) {
      identifier = this.__options.whereCollection;
    }

    if (countOrOptions === undefined) {
      countOrOptions = { by: 1 };
    } else if (typeof countOrOptions === 'number') {
      countOrOptions = { by: countOrOptions };
    }

    countOrOptions = Utils._.extend({
      by: 1,
      attributes: {},
      where: {}
    }, countOrOptions);

    where = _.extend(countOrOptions.where, identifier);

    if (Utils._.isString(fields)) {
      values[fields] = countOrOptions.by;
    } else if (Utils._.isArray(fields)) {
      Utils._.each(fields, function(field) {
        values[field] = countOrOptions.by;
      });
    } else { // Assume fields is key-value pairs
      values = fields;
    }

    if (updatedAtAttr && !values[updatedAtAttr]) {
      countOrOptions.attributes[updatedAtAttr] = this.Model.__getTimestamp(updatedAtAttr);
    }

    Object.keys(values).forEach(function(attr) {
      // Field name mapping
      if (this.Model.rawAttributes[attr] && this.Model.rawAttributes[attr].field && this.Model.rawAttributes[attr].field !== attr) {
        values[this.Model.rawAttributes[attr].field] = values[attr];
        delete values[attr];
      }
    }, this);

    return this.QueryInterface.increment(this, this.Model.getTableName(countOrOptions), values, where, countOrOptions).return(this);
  };

  /**
   * Decrement the value of one or more columns. This is done in the database, which means it does not use the values currently stored on the Instance. The decrement is done using a
   * ```sql
   * SET column = column - X
   * ```
   * query. To get the correct value after an decrement into the Instance you should do a reload.
   *
   * ```js
   * instance.decrement('number') // decrement number by 1
   * instance.decrement(['number', 'count'], { by: 2 }) // decrement number and count by 2
   * instance.decrement({ answer: 42, tries: 1}, { by: 2 }) // decrement answer by 42, and tries by 1.
   *                                                        // `by` is ignored, since each column has its own value
   * ```
   *
   * @see {Instance#reload}
   * @param {String|Array|Object} fields If a string is provided, that column is decremented by the value of `by` given in options. If an array is provided, the same is true for each column. If and object is provided, each column is decremented by the value given
   * @param {Object} [options]
   * @param {Integer} [options.by=1] The number to decrement by
   * @param {Transaction} [options.transaction]
   *
   * @return {Promise}
   */
  Instance.prototype.decrement = function(fields, countOrOptions) {
    Utils.validateParameter(countOrOptions, Object, {
      optional: true,
      deprecated: Number,
      deprecationWarning: 'Decrement expects an object as second parameter. Please pass the decrementor as option! ~> instance.decrement(' + JSON.stringify(fields) + ', { by: ' + countOrOptions + ' })'
    });

    if (countOrOptions === undefined) {
      countOrOptions = { by: 1 };
    } else if (typeof countOrOptions === 'number') {
      countOrOptions = { by: countOrOptions };
    }

    if (countOrOptions.by === undefined) {
      countOrOptions.by = 1;
    }

    if (!Utils._.isString(fields) && !Utils._.isArray(fields)) { // Assume fields is key-value pairs
      Utils._.each(fields, function(value, field) {
        fields[field] = -value;
      });
    }

    countOrOptions.by = 0 - countOrOptions.by;

    return this.increment(fields, countOrOptions);
  };

  /**
   * Check whether all values of this and `other` Instance are the same
   *
   * @param {Instance} other
   * @return {Boolean}
   */
  Instance.prototype.equals = function(other) {
    var result = true;

    Utils._.each(this.dataValues, function(value, key) {
      if (Utils._.isDate(value) && Utils._.isDate(other[key])) {
        result = result && (value.getTime() === other[key].getTime());
      } else {
        result = result && (value === other[key]);
      }
    });

    return result;
  };

  /**
   * Check if this is eqaul to one of `others` by calling equals
   *
   * @param {Array} others
   * @return {Boolean}
   */
  Instance.prototype.equalsOneOf = function(others) {
    var self = this;

    return _.any(others, function(other) {
      return self.equals(other);
    });
  };

  Instance.prototype.setValidators = function(attribute, validators) {
    this.validators[attribute] = validators;
  };

  /**
   * Convert the instance to a JSON representation. Proxies to calling `get` with no keys. This means get all values gotten from the DB, and apply all custom getters.
   *
   * @see {Instance#get}
   * @return {object}
   */
  Instance.prototype.toJSON = function() {
    return this.get({
      plain: true
    });
  };

  // private
  var initValues = function(values, options) {
    var defaults
      , key;

    values = values && _.clone(values) || {};

    if (options.isNewRecord) {
      defaults = {};

      if (this.Model._hasDefaultValues) {
        Utils._.each(this.Model._defaultValues, function(valueFn, key) {
          if (!defaults.hasOwnProperty(key)) {
            defaults[key] = valueFn();
          }
        });
      }

      // set id to null if not passed as value, a newly created dao has no id
      // removing this breaks bulkCreate
      // do after default values since it might have UUID as a default value
      if (!defaults.hasOwnProperty(this.Model.primaryKeyAttribute)) {
        defaults[this.Model.primaryKeyAttribute] = null;
      }

      if (this.Model._timestampAttributes.createdAt && defaults[this.Model._timestampAttributes.createdAt]) {
        this.dataValues[this.Model._timestampAttributes.createdAt] = Utils.toDefaultValue(defaults[this.Model._timestampAttributes.createdAt]);
        delete defaults[this.Model._timestampAttributes.createdAt];
      }

      if (this.Model._timestampAttributes.updatedAt && defaults[this.Model._timestampAttributes.updatedAt]) {
        this.dataValues[this.Model._timestampAttributes.updatedAt] = Utils.toDefaultValue(defaults[this.Model._timestampAttributes.updatedAt]);
        delete defaults[this.Model._timestampAttributes.updatedAt];
      }

      if (this.Model._timestampAttributes.deletedAt && defaults[this.Model._timestampAttributes.deletedAt]) {
        this.dataValues[this.Model._timestampAttributes.deletedAt] = Utils.toDefaultValue(defaults[this.Model._timestampAttributes.deletedAt]);
        delete defaults[this.Model._timestampAttributes.deletedAt];
      }

      if (Object.keys(defaults).length) {
        for (key in defaults) {
          if (!values.hasOwnProperty(key)) {
            this.set(key, Utils.toDefaultValue(defaults[key]), defaultsOptions);
          }
        }
      }
    }

    this.set(values, options);
  };

  return Instance;
})();
