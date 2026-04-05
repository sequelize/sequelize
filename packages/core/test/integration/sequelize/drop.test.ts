import type { ReferentialAction } from '@sequelize/core';
import { DataTypes, Deferrable } from '@sequelize/core';
import { sequelize } from '../support';

const dialect = sequelize.dialect.name;

describe('Sequelize#drop', () => {
  it('supports dropping cyclic associations', async () => {
    const A = sequelize.define('A', {
      bId: {
        type: DataTypes.INTEGER,
        references: {
          deferrable: Deferrable.INITIALLY_IMMEDIATE,
        },
      },
    });

    const B = sequelize.define('B', {
      aId: {
        type: DataTypes.INTEGER,
        references: {
          deferrable: Deferrable.INITIALLY_IMMEDIATE,
        },
      },
    });

    // mssql refuses cyclic references unless ON DELETE and ON UPDATE is set to NO ACTION
    const mssqlConstraints =
      dialect === 'mssql'
        ? { onDelete: 'NO ACTION' as ReferentialAction, onUpdate: 'NO ACTION' as ReferentialAction }
        : null;

    // These models both have a foreign key that references the other model.
    // Sequelize should be able to create them.
    A.belongsTo(B, { foreignKey: { allowNull: false, ...mssqlConstraints } });
    B.belongsTo(A, { foreignKey: { allowNull: false, ...mssqlConstraints } });

    await sequelize.sync();

    // drop both tables
    await sequelize.drop();
  });

  it('supports dropping cyclic associations with { cascade: true } in supported dialects', async () => {
    if (!sequelize.dialect.supports.dropTable.cascade) {
      return;
    }

    const A = sequelize.define('A', {
      bId: {
        type: DataTypes.INTEGER,
      },
    });

    const B = sequelize.define('B', {
      aId: {
        type: DataTypes.INTEGER,
      },
    });

    // These models both have a foreign key that references the other model.
    // Sequelize should be able to create them.
    A.belongsTo(B, { foreignKey: { allowNull: false } });
    B.belongsTo(A, { foreignKey: { allowNull: false } });

    await sequelize.sync();

    // drop both tables
    await sequelize.drop({ cascade: true });
  });
});
