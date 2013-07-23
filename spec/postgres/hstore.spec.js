var buster  = require("buster")
  , Helpers = require('../buster-helpers')
  , dialect = Helpers.getTestDialect()

buster.spec.expose()
buster.testRunner.timeout = 1000

if (dialect.match(/^postgres/)) {
  describe('[POSTGRES Specific] hstore', function() {
    var hstore = require('../../lib/dialects/postgres/hstore')

    describe('stringifyPart', function() {
      it("handles undefined values correctly", function(done) {
        expect(hstore.stringifyPart(undefined)).toEqual('NULL')
        done()
      })

      it("handles null values correctly", function(done) {
        expect(hstore.stringifyPart(null)).toEqual('NULL')
        done()
      })

      it("handles boolean values correctly", function(done) {
        expect(hstore.stringifyPart(false)).toEqual('false')
        expect(hstore.stringifyPart(true)).toEqual('true')
        done()
      })

      it("handles strings correctly", function(done) {
        expect(hstore.stringifyPart('foo')).toEqual('"foo"')
        done()
      })

      it("handles strings with backslashes correctly", function(done) {
        expect(hstore.stringifyPart("\\'literally\\'")).toEqual('"\\\\\'literally\\\\\'"')
        done()
      })

      it("handles arrays correctly", function(done) {
        expect(hstore.stringifyPart([1,['2'],'"3"'])).toEqual('"[1,[\\"2\\"],\\"\\\\\\"3\\\\\\"\\"]"')
        done()
      })

      it("handles simple objects correctly", function(done) {
        expect(hstore.stringifyPart({ test: 'value' })).toEqual('"{\\"test\\":\\"value\\"}"')
        done()
      })

      it("handles nested objects correctly", function(done) {
        expect(hstore.stringifyPart({ test: { nested: 'value' } })).toEqual('"{\\"test\\":{\\"nested\\":\\"value\\"}}"')
        done()
      })

      it("handles objects correctly", function(done) {
        expect(hstore.stringifyPart({test: {nested: {value: {including: '"string"'}}}})).toEqual('"{\\"test\\":{\\"nested\\":{\\"value\\":{\\"including\\":\\"\\\\\\"string\\\\\\"\\"}}}}"')
        done()
      })
    })

    describe('stringify', function() {
      it('should handle empty objects correctly', function(done) {
        expect(hstore.stringify({ })).toEqual('')
        done()
      })

      it('should handle null values correctly', function(done) {
        expect(hstore.stringify({ null: null })).toEqual('"null"=>NULL')
        done()
      })

      it('should handle simple objects correctly', function(done) {
        expect(hstore.stringify({ test: 'value' })).toEqual('"test"=>"value"')
        done()
      })

      it('should handle nested objects correctly', function(done) {
        expect(hstore.stringify({ test: { nested: 'value' } })).toEqual('"test"=>"{\\"nested\\":\\"value\\"}"')
        done()
      })

      it('should handle nested arrays correctly', function(done) {
        expect(hstore.stringify({ test: [ 1, '2', [ '"3"' ] ] })).toEqual('"test"=>"[1,\\"2\\",[\\"\\\\\\"3\\\\\\"\\"]]"')
        done()
      })

      it('should handle multiple keys with different types of values', function(done) {
        expect(hstore.stringify({ true: true, false: false, null: null, undefined: undefined, integer: 1, array: [1,'2'], object: { object: 'value' }})).toEqual('"true"=>true,"false"=>false,"null"=>NULL,"undefined"=>NULL,"integer"=>1,"array"=>"[1,\\"2\\"]","object"=>"{\\"object\\":\\"value\\"}"')
        done()
      })
    })

    describe('parse', function() {
      it('should handle empty objects correctly', function(done) {
        expect(hstore.parse('')).toEqual({ })
        done()
      })

      it('should handle simple objects correctly', function(done) {
        expect(hstore.parse('"test"=>"value"')).toEqual({ test: 'value' })
        done()
      })

      it('should handle nested objects correctly', function(done) {
        expect(hstore.parse('"test"=>"{\\"nested\\":\\"value\\"}"')).toEqual({ test: { nested: 'value' } })
        done()
      })

      it('should handle nested arrays correctly', function(done) {
        expect(hstore.parse('"test"=>"[1,\\"2\\",[\\"\\\\\\"3\\\\\\"\\"]]"')).toEqual({ test: [ 1, '2', [ '"3"' ] ] })
        done()
      })

      it('should handle multiple keys with different types of values', function(done) {
        expect(hstore.parse('"true"=>true,"false"=>false,"null"=>NULL,"undefined"=>NULL,"integer"=>1,"array"=>"[1,\\"2\\"]","object"=>"{\\"object\\":\\"value\\"}"')).toEqual({ true: true, false: false, null: null, undefined: null, integer: 1, array: [1,'2'], object: { object: 'value' }})
        done()
      })
    })
  })
}
