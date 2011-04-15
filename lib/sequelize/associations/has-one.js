var Utils     = require("./../utils")
  , DataTypes = require('./../data-types')

var HasOne = module.exports = function(associationName, srcModel, targetModel, options) {
  this.associationName = associationName
  this.source = srcModel
  this.target = targetModel
  this.options = options
}

// the id is in the target table
HasOne.prototype.injectAttributes = function() {
  var newAttributes = {}
  this.identifier = Utils._.underscoredIf(this.source.tableName + "Id", this.options.underscored)

  newAttributes[this.identifier] = { type: DataTypes.INTEGER }
  Utils._.extend(this.target.attributes, Utils.simplifyAttributes(newAttributes))

  return this
}

HasOne.prototype.injectGetter = function(obj) {
  var self = this
  
  obj[Utils._.camelize('get_' + this.associationName)] = function() {
    var id = obj.id
      , where = {}
    
    where[self.identifier] = id
    return self.target.find({where: where})
  }
  
  return this
}

HasOne.prototype.injectSetter = function(obj) {
  var self = this
  
  obj[Utils._.camelize('set_' + this.associationName)] = function(associatedObject) {
    associatedObject[self.identifier] = self.id
    return associatedObject.save()
  }
  
  return this
}