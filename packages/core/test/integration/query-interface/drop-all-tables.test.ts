import { DataTypes } from '@sequelize/core';
import { expect } from 'chai';
import { sequelize } from '../support';

const queryInterface = sequelize.queryInterface;

describe('QueryInterface#dropAllTables', () => {
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

      await queryInterface.createTable('actors', {
        id: {
          type: DataTypes.INTEGER,
          autoIncrement: true,
          primaryKey: true,
        },
        levelId: {
          type: DataTypes.INTEGER,
          allowNull: false,
          references: {
            table: 'levels',
            key: 'id',
          },
        },
      });
    });

    it('should drop all tables', async () => {
      await queryInterface.dropAllTables();
      const tables = await queryInterface.listTables();
      expect(tables).to.be.empty;
    });
  });

  if (sequelize.dialect.supports.schemas) {
    describe('With schema', () => {
      const schema = 'archive';
      beforeEach(async () => {
        await queryInterface.createSchema(schema);
        await queryInterface.createTable(
          {
            tableName: 'levels',
            schema,
          },
          {
            id: {
              type: DataTypes.INTEGER,
              autoIncrement: true,
              primaryKey: true,
            },
            name: {
              type: DataTypes.STRING,
              allowNull: false,
            },
          },
        );

        await queryInterface.createTable(
          {
            tableName: 'actors',
            schema,
          },
          {
            id: {
              type: DataTypes.INTEGER,
              autoIncrement: true,
              primaryKey: true,
            },
            levelId: {
              type: DataTypes.INTEGER,
              allowNull: false,
              references: {
                table: {
                  tableName: 'levels',
                  schema,
                },
                key: 'id',
              },
            },
          },
        );
      });

      it('should drop a table', async () => {
        await queryInterface.dropAllTables();
        const tables = await queryInterface.listTables();
        expect(tables).to.be.empty;
      });
    });
  }
});
