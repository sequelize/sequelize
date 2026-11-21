import { DataTypes } from '@sequelize/core';
import { buildInvalidOptionReceivedError } from '@sequelize/core/_non-semver-use-at-your-own-risk_/utils/check.js';
import { expect } from 'chai';
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

    // SQLite rewrites references to a renamed table as double-quoted identifiers
    if (dialect.name === 'sqlite3') {
      // the names with quotes check that escaped quote characters are parsed as part of the name
      for (const newTableName of [
        'people',
        'people archive',
        'people "archive"',
        'people `archive`',
      ]) {
        it(`should keep foreign keys that reference the table renamed to ${newTableName}`, async () => {
          await queryInterface.createTable('users', {
            id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
          });
          await queryInterface.createTable('tasks', {
            id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
            name: DataTypes.STRING,
            userId: {
              type: DataTypes.INTEGER,
              references: { table: 'users', key: 'id' },
              onDelete: 'SET NULL',
              onUpdate: 'CASCADE',
            },
            ownerId: DataTypes.INTEGER,
          });
          await queryInterface.addConstraint('tasks', {
            name: 'tasks_owner_fk',
            type: 'FOREIGN KEY',
            fields: ['ownerId'],
            references: { table: 'users', field: 'id' },
          });

          await queryInterface.renameTable('users', newTableName);

          const expectForeignKeysToReferenceRenamedTable = async () => {
            const foreignKeys = await queryInterface.showConstraints('tasks', {
              constraintType: 'FOREIGN KEY',
            });
            expect(foreignKeys).to.have.length(2);
            for (const columnName of ['userId', 'ownerId']) {
              expect(foreignKeys.find(fk => fk.columnNames?.[0] === columnName)).to.deep.include({
                referencedTableName: newTableName,
                referencedColumnNames: ['id'],
              });
            }
          };

          await expectForeignKeysToReferenceRenamedTable();

          // rebuilding the table must not drop the reference
          await queryInterface.renameColumn('tasks', 'name', 'title');
          await expectForeignKeysToReferenceRenamedTable();
        });
      }
    }
  });

  if (sequelize.dialect.supports.schemas) {
    describe('with schemas', () => {
      const schema = 'my_schema';
      beforeEach(async () => {
        await queryInterface.createSchema(schema);
        await queryInterface.createTable(
          { tableName: 'my_test_table', schema },
          {
            name: DataTypes.STRING,
          },
        );
      });

      it('should rename table with schema', async () => {
        await queryInterface.renameTable(
          { tableName: 'my_test_table', schema },
          { tableName: 'my_test_table_new', schema },
        );
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

        if (dialect.supports.renameTable.changeSchema) {
          await expect(promise).to.be.rejectedWith(
            'To move a table between schemas, you must set `options.changeSchema` to true.',
          );
        } else {
          await expect(promise).to.be.rejectedWith(
            `Moving tables between schemas is not supported by ${dialect.name} dialect.`,
          );
        }
      });

      it('should move table to another schema', async () => {
        const promise = queryInterface.renameTable(
          { tableName: 'my_test_table', schema },
          { tableName: 'my_test_table', schema: dialect.getDefaultSchema() },
          { changeSchema: true },
        );

        if (dialect.supports.renameTable.changeSchema) {
          await promise;
          const previousSchemaResult = await queryInterface.listTables({ schema });
          const previousSchemaTableNames = previousSchemaResult.map(v => v.tableName);
          expect(previousSchemaTableNames).to.not.contain('my_test_table');

          const defaultSchemaResult = await queryInterface.listTables({
            schema: dialect.getDefaultSchema(),
          });
          const defaultSchemaTableNames = defaultSchemaResult.map(v => v.tableName);
          expect(defaultSchemaTableNames).to.contain('my_test_table');
        } else {
          await expect(promise).to.be.rejectedWith(
            buildInvalidOptionReceivedError('renameTableQuery', dialect.name, ['changeSchema'])
              .message,
          );
        }
      });

      it('should move table to another schema with new table name', async () => {
        const promise = queryInterface.renameTable(
          { tableName: 'my_test_table', schema },
          { tableName: 'my_test_table_new', schema: dialect.getDefaultSchema() },
          { changeSchema: true },
        );

        if (dialect.supports.renameTable.changeSchema) {
          if (dialect.supports.renameTable.changeSchemaAndTable) {
            await promise;
            const previousSchemaResult = await queryInterface.listTables({ schema });
            const previousSchemaTableNames = previousSchemaResult.map(v => v.tableName);
            expect(previousSchemaTableNames).to.not.contain('my_test_table');

            const defaultSchemaResult = await queryInterface.listTables({
              schema: dialect.getDefaultSchema(),
            });
            const defaultSchemaTableNames = defaultSchemaResult.map(v => v.tableName);
            expect(defaultSchemaTableNames).to.contain('my_test_table_new');
          } else {
            await expect(promise).to.be.rejectedWith(
              `Renaming a table and moving it to a different schema is not supported by ${dialect.name}.`,
            );
          }
        } else {
          await expect(promise).to.be.rejectedWith(
            buildInvalidOptionReceivedError('renameTableQuery', dialect.name, ['changeSchema'])
              .message,
          );
        }
      });
    });
  }
});
