'use strict';

/* jshint -W030 */
/* jshint -W110 */
var chai = require('chai')
  , Sequelize = require('../../../../index')
  , expect = chai.expect
  , Support = require(__dirname + '/../../support')
  , Promise = require(__dirname + '/../../../../lib/promise');

describe(Support.getTestDialectTeaser('Model'), function() {
  describe('scope', function () {
    describe('aggregate', function () {
      beforeEach(function () {
        this.Child = this.sequelize.define('Child', {
          priority: Sequelize.INTEGER
        });
        this.ScopeMe = this.sequelize.define('ScopeMe', {
          username: Sequelize.STRING,
          email: Sequelize.STRING,
          access_level: Sequelize.INTEGER,
          other_value: Sequelize.INTEGER
        }, {
          defaultScope: {
            where: {
              access_level: {
                gte: 5
              }
            }
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
              order: 'username'
            },
            withInclude: {
              include: [{
                model: this.Child,
                where: {
                  priority: 1
                }
              }]
            }
          }
        });
        this.Child.belongsTo(this.ScopeMe);
        this.ScopeMe.hasMany(this.Child);

        return this.sequelize.sync({force: true}).then(function() {
          var records = [
            {username: 'tony', email: 'tony@sequelizejs.com', access_level: 3, other_value: 7},
            {username: 'tobi', email: 'tobi@fakeemail.com', access_level: 10, other_value: 11},
            {username: 'dan', email: 'dan@sequelizejs.com', access_level: 5, other_value: 10},
            {username: 'fred', email: 'fred@foobar.com', access_level: 3, other_value: 7}
          ];
          return this.ScopeMe.bulkCreate(records);
        }.bind(this)).then(function () {
          return this.ScopeMe.findAll();
        }.bind(this)).then(function (records) {
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

      it('should apply defaultScope', function () {
        return expect(this.ScopeMe.aggregate( '*', 'count' )).to.eventually.equal(2);
      });

      it('should be able to override default scope', function () {
        return expect(this.ScopeMe.aggregate( '*', 'count', { where: { access_level: { gt: 5 }}})).to.eventually.equal(1);
      });

      it('should be able to unscope', function () {
        return expect(this.ScopeMe.unscoped().aggregate( '*', 'count' )).to.eventually.equal(4);
      });

      it('should be able to apply other scopes', function () {
        return expect(this.ScopeMe.scope('lowAccess').aggregate( '*', 'count' )).to.eventually.equal(3);
      });

      it('should be able to merge scopes with where', function () {
        return expect(this.ScopeMe.scope('lowAccess').aggregate( '*', 'count', { where: { username: 'dan'}})).to.eventually.equal(1);
      });

      it('should be able to use where on include', function () {
        return expect(this.ScopeMe.scope('withInclude').aggregate( 'ScopeMe.id', 'count', {
          plain: true,
          dataType: new Sequelize.INTEGER(),
          includeIgnoreAttributes: false,
          limit: null,
          offset: null,
          order: null,
          attributes: []
        })).to.eventually.equal(1);
      });
    });
  });
});
