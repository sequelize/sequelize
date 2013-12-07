var Utils        = require("./utils")
  , Mixin        = require("./associations/mixin")
  , DaoValidator = require("./dao-validator")
  , DataTypes    = require("./data-types")
  , hstore       = require('./dialects/postgres/hstore')

module.exports = (function() {
  var DAO = function(values, options, isNewRecord) {
    this.dataValues                  = {}
    this.__options                   = options
    this.hasPrimaryKeys              = options.hasPrimaryKeys
    this.selectedValues              = values
    this.__eagerlyLoadedAssociations = []

    initAttributes.call(this, values, isNewRecord)
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
      var result = this.__options.timestamps && this.__options.paranoid
      result = result && this.dataValues[Utils._.underscoredIf(this.__options.deletedAt, this.__options.underscored)] !== null

      return result
    }
  })

  Object.defineProperty(DAO.prototype, 'values', {
    get: function() {
      var result = {}
        , self   = this

      this.attributes.concat(this.__eagerlyLoadedAssociations).forEach(function(attr) {
        result[attr] = self.dataValues.hasOwnProperty(attr)
                     ? self.dataValues[attr]
                     : self[attr]
                     ;
      })

      return result
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

  DAO.prototype.getDataValue = function(name) {
    return this.dataValues && this.dataValues.hasOwnProperty(name) ? this.dataValues[name] : this[name]
  }
  DAO.prototype.get = DAO.prototype.getDataValue

  DAO.prototype.setDataValue = function(name, value) {
    if (Utils.hasChanged(this.dataValues[name], value)) {
      this.isDirty = true
    }
    this.dataValues[name] = value
  }
  DAO.prototype.set = DAO.prototype.setDataValue

  // if an array with field names is passed to save()
  // only those fields will be updated
  DAO.prototype.save = function(fieldsOrOptions, options) {
    if (fieldsOrOptions instanceof Array) {
      fieldsOrOptions = { fields: fieldsOrOptions }
    }

    options = Utils._.extend({}, options, fieldsOrOptions)

    var self          = this
      , values        = options.fields ? {} : this.dataValues
      , updatedAtAttr = Utils._.underscoredIf(this.__options.updatedAt, this.__options.underscored)
      , createdAtAttr = Utils._.underscoredIf(this.__options.createdAt, this.__options.underscored)

    if (options.fields) {
      if (self.__options.timestamps) {
        if (options.fields.indexOf(updatedAtAttr) === -1) {
          options.fields.push(updatedAtAttr)
        }

        if (options.fields.indexOf(createdAtAttr) === -1 && this.isNewRecord === true) {
          options.fields.push(createdAtAttr)
        }
      }

      var tmpVals = self.dataValues

      options.fields.forEach(function(field) {
        if (tmpVals[field] !== undefined) {
          values[field] = tmpVals[field]
        }
      })
    }

    return new Utils.CustomEventEmitter(function(emitter) {
      self.hookValidate().error(function (err) {
        return emitter.emit('error', err)
      }).success(function() {

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

        if (self.__options.timestamps && self.dataValues.hasOwnProperty(updatedAtAttr)) {
          self.dataValues[updatedAtAttr] = values[updatedAtAttr] = (
            (
              self.isNewRecord
              && !!self.daoFactory.rawAttributes[updatedAtAttr]
              && !!self.daoFactory.rawAttributes[updatedAtAttr].defaultValue
            )
            ? self.daoFactory.rawAttributes[updatedAtAttr].defaultValue
            : Utils.now(self.sequelize.options.dialect))
        }

        var query = null
          , args  = []
          , hook  = ''

        if (self.isNewRecord) {
          self.isDirty  = false
          query         = 'insert'
          args          = [self, self.QueryInterface.QueryGenerator.addSchema(self.__factory), values, options]
          hook          = 'Create'
        } else {
          var identifier = self.__options.hasPrimaryKeys ? self.primaryKeyValues : { id: self.id }

          if (identifier === null && self.__options.whereCollection !== null) {
            identifier = self.__options.whereCollection;
          }

          self.isDirty  = false
          query         = 'update'
          args          = [self, self.QueryInterface.QueryGenerator.addSchema(self.__factory), values, identifier, options]
          hook          = 'Update'
        }

        self.__factory.runHooks('before' + hook, values, function(err, newValues) {
          if (!!err) {
            return emitter.emit('error', err)
          }

          // redeclare our new values
          args[2] = newValues || args[2]

          self.QueryInterface[query].apply(self.QueryInterface, args)
            .on('sql', function(sql) {
              emitter.emit('sql', sql)
            })
            .error(function(err) {
              emitter.emit('error', err)
            })
            .success(function(result) {
              self.__factory.runHooks('after' + hook, result.values, function(err, newValues) {
                if (!!err) {
                  return emitter.emit('error', err)
                }

                result.dataValues = newValues
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
      this.QueryInterface.quoteIdentifier(this.__factory.tableName) + '.' + this.QueryInterface.quoteIdentifier('id')+'=?',
      this.id
    ]

    return new Utils.CustomEventEmitter(function(emitter) {
      this.__factory.find({
        where:   where,
        limit:   1,
        include: this.__eagerlyLoadedOptions || []
      }, options)
      .on('sql', function(sql) { emitter.emit('sql', sql) })
      .on('error', function(error) { emitter.emit('error', error) })
      .on('success', function(obj) {
        for (var valueName in obj.values) {
          if (obj.values.hasOwnProperty(valueName)) {
            this[valueName] = obj.values[valueName]
          }
        }
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

  DAO.prototype.updateAttributes = function(updates, fieldsOrOptions) {
    if (fieldsOrOptions instanceof Array) {
      fieldsOrOptions = { fields: fieldsOrOptions }
    }

    this.setAttributes(updates)

    return this.save(fieldsOrOptions)
  }

  DAO.prototype.setAttributes = function(updates) {
    var self = this

    var readOnlyAttributes = Object.keys(this.__factory.primaryKeys)
    readOnlyAttributes.push('id')

    if (this.isNewRecord !== true) {
      readOnlyAttributes.push(Utils._.underscoredIf(this.daoFactory.options.createdAt, this.daoFactory.options.underscored))
    }
    // readOnlyAttributes.push(this.daoFactory.options.underscored === true ? 'updated_at' : 'updatedAt')
    readOnlyAttributes.push(this.daoFactory.options.deletedAt, this.daoFactory.options.underscored)

    var isDirty = this.isDirty

    Utils._.each(updates, function(value, attr) {
      var updateAllowed = (
        (readOnlyAttributes.indexOf(attr) === -1) &&
        (readOnlyAttributes.indexOf(Utils._.underscored(attr)) === -1) &&
        (self.attributes.indexOf(attr) > -1)
      )

      if (updateAllowed) {
        if (Utils.hasChanged(self[attr], value)) {
          isDirty = true
        }

        self[attr] = value
      }
    })

    // since we're updating the record, we should be updating the updatedAt column..
    if (this.daoFactory.options.timestamps === true) {
      isDirty = true
      self[Utils._.underscoredIf(this.daoFactory.options.updatedAt, this.daoFactory.options.underscored)] = new Date()
    }

    this.isDirty = isDirty
  }

  DAO.prototype.destroy = function(options) {
    var self  = this
      , query = null

    return new Utils.CustomEventEmitter(function(emitter) {
      self.daoFactory.runHooks(self.daoFactory.options.hooks.beforeDestroy, self.dataValues, function(err) {
        if (!!err) {
          return emitter.emit('error', err)
        }

        if (self.__options.timestamps && self.__options.paranoid) {
          var attr = Utils._.underscoredIf(self.__options.deletedAt, self.__options.underscored)
          self.dataValues[attr] = new Date()
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
          self.daoFactory.runHooks(self.daoFactory.options.hooks.afterDestroy, self.dataValues, function(err) {
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
      , updatedAtAttr = Utils._.underscoredIf(this.__options.updatedAt, this.__options.underscored)
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

    if (this.__options.timestamps) {
      if (!values[updatedAtAttr]) {
        countOrOptions.attributes[updatedAtAttr] = Utils.now(this.daoFactory.daoFactoryManager.sequelize.options.dialect)
      }
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

  DAO.prototype.addAttribute = function(attribute, value) {
    if (this.booleanValues.length && this.booleanValues.indexOf(attribute) !== -1 && value != null) { // transform integer 0,1 into boolean
      value = !!value
    }

    this[attribute] = value;
  }

  DAO.prototype.setValidators = function(attribute, validators) {
    this.validators[attribute] = validators
  }

  DAO.prototype.toJSON = function() {
    return this.values;
  }

  // private

  var initAttributes = function(values, isNewRecord) {
    // set id to null if not passed as value, a newly created dao has no id
    var defaults = this.hasPrimaryKeys ? {} : { id: null },
        attrs    = {},
        key;

    // add all passed values to the dao and store the attribute names in this.attributes
    for (key in values) {
      if (values.hasOwnProperty(key)) {
        this.addAttribute(key, values[key])
      }
    }

    if (isNewRecord) {
      if (this.hasDefaultValues) {
        Utils._.each(this.defaultValues, function(valueFn, key) {
          if (!defaults.hasOwnProperty(key)) {
            defaults[key] = valueFn()
          }
        })
      }

      if (this.__options.timestamps) {
        if (!this.defaultValues[Utils._.underscoredIf(this.__options.createdAt, this.__options.underscored)]) {
          defaults[Utils._.underscoredIf(this.__options.createdAt, this.__options.underscored)] = Utils.now(this.sequelize.options.dialect)
        }

        if (!this.defaultValues[Utils._.underscoredIf(this.__options.updatedAt, this.__options.underscored)]) {
          defaults[Utils._.underscoredIf(this.__options.updatedAt, this.__options.underscored)] = Utils.now(this.sequelize.options.dialect)
        }

        if (this.__options.paranoid && !this.defaultValues[Utils._.underscoredIf(this.__options.deletedAt, this.__options.underscored)]) {
          defaults[Utils._.underscoredIf(this.__options.deletedAt, this.__options.underscored)] = null
        }
      }
    }

    if (Utils._.size(defaults)) {
      for (key in defaults) {
        attrs[key] = Utils.toDefaultValue(defaults[key])
      }
    }

    Utils._.each(this.attributes, function(key) {
      if (!attrs.hasOwnProperty(key)) {
        attrs[key] = undefined
      }
    })

    if (values) {
      for (key in values) {
        if (values.hasOwnProperty(key)) {
          attrs[key] = values[key]
        }
      }
    }

    for (key in attrs) {
      this.addAttribute(key, attrs[key])
    }

    // this.addAttributes COMPLETELY destroys the structure of our DAO due to __defineGetter__ resetting the object
    // so now we have to rebuild for bulkInserts, bulkUpdates, etc.
    var rebuild = {}

    // Get the correct map....
    Utils._.each(this.attributes, function(key) {
      if (this.dataValues.hasOwnProperty(key)) {
        rebuild[key] = this.dataValues[key]
      }
    }.bind(this))

    // This allows for aliases, etc.
    this.dataValues = Utils._.extend(rebuild, this.dataValues)
  }

  return DAO
})()
