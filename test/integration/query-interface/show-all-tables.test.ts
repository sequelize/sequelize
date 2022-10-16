import type Sequelize from '@sequelize/core';
import type { QueryInterface } from '@sequelize/core';
import { DataTypes, QueryTypes } from '@sequelize/core';
import { expect } from 'chai';
import { sequelize, getTestDialect, createSequelizeInstance } from '../support';

const queryInterface = sequelize.queryInterface;
const dialect = sequelize.dialect;
const dialectName = getTestDialect();

describe('QueryInterface#showAllTables', () => {

  const getSequelizeInstanceWithSchema = async () => {
    const _sequelize = createSequelizeInstance({ schema: 'schema_3' });
    await createSchemaAndTables(_sequelize, ['schema_3', 'schema_4']);

    return { sequelize: _sequelize };
  };

  const createTestTablesForSchema = async (
    schemaName: string,
    _queryInterface: QueryInterface,
  ) => Promise.all([1, 2].map(async (_, index) => _queryInterface.createTable(
    `${schemaName}_table_${index + 1}`,
    { name: DataTypes.STRING },
    {
      schema: schemaName,
    },
  )));

  const createSchemaAndTables = async (
    _sequelize: Sequelize,
    testSchemas: string[] = [],
  ) => {
    const baseTestSchemas = [
      'schema_1',
      'schema_2',
      'sequelize_test',
      ...testSchemas,
    ];
    await Promise.all(baseTestSchemas.map(async (schemaName: string) => {
      await _sequelize.createSchema(schemaName);
      await createTestTablesForSchema(
        schemaName,
        _sequelize.queryInterface,
      );
    }));
  };

  const normalizeTableNames = (tableNames: string[] | any[] = []) => {
    if (tableNames[0] && tableNames[0].tableName) {
      // eslint-disable-next-line @typescript-eslint/require-array-sort-compare
      return tableNames.map(v => v.tableName).sort();
    }

    // eslint-disable-next-line @typescript-eslint/require-array-sort-compare
    return tableNames.sort();
  };

  const queryTableNamesAndNormalizeResults = async (queries: Array<Promise<string[]>>) => {
    const queryResults = await Promise.all(queries);

    return queryResults.map(normalizeTableNames);
  };

  it('should not contain views', async () => {
    async function cleanup(_sequelize: Sequelize) {
      if (dialectName === 'db2') {
        // DB2 does not support DROP VIEW IF EXISTS
        try {
          await _sequelize.query('DROP VIEW V_Fail');
        } catch (error: any) {
          // -204 means V_Fail does not exist
          // https://www.ibm.com/docs/en/db2-for-zos/11?topic=sec-204
          if (error.cause.sqlcode !== -204) {
            throw error;
          }
        }
      } else {
        await _sequelize.query('DROP VIEW IF EXISTS V_Fail');
      }
    }

    await queryInterface.createTable('my_test_table', {
      name: DataTypes.STRING,
    });
    await cleanup(sequelize);
    const sql = `CREATE VIEW V_Fail AS SELECT 1 Id${
      ['db2', 'ibmi'].includes(dialectName) ? ' FROM SYSIBM.SYSDUMMY1' : ''
    }`;
    await sequelize.query(sql);
    const tableNames = normalizeTableNames(await queryInterface.showAllTables());

    await cleanup(sequelize);
    expect(tableNames).to.deep.equal(['my_test_table']);
  });

  if (!['sqlite', 'postgres', 'db2', 'ibmi'].includes(dialectName)) {
    // NOTE: sqlite doesn't allow querying between databases and
    // postgres requires creating a new connection to create a new table.
    it('should not show tables in other databases', async () => {
      await queryInterface.createTable('my_test_table1', {
        name: DataTypes.STRING,
      });
      await sequelize.query('CREATE DATABASE my_test_db');
      await sequelize.query(
        `CREATE TABLE my_test_db${
          dialectName === 'mssql' ? '.dbo' : ''
        }.my_test_table2 (id INT)`,
      );
      const tableNames = normalizeTableNames(await queryInterface.showAllTables());
      await sequelize.query('DROP DATABASE my_test_db');
      expect(tableNames).to.deep.equal(['my_test_table1']);
    });
  }

  if (['mysql', 'mariadb'].includes(dialectName)) {
    it('should show all tables in all databases', async () => {
      await queryInterface.createTable('my_test_table1', {
        name: DataTypes.STRING,
      });
      await sequelize.query('CREATE DATABASE my_test_db');
      await sequelize.query('CREATE TABLE my_test_db.my_test_table2 (id INT)');
      const tableNames = normalizeTableNames(await sequelize.query(
        queryInterface.queryGenerator.showTablesQuery(),
        {
          raw: true,
          type: QueryTypes.SHOWTABLES,
        },
      ));
      await sequelize.query('DROP DATABASE my_test_db');
      expect(tableNames).to.deep.equal(['my_test_table1', 'my_test_table2']);
    });
  }

  describe('schema support tests', () => {
    if (dialect.supports.schemas) {
      it('shows all tables from the specified schema in the method options', async () => {
        await createSchemaAndTables(sequelize);
        const [schemaOneTables, schemaTwoTables] = await queryTableNamesAndNormalizeResults([
          queryInterface.showAllTables({ schema: 'schema_1' }),
          queryInterface.showAllTables({ schema: 'schema_2' })]);

        expect(schemaOneTables).to.deep.equal(['schema_1_table_1', 'schema_1_table_2']);
        expect(schemaTwoTables).to.deep.equal(['schema_2_table_1', 'schema_2_table_2']);
      });

      if (dialectName === 'postgres') {
        it('uses the schema from options instead of initialization options', async () => {
          const { sequelize: _sequelize } = await getSequelizeInstanceWithSchema();
          const [schemaThreeTables, schemaFourTables] = await queryTableNamesAndNormalizeResults([
            _sequelize.queryInterface.showAllTables(),
            _sequelize.queryInterface.showAllTables({
              schema: 'schema_4',
            })]);

          expect(schemaThreeTables).to.deep.equal(['schema_3_table_1', 'schema_3_table_2']);
          expect(schemaFourTables).to.deep.equal(['schema_4_table_1', 'schema_4_table_2']);
        });

        it('defaults to the database name as the schema if it is not specified in init and method options', async () => {
          await createSchemaAndTables(sequelize);
          const [schemaOneTables, schemaTwoTables] = await queryTableNamesAndNormalizeResults([
            queryInterface.showAllTables(),
            queryInterface.showAllTables({ schema: 'schema_2' }),
          ]);

          expect(schemaOneTables).to.deep.equal(['sequelize_test_table_1', 'sequelize_test_table_2']);
          expect(schemaTwoTables).to.deep.equal(['schema_2_table_1', 'schema_2_table_2']);
        });
      }
    }
  });
});
