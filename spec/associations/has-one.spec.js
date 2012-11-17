if (typeof require === 'function') {
  const buster    = require("buster")
      , Sequelize = require("../../index")
      , Helpers   = require('../buster-helpers')
      , dialect   = Helpers.getTestDialect()
}

buster.spec.expose()
buster.testRunner.timeout = 1500

describe("[" + Helpers.getTestDialectTeaser() + "] HasOne", function() {
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
      var User = this.sequelize.define('UserXYZ', { username: Sequelize.STRING })
        , Task = this.sequelize.define('TaskXYZ', { title: Sequelize.STRING })

      User.hasOne(Task)

      this.sequelize.sync({ force: true }).success(function() {
        User.create({ username: 'foo' }).success(function(user) {
          Task.create({ title: 'task' }).success(function(task) {
            user.setTaskXYZ(task).success(function() {
              user.getTaskXYZ().success(function(task) {
                expect(task).not.toEqual(null)

                user.setTaskXYZ(null).success(function() {
                  user.getTaskXYZ().success(function(task) {
                    expect(task).toEqual(null)
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
