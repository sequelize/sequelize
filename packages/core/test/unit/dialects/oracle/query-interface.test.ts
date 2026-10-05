import { expect } from 'chai';
import sinon from 'sinon';
import { allowDeprecationsInSuite, createSequelizeInstance, sequelize } from '../../../support';

// The Oracle query interface passes table and schema names to its dictionary queries as bind parameters,
// so Oracle can reuse the parsed statement instead of hard parsing it for every table.
describe('[Oracle Specific] QueryInterface', () => {
  if (sequelize.dialect.name !== 'oracle') {
    return;
  }

  afterEach(() => {
    sinon.restore();
  });

  describe('showIndex', () => {
    it('passes the table and schema names as bind parameters', async () => {
      const stub = sinon.stub(sequelize, 'queryRaw').resolves([]);

      await sequelize.queryInterface.showIndex({ tableName: 'myTable', schema: 'mySchema' });

      expect(stub.callCount).to.equal(1);
      const [sql, options] = stub.getCall(0).args;
      expect(sql).to.include('WHERE i.table_name = $sequelize_1 AND u.table_owner = $sequelize_2');
      expect(sql).not.to.include('myTable');
      expect(options?.bind).to.deep.equal({ sequelize_1: 'myTable', sequelize_2: 'mySchema' });
    });

    it('binds the default schema when no schema is specified', async () => {
      const stub = sinon.stub(sequelize, 'queryRaw').resolves([]);

      await sequelize.queryInterface.showIndex('myTable');

      expect(stub.getCall(0).args[1]?.bind).to.deep.equal({
        sequelize_1: 'myTable',
        sequelize_2: sequelize.dialect.getDefaultSchema(),
      });
    });

    describe('with quoteIdentifiers: false', () => {
      allowDeprecationsInSuite(['SEQUELIZE0023']);

      it('binds the names as they are stored in the catalog', async () => {
        const unquotedSequelize = createSequelizeInstance({ quoteIdentifiers: false });
        const stub = sinon.stub(unquotedSequelize, 'queryRaw').resolves([]);

        await unquotedSequelize.queryInterface.showIndex({
          tableName: 'myTable',
          schema: 'mySchema',
        });

        expect(stub.getCall(0).args[1]?.bind).to.deep.equal({
          sequelize_1: 'MYTABLE',
          sequelize_2: 'MYSCHEMA',
        });
      });
    });
  });
});
