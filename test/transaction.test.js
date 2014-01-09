var chai        = require('chai')
  , expect      = chai.expect
  , Support     = require(__dirname + '/support')
  , Transaction = require(__dirname + '/../lib/transaction')

describe(Support.getTestDialectTeaser("Transaction"), function () {
  describe('constructor', function() {
    it('stores options', function() {
      var transaction = new Transaction(this.sequelize)
      expect(transaction.options).to.be.an.instanceOf(Object)
    })

    it('generates an identifier', function() {
      var transaction = new Transaction(this.sequelize)
      expect(transaction.id).to.exist
    })
  })

  describe('success', function() {
    it("is a success method available", function() {
      expect(Transaction).to.respondTo("success")
    })
  })

  describe('error', function() {
    it("is an error method available", function() {
      expect(Transaction).to.respondTo("error")
    })
  })

  describe('commit', function() {
    it('is a commit method available', function() {
      expect(Transaction).to.respondTo('commit')
    })
  })

  describe('rollback', function() {
    it('is a rollback method available', function() {
      expect(Transaction).to.respondTo('rollback')
    })
  })

  describe('done', function() {
    it('gets called when the transaction gets commited', function(done) {
      var transaction = new Transaction(this.sequelize)

      transaction.done(done)
      transaction.prepareEnvironment(function() {
        transaction.commit()
      })
    })
  })
})
