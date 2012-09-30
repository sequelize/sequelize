if (typeof require === 'function') {
  const buster    = require("buster")
      , Helpers   = require('../buster-helpers')
      , Sequelize = require('../../index')
}

buster.spec.expose()
buster.testRunner.timeout = 500

describe('BelongsTo', function() {
  before(function(done) {
    Helpers.initTests({
      beforeComplete: function(sequelize) {
        this.sequelize = sequelize
      }.bind(this),
      onComplete: done
    })
  })

  describe('setAssociation', function() {
    it('clears the association if null is passed', function(done) {
      var User = this.sequelize.define('User', { username: Sequelize.STRING })
        , Task = this.sequelize.define('Task', { title: Sequelize.STRING })

      Task.belongsTo(User)

      this.sequelize.sync({ force: true }).success(function() {
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
