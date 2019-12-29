'use strict';

const chai = require('chai'),
  Sequelize = require('../../../../index'),
  expect = chai.expect,
  Promise = require(__dirname + '/../../../../lib/promise'),
  Support = require(__dirname + '/../../support');

describe(Support.getTestDialectTeaser('Model'), () => {
  describe('scope', () => {
    describe('count', () => {
      beforeEach(function() {
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
                gte: 5
              }
            },
            attributes: ['id', 'username', 'email', 'access_level']
          },
          scopes: {
            lowAccess: {
              where: {
                access_level: {
                  lte: 5
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
                aliasValue: { [Sequelize.Op.ne]: 1 }
              }
            },
          }
        });
        this.Child.belongsTo(this.ScopeMe);
        this.ScopeMe.hasMany(this.Child);

        return this.sequelize.sync({force: true}).then(() => {
          const records = [
            {username: 'tony', email: 'tony@sequelizejs.com', access_level: 3, other_value: 7, aliasValue: 12 },
            {username: 'tobi', email: 'tobi@fakeemail.com', access_level: 10, other_value: 11, aliasValue: 5 },
            {username: 'dan', email: 'dan@sequelizejs.com', access_level: 5, other_value: 10, aliasValue: 1 },
            {username: 'fred', email: 'fred@foobar.com', access_level: 3, other_value: 7, aliasValue: 10 }
          ];
          return this.ScopeMe.bulkCreate(records);
        }).then(() => {
          return this.ScopeMe.findAll();
        }).then(records => {
          return Promise.all([
            records[0].createChild({
              priority: 1
            }),
            records[1].createChild({
              priority: 2
            })
          ]);
        });
      });

      it('should apply defaultScope', function() {
        return expect(this.ScopeMe.count()).to.eventually.equal(2);
      });

      it('should be able to override default scope', function() {
        return expect(this.ScopeMe.count({ where: { access_level: { gt: 5 }}})).to.eventually.equal(1);
      });

      it('should be able to unscope', function() {
        return expect(this.ScopeMe.unscoped().count()).to.eventually.equal(4);
      });

      it('should be able to apply other scopes', function() {
        return expect(this.ScopeMe.scope('lowAccess').count()).to.eventually.equal(3);
      });

      it('should be able to merge scopes with where', function() {
        return expect(this.ScopeMe.scope('lowAccess').count({ where: { username: 'dan'}})).to.eventually.equal(1);
      });

      it('should be able to merge scopes with where on aliased fields', function() {
        return expect(this.ScopeMe.scope('withAliasedField').count({ where: { aliasValue: 5 } })).to.eventually.equal(1);
      });

      it('should ignore the order option if it is found within the scope', function() {
        return expect(this.ScopeMe.scope('withOrder').count()).to.eventually.equal(4);
      });

      it('should be able to use where on include', function() {
        return expect(this.ScopeMe.scope('withInclude').count()).to.eventually.equal(1);
      });

      it('should be able to use include with function scope', function() {
        return expect(this.ScopeMe.scope('withIncludeFunction').count()).to.eventually.equal(1);
      });

      it('should be able to use include with function scope and string association', function() {
        return expect(this.ScopeMe.scope('withIncludeFunctionAndStringAssociation').count()).to.eventually.equal(1);
      });
    });
  });
});
