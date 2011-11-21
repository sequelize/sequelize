var Utils     = require("./../utils")
  , DataTypes = require('./../data-types')

module.exports = (function() {
  var BelongsTo = function(srcModel, targetModel, options) {
    this.source = srcModel
    this.target = targetModel
    this.options = options
    this.isSelfAssociation = (this.source.tableName == this.target.tableName)

    if(this.isSelfAssociation && !this.options.foreignKey && !!this.options.as)
      this.options.foreignKey = Utils._.underscoredIf(Utils.singularize(this.options.as) + "Id", this.source.options.underscored)

    this.associationAccessor = this.isSelfAssociation
      ? Utils.combineTableNames(this.target.tableName, this.options.as || this.target.tableName)
      : this.target.tableName
  }

  // the id is in the source table
  BelongsTo.prototype.injectAttributes = function() {
    this.identifier = this.options.foreignKey || Utils._.underscoredIf(Utils.singularize(this.target.tableName) + "Id", this.source.options.underscored)
    Utils.addForeignKeyField(this.source, this.identifier)
    return this
  }

  BelongsTo.prototype.injectGetter = function(obj) {
    var self     = this
      , accessor = Utils._.camelize('get_' + (this.options.as || Utils.singularize(this.target.tableName)))

    obj[accessor] = function() {
      var id = obj[self.identifier]
      return self.target.find(id)
    }

    return this
  }

  BelongsTo.prototype.injectSetter = function(obj) {
    var self     = this
      , accessor = Utils._.camelize('set_' + (this.options.as || Utils.singularize(this.target.tableName)))

    obj[accessor] = function(associatedObject) {
      obj[self.identifier] = associatedObject ? associatedObject.id : null
      return obj.save()
    }

    return this
  }

  return BelongsTo
})()
