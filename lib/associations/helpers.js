'use strict';

const Utils = require('./../utils');

function checkNamingCollision(association) {
  if (association.source.rawAttributes.hasOwnProperty(association.as)) {
    throw new Error(
      'Naming collision between attribute \'' + association.as +
      '\' and association \'' + association.as + '\' on model ' + association.source.name +
      '. To remedy this, change either foreignKey or as in your association definition'
    );
  }
}
exports.checkNamingCollision = checkNamingCollision;

function addForeignKeyConstraints(newAttribute, source, target, options, key) {
  // FK constraints are opt-in: users must either set `foreignKeyConstraints`
  // on the association, or request an `onDelete` or `onUpdate` behaviour

  if (options.foreignKeyConstraint || options.onDelete || options.onUpdate) {

    // Find primary keys: composite keys not supported with this approach
    const primaryKeys = Utils._.chain(source.rawAttributes).keys()
      .filter(key => source.rawAttributes[key].primaryKey)
      .map(key => source.rawAttributes[key].field || key).value();

    if (primaryKeys.length === 1) {
      if (!!source._schema) {
        newAttribute.references = {
          model: source.sequelize.queryInterface.QueryGenerator.addSchema({
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
