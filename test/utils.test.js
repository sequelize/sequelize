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

    it("removes lines comments in the middle of a line", function() {
      var functionWithLineComments = function() {
        alert(1) // noot noot
      }

      var string = functionWithLineComments.toString()
        , result = Utils.removeCommentsFromFunctionString(string)

      expect(result).not.to.match(/.*noot.*/)
    })

    it("removes range comments", function() {
      var s = function() {
        alert(1) /*
          noot noot
        */
        alert(2) /*
          foo
        */
      }.toString()

      var result = Utils.removeCommentsFromFunctionString(s)

      expect(result).not.to.match(/.*noot.*/)
      expect(result).not.to.match(/.*foo.*/)
      expect(result).to.match(/.*alert\(2\).*/)
    })
  })
})
