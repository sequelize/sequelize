import { expect } from 'chai';
import { sequelize } from '../support';

const queryInterface = sequelize.queryInterface;

const testSchema = 'testSchema';

if (sequelize.dialect.supports.schemas) {
  describe('QueryInterface#{create}Schema', async () => {
    it('should create a schema', async () => {
      const preCreationSchemas: string[] = await queryInterface.showAllSchemas();
      expect(preCreationSchemas).to.not.include(testSchema, 'testSchema existed before creation');

      await queryInterface.createSchema(testSchema);
      const postCreationSchemas: string[] = await queryInterface.showAllSchemas();
      expect(postCreationSchemas).to.include(testSchema, 'createSchema did not create testSchema');
    });
  });
}
