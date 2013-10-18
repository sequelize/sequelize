var chai        = require('chai')
  , expect      = chai.expect
  , Support     = require(__dirname + '/support')
  , Transaction = require(__dirname + '/../lib/transaction')

describe(Support.getTestDialectTeaser("Transaction"), function () {
  describe('constructor', function() {
    it('stores options', function() {
      var transaction = new Transaction()
      expect(transaction.options).to.be.an.instanceOf(Object)
    })

    it('generates an identifier', function() {
      var transaction = new Transaction()
      expect(transaction.id).to.exist
    })
  })

  describe('commit', function() {
    it('is a commit message available', function() {
      expect(Transaction).to.respondTo('commit')
    })
  })

  describe('rollback', function() {
    it('is a rollback message available', function() {
      expect(Transaction).to.respondTo('rollback')
    })
  })

  describe('done', function() {
    it('gets called when the transaction gets commited', function(done) {
      var transaction = new Transaction()
      transaction.done(done)
      transaction.commit()
    })
  })
})
