var Utils     = require("./../utils")
  , DataTypes = require('./../data-types')

var HasOne = module.exports = function(srcModel, targetModel, options) {
  this.source = srcModel
  this.target = targetModel
  this.options = options
  this.accessors = {
    get: Utils._.camelize('get_' + (this.options.as || this.target.tableName)),
    set: Utils._.camelize('set_' + (this.options.as || this.target.tableName))
  }
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
  var self = this

  obj[this.accessors.get] = function() {
    var id    = obj.id
      , where = {}
    
    where[self.identifier] = id
    return self.target.find({where: where})
  }
  
  return this
}

HasOne.prototype.injectSetter = function(obj) {
  var self = this
  
  obj[this.accessors.set] = function(associatedObject) {
    var customEventEmitter = new Utils.CustomEventEmitter(function() {
      obj[self.accessors.get]().on('success', function(oldObj) {
        if(oldObj) {
          oldObj[self.identifier] = null
          oldObj.save()
        }

        associatedObject[self.identifier] = obj.id
        associatedObject.save()
        .on('success', function() { customEventEmitter.emit('success', '') })
        .on('failure', function(err) { customEventEmitter.emit('failure', err) })
      })
    })
    return customEventEmitter.run()
  }
  
  return this
}