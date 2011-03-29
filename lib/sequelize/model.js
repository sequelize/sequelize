var Utils          = require("./utils")
  , Mixin          = require("./association-mixin")
  , QueryGenerator = require("./query-generator")
  
var Model = module.exports = function(values) {
  var self = this
  
  this.id = null // a newly created model has no id
  
  Utils._.map(values, function(value, key) {
    self[key] = value
  })
}
require("sys").inherits(Model, require('events').EventEmitter);
Utils._.map(Mixin.classMethods, function(fct, name) { Model[name] = fct })

Model.Events = {
  insert: 'InsertQuery',
  update: 'UpdateQuery',
  destroy: 'DestroyQuery'
}

var instanceMethods = {
  save: function() {
    this.isNewRecord ? this.emit(Model.Events.insert, this) : this.emit(Model.Events.update, this)
  },
  destroy: function() {
    this.emit(Model.Events.destroy, this)
  }
}

Model.prototype.__defineGetter__('isNewRecord', function() {
  return this.id == null
})

/* Add the instance methods to Model */
Utils._.map(instanceMethods, function(fct, name) { Model.prototype[name] = fct})
Utils._.map(Mixin.instanceMethods, function(fct, name) { Model.prototype[name] = fct})