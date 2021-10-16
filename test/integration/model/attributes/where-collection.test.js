'use strict';

const chai = require('chai'),
  sinon = require('sinon'),
  expect = chai.expect,
  Support = require('../../support'),
  DataTypes = require('../../../../lib/data-types');

describe(Support.getTestDialectTeaser('Model'), () => {

  before(function() {
    this.clock = sinon.useFakeTimers();
  });

  after(function() {
    this.clock.restore();
  });

  describe('whereCollection', () => {
    beforeEach(async function() {
      this.sequelize = Support.createSequelizeInstance({ define: { timestamps: false } });
      const queryInterface = this.sequelize.getQueryInterface();

      this.Participation = this.sequelize.define(
        'Participation',
        {
          userId: { field: 'user_id', type: DataTypes.INTEGER, allowNull: false },
          campaignId: {
            field: 'campaign_id',
            type: DataTypes.INTEGER,
            allowNull: false
          },
          comment: {
            field: 'comment',
            type: DataTypes.STRING,
            allowNull: true
          }
        }
      );
      this.Participation.removeAttribute('id');

      await queryInterface.createTable('Participations', {
        user_id: {
          type: DataTypes.INTEGER,
          allowNull: false
        },
        campaign_id: {
          type: DataTypes.INTEGER,
          allowNull: false
        },
        comment: {
          type: DataTypes.STRING,
          allowNull: true
        }
      });
      await this.Participation.bulkCreate([{ userId: 1, campaignId: 1 }]);
    });

    it('save should work (#13421)', async function() {
      expect(await this.Participation.count()).to.equal(1);
      const p = await this.Participation.findOne({ where: { userId: 1, campaignId: 1 } });

      p.comment = 'Updated campaign';

      expect(await p.save()).not.to.throw;
    });
  });
});
