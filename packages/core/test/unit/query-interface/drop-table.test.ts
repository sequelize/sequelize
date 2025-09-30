import { expect } from 'chai';
import sinon from 'sinon';
import { expectsql, getTestDialect, sequelize } from '../../support';

const dialectName = getTestDialect();

describe('QueryInterface#dropTable', () => {
  afterEach(() => {
    sinon.restore();
  });

  const hanaIfExistsWrapper = (sql: string, tableName: string, schema: string) => `
    DO BEGIN
      IF EXISTS (
        SELECT * FROM SYS.TABLES WHERE TABLE_NAME = '${tableName}' AND SCHEMA_NAME = '${schema}'
      ) THEN
        ${sql};
      END IF;
    END;
  `;

  it('produces a DROP TABLE query with cascade', async () => {
    if (sequelize.dialect.supports.dropTable.cascade) {
      const stub = sinon.stub(sequelize, 'queryRaw');

      await sequelize.queryInterface.dropTable('myTable', { cascade: true });

      expect(stub.callCount).to.eq(1);
      const firstCall = stub.getCall(0);
      expectsql(firstCall.args[0], {
        default: 'DROP TABLE IF EXISTS [myTable] CASCADE',
        hana: hanaIfExistsWrapper('DROP TABLE "myTable" CASCADE', 'myTable', 'SYSTEM'),
      });
    } else {
      await expect(
        sequelize.queryInterface.dropTable('myTable', { cascade: true }),
      ).to.be.rejectedWith(
        `The following options are not supported by dropTableQuery in ${dialectName}: cascade`,
      );
    }
  });
});
