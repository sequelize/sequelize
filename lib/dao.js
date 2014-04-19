var Utils           = require("./utils")
  , Mixin           = require("./associations/mixin")
  , DaoValidator    = require("./dao-validator")
  , DataTypes       = require("./data-types")
  , _               = require('lodash')
  , defaultsOptions = { raw: true }
        

module.exports = (function() {
  var DAO = function(values, options) {
    this.dataValues                  = {}
    this._previousDataValues         = {}
    this.__options                   = this.Model.options
    this.options                     = options
    this.isNewRecord                 = options.isNewRecord

    initValues.call(this, values, options);
  }

  Utils._.extend(DAO.prototype, Mixin.prototype)

  Object.defineProperty(DAO.prototype, 'sequelize', {
    get: function(){ return this.Model.daoFactoryManager.sequelize }
  })

  Object.defineProperty(DAO.prototype, 'QueryInterface', {
    get: function(){ return this.sequelize.getQueryInterface() }
  })

  Object.defineProperty(DAO.prototype, 'isDeleted', {
    get: function() {
      return this.Model._timestampAttributes.deletedAt && this.dataValues[this.Model._timestampAttributes.deletedAt] !== null
    }
  })

  Object.defineProperty(DAO.prototype, 'values', {
    get: function() {
      return this.get()
    }
  })

  Object.defineProperty(DAO.prototype, 'isDirty', {
    get: function() {
      return !!this.changed()
    }
  })

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

  DAO.prototype.getDataValue = function(key) {
    return this.dataValues[key]
  }
  DAO.prototype.setDataValue = function(key, value) {
    this.dataValues[key] = value
  }

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
  DAO.prototype.set = function (key, value, options) {
    var values
      , originalValue
      , keys
      , i
      , length

    if (typeof key === "object") {
      values = key
      options = value
      options || (options = {})

      if (options.reset) {
        this.dataValues = {}
      }

      // If raw, and we're not dealing with includes or special attributes, just set it straight on the dataValues object
      if (options.raw && !(this.options && this.options.include) && !(this.options && this.options.attributes) && !this.Model._hasBooleanAttributes && !this.Model._hasDateAttributes) {
        if (Object.keys(this.dataValues).length) {
          this.dataValues = _.extend(this.dataValues, values)
        } else {
          this.dataValues = values
        }
        // If raw, .changed() shouldn't be true
        this._previousDataValues = _.clone(this.dataValues)
      } else {
        // Loop and call set

        if (this.options.attributes) {
          keys = this.options.attributes

          if (this.options && this.options.includeNames) {
            keys = keys.concat(this.options.includeNames)
          }

          for (i = 0, length = keys.length; i < length; i++) {
            if (values[keys[i]] !== undefined) {
              this.set(keys[i], values[keys[i]], options)
            }
          }
        } else {
          for (key in values) {
            this.set(key, values[key], options)
          }
        }

        if (options.raw) {
          // If raw, .changed() shouldn't be true
          this._previousDataValues = _.clone(this.dataValues)
        }
      }
    } else {
      options || (options = {})
      if (!options.raw) {
        originalValue = this.dataValues[key]
      }
      
      // If not raw, and there's a customer setter
      if (!options.raw && this._customSetters[key]) {
        this._customSetters[key].call(this, value, key)
      } else {
        // Check if we have included models, and if this key matches the include model names/aliases

        if (this.options && this.options.include && this.options.includeNames.indexOf(key) !== -1 && value) {
          // Pass it on to the include handler
          this._setInclude(key, value, options)
          return
        } else {
          // Bunch of stuff we won't do when its raw
          if (!options.raw) {
            // If attribute is not in model definition, return
            if (!this._isAttribute(key)) {
              return;
            }

            // If attempting to set primary key and primary key is already defined, return
            if (this.Model._hasPrimaryKeys && originalValue && this.Model._isPrimaryKey(key)) {
              return
            }

            // If attempting to set read only attributes, return
            if (this.Model._hasReadOnlyAttributes && this.Model._isReadOnlyAttribute(key)) {
              return
            }

            // Convert date fields to real date objects
            if (this.Model._hasDateAttributes && this.Model._isDateAttribute(key) && value !== null && !(value instanceof Date)) {
              value = new Date(value)
            }
          }

          // Convert boolean-ish values to booleans
          if (this.Model._hasBooleanAttributes && this.Model._isBooleanAttribute(key) && value !== null && value !== undefined) {
            value = !!value
          }

          if (!options.raw && originalValue !== value) {
            this._previousDataValues[key] = originalValue
          }
          this.dataValues[key] = value
        }
      }
    }

    return this;
  }

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

    var include              = this.options.includeMap[key]
      , association          = include.association
      , self                 = this
      , accessor             = Utils._.camelize(key)
      , childOptions
      , primaryKeyAttribute  = include.daoFactory.primaryKeyAttribute
      , isEmpty              = value[0] && value[0][primaryKeyAttribute] === null

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
      }
    }

    // downcase the first char
    accessor = accessor.slice(0,1).toLowerCase() + accessor.slice(1)

    if (association.isSingleAssociation) {
      accessor = Utils.singularize(accessor, self.Model.options.language)
      self[accessor] = self.dataValues[accessor] = isEmpty ? null : include.daoFactory.build(value[0], childOptions)
    } else {
      self[accessor] = self.dataValues[accessor] = isEmpty ? [] : include.daoFactory.bulkBuild(value, childOptions)
    }
  };

  // if an array with field names is passed to save()
  // only those fields will be updated
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
      self.hookValidate({
        skip: _.difference(Object.keys(self.rawAttributes), options.fields)
      }).proxy(emitter, { events: ['error'] }).success(function() {
        options.fields.forEach(function(field) {
          if (self.dataValues[field] !== undefined) {
            values[field] = self.dataValues[field]
          }
        })

        for (var attrName in self.Model.rawAttributes) {
          if (self.Model.rawAttributes.hasOwnProperty(attrName)) {
            var definition = self.Model.rawAttributes[attrName]
              , isEnum          = !!definition.type && (definition.type.toString() === DataTypes.ENUM.toString())
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
            : Utils.now(self.sequelize.options.dialect))
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
                      err = new Error(value.msg)
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
  * @return {Object}         A promise which fires `success`, `error`, `complete` and `sql`.
  */
  DAO.prototype.reload = function(options) {
    var where = [
      this.QueryInterface.quoteTable(this.Model.name) + '.' + this.QueryInterface.quoteIdentifier(this.Model.primaryKeyAttribute)+'=?',
      this.get(this.Model.primaryKeyAttribute, {raw: true})
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
   * @return null if and only if validation successful; otherwise an object containing { field name : [error msgs] } entries.
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

  DAO.prototype.updateAttributes = function(updates, options) {
    if (options instanceof Array) {
      options = { fields: options }
    }

    this.set(updates)
    return this.save(options)
  }

  DAO.prototype.setAttributes = function(updates) {
    return this.set(updates)
  }

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
          query = self.QueryInterface.delete(self, self.QueryInterface.QueryGenerator.addSchema(self.Model), identifier, options)
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

  DAO.prototype.increment = function(fields, countOrOptions) {
    Utils.validateParameter(countOrOptions, Object, {
      optional:           true,
      deprecated:         'number',
      deprecationWarning: "Increment expects an object as second parameter. Please pass the incrementor as option! ~> instance.increment(" + JSON.stringify(fields) + ", { by: " + countOrOptions + " })"
    })

    var identifier    = this.__options.hasPrimaryKeys ? this.primaryKeyValues : { id: this.id }
      , updatedAtAttr = this.Model._timestampAttributes.updatedAt
      , values        = {}
      , where

    if (countOrOptions === undefined) {
      countOrOptions = { by: 1, transaction: null }
    } else if (typeof countOrOptions === 'number') {
      countOrOptions = { by: countOrOptions, transaction: null }
    }

    countOrOptions = Utils._.extend({
      by:         1,
      attributes: {},
      where:      {}
    }, countOrOptions)

    where = _.extend(countOrOptions.where, identifier);

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

    return this.QueryInterface.increment(this, this.QueryInterface.QueryGenerator.addSchema(this.Model.tableName, this.Model.options.schema), values, where, countOrOptions)
  }

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
    var defaults
      , key;

    values = values && _.clone(values) || {}

    if (options.isNewRecord) {
      defaults = {}

      if (this.Model._hasDefaultValues) {
        Utils._.each(this.Model._defaultValues, function(valueFn, key) {
          if (!defaults.hasOwnProperty(key)) {
            defaults[key] = valueFn()
          }
        })
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
            this.set(key, Utils.toDefaultValue(defaults[key]), defaultsOptions)
          }
        }
      }
    }

    this.set(values, options)
  }

  return DAO
})()
