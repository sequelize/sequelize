var chai   = require('chai')
  , expect = chai.expect
  , Utils  = require(__dirname + '/../lib/utils')

describe("Utils", function() {
  describe('removeCommentsFromFunctionString', function() {
    it("removes line comments at the start of a line", function() {
      var functionWithLineComments = function() {
        // noot noot
      }

      var string = functionWithLineComments.toString()
        , result = Utils.removeCommentsFromFunctionString(string)

      expect(result).not.to.match(/.*noot.*/)
    })
  })
})
