'use strict';

const chai = require('chai'),
  Sequelize = require('sequelize'),
  Op = Sequelize.Op,
  expect = chai.expect,
  Support = require('../../support');

describe(Support.getTestDialectTeaser('Model'), () => {
  describe('scope', () => {
    describe('count', () => {
      beforeEach(async function() {
        this.Child = this.sequelize.define('Child', {
          priority: Sequelize.INTEGER
        });
        this.ScopeMe = this.sequelize.define('ScopeMe', {
          username: Sequelize.STRING,
          email: Sequelize.STRING,
          aliasValue: {
            field: 'alias_value',
            type: Sequelize.INTEGER
          },
          access_level: Sequelize.INTEGER,
          other_value: Sequelize.INTEGER
        }, {
          defaultScope: {
            where: {
              access_level: {
                [Op.gte]: 5
              }
            },
            attributes: ['id', 'username', 'email', 'access_level']
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
            },
            withInclude: {
              include: [{
                model: this.Child,
                where: {
                  priority: 1
                }
              }]
            },
            withIncludeFunction: () => {
              return {
                include: [{
                  model: this.Child,
                  where: {
                    priority: 1
                  }
                }]
              };
            },
            withIncludeFunctionAndStringAssociation: () => {
              return {
                include: [{
                  association: 'Children',
                  where: {
                    priority: 1
                  }
                }]
              };
            },
            withAliasedField: {
              where: {
                aliasValue: { [Op.ne]: 1 }
              }
            }
          }
        });
        this.Child.belongsTo(this.ScopeMe);
        this.ScopeMe.hasMany(this.Child);

        await this.sequelize.sync({ force: true });
        const records0 = [
          { username: 'tony', email: 'tony@sequelizejs.com', access_level: 3, other_value: 7, aliasValue: 12 },
          { username: 'tobi', email: 'tobi@fakeemail.com', access_level: 10, other_value: 11, aliasValue: 5 },
          { username: 'dan', email: 'dan@sequelizejs.com', access_level: 5, other_value: 10, aliasValue: 1 },
          { username: 'fred', email: 'fred@foobar.com', access_level: 3, other_value: 7, aliasValue: 10 }
        ];
        await this.ScopeMe.bulkCreate(records0);
        const records = await this.ScopeMe.findAll();

        await Promise.all([
          records[0].createChild({
            priority: 1
          }),
          records[1].createChild({
            priority: 2
          })
        ]);
      });

      it('should apply defaultScope', async function() {
        await expect(this.ScopeMe.count()).to.eventually.equal(2);
      });

      it('should be able to override default scope', async function() {
        await expect(this.ScopeMe.count({ where: { access_level: { [Op.gt]: 5 } } })).to.eventually.equal(1);
      });

      it('should be able to unscope', async function() {
        await expect(this.ScopeMe.unscoped().count()).to.eventually.equal(4);
      });

      it('should be able to apply other scopes', async function() {
        await expect(this.ScopeMe.scope('lowAccess').count()).to.eventually.equal(3);
      });

      it('should be able to merge scopes with where', async function() {
        await expect(this.ScopeMe.scope('lowAccess').count({ where: { username: 'dan' } })).to.eventually.equal(1);
      });

      it('should be able to merge scopes with where on aliased fields', async function() {
        await expect(this.ScopeMe.scope('withAliasedField').count({ where: { aliasValue: 5 } })).to.eventually.equal(1);
      });

      it('should ignore the order option if it is found within the scope', async function() {
        await expect(this.ScopeMe.scope('withOrder').count()).to.eventually.equal(4);
      });

      it('should be able to use where on include', async function() {
        await expect(this.ScopeMe.scope('withInclude').count()).to.eventually.equal(1);
      });

      it('should be able to use include with function scope', async function() {
        await expect(this.ScopeMe.scope('withIncludeFunction').count()).to.eventually.equal(1);
      });

      it('should be able to use include with function scope and string association', async function() {
        await expect(this.ScopeMe.scope('withIncludeFunctionAndStringAssociation').count()).to.eventually.equal(1);
      });
    });
  });
});
