var Utils          = require("./utils")
  , Mixin          = require("./associations/mixin")
  , Validator      = require("validator")

module.exports = (function() {
  var Model = function(values, options) {
    var self = this

    this.__definition = null // will be set in Model.build
    this.attributes = []
    this.validators = {} // holds validation settings for each attribute
    this.__options = options || {}

    initAttributes.call(this, values)
  }
  Utils._.extend(Model.prototype, Mixin.prototype)

  Model.Events = {
    insert: 'InsertQuery',
    update: 'UpdateQuery',
    destroy: 'DestroyQuery'
  }

  Model.prototype.__defineGetter__('QueryGenerator', function() {
    return this.__definition.QueryGenerator
  })

  Model.prototype.save = function() {
    var attr = this.__options.underscored ? 'updated_at' : 'updatedAt'

    if(this.hasOwnProperty(attr))
      this[attr] = new Date()

    if(this.isNewRecord) {
      var self = this
      var eventEmitter = new Utils.CustomEventEmitter(function() {
        query.call(self, self.QueryGenerator.insertQuery(self.__definition.tableName, self.values))
        .on('success', function(obj) {
          obj.isNewRecord = false
          eventEmitter.emit('success', obj)
        })
        .on('failure', function(err) { eventEmitter.emit('failure', err) })
      })
      return eventEmitter.run()
    } else {
      var identifier = this.__options.hasPrimaryKeys ? this.primaryKeyValues : this.id
      return query.call(this, this.QueryGenerator.updateQuery(this.__definition.tableName, this.values, identifier))
    }
  }

  /*
   * Validate this model's attribute values according to validation rules set in the model definition.
   *
   * @return null if and only if validation successful; otherwise an object containing { field name : [error msgs] } entries.
   */
  Model.prototype.validate = function() {
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


  Model.prototype.updateAttributes = function(updates) {
    var self = this

    var readOnlyAttributes = Utils._.keys(this.__definition.primaryKeys)
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
    return this.save()
  }

  Model.prototype.destroy = function() {
    if(this.__options.timestamps && this.__options.paranoid) {
      this[this.__options.underscored ? 'deleted_at' : 'deletedAt'] = new Date()
      return this.save()
    } else {
      var identifier = this.__options.hasPrimaryKeys ? this.primaryKeyValues : this.id
      return query.call(this, this.QueryGenerator.deleteQuery(this.__definition.tableName, identifier))
    }
  }

  Model.prototype.__defineGetter__("identifiers", function() {
    var primaryKeys = Utils._.keys(this.__definition.primaryKeys)
      , result      = {}
      , self        = this

    if(!this.__definition.hasPrimaryKeys)
      primaryKeys = ['id']

    primaryKeys.forEach(function(identifier) {
      result[identifier] = self[identifier]
    })

    return result
  })

  Model.prototype.__defineGetter__('isDeleted', function() {
    var result = this.__options.timestamps && this.__options.paranoid
    result = result && this[this.__options.underscored ? 'deleted_at' : 'deletedAt'] != null

    return result
  })

  Model.prototype.__defineGetter__('values', function() {
    var result = {}
      , self   = this

    this.attributes.forEach(function(attr) {
      result[attr] = self[attr]
    })

    return result
  })

  Model.prototype.__defineGetter__('primaryKeyValues', function() {
    var result = {}
      , self   = this

    Utils._.each(this.__definition.primaryKeys, function(_, attr) {
      result[attr] = self[attr]
    })

    return result
  })

  Model.prototype.equals = function(other) {
    var result = true
      , self   = this

    Utils._.each(this.values, function(value, key) {
      result = result && (value == other[key])
    })

    return result
  }

  Model.prototype.equalsOneOf = function(others) {
    var result = false
      , self   = this

    others.forEach(function(other) { result = result || self.equals(other) })

    return result
  }

  Model.prototype.addAttribute = function(attribute, value) {
    this[attribute] = value
    this.attributes.push(attribute)
  }

  Model.prototype.setValidators = function(attribute, validators) {
    this.validators[attribute] = validators
  }

  // private

  var initAttributes = function(values) {
    var self = this

    // add all passed values to the model and store the attribute names in this.attributes
    Utils._.map(values, function(value, key) { self.addAttribute(key, value) })

    // set id to null if not passed as value
    // a newly created model has no id
    var defaults = this.__options.hasPrimaryKeys ? {} : { id: null }

    if(this.__options.timestamps) {
      defaults[this.__options.underscored ? 'created_at' : 'createdAt'] = new Date()
      defaults[this.__options.underscored ? 'updated_at' : 'updatedAt'] = new Date()

      if(this.__options.paranoid)
        defaults[this.__options.underscored ? 'deleted_at' : 'deletedAt'] = null
    }

    Utils._.map(defaults, function(value, attr) {
      if(!self.hasOwnProperty(attr))
        self.addAttribute(attr, value)
    })
  }

  var query = function() {
    var args = Utils._.map(arguments, function(arg, _) { return arg })
      , s    = this.__definition.modelManager.sequelize

    args.push(this)
    return s.query.apply(s, args)
  }

  /* Add the instance methods to Model */
  Utils._.extend(Model.prototype, Mixin.prototype)

  return Model
})()
