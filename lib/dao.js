var Utils     = require("./utils")
  , Mixin     = require("./associations/mixin")
  , Validator = require("validator")
  , DataTypes = require("./data-types")

module.exports = (function() {
  var DAO = function(values, options, isNewRecord) {
    var self = this

    this.__options                   = options
    this.hasPrimaryKeys              = options.hasPrimaryKeys
    this.selectedValues              = values
    this.__eagerlyLoadedAssociations = []

    initAttributes.call(this, values, isNewRecord)

    if (this.hasDefaultValues) {
      Utils._.each(this.defaultValues, function (value, name) {
        if (typeof self[name] === 'undefined') {
          self.addAttribute(name, value());
        }
      })
    }

    if (this.booleanValues.length) {
      this.booleanValues.forEach(function (name) {
        //transform integer 0,1 into boolean
        self[name] = !!self[name];
      });
    }
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
      result = result && this[this.__options.underscored ? 'deleted_at' : 'deletedAt'] !== null

      return result
    }
  })

  Object.defineProperty(DAO.prototype, 'values', {
    get: function() {
      var result = {}
        , self   = this

      this.attributes.concat(this.__eagerlyLoadedAssociations).forEach(function(attr) {
        result[attr] = self[attr]
      })

      return result
    }
  })

  Object.defineProperty(DAO.prototype, 'primaryKeyValues', {
    get: function() {
      var result = {}
        , self   = this

      Utils._.each(this.__factory.primaryKeys, function(_, attr) {
        result[attr] = self[attr]
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
        result[identifier] = self[identifier]
      })

      return result
    }
  })

  // if an array with field names is passed to save()
  // only those fields will be updated
  DAO.prototype.save = function(fields) {
    var self          = this
      , values        = fields ? {} : this.values
      , updatedAtAttr = this.__options.underscored ? 'updated_at' : 'updatedAt'
      , createdAtAttr = this.__options.underscored ? 'created_at' : 'createdAt'

    if (fields) {
      if (self.__options.timestamps) {
        if (fields.indexOf(updatedAtAttr) === -1) {
          fields.push(updatedAtAttr)
        }

        if (fields.indexOf(createdAtAttr) === -1) {
          fields.push(createdAtAttr)
        }
      }

      fields.forEach(function(field) {
        if (self.values[field] !== undefined) {
          values[field] = self.values[field]
        }
      })
    }

    for (var attrName in this.daoFactory.rawAttributes) {
      if (this.daoFactory.rawAttributes.hasOwnProperty(attrName)) {
        var definition      = this.daoFactory.rawAttributes[attrName]
          , isEnum          = (definition.type && (definition.type.toString() === DataTypes.ENUM.toString()))
          , hasValue        = (typeof values[attrName] !== 'undefined')
          , valueOutOfScope = ((definition.values || []).indexOf(values[attrName]) === -1)

        if (isEnum && hasValue && valueOutOfScope) {
          throw new Error('Value "' + values[attrName] + '" for ENUM ' + attrName + ' is out of allowed scope. Allowed values: ' + definition.values.join(', '))
        }
      }
    }

    if (this.__options.timestamps && this.hasOwnProperty(updatedAtAttr)) {
      this[updatedAtAttr] = values[updatedAtAttr] = Utils.now()
    }

    if (this.isNewRecord) {
      return this.QueryInterface.insert(this, this.__factory.tableName, values)
    } else {
      var identifier = this.__options.hasPrimaryKeys ? this.primaryKeyValues : this.id;

      if (identifier === null && this.__options.whereCollection !== null) {
        identifier = this.__options.whereCollection;
      }

      var tableName  = this.__factory.tableName
        , query      = this.QueryInterface.update(this, tableName, values, identifier)

      return query
    }
  }

 /*
  * Refresh the current instance in-place, i.e. update the object with current data from the DB and return the same object.
  * This is different from doing a `find(DAO.id)`, because that would create and return a new object. With this method,
  * all references to the DAO are updated with the new data and no new objects are created.
  *
  * @return {Object}         A promise which fires `success`, `error`, `complete` and `sql`.
  */
  DAO.prototype.reload = function() {
    var where = [
      this.QueryInterface.QueryGenerator.addQuotes(this.__factory.tableName) + '.' + this.QueryInterface.QueryGenerator.addQuotes('id')+'=?',
      this.id
    ]

    return new Utils.CustomEventEmitter(function(emitter) {
      this.__factory.find({
        where:   where,
        limit:   1,
        include: this.__eagerlyLoadedOptions || []
      })
      .on('sql', function(sql) { emitter.emit('sql', sql) })
      .on('error', function(error) { emitter.emit('error', error) })
      .on('success', function(obj) {
        for (var valueName in obj.values) {
          if (obj.values.hasOwnProperty(valueName)) {
            this[valueName] = obj.values[valueName]
          }
        }
        emitter.emit('success', this)
      }.bind(this))
    }.bind(this)).run()
  }

  /*
   * Validate this dao's attribute values according to validation rules set in the dao definition.
   *
   * @return null if and only if validation successful; otherwise an object containing { field name : [error msgs] } entries.
   */
  DAO.prototype.validate = function() {
    var self = this
    var failures = {}

    // for each field and value
    Utils._.each(self.values, function(value, field) {

      // if field has validators
      if (self.validators.hasOwnProperty(field)) {
        // for each validator
        Utils._.each(self.validators[field], function(details, validatorType) {

          var is_custom_fn = false  // if true then it's a custom validation method
          var fn_method = null      // the validation function to call
          var fn_args = []          // extra arguments to pass to validation function
          var fn_msg = ""           // the error message to return if validation fails

          // is it a custom validator function?
          if (Utils._.isFunction(details)) {
            is_custom_fn = true
            fn_method = Utils._.bind(details, self, value)
          }
          // is it a validator module function?
          else {
            // extra args
            fn_args = details.hasOwnProperty("args") ? details.args : details
            if (!Array.isArray(fn_args))
              fn_args = [fn_args]
            // error msg
            fn_msg = details.hasOwnProperty("msg") ? details.msg : false
            // check method exists
            var v = Validator.check(value, fn_msg)
            if (!Utils._.isFunction(v[validatorType]))
              throw new Error("Invalid validator function: " + validatorType)
            // bind to validator obj
            fn_method = Utils._.bind(v[validatorType], v)
          }

          try {
            fn_method.apply(null, fn_args)
          } catch (err) {
            err = err.message
            // if we didn't provide a custom error message then augment the default one returned by the validator
            if (!fn_msg && !is_custom_fn)
              err += ": " + field
            // each field can have multiple validation failures stored against it
            if (failures.hasOwnProperty(field)) {
              failures[field].push(err)
            } else {
              failures[field] = [err]
            }
          }

        }) // for each validator for this field
      } // if field has validator set
    }) // for each field

    return (Utils._.isEmpty(failures) ? null : failures)
  }


  DAO.prototype.updateAttributes = function(updates, fields) {
    this.setAttributes(updates)
    return this.save(fields)
  }

  DAO.prototype.setAttributes = function(updates) {
    var self = this

    var readOnlyAttributes = Object.keys(this.__factory.primaryKeys)

    readOnlyAttributes.push('id')
    readOnlyAttributes.push('createdAt')
    readOnlyAttributes.push('updatedAt')
    readOnlyAttributes.push('deletedAt')

    Utils._.each(updates, function(value, attr) {
      var updateAllowed = (
        (readOnlyAttributes.indexOf(attr) == -1) &&
        (readOnlyAttributes.indexOf(Utils._.underscored(attr)) == -1) &&
        (self.attributes.indexOf(attr) > -1)
      )
      updateAllowed && (self[attr] = value)
    })
  }

  DAO.prototype.destroy = function() {
    if (this.__options.timestamps && this.__options.paranoid) {
      var attr = this.__options.underscored ? 'deleted_at' : 'deletedAt'
      this[attr] = new Date()
      return this.save()
    } else {
      var identifier = this.__options.hasPrimaryKeys ? this.primaryKeyValues : this.id
      return this.QueryInterface.delete(this, this.__factory.tableName, identifier)
    }
  }

  DAO.prototype.increment = function(fields, count) {
    var identifier = this.__options.hasPrimaryKeys ? this.primaryKeyValues : this.id,
      values = {}

    if (count === undefined) count = 1;

    if (Utils._.isString(fields)) {
      values[fields] = count;
    } else if (Utils._.isArray(fields)) {
      Utils._.each(fields, function (field) {
        values[field] = count
      })
    } else { // Assume fields is key-value pairs
      values = fields;
    }

    return this.QueryInterface.increment(this, this.__factory.tableName, values, identifier)
  }

  DAO.prototype.decrement = function (fields, count) {
    if (!Utils._.isString(fields) && !Utils._.isArray(fields)) { // Assume fields is key-value pairs
      Utils._.each(fields, function (value, field) {
        fields[field] = -value;
      });
    }

    return this.increment(fields, 0 - count);
  }

  DAO.prototype.equals = function(other) {
    var result = true

    Utils._.each(this.values, function(value, key) {
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
    this[attribute] = value
  }

  DAO.prototype.setValidators = function(attribute, validators) {
    this.validators[attribute] = validators
  }

  DAO.prototype.toJSON = function() {
    return this.values;
  }

  // private

  var initAttributes = function(values, isNewRecord) {
    // add all passed values to the dao and store the attribute names in this.attributes
    for (var key in values) {
      if (values.hasOwnProperty(key)) {
        this.addAttribute(key, values[key])
      }
    }

    // set id to null if not passed as value
    // a newly created dao has no id
    var defaults = this.hasPrimaryKeys ? {} : { id: null }

    if (this.__options.timestamps && isNewRecord) {
      defaults[this.__options.underscored ? 'created_at' : 'createdAt'] = Utils.now()
      defaults[this.__options.underscored ? 'updated_at' : 'updatedAt'] = Utils.now()

      if (this.__options.paranoid) {
        defaults[this.__options.underscored ? 'deleted_at' : 'deletedAt'] = null
      }
    }

    if (Utils._.size(defaults)) {
      for (var attr in defaults) {
        var value = defaults[attr]

        if (!this.hasOwnProperty(attr)) {
          this.addAttribute(attr, Utils.toDefaultValue(value))
        }
      }
    }
  }

  return DAO
})()
