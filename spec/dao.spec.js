if(typeof require === 'function') {
  const buster   = require("buster")
      , dialects = ['sqlite', 'mysql', 'postgres']
      , Helpers  = require('./buster-helpers')
}

buster.spec.expose()

dialects.forEach(function(dialect) {
  describe('DAO@' + dialect, function() {
    before(function(done) {
      var self = this

      Helpers.initTests({
        dialect: dialect,
        beforeComplete: function(sequelize, DataTypes) {
          self.sequelize = sequelize
          self.User      = sequelize.define('User', {
            username:  { type: DataTypes.STRING },
            touchedAt: { type: DataTypes.DATE, defaultValue: DataTypes.NOW },
            aNumber:   { type: DataTypes.INTEGER }
          })
        },
        onComplete: function(sequelize) {
          self.User.sync({ force: true }).success(done)
        }
      })
    })

    describe('default values', function() {
      describe('current date', function() {
        it('should store a date in touchedAt', function() {
          var user = this.User.build({ username: 'a user'})
          expect(user.touchedAt instanceof Date).toBeTrue()
        })

        it("should store the current date in touchedAt", function() {
          this.useFakeTimers().tick(5000)

          var user = this.User.build({ username: 'a user'})
          expect(+user.touchedAt).toBe(5000)
        })
      })
    })

    describe('complete', function() {
      it("gets triggered if an error occurs", function(done) {
        this.User.find({ where: "asdasdasd" }).complete(function(err, result) {
          expect(err).toBeDefined()
          expect(err.message).toBeDefined()
          done()
        })
      })

      it("gets triggered if everything was ok", function(done) {
        this.User.count().complete(function(err, result) {
          expect(err).toBeNull()
          expect(result).toBeDefined()
          done()
        })
      })
    })

    describe('save', function() {
      it('takes zero into account', function(done) {
        this.User.build({ aNumber: 0 }).save([ 'aNumber' ]).success(function(user) {
          expect(user.aNumber).toEqual(0)
          done()
        })
      })
    })

    describe('toJSON', function toJSON() {
      before(function(done) {
        this.User = this.sequelize.define('UserWithUsernameAndAgeAndIsAdmin', {
          username: Helpers.Sequelize.STRING,
          age:      Helpers.Sequelize.INTEGER,
          isAdmin:  Helpers.Sequelize.BOOLEAN
        }, {
          timestamps: false,
          logging: true
        })

        this.User.sync({ force: true }).success(done)
      })

      it('returns an object containing all values', function() {
        var user = this.User.build({ username: 'test.user', age: 99, isAdmin: true })
        expect(user.toJSON()).toEqual({ username: 'test.user', age: 99, isAdmin: true, id: null })
      })

      it('returns a response that can be stringified', function() {
        var user = this.User.build({ username: 'test.user', age: 99, isAdmin: true })
        expect(JSON.stringify(user)).toEqual('{"username":"test.user","age":99,"isAdmin":true,"id":null}')
      })

      it('returns a response that can be stringified and then parsed', function() {
        var user = this.User.build({ username: 'test.user', age: 99, isAdmin: true })
        expect(JSON.parse(JSON.stringify(user))).toEqual({ username: 'test.user', age: 99, isAdmin: true, id: null })
      })
    })
  })
})
