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
  })

  describe('error', function() {
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
})
