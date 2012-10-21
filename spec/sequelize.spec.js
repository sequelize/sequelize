if(typeof require === 'function') {
  const buster    = require("buster")
      , Helpers   = require('./buster-helpers')
}

buster.spec.expose()

describe('Sequelize', function() {
  before(function(done) {
    Helpers.initTests({
      beforeComplete: function(sequelize) { this.sequelize = sequelize }.bind(this),
      onComplete: done
    })
  })

  describe('isDefined', function() {
    it("returns false if the dao wasn't defined before", function() {
      expect(this.sequelize.isDefined('Project')).toBeFalse()
    })

    it("returns true if the dao was defined before", function() {
      this.sequelize.define('Project', {
        name: Helpers.Sequelize.STRING
      })
      expect(this.sequelize.isDefined('Project')).toBeTrue()
    })
  })

  describe('query', function() {
    before(function(done) {
      this.User = this.sequelize.define('User', {
        username: Helpers.Sequelize.STRING
      })

      this.User.sync().success(done)
    })

    it('=>executes a query the internal way', function(done) {
      var sql = "INSERT INTO " + this.User.tableName + " (username) VALUES ('john')"
      this.sequelize.query(sql, null, { raw: true }).success(function(result) {
        expect(result).toBeNull()
        done()
      })
    })
  })
})
