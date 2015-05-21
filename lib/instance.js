'use strict';

var Utils = require('./utils')
  , BelongsTo = require('./associations/belongs-to')
  , BelongsToMany = require('./associations/belongs-to-many')
  , InstanceValidator = require('./instance-validator')
  , QueryTypes = require('./query-types')
  , Dottie = require('dottie')
  , Promise = require('./promise')
  , _ = require('lodash')
  , primitives = ['string', 'number', 'boolean']
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
    this._changed = {};
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
     * @return {Model}
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

  /**
   * Get an object representing the query for this instance, use with `options.where`
   *
   * @property where
   * @return {Object}
   */
  Instance.prototype.where = function() {
    var where;

    where = this.Model.primaryKeyAttributes.reduce(function (result, attribute) {
      result[attribute] = this.get(attribute, {raw: true});
      return result;
    }.bind(this), {});

    if (_.size(where) === 0) {
      return this.__options.whereCollection;
    }
    return where;
  };

  Instance.prototype.toString = function () {
    return '[object SequelizeInstance:'+this.Model.name+']';
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
    var originalValue = this._previousDataValues[key];
    if (primitives.indexOf(typeof value) === -1 || value !== originalValue) {
      this.changed(key, true);
    }

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
    if (options === undefined && typeof key === 'object') {
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
            values[_key] = this.get(_key, options);
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
   * When set is called, the previous value of the field is stored and sets a changed flag(see `changed`).
   *
   * Set can also be used to build instances for associations, if you have values for those.
   * When using set with associations you need to make sure the property key matches the alias of the association
   * while also making sure that the proper include options have been set (from .build() or .find())
   *
   * If called with a dot.seperated key on a JSON/JSONB attribute it will set the value nested and flag the entire object as changed.
   *
   * @see {Model#find} for more information about includes
   * @param {String|Object} key
   * @param {any} value
   * @param {Object} [options]
   * @param {Boolean} [options.raw=false] If set to true, field and virtual setters will be ignored
   * @param {Boolean} [options.reset=false] Clear all previously set data values
   * @alias setAttributes
   */
  Instance.prototype.set = function(key, value, options) {
    var values
      , originalValue
      , keys
      , i
      , length;

    if (typeof key === 'object' && key !== null) {
      values = key;
      options = value || {};

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
      if (!options)
        options = {};
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
              if (key.indexOf('.') > -1 && this.Model._isJsonAttribute(key.split('.')[0])) {
                Dottie.set(this.dataValues, key, value);
                this.changed(key, true);
              }
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

            if (_.isString(value)) {
              // Only take action on valid boolean strings.
              value = (value === 'true') ? true : (value === 'false') ? false : value;

            } else if (_.isNumber(value)) {
              // Only take action on valid boolean integers.
              value = (value === 1) ? true : (value === 0) ? false : value;
            }
          }

          if (!options.raw && (primitives.indexOf(typeof value) === -1 || value !== originalValue)) {
            this._previousDataValues[key] = originalValue;
            this.changed(key, true);
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
   * If changed is called without an argument and no keys have changed, it will return `false`.
   *
   * @param {String} [key]
   * @return {Boolean|Array}
   */
  Instance.prototype.changed = function(key, value) {
    if (key) {
      if (value !== undefined) {
        this._changed[key] = value;
        return this;
      }
      return this._changed[key] || false;
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
        isNewRecord: this.isNewRecord,
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
   * @param {Function} [options.logging=false] A function that gets executed while running the query to log the sql.
   * @param {Transaction} [options.transaction]
   *
   * @return {Promise<this|Errors.ValidationError>}
   */
  Instance.prototype.save = function(options) {
    if (arguments.length > 1) {
      throw new Error('The second argument was removed in favor of the options object.');
    }
    options = _.defaults(options || {}, {
      hooks: true,
      validate: true
    });

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
      , primaryKeyName = this.Model.primaryKeyAttribute
      , primaryKeyAttribute = primaryKeyName && this.Model.rawAttributes[primaryKeyName]
      , updatedAtAttr = this.Model._timestampAttributes.updatedAt
      , createdAtAttr = this.Model._timestampAttributes.createdAt
      , hook = self.isNewRecord ? 'Create' : 'Update'
      , wasNewRecord = this.isNewRecord;

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

    if (this.isNewRecord === true) {
      if (createdAtAttr && options.fields.indexOf(createdAtAttr) === -1) {
        options.fields.push(createdAtAttr);
      }

      if (primaryKeyAttribute && primaryKeyAttribute.defaultValue && options.fields.indexOf(primaryKeyName) < 0) {
        options.fields.unshift(primaryKeyName);
      }
    }

    if (this.isNewRecord === false) {
      if (primaryKeyName && !this.get(primaryKeyName, {raw: true})) {
        throw new Error('You attempted to save an instance with no primary key, this is not allowed since it would result in a global update');
      }
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
        if (!this.isNewRecord) return this;
        if (!this.options.include || !this.options.include.length) return this;

        // Nested creation for BelongsTo relations
        return Promise.map(this.options.include.filter(function (include) {
          return include.association instanceof BelongsTo;
        }), function (include) {
          var instance = self.get(include.as);
          if (!instance) return Promise.resolve();

          return instance.save({
            transaction: options.transaction,
            logging: options.logging
          }).then(function () {
            return self[include.association.accessors.set](instance, {save: false});
          });
        });
      })
      .then(function() {
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
          var where = this.where();

          where = Utils.mapValueFieldNames(where, Object.keys(where), this.Model);

          query = 'update';
          args = [self, self.Model.getTableName(options), values, where, options];
        }

        return self.sequelize.getQueryInterface()[query].apply(self.sequelize.getQueryInterface(), args)
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
              self.changed(field, false);
            });
            self.isNewRecord = false;
            return result;
          })
          .tap(function() {
            if (!wasNewRecord) return;
            if (!self.options.include || !self.options.include.length) return;

            // Nested creation for HasOne/HasMany/BelongsToMany relations
            return Promise.map(self.options.include.filter(function (include) {
              return !(include.association instanceof BelongsTo);
            }), function (include) {
              var instances = self.get(include.as);

              if (!instances) return Promise.resolve();
              if (!Array.isArray(instances)) instances = [instances];
              if (!instances.length) return Promise.resolve();

              // Instances will be updated in place so we can safely treat HasOne like a HasMany
              return Promise.map(instances, function (instance) {
                if (include.association instanceof BelongsToMany) {
                  return instance.save({transaction: options.transaction, logging: options.logging}).then(function () {
                    var values = {};
                    values[include.association.foreignKey] = self.get(self.Model.primaryKeyAttribute, {raw: true});
                    values[include.association.otherKey] = instance.get(instance.Model.primaryKeyAttribute, {raw: true});
                    return include.association.throughModel.create(values, {transaction: options.transaction, logging: options.logging});
                  });
                } else {
                  instance.set(include.association.identifier, self.get(self.Model.primaryKeyAttribute, {raw: true}));
                  return instance.save({transaction: options.transaction, logging: options.logging});
                }
              });
            });
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
  * @param {Function} [options.logging=false] A function that gets executed while running the query to log the sql.
  * @return {Promise<this>}
  */
  Instance.prototype.reload = function(options) {
    var self = this
      , where = [
        this.sequelize.getQueryInterface().quoteTable(this.Model.name) + '.' + this.sequelize.getQueryInterface().quoteIdentifier(this.Model.primaryKeyField) + '=?',
        this.get(this.Model.primaryKeyAttribute, {raw: true})
      ];

    options = _.defaults(options || {}, {
      where: where,
      limit: 1,
      include: this.options.include || null
    });

    return this.Model.findOne(options).then(function(reload) {
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
   * @return {Promise<undefined|Errors.ValidationError>}
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
    var changedBefore = this.changed() || []
      , sideEffects
      , fields;

    options = options || {};
    if (Array.isArray(options)) options = {fields: options};

    this.set(values, {attributes: options.fields});

    // Now we need to figure out which fields were actually affected by the setter.
    sideEffects = _.without.apply(this, [this.changed() || []].concat(changedBefore));
    fields = _.union(Object.keys(values), sideEffects);

    if (!options.fields) {
      options.fields = _.intersection(fields, this.changed());
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
   * @param {Function}    [options.logging=false] A function that gets executed while running the query to log the sql.
   * @param {Transaction} [options.transaction]
   *
   * @return {Promise<undefined>}
   */
  Instance.prototype.destroy = function(options) {
    options = Utils._.extend({
      hooks: true,
      force: false
    }, options || {});

    return Promise.bind(this).then(function() {
      // Run before hook
      if (options.hooks) {
        return this.Model.runHooks('beforeDestroy', this, options);
      }
    }).then(function() {
      var where;

      if (this.Model._timestampAttributes.deletedAt && options.force === false) {
        this.setDataValue(this.Model._timestampAttributes.deletedAt, new Date());
        return this.save(_.extend(_.clone(options), {hooks : false}));
      } else {
        where = {};
        var primaryKeys = this.Model.primaryKeyAttributes;
        for(var i = 0; i < primaryKeys.length; i++) {
            where[this.Model.rawAttributes[primaryKeys[i]].field] = this.get(primaryKeys[i], { raw: true });
        }
        return this.sequelize.getQueryInterface().delete(this, this.Model.getTableName(options), where, _.defaults(options, { type: QueryTypes.DELETE,limit: null}));
      }
    }).tap(function() {
      // Run after hook
      if (options.hooks) {
        return this.Model.runHooks('afterDestroy', this, options);
      }
    }).then(function(result) {
      return result;
    });
  };

  /**
   * Restore the row corresponding to this instance. Only available for paranoid models.
   *
   * @param {Object}      [options={}]
   * @param {Function}    [options.logging=false] A function that gets executed while running the query to log the sql.
   * @param {Transaction} [options.transaction]
   *
   * @return {Promise<undefined>}
   */
  Instance.prototype.restore = function(options) {
    if (!this.Model._timestampAttributes.deletedAt) throw new Error('Model is not paranoid');

    options = Utils._.extend({
      hooks: true,
      force: false
    }, options || {});

    return Promise.bind(this).then(function() {
      // Run before hook
      if (options.hooks) {
        return this.Model.runHooks('beforeRestore', this, options);
      }
    }).then(function() {
      this.setDataValue(this.Model._timestampAttributes.deletedAt, null);
      return this.save(_.extend(_.clone(options), {hooks : false, omitNull : false}));
    }).tap(function() {
      // Run after hook
      if (options.hooks) {
        return this.Model.runHooks('afterRestore', this, options);
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
   * @param {String|Array|Object} fields If a string is provided, that column is incremented by the value of `by` given in options. If an array is provided, the same is true for each column. If and object is provided, each column is incremented by the value given.
   * @param {Object} [options]
   * @param {Integer} [options.by=1] The number to increment by
   * @param {Function} [options.logging=false] A function that gets executed while running the query to log the sql.
   * @param {Transaction} [options.transaction]
   *
   * @return {Promise<this>}
   */
  Instance.prototype.increment = function(fields, options) {
    var identifier = this.where()
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

    options = _.defaults(options || {}, {
      by: 1,
      attributes: {},
      where: {}
    });

    where = _.extend(options.where || {}, identifier);

    if (Utils._.isString(fields)) {
      values[fields] = options.by;
    } else if (Utils._.isArray(fields)) {
      Utils._.each(fields, function(field) {
        values[field] = options.by;
      });
    } else { // Assume fields is key-value pairs
      values = fields;
    }

    if (updatedAtAttr && !values[updatedAtAttr]) {
      options.attributes[updatedAtAttr] = this.Model.__getTimestamp(updatedAtAttr);
    }

    Object.keys(values).forEach(function(attr) {
      // Field name mapping
      if (this.Model.rawAttributes[attr] && this.Model.rawAttributes[attr].field && this.Model.rawAttributes[attr].field !== attr) {
        values[this.Model.rawAttributes[attr].field] = values[attr];
        delete values[attr];
      }
    }, this);

    return this.sequelize.getQueryInterface().increment(this, this.Model.getTableName(options), values, where, options).return(this);
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
   * @param {Function} [options.logging=false] A function that gets executed while running the query to log the sql.
   * @param {Transaction} [options.transaction]
   *
   * @return {Promise}
   */
  Instance.prototype.decrement = function(fields, options) {
    options = _.defaults(options || {}, {
      by: 1
    });

    if (!Utils._.isString(fields) && !Utils._.isArray(fields)) { // Assume fields is key-value pairs
      Utils._.each(fields, function(value, field) {
        fields[field] = -value;
      });
    }

    options.by = 0 - options.by;

    return this.increment(fields, options);
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
          if (defaults[key] === undefined) {
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
          if (values[key] === undefined) {
            this.set(key, Utils.toDefaultValue(defaults[key]), defaultsOptions);
          }
        }
      }
    }

    this.set(values, options);
  };

  return Instance;
})();
