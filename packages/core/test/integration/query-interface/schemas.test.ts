import { expect } from 'chai';
import { spy } from 'sinon';
import type { CreateSchemaQueryOptions } from '@sequelize/core/_non-semver-use-at-your-own-risk_/dialects/abstract/query-generator';
import { sequelize } from '../support';

const queryInterface = sequelize.queryInterface;

const testSchema = 'testSchema';

const dialectsWithWeirdSchemas = ['postgres', 'mssql', 'db2'];

describe('QueryInterface#{create,drop,dropAll,showAll}Schema', () => {
  const dialect = sequelize.dialect;
  if (!dialect.supports.schemas) {
    return;
  }

  it('creates a schema', async () => {
    const preCreationSchemas = await queryInterface.showAllSchemas();
    expect(preCreationSchemas).to.not.include(testSchema, 'testSchema existed before tests ran');

    await queryInterface.createSchema(testSchema);
    const postCreationSchemas = await queryInterface.showAllSchemas();
    expect(postCreationSchemas).to.include(testSchema, 'createSchema did not create testSchema');
  });

  it(`passes options through to the queryInterface's queryGenerator`, async () => {
    const options: CreateSchemaQueryOptions = {
      collate: 'en_US.UTF-8',
      charset: 'utf8mb4',
    };
    const queryGeneratorSpy = spy(queryInterface.queryGenerator, 'createSchemaQuery');

    try {
      await queryInterface.createSchema(testSchema, options);
    } catch {
      // Dialects which don't support collate/charset will throw
    }

    expect(queryGeneratorSpy.args[0]).to.include(options);
  });

  it('drops a schema', async () => {
    await queryInterface.createSchema(testSchema);
    const preDeletionSchemas = await queryInterface.showAllSchemas();
    expect(preDeletionSchemas).to.include(testSchema, 'createSchema did not create testSchema');

    await queryInterface.dropSchema(testSchema);
    const postDeletionSchemas = await queryInterface.showAllSchemas();
    expect(postDeletionSchemas).to.not.include(testSchema, 'dropSchema did not drop testSchema');
  });

  it('shows all schemas', async () => {
    await queryInterface.createSchema(testSchema);
    const allSchemas = await queryInterface.showAllSchemas();

    const expected = dialectsWithWeirdSchemas.includes(dialect.name)
      ? [testSchema]
      : [sequelize.config.database, testSchema];
    expect(allSchemas.sort()).to.deep.eq(expected.sort());
  });

  describe('drops all schemas', () => {
    it('drops all schemas except test schema', async () => {
      await queryInterface.dropAllSchemas({
        skip: [sequelize.config.database],
      });
      const postDeleteSchemas = await queryInterface.showAllSchemas();

      const expected = dialectsWithWeirdSchemas.includes(dialect.name) ? [] : [sequelize.config.database];
      expect(postDeleteSchemas).to.deep.eq(expected);
    });

    it('drops all schemas', async () => {
      await queryInterface.dropAllSchemas();
      const postDeleteSchemas = await queryInterface.showAllSchemas();
      expect(postDeleteSchemas).to.be.empty;

      // Recreate test schema - can't run this in an `after` block since `afterEach` runs first
      if (!dialectsWithWeirdSchemas.includes(dialect.name)) {
        await queryInterface.createSchema(sequelize.config.database);
        await sequelize.queryRaw(`USE ${sequelize.config.database}`);
      }
    });
  });
});
