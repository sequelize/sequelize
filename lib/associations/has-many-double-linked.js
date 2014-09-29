'use strict';

var Utils = require('./../utils')
  , Transaction = require('./../transaction');

module.exports = (function() {
  var HasManyDoubleLinked = function(association, instance) {
    this.association = association;
    this.instance = instance;

    // Alias the quoting methods for code brevity
    this.QueryInterface = instance.QueryInterface;
  };

  HasManyDoubleLinked.prototype.injectGetter = function(options, queryOptions) {
    var self = this
      , through = self.association.through
      , scopeWhere
      , throughWhere;

    if (this.association.scope) {
      scopeWhere = {};
      Object.keys(this.association.scope).forEach(function (attribute) {
        scopeWhere[attribute] = this.association.scope[attribute];
      }.bind(this));
    }

    options.where = new Utils.and([
      scopeWhere,
      options.where
    ]);

    if (Object(through.model) === through.model) {
      throughWhere = {};
      throughWhere[self.association.identifier] = self.instance.get(self.association.source.primaryKeyAttribute);

      if (through && through.scope) {
        Object.keys(through.scope).forEach(function (attribute) {
          throughWhere[attribute] = through.scope[attribute];
        }.bind(this));
      }

      options.include = options.include || [];
      options.include.push({
        model: through.model,
        as: Utils.singularize(through.model.tableName),
        attributes: options.joinTableAttributes,
        association: {
          isSingleAssociation: true,
          source: self.association.target,
          target: self.association.source,
          identifier: self.association.foreignIdentifier,
          identifierField: self.association.foreignIdentifierField
        },
        required: true,
        where: throughWhere,
        _pseudo: true
      });
    }

    return self.association.target.findAll(options, queryOptions);
  };

  HasManyDoubleLinked.prototype.injectSetter = function(oldAssociations, newAssociations, defaultAttributes) {
    defaultAttributes = defaultAttributes || {};

    var self = this
      , targetAssociation = self.association.targetAssociation
      , foreignIdentifier = self.association.foreignIdentifier
      , sourceKeys = Object.keys(self.association.source.primaryKeys)
      , targetKeys = Object.keys(self.association.target.primaryKeys)
      , obsoleteAssociations = []
      , changedAssociations = []
      , options = defaultAttributes
      , promises = []
      , unassociatedObjects;

    defaultAttributes = Utils._.omit(defaultAttributes, ['transaction', 'hooks', 'individualHooks', 'ignoreDuplicates', 'validate', 'fields']); // Don't try to insert the transaction as an attribute in the through table

    unassociatedObjects = newAssociations.filter(function(obj) {
      return !Utils._.find(oldAssociations, function(old) {
        return (!!obj[foreignIdentifier] ? obj[foreignIdentifier] === old[foreignIdentifier] : (!!obj[targetKeys[0]] ? obj[targetKeys[0]] === old[targetKeys[0]] : obj.id === old.id));
      });
    });

    oldAssociations.forEach(function(old) {
      var newObj = Utils._.find(newAssociations, function(obj) {
        return (!!obj[foreignIdentifier] ? obj[foreignIdentifier] === old[foreignIdentifier] : (!!obj[targetKeys[0]] ? obj[targetKeys[0]] === old[targetKeys[0]] : obj.id === old.id));
      });

      if (!newObj) {
        obsoleteAssociations.push(old);
      } else if (Object(targetAssociation.through.model) === targetAssociation.through.model) {
        var throughAttributes = newObj[self.association.through.model.name];
        // Quick-fix for subtle bug when using existing objects that might have the through model attached (not as an attribute object)
        if (throughAttributes instanceof self.association.through.model.Instance) {
          throughAttributes = {};
        }

        var changedAssociation = {
          where: {},
          attributes: Utils._.defaults({}, throughAttributes, defaultAttributes)
        };

        changedAssociation.where[self.association.identifier] = self.instance[sourceKeys[0]] || self.instance.id;
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
      where[self.association.identifier] = ((sourceKeys.length === 1) ? self.instance[sourceKeys[0]] : self.instance.id);
      where[foreignIdentifier] = foreignIds;

      promises.push(self.association.through.model.destroy(Utils._.extend(options, {
        where: where
      })));
    }

    if (unassociatedObjects.length > 0) {
      var bulk = unassociatedObjects.map(function(unassociatedObject) {
        var attributes = {};

        attributes[self.association.identifier] = ((sourceKeys.length === 1) ? self.instance[sourceKeys[0]] : self.instance.id);
        attributes[foreignIdentifier] = ((targetKeys.length === 1) ? unassociatedObject[targetKeys[0]] : unassociatedObject.id);

        if (Object(targetAssociation.through.model) === targetAssociation.through.model) {
          attributes = Utils._.defaults(attributes, unassociatedObject[targetAssociation.through.model.name], defaultAttributes);
        }

        if (this.association.through.scope) {
          Object.keys(this.association.through.scope).forEach(function (attribute) {
            attributes[attribute] = this.association.through.scope[attribute];
          }.bind(this));
        }

        return attributes;
      }.bind(this));

      promises.push(self.association.through.model.bulkCreate(bulk, options));
    }

    if (changedAssociations.length > 0) {
      changedAssociations.forEach(function(assoc) {
        promises.push(self.association.through.model.update(assoc.attributes, Utils._.extend(options, {
          where: assoc.where
        })));
      });
    }

    return Utils.Promise.all(promises);
  };

  HasManyDoubleLinked.prototype.injectAdder = function(newAssociation, additionalAttributes, exists) {
    additionalAttributes = additionalAttributes || {};

    var attributes = {}
      , targetAssociation = this.association.targetAssociation
      , foreignIdentifier = targetAssociation.identifier
      , options = additionalAttributes;

    var sourceKeys = Object.keys(this.association.source.primaryKeys);
    var targetKeys = Object.keys(this.association.target.primaryKeys);

    additionalAttributes = Utils._.omit(additionalAttributes, ['transaction', 'hooks', 'individualHooks', 'ignoreDuplicates', 'validate', 'fields']); // Don't try to insert the transaction as an attribute in the through table

    attributes[this.association.identifier] = ((sourceKeys.length === 1) ? this.instance[sourceKeys[0]] : this.instance.id);
    attributes[foreignIdentifier] = ((targetKeys.length === 1) ? newAssociation[targetKeys[0]] : newAssociation.id);

    if (exists) {
      var where = attributes;
      attributes = Utils._.defaults({}, newAssociation[targetAssociation.through.model.name], additionalAttributes);

      if (Object.keys(attributes).length) {
        return targetAssociation.through.model.update(attributes, Utils._.extend(options, {
          where: where
        }));
      } else {
        return Utils.Promise.resolve();
      }
    } else {
      attributes = Utils._.defaults(attributes, newAssociation[targetAssociation.through.model.name], additionalAttributes);
      if (this.association.through.scope) {
        Object.keys(this.association.through.scope).forEach(function (attribute) {
          attributes[attribute] = this.association.through.scope[attribute];
        }.bind(this));
      }

      return this.association.through.model.create(attributes, options);
    }
  };

  return HasManyDoubleLinked;
})();
