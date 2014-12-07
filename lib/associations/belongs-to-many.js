'use strict';

var Utils = require('./../utils')
  , Helpers = require('./helpers')
  , _ = require('lodash')
  , Association = require('./base')
  , Transaction = require('../transaction')
  , Model = require('../model')
  , CounterCache = require('../plugins/counter-cache')
  , HasManyDoubleLinked = require('./has-many-double-linked');

module.exports = (function() {
  var BelongsToMany = function(source, target, options) {
    Association.call(this);
    var self = this;

    this.associationType = 'BelongsToMany';
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

    if (this.through === undefined) {
      this.through = true;
    }

    if (Utils._.isObject(this.options.foreignKey)) {
      this.foreignKeyAttribute = this.options.foreignKey;
      this.foreignKey = this.foreignKeyAttribute.name || this.foreignKeyAttribute.fieldName;
    } else {
      this.foreignKeyAttribute = {};
      this.foreignKey = this.options.foreignKey || Utils._.camelizeIf(
        [
          Utils._.underscoredIf(this.source.options.name.singular, this.source.options.underscored),
          this.source.primaryKeyAttribute
        ].join('_'),
        !this.source.options.underscored
      );
    }

    if (Utils._.isObject(this.options.otherKey)) {
      this.otherKeyAttribute = this.options.otherKey;
      this.otherKey = this.otherKeyAttribute.name || this.otherKeyAttribute.fieldName;
    } else {
      this.otherKeyAttribute = {};
      this.otherKey = this.options.otherKey || Utils._.camelizeIf(
        [
          Utils._.underscoredIf(this.target.options.name.singular, this.target.options.underscored),
          this.target.primaryKeyAttribute
        ].join('_'),
        !this.target.options.underscored
      );
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
     * If we are double linked, and through is either default or a string, we create the through model and set it on both associations
     */
    if (this.through.model === true) {
      this.through.model = this.combinedTableName;
    }

    if (typeof this.through.model === 'string') {
      if (!this.sequelize.isDefined(this.through.model)) {
        this.through.model = this.sequelize.define(this.through.model, {}, _.extend(this.options, {
          tableName: this.through.model,
          indexes: {}, //we dont want indexes here (as referenced in #2416)
          paranoid: false  // A paranoid join table does not make sense
        }));
      } else {
        this.through.model = this.sequelize.model(this.through.model);
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
  BelongsToMany.prototype.injectAttributes = function() {
    var doubleLinked = this.doubleLinked
      , self = this;

    this.identifier = this.foreignKey;
    this.foreignIdentifier = this.otherKey;

    // remove any PKs previously defined by sequelize
    Utils._.each(this.through.model.rawAttributes, function(attribute, attributeName) {
      if (attribute.primaryKey === true && attribute._autoGenerated === true) {
        delete self.through.model.rawAttributes[attributeName];
        self.primaryKeyDeleted = true;
      }
    });

    var sourceKey = this.source.rawAttributes[this.source.primaryKeyAttribute]
      , sourceKeyType = sourceKey.type
      , sourceKeyField = sourceKey.field || this.source.primaryKeyAttribute
      , targetKey = this.target.rawAttributes[this.target.primaryKeyAttribute]
      , targetKeyType = targetKey.type
      , targetKeyField = targetKey.field || this.target.primaryKeyAttribute
      , sourceAttribute = Utils._.defaults(this.foreignKeyAttribute, { type: sourceKeyType })
      , targetAttribute = Utils._.defaults(this.otherKeyAttribute, { type: targetKeyType });

    if (this.primaryKeyDeleted === true) {
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

    if (this.options.constraints !== false) {
      sourceAttribute.references = this.source.getTableName();
      sourceAttribute.referencesKey = sourceKeyField;
      // For the source attribute the passed option is the priority
      sourceAttribute.onDelete = this.options.onDelete || this.through.model.rawAttributes[this.identifier].onDelete;
      sourceAttribute.onUpdate = this.options.onUpdate || this.through.model.rawAttributes[this.identifier].onUpdate;

      if (!sourceAttribute.onDelete) sourceAttribute.onDelete = 'CASCADE';
      if (!sourceAttribute.onUpdate) sourceAttribute.onUpdate = 'CASCADE';


      targetAttribute.references = this.target.getTableName();
      targetAttribute.referencesKey = targetKeyField;
      // But the for target attribute the previously defined option is the priority (since it could've been set by another belongsToMany call)
      targetAttribute.onDelete = this.through.model.rawAttributes[this.foreignIdentifier].onDelete || this.options.onDelete;
      targetAttribute.onUpdate = this.through.model.rawAttributes[this.foreignIdentifier].onUpdate || this.options.onUpdate;

      if (!targetAttribute.onDelete) sourceAttribute.onDelete = 'CASCADE';
      if (!targetAttribute.onUpdate) sourceAttribute.onUpdate = 'CASCADE';
    }

    this.through.model.rawAttributes[this.identifier] = Utils._.extend(this.through.model.rawAttributes[this.identifier], sourceAttribute);
    this.through.model.rawAttributes[this.foreignIdentifier] = Utils._.extend(this.through.model.rawAttributes[this.foreignIdentifier], targetAttribute);

    this.identifierField = this.through.model.rawAttributes[this.identifier].field || this.identifier;
    this.foreignIdentifierField = this.through.model.rawAttributes[this.foreignIdentifier].field || this.foreignIdentifier;

    this.through.model.init(this.through.model.daoFactoryManager);

    Helpers.checkNamingCollision(this);

    return this;
  };

  BelongsToMany.prototype.injectGetter = function(obj) {
    var association = this;

    obj[this.accessors.get] = function(options, queryOptions) {
      options = association.target.__optClone(options) || {};
      queryOptions = queryOptions || {};

      var instance = this
        , through = association.through
        , scopeWhere
        , throughWhere;

      if (association.scope) {
        scopeWhere = {};
        Object.keys(association.scope).forEach(function (attribute) {
          scopeWhere[attribute] = association.scope[attribute];
        }.bind(this));
      }

      options.where = new Utils.and([
        scopeWhere,
        options.where
      ]);

      if (Object(through.model) === through.model) {
        throughWhere = {};
        throughWhere[association.identifier] = instance.get(association.source.primaryKeyAttribute);

        if (through && through.scope) {
          Object.keys(through.scope).forEach(function (attribute) {
            throughWhere[attribute] = through.scope[attribute];
          }.bind(this));
        }

        options.include = options.include || [];
        options.include.push({
          model: through.model,
          as: through.model.name,
          attributes: options.joinTableAttributes,
          association: {
            isSingleAssociation: true,
            source: association.target,
            target: association.source,
            identifier: association.foreignIdentifier,
            identifierField: association.foreignIdentifierField
          },
          required: true,
          where: throughWhere,
          _pseudo: true
        });
      }

      return association.target.findAll(options, queryOptions);
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

  BelongsToMany.prototype.injectSetter = function(obj) {
    var association = this
      , primaryKeyAttribute = association.target.primaryKeyAttribute;

    obj[this.accessors.set] = function(newAssociatedObjects, additionalAttributes) {
      additionalAttributes = additionalAttributes || {};

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
        transaction: additionalAttributes.transaction
      }).then(function(oldAssociatedObjects) {
        var foreignIdentifier = association.foreignIdentifier
          , sourceKeys = Object.keys(association.source.primaryKeys)
          , targetKeys = Object.keys(association.target.primaryKeys)
          , obsoleteAssociations = []
          , changedAssociations = []
          , defaultAttributes = additionalAttributes
          , options = additionalAttributes
          , promises = []
          , unassociatedObjects;

        defaultAttributes = Utils._.omit(defaultAttributes, ['transaction', 'hooks', 'individualHooks', 'ignoreDuplicates', 'validate', 'fields']); // Don't try to insert the transaction as an attribute in the through table

        unassociatedObjects = newAssociatedObjects.filter(function(obj) {
          return !Utils._.find(oldAssociatedObjects, function(old) {
            return (!!obj[foreignIdentifier] ? obj[foreignIdentifier] === old[foreignIdentifier] : (!!obj[targetKeys[0]] ? obj[targetKeys[0]] === old[targetKeys[0]] : obj.id === old.id));
          });
        });

        oldAssociatedObjects.forEach(function(old) {
          var newObj = Utils._.find(newAssociatedObjects, function(obj) {
            return (!!obj[foreignIdentifier] ? obj[foreignIdentifier] === old[foreignIdentifier] : (!!obj[targetKeys[0]] ? obj[targetKeys[0]] === old[targetKeys[0]] : obj.id === old.id));
          });

          if (!newObj) {
            obsoleteAssociations.push(old);
          } else {
            var throughAttributes = newObj[association.through.model.name];
            // Quick-fix for subtle bug when using existing objects that might have the through model attached (not as an attribute object)
            if (throughAttributes instanceof association.through.model.Instance) {
              throughAttributes = {};
            }

            var changedAssociation = {
              where: {},
              attributes: Utils._.defaults({}, throughAttributes, defaultAttributes)
            };

            changedAssociation.where[association.identifier] = instance[sourceKeys[0]] || instance.id;
            changedAssociation.where[foreignIdentifier] = newObj[targetKeys[0]] || newObj.id;

            if (Object.keys(changedAssociation.attributes).length) {
              changedAssociations.push(changedAssociation);
            }
          }
        });

        if (obsoleteAssociations.length > 0) {
          var foreignIds = obsoleteAssociations.map(function(associatedObject) {
            return ((targetKeys.length === 1) ? associatedObject[targetKeys[0]] : associatedObject.id);
          });

          var where = {};
          where[association.identifier] = ((sourceKeys.length === 1) ? instance[sourceKeys[0]] : instance.id);
          where[foreignIdentifier] = foreignIds;

          promises.push(association.through.model.destroy(Utils._.extend(options, {
            where: where
          })));
        }

        if (unassociatedObjects.length > 0) {
          var bulk = unassociatedObjects.map(function(unassociatedObject) {
            var attributes = {};

            attributes[association.identifier] = ((sourceKeys.length === 1) ? instance[sourceKeys[0]] : instance.id);
            attributes[foreignIdentifier] = ((targetKeys.length === 1) ? unassociatedObject[targetKeys[0]] : unassociatedObject.id);

            attributes = Utils._.defaults(attributes, unassociatedObject[association.through.model.name], defaultAttributes);

            if (association.through.scope) {
              Object.keys(association.through.scope).forEach(function (attribute) {
                attributes[attribute] = association.through.scope[attribute];
              });
            }

            return attributes;
          }.bind(this));

          promises.push(association.through.model.bulkCreate(bulk, options));
        }

        if (changedAssociations.length > 0) {
          changedAssociations.forEach(function(assoc) {
            promises.push(association.through.model.update(assoc.attributes, Utils._.extend(options, {
              where: assoc.where
            })));
          });
        }

        return Utils.Promise.all(promises);
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

        var self = this
          , foreignIdentifier = association.foreignIdentifier
          , sourceKeys = Object.keys(association.source.primaryKeys)
          , targetKeys = Object.keys(association.target.primaryKeys)
          , obsoleteAssociations = []
          , changedAssociations = []
          , defaultAttributes = additionalAttributes || {}
          , options = defaultAttributes
          , promises = []
          , oldAssociations = []
          , unassociatedObjects;

        defaultAttributes = Utils._.omit(defaultAttributes, ['transaction', 'hooks', 'individualHooks', 'ignoreDuplicates', 'validate', 'fields']); // Don't try to insert the transaction as an attribute in the through table

        unassociatedObjects = newInstances.filter(function(obj) {
          return !Utils._.find(oldAssociations, function(old) {
            return (!!obj[foreignIdentifier] ? obj[foreignIdentifier] === old[foreignIdentifier] : (!!obj[targetKeys[0]] ? obj[targetKeys[0]] === old[targetKeys[0]] : obj.id === old.id));
          });
        });

        oldAssociations.forEach(function(old) {
          var newObj = Utils._.find(newInstances, function(obj) {
            return (!!obj[foreignIdentifier] ? obj[foreignIdentifier] === old[foreignIdentifier] : (!!obj[targetKeys[0]] ? obj[targetKeys[0]] === old[targetKeys[0]] : obj.id === old.id));
          });

          if (!newObj) {
            obsoleteAssociations.push(old);
          } else if (Object(association.through.model) === association.through.model) {
            var throughAttributes = newObj[association.through.model.name];
            // Quick-fix for subtle bug when using existing objects that might have the through model attached (not as an attribute object)
            if (throughAttributes instanceof association.through.model.Instance) {
              throughAttributes = {};
            }

            var changedAssociation = {
              where: {},
              attributes: Utils._.defaults({}, throughAttributes, defaultAttributes)
            };

            changedAssociation.where[association.identifier] = instance[sourceKeys[0]] || instance.id;
            changedAssociation.where[foreignIdentifier] = newObj[targetKeys[0]] || newObj.id;

            if (Object.keys(changedAssociation.attributes).length) {
              changedAssociations.push(changedAssociation);
            }
          }
        });

        if (obsoleteAssociations.length > 0) {
          var foreignIds = obsoleteAssociations.map(function(associatedObject) {
            return ((targetKeys.length === 1) ? associatedObject[targetKeys[0]] : associatedObject.id);
          });

          var where = {};
          where[association.identifier] = ((sourceKeys.length === 1) ? instance[sourceKeys[0]] : instance.id);
          where[association.foreignIdentifier] = foreignIds;

          promises.push(association.through.model.destroy(Utils._.extend(options, {
            where: where
          })));
        }

        if (unassociatedObjects.length > 0) {
          var bulk = unassociatedObjects.map(function(unassociatedObject) {
            var attributes = {};

            attributes[association.identifier] = ((sourceKeys.length === 1) ? instance[sourceKeys[0]] : instance.id);
            attributes[association.foreignIdentifier] = ((targetKeys.length === 1) ? unassociatedObject[targetKeys[0]] : unassociatedObject.id);

            if (Object(association.through.model) === association.through.model) {
              attributes = Utils._.defaults(attributes, unassociatedObject[association.through.model.name], defaultAttributes);
            }

            if (association.through.scope) {
              Object.keys(association.through.scope).forEach(function (attribute) {
                attributes[attribute] = association.through.scope[attribute];
              });
            }

            return attributes;
          }.bind(this));

          promises.push(association.through.model.bulkCreate(bulk, options));
        }

        if (changedAssociations.length > 0) {
          changedAssociations.forEach(function(assoc) {
            promises.push(association.through.model.update(assoc.attributes, Utils._.extend(options, {
              where: assoc.where
            })));
          });
        }

        return Utils.Promise.all(promises);
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
          additionalAttributes = additionalAttributes || {};

          var attributes = {}
            , foreignIdentifier = association.foreignIdentifier
            , options = additionalAttributes;

          var sourceKeys = Object.keys(association.source.primaryKeys);
          var targetKeys = Object.keys(association.target.primaryKeys);

          additionalAttributes = Utils._.omit(additionalAttributes, ['transaction', 'hooks', 'individualHooks', 'ignoreDuplicates', 'validate', 'fields']); // Don't try to insert the transaction as an attribute in the through table

          attributes[association.identifier] = ((sourceKeys.length === 1) ? instance[sourceKeys[0]] : instance.id);
          attributes[foreignIdentifier] = ((targetKeys.length === 1) ? newInstance[targetKeys[0]] : newInstance.id);

          if (!!currentAssociatedObjects.length) {
            var where = attributes;
            attributes = Utils._.defaults({}, newInstance[association.through.model.name], additionalAttributes);

            if (Object.keys(attributes).length) {
              return association.through.model.update(attributes, Utils._.extend(options, {
                where: where
              }));
            } else {
              return Utils.Promise.resolve();
            }
          } else {
            attributes = Utils._.defaults(attributes, newInstance[association.through.model.name], additionalAttributes);
            if (association.through.scope) {
              Object.keys(association.through.scope).forEach(function (attribute) {
                attributes[attribute] = association.through.scope[attribute];
              });
            }

            return association.through.model.create(attributes, options);
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

  BelongsToMany.prototype.injectCreator = function(obj) {
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

      // Create the related model instance
      return association.target.create(values, options).then(function(newAssociatedObject) {
        return instance[association.accessors.add](newAssociatedObject, _.omit(options, ['fields'])).return(newAssociatedObject);
      });
    };

    return this;
  };

  return BelongsToMany;
})();
