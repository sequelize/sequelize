'use strict';

/* jshint -W110 */
var chai = require('chai')
  , expect = chai.expect
  , Support = require(__dirname + '/../../support')
  , dialect = Support.getTestDialect()
  , hstore = require('../../../../lib/dialects/postgres/hstore');

if (dialect.match(/^postgres/)) {
  describe('[POSTGRES Specific] hstore', function() {
    describe('stringify', function() {
      it('should handle empty objects correctly', function() {
        expect(hstore.stringify({ })).to.equal('');
      });

      it('should handle null values correctly', function() {
        expect(hstore.stringify({ null: null })).to.equal('"null"=>NULL');
      });

      it('should handle null values correctly', function() {
        expect(hstore.stringify({ foo: null })).to.equal('"foo"=>NULL');
      });

      it('should handle empty string correctly', function() {
        expect(hstore.stringify({foo: ''})).to.equal('"foo"=>\"\"');
      });

      it('should handle a string with backslashes correctly', function() {
        expect(hstore.stringify({foo: '\\'})).to.equal('"foo"=>"\\\\"');
      });

      it('should handle a string with double quotes correctly', function() {
        expect(hstore.stringify({foo: '""a"'})).to.equal('"foo"=>"\\"\\"a\\""');
      });

      it('should handle a string with single quotes correctly', function() {
        expect(hstore.stringify({foo: "''a'"})).to.equal('"foo"=>"\'\'\'\'a\'\'"');
      });

      it('should handle simple objects correctly', function() {
        expect(hstore.stringify({ test: 'value' })).to.equal('"test"=>"value"');
      });

    });

    describe('parse', function() {
      it('should handle a null object correctly', function() {
        expect(hstore.parse(null)).to.deep.equal(null);
      });

      it('should handle empty string correctly', function() {
        expect(hstore.parse('"foo"=>\"\"')).to.deep.equal({foo: ''});
      });

      it('should handle a string with double quotes correctly', function() {
        expect(hstore.parse('"foo"=>"\\\"\\\"a\\\""')).to.deep.equal({foo: '\"\"a\"'});
      });

      it('should handle a string with single quotes correctly', function() {
        expect(hstore.parse('"foo"=>"\'\'\'\'a\'\'"')).to.deep.equal({foo: "''a'"});
      });

      it('should handle a string with backslashes correctly', function() {
        expect(hstore.parse('"foo"=>"\\\\"')).to.deep.equal({foo: '\\'});
      });

      it('should handle empty objects correctly', function() {
        expect(hstore.parse('')).to.deep.equal({ });
      });

      it('should handle simple objects correctly', function() {
        expect(hstore.parse('"test"=>"value"')).to.deep.equal({ test: 'value' });
      });

    });
    describe('stringify and parse', function() {
      it('should stringify then parse back the same structure', function() {
        var testObj = {foo: 'bar', count: '1', emptyString: '', quotyString: '""', extraQuotyString: '"""a"""""', backslashes: '\\f023', moreBackslashes: '\\f\\0\\2\\1', backslashesAndQuotes: '\\"\\"uhoh"\\"', nully: null};
        expect(hstore.parse(hstore.stringify(testObj))).to.deep.equal(testObj);
        expect(hstore.parse(hstore.stringify(hstore.parse(hstore.stringify(testObj))))).to.deep.equal(testObj);
      });
    });
  });
}
