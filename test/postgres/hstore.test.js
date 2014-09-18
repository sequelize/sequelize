/* jshint camelcase: false */
var chai      = require('chai')
  , expect    = chai.expect
  , Support   = require(__dirname + '/../support')
  , dialect   = Support.getTestDialect()
  , hstore    = require("../../lib/dialects/postgres/hstore")

chai.config.includeStack = true

if (dialect.match(/^postgres/)) {
  describe('[POSTGRES Specific] hstore', function() {
    describe('stringify', function() {
      it('should handle empty objects correctly', function(done) {
        expect(hstore.stringify({ })).to.equal('')
        done()
      })

      it('should handle null values correctly', function(done) {
        expect(hstore.stringify({ null: null })).to.equal('"null"=>NULL')
        done()
      })

      it('should handle null values correctly', function(done) {
        expect(hstore.stringify({ foo: null })).to.equal('"foo"=>NULL')
        done()
      })

      it('should handle empty string correctly', function(done) {
        expect(hstore.stringify({foo : ""})).to.equal('"foo"=>\"\"')
        done()
      })

      it('should handle a string with backslashes correctly', function(done) {
        expect(hstore.stringify({foo : "\\"})).to.equal('"foo"=>"\\\\"')
        done()
      })

      it('should handle a string with double quotes correctly', function(done) {
        expect(hstore.stringify({foo : '""a"'})).to.equal('"foo"=>"\\"\\"a\\""')
        done()
      })

      it('should handle a string with single quotes correctly', function(done) {
        expect(hstore.stringify({foo : "''a'"})).to.equal('"foo"=>"\'\'\'\'a\'\'"')
        done()
      })

      it('should handle simple objects correctly', function(done) {
        expect(hstore.stringify({ test: 'value' })).to.equal('"test"=>"value"')
        done()
      })

    })

    describe('parse', function() {
      it('should handle a null object correctly', function(done) {
        expect(hstore.parse(null)).to.deep.equal(null)
        done()
      })

      it('should handle empty string correctly', function(done) {
        expect(hstore.parse('"foo"=>\"\"')).to.deep.equal({foo : ""})
        done()
      })

      it('should handle a string with double quotes correctly', function(done) {
        expect(hstore.parse('"foo"=>"\\\"\\\"a\\\""')).to.deep.equal({foo : "\"\"a\""})
        done()
      })

      it('should handle a string with single quotes correctly', function(done) {
        expect(hstore.parse('"foo"=>"\'\'\'\'a\'\'"')).to.deep.equal({foo : "''a'"})
        done()
      })

      it('should handle a string with backslashes correctly', function(done) {
        expect(hstore.parse('"foo"=>"\\\\"')).to.deep.equal({foo : "\\"})
        done()
      })

      it('should handle empty objects correctly', function(done) {
        expect(hstore.parse('')).to.deep.equal({ })
        done()
      })

      it('should handle simple objects correctly', function(done) {
        expect(hstore.parse('"test"=>"value"')).to.deep.equal({ test: 'value' })
        done()
      })

    })
    describe('stringify and parse', function() {
      it('should stringify then parse back the same structure', function(done){
        var testObj = {foo : "bar", count : "1", emptyString : "", quotyString : '""', extraQuotyString : '"""a"""""', backslashes : '\\f023', moreBackslashes : '\\f\\0\\2\\1', backslashesAndQuotes : '\\"\\"uhoh"\\"', nully : null};
        expect(hstore.parse(hstore.stringify(testObj))).to.deep.equal(testObj);
        expect(hstore.parse(hstore.stringify(hstore.parse(hstore.stringify(testObj))))).to.deep.equal(testObj);
        done()
      })
    })
  })
}
