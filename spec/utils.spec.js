var buster  = require("buster")
  , Utils   = require('../lib/utils')
  , Helpers   = require('./buster-helpers')

buster.spec.expose()
buster.testRunner.timeout = 1000

describe(Helpers.getTestDialectTeaser("Utils"), function() {
  describe('removeCommentsFromFunctionString', function() {
    it("removes line comments at the start of a line", function(done) {
      var functionWithLineComments = function() {
        // noot noot
      }

      var result = Utils.removeCommentsFromFunctionString(functionWithLineComments.toString())
      expect(result).not.toMatch(/.*noot.*/)
      done()
    })

    it("removes lines comments in the middle of a line", function(done) {
      var functionWithLineComments = function() {
        alert(1) // noot noot
      }

      var result = Utils.removeCommentsFromFunctionString(functionWithLineComments.toString())
      expect(result).not.toMatch(/.*noot.*/)
      done()
    })

    it("removes range comments", function(done) {
      var s = function() {
        alert(1) /*
          noot noot
        */
        alert(2) /*
          foo
        */
      }.toString()

      var result = Utils.removeCommentsFromFunctionString(s)
      expect(result).not.toMatch(/.*noot.*/)
      expect(result).not.toMatch(/.*foo.*/)
      expect(result).toMatch(/.*alert\(2\).*/)
      done()
    })
  })

  describe('argsArePrimaryKeys', function() {
    it("doesn't detect primary keys if primareyKeys and values have different lengths", function(done) {
      expect(Utils.argsArePrimaryKeys([1,2,3], [1])).toBeFalsy()
      done()
    })

    it("doesn't detect primary keys if primary keys are hashes or arrays", function(done) {
      expect(Utils.argsArePrimaryKeys([[]], [1])).toBeFalsy()
      done()
    })

    it('detects primary keys if length is correct and data types are matching', function(done) {
      expect(Utils.argsArePrimaryKeys([1,2,3], ["INTEGER", "INTEGER", "INTEGER"])).toBeTruthy()
      done()
    })

    it("detects primary keys if primary keys are dates and lengths are matching", function(done) {
      expect(Utils.argsArePrimaryKeys([new Date()], ['foo'])).toBeTruthy()
      done()
    })
  })

  describe('underscore', function() {
    describe('underscoredIf', function() {
      it('is defined', function(done) {
        expect(Utils._.underscoredIf).toBeDefined()
        done()
      })

      it('underscores if second param is true', function(done) {
        expect(Utils._.underscoredIf('fooBar', true)).toEqual('foo_bar')
        done()
      })

      it("doesn't underscore if second param is false", function(done) {
        expect(Utils._.underscoredIf('fooBar', false)).toEqual('fooBar')
        done()
      })
    })

    describe('camelizeIf', function() {
      it('is defined', function(done) {
        expect(Utils._.camelizeIf).toBeDefined()
        done()
      })

      it('camelizes if second param is true', function(done) {
        expect(Utils._.camelizeIf('foo_bar', true)).toEqual('fooBar')
        done()
      })

      it("doesn't camelize if second param is false", function(done) {
        expect(Utils._.underscoredIf('fooBar', true)).toEqual('foo_bar')
        done()
      })
    })
  })

  describe('isHash', function() {
    it('doesn\'t match arrays', function(done) {
      expect(Utils.isHash([])).toBeFalsy()
      done()
    })

    it('doesn\'t match null', function(done) {
      expect(Utils.isHash(null)).toBeFalsy()
      done()
    })

    it('matches plain objects', function(done) {
      var values = {
        'name': {
          'first': 'Foo',
          'last': 'Bar'
        }
      }
      expect(Utils.isHash(values)).toBeTruthy()
      done()
    })

    it('matches plain objects with length property/key', function(done) {
      var values = {
        'name': {
          'first': 'Foo',
          'last': 'Bar'
        },
        'length': 1
      }
      expect(Utils.isHash(values)).toBeTruthy()
      done()
    })
  })

  describe('format', function() {
    it('should format where clause correctly when the value is truthy', function(done) {
      var where = ['foo = ?', 1]
      expect(Utils.format(where)).toEqual('foo = 1')
      done()
    })

    it('should format where clause correctly when the value is falsy', function(done) {
      var where = ['foo = ?', 0]
      expect(Utils.format(where)).toEqual('foo = 0')
      done()
    })
  })
})
