if(typeof require === 'function') {
  const buster  = require("buster")
      , Helpers = require('../buster-helpers')
      , dialect = Helpers.getTestDialect()
}

buster.spec.expose()

if (dialect.match(/^postgres/)) {
  describe('[POSTGRES] DAO', function() {
    before(function(done) {
      var self = this

      Helpers.initTests({
        dialect: dialect,
        beforeComplete: function(sequelize, DataTypes) {
          self.sequelize = sequelize

          self.User = sequelize.define('User', {
            username: DataTypes.STRING,
            email: {type: DataTypes.ARRAY(DataTypes.TEXT)}
          })
        },
        onComplete: function() {
          self.User.sync({ force: true }).success(done)
        }
      })
    })

    describe('model', function() {
      it("create handles array correctly", function(done) {
        var self = this

        this.User
          .create({ username: 'user', email: ['foo@bar.com', 'bar@baz.com'] })
          .success(function(oldUser) {
            expect(oldUser.email).toEqual(['foo@bar.com', 'bar@baz.com']);
            done();
          })
          .error(function(err) {
            console.log(err)
          })
      })
    })
  })
}
