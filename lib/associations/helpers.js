'use strict';

function checkNamingCollision(association) {
  if (Object.prototype.hasOwnProperty.call(association.source.rawAttributes, association.as)) {
    throw new Error(
      `Naming collision between attribute '${association.as}'` +
      ` and association '${association.as}' on model ${association.source.name}` +
      '. To remedy this, change either foreignKey or as in your association definition'
    );
  }
}
exports.checkNamingCollision = checkNamingCollision;

function addForeignKeyConstraints(newAttribute, source, target, options, key) {
  // FK constraints are opt-in: users must either set `foreignKeyConstraints`
  // on the association, or request an `onDelete` or `onUpdate` behavior

  if (options.foreignKeyConstraint || options.onDelete || options.onUpdate) {
    // Find primary keys: composite keys not supported with this approach
    const primaryKeys = Object.keys(source.primaryKeys)
      .map(primaryKeyAttribute => source.rawAttributes[primaryKeyAttribute].field || primaryKeyAttribute);

    if (primaryKeys.length === 1 || !primaryKeys.includes(key)) {
      if (source._schema) {
        newAttribute.references = {
          model: source.sequelize.getQueryInterface().QueryGenerator.addSchema({
            tableName: source.tableName,
            _schema: source._schema,
            _schemaDelimiter: source._schemaDelimiter
          })
        };
      } else {
        newAttribute.references = { model: source.tableName };
      }

      newAttribute.references.key = key || primaryKeys[0];
      newAttribute.onDelete = options.onDelete;
      newAttribute.onUpdate = options.onUpdate;
    }
  }
}
exports.addForeignKeyConstraints = addForeignKeyConstraints;

/**
 * Mixin (inject) association methods to model prototype
 *
 * @private
 *
 * @param {Object} association instance
 * @param {Object} obj Model prototype
 * @param {Array} methods Method names to inject
 * @param {Object} aliases Mapping between model and association method names
 *
 */
function mixinMethods(association, obj, methods, aliases) {
  aliases = aliases || {};

  for (const method of methods) {
    // don't override custom methods
    if (!Object.prototype.hasOwnProperty.call(obj, association.accessors[method])) {
      const realMethod = aliases[method] || method;

      obj[association.accessors[method]] = function() {
        return association[realMethod](this, ...Array.from(arguments));
      };
    }
  }
}
exports.mixinMethods = mixinMethods;
