if(typeof require === 'function') {
  const buster    = require("buster")
      , Sequelize = require("../index")
      , Helpers   = require('./buster-helpers')
      , dialects  = Helpers.getSupportedDialects()
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
            username:     DataTypes.STRING,
            secretValue:  DataTypes.STRING,
            data:         DataTypes.STRING
          })
        },
        onComplete: function(sequelize) {
          self.User.sync({ force: true }).success(done)
        }
      })
    })

    describe('getOrCreate', function () {
      it("Returns instace if already existent. Single find field.", function (done) {
        var self = this,
          data = {
            username: 'Username'
          };

        this.User.create(data).success(function (user) {
          self.User.getOrCreate({
            username: user.username
          }).success(function (_user) {
            expect(_user.id).toEqual(user.id)
            expect(_user.username).toEqual('Username')
            done()
          })
        })
      })

      it("Returns instace if already existent. Multiple find fields.", function (done) {
        var self = this,
          data = {
            username: 'Username',
            data: 'ThisIsData'
          };

        this.User.create(data).success(function (user) {
          self.User.getOrCreate(data).success(function (_user) {
            expect(_user.id).toEqual(user.id)
            expect(_user.username).toEqual('Username')
            expect(_user.data).toEqual('ThisIsData')
            done()
          })
        })
      })

      it("Creates new instance with default value.", function (done) {
        var self = this,
          data = {
            username: 'Username'
          },
          default_values = {
            data: 'ThisIsData'
          };

        this.User.getOrCreate(data, default_values).success(function (user) {
          expect(user.username).toEqual('Username')
          expect(user.data).toEqual('ThisIsData')
          done()
        })
      })
    })

    describe('create', function() {
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

      it('stores the current date in createdAt', function(done) {
        this.User.create({ username: 'foo' }).success(function(user) {
          expect(parseInt(+user.createdAt/1000)).toEqual(parseInt(+new Date()/1000))
          done()
        })
      })
    })
  })
})
