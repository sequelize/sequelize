var ModelManager = module.exports = function(sequelize) {
  this.models = []
  this.sequelize = sequelize
}

ModelManager.prototype.addModel = function(model) {
  model.modelManager = this
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