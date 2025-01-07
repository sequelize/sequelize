import { QueryTypes } from '@sequelize/core';
import { expect } from 'chai';
import {
  getTestDialect,
  sequelize,
} from '../../support';

const dialect = getTestDialect();
const queryInterface = sequelize.queryInterface;

if (dialect === 'hana') {
  describe('[HANA Specific] TABLE_TYPE - ROW', () => {
    it('should create a ROW table', async () => {
      const testTableName = 'myTable';
      const tableExists = await queryInterface.tableExists(testTableName);
      if (tableExists) {
        await queryInterface.dropTable(testTableName);
      }
      await sequelize.query(
        `CREATE ROW TABLE "${testTableName}" ("myColumn" INTEGER, PRIMARY KEY ("myColumn"))`,
      );

      const [result] = await sequelize.query<{ TABLE_TYPE: string }>(
        `SELECT TABLE_TYPE FROM SYS.TABLES ` +
        `WHERE SCHEMA_NAME = CURRENT_SCHEMA AND TABLE_NAME = '${testTableName}'`,
        { type: QueryTypes.SELECT },
      );
      expect(result.TABLE_TYPE).to.equal('ROW');

      await queryInterface.dropTable(testTableName);
    });
  });
}
