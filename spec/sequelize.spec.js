if(typeof require === 'function') {
  const buster  = require("buster")
      , Helpers = require('./buster-helpers')
      , dialect = Helpers.getTestDialect()

}

buster.spec.expose()

describe("[" + Helpers.getTestDialectTeaser() + "] Sequelize", function() {
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

      this.insertQuery = "INSERT INTO " + this.User.tableName + " (username, createdAt, updatedAt) VALUES ('john', '2012-01-01 10:10:10', '2012-01-01 10:10:10')"

      this.User.sync().success(done).error(function(err) {
        console(err)
        done()
      })
    })

    it('executes a query the internal way', function(done) {
      this.sequelize.query(this.insertQuery, null, { raw: true }).success(function(result) {
        expect(result).toBeNull()
        done()
      })
      .error(function(err) {
        console.log(err)
        expect(err).not.toBeDefined()
        done()
      })
    })

    it('executes a query if only the sql is passed', function(done) {
      this.sequelize.query(this.insertQuery).success(function(result) {
        expect(result).not.toBeDefined()
        done()
      })
      .error(function(err) {
        console.log(err)
        expect(err).not.toBeDefined()
        done()
      })
    })

    it('executes select queries correctly', function(done) {
      this.sequelize.query(this.insertQuery).success(function() {
        this.sequelize
          .query("select * from " + this.User.tableName)
          .success(function(users) {
            expect(users.map(function(u){ return u.username })).toEqual(['john'])
            done()
          })
          .error(function(err) {
            console.log(err)
            expect(err).not.toBeDefined()
            done()
          })
      }.bind(this))
    })

    it('executes stored procedures', function(done) {
      this.sequelize.query(this.insertQuery).success(function() {
        this.sequelize.query('DROP PROCEDURE IF EXISTS foo').success(function() {
          this.sequelize.query(
            "CREATE PROCEDURE foo()\nSELECT * FROM " + this.User.tableName + ";"
          ).success(function() {
            this.sequelize.query('CALL foo()').success(function(users) {
              expect(users.map(function(u){ return u.username })).toEqual(['john'])
              done()
            })
          }.bind(this))
        }.bind(this))
      }.bind(this))
    })

    it('uses the passed DAOFactory', function(done) {
      this.sequelize.query(this.insertQuery).success(function() {
        this.sequelize.query("SELECT * FROM " + this.User.tableName + ";", this.User).success(function(users) {
          expect(users[0].__factory).toEqual(this.User)
          done()
        }.bind(this))
      }.bind(this))
    })
  })
})
