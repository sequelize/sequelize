import { expect } from 'chai';
import { spy } from 'sinon';
import type {
  CreateSchemaQueryOptions,
} from '@sequelize/core/_non-semver-use-at-your-own-risk_/dialects/abstract/query-generator';
import { sequelize } from '../support';

const { dialect } = sequelize;
const testSchema = 'testSchema';
const queryInterface = sequelize.queryInterface;

// MySQL and MariaDB view databases and schemas as identical. Other databases consider them separate entities.
const dialectsWithEqualDBsSchemas = ['mysql', 'mariadb'];

describe('QueryInterface#{create,drop,list}Schema', () => {
  if (!dialect.supports.schemas) {
    it('should throw, indicating that the method is not supported', async () => {
      await expect(queryInterface.createSchema(testSchema)).to.be.rejectedWith(`Schemas are not supported in ${dialect.name}.`);
      await expect(queryInterface.dropSchema(testSchema)).to.be.rejectedWith(`Schemas are not supported in ${dialect.name}.`);
      await expect(queryInterface.listSchemas()).to.be.rejectedWith(`Schemas are not supported in ${dialect.name}.`);
    });

    return;
  }

  it('creates a schema', async () => {
    const preCreationSchemas = await queryInterface.listSchemas();
    expect(preCreationSchemas).to.not.include(testSchema, 'testSchema existed before tests ran');

    await queryInterface.createSchema(testSchema);
    const postCreationSchemas = await queryInterface.listSchemas();
    expect(postCreationSchemas).to.include(testSchema, 'createSchema did not create testSchema');
  });

  it(`passes options through to the queryInterface's queryGenerator`, async () => {
    const options: CreateSchemaQueryOptions = {
      collate: 'en_US.UTF-8',
      charset: 'utf8mb4',
    };
    const queryGeneratorSpy = spy(sequelize.queryGenerator, 'createSchemaQuery');

    try {
      await queryInterface.createSchema(testSchema, options);
    } catch {
      // Dialects which don't support collate/charset will throw
    }

    expect(queryGeneratorSpy.args[0]).to.include(options);
  });

  it('drops a schema', async () => {
    await queryInterface.createSchema(testSchema);
    const preDeletionSchemas = await queryInterface.listSchemas();
    expect(preDeletionSchemas).to.include(testSchema, 'createSchema did not create testSchema');

    await queryInterface.dropSchema(testSchema);
    const postDeletionSchemas = await queryInterface.listSchemas();
    expect(postDeletionSchemas).to.not.include(testSchema, 'dropSchema did not drop testSchema');
  });

  it('shows all schemas', async () => {
    await queryInterface.createSchema(testSchema);
    const allSchemas = await queryInterface.listSchemas();

    const expected = dialectsWithEqualDBsSchemas.includes(dialect.name)
      ? [sequelize.config.database, testSchema]
      : [testSchema];
    expect(allSchemas.sort()).to.deep.eq(expected.sort());
  });
});
