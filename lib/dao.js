var Utils        = require("./utils")
  , Mixin        = require("./associations/mixin")
  , DaoValidator = require("./dao-validator")
  , DataTypes    = require("./data-types")

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
      result = result && this.dataValues[this.__options.underscored ? 'deleted_at' : 'deletedAt'] !== null

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

  DAO.prototype.setDataValue = function(name, value) {
    this.dataValues[name] = value
  }

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

      var tmpVals = self.values

      fields.forEach(function(field) {
        if (tmpVals[field] !== undefined) {
          values[field] = tmpVals[field]
        }
      })
    }

    for (var attrName in this.daoFactory.rawAttributes) {
      if (this.daoFactory.rawAttributes.hasOwnProperty(attrName)) {
        var definition      = this.daoFactory.rawAttributes[attrName]
          , isEnum          = (definition.type && (definition.type.toString() === DataTypes.ENUM.toString()))
          , isHstore        = (!!definition.type && !!definition.type.type && definition.type.type === DataTypes.HSTORE.type)
          , hasValue        = (typeof values[attrName] !== 'undefined')
          , valueOutOfScope = ((definition.values || []).indexOf(values[attrName]) === -1)

        if (isEnum && hasValue && valueOutOfScope) {
          throw new Error('Value "' + values[attrName] + '" for ENUM ' + attrName + ' is out of allowed scope. Allowed values: ' + definition.values.join(', '))
        }

        if (isHstore) {
          if (typeof values[attrName] === "object") {
            var text = []
            Utils._.each(values[attrName], function(value, key){
              if (typeof value !== "string" && typeof value !== "number") {
                throw new Error('Value for HSTORE must be a string or number.')
              }

              text.push(this.QueryInterface.quoteIdentifier(key) + '=>' + (typeof value === "string" ? this.QueryInterface.quoteIdentifier(value) : value))
            }.bind(this))
            values[attrName] = text.join(',')
          }
        }
      }
    }

    if (this.__options.timestamps && this.dataValues.hasOwnProperty(updatedAtAttr)) {
      this.dataValues[updatedAtAttr] = values[updatedAtAttr] = Utils.now()
    }

    return new Utils.CustomEventEmitter(function(emitter) {
      this.validate().success(function(errors) {
        if (!!errors) {
          emitter.emit('error', errors)
        } else if (this.isNewRecord) {
          this
            .QueryInterface
            .insert(this, this.QueryInterface.QueryGenerator.addSchema(this.__factory), values)
            .proxy(emitter)
        } else {
          var identifier = this.__options.hasPrimaryKeys ? this.primaryKeyValues : { id: this.id };

          if (identifier === null && this.__options.whereCollection !== null) {
            identifier = this.__options.whereCollection;
          }

          var tableName  = this.QueryInterface.QueryGenerator.addSchema(this.__factory)
            , query      = this.QueryInterface.update(this, tableName, values, identifier)

          query.proxy(emitter)
        }
      }.bind(this))
    }.bind(this)).run()
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
      this.QueryInterface.quoteIdentifier(this.__factory.tableName) + '.' + this.QueryInterface.quoteIdentifier('id')+'=?',
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
    return new DaoValidator(this).validate()
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
      this.dataValues[attr] = new Date()
      return this.save()
    } else {
      var identifier = this.__options.hasPrimaryKeys ? this.primaryKeyValues : { id: this.id };
      return this.QueryInterface.delete(this, this.QueryInterface.QueryGenerator.addSchema(this.__factory.tableName, this.__factory.options.schema), identifier)
    }
  }

  DAO.prototype.increment = function(fields, count) {
    var identifier = this.__options.hasPrimaryKeys ? this.primaryKeyValues : { id: this.id },
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

    return this.QueryInterface.increment(this, this.QueryInterface.QueryGenerator.addSchema(this.__factory.tableName, this.__factory.options.schema), values, identifier)
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
    if (typeof this.dataValues[attribute] !== 'undefined')
      return;

    if (this.booleanValues.length && this.booleanValues.indexOf(attribute) !== -1) // transform integer 0,1 into boolean
      value = !!value;

    var has = (function(o) {
      var predef = Object.getOwnPropertyDescriptor(o, attribute);

      if (predef && predef.hasOwnProperty('value'))
        return true; // true here means 'this property exist as a simple value property, do not place setters or getters at all'

        return {
          get: (predef && predef.hasOwnProperty('get') ? predef.get : null) || o.__lookupGetter__(attribute),
          set: (predef && predef.hasOwnProperty('set') ? predef.set : null) || o.__lookupSetter__(attribute)
        };
    })(this);

    // @ node-v0.8.19:
    //    calling __defineGetter__ destroys any previously defined setters for the attribute in
    //    question *if* that property setter was defined on the object's prototype (which is what
    //    we do in dao-factory) ... therefore we need to [re]define both the setter and getter
    //    here with either the function that already existed OR the default/automatic definition
    //
    //    (the same is true for __defineSetter and 'prototype' getters)
    if (has !== true) {
      this.__defineGetter__(attribute, has.get || function()  { return this.dataValues[attribute]; });
      this.__defineSetter__(attribute, has.set || function(v) { this.dataValues[attribute] = v;    });
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
        if (typeof values[key] === "string" && !!this.__factory && !!this.__factory.rawAttributes[key] && !!this.__factory.rawAttributes[key].type && !!this.__factory.rawAttributes[key].type.type && this.__factory.rawAttributes[key].type.type === DataTypes.HSTORE.type) {
          values[key] = this.QueryInterface.QueryGenerator.toHstore(values[key])
        }

        this.addAttribute(key, values[key])
      }
    }

    if (isNewRecord) {
      if (this.hasDefaultValues) {
        Utils._.each(this.defaultValues, function(valueFn, key) {
          if (!defaults.hasOwnProperty(key))
            defaults[key] = valueFn()
        })
      }

      if (this.__options.timestamps) {
        defaults[this.__options.underscored ? 'created_at' : 'createdAt'] = Utils.now()
        defaults[this.__options.underscored ? 'updated_at' : 'updatedAt'] = Utils.now()

        if (this.__options.paranoid) {
          defaults[this.__options.underscored ? 'deleted_at' : 'deletedAt'] = null
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
  }

  return DAO
})()
