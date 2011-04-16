var Utils     = require("./../utils")
  , DataTypes = require('./../data-types')

var HasOne = module.exports = function(srcModel, targetModel, options) {
  this.source = srcModel
  this.target = targetModel
  this.options = options
}

// the id is in the target table
HasOne.prototype.injectAttributes = function() {
  var newAttributes = {}
  
  this.identifier = this.options.foreignKey || Utils._.underscoredIf(this.source.tableName + "Id", this.options.underscored)
  newAttributes[this.identifier] = { type: DataTypes.INTEGER }
  Utils._.extend(this.target.attributes, Utils.simplifyAttributes(newAttributes))

  return this
}

HasOne.prototype.injectGetter = function(obj) {
  var self     = this
    , accessor = Utils._.camelize('get_' + (this.options.as || this.target.tableName))

  obj[accessor] = function() {
    var id    = obj.id
      , where = {}
    
    where[self.identifier] = id
    return self.target.find({where: where})
  }
  
  return this
}

HasOne.prototype.injectSetter = function(obj) {
  var self     = this
    , accessor = Utils._.camelize('set_' + (this.options.as || this.target.tableName))
  
  obj[accessor] = function(associatedObject) {
    associatedObject[self.identifier] = this.id
    return associatedObject.save()
  }
  
  return this
}