if (typeof require === 'function') {
  const buster    = require("buster")
      , Sequelize = require("../../index")
      , Helpers   = require('../buster-helpers')
      , dialects  = Helpers.getSupportedDialects()
}

buster.spec.expose()
buster.testRunner.timeout = 500

dialects.forEach(function(dialect) {
  describe('HasOne@' + dialect, function() {
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
        })
      })
    })
  })
})
