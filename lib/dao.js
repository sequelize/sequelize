var Utils        = require("./utils")
  , Mixin        = require("./associations/mixin")
  , DaoValidator = require("./dao-validator")
  , DataTypes    = require("./data-types")
  , hstore       = require('./dialects/postgres/hstore')
  , _            = require('lodash')

module.exports = (function() {
  var DAO = function(values, options) {
    this.dataValues                  = {}
    this._previousDataValues         = {}
    this.__options                   = this.__factory.options
    this.options                     = options
    this.hasPrimaryKeys              = this.__factory.options.hasPrimaryKeys
    // What is selected values even used for?
    this.selectedValues              = options.include ? _.omit(values, options.includeNames) : values
    this.__eagerlyLoadedAssociations = []
    this.isNewRecord                 = options.isNewRecord

    initValues.call(this, values, options);
  }

  Utils._.extend(DAO.prototype, Mixin.prototype)

  Object.defineProperty(DAO.prototype, 'sequelize', {
    get: function(){ return this.__factory.daoFactoryManager.sequelize }
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

      Utils._.each(this.__factory.primaryKeys, function(_, attr) {
        result[attr] = self.dataValues[attr]
      })

      return result
    }
  })

  Object.defineProperty(DAO.prototype, "identifiers", {
    get: function() {
      var primaryKeys = Object.keys(this.__factory.primaryKeys)
        , result      = {}
        , self        = this

      if (!this.__factory.hasPrimaryKeys) {
        primaryKeys = ['id']
      }

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

    if (typeof key === "object") {
      values = key
      options = value

      options || (options = {})

      if (options.reset) {
        this.dataValues = {}
      }

      // If raw, and we're not dealing with includes, just set it straight on the dataValues object
      if (options.raw && !(this.options && this.options.include) && !this._hasBooleanAttributes) {
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
          if (this._hasPrimaryKeys && originalValue && this._isPrimaryKey(key)) {
            return
          }

          // If attempting to set generated id and id is already defined, return
          // This is hack since generated id is not in primaryKeys, although it should be
          if (originalValue && key === "id") {
            return
          }

          // If attempting to set read only attributes, return
          if (!options.raw && this._hasReadOnlyAttributes && this._isReadOnlyAttribute(key)) {
            return
          }

          // Convert boolean-ish values to booleans
          if (this._hasBooleanAttributes && this._isBooleanAttribute(key) && value !== null && value !== undefined) {
            value = !!value
          }

          // Convert date fields to real date objects
          if (this._hasDateAttributes && this._isDateAttribute(key) && value !== null && !(value instanceof Date)) {
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

  DAO.prototype.changed = function(key) {
    if (key) {
      if (this._isDateAttribute(key) && this._previousDataValues[key] && this.dataValues[key]) {
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
        , isEmpty = Utils.firstValueOfHash(daoInstance.identifiers) === null

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
      self.hookValidate().error(function(err) {
        emitter.emit('error', err)
      }).success(function() {
        options.fields.forEach(function(field) {
          if (self.dataValues[field] !== undefined) {
            values[field] = self.dataValues[field]
          }
        })

        for (var attrName in self.daoFactory.rawAttributes) {
          if (self.daoFactory.rawAttributes.hasOwnProperty(attrName)) {
            var definition = self.daoFactory.rawAttributes[attrName]
              , isHstore   = !!definition.type && !!definition.type.type && definition.type.type === DataTypes.HSTORE.type
              , isEnum          = definition.type && (definition.type.toString() === DataTypes.ENUM.toString())
              , isMySQL         = ['mysql', 'mariadb'].indexOf(self.daoFactory.daoFactoryManager.sequelize.options.dialect) !== -1
              , ciCollation     = !!self.daoFactory.options.collate && self.daoFactory.options.collate.match(/_ci$/i)
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
              && !!self.daoFactory.rawAttributes[updatedAtAttr]
              && !!self.daoFactory.rawAttributes[updatedAtAttr].defaultValue
            )
            ? self.daoFactory.rawAttributes[updatedAtAttr].defaultValue
            : Utils.now(self.sequelize.options.dialect))
        }

        if (self.isNewRecord && createdAtAttr && !values[createdAtAttr]) {
          values[createdAtAttr] = (
            (
              !!self.daoFactory.rawAttributes[createdAtAttr]
              && !!self.daoFactory.rawAttributes[createdAtAttr].defaultValue
            )
            ? self.daoFactory.rawAttributes[createdAtAttr].defaultValue
            : Utils.now(self.sequelize.options.dialect))
          }

        var query = null
          , args  = []
          , hook  = ''

        if (self.isNewRecord) {
          query         = 'insert'
          args          = [self, self.QueryInterface.QueryGenerator.addSchema(self.__factory), values, options]
          hook          = 'Create'
        } else {
          var identifier = self.__options.hasPrimaryKeys ? self.primaryKeyValues : { id: self.id }

          if (identifier === null && self.__options.whereCollection !== null) {
            identifier = self.__options.whereCollection;
          }

          query         = 'update'
          args          = [self, self.QueryInterface.QueryGenerator.addSchema(self.__factory), values, identifier, options]
          hook          = 'Update'
        }

        // Add the values to the DAO
        self.dataValues = _.extend(self.dataValues, values)

        // Run the beforeCreate / beforeUpdate hook
        self.__factory.runHooks('before' + hook, self, function(err) {
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
                  fields = fields.filter(function(f) { return f !== self.daoFactory.tableName; })
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

              self.__factory.runHooks('after' + hook, result, function(err) {
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
      this.QueryInterface.quoteIdentifier(this.Model.getTableName()) + '.' + this.QueryInterface.quoteIdentifier(this.Model.primaryKeyAttributes[0] || 'id') + '=?',
      this.get(this.Model.primaryKeyAttributes[0] || 'id', {raw: true})
    ]

    return new Utils.CustomEventEmitter(function(emitter) {
      this.__factory.find({
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
  DAO.prototype.validate = function(object) {
    var validator = new DaoValidator(this, object)
      , errors    = validator.validate()

    return (Utils._.isEmpty(errors) ? null : errors)
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
    this.set(updates)
  }

  DAO.prototype.destroy = function(options) {
    options = options || {}
    options.force = options.force === undefined ? false : Boolean(options.force)

    var self  = this
      , query = null

    return new Utils.CustomEventEmitter(function(emitter) {
      self.daoFactory.runHooks(self.daoFactory.options.hooks.beforeDestroy, self, function(err) {
        if (!!err) {
          return emitter.emit('error', err)
        }

        if (self.Model._timestampAttributes.deletedAt && options.force === false) {
          self.dataValues[self.Model._timestampAttributes.deletedAt] = new Date()
          query = self.save(options)
        } else {
          var identifier = self.__options.hasPrimaryKeys ? self.primaryKeyValues : { id: self.id };
          query = self.QueryInterface.delete(self, self.QueryInterface.QueryGenerator.addSchema(self.__factory.tableName, self.__factory.options.schema), identifier, options)
        }

        query.on('sql', function(sql) {
          emitter.emit('sql', sql)
        })
        .error(function(err) {
          emitter.emit('error', err)
        })
        .success(function(results) {
          self.daoFactory.runHooks(self.daoFactory.options.hooks.afterDestroy, self, function(err) {
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
      countOrOptions.attributes[updatedAtAttr] = Utils.now(this.daoFactory.daoFactoryManager.sequelize.options.dialect)
    }

    return this.QueryInterface.increment(this, this.QueryInterface.QueryGenerator.addSchema(this.__factory.tableName, this.__factory.options.schema), values, identifier, countOrOptions)
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
    // set id to null if not passed as value, a newly created dao has no id
    var defaults = this.hasPrimaryKeys ? {} : { id: null },
        key;

    values = values && _.clone(values) || {}

    if (options.isNewRecord) {
      if (this.hasDefaultValues) {
        Utils._.each(this.defaultValues, function(valueFn, key) {
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
