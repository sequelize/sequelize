if (typeof require === 'function') {
  const buster    = require("buster")
      , Sequelize = require("../../index")
      , Helpers   = require('../buster-helpers')
      , dialect   = Helpers.getTestDialect()
}

buster.spec.expose()
buster.testRunner.timeout = 1500

describe("[" + dialect.toUpperCase() + "] HasOne", function() {
  before(function(done) {
    var self = this

    Helpers.initTests({
      dialect: dialect,
      beforeComplete: function(sequelize) { self.sequelize = sequelize },
      onComplete: done
    })
  })

  describe('setAssociation', function() {
    it('clears the association if null is passed', function(done) {
      var User = this.sequelize.define('User', { username: Sequelize.STRING })
        , Task = this.sequelize.define('Task', { title: Sequelize.STRING })

      User.hasOne(Task)

      this.sequelize.sync({ force: true }).success(function() {
        setTimeout(function(){
          User.create({ username: 'foo' }).success(function(user) {
            Task.create({ title: 'task' }).success(function(task) {
              user.setTask(task).success(function() {
                user.getTask().success(function(task) {
                  expect(task).not.toEqual(null)

                  user.setTask(null).success(function() {
                    user.getTask().success(function(task) {
                      expect(task).toEqual(null)
                      done()
                    })
                  })

                })
              })
            })
          })
        }.bind(this), 500)
      })
    })
  })
})
