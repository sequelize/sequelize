'use strict';

const { Deferrable, DataTypes } = require('sequelize');
const { expect } = require('chai');
const { sequelize } = require('../support');

describe('Sequelize#truncate', () => {
  // These dialects do not support the CASCADE option on TRUNCATE, so it's impossible to clear
  //  tables that reference each-other.
  if (!['mysql', 'mariadb', 'mssql', 'db2', 'oracle'].includes(sequelize.dialect.name)) {
    it('supports truncating cyclic associations with { cascade: true }', async () => {
      const A = sequelize.define('A', {
        BId: { type: DataTypes.INTEGER }
      });

      const B = sequelize.define('B', {
        AId: { type: DataTypes.INTEGER }
      });

      // These models both have a foreign key that references the other model.
      // Sequelize should be able to create them.
      A.belongsTo(B, { foreignKey: { allowNull: true } });
      B.belongsTo(A, { foreignKey: { allowNull: false } });

      await sequelize.sync();

      await sequelize.transaction({ deferrable: Deferrable.SET_DEFERRED }, async transaction => {
        const a = await A.create({
          BId: null
        }, { transaction });

        const b = await B.create({
          AId: a.id
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
