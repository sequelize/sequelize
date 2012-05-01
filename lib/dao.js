var Utils     = require("./utils")
  , Mixin     = require("./associations/mixin")
  , DataTypes = require("./data-types")
  , Validator = require("validator")

module.exports = (function() {
  var DAO = function(values, options) {
    var self = this

    this.attributes = []
    this.validators = {} // holds validation settings for each attribute
    this.__factory = null // will be set in DAO.build
    this.__options = Utils._.extend({
      underscored: false,
      hasPrimaryKeys: false,
      timestamps: true,
      paranoid: false
    }, options || {})

    initAttributes.call(this, values)
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
      result = result && this[this.__options.underscored ? 'deleted_at' : 'deletedAt'] != null

      return result
    }
  })

  Object.defineProperty(DAO.prototype, 'values', {
    get: function() {
      var result = {}
        , self   = this

      this.attributes.forEach(function(attr) {
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
      var primaryKeys = Utils._.keys(this.__factory.primaryKeys)
        , result      = {}
        , self        = this

      if(!this.__factory.hasPrimaryKeys)
        primaryKeys = ['id']

      primaryKeys.forEach(function(identifier) {
        result[identifier] = self[identifier]
      })

      return result
    }
  })

  DAO.prototype.save = function() {
    var updatedAtAttr = this.__options.underscored ? 'updated_at' : 'updatedAt'

    if(this.__options.timestamps && this.hasOwnProperty(updatedAtAttr))
      this[updatedAtAttr] = new Date()

    if(this.isNewRecord) {
      return this.QueryInterface.insert(this, this.__factory.tableName, this.values)
    } else {
      var identifier = this.__options.hasPrimaryKeys ? this.primaryKeyValues : this.id
        , tableName  = this.__factory.tableName
        , query      = this.QueryInterface.update(this, tableName, this.values, identifier)

      return query
    }
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
            fn_args = details.hasOwnProperty("args") ? details.args : []
            if (!Utils._.isArray(fn_args))
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


  DAO.prototype.updateAttributes = function(updates) {
    this.setAttributes(updates)
    return this.save()
  }

  DAO.prototype.setAttributes = function(updates) {
    var self = this

    var readOnlyAttributes = Utils._.keys(this.__factory.primaryKeys)
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
    if(this.__options.timestamps && this.__options.paranoid) {
      var attr = this.__options.underscored ? 'deleted_at' : 'deletedAt'
      this[attr] = new Date()
      return this.save()
    } else {
      var identifier = this.__options.hasPrimaryKeys ? this.primaryKeyValues : this.id
      return this.QueryInterface.delete(this, this.__factory.tableName, identifier)
    }
  }

  DAO.prototype.equals = function(other) {
    var result = true
      , self   = this

    Utils._.each(this.values, function(value, key) {
      result = result && (value == other[key])
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
    this.attributes.push(attribute)
  }

  DAO.prototype.setValidators = function(attribute, validators) {
    this.validators[attribute] = validators
  }

  DAO.prototype.toJSON = function() {
    return this.values;
  }

  // private

  var initAttributes = function(values) {
    var self = this

    // add all passed values to the dao and store the attribute names in this.attributes
    Utils._.map(values, function(value, key) { self.addAttribute(key, value) })

    // set id to null if not passed as value
    // a newly created dao has no id
    var defaults = this.__options.hasPrimaryKeys ? {} : { id: null }

    if(this.__options.timestamps) {
      defaults[this.__options.underscored ? 'created_at' : 'createdAt'] = new Date()
      defaults[this.__options.underscored ? 'updated_at' : 'updatedAt'] = new Date()

      if(this.__options.paranoid)
        defaults[this.__options.underscored ? 'deleted_at' : 'deletedAt'] = null
    }

    Utils._.map(defaults, function(value, attr) {
      if(!self.hasOwnProperty(attr)) {
        self.addAttribute(attr, Utils.toDefaultValue(value))
      }
    })
  }

  /* Add the instance methods to DAO */
  Utils._.extend(DAO.prototype, Mixin.prototype)

  return DAO
})()
