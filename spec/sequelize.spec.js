if(typeof require === 'function') {
  const buster  = require("buster")
      , Helpers = require('./buster-helpers')
      , dialect = Helpers.getTestDialect()

}

var qq = function(str) {
  if (dialect == 'postgres') {
    return '"' + str + '"'
  } else {
    return str
  }
}

buster.spec.expose()

describe(Helpers.getTestDialectTeaser("Sequelize"), function() {
  before(function(done) {
    Helpers.initTests({
      dialect: dialect,
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

      this.insertQuery = "INSERT INTO " + qq(this.User.tableName) + " (username, " + qq("createdAt") + ", " + qq("updatedAt") + ") VALUES ('john', '2012-01-01 10:10:10', '2012-01-01 10:10:10')"

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
          .query("select * from " + qq(this.User.tableName) + "")
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

    if (dialect == 'mysql')
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
        this.sequelize.query("SELECT * FROM " + qq(this.User.tableName) + ";", this.User).success(function(users) {
          expect(users[0].__factory).toEqual(this.User)
          done()
        }.bind(this))
      }.bind(this))
    })
  })

  describe('define', function() {
    describe('enum', function() {
      before(function(done) {
        this.Review = this.sequelize.define('review', {
          status: { type: Helpers.Sequelize.ENUM, values: ['scheduled', 'active', 'finished']}
        })

        this.Review.sync({ force: true }).success(done)
      })

      it('correctly stores values', function(done) {
        this.Review.create({ status: 'active' }).success(function(review) {
          expect(review.status).toEqual('active')
          done()
        })
      })

      it('correctly loads values', function(done) {
        this.Review.create({ status: 'active' }).success(function() {
          this.Review.findAll().success(function(reviews) {
            expect(reviews[0].status).toEqual('active')
            done()
          })
        }.bind(this))
      })

      itEventually("doesn't save an instance if value is not in the range of enums", function(done) {
        this.Review.create({ status: 'fnord' }).error(function(err) {
          expect(1).toEqual(1)
          done()
        })
      })
    })
  })
})
