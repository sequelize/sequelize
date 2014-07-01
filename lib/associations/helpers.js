'use strict';

var Utils = require('./../utils');

module.exports = {
  checkNamingCollision: function (assocition) {
    if (assocition.source.rawAttributes.hasOwnProperty(assocition.as)) {
      throw new Error("Naming collision between attribute '" + assocition.as + "' and association '" + assocition.as + "' on model " + assocition.source.name + '. To remedy this, change either foreignKey or as in your association definition');
    }
  },

  addForeignKeyConstraints: function(newAttribute, source, target, options) {
    // FK constraints are opt-in: users must either set `foreignKeyConstraints`
    // on the association, or request an `onDelete` or `onUpdate` behaviour

    if (options.foreignKeyConstraint || options.onDelete || options.onUpdate) {

      // Find primary keys: composite keys not supported with this approach
      var primaryKeys = Utils._.filter(Utils._.keys(source.rawAttributes), function(key) {
        return source.rawAttributes[key].primaryKey;
      });

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
