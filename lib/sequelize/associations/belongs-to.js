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
  
  this.identifier = this.associationName + "Id"
  if(this.options.underscored) this.identifier = Utils._.camelize(this.identifier)
  
  newAttributes[this.identifier] = { type: DataTypes.INTEGER }
  Utils._.extend(this.source.attributes, Utils.simplifyAttributes(newAttributes))
  
  // this.source.associations[this.associationName] = association
  return this
}

BelongsTo.prototype.injectGetter = function(obj) {
  var self = this
  
  obj['get' + this.associationName] = function() {
    return self.target.find(self.identifier)
  }
  
  return this
}

BelongsTo.prototype.injectSetter = function(obj) {
  var self = this
  
  obj['set' + this.associationName] = function(associatedObject) {
    self.source[self.identifier] = associatedObject.id
    return self.source.save()
  }
  
  return this
}