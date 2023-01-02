import assert from 'node:assert';
import { literal } from '@sequelize/core';
// eslint-disable-next-line import/order
import { expect } from 'chai';

const Support = require('../../support');

const current = Support.sequelize;

describe(`${Support.getTestDialectTeaser('Model')}Schemas`, () => {
  if (current.dialect.supports.schemas) {
    const Project = current.define('project');
    const Company = current.define('company', {}, {
      schema: 'default',
      schemaDelimiter: '&',
    });

    Project.addScope('scope1', { where: literal('') });

    describe('schema', () => {
      it('should work with no default schema', () => {
        expect(Project.table.schema).to.equal(current.dialect.getDefaultSchema());
      });

      it('should apply default schema from define', () => {
        expect(Company.table.schema).to.equal('default');
      });

      it('returns the same model if the schema is equal', () => {
        // eslint-disable-next-line no-self-compare
        assert(Project.withSchema('newSchema') === Project.withSchema('newSchema'), 'withSchema should have returned the same model if the schema is equal');
      });

      it('returns a new model if the schema is equal, but scope is different', () => {
        expect(Project.withScope('scope1').withSchema('newSchema')).not.to.equal(Project.withSchema('newSchema'));
      });

      it('returns the current model if the schema is identical', () => {
        assert(Project.withSchema('') === Project);
        assert(Project.withSchema('test').withSchema('test') === Project.withSchema('test'));
      });

      it('should be able to override the default schema', () => {
        expect(Company.schema('newSchema').table.schema).to.equal('newSchema');
      });

      it('should be able nullify schema', () => {
        expect(Company.schema(null).table.schema).to.equal(current.dialect.getDefaultSchema());
      });

      it('should support multiple, coexistent schema models', () => {
        const schema1 = Company.schema('schema1');
        const schema2 = Company.schema('schema1');

        expect(schema1.table.schema).to.equal('schema1');
        expect(schema2.table.schema).to.equal('schema1');
      });
    });

    describe('schema delimiter', () => {
      it('should work with no default schema delimiter', () => {
        expect(Project.table.delimiter).to.equal('.');
      });

      it('should apply default schema delimiter from define', () => {
        expect(Company.table.delimiter).to.equal('&');
      });

      it('should be able to override the default schema delimiter', () => {
        expect(Company.schema(Company.table.schema, '^').table.delimiter).to.equal('^');
      });

      it('should support multiple, coexistent schema delimiter models', () => {
        const schema1 = Company.schema(Company.table.schema, '$');
        const schema2 = Company.schema(Company.table.schema, '#');

        expect(schema1.table.delimiter).to.equal('$');
        expect(schema2.table.delimiter).to.equal('#');
      });
    });
  }
});
