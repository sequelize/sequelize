import { DataTypes, Sequelize } from '@sequelize/core';
import { MsSqlDialect } from '@sequelize/mssql';
import { expect } from 'chai';

describe('MSSQL data type overrides', () => {
  const sequelize = new Sequelize({ dialect: MsSqlDialect });

  it('keeps STRING buffer literals on the binary escape path', () => {
    const type = sequelize.normalizeDataType(DataTypes.STRING);

    expect(type.escape(Buffer.from('ab'))).to.equal('0x6162');
  });
});
