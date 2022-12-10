import { expect } from 'chai';
import { afterEach } from 'mocha';
import { spy } from 'sinon';
import type { CreateSchemaQueryOptions } from '@sequelize/core/_non-semver-use-at-your-own-risk_/dialects/abstract/query-generator';
import { sequelize } from '../support';

const queryInterface = sequelize.queryInterface;

const testSchema = 'testSchema';

if (sequelize.dialect.supports.schemas) {
  describe('QueryInterface#{create}Schema', async () => {

    // Clear the test schema if it's been added
    afterEach(async () => {
      const schemaNames: string[] = await queryInterface.showAllSchemas();
      if (schemaNames.includes(testSchema)) {
        await queryInterface.dropSchema(testSchema);
      }
    });

    it('should create a schema', async () => {
      const preCreationSchemas = await queryInterface.showAllSchemas();
      expect(preCreationSchemas).to.not.include(testSchema, 'testSchema existed before tests ran');

      await queryInterface.createSchema(testSchema);
      const postCreationSchemas: string[] = await queryInterface.showAllSchemas();
      expect(postCreationSchemas).to.include(testSchema, 'createSchema did not create testSchema');
    });

    it('should pass options through to the queryInterface\'s queryGenerator', async () => {
      const options: CreateSchemaQueryOptions = {
        collate: 'en_US.UTF-8',
        charset: 'utf8mb4',
      };
      const queryGeneratorSpy = spy(queryInterface.queryGenerator, 'createSchemaQuery');

      await queryInterface.createSchema(testSchema, options);
      expect(queryGeneratorSpy.args).to.include(options);
    });
  });
}
