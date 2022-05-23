'use strict';

const { Deferrable, DataTypes } = require('sequelize');
const { sequelize } = require('../support');

describe('Sequelize#drop', () => {
  it('supports dropping cyclic associations', async () => {
    const A = sequelize.define('A', {
      BId: {
        type: DataTypes.INTEGER,
        references: {
          deferrable: Deferrable.INITIALLY_IMMEDIATE
        }
      }
    });

    const B = sequelize.define('B', {
      AId: {
        type: DataTypes.INTEGER,
        references: {
          deferrable: Deferrable.INITIALLY_IMMEDIATE
        }
      }
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
