import { expect } from 'chai';
import { spy } from 'sinon';
import type { CreateSchemaQueryOptions } from '@sequelize/core';
import { DataTypes, sql } from '@sequelize/core';
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

  if (dialect.supports.createSchema.authorization) {
    it('creates a schema with an authorization', async () => {
      if (dialect.name === 'mssql') {
        // MSSQL requires a user to be created before creating a schema with an authorization
        await sequelize.query('CREATE LOGIN [myUser] WITH PASSWORD = \'Password12!\'');
        await sequelize.query('CREATE USER [myUser] FOR LOGIN [myUser]');
        await queryInterface.createSchema(testSchema, { authorization: 'myUser' });
      } else {
        await queryInterface.createSchema(testSchema, { authorization: sql`CURRENT_USER` });
      }

      const postCreationSchemas = await queryInterface.listSchemas();
      expect(postCreationSchemas).to.include(testSchema, 'createSchema did not create testSchema');

      if (dialect.name === 'mssql') {
        await queryInterface.dropSchema(testSchema);
        await sequelize.query('DROP USER [myUser]');
        await sequelize.query('DROP LOGIN [myUser]');
      }
    });
  }

  if (dialect.supports.createSchema.charset) {
    it('creates a schema with a charset', async () => {
      await queryInterface.createSchema(testSchema, { charset: 'utf8mb4' });
      const postCreationSchemas = await queryInterface.listSchemas();
      expect(postCreationSchemas).to.include(testSchema, 'createSchema did not create testSchema');
    });
  }

  if (dialect.supports.createSchema.collate) {
    it('creates a schema with a collate', async () => {
      await queryInterface.createSchema(testSchema, { collate: 'latin2_general_ci' });
      const postCreationSchemas = await queryInterface.listSchemas();
      expect(postCreationSchemas).to.include(testSchema, 'createSchema did not create testSchema');
    });
  }

  if (dialect.supports.createSchema.comment) {
    it('creates a schema with a comment', async () => {
      await queryInterface.createSchema(testSchema, { comment: 'myComment' });
      const postCreationSchemas = await queryInterface.listSchemas();
      expect(postCreationSchemas).to.include(testSchema, 'createSchema did not create testSchema');
    });
  }

  if (dialect.supports.createSchema.ifNotExists) {
    it('does not throw if the schema already exists', async () => {
      await queryInterface.createSchema(testSchema);
      await queryInterface.createSchema(testSchema, { ifNotExists: true });
    });
  }

  if (dialect.supports.createSchema.replace) {
    it('replaces a schema if it already exists', async () => {
      await queryInterface.createSchema(testSchema);
      await queryInterface.createTable({ tableName: 'testTable', schema: testSchema }, { id: { type: DataTypes.INTEGER, primaryKey: true } });
      await queryInterface.createSchema(testSchema, { replace: true });
      expect(await queryInterface.listTables()).to.be.empty;
    });
  }

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
