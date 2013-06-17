if(typeof require === 'function') {
  const buster  = require("buster")
      , Helpers = require('../buster-helpers')
      , dialect = Helpers.getTestDialect()
}

buster.spec.expose()

if (dialect.match(/^postgres/)) {
  describe('[POSTGRES] hstore', function() {
    const hstore = require('../../lib/dialects/postgres/hstore')

    describe('stringifyPart', function() {
      it("handles undefined values correctly", function() {
        expect(hstore.stringifyPart(undefined)).toEqual('NULL')
      })
      it("handles null values correctly", function() {
        expect(hstore.stringifyPart(null)).toEqual('NULL')
      })
      it("handles boolean values correctly", function() {
        expect(hstore.stringifyPart(false)).toEqual('false')
        expect(hstore.stringifyPart(true)).toEqual('true')
      })
      it("handles strings correctly", function() {
        expect(hstore.stringifyPart('foo')).toEqual('"foo"')
      })
      it("handles strings with backslashes correctly", function() {
        expect(hstore.stringifyPart("\\'literally\\'")).toEqual('"\\\\\'literally\\\\\'"')
      })
      it("handles arrays correctly", function() {
        expect(hstore.stringifyPart([1,['2'],'"3"'])).toEqual('"[1,[\\"2\\"],\\"\\\\\\"3\\\\\\"\\"]"')
      })
      it("handles simple objects correctly", function() {
        expect(hstore.stringifyPart({ test: 'value' })).toEqual('"{\\"test\\":\\"value\\"}"')
      })
      it("handles nested objects correctly", function () {
        expect(hstore.stringifyPart({ test: { nested: 'value' } })).toEqual('"{\\"test\\":{\\"nested\\":\\"value\\"}}"')
      })
      it("handles objects correctly", function() {
        expect(hstore.stringifyPart({test: {nested: {value: {including: '"string"'}}}})).toEqual('"{\\"test\\":{\\"nested\\":{\\"value\\":{\\"including\\":\\"\\\\\\"string\\\\\\"\\"}}}}"')
      })
    })

    describe('stringify', function() {
      it('should handle empty objects correctly', function() {
        expect(hstore.stringify({ })).toEqual('')
      })
      it('should handle null values correctly', function () {
        expect(hstore.stringify({ null: null })).toEqual('"null"=>NULL')
      })
      it('should handle simple objects correctly', function() {
        expect(hstore.stringify({ test: 'value' })).toEqual('"test"=>"value"')
      })
      it('should handle nested objects correctly', function() {
        expect(hstore.stringify({ test: { nested: 'value' } })).toEqual('"test"=>"{\\"nested\\":\\"value\\"}"')
      })
      it('should handle nested arrays correctly', function() {
        expect(hstore.stringify({ test: [ 1, '2', [ '"3"' ] ] })).toEqual('"test"=>"[1,\\"2\\",[\\"\\\\\\"3\\\\\\"\\"]]"')
      })
      it('should handle multiple keys with different types of values', function() {
        expect(hstore.stringify({ true: true, false: false, null: null, undefined: undefined, integer: 1, array: [1,'2'], object: { object: 'value' }})).toEqual('"true"=>true,"false"=>false,"null"=>NULL,"undefined"=>NULL,"integer"=>1,"array"=>"[1,\\"2\\"]","object"=>"{\\"object\\":\\"value\\"}"')
      })
    })

    describe('parse', function() {
      it('should handle empty objects correctly', function() {
        expect(hstore.parse('')).toEqual({ })
      })
      it('should handle simple objects correctly', function() {
        expect(hstore.parse('"test"=>"value"')).toEqual({ test: 'value' })
      })
      it('should handle nested objects correctly', function() {
        expect(hstore.parse('"test"=>"{\\"nested\\":\\"value\\"}"')).toEqual({ test: { nested: 'value' } })
      })
      it('should handle nested arrays correctly', function() {
        expect(hstore.parse('"test"=>"[1,\\"2\\",[\\"\\\\\\"3\\\\\\"\\"]]"')).toEqual({ test: [ 1, '2', [ '"3"' ] ] })
      })
      it('should handle multiple keys with different types of values', function() {
        expect(hstore.parse('"true"=>true,"false"=>false,"null"=>NULL,"undefined"=>NULL,"integer"=>1,"array"=>"[1,\\"2\\"]","object"=>"{\\"object\\":\\"value\\"}"')).toEqual({ true: true, false: false, null: null, undefined: null, integer: 1, array: [1,'2'], object: { object: 'value' }})
      })
    })
  })
}
