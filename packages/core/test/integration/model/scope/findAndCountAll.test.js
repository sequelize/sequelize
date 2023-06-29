'use strict';

const chai = require('chai');
const { DataTypes, Op } = require('@sequelize/core');

const expect = chai.expect;
const Support = require('../../support');

describe(Support.getTestDialectTeaser('Model'), () => {
  describe('scope', () => {

    describe('findAndCountAll', () => {

      beforeEach(async function () {
        this.ScopeMe = this.sequelize.define('ScopeMe', {
          username: DataTypes.STRING,
          email: DataTypes.STRING,
          access_level: DataTypes.INTEGER,
          other_value: DataTypes.INTEGER,
        }, {
          defaultScope: {
            where: {
              access_level: {
                [Op.gte]: 5,
              },
            },
            attributes: ['username', 'email', 'access_level'],
          },
          scopes: {
            lowAccess: {
              where: {
                access_level: {
                  [Op.lte]: 5,
                },
              },
            },
            withOrder: {
              order: ['username'],
            },
          },
        });

        this.Team = this.sequelize.define('Team', {
          name: DataTypes.STRING,
        });

        this.Player = this.sequelize.define('Player', {
          name: DataTypes.STRING,
        }, {
          scopes: {
            includeTeam: {
              include: [{ model: this.Team }],
            },
          },
        });

        this.Team.hasMany(this.Player);
        this.Player.belongsTo(this.Team);

        await this.sequelize.sync({ force: true });
        const records = [
          { username: 'tony', email: 'tony@sequelizejs.com', access_level: 3, other_value: 7 },
          { username: 'tobi', email: 'tobi@fakeemail.com', access_level: 10, other_value: 11 },
          { username: 'dan', email: 'dan@sequelizejs.com', access_level: 5, other_value: 10 },
          { username: 'fred', email: 'fred@foobar.com', access_level: 3, other_value: 7 },
        ];

        const teamRed = await this.Team.create({ name: 'Team Red' });
        const teamBlue = await this.Team.create({ name: 'Team Blue' });

        const bubby = await this.Player.create({ name: 'bubby' });
        const lisa = await this.Player.create({ name: 'lisa' });
        const anna = await this.Player.create({ name: 'anna' });
        const riko = await this.Player.create({ name: 'riko' });

        await bubby.setTeam(teamBlue);
        await lisa.setTeam(teamBlue);
        await anna.setTeam(teamRed);
        await riko.setTeam(teamRed);

        await this.ScopeMe.bulkCreate(records);
      });

      it('should apply defaultScope', async function () {
        const result = await this.ScopeMe.findAndCountAll();
        expect(result.count).to.equal(2);
        expect(result.rows.length).to.equal(2);
      });

      it('should be able to override default scope', async function () {
        const result = await this.ScopeMe.findAndCountAll({ where: { access_level: { [Op.gt]: 5 } } });
        expect(result.count).to.equal(1);
        expect(result.rows.length).to.equal(1);
      });

      it('should be able to unscope', async function () {
        const result = await this.ScopeMe.unscoped().findAndCountAll({ limit: 1 });
        expect(result.count).to.equal(4);
        expect(result.rows.length).to.equal(1);
      });

      it('should be able to apply other scopes', async function () {
        const result = await this.ScopeMe.scope('lowAccess').findAndCountAll();
        expect(result.count).to.equal(3);
      });

      it('should be able to merge scopes with where', async function () {
        const result = await this.ScopeMe.scope('lowAccess')
          .findAndCountAll({ where: { username: 'dan' } });

        expect(result.count).to.equal(1);
      });

      it('should be able to merge multiple scopes', async function () {
        const result = await this.ScopeMe.scope('defaultScope', 'lowAccess')
          .findAndCountAll();

        expect(result.count).to.equal(1);
      });

      it('should ignore the order option if it is found within the scope', async function () {
        const result = await this.ScopeMe.scope('withOrder').findAndCountAll();
        expect(result.count).to.equal(4);
      });

      it('should include table that is defined as include within a scope', async function () {
        const result = await this.Player.scope('includeTeam').findAndCountAll({ distinct: true });
        expect(result.count).to.equal(4);
      });
    });
  });
});
