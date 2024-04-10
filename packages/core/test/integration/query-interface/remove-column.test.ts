import { DataTypes } from '@sequelize/core';
import { expect } from 'chai';
import { getTestDialect, getTestDialectTeaser, sequelize } from '../support';

const dialectName = getTestDialect();
const queryInterface = sequelize.queryInterface;

describe(getTestDialectTeaser('QueryInterface#removeColumn'), () => {
  describe('Without schema', () => {
    beforeEach(async () => {
      await queryInterface.createTable('users', {
        id: {
          type: DataTypes.INTEGER,
          primaryKey: true,
          autoIncrement: true,
        },
        firstName: {
          type: DataTypes.STRING,
          defaultValue: 'Someone',
        },
        lastName: {
          type: DataTypes.STRING,
        },
        manager: {
          type: DataTypes.INTEGER,
          references: {
            table: 'users',
            key: 'id',
          },
        },
        email: {
          type: DataTypes.STRING,
          allowNull: false,
          unique: true,
        },
      });
    });

    if (sequelize.dialect.supports.removeColumn.cascade) {
      it('should be able to remove a column with cascade', async () => {
        await queryInterface.createTable('level', {
          id: {
            type: DataTypes.INTEGER,
            primaryKey: true,
            autoIncrement: true,
          },
          name: {
            type: DataTypes.STRING,
            allowNull: false,
          },
        });

        await queryInterface.addColumn('users', 'level_id', {
          type: DataTypes.INTEGER,
          references: { key: 'id', table: 'level' },
        });

        await queryInterface.removeColumn('level', 'id', { cascade: true });

        const levelTable = await queryInterface.describeTable('level');
        expect(levelTable).to.not.have.property('id');
        const usersTable = await queryInterface.describeTable('users');
        expect(usersTable).to.have.property('level_id');
      });
    }

    if (sequelize.dialect.supports.removeColumn.ifExists) {
      it('should not throw an error for a non-existant column', async () => {
        await queryInterface.removeColumn('users', 'bla', { ifExists: true });
      });
    }

    it('should be able to remove a column with a default value', async () => {
      await queryInterface.removeColumn('users', 'firstName');
      const table = await queryInterface.describeTable('users');
      expect(table).to.not.have.property('firstName');
    });

    it('should be able to remove a column without default value', async () => {
      await queryInterface.removeColumn('users', 'lastName');
      const table = await queryInterface.describeTable('users');
      expect(table).to.not.have.property('lastName');
    });

    it('should be able to remove a column with a foreign key constraint', async () => {
      await queryInterface.removeColumn('users', 'manager');
      const table = await queryInterface.describeTable('users');
      expect(table).to.not.have.property('manager');
    });

    it('should be able to remove a column with primaryKey', async () => {
      await queryInterface.removeColumn('users', 'manager');
      const table0 = await queryInterface.describeTable('users');
      expect(table0).to.not.have.property('manager');
      await queryInterface.removeColumn('users', 'id');
      const table = await queryInterface.describeTable('users');
      expect(table).to.not.have.property('id');
    });

    // From MSSQL documentation on ALTER COLUMN:
    //    The modified column cannot be any one of the following:
    //      - Used in a CHECK or UNIQUE constraint.
    // https://docs.microsoft.com/en-us/sql/t-sql/statements/alter-table-transact-sql#arguments
    if (dialectName !== 'mssql') {
      it('should be able to remove a column with unique contraint', async () => {
        await queryInterface.removeColumn('users', 'email');
        const table = await queryInterface.describeTable('users');
        expect(table).to.not.have.property('email');
      });
    }

    // sqlite has limited ALTER TABLE capapibilites which requires a workaround involving recreating tables.
    // This leads to issues with losing data or losing foreign key references.
    // The tests below address these problems
    it('should remove a column with from table with foreign key constraints without losing data', async () => {
      await queryInterface.createTable('level', {
        id: {
          type: DataTypes.INTEGER,
          primaryKey: true,
          autoIncrement: true,
        },
        name: {
          type: DataTypes.STRING,
          allowNull: false,
        },
      });

      await queryInterface.createTable('actors', {
        id: {
          type: DataTypes.INTEGER,
          primaryKey: true,
          autoIncrement: true,
        },
        name: {
          type: DataTypes.STRING,
          allowNull: true,
        },
        level_id: {
          type: DataTypes.INTEGER,
          allowNull: false,
          references: {
            key: 'id',
            table: 'level',
          },
          onDelete: 'CASCADE',
          onUpdate: 'CASCADE',
        },
      });

      await queryInterface.bulkInsert('level', [{ name: 'L1' }, { name: 'L2' }, { name: 'L3' }]);
      await queryInterface.bulkInsert('actors', [
        { name: 'Keanu Reeves', level_id: 2 },
        { name: 'Laurence Fishburne', level_id: 1 },
      ]);

      await queryInterface.removeColumn('level', 'name');

      const actors = await queryInterface.select(null, 'actors', {});
      expect(actors).to.deep.equal([
        { id: 1, name: 'Keanu Reeves', level_id: 2 },
        { id: 2, name: 'Laurence Fishburne', level_id: 1 },
      ]);
    });

    it('should retain ON UPDATE and ON DELETE constraints after a column is removed', async () => {
      await queryInterface.createTable('level', {
        id: {
          type: DataTypes.INTEGER,
          primaryKey: true,
          autoIncrement: true,
        },
        name: {
          type: DataTypes.STRING,
          allowNull: false,
        },
      });

      await queryInterface.createTable('actors', {
        id: {
          type: DataTypes.INTEGER,
          primaryKey: true,
          autoIncrement: true,
        },
        name: {
          type: DataTypes.STRING,
          allowNull: true,
        },
        level_id: {
          type: DataTypes.INTEGER,
          allowNull: false,
        },
      });

      await queryInterface.addConstraint('actors', {
        name: 'actors_level_id_fkey',
        type: 'FOREIGN KEY',
        fields: ['level_id'],
        references: { field: 'id', table: 'level' },
        onDelete: 'CASCADE',
      });

      await queryInterface.removeColumn('actors', 'name');

      const defaultSchema = sequelize.dialect.getDefaultSchema();
      const constraints = await queryInterface.showConstraints('actors', {
        constraintType: 'FOREIGN KEY',
      });
      expect(constraints).to.deep.equal([
        {
          ...(['mssql', 'postgres'].includes(dialectName) && {
            constraintCatalog: 'sequelize_test',
          }),
          constraintSchema: defaultSchema,
          constraintName: dialectName === 'sqlite3' ? 'FOREIGN' : 'actors_level_id_fkey',
          constraintType: 'FOREIGN KEY',
          ...(['mssql', 'postgres'].includes(dialectName) && { tableCatalog: 'sequelize_test' }),
          tableSchema: defaultSchema,
          tableName: 'actors',
          columnNames: ['level_id'],
          referencedTableName: 'level',
          referencedTableSchema: defaultSchema,
          referencedColumnNames: ['id'],
          deleteAction: 'CASCADE',
          updateAction:
            dialectName === 'mariadb' ? 'RESTRICT' : dialectName === 'sqlite3' ? '' : 'NO ACTION',
          ...(sequelize.dialect.supports.constraints.deferrable && {
            deferrable: 'INITIALLY_IMMEDIATE',
          }),
        },
      ]);
    });
  });

  if (sequelize.dialect.supports.schemas) {
    describe('With schema', () => {
      beforeEach(async () => {
        await sequelize.createSchema('archive');

        await queryInterface.createTable(
          {
            tableName: 'users',
            schema: 'archive',
          },
          {
            id: {
              type: DataTypes.INTEGER,
              primaryKey: true,
              autoIncrement: true,
            },
            firstName: {
              type: DataTypes.STRING,
              defaultValue: 'Someone',
            },
            lastName: {
              type: DataTypes.STRING,
            },
            email: {
              type: DataTypes.STRING,
              unique: true,
              allowNull: false,
            },
          },
        );
      });

      it('should be able to remove a column', async () => {
        await queryInterface.removeColumn(
          {
            tableName: 'users',
            schema: 'archive',
          },
          'lastName',
        );

        const table = await queryInterface.describeTable({
          tableName: 'users',
          schema: 'archive',
        });

        expect(table).to.not.have.property('lastName');
      });
    });
  }
});
