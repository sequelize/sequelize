var Utils = require("./utils")
  , Mixin = require("./association-mixin")

/*
  Defines the connection between data and the sql table.
  Parameters:
    - name: the name of the model
    - attributes: A name-datatype-hash -> {name: 'VARCHAR(255)', id: "INT"}
  Options:
    -
*/
var Model = module.exports = function(name, attributes, options) {
  this.name = name
  this.attributes = attributes
  this.options = options || {}
}

var classMethods = {
  sync: function() {
    
  },
  drop: function() {
    
  }
}

var instanceMethods = {
  save: function() {
    
  },
  destroy: function() {
    
  }
}

Utils._.map(classMethods, function(fct, name) { Model[name] = fct })
Utils._.map(instanceMethods, function(fct, name) { Model.prototype[name] = fct})
Utils._.map(Mixin.classMethods, function(fct, name) { Model[name] = fct })
Utils._.map(Mixin.instanceMethods, function(fct, name) { Model.prototype[name] = fct})