'use strict';

const chai = require('chai'),
  Sequelize = require('sequelize'),
  Op = Sequelize.Op,
  expect = chai.expect,
  Support = require('../../support');

describe(Support.getTestDialectTeaser('Model'), () => {
  describe('scope', () => {

    describe('findAndCountAll', () => {

      beforeEach(async function() {
        this.ScopeMe = this.sequelize.define('ScopeMe', {
          username: Sequelize.STRING,
          email: Sequelize.STRING,
          access_level: Sequelize.INTEGER,
          other_value: Sequelize.INTEGER
        }, {
          defaultScope: {
            where: {
              access_level: {
                [Op.gte]: 5
              }
            },
            attributes: ['username', 'email', 'access_level']
          },
          scopes: {
            lowAccess: {
              where: {
                access_level: {
                  [Op.lte]: 5
                }
              }
            },
            withOrder: {
              order: ['username']
            }
          }
        });

        await this.sequelize.sync({ force: true });
        const records = [
          { username: 'tony', email: 'tony@sequelizejs.com', access_level: 3, other_value: 7 },
          { username: 'tobi', email: 'tobi@fakeemail.com', access_level: 10, other_value: 11 },
          { username: 'dan', email: 'dan@sequelizejs.com', access_level: 5, other_value: 10 },
          { username: 'fred', email: 'fred@foobar.com', access_level: 3, other_value: 7 }
        ];

        await this.ScopeMe.bulkCreate(records);
      });

      it('should apply defaultScope', async function() {
        const result = await this.ScopeMe.findAndCountAll();
        expect(result.count).to.equal(2);
        expect(result.rows.length).to.equal(2);
      });

      it('should be able to override default scope', async function() {
        const result = await this.ScopeMe.findAndCountAll({ where: { access_level: { [Op.gt]: 5 } } });
        expect(result.count).to.equal(1);
        expect(result.rows.length).to.equal(1);
      });

      it('should be able to unscope', async function() {
        const result = await this.ScopeMe.unscoped().findAndCountAll({ limit: 1 });
        expect(result.count).to.equal(4);
        expect(result.rows.length).to.equal(1);
      });

      it('should be able to apply other scopes', async function() {
        const result = await this.ScopeMe.scope('lowAccess').findAndCountAll();
        expect(result.count).to.equal(3);
      });

      it('should be able to merge scopes with where', async function() {
        const result = await this.ScopeMe.scope('lowAccess')
          .findAndCountAll({ where: { username: 'dan' } });

        expect(result.count).to.equal(1);
      });

      it('should ignore the order option if it is found within the scope', async function() {
        const result = await this.ScopeMe.scope('withOrder').findAndCountAll();
        expect(result.count).to.equal(4);
      });
    });
  });
});
