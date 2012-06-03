if(typeof require === 'function') {
  const buster    = require("buster")
      , Sequelize = require("../../index")
      , config    = require("../config/config")
}

buster.spec.expose()

describe('DAO@sqlite', function() {
  before(function(done) {
    var self = this

    this.sequelize = new Sequelize(config.database, config.username, config.password, {
      logging: false,
      dialect: 'sqlite'
    })

    this.User = this.sequelize.define('User', {
      username: Sequelize.STRING
    })

    self.sequelize
      .getQueryInterface()
      .dropAllTables()
      .success(function() {
        self.User.sync({ force: true }).success(done)
      })
      .error(function(err) { console.log(err) })
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
