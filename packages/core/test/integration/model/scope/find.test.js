'use strict';

const chai = require('chai');
const { DataTypes, Op } = require('@sequelize/core');

const expect = chai.expect;
const Support = require('../../support');

describe(Support.getTestDialectTeaser('Model'), () => {
  describe('scopes', () => {
    beforeEach(async function () {
      this.ScopeMe = this.sequelize.define(
        'ScopeMe',
        {
          username: DataTypes.STRING,
          email: DataTypes.STRING,
          access_level: DataTypes.INTEGER,
          other_value: DataTypes.INTEGER,
          parent_id: DataTypes.INTEGER,
        },
        {
          defaultScope: {
            where: {
              access_level: {
                [Op.gte]: 5,
              },
            },
          },
          scopes: {
            highValue: {
              where: {
                other_value: {
                  [Op.gte]: 10,
                },
              },
            },
            andScope: {
              where: {
                [Op.and]: [
                  {
                    email: {
                      [Op.like]: '%@sequelizejs.com',
                    },
                  },
                  { access_level: 3 },
                ],
              },
            },
          },
        },
      );

      this.DefaultScopeExclude = this.sequelize.define(
        'DefaultScopeExclude',
        {
          name: DataTypes.STRING,
          other_value: {
            type: DataTypes.STRING,
            field: 'otherValue',
          },
        },
        {
          defaultScope: {
            attributes: {
              exclude: ['name'],
            },
          },
        },
      );

      this.ScopeMe.hasMany(this.DefaultScopeExclude);

      await this.sequelize.sync({ force: true });
      const records = [
        {
          username: 'tony',
          email: 'tony@sequelizejs.com',
          access_level: 3,
          other_value: 7,
          parent_id: 1,
        },
        {
          username: 'tobi',
          email: 'tobi@fakeemail.com',
          access_level: 10,
          other_value: 11,
          parent_id: 2,
        },
        {
          username: 'dan',
          email: 'dan@sequelizejs.com',
          access_level: 5,
          other_value: 10,
          parent_id: 1,
        },
        {
          username: 'fred',
          email: 'fred@foobar.com',
          access_level: 3,
          other_value: 7,
          parent_id: 1,
        },
      ];

      await this.ScopeMe.bulkCreate(records);
    });

    it('should be able use where in scope', async function () {
      const users = await this.ScopeMe.withScope({ where: { parent_id: 2 } }).findAll();
      expect(users).to.have.length(1);
      expect(users[0].username).to.equal('tobi');
    });

    it('should be able to combine scope and findAll where clauses', async function () {
      const users = await this.ScopeMe.withScope({ where: { parent_id: 1 } }).findAll({
        where: { access_level: 3 },
      });
      expect(users).to.have.length(2);
      expect(['tony', 'fred'].includes(users[0].username)).to.be.true;
      expect(['tony', 'fred'].includes(users[1].username)).to.be.true;
    });

    it('should be able to combine multiple scopes', async function () {
      const users = await this.ScopeMe.withScope('defaultScope', 'highValue').findAll();
      expect(users).to.have.length(2);
      expect(['tobi', 'dan'].includes(users[0].username)).to.be.true;
      expect(['tobi', 'dan'].includes(users[1].username)).to.be.true;
    });

    it('should be able to use a defaultScope if declared', async function () {
      const users = await this.ScopeMe.findAll();
      expect(users).to.have.length(2);
      expect([10, 5].includes(users[0].access_level)).to.be.true;
      expect([10, 5].includes(users[1].access_level)).to.be.true;
      expect(['dan', 'tobi'].includes(users[0].username)).to.be.true;
      expect(['dan', 'tobi'].includes(users[1].username)).to.be.true;
    });

    it('should be able to handle $and in scopes', async function () {
      const users = await this.ScopeMe.withScope('andScope').findAll();
      expect(users).to.have.length(1);
      expect(users[0].username).to.equal('tony');
    });

    describe('should not overwrite', () => {
      it('default scope with values from previous finds', async function () {
        const users0 = await this.ScopeMe.findAll({ where: { other_value: 10 } });
        expect(users0).to.have.length(1);

        const users = await this.ScopeMe.findAll();
        // This should not have other_value: 10
        expect(users).to.have.length(2);
      });

      it('other scopes with values from previous finds', async function () {
        const users0 = await this.ScopeMe.withScope('highValue').findAll({
          where: { access_level: 10 },
        });
        expect(users0).to.have.length(1);

        const users = await this.ScopeMe.withScope('highValue').findAll();
        // This should not have other_value: 10
        expect(users).to.have.length(2);
      });
    });

    it('should have no problem performing findOrCreate', async function () {
      const [user] = await this.ScopeMe.findOrCreate({ where: { username: 'fake' } });
      expect(user.username).to.equal('fake');
    });

    it('should work when included with default scope', async function () {
      await this.ScopeMe.findOne({
        include: [this.DefaultScopeExclude],
      });
    });
  });

  describe('scope in associations', () => {
    it('should work when association with a virtual column queried with default scope', async function () {
      const Game = this.sequelize.define('Game', {
        name: DataTypes.TEXT,
      });

      const User = this.sequelize.define(
        'User',
        {
          login: DataTypes.TEXT,
          session: {
            type: DataTypes.VIRTUAL,
            get() {
              return 'New';
            },
          },
        },
        {
          defaultScope: {
            attributes: {
              exclude: ['login'],
            },
          },
        },
      );

      Game.hasMany(User);

      await this.sequelize.sync({ force: true });

      const games = await Game.findAll({
        include: [
          {
            model: User,
          },
        ],
      });

      expect(games).to.have.lengthOf(0);
    });
  });
});
