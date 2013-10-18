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
})
