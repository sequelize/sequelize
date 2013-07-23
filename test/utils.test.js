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

  describe('argsArePrimaryKeys', function() {
    it("doesn't detect primary keys if primareyKeys and values have different lengths", function() {
      expect(Utils.argsArePrimaryKeys([1,2,3], [1])).to.be.false
    })

    it("doesn't detect primary keys if primary keys are hashes or arrays", function() {
      expect(Utils.argsArePrimaryKeys([[]], [1])).to.be.false
    })

    it('detects primary keys if length is correct and data types are matching', function() {
      expect(Utils.argsArePrimaryKeys([1,2,3], ["INTEGER", "INTEGER", "INTEGER"])).to.be.true
    })

    it("detects primary keys if primary keys are dates and lengths are matching", function() {
      expect(Utils.argsArePrimaryKeys([new Date()], ['foo'])).to.be.true
    })
  })

  describe('underscore', function() {
    describe('underscoredIf', function() {
      it('is defined', function() {
        expect(Utils._.underscoredIf).to.be.ok
      })

      it('underscores if second param is true', function() {
        expect(Utils._.underscoredIf('fooBar', true)).to.equal('foo_bar')
      })

      it("doesn't underscore if second param is false", function() {
        expect(Utils._.underscoredIf('fooBar', false)).to.equal('fooBar')
      })
    })

    describe('camelizeIf', function() {
      it('is defined', function() {
        expect(Utils._.camelizeIf).to.be.ok
      })

      it('camelizes if second param is true', function() {
        expect(Utils._.camelizeIf('foo_bar', true)).to.equal('fooBar')
      })

      it("doesn't camelize if second param is false", function() {
        expect(Utils._.underscoredIf('fooBar', true)).to.equal('foo_bar')
      })
    })
  })

  describe('isHash', function() {
    it('doesn\'t match arrays', function() {
      expect(Utils.isHash([])).to.be.false
    })

    it('doesn\'t match null', function() {
      expect(Utils.isHash(null)).to.be.false
    })

    it('matches plain objects', function() {
      var values = {
        'name': {
          'first': 'Foo',
          'last': 'Bar'
        }
      }

      expect(Utils.isHash(values)).to.be.true
    })

    it('matches plain objects with length property/key', function() {
      var values = {
        'name': {
          'first': 'Foo',
          'last': 'Bar'
        },
        'length': 1
      }

      expect(Utils.isHash(values)).to.be.true
    })
  })

  describe('format', function() {
    it('should format where clause correctly when the value is truthy', function() {
      var where = ['foo = ?', 1]
      expect(Utils.format(where)).to.equal('foo = 1')
    })

    it('should format where clause correctly when the value is false', function() {
      var where = ['foo = ?', 0]
      expect(Utils.format(where)).to.equal('foo = 0')
    })
  })
})
