'use strict';

const chai = require('chai');

const expect = chai.expect;
const Support = require('../../support');
const { DataTypes } = require('@sequelize/core');

describe(Support.getTestDialectTeaser('associations'), () => {
  describe('Test options.foreignKey', () => {
    beforeEach(function () {
      this.A = this.sequelize.define('A', {
        id: {
          type: DataTypes.STRING(20),
          primaryKey: true,
        },
      });
      this.B = this.sequelize.define('B', {
        id: {
          type: DataTypes.STRING(20),
          primaryKey: true,
        },
      });
      this.C = this.sequelize.define('C', {});
    });

    it('should not be overwritten for belongsTo', function () {
      const reqValidForeignKey = { foreignKey: { allowNull: false } };
      this.A.belongsTo(this.B, reqValidForeignKey);
      this.A.belongsTo(this.C, reqValidForeignKey);

      expect(this.A.getAttributes().cId.type instanceof this.C.getAttributes().id.type.constructor);
    });

    it('should not be overwritten for belongsToMany', function () {
      const reqValidForeignKey = { foreignKey: { allowNull: false }, through: 'ABBridge' };
      this.B.belongsToMany(this.A, reqValidForeignKey);
      this.A.belongsTo(this.C, reqValidForeignKey);

      expect(this.A.getAttributes().cId.type instanceof this.C.getAttributes().id.type.constructor);
    });

    it('should not be overwritten for hasOne', function () {
      const reqValidForeignKey = { foreignKey: { allowNull: false } };
      this.B.hasOne(this.A, reqValidForeignKey);
      this.A.belongsTo(this.C, reqValidForeignKey);

      expect(this.A.getAttributes().cId.type instanceof this.C.getAttributes().id.type.constructor);
    });

    it('should not be overwritten for hasMany', function () {
      const reqValidForeignKey = { foreignKey: { allowNull: false } };
      this.B.hasMany(this.A, reqValidForeignKey);
      this.A.belongsTo(this.C, reqValidForeignKey);

      expect(this.A.getAttributes().cId.type instanceof this.C.getAttributes().id.type.constructor);
    });
  });
});
