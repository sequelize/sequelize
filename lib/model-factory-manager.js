module.exports = (function() {
  var ModelFactoryManager = function(sequelize) {
    this.models = []
    this.sequelize = sequelize
  }

  ModelFactoryManager.prototype.addModel = function(model) {
    this.models.push(model)

    return model
  }

  ModelFactoryManager.prototype.removeModel = function(model) {
    this.models = this.models.filter(function(_model) {
      return _model.name != model.name
    })
  }

  ModelFactoryManager.prototype.getModel = function(modelName) {
    var model = this.models.filter(function(model) {
      return model.name == modelName
    })

    return !!model ? model[0] : null
  }

  ModelFactoryManager.prototype.__defineGetter__('all', function() {
    return this.models
  })

  return ModelFactoryManager
})()
