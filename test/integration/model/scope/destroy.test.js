'use strict';

const chai = require('chai'),
  Sequelize = require('../../../../index'),
  expect = chai.expect,
  Support = require(__dirname + '/../../support');

describe(Support.getTestDialectTeaser('Model'), () => {
  describe('scope', () => {
    describe('destroy', () => {
      beforeEach(function() {
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
            }
          }
        });

        return this.sequelize.sync({force: true}).then(() => {
          const records = [
            {username: 'tony', email: 'tony@sequelizejs.com', access_level: 3, other_value: 7},
            {username: 'tobi', email: 'tobi@fakeemail.com', access_level: 10, other_value: 11},
            {username: 'dan', email: 'dan@sequelizejs.com', access_level: 5, other_value: 10},
            {username: 'fred', email: 'fred@foobar.com', access_level: 3, other_value: 7}
          ];
          return this.ScopeMe.bulkCreate(records);
        });
      });

      it('should apply defaultScope', function() {
        return this.ScopeMe.destroy({ where: {}}).bind(this).then(function() {
          return this.ScopeMe.unscoped().findAll();
        }).then(users => {
          expect(users).to.have.length(2);
          expect(users[0].get('username')).to.equal('tony');
          expect(users[1].get('username')).to.equal('fred');
        });
      });

      it('should be able to override default scope', function() {
        return this.ScopeMe.destroy({ where: { access_level: { lt: 5 }}}).bind(this).then(function() {
          return this.ScopeMe.unscoped().findAll();
        }).then(users => {
          expect(users).to.have.length(2);
          expect(users[0].get('username')).to.equal('tobi');
          expect(users[1].get('username')).to.equal('dan');
        });
      });

      it('should be able to unscope destroy', function() {
        return this.ScopeMe.unscoped().destroy({ where: {}}).bind(this).then(function() {
          return expect(this.ScopeMe.unscoped().findAll()).to.eventually.have.length(0);
        });
      });

      it('should be able to apply other scopes', function() {
        return this.ScopeMe.scope('lowAccess').destroy({ where: {}}).bind(this).then(function() {
          return this.ScopeMe.unscoped().findAll();
        }).then(users => {
          expect(users).to.have.length(1);
          expect(users[0].get('username')).to.equal('tobi');
        });
      });

      it('should be able to merge scopes with where', function() {
        return this.ScopeMe.scope('lowAccess').destroy({ where: { username: 'dan'}}).bind(this).then(function() {
          return this.ScopeMe.unscoped().findAll();
        }).then(users => {
          expect(users).to.have.length(3);
          expect(users[0].get('username')).to.equal('tony');
          expect(users[1].get('username')).to.equal('tobi');
          expect(users[2].get('username')).to.equal('fred');
        });
      });

      it('should work with empty where', function() {
        return this.ScopeMe.scope('lowAccess').destroy().then(() => {
          return this.ScopeMe.unscoped().findAll();
        }).then(users => {
          expect(users).to.have.length(1);
          expect(users[0].get('username')).to.equal('tobi');
        });
      });
    });
  });
});
