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
      , targetAssociation = self.association.targetAssociation;

    //fully qualify
    var instancePrimaryKey = self.instance.Model.primaryKeyAttribute
      , foreignPrimaryKey = self.association.target.primaryKeyAttribute;

    options.where = new Utils.and([
      new Utils.where(
        through.rawAttributes[self.association.identifier],
        self.instance[instancePrimaryKey]
      ),
      new Utils.where(
        through.rawAttributes[self.association.foreignIdentifier],
        {
          join: new Utils.literal([
            self.QueryInterface.quoteTable(self.association.target.name),
            self.QueryInterface.quoteIdentifier(foreignPrimaryKey)
          ].join('.'))
        }
      ),
      options.where
    ]);

    if (Object(targetAssociation.through) === targetAssociation.through) {
      queryOptions.hasJoinTableModel = true;
      queryOptions.joinTableModel = through;

      if (!options.attributes) {
        options.attributes = [
          self.QueryInterface.quoteTable(self.association.target.name) + '.*'
        ];
      }

      if (options.joinTableAttributes) {
        options.joinTableAttributes.forEach(function(elem) {
          options.attributes.push(
            self.QueryInterface.quoteTable(through.name) + '.' + self.QueryInterface.quoteIdentifier(elem) + ' as ' +
            self.QueryInterface.quoteIdentifier(through.name + '.' + elem, true)
          );
        });
      } else {
        Utils._.forOwn(through.rawAttributes, function(elem, key) {
          options.attributes.push(
            self.QueryInterface.quoteTable(through.name) + '.' + self.QueryInterface.quoteIdentifier(key) + ' as ' +
            self.QueryInterface.quoteIdentifier(through.name + '.' + key, true)
          );
        });
      }
    }

    return self.association.target.findAllJoin([through.getTableName(), through.name], options, queryOptions);
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
      } else if (Object(targetAssociation.through) === targetAssociation.through) {
        var throughAttributes = newObj[self.association.through.name];
        // Quick-fix for subtle bug when using existing objects that might have the through model attached (not as an attribute object)
        if (throughAttributes instanceof self.association.through.DAO) {
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

      promises.push(self.association.through.destroy(where, options));
    }

    if (unassociatedObjects.length > 0) {
      var bulk = unassociatedObjects.map(function(unassociatedObject) {
        var attributes = {};

        attributes[self.association.identifier] = ((sourceKeys.length === 1) ? self.instance[sourceKeys[0]] : self.instance.id);
        attributes[foreignIdentifier] = ((targetKeys.length === 1) ? unassociatedObject[targetKeys[0]] : unassociatedObject.id);

        if (Object(targetAssociation.through) === targetAssociation.through) {
          attributes = Utils._.defaults(attributes, unassociatedObject[targetAssociation.through.name], defaultAttributes);
        }

        return attributes;
      });

      promises.push(self.association.through.bulkCreate(bulk, options));
    }

    if (changedAssociations.length > 0) {
      changedAssociations.forEach(function(assoc) {
        promises.push(self.association.through.update(assoc.attributes, assoc.where, options));
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
      attributes = Utils._.defaults({}, newAssociation[targetAssociation.through.name], additionalAttributes);

      if (Object.keys(attributes).length) {
        return targetAssociation.through.update(attributes, where, options);
      } else {
        return Utils.Promise.resolve();
      }
    } else {
      attributes = Utils._.defaults(attributes, newAssociation[targetAssociation.through.name], additionalAttributes);

      return this.association.through.create(attributes, options);
    }
  };

  return HasManyDoubleLinked;
})();
