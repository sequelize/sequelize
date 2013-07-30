var chai      = require('chai')
  , expect    = chai.expect
  , Support   = require(__dirname + '/../support')
  , DataTypes = require(__dirname + "/../../lib/data-types")
  , dialect   = Support.getTestDialect()

chai.Assertion.includeStack = true

if (dialect === 'sqlite') {
  describe('[SQLITE Specific] DAO', function() {
    beforeEach(function(done) {
      this.User = this.sequelize.define('User', {
        username: DataTypes.STRING
      })
      this.User.sync({ force: true }).success(function() {
        done()
      })
    })

    describe('findAll', function() {
      it("handles dates correctly", function(done) {
        var self = this

        this.User
          .create({ username: 'user', createdAt: new Date(2011, 04, 04) })
          .success(function() {
            self.User.create({ username: 'new user' }).success(function() {
              self.User.findAll({
                where: ['createdAt > ?', new Date(2012, 01, 01)]
              }).success(function(users) {
                expect(users).to.have.length(1)
                done()
              })
            })
          })
      })
    })
  })
}
