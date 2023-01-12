import { expect } from 'chai';
import { spy } from 'sinon';
import type { CreateSchemaQueryOptions } from '@sequelize/core/_non-semver-use-at-your-own-risk_/dialects/abstract/query-generator';
import { sequelize } from '../support';

const { queryInterface, dialect } = sequelize;
const testSchema = 'testSchema';

// MySQL and MariaDB view databases and schemas as identical. Other databases consider them separate entities.
const dialectsWithEqualDBsSchemas = ['mysql', 'mariadb'];

describe('QueryInterface#{create,drop,dropAll,showAll}Schema', () => {
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

    const expected = dialectsWithEqualDBsSchemas.includes(dialect.name)
      ? [sequelize.config.database, testSchema]
      : [testSchema];
    expect(allSchemas.sort()).to.deep.eq(expected.sort());
  });

  describe('drops all schemas', () => {
    it('drops all schemas except default schema', async () => {
      await queryInterface.dropAllSchemas({
        skip: [sequelize.config.database],
      });
      const postDeleteSchemas = await queryInterface.showAllSchemas();

      const expected = dialectsWithEqualDBsSchemas.includes(dialect.name) ? [sequelize.config.database] : [];
      expect(postDeleteSchemas).to.deep.eq(expected);
    });

    it('drops all schemas except test schema', async () => {
      // required for testing this option with Postgres, MSSQL, DB2
      if (!['postgres', 'mssql', 'db2'].includes(dialect.name)) {
        return;
      }

      await queryInterface.createSchema(testSchema);
      await queryInterface.dropAllSchemas({
        skip: [testSchema],
      });
      const postDeleteSchemas = await queryInterface.showAllSchemas();
      expect(postDeleteSchemas).to.deep.eq([testSchema]);
    });

    it('drops all schemas', async () => {
      await queryInterface.dropAllSchemas();
      const postDeleteSchemas = await queryInterface.showAllSchemas();
      expect(postDeleteSchemas).to.be.empty;

      // Removing this call will break all subsequent MariaDB/MySQL tests since the they wouldn't
      // have a database to run against. Recreate test schema - can't run this in an `after` block
      // since `afterEach` hooks run first and require their own database
      if (dialectsWithEqualDBsSchemas.includes(dialect.name)) {
        await queryInterface.createSchema(sequelize.config.database);
        await sequelize.queryRaw(`USE ${sequelize.config.database}`);
      }
    });
  });
});
