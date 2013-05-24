if(typeof require === 'function') {
  const buster  = require("buster")
      , Helpers = require('./buster-helpers')
      , dialect = Helpers.getTestDialect()
}

var qq = function(str) {
  if (dialect == 'postgres' || dialect == 'sqlite') {
    return '"' + str + '"'
  } else if (dialect == 'mysql') {
    return '`' + str + '`'
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
      this.sequelize.query(this.insertQuery, null, { raw: true })
      .complete(function(err, result) {
        if (err) {
          console.log(err)
        }
        expect(err).toBeNull()
        expect(result).toBeNull()
        done()
      })
    })

    it('executes a query if only the sql is passed', function(done) {
      this.sequelize.query(this.insertQuery)
      .complete(function(err, result) {
        if (err) {
          console.log(err)
        }
        expect(err).toBeNull()
        expect(result).not.toBeDefined()
        done()
      })
    })

    it('executes select queries correctly', function(done) {
      this.sequelize.query(this.insertQuery).success(function() {
        this.sequelize
          .query("select * from " + qq(this.User.tableName) + "")
          .complete(function(err, users) {
            if (err) {
              console.log(err)
            }
            expect(err).toBeNull()
            expect(users.map(function(u){ return u.username })).toEqual(['john'])
            done()
          })
      }.bind(this))
    })

    it('executes select query and parses dot notation results', function(done) {
      this.sequelize.query(this.insertQuery).success(function() {
        this.sequelize
          .query("select username as " + qq("user.username") + " from " + qq(this.User.tableName) + "")
          .complete(function(err, users) {
            if (err) {
              console.log(err)
            }
            expect(err).toBeNull()
            expect(users.map(function(u){ return u.user })).toEqual([{'username':'john'}])
            done()
          })
      }.bind(this))
    })

    if (dialect == 'mysql') {
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
    } else {
      console.log('FIXME: I want to be supported in this dialect as well :-(')
    }

    it('uses the passed DAOFactory', function(done) {
      this.sequelize.query(this.insertQuery).success(function() {
        this.sequelize.query("SELECT * FROM " + qq(this.User.tableName) + ";", this.User).success(function(users) {
          expect(users[0].__factory).toEqual(this.User)
          done()
        }.bind(this))
      }.bind(this))
    })

    it('destructs dot separated attributes when doing a raw query', function(done) {
      var tickChar = (dialect === 'postgres') ? '"' : '`'
        , sql      = "select 1 as " + Helpers.Sequelize.Utils.addTicks('foo.bar.baz', tickChar)

      this.sequelize.query(sql, null, { raw: true }).success(function(result) {
        expect(result).toEqual([ { foo: { bar: { baz: 1 } } } ])
        done()
      })
    })

    it('replaces token with the passed array', function(done) {
      this.sequelize.query('select ? as foo, ? as bar', null, { raw: true }, [ 1, 2 ]).success(function(result) {
        expect(result).toEqual([{ foo: 1, bar: 2 }])
        done()
      })
    })
  })

  describe('define', function() {
    [
      { type: Helpers.Sequelize.ENUM, values: ['scheduled', 'active', 'finished']},
      Helpers.Sequelize.ENUM('scheduled', 'active', 'finished')
    ].forEach(function(status) {
      describe('enum', function() {
        before(function(done) {
          this.Review = this.sequelize.define('review', { status: status })
          this.Review.sync({ force: true }).success(done)
        })

        it('raises an error if no values are defined', function() {
          Helpers.assertException(function() {
            this.sequelize.define('omnomnom', {
              bla: { type: Helpers.Sequelize.ENUM }
            })
          }.bind(this), 'Values for ENUM haven\'t been defined.')
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

        it("doesn't save an instance if value is not in the range of enums", function() {
          Helpers.assertException(function() {
            this.Review.create({ status: 'fnord' })
          }.bind(this), 'Value "fnord" for ENUM status is out of allowed scope. Allowed values: scheduled, active, finished')
        })
      })
    })

    describe('table', function() {
      [
        { id: { type: Helpers.Sequelize.BIGINT } },
        { id: { type: Helpers.Sequelize.STRING, allowNull: true } },
        { id: { type: Helpers.Sequelize.BIGINT, allowNull: false, primaryKey: true, autoIncrement: true } }
      ].forEach(function(customAttributes) {

        it('should be able to override options on the default attributes', function(done) {
          var Picture = this.sequelize.define('picture', Helpers.Sequelize.Utils._.cloneDeep(customAttributes))
          Picture.sync({ force: true }).success(function() {
            Object.keys(customAttributes).forEach(function(attribute) {
              Object.keys(customAttributes[attribute]).forEach(function(option) {
                var optionValue = customAttributes[attribute][option];
                expect(Picture.rawAttributes[attribute][option]).toBe(optionValue)
              });
            })
            done()
          })
        })

      })
    })

  })
})
