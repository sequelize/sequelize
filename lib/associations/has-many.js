'use strict';

var Utils = require('./../utils')
  , Helpers = require('./helpers')
  , _ = require('lodash')
  , Association = require('./base')
  , Transaction = require('../transaction')
  , Model = require('../model')
  , CounterCache = require('../plugins/counter-cache')
  , deprecatedSeen = {}
  , deprecated = function(message) {
    if (deprecatedSeen[message]) return;
    console.warn(message);
    deprecatedSeen[message] = true;
  };

var HasManySingleLinked = require('./has-many-single-linked')
  , HasManyDoubleLinked = require('./has-many-double-linked');

module.exports = (function() {
  var HasMany = function(source, target, options) {
    Association.call(this);
    var self = this;

    this.associationType = 'HasMany';
    this.source = source;
    this.target = target;
    this.targetAssociation = null;
    this.options = options || {};
    this.sequelize = source.daoFactoryManager.sequelize;
    this.through = options.through;
    this.scope = options.scope;
    this.isMultiAssociation = true;
    this.isSelfAssociation = this.source === this.target;
    this.doubleLinked = false;
    this.as = this.options.as;
    this.combinedTableName = Utils.combineTableNames(
      this.source.tableName,
      this.isSelfAssociation ? (this.as || this.target.tableName) : this.target.tableName
    );

    if (Utils._.isObject(this.options.foreignKey)) {
      this.foreignKeyAttribute = this.options.foreignKey;
      this.foreignKey = this.foreignKeyAttribute.name || this.foreignKeyAttribute.fieldName;
    } else {
      this.foreignKeyAttribute = {};
      this.foreignKey = this.options.foreignKey;
    }

    /*
     * Map joinTableModel/Name to through for BC
     */
    if (this.through === undefined) {
      this.through = this.options.through = this.options.joinTableModel || this.options.joinTableName;

      /*
       * If both are undefined, see if useJunctionTable was false (for self associations) - else assume through to be true
       */
      if (this.through === undefined) {
        if (this.options.useJunctionTable === false) {
          this.through = null;
        } else {
          this.through = true;
        }
      }
    }

    if (this.through !== null && !this.through.model) {
      this.through = {
        model: this.through
      };
    }

    /*
     * Determine associationAccessor, especially for include options to identify the correct model
     */

    this.associationAccessor = this.as;
    if (!this.associationAccessor) {
      if (typeof this.through.model === 'string') {
        this.associationAccessor = this.through.model;
      } else if (Object(this.through.model) === this.through.model) {
        this.associationAccessor = this.through.model.tableName;
      } else {
        this.associationAccessor = this.combinedTableName;
      }
    }

    /*
     * If self association, this is the target association - Unless we find a pairing association
     */
    if (this.isSelfAssociation) {
      // check 'as' is defined for many-to-many self-association
      if (this.through && this.through.model !== true && !this.as) {
        throw new Error('\'as\' must be defined for many-to-many self-associations');
      }

      this.targetAssociation = this;
    }

    /*
     * Else find partner DAOFactory if present, to identify double linked association
     */
    if (this.through) {
      _.each(this.target.associations, function(association, accessor) {
        if (self.source === association.target && association.associationType === 'HasMany') {
          var paired;

          // If through is default, we determine pairing by the accesor value (i.e. DAOFactory's using as won't pair, but regular ones will)
          if (self.through.model === true) {
            paired = accessor === self.associationAccessor;
          }
          // If through is not default, determine pairing by through value (model/string)
          else if (association.options.through) {
            paired = (self.options.through === association.options.through) ||
                     (self.options.through === association.options.through.model) ||
                     (self.options.through.model && association.options.through.model && (self.options.through.model === association.options.through.model)) ||
                     (self.options.through.model === association.options.through);
          }
          // If paired, set properties identifying both associations as double linked, and allow them to each eachtoerh
          if (paired) {
            self.doubleLinked = true;
            association.doubleLinked = true;

            self.targetAssociation = association;
            association.targetAssociation = self;
          }
        }
      });
    }

    /*
     * If we are double linked, and through is either default or a string, we create the through model and set it on both associations
     */
    if (this.doubleLinked && this.through.model === true) {
      this.through.model = this.combinedTableName;
    }

    if (typeof this.through.model === 'string') {
      this.through.model = this.sequelize.define(this.through.model, {}, _.extend(this.options, {
        tableName: this.through.model,
        indexes: {}, //we dont want indexes here (as referenced in #2416)
        paranoid: false  // A paranoid join table does not make sense
      }));

      if (this.targetAssociation) {
        this.targetAssociation.through.model = this.through.model;
      }
    }

    if (this.through) {
      this.throughModel = this.through.model;
    }

    this.options.tableName = this.combinedName = (this.through.model === Object(this.through.model) ? this.through.model.tableName : this.through.model);

    if (this.as) {
      this.isAliased = true;

      if (Utils._.isPlainObject(this.as)) {
        this.options.name = this.as;
        this.as = this.as.plural;
      } else {
        this.options.name = {
          plural: this.as,
          singular: Utils.singularize(this.as)
        };
      }
    } else {
      this.as = this.target.options.name.plural;
      this.options.name = this.target.options.name;
    }

    // Get singular and plural names, trying to uppercase the first letter, unless the model forbids it
    var plural = Utils.uppercaseFirst(this.options.name.plural)
      , singular = Utils.uppercaseFirst(this.options.name.singular);

    this.accessors = {
      get: 'get' + plural,
      set: 'set' + plural,
      addMultiple: 'add' + plural,
      add: 'add' + singular,
      create: 'create' + singular,
      remove: 'remove' + singular,
      removeMultiple: 'remove' + plural,
      hasSingle: 'has' + singular,
      hasAll: 'has' + plural
    };

    if (this.options.counterCache) {
      new CounterCache(this, this.options.counterCache !== true ? this.options.counterCache : {});
    }
  };

  // the id is in the target table
  // or in an extra table which connects two tables
  HasMany.prototype.injectAttributes = function() {
    var doubleLinked = this.doubleLinked
      , self = this;

    this.identifier = this.foreignKey || Utils._.camelizeIf(
      [
        Utils._.underscoredIf(this.source.options.name.singular, this.source.options.underscored),
        this.source.primaryKeyAttribute
      ].join('_'),
      !this.source.options.underscored
    );

    // is there already a single sided association between the source and the target?
    // or is the association on the model itself?
    if ((this.isSelfAssociation && Object(this.through.model) === this.through.model) || doubleLinked) {
      deprecated('Using 2 x hasMany to represent N:M relations has been deprecated. Please use belongsToMany instead');

      // We need to remove the keys that 1:M have added
      if (this.isSelfAssociation && doubleLinked) {
        if (self.through.model.rawAttributes[this.targetAssociation.identifier]
            && self.through.model.rawAttributes[this.targetAssociation.identifier]._autoGenerated) {
          delete self.through.model.rawAttributes[this.targetAssociation.identifier];
        }
        if (self.through.model.rawAttributes[this.targetAssociation.foreignIdentifier]
            && self.through.model.rawAttributes[this.targetAssociation.foreignIdentifier]._autoGenerated) {
          delete self.through.model.rawAttributes[this.targetAssociation.foreignIdentifier];
        }
      }

      this.foreignIdentifier = this.targetAssociation.identifier;
      this.targetAssociation.foreignIdentifier = this.identifier;

      if (isForeignKeyDeletionAllowedFor.call(this, this.source, this.foreignIdentifier)) {
        delete this.source.rawAttributes[this.foreignIdentifier];
      }

      if (this.isSelfAssociation && this.foreignIdentifier === this.identifier) {
        this.foreignIdentifier = Utils._.camelizeIf(
          [this.options.name.singular, this.source.primaryKeyAttribute].join('_'),
          !this.source.options.underscored
        );

        if (doubleLinked) {
          this.targetAssociation.identifier = this.foreignIdentifier;
        }
      }

      // remove any PKs previously defined by sequelize
      Utils._.each(this.through.model.rawAttributes, function(attribute, attributeName) {
        if (attribute.primaryKey === true && attribute._autoGenerated === true) {
          delete self.through.model.rawAttributes[attributeName];
          self.targetAssociation.primaryKeyDeleted = true;
        }
      });

      // define a new model, which connects the models
      var sourceKey = this.source.rawAttributes[this.source.primaryKeyAttribute]
        , sourceKeyType = sourceKey.type
        , sourceKeyField = sourceKey.field || this.source.primaryKeyAttribute
        , targetKey = this.target.rawAttributes[this.target.primaryKeyAttribute]
        , targetKeyType = targetKey.type
        , targetKeyField = targetKey.field || this.target.primaryKeyAttribute
        , sourceAttribute = Utils._.defaults(this.foreignKeyAttribute, { type: sourceKeyType })
        , targetAttribute = Utils._.defaults(this.targetAssociation.foreignKeyAttribute, { type: targetKeyType });

      if (this.options.constraints !== false) {
        sourceAttribute.references = this.source.getTableName();
        sourceAttribute.referencesKey = sourceKeyField;
        sourceAttribute.onDelete = this.options.onDelete || 'CASCADE';
        sourceAttribute.onUpdate = this.options.onUpdate || 'CASCADE';
      }
      if (this.targetAssociation.options.constraints !== false) {
        targetAttribute.references = this.target.getTableName();
        targetAttribute.referencesKey = targetKeyField;
        targetAttribute.onDelete = this.targetAssociation.options.onDelete || 'CASCADE';
        targetAttribute.onUpdate = this.targetAssociation.options.onUpdate || 'CASCADE';
      }

      if (this.targetAssociation.primaryKeyDeleted === true) {
        targetAttribute.primaryKey = sourceAttribute.primaryKey = true;
      } else if (this.through.unique !== false) {
        var uniqueKey = [this.through.model.tableName, this.identifier, this.foreignIdentifier, 'unique'].join('_');
        targetAttribute.unique = sourceAttribute.unique = uniqueKey;
      }

      if (!this.through.model.rawAttributes[this.identifier]) {
        this.through.model.rawAttributes[this.identifier] = {
          _autoGenerated: true
        };
      }

      if (!this.through.model.rawAttributes[this.foreignIdentifier]) {
        this.through.model.rawAttributes[this.foreignIdentifier] = {
          _autoGenerated: true
        };
      }

      this.through.model.rawAttributes[this.identifier] = Utils._.extend(this.through.model.rawAttributes[this.identifier], sourceAttribute);
      this.through.model.rawAttributes[this.foreignIdentifier] = Utils._.extend(this.through.model.rawAttributes[this.foreignIdentifier], targetAttribute);

      this.identifierField = this.through.model.rawAttributes[this.identifier].field || this.identifier;
      this.foreignIdentifierField = this.through.model.rawAttributes[this.foreignIdentifier].field || this.foreignIdentifier;

      if (this.targetAssociation.identifier) {
        this.targetAssociation.identifierField = this.through.model.rawAttributes[this.targetAssociation.identifier].field || this.targetAssociation.identifier;
      }
      if (this.targetAssociation.foreignIdentifier) {
        this.targetAssociation.foreignIdentifierField = this.through.model.rawAttributes[this.targetAssociation.foreignIdentifier].field || this.targetAssociation.foreignIdentifier;
      }
      this.through.model.init(this.through.model.daoFactoryManager);
    } else {
      var newAttributes = {};
      var constraintOptions = _.clone(this.options); // Create a new options object for use with addForeignKeyConstraints, to avoid polluting this.options in case it is later used for a n:m
      newAttributes[this.identifier] = _.defaults(this.foreignKeyAttribute, { type: this.options.keyType || this.source.rawAttributes[this.source.primaryKeyAttribute].type });

      if (this.options.constraints !== false) {
        constraintOptions.onDelete = constraintOptions.onDelete || 'SET NULL';
        constraintOptions.onUpdate = constraintOptions.onUpdate || 'CASCADE';
      }
      Helpers.addForeignKeyConstraints(newAttributes[this.identifier], this.source, this.target, constraintOptions);
      Utils.mergeDefaults(this.target.rawAttributes, newAttributes);

      this.identifierField = this.target.rawAttributes[this.identifier].field || this.identifier;
    }

    // Sync attributes and setters/getters to DAO prototype
    this.target.refreshAttributes();
    this.source.refreshAttributes();

    Helpers.checkNamingCollision(this);

    return this;
  };

  HasMany.prototype.injectGetter = function(obj) {
    var association = this;

    obj[this.accessors.get] = function(options, queryOptions) {
      options = association.target.__optClone(options) || {};
      queryOptions = queryOptions || {};
      var Class = Object(association.through.model) === association.through.model ? HasManyDoubleLinked : HasManySingleLinked;
      return new Class(association, this).injectGetter(options, queryOptions);
    };

    obj[this.accessors.hasAll] = function(instances, options) {
      var instance = this
        , where;

      options = options || {};

      instances.forEach(function(instance) {
        if (instance instanceof association.target.Instance) {
          where = new Utils.or([where, instance.primaryKeyValues]);
        } else {
          var _where = {};
          _where[association.target.primaryKeyAttribute] = instance;
          where = new Utils.or([where, _where]);
        }
      });

      options.where = new Utils.and([
        where,
        options.where
      ]);

      return instance[association.accessors.get](
        options,
        { raw: true }
      ).then(function(associatedObjects) {
        return associatedObjects.length === instances.length;
      });
    };

    obj[this.accessors.hasSingle] = function(param, options) {
      var instance = this
        , where;

      options = options || {};

      if (param instanceof association.target.Instance) {
        where = param.primaryKeyValues;
      } else {
        where = {};
        where[association.target.primaryKeyAttribute] = param;
      }

      options.where = new Utils.and([
        where,
        options.where
      ]);

      return instance[association.accessors.get](
        options,
        { raw: true }
      ).then(function(associatedObjects) {
        return associatedObjects.length !== 0;
      });
    };
    return this;
  };

  HasMany.prototype.injectSetter = function(obj) {
    var association = this
      , primaryKeyAttribute = association.target.primaryKeyAttribute;

    obj[this.accessors.set] = function(newAssociatedObjects, additionalAttributes) {
      if (newAssociatedObjects === null) {
        newAssociatedObjects = [];
      } else {
        newAssociatedObjects = newAssociatedObjects.map(function(newAssociatedObject) {
          if (!(newAssociatedObject instanceof association.target.Instance)) {
            var tmpInstance = {};
            tmpInstance[primaryKeyAttribute] = newAssociatedObject;
            return association.target.build(tmpInstance, {
              isNewRecord: false
            });
          }
          return newAssociatedObject;
        });
      }

      var instance = this;

      return instance[association.accessors.get]({}, {
        transaction: (additionalAttributes || {}).transaction
      }).then(function(oldAssociatedObjects) {
        var Class = Object(association.through.model) === association.through.model ? HasManyDoubleLinked : HasManySingleLinked;
        return new Class(association, instance).injectSetter(oldAssociatedObjects, newAssociatedObjects, additionalAttributes);
      });
    };

    obj[this.accessors.addMultiple] = obj[this.accessors.add] = function(newInstance, additionalAttributes) {
      // If newInstance is null or undefined, no-op
      if (!newInstance) return Utils.Promise.resolve();

      var instance = this
        , primaryKeyAttribute = association.target.primaryKeyAttribute;

      additionalAttributes = additionalAttributes || {};
      if (association.through && association.through.scope) {
        Object.keys(association.through.scope).forEach(function (attribute) {
          additionalAttributes[attribute] = association.through.scope[attribute];
        });
      }

      if (Array.isArray(newInstance)) {
        var newInstances = newInstance.map(function(newInstance) {
          if (!(newInstance instanceof association.target.Instance)) {
            var tmpInstance = {};
            tmpInstance[primaryKeyAttribute] = newInstance;
            return association.target.build(tmpInstance, {
              isNewRecord: false
            });
          }
          return newInstance;
        });

        var Class = Object(association.through.model) === association.through.model ? HasManyDoubleLinked : HasManySingleLinked;
        return new Class(association, this).injectSetter([], newInstances, additionalAttributes);
      } else {
        if (!(newInstance instanceof association.target.Instance)) {
          var tmpInstance = {};
          tmpInstance[primaryKeyAttribute] = newInstance;
          newInstance = association.target.build(tmpInstance, {
            isNewRecord: false
          });
        }

        return instance[association.accessors.get]({
          where: newInstance.primaryKeyValues
        }, {
          transaction: (additionalAttributes || {}).transaction
        }).then(function(currentAssociatedObjects) {
          if (currentAssociatedObjects.length === 0 || Object(association.through.model) === association.through.model) {
            var Class = Object(association.through.model) === association.through.model ? HasManyDoubleLinked : HasManySingleLinked;
            return new Class(association, instance).injectAdder(newInstance, additionalAttributes, !!currentAssociatedObjects.length);
          } else {
            return Utils.Promise.resolve(currentAssociatedObjects[0]);
          }
        });
      }
    };

    obj[this.accessors.remove] = function(oldAssociatedObject, options) {
      var instance = this;
      return instance[association.accessors.get]({}, options).then(function(currentAssociatedObjects) {
        var newAssociations = [];

        if (!(oldAssociatedObject instanceof association.target.Instance)) {
          var tmpInstance = {};
          tmpInstance[primaryKeyAttribute] = oldAssociatedObject;
          oldAssociatedObject = association.target.build(tmpInstance, {
            isNewRecord: false
          });
        }

        currentAssociatedObjects.forEach(function(association) {
          if (!Utils._.isEqual(oldAssociatedObject.identifiers, association.identifiers)) {
            newAssociations.push(association);
          }
        });

        return instance[association.accessors.set](newAssociations, options);
      });
    };

    obj[this.accessors.removeMultiple] = function(oldAssociatedObjects, options) {
      var instance = this;
      return instance[association.accessors.get]({}, options).then(function(currentAssociatedObjects) {
        var newAssociations = [];

        // Ensure the oldAssociatedObjects array is an array of target instances
        oldAssociatedObjects = oldAssociatedObjects.map(function(oldAssociatedObject) {
          if (!(oldAssociatedObject instanceof association.target.Instance)) {
            var tmpInstance = {};
            tmpInstance[primaryKeyAttribute] = oldAssociatedObject;
            oldAssociatedObject = association.target.build(tmpInstance, {
              isNewRecord: false
            });
          }
          return oldAssociatedObject;
        });

        currentAssociatedObjects.forEach(function(association) {

          // Determine is this is an association we want to remove
          var obj = Utils._.find(oldAssociatedObjects, function(oldAssociatedObject) {
            return Utils._.isEqual(oldAssociatedObject.identifiers, association.identifiers);
          });

          // This is not an association we want to remove. Add it back
          // to the set of associations we will associate our instance with
          if (!obj) {
            newAssociations.push(association);
          }
        });

        return instance[association.accessors.set](newAssociations, options);
      });
    };

    return this;
  };

  HasMany.prototype.injectCreator = function(obj) {
    var association = this;

    obj[this.accessors.create] = function(values, options) {
      var instance = this;
      options = options || {};

      if (Array.isArray(options)) {
        options = {
          fields: options
        };
      }

      if (values === undefined) {
        values = {};
      }

      if (association.scope) {
        Object.keys(association.scope).forEach(function (attribute) {
          values[attribute] = association.scope[attribute];
          if (options.fields) options.fields.push(attribute);
        });
      }

      if (Object(association.through.model) === association.through.model) {
        // Create the related model instance
        return association.target.create(values, options).then(function(newAssociatedObject) {
          return instance[association.accessors.add](newAssociatedObject, _.omit(options, ['fields'])).return(newAssociatedObject);
        });
      } else {
        values[association.identifier] = instance.get(association.source.primaryKeyAttribute);
        if (options.fields) options.fields.push(association.identifier);
        return association.target.create(values, options);
      }
    };

    return this;
  };

  /**
   * The method checks if it is ok to delete the previously defined foreign key.
   * This is done because we need to keep the foreign key if another association
   * is depending on it.
   *
   * @param  {DaoFactory}  daoFactory The source or target DaoFactory of this association
   * @param  {[type]}  identifier     The name of the foreign key identifier
   * @return {Boolean}                Whether or not the deletion of the foreign key is ok.
   */
  var isForeignKeyDeletionAllowedFor = function(daoFactory, identifier) {
    var isAllowed = true
      , associationNames = Utils._.without(Object.keys(daoFactory.associations), this.associationAccessor);

    associationNames.forEach(function(associationName) {
      if (daoFactory.associations[associationName].identifier === identifier) {
        isAllowed = false;
      }
    });

    return isAllowed;
  };

  return HasMany;
})();
