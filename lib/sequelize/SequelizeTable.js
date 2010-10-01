/*
  A.hasOne(B)                 => B.aId
  A.belongsTo(B)              => A.bId
  A.hasMany(B)                => B.aId
  A.hasMany(B) + B.hasMany(A) => AB.aId + AB.bId
*/

exports.SequelizeTable = function(Sequelize, sequelize, tableName, attributes, options) {
  options = options || {}
  options.classMethods = options.classMethods || {}
  options.instanceMethods = options.instanceMethods || {}
  options.indexes = options.indexes || {}

  options.primaryKey = options.primaryKey || 'id';
  if (options.timestamps) { // this is added if it is not set to false.
    attributes.createdAt = { type: Sequelize.DATE, allowNull: false}
    attributes.updatedAt = { type: Sequelize.DATE, allowNull: false}
  }
  if (options['trackDelete']) {
    attributes._deleted = { type: Sequelize.BOOLEAN, allowNull: false, 'default': false}
    //if (typeof(options.primaryKey)=='string')
        //options.primaryKey=[options.primaryKey];
    //options.primaryKey.push('_deleted');
  }
  var table = function(values) {
    var self = this, defaults = {}
    // read all default values ...
    Sequelize.Helper.Hash.forEach(table.attributes, function(options, key) {
      if(typeof options.default != 'undefined') defaults[key] = options.default
    })

    // and merge them into the passed one
    Sequelize.Helper.Hash.merge(defaults, values)

    // now iterate over the values and assign them the current object
    Sequelize.Helper.Hash.forEach(values, function(value, key) {
      if(attributes[key]) {
        if(attributes[key].type.indexOf(Sequelize.BOOLEAN) > -1)
          self[key] = ((value == 1) || (value == true)) ? true : false
        else if(attributes[key].type.indexOf(Sequelize.DATE) > -1)
          self[key] = (value instanceof Date) ? value : new Date(Date.parse(value))
        else
          self[key] = value
      }
    })

    this.isNew=true;
    //this[options.primaryKey] = null // specify id as null to declare this object as unsaved and as not present in the database
    this.table = table
    this._key=[];
    this.fetchedAssociations = {}
  }

  // class methods
  var classMethods = {
    associations: [],
    attributes: attributes,
    tableName: tableName,
    indexes: options.indexes,
    primaryKey: options.primaryKey,

    prepareAssociations: function(callback) {
      table.associations.forEach(function(association) {
        var assocNameAsTableIdentifier = Sequelize.Helper.SQL.asTableIdentifier(association.name)

        switch(association.type) {
          case 'hasMany':
            if(association.backAssociationName) {
              // many to many relation
              var _attributes = {}
              _attributes[assocNameAsTableIdentifier] = Sequelize.INTEGER
              _attributes[Sequelize.Helper.SQL.asTableIdentifier(association.backAssociationName)] = Sequelize.INTEGER
              sequelize.define(Sequelize.Helper.SQL.manyToManyTableName(association.name, association.backAssociationName), _attributes)
            } else {
              // one to many relation
              association.table.attributes[assocNameAsTableIdentifier] = {type: Sequelize.INTEGER}
            }
            break
          case 'hasAndBelongsToMany':
            var _attributes = {}
            _attributes[assocNameAsTableIdentifier] = Sequelize.INTEGER
            _attributes[Sequelize.Helper.SQL.asTableIdentifier(association.table.tableName)] = Sequelize.INTEGER
            sequelize.define(Sequelize.Helper.SQL.manyToManyTableName(association.name, association.table.tableName), _attributes)
            break
          case 'hasOne':
            // adds the foreign key to the associated table
            // e.g. assocTable.myTableId = Sequelize.INTEGER
            association.table.attributes[assocNameAsTableIdentifier] = {type: Sequelize.INTEGER}
            break
          case 'belongsTo':
            // adds the foreign key to me
            // e.g. table.dayId = Sequelize.INTEGER
            table.attributes[assocNameAsTableIdentifier] = {type: Sequelize.INTEGER}
            break
        }
      })
      if(callback) callback()
    },

    /* returns: table, error */
    sync: function(callback) {
      if (this.historyTable) this.historyTable.sync();
      var fields = [];
      if (typeof (table.primaryKey) == 'string')
        if (typeof (attributes[table.primaryKey]) == 'undefined')
          fields.unshift(table.primaryKey+" INT NOT NULL auto_increment");
      Sequelize.Helper.Hash.forEach(table.attributes, function(options, name) {
        var type=options.type;
        if (options.type===Sequelize.STRING) {
          type+= "("+(options.size||255)+")";
        }
        if (options.autoIncrement) type+=' auto_increment';
// TODO: Allow more complex options on index definition. See: http://dev.mysql.com/doc/refman/5.1/en/create-table.html
        if (table.indexes[name])
          type+=", INDEX "+tableName+"_"+name+"_idx ("+name+")";
        fields.push(name + " " + type)
      })
      // Allow multiple column primary key.
      if (typeof(table.primaryKey)=='object')
        pk=table.primaryKey.join(",");
      else pk=table.primaryKey;
      if (options['trackDelete'])
          pk+=",_deleted";
      fields.push('PRIMARY KEY('+pk+')');
      sequelize.query(
        Sequelize.sqlQueryFor( 'create', { table: table.tableName, fields: fields.join(', ')} ),
        function(_, _, err) { if(callback) callback(table, err) }
      )
    },

    drop: function(callback) {
      if (this.historyTable) this.historyTable.drop();
      sequelize.query(
        Sequelize.sqlQueryFor('drop', { table: table.tableName }),
        function(_, _, err) { if(callback) callback(table, err) }
      )
    },

    findAll: function(queryOptions, callback) {
      // use the first param as callback if it is no object (hash)
      var _callback = ((typeof queryOptions == 'function') ? queryOptions : callback)
      queryOptions = (typeof queryOptions == 'object')
        ? Sequelize.Helper.Hash.merge(queryOptions, { table: table.tableName })
        : { table: table.tableName }

      if (options['trackDelete']) {
        queryOptions.where="_deleted = false"+(queryOptions['where']?' AND '+queryOptions['where']:'');
      }

      sequelize.query(
        Sequelize.sqlQueryFor('select', queryOptions),
        function(result) {
          var objects = result.map(function(r) { return table.sqlResultToObject(r) })
          if(queryOptions.fetchAssociations) {
            var fetchings = []
            objects.map(function(object) { fetchings.push({fetchAssociations: object}) })
            Sequelize.chainQueries(fetchings, function() {
              if(_callback) _callback(objects)
            })
          } else {
            if(_callback) _callback(objects)
          }
        }
      )
    },

    find: function(conditions, queryOptions, callback) {
      // use the second param as callback if it is no object (hash)
      var _callback = ((typeof queryOptions == 'object') ? callback : queryOptions)
      var pk = typeof(table.primaryKey)=='string'?table.primaryKey:table.primaryKey.join(',');

      if (options['trackDelete']) conditions['_deleted'] = false;
      sequelize.query(
        Sequelize.sqlQueryFor('select', {
          table: table.tableName,
          where: Sequelize.Helper.SQL.hashToWhereConditions(conditions, table.attributes),
          order: pk+' DESC',
          limit: 1
        }), function(result) {
          var _result = result[0] ? table.sqlResultToObject(result[0]) : null
          if(queryOptions.fetchAssociations && (_result != null))
            _result.fetchAssociations(function() { if (_callback) _callback(_result) })
          else
            if (_callback) _callback(_result)
        }
      )
    },

    sqlResultToObject: function(result) {
      if(typeof result == undefined) return null

      var object = new table(result)
// This is no longer necessary since we don't set this value;
     // object.id = result.id
// We do this instead.
      object.isNew=false;
      if (typeof(table.primaryKey)=='string')
        object._key[table.primaryKey] = object[table.primaryKey];
      else
      table.primaryKey.forEach(function(element){
        object._key[element]=object.attributes[element];
      });
      return object
    },

    hasAndBelongsToMany: function(assocName) {
      if(typeof assocName == 'undefined')
        throw new Error('Please specify at least an association name!')

      var association = { name: assocName, table: table, type: 'hasAndBelongsToMany' },
          Factory     = new require("./Factory").Factory(Sequelize, sequelize)

      table.associations.push(association)

      table.prototype[Sequelize.Helper.SQL.addPrefix('get', assocName)] = Factory.createManyToManyGetter(null, table, assocName, table.tableName)
      table.prototype[Sequelize.Helper.SQL.addPrefix('set', assocName)] = Factory.createManyToManySetter(table, table, assocName, table.tableName)

      return association
    },

    hasMany: function(assocName, associationTable, backAssocName) {
      if(typeof assocName == 'undefined')
        throw new Error('Please specify at least an association name!')

      if(associationTable) {
        var Factory         = new require("./Factory").Factory(Sequelize, sequelize),
            association     = { name: assocName, backAssociationName: backAssocName, table: associationTable, type: 'hasMany' },
            backAssociation = { name: backAssocName, backAssociationName: assocName, table: table, type: 'hasMany' }

        table.associations.push(association)

        if(backAssocName) {
          associationTable.associations.push(backAssociation)
          Factory.addManyToManyMethods(table, associationTable, assocName, backAssocName)
          Factory.addManyToManyMethods(associationTable, table, backAssocName, assocName)
        } else {
          Factory.addOneToManyMethods(table, associationTable, assocName)
        }

        return association
      } else {
        return this.hasAndBelongsToMany(assocName)
      }
    },

    hasManyAndBelongsTo: function(assocName, _table, backAssocName) {
      var assoc = table.hasMany(assocName, _table)
      _table.belongsTo(backAssocName || assocName, table, assoc)
    },

    hasOne: function(assocName, _table) {
      var Factory     = new require("./Factory").Factory(Sequelize, sequelize),
          association = { name: assocName, table: _table, type: 'hasOne' }

      table.associations.push(association)
      Factory.addOneToOneMethods(table, _table, assocName)

      return association
    },

    hasOneAndBelongsTo: function(assocName, _table, backAssocName) {
      var assoc = table.hasOne(assocName, _table)
      _table.belongsTo(backAssocName || assocName, table, assoc)
    },

    belongsTo: function(assocName, _table, backAssociation) {
      if(typeof backAssociation == 'undefined')
        throw new Error("Calling belongsTo with only two parameters is deprecated! Please take a look at the example in the repository!")

      // start - overwrite the association of the before defined hasOne or hasMany relation, to fit the belongsTo foreign keys
      var Factory = new require("./Factory").Factory(Sequelize, sequelize),
          isManyToManyAssociation = Sequelize.Helper.SQL.isManyToManyAssociation(backAssociation)

      delete _table.prototype[Sequelize.Helper.SQL.addPrefix('get', backAssociation.name, !isManyToManyAssociation)]
      delete _table.prototype[Sequelize.Helper.SQL.addPrefix('set', backAssociation.name, !isManyToManyAssociation)]

      if(backAssociation.type == 'hasMany')
        Factory.addOneToManyMethods(_table, table, assocName, backAssociation.name)
      else
        Factory.addOneToOneMethods(_table, table, assocName, backAssociation.name)

// TODO: check if the following line is not needed; specs r failing
      // backAssociation.name = assocName
      // end - overwrite the association of the before defined hasOne or hasMany relation, to fit the belongsTo foreign keys

      table.associations.push({ name: assocName, table: _table, type: 'belongsTo' })

      // getter
      table.prototype[Sequelize.Helper.SQL.addPrefix('get', assocName, true)] = function(callback) {
        var identifier = Sequelize.Helper.SQL.asTableIdentifier(assocName)

        if((this[identifier] == null)||(isNaN(this[identifier]))) callback([])
        else _table.find(this[identifier], callback)
      }

      // setter
      table.prototype[Sequelize.Helper.SQL.addPrefix('set', assocName, true)] = function(object, callback) {
        var self = this,
            attr = {}

        if (typeof(object.primaryKey)=='string')
          attr[Sequelize.Helper.SQL.asTableIdentifier(assocName)] = object[object.primaryKey];
        else {
          attr[Sequelize.Helper.SQL.asTableIdentifier(assocName)]
        }

        this.updateAttributes(attr, function() {
          self[Sequelize.Helper.SQL.addPrefix('get', assocName, true)](callback)
        })
      }

      return _table
    }
  }
  // don't put this into the hash!
  classMethods.identifier = Sequelize.Helper.SQL.asTableIdentifier(classMethods.tableName)

  // instance methods
  table.prototype = {
    get values() {
      var result = {}
      var self = this

      Sequelize.Helper.Hash.keys(table.attributes).forEach(function(attribute) {
        result[attribute] = (typeof self[attribute] == "undefined") ? null : self[attribute]
      })

      return result
    },

    get invalidFields() {
      var result  = [],
          self    = this

      Sequelize.Helper.Hash.forEach(table.attributes, function(options, attribute) {
        if(['createdAt', 'updatedAt'].indexOf(attribute) > -1) return

        var allowsNull = ((typeof options.allowNull == 'undefined') || (options.allowNull !== false))
        var hasDefault = (typeof options.default != 'undefined')

        if(!allowsNull && !hasDefault && (typeof self[attribute] == 'undefined'))
          result.push({ field: attribute, reason: 'The field does not allow NULL values and has no default!'})
      })

      return result
    },

    get isValid() {
      return this.invalidFields.length == 0
    },

    get isNewRecord() {
      return this.isNew;
    },

    fetchAssociations: function(callback) {
      var associatedData  = {},
          self            = this,
          setAssociatedDataAndReturn = function() {
            self.fetchedAssociations = associatedData
            if(callback) callback(self.fetchedAssociations)
          }

      if(this.table.associations.length == 0)
        setAssociatedDataAndReturn()
      else
        this.table.associations.forEach(function(association) {
          var isManyToManyAssociation = Sequelize.Helper.SQL.isManyToManyAssociation(association),
              getter = Sequelize.Helper.SQL.addPrefix('get', association.name, !isManyToManyAssociation)

          self[getter](function(objects) {
            associatedData[association.name] = objects
            if(Sequelize.Helper.Hash.keys(associatedData).length == self.table.associations.length)
              setAssociatedDataAndReturn()
          })
        })
    },

    hasFetchedAssociationFor: function(assocName) {
      return (this.fetchedAssociations && this.fetchedAssociations[assocName])
    },

    setAssociationDataFor: function(assocName, data) {
      this.fetchedAssociations[assocName] = data
    },

    getAssociationDataFor: function(assocName) {
      return this.fetchedAssociations[assocName]
    },

    save: function(callback) {
      var query = null,
          self = this

      if(!this.isValid) {
        var errorText = "The object is not valid! Invalid fields: " + Sequelize.Helper.Array.map(this.invalidFields, function(fieldHash) { return fieldHash.field }).join(", ")
        throw new Error(errorText)
      }

      if(table.attributes.updatedAt) { 
        this.updatedAt = new Date()
        if(this.isNewRecord)
          this.createdAt = new Date()
      }
      
      if(this.isNewRecord) {
        query = Sequelize.sqlQueryFor('insert', {
          table: table.tableName,
          fields: Sequelize.Helper.SQL.fieldsForInsertQuery(this),
          values: Sequelize.Helper.SQL.valuesForInsertQuery(this)
        })
      } else {
        var where;
        if (typeof(table.primaryKey)=='string')
          where=table.primaryKey+'='
           +Sequelize.Helper.SQL.transformValueByDataType(this._key[table.primaryKey],table.attributes[table.primaryKey])
        else
          where=Sequelize.Helper.Array.map(table.primaryKey,
            function(element){return element+'='+Sequelize.Helper.SQL.transformValueByDataType(this._key[element],table.attributes[element])})
                     .join(" AND ")
        query="";
        if (options['trackDelete']) {
          where+=" AND _deleted = false";
        }
        if (options.trackChanges)
          query = Sequelize.sqlQueryFor('copy', { 
            history_table: table.historyTable.tableName, 
            fields: Sequelize.Helper.SQL.fieldsForInsertQuery(this,['createdAt']),
            table: table.tableName, 
            where: where
          })+";\n";
        query+=Sequelize.sqlQueryFor('update', { 
            table: table.tableName, 
            values: Sequelize.Helper.SQL.valuesForUpdate(this),
            where: where
        })
      }

      sequelize.queryTransaction(query, function(result, stats) {
        self.isNew=false;
        if (typeof(table.primaryKey)=='string')
          self[table.primaryKey]=self._key[table.primaryKey] = self[table.primaryKey] || stats.insert_id
        else
          table.primaryKey.forEach(function(element){
            self._key[element]=self[element];
          });
        if(callback) callback(self,result,stats)
      })
    },

    updateAttributes: function(newValues, callback) {
      var self = this
/* Old 
      Sequelize.Helper.Hash.keys(table.attributes).forEach(function(attribute) {
        if(typeof newValues[attribute] != 'undefined')
          self[attribute] = newValues[attribute]
      })
*/
      Sequelize.Helper.Hash.keys(newValues).forEach(function(attribute) {
        if(typeof table.attributes[attribute] != 'undefined')
          self[attribute] = newValues[attribute]
      })

      this.save(callback)
    },

    destroy: function(callback) {
      if (options['trackDelete']) {
        this.updateAttributes({'_deleted': true},callback);
      } else {
        var where;
        if (typeof(table.primaryKey)=='string')
          where=table.primaryKey+'='
           +Sequelize.Helper.SQL.transformValueByDataType(this._key[table.primaryKey],table.attributes[table.primaryKey])
        else
          where=Sequelize.Helper.Array.map(table.primaryKey,
            function(element){return element+'='+Sequelize.Helper.SQL.transformValueByDataType(this._key[element],table.attributes[element])})
                     .join(" AND ")
        sequelize.query(
          Sequelize.sqlQueryFor('delete', { table: table.tableName, where: where }),
          callback
        )
      }
    }
  }

  // merge classMethods + passed classMethods
  Sequelize.Helper.Hash.merge(options.classMethods, classMethods)
  Sequelize.Helper.Hash.forEach(classMethods, function(method, methodName) {
    table[methodName] = method
  })

  // merge passed instanceMethods
  Sequelize.Helper.Hash.forEach(options.instanceMethods, function(method, methodName) {
    table.prototype[methodName] = method
  })

  return table
}
