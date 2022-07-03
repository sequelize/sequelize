import type { CreationOptional, InferAttributes, InferCreationAttributes, Model } from '@sequelize/core';
import { DataTypes, Deferrable } from '@sequelize/core';
import { expect } from 'chai';
import { sequelize } from '../support';

interface IA extends Model<InferAttributes<IA>, InferCreationAttributes<IA>> {
  id: CreationOptional<number>;
  BId: number | null;
}

interface IB extends Model<InferAttributes<IB>, InferCreationAttributes<IB>> {
  id: CreationOptional<number>;
  AId: number | null;
}

describe('Sequelize#truncate', () => {
  // These dialects do not support the CASCADE option on TRUNCATE, so it's impossible to clear
  //  tables that reference each-other.
  if (!['mysql', 'mariadb', 'mssql', 'db2'].includes(sequelize.dialect.name)) {
    it('supports truncating cyclic associations with { cascade: true }', async () => {
      const A = sequelize.define<IA>('A', {
        id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
        BId: { type: DataTypes.INTEGER, allowNull: true },
      });

      const B = sequelize.define<IB>('B', {
        id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
        AId: { type: DataTypes.INTEGER, allowNull: false },
      });

      // These models both have a foreign key that references the other model.
      // Sequelize should be able to create them.
      A.belongsTo(B);
      B.belongsTo(A);

      await sequelize.sync();

      await sequelize.transaction({ deferrable: Deferrable.SET_DEFERRED }, async transaction => {
        const a = await A.create({
          BId: null,
        }, { transaction });

        const b = await B.create({
          AId: a.id,
        }, { transaction });

        a.BId = b.id;
        await a.save({ transaction });
      });

      // drop both tables
      await sequelize.truncate({ cascade: true });

      expect(await A.count()).to.eq(0);
      expect(await B.count()).to.eq(0);
    });
  }
});
