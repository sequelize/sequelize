import { expect } from 'chai';
import { DataTypes } from '@sequelize/core';
import { sequelize } from '../support';

const dialect = sequelize.dialect;
const queryInterface = sequelize.queryInterface;

describe('QueryInterface#renameTable', () => {
  describe('without schema', () => {
    beforeEach(async () => {
      await queryInterface.createTable('my_test_table', {
        name: DataTypes.STRING,
      });
    });

    it('should rename table', async () => {
      await queryInterface.renameTable('my_test_table', 'my_test_table_new');
      const result = await queryInterface.listTables();
      const tableNames = result.map(v => v.tableName);

      expect(tableNames).to.contain('my_test_table_new');
      expect(tableNames).to.not.contain('my_test_table');
    });
  });

  if (sequelize.dialect.supports.schemas) {
    describe('with schemas', () => {
      const schema = 'my_schema';
      beforeEach(async () => {
        await queryInterface.createSchema(schema);
        await queryInterface.createTable({ tableName: 'my_test_table', schema }, {
          name: DataTypes.STRING,
        });
      });

      it('should rename table with schema', async () => {
        await queryInterface.renameTable({ tableName: 'my_test_table', schema }, { tableName: 'my_test_table_new', schema });
        const result = await queryInterface.listTables({ schema: 'my_schema' });
        const tableNames = result.map(v => v.tableName);

        expect(tableNames).to.contain('my_test_table_new');
        expect(tableNames).to.not.contain('my_test_table');
      });

      it('should throw error when moving table to another schema if changeSchema is not set', async () => {
        const promise = queryInterface.renameTable(
          { tableName: 'my_test_table', schema },
          { tableName: 'my_test_table', schema: dialect.getDefaultSchema() },
        );

        if (['db2', 'ibmi'].includes(dialect.name)) {
          await expect(promise).to.be.rejectedWith(`Moving tables between schemas is not supported by ${dialect.name} dialect.`);
        } else {
          await expect(promise).to.be.rejectedWith('To move a table between schemas, you must set `options.changeSchema` to true.');
        }

      });

      it('should move table to another schema', async () => {
        const promise = queryInterface.renameTable(
          { tableName: 'my_test_table', schema },
          { tableName: 'my_test_table', schema: dialect.getDefaultSchema() },
          { changeSchema: true },
        );

        if (['db2', 'ibmi'].includes(dialect.name)) {
          await expect(promise).to.be.rejectedWith(`Moving tables between schemas is not supported by ${dialect.name} dialect.`);
        } else {
          await promise;
          const previousSchemaResult = await queryInterface.listTables({ schema });
          const previousSchemaTableNames = previousSchemaResult.map(v => v.tableName);
          expect(previousSchemaTableNames).to.not.contain('my_test_table');

          const defaultSchemaResult = await queryInterface.listTables({ schema: dialect.getDefaultSchema() });
          const defaultSchemaTableNames = defaultSchemaResult.map(v => v.tableName);
          expect(defaultSchemaTableNames).to.contain('my_test_table');
        }
      });

      it('should move table to another schema with new table name', async () => {
        const promise = queryInterface.renameTable(
          { tableName: 'my_test_table', schema },
          { tableName: 'my_test_table_new', schema: dialect.getDefaultSchema() },
          { changeSchema: true },
        );

        if (['db2', 'ibmi'].includes(dialect.name)) {
          await expect(promise).to.be.rejectedWith(`Moving tables between schemas is not supported by ${dialect.name} dialect.`);
        } else if (['mssql', 'postgres'].includes(dialect.name)) {
          await expect(promise).to.be.rejectedWith(`Renaming a table and moving it to a different schema is not supported by ${dialect.name}.`);
        } else {
          await promise;
          const previousSchemaResult = await queryInterface.listTables({ schema });
          const previousSchemaTableNames = previousSchemaResult.map(v => v.tableName);
          expect(previousSchemaTableNames).to.not.contain('my_test_table');

          const defaultSchemaResult = await queryInterface.listTables({ schema: dialect.getDefaultSchema() });
          const defaultSchemaTableNames = defaultSchemaResult.map(v => v.tableName);
          expect(defaultSchemaTableNames).to.contain('my_test_table_new');
        }
      });
    });
  }
});
