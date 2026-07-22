import { Sequelize } from '@sequelize/core';
import { MsSqlDialect } from '@sequelize/mssql';
import { expect } from 'chai';
import { STRING } from './data-types-overrides';

describe('MSSQL data type overrides', () => {
  const sequelize = new Sequelize({ dialect: MsSqlDialect });

  it('keeps STRING buffer literals on the binary escape path', () => {
    const type = new STRING().toDialectDataType(sequelize.dialect);

    expect(type.escape(Buffer.from('ab'))).to.equal('0x6162');
  });
});
