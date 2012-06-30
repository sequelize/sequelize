var Factories = module.exports = function(helpers) {
  this.helpers = helpers
  this.sequelize = this.helpers.sequelize
}

Factories.prototype.DAO = function(daoName, options, callback, count) {
  count = count || 1

  var self   = this
    , daos = []

  this.helpers.async(function(done) {
    var DAO  = self.sequelize.daoFactoryManager.getDAO(daoName)

    var create = function(cb) {
      DAO.create(options).on('success', function(dao) {
        daos.push(dao)
        cb && cb()
      }).on('error', function(err) {
        console.log(err)
        done()
      })
    }

    var cb = function() {
      if(--count) {
        create(cb)
      } else {
        done()
        callback && callback(daos)
      }
    }

    create(cb)
  })
}

Factories.prototype.User = function(options, callback, count) {
  this.DAO('User', options, callback, count)
}
