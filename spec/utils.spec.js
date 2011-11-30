var Utils = require('../lib/utils')

describe('Utils', function() {
  describe('removeCommentsFromFunctionString', function() {
    it("removes line comments at the start of a line", function() {
      var functionWithLineComments = function() {
        // noot noot
      }

      var result = Utils.removeCommentsFromFunctionString(functionWithLineComments.toString())
      expect(result).toNotMatch(/.*noot.*/)
    })

    it("removes lines comments in the middle of a line", function() {
      var functionWithLineComments = function() {
        alert(1) // noot noot
      }

      var result = Utils.removeCommentsFromFunctionString(functionWithLineComments.toString())
      expect(result).toNotMatch(/.*noot.*/)
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
      expect(result).toNotMatch(/.*noot.*/)
      expect(result).toNotMatch(/.*foo.*/)
      expect(result).toMatch(/.*alert\(2\).*/)
    })
  })
})
