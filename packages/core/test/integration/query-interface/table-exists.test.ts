import { DataTypes } from '@sequelize/core';
import { expect } from 'chai';
import { sequelize } from '../support';

const queryInterface = sequelize.queryInterface;

describe('QueryInterface#tableExists', () => {
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

    it('should return true if table exists', async () => {
      const exists = await queryInterface.tableExists('levels');
      expect(exists).to.be.true;
    });

    it('should return false if table does not exist', async () => {
      const exists = await queryInterface.tableExists('actors');
      expect(exists).to.be.false;
    });
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

      it('should return true if table exists', async () => {
        const exists = await queryInterface.tableExists({ tableName: 'levels', schema: 'archive' });
        expect(exists).to.be.true;
      });

      it('should return false if table does not exist', async () => {
        const exists = await queryInterface.tableExists({ tableName: 'actors', schema: 'archive' });
        expect(exists).to.be.false;
      });
    });
  }
});
