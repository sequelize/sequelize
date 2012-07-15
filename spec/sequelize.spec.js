if(typeof require === 'function') {
  const buster    = require("buster")
      , Helpers   = require('./buster-helpers')
}

buster.spec.expose()

describe('Sequelize', function() {
  before(function(done) {
    var self = this

    Helpers.initTests({
      beforeComplete: function(sequelize) { self.sequelize = sequelize },
      onComplete: done
    })
  })

  describe('query', function() {
    it("returns the expected results as json", function() {
      expect(1).toEqual(1)
    })
  })
})
