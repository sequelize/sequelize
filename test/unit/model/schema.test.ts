import assert from 'node:assert';
import { expect } from 'chai';
import { literal } from '@sequelize/core';
import { sequelize } from '../../support';

describe('Model Schemas', () => {
  if (sequelize.dialect.supports.schemas) {
    const Project = sequelize.define('project');
    const Company = sequelize.define('company', {}, {
      schema: 'default',
      schemaDelimiter: '&',
    });

    Project.addScope('scope1', { where: literal('') });

    describe('schema', () => {
      it('should work with no default schema', () => {
        expect(Project._schema).to.equal(sequelize.dialect.getDefaultSchema());
      });

      it('should apply default schema from define', () => {
        expect(Company._schema).to.equal('default');
      });

      it('returns the same model if the schema is equal', () => {
        // eslint-disable-next-line no-self-compare
        assert(Project.withSchema('newSchema') === Project.withSchema('newSchema'));
      });

      it('returns a new model if the schema is equal, but scope is different', () => {
        expect(Project.withScope('scope1').withSchema('newSchema')).not.to.equal(Project.withSchema('newSchema'));
      });

      it('returns the current model if the schema is identical', () => {
        assert(Project.withSchema('') === Project);
        assert(Project.withSchema('test').withSchema('test') === Project.withSchema('test'));
      });

      it('should be able to override the default schema', () => {
        expect(Company.withSchema('newSchema')._schema).to.equal('newSchema');
      });

      it('should be able nullify schema', () => {
        expect(Company.withSchema(null)._schema).to.equal(sequelize.dialect.getDefaultSchema());
      });

      it('should support multiple, coexistent schema models', () => {
        const schema1 = Company.withSchema('schema1');
        const schema2 = Company.withSchema('schema1');

        expect(schema1._schema).to.equal('schema1');
        expect(schema2._schema).to.equal('schema1');
      });

      describe.skip('schema (deprecated)', () => {
        it('should be able to override the default schema', () => {
          expect(Company.schema('newSchema')._schema).to.equal('newSchema');
        });

        it('should be able nullify schema', () => {
          expect(Company.schema(null)._schema).to.equal(sequelize.dialect.getDefaultSchema());
        });

        it('should support multiple, coexistent schema models', () => {
          const schema1 = Company.schema('schema1');
          const schema2 = Company.schema('schema1');

          expect(schema1._schema).to.equal('schema1');
          expect(schema2._schema).to.equal('schema1');
        });
      });
    });

    describe('schema delimiter', () => {
      it('should work with no default schema delimiter', () => {
        expect(Project._schemaDelimiter).to.equal('');
      });

      it('should apply default schema delimiter from define', () => {
        expect(Company._schemaDelimiter).to.equal('&');
      });

      it('should be able to override the default schema delimiter', () => {
        expect(Company.withSchema(Company._schema, '^')._schemaDelimiter).to.equal('^');
      });

      it('should support multiple, coexistent schema delimiter models', () => {
        const schema1 = Company.withSchema(Company._schema, '$');
        const schema2 = Company.withSchema(Company._schema, '#');

        expect(schema1._schemaDelimiter).to.equal('$');
        expect(schema2._schemaDelimiter).to.equal('#');
      });

      describe.skip('schema (deprecated)', () => {
        it('should be able to override the default schema delimiter', () => {
          expect(Company.schema(Company._schema, '^')._schemaDelimiter).to.equal('^');
        });

        it('should support multiple, coexistent schema delimiter models', () => {
          const schema1 = Company.schema(Company._schema, '$');
          const schema2 = Company.schema(Company._schema, '#');

          expect(schema1._schemaDelimiter).to.equal('$');
          expect(schema2._schemaDelimiter).to.equal('#');
        });
      });
    });
  }
});
