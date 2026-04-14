import { DataTypes, sql } from '@sequelize/core';
import { expect } from 'chai';
import { getTestDialect, sequelize } from '../../support';

const dialectName = getTestDialect();

describe('generated column result types', () => {
  if (dialectName === 'oracle') {
    for (const [name, type] of [
      ['BLOB', DataTypes.BLOB],
      ['TEXT', DataTypes.TEXT],
      ['JSON', DataTypes.JSON],
    ] as const) {
      it(`rejects Oracle ${name} generated columns`, () => {
        expect(() =>
          sequelize.queryGenerator.attributeToSQL({
            type: sequelize.normalizeDataType(type),
            generatedAs: sql.literal('1'),
            generatedColumn: 'VIRTUAL',
          }),
        ).to.throw(new RegExp(`oracle.*${name}.*generated column`, 'i'));
      });
    }
  }

  if (dialectName === 'db2') {
    for (const [name, type] of [
      ['BLOB', DataTypes.BLOB],
      ['TEXT', DataTypes.TEXT],
      ['STRING', DataTypes.STRING(5000)],
    ] as const) {
      it(`rejects DB2 ${name} generated columns`, () => {
        expect(() =>
          sequelize.queryGenerator.attributeToSQL({
            type: sequelize.normalizeDataType(type),
            generatedAs: sql.literal('1'),
            generatedColumn: 'STORED',
          }),
        ).to.throw(new RegExp(`db2.*${name}.*generated column`, 'i'));
      });
    }
  }
});
