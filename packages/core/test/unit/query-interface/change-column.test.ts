import { DataTypes } from '@sequelize/core';
import { expect } from 'chai';
import sinon from 'sinon';
import { sequelize } from '../../support';

const dialect = sequelize.dialect;

describe('QueryInterface#changeColumn', () => {
  afterEach(() => {
    sinon.restore();
  });

  // ENUM has no "supports" flag, but the only dialect that supports ARRAY (postgres) also supports ENUM.
  if (dialect.supports.dataTypes.ARRAY) {
    it('supports default values on ARRAY(ENUM) columns', async () => {
      const stub = sinon.stub(sequelize, 'queryRaw').resolves([[], []] as any);

      await sequelize.queryInterface.changeColumn('table', 'value', {
        type: DataTypes.ARRAY(DataTypes.ENUM(['foo', 'bar'])),
        allowNull: false,
        defaultValue: ['foo'],
      });

      // Only the DEFAULT clause is asserted here: the rest of the generated statement is covered
      // by the changeColumn tests of the postgres query generator.
      expect(stub.lastCall.args[0]).to.include(
        `ALTER TABLE "table" ALTER COLUMN "value" SET DEFAULT ARRAY['foo']::"public"."enum_table_value"[];`,
      );
    });
  }
});
