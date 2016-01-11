'use strict';

/* jshint -W030 */
/* jshint -W110 */
var chai = require('chai')
  , Sequelize = require('../../../../index')
  , expect = chai.expect
  , Support = require(__dirname + '/../../support');

describe(Support.getTestDialectTeaser('Model'), function() {
  describe('scope', function () {

    describe('findAndCount', function () {

      beforeEach(function () {
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
            },
            attributes: ['username', 'email', 'access_level']
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
            }
          }
        });

        return this.sequelize.sync({force: true}).then(function() {
          var records = [
            {username: 'tony', email: 'tony@sequelizejs.com', access_level: 3, other_value: 7},
            {username: 'tobi', email: 'tobi@fakeemail.com', access_level: 10, other_value: 11},
            {username: 'dan', email: 'dan@sequelizejs.com', access_level: 5, other_value: 10},
            {username: 'fred', email: 'fred@foobar.com', access_level: 3, other_value: 7}
          ];
          return this.ScopeMe.bulkCreate(records);
        }.bind(this));
      });

      it('should apply defaultScope', function () {
        return this.ScopeMe.findAndCount().then(function(result) {
          expect(result.count).to.equal(2);
          expect(result.rows.length).to.equal(2);
        });
      });

      it('should be able to override default scope', function () {
        return this.ScopeMe.findAndCount({ where: { access_level: { gt: 5 }}})
          .then(function(result) {
            expect(result.count).to.equal(1);
            expect(result.rows.length).to.equal(1);
          });
      });

      it('should be able to unscope', function () {
        return this.ScopeMe.unscoped().findAndCount({ limit: 1 })
          .then(function(result) {
            expect(result.count).to.equal(4);
            expect(result.rows.length).to.equal(1);
          });
      });

      it('should be able to apply other scopes', function () {
        return this.ScopeMe.scope('lowAccess').findAndCount()
          .then(function(result) {
            expect(result.count).to.equal(3);
          });
      });

      it('should be able to merge scopes with where', function () {
        return this.ScopeMe.scope('lowAccess')
          .findAndCount({ where: { username: 'dan'}}).then(function(result) {
            expect(result.count).to.equal(1);
          });
      });

      it('should ignore the order option if it is found within the scope', function () {
        return this.ScopeMe.scope('withOrder').findAndCount()
          .then(function(result) {
            expect(result.count).to.equal(4);
          });
      });
    });
  });
});
