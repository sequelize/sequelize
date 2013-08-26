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
  DAO.prototype.save = function(fields, options) {
    var self          = this
      , values        = fields ? {} : this.dataValues
      , updatedAtAttr = Utils._.underscoredIf(this.__options.updatedAt, this.__options.underscored)
      , createdAtAttr = Utils._.underscoredIf(this.__options.createdAt, this.__options.underscored)

    if (fields) {
      if (self.__options.timestamps) {
        if (fields.indexOf(updatedAtAttr) === -1) {
          fields.push(updatedAtAttr)
        }

        if (fields.indexOf(createdAtAttr) === -1 && this.isNewRecord === true) {
          fields.push(createdAtAttr)
        }
      }

      var tmpVals = self.dataValues

      fields.forEach(function(field) {
        if (tmpVals[field] !== undefined) {
          values[field] = tmpVals[field]
        }
      })
    }

    for (var attrName in this.daoFactory.rawAttributes) {
      if (this.daoFactory.rawAttributes.hasOwnProperty(attrName)) {
        var definition      = this.daoFactory.rawAttributes[attrName]
          , isEnum          = definition.type && (definition.type.toString() === DataTypes.ENUM.toString())
          , isHstore        = !!definition.type && !!definition.type.type && definition.type.type === DataTypes.HSTORE.type
          , hasValue        = values[attrName] !== undefined
          , isMySQL         = this.daoFactory.daoFactoryManager.sequelize.options.dialect === "mysql"
          , ciCollation     = !!this.daoFactory.options.collate && this.daoFactory.options.collate.match(/_ci$/i)
          , valueOutOfScope

        if (isEnum && isMySQL && ciCollation && hasValue) {
          var scopeIndex = (definition.values || []).map(function(d) { return d.toLowerCase() }).indexOf(values[attrName].toLowerCase())
          valueOutOfScope = scopeIndex === -1

          // We'll return what the actual case will be, since a simple SELECT query would do the same...
          if (!valueOutOfScope) {
            values[attrName] = definition.values[scopeIndex]
          }
        } else {
          valueOutOfScope = ((definition.values || []).indexOf(values[attrName]) === -1)
        }

        if (isEnum && hasValue && valueOutOfScope && !(definition.allowNull === true && values[attrName] === null)) {
          throw new Error('Value "' + values[attrName] + '" for ENUM ' + attrName + ' is out of allowed scope. Allowed values: ' + definition.values.join(', '))
        }

        if (isHstore) {
          if (typeof values[attrName] === "object") {
            values[attrName] = hstore.stringify(values[attrName])
          }
        }
      }
    }

    if (this.__options.timestamps && this.dataValues.hasOwnProperty(updatedAtAttr)) {
      this.dataValues[updatedAtAttr] = values[updatedAtAttr] = Utils.now(this.sequelize.options.dialect)
    }

    return new Utils.CustomEventEmitter(function(emitter) {
      this.validate().success(function(errors) {
        if (!!errors) {
          emitter.emit('error', errors)
        } else if (this.isNewRecord) {
          this.isDirty = false
          this
            .QueryInterface
            .insert(this, this.QueryInterface.QueryGenerator.addSchema(this.__factory), values)
            .proxy(emitter)
        } else {
          var identifier = this.__options.hasPrimaryKeys ? this.primaryKeyValues : { id: this.id };

          if (identifier === null && this.__options.whereCollection !== null) {
            identifier = this.__options.whereCollection;
          }

          this.isDirty = false
          var tableName  = this.QueryInterface.QueryGenerator.addSchema(this.__factory)
            , query      = this.QueryInterface.update(this, tableName, values, identifier, options)

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

  DAO.prototype.updateAttributes = function(updates, fields) {
    this.setAttributes(updates)
    return this.save(fields)
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

  DAO.prototype.destroy = function() {
    if (this.__options.timestamps && this.__options.paranoid) {
      var attr = Utils._.underscoredIf(this.__options.deletedAt, this.__options.underscored)
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

    if (count === undefined) {
      count = 1;
    }

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
    if (this.booleanValues.length && this.booleanValues.indexOf(attribute) !== -1 && value !== undefined) { // transform integer 0,1 into boolean
      value = !!value
    }

    var has = (function(o) {
      var predef = Object.getOwnPropertyDescriptor(o, attribute);

      if (predef && predef.hasOwnProperty('value')) {
        return true // true here means 'this property exist as a simple value property, do not place setters or getters at all'
      }

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
      this.__defineSetter__(attribute, has.set || function(v) {
        if (Utils.hasChanged(this.dataValues[attribute], v)) {
          //Only dirty the object if the change is not due to id, touchedAt, createdAt or updatedAt being initiated
          var updatedAtAttr = Utils._.underscoredIf(this.__options.updatedAt, this.__options.underscored)
            , createdAtAttr = Utils._.underscoredIf(this.__options.createdAt, this.__options.underscored)
            , touchedAtAttr = Utils._.underscoredIf(this.__options.touchedAt, this.__options.underscored)

          if (this.dataValues[attribute] || (attribute != 'id' && attribute != touchedAtAttr && attribute != createdAtAttr && attribute != updatedAtAttr)) {
            this.isDirty = true
          }
        }
        this.dataValues[attribute] = v
      });
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
        defaults[Utils._.underscoredIf(this.__options.createdAt, this.__options.underscored)] = Utils.now(this.sequelize.options.dialect)
        defaults[Utils._.underscoredIf(this.__options.updatedAt, this.__options.underscored)] = Utils.now(this.sequelize.options.dialect)

        if (this.__options.paranoid) {
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
