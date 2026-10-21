import { mapBindParameters } from '@sequelize/core/_non-semver-use-at-your-own-risk_/utils/sql.js';
import { expect } from 'chai';
import type { SinonStub } from 'sinon';
import sinon from 'sinon';
import { allowDeprecationsInSuite, createSequelizeInstance, sequelize } from '../../../support';

/**
 * Returns the bind parameters passed to the stubbed queryRaw, after checking that
 * the dialect parses the query's placeholders into exactly those parameters.
 *
 * @param stub The queryRaw stub
 */
function getBindParameters(stub: SinonStub): Record<string, unknown> {
  const [sql, options] = stub.getCall(0).args;
  const bind = options?.bind;
  expect([...mapBindParameters(sql, sequelize.dialect).parameterSet]).to.have.members(
    Object.keys(bind),
  );

  return bind;
}

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
      const stub = sinon.stub(sequelize, 'queryRaw').resolves([[], 0]);

      await sequelize.queryInterface.showIndex({ tableName: 'myTable', schema: 'mySchema' });

      expect(stub.callCount).to.equal(1);
      const sql = stub.getCall(0).args[0];
      expect(sql).to.include('WHERE i.table_name = $sequelize_1 AND u.table_owner = $sequelize_2');
      expect(sql).not.to.include('myTable');
      expect(getBindParameters(stub)).to.deep.equal({
        sequelize_1: 'myTable',
        sequelize_2: 'mySchema',
      });
    });

    it('ignores bind parameters passed by the caller', async () => {
      const stub = sinon.stub(sequelize, 'queryRaw').resolves([[], 0]);

      await sequelize.queryInterface.showIndex('myTable', { bind: { sequelize_1: 'otherTable' } });

      expect(getBindParameters(stub)).to.deep.equal({
        sequelize_1: 'myTable',
        sequelize_2: sequelize.dialect.getDefaultSchema(),
      });
    });

    it('binds the default schema when no schema is specified', async () => {
      const stub = sinon.stub(sequelize, 'queryRaw').resolves([[], 0]);

      await sequelize.queryInterface.showIndex('myTable');

      expect(getBindParameters(stub)).to.deep.equal({
        sequelize_1: 'myTable',
        sequelize_2: sequelize.dialect.getDefaultSchema(),
      });
    });

    describe('with quoteIdentifiers: false', () => {
      allowDeprecationsInSuite(['SEQUELIZE0023']);

      let unquotedSequelize: ReturnType<typeof createSequelizeInstance>;

      before(() => {
        unquotedSequelize = createSequelizeInstance({ quoteIdentifiers: false });
      });

      after(async () => {
        await unquotedSequelize.close();
      });

      it('binds the names as they are stored in the catalog', async () => {
        const stub = sinon.stub(unquotedSequelize, 'queryRaw').resolves([[], 0]);

        await unquotedSequelize.queryInterface.showIndex({
          tableName: 'myTable',
          schema: 'mySchema',
        });

        expect(getBindParameters(stub)).to.deep.equal({
          sequelize_1: 'MYTABLE',
          sequelize_2: 'MYSCHEMA',
        });
      });
    });
  });
});
