var ModelManager = module.exports = function() {
  this.models = []
}

ModelManager.prototype.addModel = function(model) {
  this.models.push(model)
  return model
}

ModelManager.prototype.removeModel = function(model) {
  this.models = this.models.filter(function(_model) {
    return _model.name != model.name
  })
}

ModelManager.prototype.__defineGetter__('all', function() {
  return this.models
})