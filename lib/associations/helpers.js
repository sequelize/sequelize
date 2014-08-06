'use strict';

var Utils = require('./../utils');

module.exports = {
  checkNamingCollision: function (association) {
    if (association.source.rawAttributes.hasOwnProperty(association.as)) {
      throw new Error("Naming collision between attribute '" + association.as + "' and association '" + association.as + "' on model " + association.source.name + '. To remedy this, change either foreignKey or as in your association definition');
    }
  },

  addForeignKeyConstraints: function(newAttribute, source, target, options) {
    // FK constraints are opt-in: users must either set `foreignKeyConstraints`
    // on the association, or request an `onDelete` or `onUpdate` behaviour

    if (options.foreignKeyConstraint || options.onDelete || options.onUpdate) {

      // Find primary keys: composite keys not supported with this approach
      var primaryKeys = Utils._.chain(source.rawAttributes).keys()
        .filter(function(key) { return source.rawAttributes[key].primaryKey; })
        .map(function(key) { return source.rawAttributes[key].field || key; }).value();

      if (primaryKeys.length === 1) {
        if (!!source.options.schema) {
          newAttribute.references = source.daoFactoryManager.sequelize.queryInterface.QueryGenerator.addSchema({
            tableName: source.tableName,
            options: {
              schema: source.options.schema,
              schemaDelimiter: source.options.schemaDelimiter
            }
          });
        } else {
          newAttribute.references = source.tableName;
        }

        newAttribute.referencesKey = primaryKeys[0];
        newAttribute.onDelete = options.onDelete;
        newAttribute.onUpdate = options.onUpdate;
      }
    }
  }

};
