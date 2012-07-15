if(typeof require === 'function') {
  const buster    = require("buster")
      , Sequelize = require("../index")
      , Helpers   = require('./buster-helpers')
      , dialects  = ['sqlite', 'mysql', 'postgres']
}

buster.spec.expose()

dialects.forEach(function(dialect) {
  describe('DAOFactory@' + dialect, function() {
    before(function(done) {
      var self = this

      Helpers.initTests({
        dialect: dialect,
        beforeComplete: function(sequelize, DataTypes) {
          self.sequelize = sequelize
          self.User      = sequelize.define('User', {
            username:  { type: DataTypes.STRING },
            touchedAt: { type: DataTypes.DATE, defaultValue: DataTypes.NOW }
          })
        },
        onComplete: function(sequelize) {
          self.User.sync({ force: true }).success(done)
        }
      })
    })

    describe('create', function() {
      before(function(done) {
        this.User = this.sequelize.define('User', {
          username: Sequelize.STRING,
          secretValue: Sequelize.STRING,
          data: Sequelize.STRING
        })

        this.User
          .sync({ force: true })
          .success(done)
          .error(function(err) { console.log(err) })
      })

      it('should only store the values passed in the witelist', function(done) {
        var self = this
          , data = { username: 'Peter', secretValue: '42' }

        this.User.create(data, ['username']).success(function(user) {
          self.User.find(user.id).success(function(_user) {
            expect(_user.username).toEqual(data.username)
            expect(_user.secretValue).not.toEqual(data.secretValue)
            expect(_user.secretValue).toEqual(null)
            done()
          })
        })
      })

      it('should store all values if no whitelist is specified', function(done) {
        var self = this
          , data = { username: 'Peter', secretValue: '42' }

        this.User.create(data).success(function(user) {
          self.User.find(user.id).success(function(_user) {
            expect(_user.username).toEqual(data.username)
            expect(_user.secretValue).toEqual(data.secretValue)
            done()
          })
        })
      })

      it('saves data with single quote', function(done) {
        var quote = "single'quote"
          , self  = this

        this.User.create({ data: quote }).success(function(user) {
          expect(user.data).toEqual(quote, 'memory single quote')

          self.User.find({where: { id: user.id }}).success(function(user) {
            expect(user.data).toEqual(quote, 'SQL single quote')
            done()
          })
        })
      })

      it('saves data with double quote', function(done) {
        var quote = 'double"quote'
          , self  = this

        this.User.create({ data: quote }).success(function(user) {
          expect(user.data).toEqual(quote, 'memory double quote')

          self.User.find({where: { id: user.id }}).success(function(user) {
            expect(user.data).toEqual(quote, 'SQL double quote')
            done()
          })
        })
      })

      it('saves stringified JSON data', function(done) {
        var json = JSON.stringify({ key: 'value' })
          , self = this

        this.User.create({ data: json }).success(function(user) {
          expect(user.data).toEqual(json, 'memory data')
          self.User.find({where: { id: user.id }}).success(function(user) {
            expect(user.data).toEqual(json, 'SQL data')
            done()
          })
        })
      })
    })
  })
})
