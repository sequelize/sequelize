import { DataTypes } from '@sequelize/core';
import { expect } from 'chai';
import { sequelize } from '../support';

const queryInterface = sequelize.queryInterface;

describe('QueryInterface#dropTable', () => {
  describe('Without schema', () => {
    beforeEach(async () => {
      await queryInterface.createTable('levels', {
        id: {
          type: DataTypes.INTEGER,
          autoIncrement: true,
          primaryKey: true,
        },
        name: {
          type: DataTypes.STRING,
          allowNull: false,
        },
      });
    });

    it('should drop a table', async () => {
      await queryInterface.dropTable('levels');
      const exists = await queryInterface.tableExists('levels');
      expect(exists).to.be.false;
    });

    if (sequelize.dialect.supports.dropTable.cascade) {
      it('should drop a table with dependencies', async () => {
        await queryInterface.createTable('actors', {
          id: {
            type: DataTypes.INTEGER,
            autoIncrement: true,
            primaryKey: true,
          },
          levelId: {
            type: DataTypes.INTEGER,
            references: {
              table: 'levels',
              key: 'id',
            },
          },
        });

        await queryInterface.dropTable('levels', { cascade: true });
        const allTables = await queryInterface.listTables();
        const tableNames = allTables.map(table => table.tableName);
        // Cascade only removes the foreign key constraint, not the related table
        expect(tableNames).to.deep.equal(['actors']);
      });
    }
  });

  if (sequelize.dialect.supports.schemas) {
    describe('With schema', () => {
      beforeEach(async () => {
        await queryInterface.createSchema('archive');

        await queryInterface.createTable(
          { tableName: 'levels', schema: 'archive' },
          {
            id: {
              type: DataTypes.INTEGER,
              primaryKey: true,
              autoIncrement: true,
            },
            name: {
              type: DataTypes.STRING,
              allowNull: false,
            },
          },
        );
      });

      it('should drop a table', async () => {
        await queryInterface.dropTable({ tableName: 'levels', schema: 'archive' });
        const exists = await queryInterface.tableExists({ tableName: 'levels', schema: 'archive' });
        expect(exists).to.be.false;
      });
    });
  }
});
