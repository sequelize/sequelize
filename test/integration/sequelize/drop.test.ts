import { DataTypes, Deferrable } from '@sequelize/core';
import { sequelize } from '../support';

describe('Sequelize#drop', () => {
  it('supports dropping cyclic associations', async () => {
    const A = sequelize.define('A', {
      BId: {
        type: DataTypes.INTEGER,
        // TODO: references requires a model to be specified. We should move reference.deferrable to be an option of foreignKey in belongsTo.
        // @ts-expect-error
        references: {
          deferrable: Deferrable.INITIALLY_IMMEDIATE,
        },
      },
    });

    const B = sequelize.define('B', {
      AId: {
        type: DataTypes.INTEGER,
        // TODO: references requires a model to be specified. We should move reference.deferrable to be an option of foreignKey in belongsTo.
        // @ts-expect-error
        references: {
          deferrable: Deferrable.INITIALLY_IMMEDIATE,
        },
      },
    });

    // These models both have a foreign key that references the other model.
    // Sequelize should be able to create them.
    A.belongsTo(B, { foreignKey: { allowNull: false } });
    B.belongsTo(A, { foreignKey: { allowNull: false } });

    await sequelize.sync();

    // drop both tables
    await sequelize.drop();
  });
});
