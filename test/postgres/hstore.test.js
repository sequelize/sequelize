/* jshint camelcase: false */
var chai      = require('chai')
  , expect    = chai.expect
  , Support   = require(__dirname + '/../support')
  , dialect   = Support.getTestDialect()
  , hstore    = require(__dirname + '/../../lib/dialects/postgres/hstore')

chai.Assertion.includeStack = true

if (dialect.match(/^postgres/)) {
  describe('[POSTGRES Specific] hstore', function() {
    describe('stringifyPart', function() {
      it("handles undefined values correctly", function(done) {
        expect(hstore.stringifyPart(undefined)).to.equal('NULL')
        done()
      })

      it("handles null values correctly", function(done) {
        expect(hstore.stringifyPart(null)).to.equal('NULL')
        done()
      })

      it("handles boolean values correctly", function(done) {
        expect(hstore.stringifyPart(false)).to.equal('false')
        expect(hstore.stringifyPart(true)).to.equal('true')
        done()
      })

      it("handles strings correctly", function(done) {
        expect(hstore.stringifyPart('foo')).to.equal('"foo"')
        done()
      })

      it("handles strings with backslashes correctly", function(done) {
        expect(hstore.stringifyPart("\\'literally\\'")).to.equal('"\\\\\'literally\\\\\'"')
        done()
      })

      it("handles arrays correctly", function(done) {
        expect(hstore.stringifyPart([1,['2'],'"3"'])).to.equal('"[1,[\\"2\\"],\\"\\\\\\"3\\\\\\"\\"]"')
        done()
      })

      it("handles simple objects correctly", function(done) {
        expect(hstore.stringifyPart({ test: 'value' })).to.equal('"{\\"test\\":\\"value\\"}"')
        done()
      })

      it("handles nested objects correctly", function(done) {
        expect(hstore.stringifyPart({ test: { nested: 'value' } })).to.equal('"{\\"test\\":{\\"nested\\":\\"value\\"}}"')
        done()
      })

      it("handles objects correctly", function(done) {
        expect(hstore.stringifyPart({test: {nested: {value: {including: '"string"'}}}})).to.equal('"{\\"test\\":{\\"nested\\":{\\"value\\":{\\"including\\":\\"\\\\\\"string\\\\\\"\\"}}}}"')
        done()
      })
    })

    describe('stringify', function() {
      it('should handle empty objects correctly', function(done) {
        expect(hstore.stringify({ })).to.equal('')
        done()
      })

      it('should handle null values correctly', function(done) {
        expect(hstore.stringify({ null: null })).to.equal('"null"=>NULL')
        done()
      })

      it('should handle simple objects correctly', function(done) {
        expect(hstore.stringify({ test: 'value' })).to.equal('"test"=>"value"')
        done()
      })

      it('should handle nested objects correctly', function(done) {
        expect(hstore.stringify({ test: { nested: 'value' } })).to.equal('"test"=>"{\\"nested\\":\\"value\\"}"')
        done()
      })

      it('should handle nested arrays correctly', function(done) {
        expect(hstore.stringify({ test: [ 1, '2', [ '"3"' ] ] })).to.equal('"test"=>"[1,\\"2\\",[\\"\\\\\\"3\\\\\\"\\"]]"')
        done()
      })

      it('should handle multiple keys with different types of values', function(done) {
        expect(hstore.stringify({ true: true, false: false, null: null, undefined: undefined, integer: 1, array: [1,'2'], object: { object: 'value' }})).to.equal('"true"=>true,"false"=>false,"null"=>NULL,"undefined"=>NULL,"integer"=>1,"array"=>"[1,\\"2\\"]","object"=>"{\\"object\\":\\"value\\"}"')
        done()
      })
    })

    describe('parse', function() {
      it('should handle empty objects correctly', function(done) {
        expect(hstore.parse('')).to.deep.equal({ })
        done()
      })

      it('should handle simple objects correctly', function(done) {
        expect(hstore.parse('"test"=>"value"')).to.deep.equal({ test: 'value' })
        done()
      })

      it('should handle nested objects correctly', function(done) {
        expect(hstore.parse('"test"=>"{\\"nested\\":\\"value\\"}"')).to.deep.equal({ test: { nested: 'value' } })
        done()
      })

      it('should handle nested arrays correctly', function(done) {
        expect(hstore.parse('"test"=>"[1,\\"2\\",[\\"\\\\\\"3\\\\\\"\\"]]"')).to.deep.equal({ test: [ 1, '2', [ '"3"' ] ] })
        done()
      })

      it('should handle multiple keys with different types of values', function(done) {
        expect(hstore.parse('"true"=>true,"false"=>false,"null"=>NULL,"undefined"=>NULL,"integer"=>1,"array"=>"[1,\\"2\\"]","object"=>"{\\"object\\":\\"value\\"}"')).to.deep.equal({ true: true, false: false, null: null, undefined: null, integer: "1", array: [1,'2'], object: { object: 'value' }})
        done()
      })
    })
  })
}
