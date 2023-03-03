'use strict';

const chai = require('chai'),
  expect = chai.expect,
  sinon = require('sinon'),
  Support = require('../support'),
  DataTypes = require('sequelize/lib/data-types'),
  current = Support.sequelize;

describe(Support.getTestDialectTeaser('Model'), () => {
  describe('Bulk update when model defined has attributes with virtual getters and setters should not throw undefined.', () => {
    before(async function() {
      this.User = current.define('users', {
        id: {
          type: DataTypes.UUID,
          primaryKey: true,
          defaultValue: DataTypes.UUIDV4
        },
        status: {
          type: DataTypes.STRING,
          defaultValue: 'active'
        },
        roles: {
          type: DataTypes.STRING,
          allowNull: false,
          get() {
            return this.getDataValue('roles').split(',');
          },
          set(val) {
            this.setDataValue('roles', val.join(','));
          }
        }
      });

      await this.User.sync({ force: true });
    });       

    

    it('Values are correctly updated without any error being thrown.', async function() {
        
      const u1 = await this.User.create({
        roles: ['authenticated user']
      });
      const u2 = await this.User.create({
        roles: ['authenticated user']
      });

      await this.User.update({ status: 'blocked' }, { where: {
        id: {
          [current.Sequelize.Op.ne]: null
        } 
      } });
      const a1 = await this.User.findOne({ where: { id: u1.id } });
      const a2 = await this.User.findOne({ where: { id: u2.id } });
      
      expect(a1.get('status')).to.eq('blocked');
      expect(a2.get('status')).to.eq('blocked');
    });
  });
  
});
