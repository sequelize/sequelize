if (typeof require === 'function') {
  const buster    = require("buster")
      , Sequelize = require("../../index")
      , config    = require("../config/config")
      , sequelize = new Sequelize(config.database, config.username, config.password, {
          logging: false
        })
}

buster.spec.expose()
buster.testRunner.timeout = 500

describe('BelongsTo', function() {
  before(function(done) {
    var self = this

    sequelize.getQueryInterface()
      .dropAllTables()
      .success(function() {
        sequelize.daoFactoryManager.daos = []
        done()
      })
      .error(function(err) { console.log(err) })
  })

  describe('setAssociation', function() {
    it('clears the association if null is passed', function(done) {
      var User = sequelize.define('User', { username: Sequelize.STRING })
        , Task = sequelize.define('Task', { title: Sequelize.STRING })

      Task.belongsTo(User)

      sequelize.sync({ force: true }).success(function() {
        User.create({ username: 'foo' }).success(function(user) {
          Task.create({ title: 'task' }).success(function(task) {
            task.setUser(user).success(function() {
              task.getUser().success(function(user) {
                expect(user).not.toEqual(null)

                task.setUser(null).success(function() {
                  task.getUser().success(function(user) {
                    expect(user).toEqual(null)
                    done()
                  })
                })

              })
            })
          })
        })
      })
    })
  })
})
