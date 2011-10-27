var Factories = module.exports = function(helpers) {
  this.helpers = helpers
  this.sequelize = this.helpers.sequelize
}

Factories.prototype.Model = function(modelName, options, callback, count) {
  count = count || 1

  var self = this

  this.sequelize.modelManager.getModel(modelName).create(options).on('success', function(model){
    --count ? self.Model(modelName, options, callback, count) : callback(model)
  }).on('failure', function(err) {
    console.log(err)
  })
}

Factories.prototype.User = function(options, callback, count) {
  this.Model('User', options, callback, count)
}
