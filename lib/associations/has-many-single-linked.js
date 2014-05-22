'use strict';

var Utils = require('./../utils')
  , Transaction = require('./../transaction');

module.exports = (function() {
  var HasManySingleLinked = function(association, instance) {
    this.__factory = association;
    this.association = association;
    this.instance = instance;
    this.target = this.association.target;
    this.source = this.association.source;
  };

  HasManySingleLinked.prototype.injectGetter = function(options, queryOptions) {
    options.where = new Utils.and([
      new Utils.where(
        this.target.rawAttributes[this.association.identifier],
        this.instance[this.source.primaryKeyAttribute])
      ,
      options.where
    ]);

    return this.association.target.all(options, queryOptions);
  };

  HasManySingleLinked.prototype.injectSetter = function(oldAssociations, newAssociations, defaultAttributes) {
    var self = this
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
      delete defaultAttributes.transaction;
    }

    if (obsoleteAssociations.length > 0) {
      // clear the old associations
      var obsoleteIds = obsoleteAssociations.map(function(associatedObject) {
        associatedObject[self.__factory.identifier] = (newAssociations.length < 1 ? null : self.instance.id);
        return associatedObject[associationKey];
      });

      update = {};
      update[self.__factory.identifier] = null;

      var primaryKeys = Object.keys(this.__factory.target.primaryKeys)
        , primaryKey = primaryKeys.length === 1 ? primaryKeys[0] : 'id'
        , updateWhere = {};

      updateWhere[primaryKey] = obsoleteIds;
      promises.push(this.__factory.target.update(
        update,
        updateWhere,
        Utils._.extend(options, { allowNull: [self.__factory.identifier] })
      ));
    }

    if (unassociatedObjects.length > 0) {
      // For the self.instance
      var pkeys = Object.keys(self.instance.Model.primaryKeys)
        , pkey = pkeys.length === 1 ? pkeys[0] : 'id'
        // For chainer
        , primaryKeys = Object.keys(this.__factory.target.primaryKeys)
        , primaryKey = primaryKeys.length === 1 ? primaryKeys[0] : 'id'
        , updateWhere = {};

      // set the new associations
      var unassociatedIds = unassociatedObjects.map(function(associatedObject) {
        associatedObject[self.__factory.identifier] = self.instance[pkey] || self.instance.id;
        return associatedObject[associationKey];
      });

      update = {};
      update[self.__factory.identifier] = (newAssociations.length < 1 ? null : self.instance[pkey] || self.instance.id);
      updateWhere[primaryKey] = unassociatedIds;

      promises.push(this.__factory.target.update(
        update,
        updateWhere,
        Utils._.extend(options, { allowNull: [self.__factory.identifier] })
      ));
    }

    return Utils.Promise.all(promises);
  };

  HasManySingleLinked.prototype.injectAdder = function(newAssociation, additionalAttributes) {
    var primaryKeys = Object.keys(this.instance.Model.primaryKeys)
      , primaryKey = primaryKeys.length === 1 ? primaryKeys[0] : 'id'
      , options = {};

    if ((additionalAttributes || {}).transaction instanceof Transaction) {
      options.transaction = additionalAttributes.transaction;
      delete additionalAttributes.transaction;
    }

    newAssociation[this.__factory.identifier] = this.instance[primaryKey];

    return newAssociation.save(options);
  };

  return HasManySingleLinked;
})();
