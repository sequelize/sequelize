if(typeof require === 'function') {
  const buster    = require("buster")
      , Sequelize = require("../index")
      , config    = require("./config/config")
      , dialects  = ['sqlite', 'mysql', 'postgres']
}

buster.spec.expose()

dialects.forEach(function(dialect) {
  describe('DAO@' + dialect, function() {
    before(function(done) {
      var self = this

      this.sequelize = new Sequelize(config.database, config.username, config.password, {
        logging: false
      })

      this.User = this.sequelize.define('User', {
        username: { type: Sequelize.STRING },
        secretValue: Sequelize.STRING
      })

      self.sequelize
        .getQueryInterface()
        .dropAllTables()
        .success(function() {
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
      var data = {
        username: 'Peter',
        secretValue: '42'
      }

      it('should only store the values passed in the witelist', function(done) {
        var self = this;
        this.User.create(data, ['username']).success(function(user) {
          self.User.find(user.id).success(function(_user) {
            expect(_user.username).toEqual(data.username);
            expect(_user.secretValue).not.toEqual(data.secretValue);
            done();  
          })
        })
      })

      it('should store all values if no whitelist is specified', function(done) {
        var self = this;
        this.User.create(data).success(function(user) {
          self.User.find(user.id).success(function(_user) {
            expect(_user.username).toEqual(data.username);
            expect(_user.secretValue).toEqual(data.secretValue);
            done();  
          })
        })
      })
    })
  })
})
