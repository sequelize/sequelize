'use strict';

/* jshint -W030 */
var chai = require('chai')
  , expect = chai.expect
  , Support   = require(__dirname + '/../support')
  , current   = Support.sequelize;

describe(Support.getTestDialectTeaser('Model') + 'Schemas', function() {
  if (current.dialect.supports.schemas) {
    var Project = current.define('project'),
      Company = current.define('company', {}, {
        schema: 'default',
        schemaDelimiter: '&'
      });

    describe('schema', function() {
      it('should work with no default schema', function() {
        expect(Project.$schema).to.be.null;
      });

      it('should apply default schema from define', function() {
        expect(Company.$schema).to.equal('default');
      });

      it('should be able to override the default schema', function() {
        expect(Company.schema('newSchema').$schema).to.equal('newSchema');
      });

      it('should be able nullify schema', function() {
        expect(Company.schema(null).$schema).to.be.null;
      });

      it('should support multiple, coexistent schema models', function() {
        var schema1 = Company.schema('schema1')
          , schema2 = Company.schema('schema1');

        expect(schema1.$schema).to.equal('schema1');
        expect(schema2.$schema).to.equal('schema1');
      });
    });

    describe('schema delimiter', function() {
      it('should work with no default schema delimiter', function() {
        expect(Project.$schemaDelimiter).to.equal('');
      });

      it('should apply default schema delimiter from define', function() {
        expect(Company.$schemaDelimiter).to.equal('&');
      });

      it('should be able to override the default schema delimiter', function() {
        expect(Company.schema(Company.$schema,'^').$schemaDelimiter).to.equal('^');
      });

      it('should support multiple, coexistent schema delimiter models', function() {
        var schema1 = Company.schema(Company.$schema,'$')
          , schema2 = Company.schema(Company.$schema,'#');

        expect(schema1.$schemaDelimiter).to.equal('$');
        expect(schema2.$schemaDelimiter).to.equal('#');
      });
    });
  }
});
