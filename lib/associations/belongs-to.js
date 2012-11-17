var Utils     = require("./../utils")
  , DataTypes = require('./../data-types')

module.exports = (function() {
  var BelongsTo = function(srcDAO, targetDAO, options) {
    this.associationType   = 'BelongsTo'
    this.source            = srcDAO
    this.target            = targetDAO
    this.options           = options
    this.isSelfAssociation = (this.source.tableName == this.target.tableName)

    if(this.isSelfAssociation && !this.options.foreignKey && !!this.options.as) {
      this.options.foreignKey = Utils._.underscoredIf(Utils.singularize(this.options.as) + "Id", this.source.options.underscored)
    }

    this.associationAccessor = this.isSelfAssociation
      ? Utils.combineTableNames(this.target.tableName, this.options.as || this.target.tableName)
      : this.options.as || this.target.tableName
  }

  // the id is in the source table
  BelongsTo.prototype.injectAttributes = function() {
    var newAttributes  = {}

    this.identifier = this.options.foreignKey || Utils._.underscoredIf(Utils.singularize(this.target.tableName) + "Id", this.source.options.underscored)
    newAttributes[this.identifier] = { type: DataTypes.INTEGER }
    Utils._.defaults(this.source.rawAttributes, newAttributes)

    // Sync attributes to DAO proto each time a new assoc is added
    this.target.DAO.prototype.attributes = Object.keys(this.target.DAO.prototype.rawAttributes);

    return this
  }

  BelongsTo.prototype.injectGetter = function(obj) {
    var self     = this
      , accessor = Utils._.camelize('get_' + (this.options.as || Utils.singularize(this.target.tableName)))

    obj[accessor] = function(params) {
      var id = this[self.identifier]

      if (!Utils._.isUndefined(params)) {
        if (!Utils._.isUndefined(params.attributes)) {
          params = Utils._.extend({where: {id:id}}, params)
        }
      } else {
        params = id
      }

      return self.target.find(params)
    }

    return this
  }

  BelongsTo.prototype.injectSetter = function(obj) {
    var self     = this
      , accessor = Utils._.camelize('set_' + (this.options.as || Utils.singularize(this.target.tableName)))

    obj[accessor] = function(associatedObject) {
      this[self.identifier] = associatedObject ? associatedObject.id : null

      // passes the changed field to save, so only that field get updated.
      return this.save([ self.identifier ])
    }

    return this
  }

  return BelongsTo
})()
