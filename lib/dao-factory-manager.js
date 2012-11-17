module.exports = (function() {
  var DAOFactoryManager = function(sequelize) {
    this.daos = []
    this.sequelize = sequelize
  }

  DAOFactoryManager.prototype.addDAO = function(dao) {
    this.daos.push(dao)

    return dao
  }

  DAOFactoryManager.prototype.removeDAO = function(dao) {
    this.daos = this.daos.filter(function(_dao) {
      return _dao.name != dao.name
    })
  }

  DAOFactoryManager.prototype.getDAO = function(daoName, options) {
    options = options || {}
    options.attribute = options.attribute || 'name'

    var dao = this.daos.filter(function(dao) {
      return dao[options.attribute] === daoName
    })

    return !!dao ? dao[0] : null
  }

  DAOFactoryManager.prototype.__defineGetter__('all', function() {
    return this.daos
  })

  return DAOFactoryManager
})()
