'use strict';

const chai = require('chai'),
  expect = chai.expect,
  Support = require('../support'),
  DataTypes = require('sequelize/lib/data-types'),
  Sequelize = require('sequelize');

describe(Support.getTestDialectTeaser('Model'), () => {
  describe('options.underscored', () => {
    beforeEach(function() {
      this.N = this.sequelize.define('N', {
        id: {
          type: DataTypes.CHAR(10),
          primaryKey: true,
          field: 'n_id'
        }
      }, {
        underscored: true
      });

      this.M = this.sequelize.define('M', {
        id: {
          type: Sequelize.CHAR(20),
          primaryKey: true,
          field: 'm_id'
        }
      }, {
        underscored: true
      });
      this.NM = this.sequelize.define('NM', {});
    });

    it('should properly set field when defining', function() {
      expect(this.N.rawAttributes['id'].field).to.equal('n_id');
      expect(this.M.rawAttributes['id'].field).to.equal('m_id');
    });

    it('hasOne does not override already defined field', function() {
      this.N.rawAttributes['mId'] = {
        type: Sequelize.CHAR(20),
        field: 'n_m_id'
      };
      this.N.refreshAttributes();

      expect(this.N.rawAttributes['mId'].field).to.equal('n_m_id');
      this.M.hasOne(this.N, { foreignKey: 'mId' });
      expect(this.N.rawAttributes['mId'].field).to.equal('n_m_id');
    });

    it('belongsTo does not override already defined field', function() {
      this.N.rawAttributes['mId'] = {
        type: Sequelize.CHAR(20),
        field: 'n_m_id'
      };
      this.N.refreshAttributes();

      expect(this.N.rawAttributes['mId'].field).to.equal('n_m_id');
      this.N.belongsTo(this.M, { foreignKey: 'mId' });
      expect(this.N.rawAttributes['mId'].field).to.equal('n_m_id');
    });

    it('hasOne/belongsTo does not override already defined field', function() {
      this.N.rawAttributes['mId'] = {
        type: Sequelize.CHAR(20),
        field: 'n_m_id'
      };
      this.N.refreshAttributes();

      expect(this.N.rawAttributes['mId'].field).to.equal('n_m_id');
      this.N.belongsTo(this.M, { foreignKey: 'mId' });
      this.M.hasOne(this.N, { foreignKey: 'mId' });
      expect(this.N.rawAttributes['mId'].field).to.equal('n_m_id');
    });

    it('hasMany does not override already defined field', function() {
      this.M.rawAttributes['nId'] = {
        type: Sequelize.CHAR(20),
        field: 'nana_id'
      };
      this.M.refreshAttributes();

      expect(this.M.rawAttributes['nId'].field).to.equal('nana_id');

      this.N.hasMany(this.M, { foreignKey: 'nId' });
      this.M.belongsTo(this.N, { foreignKey: 'nId' });

      expect(this.M.rawAttributes['nId'].field).to.equal('nana_id');
    });

    it('belongsToMany does not override already defined field', function() {
      this.NM = this.sequelize.define('NM', {
        n_id: {
          type: Sequelize.CHAR(10),
          field: 'nana_id'
        },
        m_id: {
          type: Sequelize.CHAR(20),
          field: 'mama_id'
        }
      }, {
        underscored: true
      });

      this.N.belongsToMany(this.M, { through: this.NM, foreignKey: 'n_id' });
      this.M.belongsToMany(this.N, { through: this.NM, foreignKey: 'm_id' });

      expect(this.NM.rawAttributes['n_id'].field).to.equal('nana_id');
      expect(this.NM.rawAttributes['m_id'].field).to.equal('mama_id');
    });
  });
});
