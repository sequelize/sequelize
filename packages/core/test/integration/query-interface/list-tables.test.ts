import { DataTypes } from '@sequelize/core';
import type { MsSqlDialect } from '@sequelize/mssql';
import type { PostgresDialect } from '@sequelize/postgres';
import type { SnowflakeDialect } from '@sequelize/snowflake';
import { expect } from 'chai';
import { createSequelizeInstance, sequelize } from '../support';

const dialectName = sequelize.dialect.name;
const queryInterface = sequelize.queryInterface;

describe('QueryInterface#listTables', () => {
  describe('listTables', () => {
    it('should show all tables', async () => {
      await queryInterface.createTable('my_test_table1', { name: DataTypes.STRING });
      await queryInterface.createTable('my_test_table2', { name: DataTypes.STRING });
      const allTables = await queryInterface.listTables();
      const tableNames = allTables.map(v => v.tableName);

      expect(tableNames).to.deep.equal(['my_test_table1', 'my_test_table2']);
    });

    it('should not contain views', async () => {
      async function cleanup() {
        if (dialectName === 'db2') {
          // DB2 does not support DROP VIEW IF EXISTS
          try {
            await sequelize.queryRaw('DROP VIEW V_Fail;');
          } catch (error) {
            // -204 means V_Fail does not exist
            // https://www.ibm.com/docs/en/db2-for-zos/11?topic=sec-204
            // @ts-expect-error -- TODO: type error
            if (error.cause.sqlcode !== -204) {
              throw error;
            }
          }
        } else {
          await sequelize.queryRaw('DROP VIEW IF EXISTS V_Fail;');
        }
      }

      await queryInterface.createTable('my_test_table', { name: DataTypes.STRING });
      await cleanup();
      const sql = `CREATE VIEW V_Fail AS SELECT 1 Id${['db2', 'ibmi'].includes(dialectName) ? ' FROM SYSIBM.SYSDUMMY1' : ''};`;
      await sequelize.queryRaw(sql);
      const allTables = await queryInterface.listTables();
      const tableNames = allTables.map(v => v.tableName);
      await cleanup();

      expect(tableNames).to.deep.equal(['my_test_table']);
    });

    if (sequelize.dialect.supports.multiDatabases) {
      it('should not show tables in other databases', async () => {
        await queryInterface.createTable('my_test_table1', { name: DataTypes.STRING });
        await queryInterface.createDatabase('dummy_db');

        const testSequelize = createSequelizeInstance<
          PostgresDialect | MsSqlDialect | SnowflakeDialect
        >({ database: 'dummy_db' });
        await testSequelize.queryInterface.createTable('my_test_table2', { id: DataTypes.INTEGER });
        await testSequelize.close();

        const allTables = await queryInterface.listTables();
        const tableNames = allTables.map(v => v.tableName);
        await queryInterface.dropDatabase('dummy_db');

        expect(tableNames).to.deep.equal(['my_test_table1']);
      });
    }

    if (['mysql', 'mariadb'].includes(dialectName)) {
      it('should show all tables in all databases', async () => {
        await queryInterface.createTable('my_test_table1', { name: DataTypes.STRING });
        // In MariaDB and MySQL, schema and database are the same thing
        await queryInterface.createSchema('dummy_db');
        await queryInterface.createTable(
          { tableName: 'my_test_table2', schema: 'dummy_db' },
          { name: DataTypes.STRING },
        );
        const allTables = await queryInterface.listTables();

        expect(allTables).to.deep.equal([
          { tableName: 'my_test_table2', schema: 'dummy_db' },
          { tableName: 'my_test_table1', schema: sequelize.dialect.getDefaultSchema() },
        ]);
      });
    }
  });

  if (sequelize.dialect.supports.schemas) {
    describe('with schemas', () => {
      it('should show all tables in the specified schema', async () => {
        await queryInterface.createTable('my_test_table1', { name: DataTypes.STRING });
        await queryInterface.createSchema('my_test_schema');
        await queryInterface.createTable(
          { tableName: 'my_test_table2', schema: 'my_test_schema' },
          { name: DataTypes.STRING },
        );
        await queryInterface.createTable(
          { tableName: 'my_test_table3', schema: 'my_test_schema' },
          { name: DataTypes.STRING },
        );
        const allTables = await queryInterface.listTables({ schema: 'my_test_schema' });

        expect(allTables).to.deep.equal([
          { tableName: 'my_test_table2', schema: 'my_test_schema' },
          { tableName: 'my_test_table3', schema: 'my_test_schema' },
        ]);
      });
    });
  }
});
