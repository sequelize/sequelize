var Utils        = require("./utils")
  , Mixin        = require("./associations/mixin")
  , DaoValidator = require("./dao-validator")
  , DataTypes    = require("./data-types")
  , hstore       = require('./dialects/postgres/hstore')
  , _            = require('lodash')

module.exports = (function() {
  /** 
   * This class represents an single instance, a database column. You might see it referred to as both DAO and instance.
   * 
   * DAO instances operate with the concept of a `dataValues` property, which stores the actual values represented by this DAO. By default, the values from dataValues can also be accessed directly from the DAO, that is:
   * ```js
   * instance.field
   * // is the same as
   * instance.get('field')
   * // is the same as
   * instance.getDataValue('field')
   * ```
   * However, if getters and/or setters are defined for `field` they will be invoked, instead of returning the value from `dataValues`.  

   * @see {Sequelize#define} Sequelize#define for more information about getters and setters
   * @class DAO
   */
  var DAO = function(values, options) {
    this.dataValues                  = {}
    this._previousDataValues         = {}
    this.__options                   = this.Model.options
    this.options                     = options
    this.hasPrimaryKeys              = this.Model.options.hasPrimaryKeys
    // What is selected values even used for?
    this.selectedValues              = options.include ? _.omit(values, options.includeNames) : values
    this.__eagerlyLoadedAssociations = []
    /**
     * Returns true if this instance has not yet been persisted to the database
     * @property isNewRecord
     * @return {Boolean}
     */
    this.isNewRecord                 = options.isNewRecord

    /**
     * Returns the Model the instance was created from.
     * @see {DAOFactory}
     * @property Model
     * @return DAOFactory
     */

    initValues.call(this, values, options);
  }

  Utils._.extend(DAO.prototype, Mixin.prototype)

  /**
   * A reference to the sequelize instance
   * @see {Sequelize}
   * @property sequelize
   * @return the sequelize instance
   */
  Object.defineProperty(DAO.prototype, 'sequelize', {
    get: function(){ return this.Model.daoFactoryManager.sequelize }
  })

  /**
   * A reference to the query interface
   * @property QueryInterface
   * @see {QueryInterface}
   * @return {QueryInterface}
   */
  Object.defineProperty(DAO.prototype, 'QueryInterface', {
    get: function(){ return this.sequelize.getQueryInterface() }
  })

  /**
   * If timestamps and paranoid are enabled, returns whether the deletedAt timestamp of this instance is set. Otherwise, always returns false.
   * @property isDeleted
   * @return {Boolean}
   */
  Object.defineProperty(DAO.prototype, 'isDeleted', {
    get: function() {
      return this.Model._timestampAttributes.deletedAt && this.dataValues[this.Model._timestampAttributes.deletedAt] !== null
    }
  })

  /** 
   * Get the values of this DAO. Proxies to this.get
   * @see {DAO#get}
   * @property values
   * @return {Object} 
   */
  Object.defineProperty(DAO.prototype, 'values', {
    get: function() {
      return this.get()
    }
  })

  /** 
   * A getter for this.changed()
   *
   * @see {DAO#changed}
   * @property isDirty
   * @return {Boolean} 
   */
  Object.defineProperty(DAO.prototype, 'isDirty', {
    get: function() {
      return !!this.changed()
    }
  })

  /**
   * Get the values of the primary keys of this instance. 
   * @property primaryKeyValues
   * @return {Object} The values of thep primary keys for this DAO
   */
  Object.defineProperty(DAO.prototype, 'primaryKeyValues', {
    get: function() {
      var result = {}
        , self   = this

      Utils._.each(this.Model.primaryKeys, function(_, attr) {
        result[attr] = self.dataValues[attr]
      })

      return result
    }
  })

  Object.defineProperty(DAO.prototype, "identifiers", {
    get: function() {
      var primaryKeys = Object.keys(this.Model.primaryKeys)
        , result      = {}
        , self        = this
      primaryKeys.forEach(function(identifier) {
        result[identifier] = self.dataValues[identifier]
      })

      return result
    }
  })

  /**
   * Get the value of the underlying data value
   * 
   * @param {String} key
   * @return {any}
   */
  DAO.prototype.getDataValue = function(key) {
    return this.dataValues[key]
  }

  /**
   * Update the underlying data value
   *
   * @param {String} key
   * @param {any} value
   */
  DAO.prototype.setDataValue = function(key, value) {
    this.dataValues[key] = value
  }

  /** 
   * If no key is given, returns all values of the instance.
   *
   * If key is given and a field or virtual getter is present for the key it will call the getter with key - else it will return the value for key.
   * @param {String} [key]
   * @return {Object|any} If no key is given, all values will be returned as a hash. If key is given, the value of that column / virtual getter will be returned
   */
  DAO.prototype.get = function (key) {
    if (key) {
      if (this._customGetters[key]) {
        return this._customGetters[key].call(this, key)
      }
      return this.dataValues[key]
    }

    if (this._hasCustomGetters) {
      var values = {}
        , key

      for (key in this._customGetters) {
        if (this._customGetters.hasOwnProperty(key)) {
          values[key] = this.get(key)
        }
      }

      for (key in this.dataValues) {
        if (!values.hasOwnProperty(key) && this.dataValues.hasOwnProperty(key)) {
          values[key] = this.dataValues[key]
        }
      }
      return values
    }
    return this.dataValues
  }

  /**
   * If values is an object and raw is true and no includes are in the Instance options, set will set dataValues to values, or extend it if it exists. 
   * Else values will be looped and a recursive set will be kalled with key and value from the hash.
   * If set is called with a key and a value and the key matches an include option, it will build the child include with the value. 
   * If raw is false and a field or virtual setter is present for the key, it will call the setter with (value, key) - else it will set instance value for key to value.
   *
   * @see {DAOFactory#find} DAOFactory#find for more information about includes
   * @param {String|Object} key(s)
   * @param {any} value
   * @param {Object} [options]
   * @param {Boolean} [options.raw=false] If set to true, field and virtual setters will be ignored
   * @param {Boolean} [options.reset] TODO ????
   */
  DAO.prototype.set = function (key, value, options) {
    var values
      , originalValue

    if (typeof key === "object") {
      values = keys
      options = value

      options || (options = {})

      if (options.reset) {
        this.dataValues = {}
      }

      // If raw, and we're not dealing with includes, just set it straight on the dataValues object
      if (options.raw && !(this.options && this.options.include) && !this.Model._hasBooleanAttributes) {
        if (Object.keys(this.dataValues).length) {
          this.dataValues = _.extend(this.dataValues, values)
        } else {
          this.dataValues = values
        }
        // If raw, .changed() shouldn't be true
        this._previousDataValues = _.clone(this.dataValues)
      } else {
        // Loop and call set
        for (key in values) {
          this.set(key, values[key], options)
        }

        if (options.raw) {
          // If raw, .changed() shouldn't be true
          this._previousDataValues = _.clone(this.dataValues)
        }
      }
    } else {
      options || (options = {})
      originalValue = this.dataValues[key]

      // If not raw, and there's a customer setter
      if (!options.raw && this._customSetters[key]) {
        this._customSetters[key].call(this, value, key)
      } else {
        // Check if we have included models, and if this key matches the include model names/aliases

        if (this.options && this.options.include && this.options.includeNames.indexOf(key) !== -1) {
          // Pass it on to the include handler
          this._setInclude(key, value, options)
          return
        } else {
          // If not raw, and attribute is not in model definition, return
          if (!options.raw && !this._isAttribute(key)) {
            return;
          }

          // If attempting to set primary key and primary key is already defined, return
          if (this.Model._hasPrimaryKeys && originalValue && this.Model._isPrimaryKey(key)) {
            return
          }

          // If attempting to set read only attributes, return
          if (!options.raw && this.Model._hasReadOnlyAttributes && this.Model._isReadOnlyAttribute(key)) {
            return
          }

          // Convert boolean-ish values to booleans
          if (this.Model._hasBooleanAttributes && this.Model._isBooleanAttribute(key) && value !== null && value !== undefined) {
            value = !!value
          }

          // Convert date fields to real date objects
          if (this.Model._hasDateAttributes && this.Model._isDateAttribute(key) && value !== null && !(value instanceof Date)) {
            value = new Date(value)
          }

          if (originalValue !== value) {
            this._previousDataValues[key] = originalValue
          }
          this.dataValues[key] = value
        }
      }
    }
  }

  /**
   * If changed is called with a string it will return `true|false` depending on whether the value(s) are `dataValues` is different from the value(s) in `_previousDataValues`.
   *
   * If changed is called without an argument, it will return an array of keys that have changed.
   * @param {String} [key]
   * @return {Boolean|Array} A boolean if key is provided, otherwise an array of all attributes that have changed
   */
  DAO.prototype.changed = function(key) {
    if (key) {
      if (this.Model._isDateAttribute(key) && this._previousDataValues[key] && this.dataValues[key]) {
        return this._previousDataValues[key].valueOf() !== this.dataValues[key].valueOf()
      }
      return this._previousDataValues[key] !== this.dataValues[key]
    }
    var changed = Object.keys(this.dataValues).filter(function (key) {
      return this.changed(key)
    }.bind(this))

    return changed.length ? changed : false
  }

  /**
   * Returns the previous value for key from _previousDataValues.
   * @param {String} key
   * @return {Boolean}
   */
  DAO.prototype.previous = function(key) {
    return this._previousDataValues[key]
  }

  DAO.prototype._setInclude = function(key, value, options) {
    if (!Array.isArray(value)) value = [value]
    if (value[0] instanceof DAO) {
      value = value.map(function (instance) {
        return instance.dataValues
      })
    }

    var include = _.find(this.options.include, function (include) {
      return include.as === key || (include.as.slice(0,1).toLowerCase() + include.as.slice(1)) === key
    })
    var association          = include.association
      , self                 = this

    var accessor = Utils._.camelize(key)

    // downcase the first char
    accessor = accessor.slice(0,1).toLowerCase() + accessor.slice(1)

    value.forEach(function(data) {
      var daoInstance = include.daoFactory.build(data, {
          isNewRecord: false,
          isDirty: false,
          include: include.include,
          includeNames: include.includeNames,
          includeMap: include.includeMap,
          includeValidated: true,
          raw: options.raw
        })
        , isEmpty = !Utils.firstValueOfHash(daoInstance.identifiers)

      if (association.isSingleAssociation) {
        accessor = Utils.singularize(accessor, self.sequelize.language)
        self.dataValues[accessor] = isEmpty ? null : daoInstance
        self[accessor] = self.dataValues[accessor]
      } else {
        if (!self.dataValues[accessor]) {
          self.dataValues[accessor] = []
          self[accessor] = self.dataValues[accessor]
        }

        if (!isEmpty) {
          self.dataValues[accessor].push(daoInstance)
        }
      }
    }.bind(this))
  };

  /**
   * Persist this instance to the database 
   * 
   * @param {Array} [fields] An optional array of string, representing database columns. If fields is provided, only those columns will be saved.
   * @param {Object} [options]
   * @param {Object} [options.fields] An alternative way of setting which fields should be persisted
   * @param {Transaction} [options.transaction]
   * @return {EventEmitter}
   * @fires error, success, sql
   */
  DAO.prototype.save = function(fieldsOrOptions, options) {
    if (fieldsOrOptions instanceof Array) {
      fieldsOrOptions = { fields: fieldsOrOptions }
    }

    options = Utils._.extend({}, options, fieldsOrOptions)

    if (!options.fields) {
      options.fields = Object.keys(this.Model.attributes)
    }

    if (options.returning === undefined) {
      if (options.association) {
        options.returning = false
      } else {
        options.returning = true
      }
    }

    var self           = this
      , values         = {}
      , updatedAtAttr  = this.Model._timestampAttributes.updatedAt
      , createdAtAttr  = this.Model._timestampAttributes.createdAt

    if (options.fields) {
      if (updatedAtAttr && options.fields.indexOf(updatedAtAttr) === -1) {
        options.fields.push(updatedAtAttr)
      }

      if (createdAtAttr && options.fields.indexOf(createdAtAttr) === -1 && this.isNewRecord === true) {
        options.fields.push(createdAtAttr)
      }
    }

    return new Utils.CustomEventEmitter(function(emitter) {
      self.hookValidate().error(function (err) {
        return emitter.emit('error', err)
      }).success(function() {
        options.fields.forEach(function(field) {
          if (self.dataValues[field] !== undefined) {
            values[field] = self.dataValues[field]
          }
        })

        for (var attrName in self.Model.rawAttributes) {
          if (self.Model.rawAttributes.hasOwnProperty(attrName)) {
            var definition = self.Model.rawAttributes[attrName]
              , isHstore   = !!definition.type && !!definition.type.type && definition.type.type === DataTypes.HSTORE.type
              , isEnum          = definition.type && (definition.type.toString() === DataTypes.ENUM.toString())
              , isMySQL         = ['mysql', 'mariadb'].indexOf(self.Model.daoFactoryManager.sequelize.options.dialect) !== -1
              , ciCollation     = !!self.Model.options.collate && self.Model.options.collate.match(/_ci$/i)
              , valueOutOfScope

            // Unfortunately for MySQL CI collation we need to map/lowercase values again
            if (isEnum && isMySQL && ciCollation && (attrName in values) && values[attrName]) {
              var scopeIndex = (definition.values || []).map(function(d) { return d.toLowerCase() }).indexOf(values[attrName].toLowerCase())
              valueOutOfScope = scopeIndex === -1

              // We'll return what the actual case will be, since a simple SELECT query would do the same...
              if (!valueOutOfScope) {
                values[attrName] = definition.values[scopeIndex]
              }
            }

            if (isHstore) {
              if (typeof values[attrName] === "object") {
                values[attrName] = hstore.stringify(values[attrName])
              }
            }
          }
        }

        if (updatedAtAttr) {
          values[updatedAtAttr] = (
            (
              self.isNewRecord
              && !!self.Model.rawAttributes[updatedAtAttr]
              && !!self.Model.rawAttributes[updatedAtAttr].defaultValue
            )
            ? self.Model.rawAttributes[updatedAtAttr].defaultValue
            : Utils.now(self.sequelize.options.dialect))    
        }
        
        if (self.isNewRecord && createdAtAttr && !values[createdAtAttr]) {
          values[createdAtAttr] = (
            (
              !!self.Model.rawAttributes[createdAtAttr]
              && !!self.Model.rawAttributes[createdAtAttr].defaultValue
            )
            ? self.Model.rawAttributes[createdAtAttr].defaultValue
            : values[updatedAtAttr])
          }

        var query = null
          , args  = []
          , hook  = ''

        if (self.isNewRecord) {
          query         = 'insert'
          args          = [self, self.QueryInterface.QueryGenerator.addSchema(self.Model), values, options]
          hook          = 'Create'
        } else {
          var identifier = self.primaryKeyValues

          if (identifier === null && self.__options.whereCollection !== null) {
            identifier = self.__options.whereCollection;
          }

          query         = 'update'
          args          = [self, self.QueryInterface.QueryGenerator.addSchema(self.Model), values, identifier, options]
          hook          = 'Update'
        }

        // Add the values to the DAO
        self.dataValues = _.extend(self.dataValues, values)

        // Run the beforeCreate / beforeUpdate hook
        self.Model.runHooks('before' + hook, self, function(err) {
          if (!!err) {
            return emitter.emit('error', err)
          }

          // dataValues might have changed inside the hook, rebuild
          // the values hash
          values = {}

          options.fields.forEach(function(field) {
            if (self.dataValues[field] !== undefined) {
              values[field] = self.dataValues[field]
            }
          })
          args[2] = values

          self.QueryInterface[query].apply(self.QueryInterface, args)
            .proxy(emitter, {events: ['sql']})
            .error(function(err) {
              if (!!self.__options.uniqueKeys && err.code && self.QueryInterface.QueryGenerator.uniqueConstraintMapping.code === err.code) {
                var fields = self.QueryInterface.QueryGenerator.uniqueConstraintMapping.map(err.toString())

                if (fields !== false) {
                  fields = fields.filter(function(f) { return f !== self.Model.tableName; })
                  Utils._.each(self.__options.uniqueKeys, function(value, key) {
                    if (Utils._.isEqual(value.fields, fields) && !!value.msg) {
                      err = value.msg
                    }
                  })
                }
              }

              emitter.emit('error', err)
            })
            .success(function(result) {
              // Transfer database generated values (defaults, autoincrement, etc)
              values = _.extend(values, result.dataValues)

              // Ensure new values are on DAO, and reset previousDataValues
              result.dataValues = _.extend(result.dataValues, values)
              result._previousDataValues = _.clone(result.dataValues)

              self.Model.runHooks('after' + hook, result, function(err) {
                if (!!err) {
                  return emitter.emit('error', err)
                }
                emitter.emit('success', result)
              })
            })
        })
      })
    }).run()
  }

 /*
  * Refresh the current instance in-place, i.e. update the object with current data from the DB and return the same object.
  * This is different from doing a `find(DAO.id)`, because that would create and return a new object. With this method,
  * all references to the DAO are updated with the new data and no new objects are created.
  *
  * @see {DAO#find}
  * @param {Object} [options] Options that are passed on to DAO#find
  * @return {EventEmitter}
  * @fires error, success, sql
  */
  DAO.prototype.reload = function(options) {
    var where = [
      this.QueryInterface.quoteIdentifier(this.Model.tableName) + '.' + this.QueryInterface.quoteIdentifier('id')+'=?',
      this.id
    ]

    return new Utils.CustomEventEmitter(function(emitter) {
      this.Model.find({
        where:   where,
        limit:   1,
        include: this.options.include || null
      }, options)
      .on('sql', function(sql) { emitter.emit('sql', sql) })
      .on('error', function(error) { emitter.emit('error', error) })
      .on('success', function(obj) {
        this.set(obj.dataValues, {raw: true, reset: true})
        this.isDirty = false
        emitter.emit('success', this)
      }.bind(this))
    }.bind(this)).run()
  }

  /*
   * Validate this dao's attribute values according to validation rules set in the dao definition.
   *
   * @param {Object} [options] Options that are passed to the validator
   * @param {Array} [options.skip] An array of strings. All properties that are in this array will not be validated
   * @return {Object|null} null if and only if validation successful; otherwise an object containing { field name : [error msgs] } entries.
   */
  DAO.prototype.validate = function(options) {
    return new DaoValidator(this, options).validate()
  }

  /*
   * Validate this dao's attribute values according to validation rules set in the dao definition.
   *
   * @return CustomEventEmitter with null if validation successful; otherwise an object containing { field name : [error msgs] } entries.
   */
  DAO.prototype.hookValidate = function(object) {
    var validator = new DaoValidator(this, object)

    return validator.hookValidate()
  }

  /**
   * This is the same as calling setAttributes, then calling save
   * 
   * @see {DAO#setAttributes}
   * @see {DAO#save}
   * @param {Object} updates See setAttributes
   * @param {Object} options See save
   *
   * @return {EventEmitter}
   * @fires error, success, sql
   */
  DAO.prototype.updateAttributes = function(updates, options) {
    if (options instanceof Array) {
      options = { fields: options }
    }

    this.set(updates)
    return this.save(options)
  }

  /** 
   * Update multiple attributes at once. The values are updated by calling set
   *
   * @see {DAO#set}
   * @param {Object} updates A hash of values to update
   * @return {EventEmitter}
   * @fires error, success, sql
   */
  DAO.prototype.setAttributes = function(updates) {
    this.set(updates)
  }

  /**
   * Destroy the column corresponding to this DAO object. Depending on your setting for paranoid, the row will either be completely deleted, or have its deletedAt timestamp set to the current timestamp. 
   *
   * @param {Object} [options={}]
   * @param {Boolean} [options.force=false] If set to true, paranoid models will actually be deleted
   * @return {EventEmitter}
   * @fires error, success, sql
   */
  DAO.prototype.destroy = function(options) {
    options = options || {}
    options.force = options.force === undefined ? false : Boolean(options.force)

    var self  = this
      , query = null

    return new Utils.CustomEventEmitter(function(emitter) {
      self.Model.runHooks(self.Model.options.hooks.beforeDestroy, self, function(err) {
        if (!!err) {
          return emitter.emit('error', err)
        }

        if (self.Model._timestampAttributes.deletedAt && options.force === false) {
          self.dataValues[self.Model._timestampAttributes.deletedAt] = new Date()
          query = self.save(options)
        } else {
          var identifier = self.__options.hasPrimaryKeys ? self.primaryKeyValues : { id: self.id };
          query = self.QueryInterface.delete(self, self.QueryInterface.QueryGenerator.addSchema(self.Model.tableName, self.Model.options.schema), identifier, options)
        }

        query.on('sql', function(sql) {
          emitter.emit('sql', sql)
        })
        .error(function(err) {
          emitter.emit('error', err)
        })
        .success(function(results) {
          self.Model.runHooks(self.Model.options.hooks.afterDestroy, self, function(err) {
            if (!!err) {
              return emitter.emit('error', err)
            }

            emitter.emit('success', results)
          })
        })
      })
    }).run()
  }

  /**
   * Increment the value of one or more columns. This is done in the database, which means it does not use the values currently stored on the DAO. The increment is done using a 
```sql 
SET column = column + X
```
query. To get the correct value after an increment into the DAO you should do a reload.

```js
instance.increment('number') increment number by 1
instance.increment(['number', 'count'], { by: 2 }) increment number and count by 2
instance.increment({ answer: 42, tries: 1}, { by: 1 }) increment answer by 42, and tries by 1. `by` is ignore, since each column has its own value
``` 
   *
   * @see {DAO#reload}
   * @param {String|Array|Object} fields If a string is provided, that column is incremented by the value of `by` given in options. If an array is provided, the same is true for each column. If and object is provided, each column is incremented by the value given
   * @param {Object} [options] 
   * @param {Integer} [options.by=1] The number to increment by
   * @param {Transaction} [options.transaction=null]
   * @return {EventEmitter}
   * @fires error, success, sql
   */
  DAO.prototype.increment = function(fields, countOrOptions) {
    Utils.validateParameter(countOrOptions, Object, {
      optional:           true,
      deprecated:         'number',
      deprecationWarning: "Increment expects an object as second parameter. Please pass the incrementor as option! ~> instance.increment(" + JSON.stringify(fields) + ", { by: " + countOrOptions + " })"
    })

    var identifier    = this.__options.hasPrimaryKeys ? this.primaryKeyValues : { id: this.id }
      , updatedAtAttr = this.Model._timestampAttributes.updatedAt
      , values        = {}

    if (countOrOptions === undefined) {
      countOrOptions = { by: 1, transaction: null }
    } else if (typeof countOrOptions === 'number') {
      countOrOptions = { by: countOrOptions, transaction: null }
    }

    countOrOptions = Utils._.extend({
      by:         1,
      attributes: {}
    }, countOrOptions)

    if (Utils._.isString(fields)) {
      values[fields] = countOrOptions.by
    } else if (Utils._.isArray(fields)) {
      Utils._.each(fields, function (field) {
        values[field] = countOrOptions.by
      })
    } else { // Assume fields is key-value pairs
      values = fields
    }

    if (updatedAtAttr && !values[updatedAtAttr]) {
      countOrOptions.attributes[updatedAtAttr] = Utils.now(this.Model.daoFactoryManager.sequelize.options.dialect)
    }

    return this.QueryInterface.increment(this, this.QueryInterface.QueryGenerator.addSchema(this.Model.tableName, this.Model.options.schema), values, identifier, countOrOptions)
  }

  /**
   * Increment the value of one or more columns. This is done in the database, which means it does not use the values currently stored on the DAO. The decrement is done using a 
```sql 
SET column = column - X
```
query. To get the correct value after an decrement into the DAO you should do a reload.

```js
instance.decrement('number') decrement number by 1
instance.decrement(['number', 'count'], { by: 2 }) decrement number and count by 2
instance.decrement({ answer: 42, tries: 1}, { by: 1 }) decrement answer by 42, and tries by 1. `by` is ignore, since each column has its own value
``` 
   *
   * @see {DAO#reload}
   * @param {String|Array|Object} fields If a string is provided, that column is decremented by the value of `by` given in options. If an array is provided, the same is true for each column. If and object is provided, each column is decremented by the value given
   * @param {Object} [options] 
   * @param {Integer} [options.by=1] The number to decrement by
   * @param {Transaction} [options.transaction=null]
   * @return {EventEmitter}
   * @fires error, success, sql
   */
  DAO.prototype.decrement = function (fields, countOrOptions) {
    Utils.validateParameter(countOrOptions, Object, {
      optional:           true,
      deprecated:         'number',
      deprecationWarning: "Decrement expects an object as second parameter. Please pass the decrementor as option! ~> instance.decrement(" + JSON.stringify(fields) + ", { by: " + countOrOptions + " })"
    })

    if (countOrOptions === undefined) {
      countOrOptions = { by: 1, transaction: null }
    } else if (typeof countOrOptions === 'number') {
      countOrOptions = { by: countOrOptions, transaction: null }
    }

    if (countOrOptions.by === undefined) {
      countOrOptions.by = 1
    }

    if (!Utils._.isString(fields) && !Utils._.isArray(fields)) { // Assume fields is key-value pairs
      Utils._.each(fields, function (value, field) {
        fields[field] = -value
      })
    }

    countOrOptions.by = 0 - countOrOptions.by

    return this.increment(fields, countOrOptions)
  }

  DAO.prototype.equals = function(other) {
    var result = true

    Utils._.each(this.dataValues, function(value, key) {
      if(Utils._.isDate(value) && Utils._.isDate(other[key])) {
        result = result && (value.getTime() == other[key].getTime())
      } else {
        result = result && (value == other[key])
      }
    })

    return result
  }

  DAO.prototype.equalsOneOf = function(others) {
    var result = false
      , self   = this

    others.forEach(function(other) { result = result || self.equals(other) })

    return result
  }

  DAO.prototype.setValidators = function(attribute, validators) {
    this.validators[attribute] = validators
  }

  DAO.prototype.toJSON = function() {
    return this.get();
  }

  // private
  var initValues = function(values, options) {
    var defaults = {},
        key;

    // set id to null if not passed as value, a newly created dao has no id
    // removing this breaks bulkCreate
    defaults[this.Model.primaryKeyAttribute] = null;

    values = values && _.clone(values) || {}

    if (options.isNewRecord) {
      if (this.Model._hasDefaultValues) {
        Utils._.each(this.Model._defaultValues, function(valueFn, key) {
          if (!defaults.hasOwnProperty(key)) {
            defaults[key] = valueFn()
          }
        })
      }

      if (this.Model._timestampAttributes.createdAt && defaults[this.Model._timestampAttributes.createdAt]) {
        this.dataValues[this.Model._timestampAttributes.createdAt] = Utils.toDefaultValue(defaults[this.Model._timestampAttributes.createdAt]);
        delete defaults[this.Model._timestampAttributes.createdAt];
      }

      if (this.Model._timestampAttributes.updatedAt && defaults[this.Model._timestampAttributes.updatedAt]) {
        this.dataValues[this.Model._timestampAttributes.updatedAt] = Utils.toDefaultValue(defaults[this.Model._timestampAttributes.updatedAt]);
        delete defaults[this.Model._timestampAttributes.updatedAt];
      }

      if (this.Model._timestampAttributes.createdAt && defaults[this.Model._timestampAttributes.deletedAt]) {
        this.dataValues[this.Model._timestampAttributes.deletedAt] = Utils.toDefaultValue(defaults[this.Model._timestampAttributes.deletedAt]);
        delete defaults[this.Model._timestampAttributes.deletedAt];
      }
    }
    if (Object.keys(defaults).length) {
      for (key in defaults) {
        if (!values.hasOwnProperty(key)) {
          values[key] = Utils.toDefaultValue(defaults[key])
        }
      }
    }

    this.set(values, options)
  }

  return DAO
})()
