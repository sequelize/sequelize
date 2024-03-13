import { literal } from '@sequelize/core';
import { expect } from 'chai';
import assert from 'node:assert';
import {
  allowDeprecationsInSuite,
  beforeAll2,
  getTestDialectTeaser,
  sequelize,
} from '../../support';

describe(`${getTestDialectTeaser('Model')}Schemas`, () => {
  allowDeprecationsInSuite(['SEQUELIZE0009']);

  if (!sequelize.dialect.supports.schemas) {
    return;
  }

  const vars = beforeAll2(() => {
    const Project = sequelize.define('project');
    const Company = sequelize.define(
      'company',
      {},
      {
        schema: 'default',
        schemaDelimiter: '&',
      },
    );
    Project.addScope('scope1', { where: literal('') });

    return { Project, Company };
  });

  describe('schema', () => {
    it('should work with no default schema', () => {
      const { Project } = vars;

      expect(Project.table.schema).to.equal(sequelize.dialect.getDefaultSchema());
    });

    it('should apply default schema from define', () => {
      const { Company } = vars;

      expect(Company.table.schema).to.equal('default');
    });

    it('returns the same model if the schema is equal', () => {
      const { Project } = vars;

      assert(
        // eslint-disable-next-line no-self-compare -- value could be different.
        Project.withSchema('newSchema') === Project.withSchema('newSchema'),
        'withSchema should have returned the same model if the schema is equal',
      );
    });

    it('returns a new model if the schema is equal, but scope is different', () => {
      const { Project } = vars;

      expect(Project.withScope('scope1').withSchema('newSchema')).not.to.equal(
        Project.withSchema('newSchema'),
      );
    });

    it('returns the current model if the schema is identical', () => {
      const { Project } = vars;

      assert(Project.withSchema('') === Project);
      assert(Project.withSchema('test').withSchema('test') === Project.withSchema('test'));
    });

    it('should be able to override the default schema', () => {
      const { Company } = vars;

      expect(Company.withSchema('newSchema').table.schema).to.equal('newSchema');
    });

    it('should be able to override the default schema using deprecated schema', () => {
      const { Company } = vars;

      expect(Company.schema('newSchema').table.schema).to.equal('newSchema');
    });

    it('should be able nullify schema', () => {
      const { Company } = vars;

      expect(Company.withSchema(null).table.schema).to.equal(sequelize.dialect.getDefaultSchema());
    });

    it('should support multiple, coexistent schema models', () => {
      const { Company } = vars;

      const schema1 = Company.withSchema('schema1');
      const schema2 = Company.withSchema('schema1');

      expect(schema1.table.schema).to.equal('schema1');
      expect(schema2.table.schema).to.equal('schema1');
    });
  });
  describe('schema delimiter', () => {
    it('should work with no default schema delimiter', () => {
      const { Project } = vars;

      expect(Project.table.delimiter).to.equal('.');
    });

    it('should apply default schema delimiter from define', () => {
      const { Company } = vars;

      expect(Company.table.delimiter).to.equal('&');
    });

    it('should be able to override the default schema delimiter', () => {
      const { Company } = vars;

      expect(
        Company.withSchema({ schema: Company.table.schema!, schemaDelimiter: '^' }).table.delimiter,
      ).to.equal('^');
    });

    it('should be able to override the default schema delimiter using deprecated schema', () => {
      const { Company } = vars;

      expect(Company.schema(Company.table.schema, '^').table.delimiter).to.equal('^');
    });

    it('should be able to override the default schema delimiter using deprecated schema with schema object', () => {
      const { Company } = vars;

      expect(
        Company.schema(Company.table.schema, { schemaDelimiter: '^' }).table.delimiter,
      ).to.equal('^');
    });

    it('should support multiple, coexistent schema delimiter models', () => {
      const { Company } = vars;

      const schema1 = Company.withSchema({ schema: Company.table.schema!, schemaDelimiter: '$' });
      const schema2 = Company.withSchema({ schema: Company.table.schema!, schemaDelimiter: '#' });

      expect(schema1.table.delimiter).to.equal('$');
      expect(schema2.table.delimiter).to.equal('#');
    });
  });
});
