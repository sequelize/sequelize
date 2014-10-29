'use strict';

var Utils = require('./../utils')
  , Transaction = require('./../transaction');

module.exports = (function() {
  var HasManySingleLinked = function(association, instance) {
    this.association = association;
    this.instance = instance;
    this.target = this.association.target;
    this.source = this.association.source;
  };

  HasManySingleLinked.prototype.injectGetter = function(options, queryOptions) {
    var scopeWhere = this.association.scope ? {} : null;
    if (this.association.scope) {
      Object.keys(this.association.scope).forEach(function (attribute) {
        scopeWhere[attribute] = this.association.scope[attribute];
      }.bind(this));
    }

    options.where = new Utils.and([
      new Utils.where(
        this.target.rawAttributes[this.association.identifier],
        this.instance[this.source.primaryKeyAttribute]
      ),
      scopeWhere,
      options.where
    ]);

    return this.association.target.all(options, queryOptions);
  };

  HasManySingleLinked.prototype.injectSetter = function(oldAssociations, newAssociations, defaultAttributes) {
    var self = this
      , primaryKeys
      , primaryKey
      , updateWhere
      , associationKeys = Object.keys((oldAssociations[0] || newAssociations[0] || {Model: {primaryKeys: {}}}).Model.primaryKeys || {})
      , associationKey = (associationKeys.length === 1) ? associationKeys[0] : 'id'
      , options = {}
      , promises = []
      , obsoleteAssociations = oldAssociations.filter(function(old) {
          return !Utils._.find(newAssociations, function(obj) {
            return obj[associationKey] === old[associationKey];
          });
        })
      , unassociatedObjects = newAssociations.filter(function(obj) {
          return !Utils._.find(oldAssociations, function(old) {
            return obj[associationKey] === old[associationKey];
          });
        })
      , update;

    if ((defaultAttributes || {}).transaction instanceof Transaction) {
      options.transaction = defaultAttributes.transaction;
    }

    if (obsoleteAssociations.length > 0) {
      // clear the old associations
      var obsoleteIds = obsoleteAssociations.map(function(associatedObject) {
        associatedObject[self.association.identifier] = (newAssociations.length < 1 ? null : self.instance.id);
        return associatedObject[associationKey];
      });

      update = {};
      update[self.association.identifier] = null;

      primaryKeys = Object.keys(this.association.target.primaryKeys);
      primaryKey = primaryKeys.length === 1 ? primaryKeys[0] : 'id';
      updateWhere = {};

      updateWhere[primaryKey] = obsoleteIds;
      promises.push(this.association.target.update(
        update,
        Utils._.extend(options, {
          allowNull: [self.association.identifier],
          where: updateWhere
        })
      ));
    }

    if (unassociatedObjects.length > 0) {
      // For the self.instance
      var pkeys = Object.keys(self.instance.Model.primaryKeys)
        , pkey = pkeys.length === 1 ? pkeys[0] : 'id';

      primaryKeys = Object.keys(this.association.target.primaryKeys);
      primaryKey = primaryKeys.length === 1 ? primaryKeys[0] : 'id';
      updateWhere = {};

      // set the new associations
      var unassociatedIds = unassociatedObjects.map(function(associatedObject) {
        associatedObject[self.association.identifier] = self.instance[pkey] || self.instance.id;
        return associatedObject[associationKey];
      });

      update = {};
      update[self.association.identifier] = (newAssociations.length < 1 ? null : self.instance[pkey] || self.instance.id);
      if (this.association.scope) {
        Object.keys(this.association.scope).forEach(function (attribute) {
          update[attribute] = this.association.scope[attribute];
        }.bind(this));
      }

      updateWhere[primaryKey] = unassociatedIds;

      promises.push(this.association.target.update(
        update,
        Utils._.extend(options, {
          allowNull: [self.association.identifier],
          where: updateWhere
        })
      ));
    }

    return Utils.Promise.all(promises);
  };

  HasManySingleLinked.prototype.injectAdder = function(newAssociation, options) {
    newAssociation.set(this.association.identifier, this.instance.get(this.instance.Model.primaryKeyAttribute));
    if (this.association.scope) {
      Object.keys(this.association.scope).forEach(function (attribute) {
        newAssociation.set(attribute, this.association.scope[attribute]);
      }.bind(this));
    }

    return newAssociation.save(options);
  };

  return HasManySingleLinked;
})();
