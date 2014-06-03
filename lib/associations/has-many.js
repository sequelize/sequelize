'use strict';

var Utils = require('./../utils')
  , Helpers = require('./helpers')
  , _ = require('lodash')
  , Transaction = require('../transaction');

var HasManySingleLinked = require('./has-many-single-linked')
  , HasManyDoubleLinked = require('./has-many-double-linked');

module.exports = (function() {
  var HasMany = function(source, target, options) {
    var self = this;

    this.associationType = 'HasMany';
    this.source = source;
    this.target = target;
    this.targetAssociation = null;
    this.options = options;
    this.sequelize = source.daoFactoryManager.sequelize;
    this.through = options.through;
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
      this.foreignKey = this.foreignKeyAttribute.fieldName;
    } else {
      this.foreignKeyAttribute = {};
      this.foreignKey = this.options.foreignKey;
    }

    /*
     * Map joinTableModel/Name to through for BC
     */
    if (this.through === undefined) {
      this.through = this.options.joinTableModel || this.options.joinTableName;

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

    /*
     * Determine associationAccessor, especially for include options to identify the correct model
     */

    this.associationAccessor = this.as;
    if (!this.associationAccessor) {
      if (typeof this.through === 'string') {
        this.associationAccessor = this.through;
      } else if (Object(this.through) === this.through) {
        this.associationAccessor = this.through.tableName;
      } else {
        this.associationAccessor = this.combinedTableName;
      }
    }

    /*
     * If self association, this is the target association - Unless we find a pairing association
     */
    if (this.isSelfAssociation) {
      // check 'as' is defined for many-to-many self-association
      if (this.through && this.through !== true && !this.as) {
        throw new Error('\'as\' must be defined for many-to-many self-associations');
      }

      this.targetAssociation = this;
    }

    /*
     * Else find partner DAOFactory if present, to identify double linked association
     */
    if (this.through) {
      _.each(this.target.associations, function(association, accessor) {
        if (self.source === association.target) {
          var paired;

          // If through is default, we determine pairing by the accesor value (i.e. DAOFactory's using as won't pair, but regular ones will)
          if (self.through === true) {
            paired = accessor === self.associationAccessor;
          }
          // If through is not default, determine pairing by through value (model/string)
          else {
            paired = self.options.through === association.options.through;
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
    if (this.doubleLinked && this.through === true) {
      this.through = this.combinedTableName;
    }

    if (typeof this.through === 'string') {
      this.through = this.sequelize.define(this.through, {}, _.extend(this.options, {
        tableName: this.through,
        paranoid: false  // A paranoid join table does not make sense
      }));

      if (this.targetAssociation) {
        this.targetAssociation.through = this.through;
      }
    }

    this.options.tableName = this.combinedName = (this.through === Object(this.through) ? this.through.tableName : this.through);

    if (this.as) {
      this.isAliased = true;
    } else {
      this.as = Utils.pluralize(this.target.name, this.target.options.language);
    }

    this.accessors = {
      get: Utils._.camelize('get_' + this.as),
      set: Utils._.camelize('set_' + this.as),
      addMultiple: Utils._.camelize('add_' + this.as, this.target.options.language),
      add: Utils._.camelize(Utils.singularize('add_' + this.as, this.target.options.language)),
      create: Utils._.camelize(Utils.singularize('create_' + this.as, this.target.options.language)),
      remove: Utils._.camelize(Utils.singularize('remove_' + this.as, this.target.options.language)),
      hasSingle: Utils._.camelize(Utils.singularize('has_' + this.as, this.target.options.language)),
      hasAll: Utils._.camelize('has_' + this.as)
    };
  };

  // the id is in the target table
  // or in an extra table which connects two tables
  HasMany.prototype.injectAttributes = function() {
    var doubleLinked = this.doubleLinked
      , self = this
      , primaryKeyDeleted = false;
 
    this.identifier = this.foreignKey || Utils._.camelizeIf(
      [
        Utils._.underscoredIf(Utils.singularize(this.source.name, this.source.options.language), this.source.options.underscored),
        this.source.primaryKeyAttribute
      ].join('_'),
      !this.source.options.underscored
    );

    // is there already a single sided association between the source and the target?
    // or is the association on the model itself?
    if ((this.isSelfAssociation && Object(this.through) === this.through) || doubleLinked) {
      // We need to remove the keys that 1:M have added
      if (this.isSelfAssociation && doubleLinked) {
        if (self.through.rawAttributes[this.targetAssociation.identifier]
            && self.through.rawAttributes[this.targetAssociation.identifier]._autoGenerated) {
          delete self.through.rawAttributes[this.targetAssociation.identifier];
        }
        if (self.through.rawAttributes[this.targetAssociation.foreignIdentifier]
            && self.through.rawAttributes[this.targetAssociation.foreignIdentifier]._autoGenerated) {
          delete self.through.rawAttributes[this.targetAssociation.foreignIdentifier];
        }
      }

      this.foreignIdentifier = this.targetAssociation.identifier;
      this.targetAssociation.foreignIdentifier = this.identifier;

      if (isForeignKeyDeletionAllowedFor.call(this, this.source, this.foreignIdentifier)) {
        delete this.source.rawAttributes[this.foreignIdentifier];
      }

      if (this.isSelfAssociation && this.foreignIdentifier === this.identifier) {
        this.foreignIdentifier = Utils._.camelizeIf(
          [Utils.singularize(this.as, this.source.options.language), this.source.primaryKeyAttribute].join('_'),
          !this.source.options.underscored
        );

        if (doubleLinked) {
          this.targetAssociation.identifier = this.foreignIdentifier;
        }
      }

      // remove any PKs previously defined by sequelize
      Utils._.each(this.through.rawAttributes, function(attribute, attributeName) {
        if (attribute.primaryKey === true && attribute._autoGenerated === true) {
          delete self.through.rawAttributes[attributeName];
          primaryKeyDeleted = true;
        }
      });

      // define a new model, which connects the models
      var sourceKeyType = this.source.rawAttributes[this.source.primaryKeyAttribute].type
        , targetKeyType = this.target.rawAttributes[this.target.primaryKeyAttribute].type
        , sourceAttribute = Utils._.defaults(this.foreignKeyAttribute, { type: sourceKeyType })
        , targetAttribute = Utils._.defaults(this.targetAssociation.foreignKeyAttribute, { type: targetKeyType });

      if (this.options.constraints !== false) {
        sourceAttribute.references = this.source.getTableName();
        sourceAttribute.referencesKey = this.source.primaryKeyAttribute;
        sourceAttribute.onDelete = this.options.onDelete || 'CASCADE';
        sourceAttribute.onUpdate = this.options.onUpdate || 'CASCADE';
      }
      if (this.targetAssociation.options.constraints !== false) {
        targetAttribute.references = this.target.getTableName();
        targetAttribute.referencesKey = this.target.primaryKeyAttribute;
        targetAttribute.onDelete = this.targetAssociation.options.onDelete || 'CASCADE';
        targetAttribute.onUpdate = this.targetAssociation.options.onUpdate || 'CASCADE';
      }

      if (primaryKeyDeleted) {
        targetAttribute.primaryKey = sourceAttribute.primaryKey = true;
      } else {
        var uniqueKey = [this.through.tableName, this.identifier, this.foreignIdentifier, 'unique'].join('_');
        targetAttribute.unique = sourceAttribute.unique = uniqueKey;
      }

      if (!this.through.rawAttributes[this.identifier]) {
        this.through.rawAttributes[this.identifier] = {
          _autoGenerated: true
        };
      }

      if (!this.through.rawAttributes[this.foreignIdentifier]) {
        this.through.rawAttributes[this.foreignIdentifier] = {
          _autoGenerated: true
        };
      }

      this.through.rawAttributes[this.identifier] = Utils._.extend(this.through.rawAttributes[this.identifier], sourceAttribute);
      this.through.rawAttributes[this.foreignIdentifier] = Utils._.extend(this.through.rawAttributes[this.foreignIdentifier], targetAttribute);

      this.through.init(this.through.daoFactoryManager);
    } else {
      var newAttributes = {};
      var constraintOptions = _.clone(this.options); // Create a new options object for use with addForeignKeyConstraints, to avoid polluting this.options in case it is later used for a n:m
      newAttributes[this.identifier] = _.defaults(this.foreignKeyAttribute, { type: this.options.keyType || this.source.rawAttributes[this.source.primaryKeyAttribute].type });

      if (this.options.constraints !== false) {
        constraintOptions.onDelete = constraintOptions.onDelete || 'SET NULL';
        constraintOptions.onUpdate = constraintOptions.onUpdate || 'CASCADE';
      }
      Helpers.addForeignKeyConstraints(newAttributes[this.identifier], this.source, this.target, constraintOptions);
      Utils._.defaults(this.target.rawAttributes, newAttributes);
    }

    // Sync attributes and setters/getters to DAO prototype
    this.target.refreshAttributes();
    this.source.refreshAttributes();

    if (this.source.rawAttributes.hasOwnProperty(this.as)) {
      throw new Error("Naming collision between attribute '" + this.as + "' and association '" + this.as + "' on model " + this.source.name + '. To remedy this, change either foreignKey or as in your association definition');
    }

    return this;
  };

  HasMany.prototype.injectGetter = function(obj) {
    var association = this;

    obj[this.accessors.get] = function(options, queryOptions) {
      options = options || {};
      queryOptions = queryOptions || {};
      var Class = Object(association.through) === association.through ? HasManyDoubleLinked : HasManySingleLinked;
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

      return instance[association.accessors.get]({
        transaction: (additionalAttributes || {}).transaction
      }).then(function(oldAssociatedObjects) {
        var Class = Object(association.through) === association.through ? HasManyDoubleLinked : HasManySingleLinked;
        return new Class(association, instance).injectSetter(oldAssociatedObjects, newAssociatedObjects, additionalAttributes);
      });
    };

    obj[this.accessors.add] = function(newInstance, additionalAttributes) {
      // If newInstance is null or undefined, no-op
      if (!newInstance) return Utils.Promise.resolve();

      var instance = this
        , primaryKeyAttribute = association.target.primaryKeyAttribute;

      if (!(newInstance instanceof association.target.Instance)) {
        var tmpInstance = {};
        tmpInstance[primaryKeyAttribute] = newInstance;
        newInstance = association.target.build(tmpInstance, {
          isNewRecord: false
        });
      }

      if (Array.isArray(newInstance)) {
        return obj[association.accessors.addMultiple](newInstance, additionalAttributes);
      } else {
        return instance[association.accessors.get]({
          where: newInstance.primaryKeyValues,
          transaction: (additionalAttributes || {}).transaction
        }).then(function(currentAssociatedObjects) {
          if (currentAssociatedObjects.length === 0 || Object(association.through) === association.through) {
            var Class = Object(association.through) === association.through ? HasManyDoubleLinked : HasManySingleLinked;
            return new Class(association, instance).injectAdder(newInstance, additionalAttributes, !!currentAssociatedObjects.length);
          } else {
            return Utils.Promise.resolve(currentAssociatedObjects[0]);
          }
        });
      }
    };

    obj[this.accessors.addMultiple] = function(newInstances, additionalAttributes) {
      var primaryKeyAttribute = association.target.primaryKeyAttribute;

      newInstances = newInstances.map(function(newInstance) {
        if (!(newInstance instanceof association.target.Instance)) {
          var tmpInstance = {};
          tmpInstance[primaryKeyAttribute] = newInstance;
          return association.target.build(tmpInstance, {
            isNewRecord: false
          });
        }
        return newInstance;
      });

      var Class = Object(association.through) === association.through ? HasManyDoubleLinked : HasManySingleLinked;
      return new Class(association, this).injectSetter([], newInstances, additionalAttributes);
    };


    obj[this.accessors.remove] = function(oldAssociatedObject, options) {
      var instance = this;
      return instance[association.accessors.get]({
        transaction: (options || {}).transaction
      }).then(function(currentAssociatedObjects) {
        var newAssociations = [];

        currentAssociatedObjects.forEach(function(association) {
          if (!Utils._.isEqual(oldAssociatedObject.identifiers, association.identifiers)) {
            newAssociations.push(association);
          }
        });

        return instance[association.accessors.set](newAssociations);
      });
    };

    return this;
  };

  HasMany.prototype.injectCreator = function(obj) {
    var association = this;

    obj[this.accessors.create] = function(values, fieldsOrOptions) {
      var instance = this
        , options = {};

      if (values === undefined) {
        values = {};
      }

      if ((fieldsOrOptions || {}).transaction instanceof Transaction) {
        options.transaction = fieldsOrOptions.transaction;
      }

      if (Object(association.through) === association.through) {
        // Create the related model instance
        return association.target.create(values, fieldsOrOptions).then(function(newAssociatedObject) {
          return instance[association.accessors.add](newAssociatedObject, options).return(newAssociatedObject);
        });
      } else {
        values[association.identifier] = instance.get(association.source.primaryKeyAttribute);
        return association.target.create(values, fieldsOrOptions);
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
