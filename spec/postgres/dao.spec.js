var buster  = require("buster")
  , Helpers = require('../buster-helpers')
  , dialect = Helpers.getTestDialect()
  , DataTypes = require(__dirname + "/../../lib/data-types")

buster.spec.expose()
buster.testRunner.timeout = 1000

if (dialect.match(/^postgres/)) {
  describe('[POSTGRES Specific] DAO', function() {
    var sequelize = Helpers.createSequelizeInstance({dialect: dialect})

    before(function(done) {
      var self = this
      this.sequelize = sequelize
      Helpers.clearDatabase(this.sequelize, function() {
        self.User = sequelize.define('User', {
          username: DataTypes.STRING,
          email: {type: DataTypes.ARRAY(DataTypes.TEXT)},
          document: {type: DataTypes.HSTORE, defaultValue: '"default"=>"value"'}
        })
        self.User.sync({ force: true }).success(done)
      })
    })

    describe('model', function() {
      it("create handles array correctly", function(done) {
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
          .create({ username: 'user', email: ['foo@bar.com'], document: { created: { test: '"value"' }}})
          .success(function(newUser) {
            expect(newUser.document).toEqual({ created: { test: '"value"' }})

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

    describe('[POSTGRES] Unquoted identifiers', function() {
      before(function(done) {
        var self = this
        this.sequelize.options.quoteIdentifiers = false

        self.User = this.sequelize.define('User', {
          username: DataTypes.STRING,
          fullName: DataTypes.STRING // Note mixed case
        })

        self.User.sync({ force: true }).success(done)
      })

      after(function(done) {
        this.sequelize.options.quoteIdentifiers = true
        done()
      })

      it("can insert and select", function(done) {
        var self = this

        self.User
          .create({ username: 'user', fullName: "John Smith" })
          .success(function(user) {
            // We can insert into a table with non-quoted identifiers
            expect(user.id).toBeDefined()
            expect(user.id).not.toBeNull()
            expect(user.username).toEqual('user')
            expect(user.fullName).toEqual('John Smith')

            // We can query by non-quoted identifiers
            self.User.find({
              where: {fullName: "John Smith"}
            })
            .success(function(user2) {
              // We can map values back to non-quoted identifiers
              expect(user2.id).toEqual(user.id)
              expect(user2.username).toEqual('user')
              expect(user2.fullName).toEqual('John Smith')
              done();
            })
          })
      })
    })
  })
}
