import { DataTypes, sql } from '@sequelize/core';
import { expect } from 'chai';
import { sequelize } from '../../support';

const queryInterface = sequelize.queryInterface;
const supports = sequelize.dialect.supports.generatedColumns;

describe('QueryInterface generated column validation', () => {
  it('validates generated expressions in createTable', async () => {
    await expect(
      queryInterface.createTable('generated_test', {
        value: {
          type: DataTypes.INTEGER,
          generatedAs: 'source + 1' as any,
          generatedColumn: 'STORED',
        },
      }),
    ).to.be.rejectedWith(/generatedAs.*Sequelize SQL expression/i);
  });

  it('rejects DataTypes.VIRTUAL generated columns in createTable', async () => {
    await expect(
      queryInterface.createTable('generated_test', {
        value: {
          type: DataTypes.VIRTUAL(DataTypes.INTEGER),
          generatedAs: sql.literal('source + 1'),
          generatedColumn: 'STORED',
        },
      }),
    ).to.be.rejectedWith(/cannot use DataTypes\.VIRTUAL/i);
  });

  it('validates generated defaults in addColumn', async () => {
    await expect(
      queryInterface.addColumn('generated_test', 'value', {
        type: DataTypes.INTEGER,
        defaultValue: 1,
        generatedAs: sql.literal('source + 1'),
        generatedColumn: 'STORED',
      }),
    ).to.be.rejectedWith(/cannot have a defaultValue/i);
  });

  it('validates generated auto-increment options in addColumn', async () => {
    await expect(
      queryInterface.addColumn('generated_test', 'value', {
        type: DataTypes.INTEGER,
        autoIncrement: true,
        generatedAs: sql.literal('source + 1'),
        generatedColumn: 'STORED',
      }),
    ).to.be.rejectedWith(/cannot be autoIncrement/i);
  });

  it('validates generated modes in changeColumn', async () => {
    await expect(
      queryInterface.changeColumn('generated_test', 'value', {
        type: DataTypes.INTEGER,
        generatedAs: sql.literal('source + 1'),
        generatedColumn: 'INVALID' as any,
      }),
    ).to.be.rejectedWith(/must be either "STORED" or "VIRTUAL"/i);
  });

  it('rejects generatedColumn without generatedAs in changeColumn', async () => {
    await expect(
      queryInterface.changeColumn('generated_test', 'value', {
        type: DataTypes.INTEGER,
        generatedColumn: 'STORED',
      }),
    ).to.be.rejectedWith(/requires "generatedAs"/i);
  });

  if (!supports.stored || !supports.virtual) {
    it('rejects generated modes unsupported by the dialect', async () => {
      const unsupportedMode = supports.stored ? 'VIRTUAL' : 'STORED';

      await expect(
        queryInterface.addColumn('generated_test', 'value', {
          type: DataTypes.INTEGER,
          generatedAs: sql.literal('source + 1'),
          generatedColumn: unsupportedMode,
        }),
      ).to.be.rejectedWith(/does not support (?:STORED |VIRTUAL )?generated columns/i);
    });
  }
});
