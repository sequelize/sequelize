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

  describe('underscore', function() {
    describe('underscoredIf', function() {
      it('is defined', function() {
        expect(Utils._.underscoredIf).toBeDefined()
      })

      it('underscores if second param is true', function() {
        expect(Utils._.underscoredIf('fooBar', true)).toEqual('foo_bar')
      })

      it("doesn't underscore if second param is false", function() {
        expect(Utils._.underscoredIf('fooBar', false)).toEqual('fooBar')
      })
    })

    describe('camelizeIf', function() {
      it('is defined', function() {
        expect(Utils._.camelizeIf).toBeDefined()
      })

      it('camelizes if second param is true', function() {
        expect(Utils._.camelizeIf('foo_bar', true)).toEqual('fooBar')
      })

      it("doesn't camelize if second param is false", function() {
        expect(Utils._.underscoredIf('fooBar', true)).toEqual('foo_bar')
      })
    })
  })
})
