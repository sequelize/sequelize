'use strict';

const chai = require('chai');

const expect = chai.expect;
const Support = require('../../support');
const { DataTypes } = require('@sequelize/core');

describe(Support.getTestDialectTeaser('Model'), () => {
  describe('options.underscored', () => {
    beforeEach(function () {
      this.N = this.sequelize.define(
        'N',
        {
          id: {
            type: DataTypes.STRING(10),
            primaryKey: true,
            field: 'n_id',
          },
        },
        {
          underscored: true,
        },
      );

      this.M = this.sequelize.define(
        'M',
        {
          id: {
            type: DataTypes.STRING(20),
            primaryKey: true,
            field: 'm_id',
          },
        },
        {
          underscored: true,
        },
      );
      this.NM = this.sequelize.define('NM', {});
    });

    it('should properly set field when defining', function () {
      expect(this.N.getAttributes().id.field).to.equal('n_id');
      expect(this.M.getAttributes().id.field).to.equal('m_id');
    });

    it('hasOne does not override already defined field', function () {
      this.N.modelDefinition.rawAttributes.mId = {
        type: DataTypes.STRING(20),
        field: 'n_m_id',
      };
      this.N.modelDefinition.refreshAttributes();

      expect(this.N.getAttributes().mId.field).to.equal('n_m_id');
      this.M.hasOne(this.N, { foreignKey: 'mId' });
      expect(this.N.getAttributes().mId.field).to.equal('n_m_id');
    });

    it('belongsTo does not override already defined field', function () {
      this.N.modelDefinition.rawAttributes.mId = {
        type: DataTypes.STRING(20),
        field: 'n_m_id',
      };
      this.N.modelDefinition.refreshAttributes();

      expect(this.N.getAttributes().mId.field).to.equal('n_m_id');
      this.N.belongsTo(this.M, { foreignKey: 'mId' });
      expect(this.N.getAttributes().mId.field).to.equal('n_m_id');
    });

    it('hasOne/belongsTo does not override already defined field', function () {
      this.N.modelDefinition.rawAttributes.mId = {
        type: DataTypes.STRING(20),
        field: 'n_m_id',
      };
      this.N.modelDefinition.refreshAttributes();

      expect(this.N.getAttributes().mId.field).to.equal('n_m_id');
      this.N.belongsTo(this.M, { foreignKey: 'mId' });
      this.M.hasOne(this.N, { foreignKey: 'mId' });
      expect(this.N.getAttributes().mId.field).to.equal('n_m_id');
    });

    it('hasMany does not override already defined field', function () {
      this.M.modelDefinition.rawAttributes.nId = {
        type: DataTypes.STRING(20),
        field: 'nana_id',
      };
      this.M.modelDefinition.refreshAttributes();

      expect(this.M.getAttributes().nId.field).to.equal('nana_id');

      this.N.hasMany(this.M, { foreignKey: 'nId' });
      this.M.belongsTo(this.N, { foreignKey: 'nId' });

      expect(this.M.getAttributes().nId.field).to.equal('nana_id');
    });

    it('belongsToMany does not override already defined field', function () {
      this.NM = this.sequelize.define(
        'NM',
        {
          n_id: {
            type: DataTypes.STRING(10),
            field: 'nana_id',
          },
          m_id: {
            type: DataTypes.STRING(20),
            field: 'mama_id',
          },
        },
        {
          underscored: true,
        },
      );

      this.N.belongsToMany(this.M, { through: this.NM, foreignKey: 'n_id', otherKey: 'm_id' });

      expect(this.NM.getAttributes().n_id.field).to.equal('nana_id');
      expect(this.NM.getAttributes().m_id.field).to.equal('mama_id');
    });
  });
});
