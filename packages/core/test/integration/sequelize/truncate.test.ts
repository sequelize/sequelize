import type {
  CreationOptional,
  InferAttributes,
  InferCreationAttributes,
  Model,
} from '@sequelize/core';
import { DataTypes } from '@sequelize/core';
import { expect } from 'chai';
import { beforeAll2, sequelize, setResetMode } from '../support';

interface IA extends Model<InferAttributes<IA>, InferCreationAttributes<IA>> {
  id: CreationOptional<number>;
  bId: number | null;
}

interface IB extends Model<InferAttributes<IB>, InferCreationAttributes<IB>> {
  id: CreationOptional<number>;
  aId: number | null;
}

describe('Sequelize#truncate', () => {
  setResetMode('destroy');

  const vars = beforeAll2(async () => {
    const A = sequelize.define<IA>('A', {
      id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
      bId: { type: DataTypes.INTEGER },
    });

    const B = sequelize.define<IB>('B', {
      id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
      aId: { type: DataTypes.INTEGER },
    });

    // These models both have a foreign key that references the other model.
    // Sequelize should be able to create them.
    A.belongsTo(B, { foreignKey: { allowNull: true } });
    B.belongsTo(A, { foreignKey: { allowNull: false } });

    await sequelize.sync();

    return { A, B };
  });

  if (sequelize.dialect.supports.truncate.cascade) {
    it('supports truncating cyclic associations with { cascade: true }', async () => {
      const { A, B } = vars;

      await sequelize.transaction(async transaction => {
        const a = await A.create(
          {
            bId: null,
          },
          { transaction },
        );

        const b = await B.create(
          {
            aId: a.id,
          },
          { transaction },
        );

        a.bId = b.id;
        await a.save({ transaction });
      });

      // drop both tables
      await sequelize.truncate({ cascade: true });

      expect(await A.count()).to.eq(0);
      expect(await B.count()).to.eq(0);
    });
  }

  if (sequelize.dialect.supports.constraints.foreignKeyChecksDisableable) {
    it('supports truncating cyclic associations with { withoutForeignKeyChecks: true }', async () => {
      const { A, B } = vars;

      await sequelize.transaction(async transaction => {
        const a = await A.create(
          {
            bId: null,
          },
          { transaction },
        );

        const b = await B.create(
          {
            aId: a.id,
          },
          { transaction },
        );

        a.bId = b.id;
        await a.save({ transaction });
      });

      // drop both tables
      await sequelize.truncate({ withoutForeignKeyChecks: true });

      expect(await A.count()).to.eq(0);
      expect(await B.count()).to.eq(0);
    });
  }
});
