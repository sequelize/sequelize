var chai    = require('chai')
  , expect  = chai.expect
  , Utils   = require(__dirname + '/../lib/utils')
  , Support = require(__dirname + '/support')

chai.Assertion.includeStack = true

describe(Support.getTestDialectTeaser("Utils"), function() {
  describe('removeCommentsFromFunctionString', function() {
    it("removes line comments at the start of a line", function(done) {
      var functionWithLineComments = function() {
        // noot noot
      }

      var string = functionWithLineComments.toString()
        , result = Utils.removeCommentsFromFunctionString(string)

      expect(result).not.to.match(/.*noot.*/)
      done()
    })

    it("removes lines comments in the middle of a line", function(done) {
      var functionWithLineComments = function() {
        alert(1) // noot noot
      }

      var string = functionWithLineComments.toString()
        , result = Utils.removeCommentsFromFunctionString(string)

      expect(result).not.to.match(/.*noot.*/)
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

      expect(result).not.to.match(/.*noot.*/)
      expect(result).not.to.match(/.*foo.*/)
      expect(result).to.match(/.*alert\(2\).*/)
      done()
    })
  })

  describe('argsArePrimaryKeys', function() {
    it("doesn't detect primary keys if primareyKeys and values have different lengths", function(done) {
      expect(Utils.argsArePrimaryKeys([1,2,3], [1])).to.be.false
      done()
    })

    it("doesn't detect primary keys if primary keys are hashes or arrays", function(done) {
      expect(Utils.argsArePrimaryKeys([[]], [1])).to.be.false
      done()
    })

    it('detects primary keys if length is correct and data types are matching', function(done) {
      expect(Utils.argsArePrimaryKeys([1,2,3], ["INTEGER", "INTEGER", "INTEGER"])).to.be.true
      done()
    })

    it("detects primary keys if primary keys are dates and lengths are matching", function(done) {
      expect(Utils.argsArePrimaryKeys([new Date()], ['foo'])).to.be.true
      done()
    })
  })

  describe('underscore', function() {
    describe('underscoredIf', function() {
      it('is defined', function(done) {
        expect(Utils._.underscoredIf).to.be.ok
        done()
      })

      it('underscores if second param is true', function(done) {
        expect(Utils._.underscoredIf('fooBar', true)).to.equal('foo_bar')
        done()
      })

      it("doesn't underscore if second param is false", function(done) {
        expect(Utils._.underscoredIf('fooBar', false)).to.equal('fooBar')
        done()
      })
    })

    describe('camelizeIf', function() {
      it('is defined', function(done) {
        expect(Utils._.camelizeIf).to.be.ok
        done()
      })

      it('camelizes if second param is true', function(done) {
        expect(Utils._.camelizeIf('foo_bar', true)).to.equal('fooBar')
        done()
      })

      it("doesn't camelize if second param is false", function(done) {
        expect(Utils._.underscoredIf('fooBar', true)).to.equal('foo_bar')
        done()
      })
    })
  })

  describe('isHash', function() {
    it('doesn\'t match arrays', function(done) {
      expect(Utils.isHash([])).to.be.false
      done()
    })

    it('doesn\'t match null', function(done) {
      expect(Utils.isHash(null)).to.be.false
      done()
    })

    it('matches plain objects', function(done) {
      var values = {
        'name': {
          'first': 'Foo',
          'last': 'Bar'
        }
      }

      expect(Utils.isHash(values)).to.be.true
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

      expect(Utils.isHash(values)).to.be.true
      done()
    })
  })

  describe('format', function() {
    it('should format where clause correctly when the value is truthy', function(done) {
      var where = ['foo = ?', 1]
      expect(Utils.format(where)).to.equal('foo = 1')
      done()
    })

    it('should format where clause correctly when the value is false', function(done) {
      var where = ['foo = ?', 0]
      expect(Utils.format(where)).to.equal('foo = 0')
      done()
    })
  })
})
