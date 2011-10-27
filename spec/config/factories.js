var Factories = module.exports = function(helpers) {
  this.helpers = helpers
  this.sequelize = this.helpers.sequelize
}

Factories.prototype.Model = function(modelName, options, callback, count) {
  count = count || 1

  var self = this

  this.helpers.async(function(done) {
    self.sequelize.modelManager.getModel(modelName).create(options).on('success', function(model){
      done()
      --count ? self.Model(modelName, options, callback, count) : (callback && callback(model))
    }).on('failure', function(err) {
      console.log(err)
      done()
    })
  })
}

Factories.prototype.User = function(options, callback, count) {
  this.Model('User', options, callback, count)
}
