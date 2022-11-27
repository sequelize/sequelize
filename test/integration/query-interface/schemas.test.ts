import { expect } from 'chai';
import { sequelize, getTestDialect } from '../support';

const queryInterface = sequelize.queryInterface;

const testSchema = 'testSchema';
const dialect = getTestDialect();

if (dialect.startsWith('postgres')) {
  describe('QueryInterface#{create,drop}Schema', async () => {
    it('should create then drop a schema', async () => {
      const preCreationSchemas: string[] = await queryInterface.showAllSchemas();
      await queryInterface.createSchema(testSchema);
      expect(preCreationSchemas).to.not.include(testSchema);

      const postCreationSchemas: string[] = await queryInterface.showAllSchemas();
      expect(postCreationSchemas).to.include(testSchema);
    });
  });
}
