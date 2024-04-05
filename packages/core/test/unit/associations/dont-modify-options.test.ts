import { DataTypes } from '@sequelize/core';
import { expect } from 'chai';
import {
  beforeEach2,
  sequelize,
} from '../../support';

describe('associations', () => {
  describe('Test options.foreignKey', () => {
    const vars = beforeEach2(() => {
      const A = sequelize.define('A', {
        id: {
          type: DataTypes.STRING(20),
          primaryKey: true,
        },
      });
      const B = sequelize.define('B', {
        id: {
          type: DataTypes.STRING(20),
          primaryKey: true,
        },
      });
      const C = sequelize.define('C', {});

      return { A, B, C };
    });

    it('should not be overwritten for belongsTo', function () {
      const reqValidForeignKey = { foreignKey: { allowNull: false } };
      vars.A.belongsTo(vars.B, reqValidForeignKey);
      vars.A.belongsTo(vars.C, reqValidForeignKey);

      expect(vars.A.getAttributes().cId.type instanceof vars.C.getAttributes().id.type.constructor);
    });

    it('should not be overwritten for belongsToMany', function () {
      const reqValidForeignKey = { foreignKey: { allowNull: false }, through: 'ABBridge' };
      vars.B.belongsToMany(vars.A, reqValidForeignKey);
      vars.A.belongsTo(vars.C, reqValidForeignKey);

      expect(vars.A.getAttributes().cId.type instanceof vars.C.getAttributes().id.type.constructor);
    });

    it('should not be overwritten for hasOne', function () {
      const reqValidForeignKey = { foreignKey: { allowNull: false } };
      vars.B.hasOne(vars.A, reqValidForeignKey);
      vars.A.belongsTo(vars.C, reqValidForeignKey);

      expect(vars.A.getAttributes().cId.type instanceof vars.C.getAttributes().id.type.constructor);
    });

    it('should not be overwritten for hasMany', function () {
      const reqValidForeignKey = { foreignKey: { allowNull: false } };
      vars.B.hasMany(vars.A, reqValidForeignKey);
      vars.A.belongsTo(vars.C, reqValidForeignKey);

      expect(vars.A.getAttributes().cId.type instanceof vars.C.getAttributes().id.type.constructor);
    });
  });
});
