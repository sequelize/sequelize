import { DataTypes } from '@sequelize/core';
import { expect } from 'chai';
import sinon from 'sinon';
import { expectsql, sequelize } from '../../support';

const dialect = sequelize.dialect;

describe('QueryInterface#addColumn', () => {
  afterEach(() => {
    sinon.restore();
  });

  // ENUM has no "supports" flag, but the only dialect that supports ARRAY (postgres) also supports ENUM.
  if (dialect.supports.dataTypes.ARRAY) {
    it('supports default values on ARRAY(ENUM) columns', async () => {
      const stub = sinon.stub(sequelize, 'queryRaw').resolves([[], []] as any);

      await sequelize.queryInterface.addColumn('table', 'value', {
        type: DataTypes.ARRAY(DataTypes.ENUM(['foo', 'bar'])),
        allowNull: false,
        defaultValue: ['foo'],
      });

      expectsql(stub.lastCall.args[0], {
        postgres: `DO 'BEGIN CREATE TYPE "public"."enum_table_value" AS ENUM(''foo'', ''bar''); EXCEPTION WHEN duplicate_object THEN null; END';ALTER TABLE "table" ADD COLUMN  "value" "public"."enum_table_value"[] NOT NULL DEFAULT ARRAY['foo']::"public"."enum_table_value"[];`,
      });
    });

    it('does not attach a usage context to the DataType it was given', async () => {
      sinon.stub(sequelize, 'queryRaw').resolves([[], []] as any);

      const type = DataTypes.ARRAY(DataTypes.ENUM(['foo', 'bar']));

      await sequelize.queryInterface.addColumn('table', 'a', { type });
      await sequelize.queryInterface.addColumn('table', 'b', { type });

      expect(type.usageContext).to.equal(undefined);
    });
  }
});
