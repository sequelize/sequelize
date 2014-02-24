var chai        = require('chai')
  , expect      = chai.expect
  , Support     = require(__dirname + '/support')
  , Transaction = require(__dirname + '/../lib/transaction')

describe(Support.getTestDialectTeaser("Sequelize#transaction"), function () {
  describe('success', function() {
    it("gets triggered once a transaction has been successfully committed", function(done) {
      this
        .sequelize
        .transaction(function(t) { t.commit() })
        .success(function() { done() })
    })

    it("gets triggered once a transaction has been successfully rollbacked", function(done) {
      this
        .sequelize
        .transaction(function(t) { t.rollback() })
        .success(function() { done() })
    })

    it('works for long running transactions', function(done) {
      Support.prepareTransactionTest(this.sequelize, function(sequelize) {
        var User = sequelize.define('User', {
          name: Support.Sequelize.STRING
        }, { timestamps: false })

        sequelize.sync({ force: true }).success(function() {
          sequelize
            .transaction(function(t) {
              var query = 'select sleep(2);'

              switch(Support.getTestDialect()) {
                case 'postgres':
                  query = 'select pg_sleep(2);'
                  break
                case 'sqlite':
                  query = 'select sqlite3_sleep(2);'
                  break
                default:
                  break
              }

              sequelize.query(query, null, {
                raw: true,
                plain: true,
                transaction: t
              }).done(function() {
                var dao = User.build({ name: 'foo' })


                // this.QueryGenerator.insertQuery(tableName, values, dao.daoFactory.rawAttributes)
                query = sequelize
                  .getQueryInterface()
                  .QueryGenerator
                  .insertQuery(User.tableName, dao.values, User.rawAttributes)

                setTimeout(function() {
                  sequelize.query(query, null, {
                    raw: true,
                    plain: true,
                    transaction: t
                  }).done(function(err, res) {
                    t.commit()
                  })
                }, 2000)
              })
            })
            .success(function() {
              User.all().success(function(users) {
                expect(users.length).to.equal(1)
                expect(users[0].name).to.equal('foo')

                done()
              })
            })
          })
        })
      })
  })

  describe('error', function() {
    if (Support.getTestDialect() === 'sqlite') {
      // not sure if we can test this in sqlite ...
      // how could we enforce an authentication error in sqlite?
    } else {
      it("gets triggered once an error occurs", function(done) {
        var sequelize = Support.createSequelizeInstance({ dialect: Support.getTestDialect() })

        // lets overwrite the host to get an error
        sequelize.config.username = 'foobarbaz'

        sequelize
          .transaction(function() {})
          .error(function(err) {
            expect(err).to.not.be.undefined
            done()
          })
      })
    }
  })

  describe('callback', function() {
    it("receives the transaction if only one argument is passed", function(done) {
      this.sequelize.transaction(function(t) {
        expect(t).to.be.instanceOf(Transaction)
        t.commit()
      }).done(done)
    })

    it("receives an error and the transaction if two arguments are passed", function(done) {
      this.sequelize.transaction(function(err, t) {
        expect(err).to.not.be.instanceOf(Transaction)
        expect(t).to.be.instanceOf(Transaction)
        t.commit()
      }).done(done)
    })
  })

  describe('complex long running example', function() {
    it("works", function(done) {
      var sequelize   = this.sequelize

      var Test = sequelize.define('Test', {
        id:   { type: Support.Sequelize.INTEGER, primaryKey: true, autoIncrement: true},
        name: { type: Support.Sequelize.STRING }
      })

      sequelize
        .sync({ force: true })
        .then(function() {
          sequelize.transaction(function(transaction) {
            Test
              .create({ name: 'Peter' }, { transaction: transaction })
              .then(function() {
                setTimeout(function() {
                  transaction
                    .commit()
                    .then(function() {
                      return Test.count({ transaction: transaction })
                    })
                    .then(function(count) {
                      expect(count).to.equal(1)
                      done()
                    })
                }, 1000)
              })
          })
        })
    })
  })
})
