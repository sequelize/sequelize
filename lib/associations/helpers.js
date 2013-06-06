var Utils = require("./../utils")

module.exports = {

  addForeignKeyConstraints: function(newAttribute, source, target, options) {
    // FK constraints are opt-in: users must either rset `foreignKeyConstraints`
    // on the association, or request an `onDelete` or `onUpdate` behaviour

    if(options.foreignKeyConstraint || options.onDelete || options.onUpdate) {

      // Find primary keys: composite keys not supported with this approach
      var primaryKeys = Utils._.filter(Utils._.keys(source.rawAttributes), function(key) {
        return source.rawAttributes[key].primaryKey
      })

      if(primaryKeys.length == 1) {
        newAttribute.references = source.tableName,
        newAttribute.referencesKey = primaryKeys[0]
        newAttribute.onDelete = options.onDelete,
        newAttribute.onUpdate = options.onUpdate
      }
    }
  }

}
