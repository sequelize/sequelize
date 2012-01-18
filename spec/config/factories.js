var Factories = module.exports = function(helpers) {
  this.helpers = helpers
  this.sequelize = this.helpers.sequelize
}

Factories.prototype.Model = function(modelName, options, callback, count) {
  count = count || 1

  var self   = this
    , models = []

  this.helpers.async(function(done) {
    var Model  = self.sequelize.modelFactoryManager.getModel(modelName)

    var create = function(cb) {
      Model.create(options).on('success', function(model) {
        models.push(model)
        cb && cb()
      }).on('failure', function(err) {
        console.log(err)
        done()
      })
    }

    var cb = function() {
      if(--count) {
        create(cb)
      } else {
        done()
        callback && callback(models)
      }
    }

    create(cb)
  })
}

Factories.prototype.User = function(options, callback, count) {
  this.Model('User', options, callback, count)
}
