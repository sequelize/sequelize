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
            email: {type: DataTypes.ARRAY(DataTypes.TEXT)},
            document: {type: DataTypes.HSTORE, defaultValue: 'default=>value'}
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
            expect(oldUser.email).toEqual(['foo@bar.com', 'bar@baz.com'])
            done()
          })
          .error(function(err) {
            console.log(err)
          })
      })

      it("should handle hstore correctly", function(done) {
        var self = this

        this.User
          .create({ username: 'user', email: ['foo@bar.com'], document: {hello: 'world'}})
          .success(function(newUser) {
            expect(newUser.document).toEqual({hello: 'world'})
            // Check to see if updating an hstore field works
            newUser.updateAttributes({document: {should: 'update', to: 'this', first: 'place'}}).success(function(oldUser){
              // Postgres always returns keys in alphabetical order (ascending)
              expect(oldUser.document).toEqual({first: 'place', should: 'update', to: 'this'})
              // Check to see if the default value for an hstore field works
              self.User.create({ username: 'user2', email: ['bar@baz.com']}).success(function(defaultUser){
                expect(defaultUser.document).toEqual({default: 'value'})
                done()
              })
            })
          })
          .error(console.log)
      })
    })
  })
}
