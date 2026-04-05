'use strict';

const chai = require('chai');
const { DataTypes, Op, Sequelize } = require('@sequelize/core');

const expect = chai.expect;
const Support = require('../support');

describe(Support.getTestDialectTeaser('Model'), () => {
  describe('scope', () => {
    beforeEach(async function () {
      this.ScopeMe = this.sequelize.define(
        'ScopeMe',
        {
          username: DataTypes.STRING,
          email: DataTypes.STRING,
          access_level: DataTypes.INTEGER,
          other_value: DataTypes.INTEGER,
        },
        {
          scopes: {
            lowAccess: {
              attributes: ['other_value', 'access_level'],
              where: {
                access_level: {
                  [Op.lte]: 5,
                },
              },
            },
            withName: {
              attributes: ['username'],
            },
            highAccess: {
              where: {
                [Op.or]: [{ access_level: { [Op.gte]: 5 } }, { access_level: { [Op.eq]: 10 } }],
              },
            },
            lessThanFour: {
              where: {
                [Op.and]: [{ access_level: { [Op.lt]: 4 } }],
              },
            },
            issue8473: {
              where: {
                [Op.or]: {
                  access_level: 3,
                  other_value: 10,
                },
                access_level: 5,
              },
            },
            like_t: {
              where: Sequelize.where(
                Sequelize.fn('LOWER', Sequelize.col('username')),
                Op.like,
                '%t%',
              ),
            },
          },
        },
      );

      await this.sequelize.sync({ force: true });
      const records = [
        { username: 'tony', email: 'tony@sequelizejs.com', access_level: 3, other_value: 7 },
        { username: 'tobi', email: 'tobi@fakeemail.com', access_level: 10, other_value: 11 },
        { username: 'dan', email: 'dan@sequelizejs.com', access_level: 5, other_value: 10 },
        { username: 'fred', email: 'fred@foobar.com', access_level: 3, other_value: 7 },
      ];

      await this.ScopeMe.bulkCreate(records);
    });

    it('should be able to merge attributes as array', async function () {
      const record = await this.ScopeMe.withScope('lowAccess', 'withName').findOne();
      expect(record.other_value).to.exist;
      expect(record.username).to.exist;
      expect(record.access_level).to.exist;
    });

    it('should work with Symbol operators', async function () {
      const record = await this.ScopeMe.withScope('highAccess').findOne();
      expect(record.username).to.equal('tobi');
      const records0 = await this.ScopeMe.withScope('lessThanFour').findAll();
      expect(records0).to.have.length(2);
      expect(records0[0].get('access_level')).to.equal(3);
      expect(records0[1].get('access_level')).to.equal(3);
      const records = await this.ScopeMe.withScope('issue8473').findAll();
      expect(records).to.have.length(1);
      expect(records[0].get('access_level')).to.equal(5);
      expect(records[0].get('other_value')).to.equal(10);
    });

    it('should keep symbols after default assignment', async function () {
      const record = await this.ScopeMe.withScope('highAccess').findOne();
      expect(record.username).to.equal('tobi');

      const records = await this.ScopeMe.withScope('lessThanFour').findAll({
        where: {},
      });

      expect(records).to.have.length(2);
      expect(records[0].get('access_level')).to.equal(3);
      expect(records[1].get('access_level')).to.equal(3);
      await this.ScopeMe.withScope('issue8473').findAll();
    });

    it('should not throw error with sequelize.where', async function () {
      const records = await this.ScopeMe.withScope('like_t').findAll();
      expect(records).to.have.length(2);
    });
  });
});
