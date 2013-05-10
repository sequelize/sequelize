var Toposort = require('toposort-class')

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

  /**
   * Iterate over DAOs in an order suitable for e.g. creating tables. Will
   * take foreign key constraints into account so that dependencies are visited
   * before dependents.
   */
  DAOFactoryManager.prototype.forEachDAO = function(iterator) {
    var daos = {}
      , sorter = new Toposort()

    this.daos.forEach(function(dao) {
      daos[dao.tableName] = dao
      var deps = []

      for(var attrName in dao.rawAttributes) {
        if(dao.rawAttributes.hasOwnProperty(attrName)) {
          if(dao.rawAttributes[attrName].references) {
            deps.push(dao.rawAttributes[attrName].references)
          }
        }
      }

      sorter.add(dao.tableName, deps)
    })

    sorter.sort().reverse().forEach(function(name) {
      iterator(daos[name])
    })
  }

  return DAOFactoryManager
})()
