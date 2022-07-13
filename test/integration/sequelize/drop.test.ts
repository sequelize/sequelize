import type { ReferentialAction } from '@sequelize/core';
import { DataTypes, Deferrable } from '@sequelize/core';
import { clearDatabase, sequelize } from '../support';

const dialect = sequelize.getDialect();

describe('Sequelize#drop', () => {
  before(async () => {
    await clearDatabase(sequelize);
  });

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

    // mssql refuses cyclic references unless ON DELETE and ON UPDATE is set to NO ACTION
    const mssqlConstraints = dialect === 'mssql' ? { onDelete: 'NO ACTION' as ReferentialAction, onUpdate: 'NO ACTION' as ReferentialAction } : null;

    // These models both have a foreign key that references the other model.
    // Sequelize should be able to create them.
    A.belongsTo(B, { foreignKey: { allowNull: false, ...mssqlConstraints } });
    B.belongsTo(A, { foreignKey: { allowNull: false, ...mssqlConstraints } });

    await sequelize.sync();

    // drop both tables
    await sequelize.drop();
  });
});
