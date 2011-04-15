var Utils     = require("./../utils")
  , DataTypes = require('./../data-types')

var BelongsTo = module.exports = function(associationName, srcModel, targetModel, options) {
  this.associationName = associationName
  this.source = srcModel
  this.target = targetModel
  this.options = options
}

// the id is in the source table
BelongsTo.prototype.injectAttributes = function() {
  var newAttributes = {}
  this.identifier = Utils._.underscoredIf(this.associationName + "Id", this.options.underscored)
  
  newAttributes[this.identifier] = { type: DataTypes.INTEGER }
  Utils._.extend(this.source.attributes, Utils.simplifyAttributes(newAttributes))
  
  return this
}

BelongsTo.prototype.injectGetter = function(obj) {
  var self = this
  
  obj[Utils._.camelize('get_' + this.associationName)] = function() {
    var id = obj[self.identifier]
    return self.target.find(id)
  }
  
  return this
}

BelongsTo.prototype.injectSetter = function(obj) {
  var self = this
  
  obj[Utils._.camelize('set_' + this.associationName)] = function(associatedObject) {
    obj[self.identifier] = associatedObject ? associatedObject.id : null
    return obj.save()
  }
  
  return this
}