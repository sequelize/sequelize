if(typeof require === 'function') {
  const buster    = require("buster")
      , Sequelize = require("../index")
      , config    = require("./config/config")
      , dialects  = ['sqlite', 'mysql', 'postgres']
}

buster.spec.expose()

dialects.forEach(function(dialect) {
  describe('DAOFactory@' + dialect, function() {
    before(function(done) {
      var self = this

      this.sequelize = new Sequelize(config.database, config.username, config.password, {
        logging: false
      })

      this.User = this.sequelize.define('User', {
        username: Sequelize.STRING,
        secretValue: Sequelize.STRING
      })

      self.sequelize
        .getQueryInterface()
        .dropAllTables()
        .success(function() {
          self.sequelize.daoFactoryManager.daos = []
          self.User
            .sync({ force: true })
            .success(done)
            .error(function(err) {
              console.log(err)
            })
        })
        .error(function(err) { console.log(err) })
    })

    describe('create with whitelist', function() {
      before(function() {
        this.data = {
          username: 'Peter',
          secretValue: '42'
        }
      })

      it('should only store the values passed in the witelist', function(done) {
        var self = this;

        this.User.create(this.data, ['username']).success(function(user) {
          self.User.find(user.id).success(function(_user) {
            expect(_user.username).toEqual(self.data.username);
            expect(_user.secretValue).not.toEqual(self.data.secretValue);
            expect(_user.secretValue).toEqual(null);
            done();
          })
        })
      })

      it('should store all values if no whitelist is specified', function(done) {
        var self = this;

        this.User.create(this.data).success(function(user) {
          self.User.find(user.id).success(function(_user) {
            expect(_user.username).toEqual(self.data.username);
            expect(_user.secretValue).toEqual(self.data.secretValue);
            done();
          })
        })
      })
    })
  })
})
