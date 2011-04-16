var Utils     = require("./../utils")
  , DataTypes = require('./../data-types')

var BelongsTo = module.exports = function(srcModel, targetModel, options) {
  this.source = srcModel
  this.target = targetModel
  this.options = options
}

// the id is in the source table
BelongsTo.prototype.injectAttributes = function() {
  var newAttributes  = {}
  
  this.identifier = this.options.foreignKey || Utils._.underscoredIf(this.target.tableName + "Id", this.source.options.underscored)
  newAttributes[this.identifier] = { type: DataTypes.INTEGER }

  Utils._.extend(this.source.attributes, Utils.simplifyAttributes(newAttributes))
  return this
}

BelongsTo.prototype.injectGetter = function(obj) {
  var self     = this
    , accessor = Utils._.camelize('get_' + (this.options.as || this.target.tableName))
  
  obj[accessor] = function() {
    var id = obj[self.identifier]
    return self.target.find(id)
  }
  
  return this
}

BelongsTo.prototype.injectSetter = function(obj) {
  var self     = this
    , accessor = Utils._.camelize('set_' + (this.options.as || this.target.tableName))
  
  obj[accessor] = function(associatedObject) {
    obj[self.identifier] = associatedObject ? associatedObject.id : null
    return obj.save()
  }
  
  return this
}