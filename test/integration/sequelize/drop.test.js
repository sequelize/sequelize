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

  describe('with schemas', () => {
    beforeEach(async () => {
      await Promise.all([
        sequelize.createSchema('schemaA'),
        sequelize.createSchema('schemaB')
      ]);
    });

    afterEach(async () => {
      await Promise.all([
        sequelize.dropSchema('schemaA'),
        sequelize.dropSchema('schemaB')
      ]);
    });

    it('supports schemas when dropping foreign keys for a table', async () => {
      sequelize.define('schemaA_A', {}, {
        tableName: 'A',
        schema: 'schemaA'
      });


      // External tables, use sequelize interface to create them.
      const schemaB_A = sequelize.define('schemaB_A', {}, {
        tableName: 'A',
        schema: 'schemaB'
      });

      const schemaB_B = sequelize.define('schemaB_B', {
        BId: {
          type: DataTypes.INTEGER
        }
      }, {
        tableName: 'B',
        schema: 'schemaB'
      });

      schemaB_A.belongsTo(schemaB_B, { foreignKey: { allowNull: false } });

      await sequelize.sync();

      // Assume "schemaB" models were not created by sequelize and already exist in the database.
      sequelize.modelManager.removeModel(schemaB_A);
      sequelize.modelManager.removeModel(schemaB_B);

      // Try to drop "schemaA" table.
      await sequelize.drop();
    });
  });
});
