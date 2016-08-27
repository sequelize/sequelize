'use strict';

/* jshint -W030 */
let chai = require('chai')
  , expect = chai.expect
  , Support   = require(__dirname + '/../support')
  , current   = Support.sequelize;

describe(Support.getTestDialectTeaser('Model') + 'Schemas', function() {
  if (current.dialect.supports.schemas) {
    let Project = current.define('project'),
      Company = current.define('company', {}, {
        schema: 'default',
        schemaDelimiter: '&'
      });

    describe('schema', function() {
      it('should work with no default schema', function() {
        expect(Project._schema).to.be.null;
      });

      it('should apply default schema from define', function() {
        expect(Company._schema).to.equal('default');
      });

      it('should be able to override the default schema', function() {
        expect(Company.schema('newSchema')._schema).to.equal('newSchema');
      });

      it('should be able nullify schema', function() {
        expect(Company.schema(null)._schema).to.be.null;
      });

      it('should support multiple, coexistent schema models', function() {
        let schema1 = Company.schema('schema1')
          , schema2 = Company.schema('schema1');

        expect(schema1._schema).to.equal('schema1');
        expect(schema2._schema).to.equal('schema1');
      });
    });

    describe('schema delimiter', function() {
      it('should work with no default schema delimiter', function() {
        expect(Project._schemaDelimiter).to.equal('');
      });

      it('should apply default schema delimiter from define', function() {
        expect(Company._schemaDelimiter).to.equal('&');
      });

      it('should be able to override the default schema delimiter', function() {
        expect(Company.schema(Company._schema, '^')._schemaDelimiter).to.equal('^');
      });

      it('should support multiple, coexistent schema delimiter models', function() {
        let schema1 = Company.schema(Company._schema, '$')
          , schema2 = Company.schema(Company._schema, '#');

        expect(schema1._schemaDelimiter).to.equal('$');
        expect(schema2._schemaDelimiter).to.equal('#');
      });
    });
  }
});
