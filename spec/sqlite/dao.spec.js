if(typeof require === 'function') {
  const buster  = require("buster")
      , Helpers = require('../buster-helpers')
      , dialect = Helpers.getTestDialect()
}

buster.spec.expose()

if (dialect === 'sqlite') {
  describe('[SQLITE] DAO', function() {
    before(function(done) {
      var self = this

      Helpers.initTests({
        dialect: 'sqlite',
        beforeComplete: function(sequelize, DataTypes) {
          self.sequelize = sequelize

          self.User = sequelize.define('User', {
            username: DataTypes.STRING
          })
        },
        onComplete: function() {
          self.User.sync({ force: true }).success(done)
        }
      })
    })

    describe('findAll', function() {
      it("handles dates correctly", function(done) {
        var self = this

        this.User
          .create({ username: 'user', createdAt: new Date(2011, 04, 04) })
          .success(function(oldUser) {
            self.User
              .create({ username: 'new user' })
              .success(function(newUser) {
                self.User.findAll({
                  where: ['createdAt > ?', new Date(2012, 01, 01)]
                }).success(function(users) {
                  expect(users.length).toEqual(1)
                  done()
                })
              })
          })
          .error(function(err) {
            console.log(err)
          })
      })
    })
  })
}
