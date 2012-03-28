if(typeof require === 'function') {
  const buster = require("buster")
      , Sequelize = require("../../index")
      , config    = require("../config")
      console.log(Sequelize)
}

buster.spec.expose()

describe('SQLite', function() {
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

  describe('DAO', function() {
    describe('findAll', function() {
      it("handles dates correctly", function() {

      })
    })
  })
})
