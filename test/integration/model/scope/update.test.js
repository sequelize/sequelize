'use strict';

const chai = require('chai'),
  Sequelize = require('../../../../index'),
  expect = chai.expect,
  Op = Sequelize.Op,
  Support = require('../../support');

describe(Support.getTestDialectTeaser('Model'), () => {
  describe('scope', () => {
    describe('update', () => {
      beforeEach(function() {
        this.ScopeMe = this.sequelize.define('ScopeMe', {
          username: Sequelize.STRING,
          email: Sequelize.STRING,
          access_level: Sequelize.INTEGER,
          other_value: Sequelize.INTEGER,
          password: Sequelize.STRING
        }, {
          defaultScope: {
            where: {
              access_level: {
                [Op.gte]: 5
              }
            },
            attributes: {
              exclude: ['password']
            }
          },
          scopes: {
            lowAccess: {
              where: {
                access_level: {
                  [Op.lte]: 5
                }
              }
            },
            withoutPassword: {
              attributes: {
                exclude: ['password']
              }
            }
          }
        });

        return this.sequelize.sync({force: true}).then(() => {
          const records = [
            {username: 'tony', email: 'tony@sequelizejs.com', access_level: 3, other_value: 7, password: 'password'},
            {username: 'tobi', email: 'tobi@fakeemail.com', access_level: 10, other_value: 11, password: 'password'},
            {username: 'dan', email: 'dan@sequelizejs.com', access_level: 5, other_value: 10, password: 'password'},
            {username: 'fred', email: 'fred@foobar.com', access_level: 3, other_value: 7, password: 'password'}
          ];
          return this.ScopeMe.bulkCreate(records);
        });
      });

      it('should apply defaultScope', function() {
        return this.ScopeMe.update({ username: 'ruben' }, { where: {}}).then(() => {
          return this.ScopeMe.unscoped().findAll({ where: { username: 'ruben' }});
        }).then(users => {
          expect(users).to.have.length(2);
          expect(users[0].get('email')).to.equal('tobi@fakeemail.com');
          expect(users[1].get('email')).to.equal('dan@sequelizejs.com');
        });
      });

      it('should be able to override default scope', function() {
        return this.ScopeMe.update({ username: 'ruben' }, { where: { access_level: { [Op.lt]: 5 }}}).then(() => {
          return this.ScopeMe.unscoped().findAll({ where: { username: 'ruben' }});
        }).then(users => {
          expect(users).to.have.length(2);
          expect(users[0].get('email')).to.equal('tony@sequelizejs.com');
          expect(users[1].get('email')).to.equal('fred@foobar.com');
        });
      });

      it('should be able to unscope destroy', function() {
        return this.ScopeMe.unscoped().update({ username: 'ruben' }, { where: {}}).then(() => {
          return this.ScopeMe.unscoped().findAll();
        }).then(rubens => {
          expect(rubens.every(r => r.get('username') === 'ruben')).to.be.true;
        });
      });

      it('should be able to apply other `where` scopes', function() {
        return this.ScopeMe.scope('lowAccess').update({ username: 'ruben' }, { where: {}}).then(() => {
          return this.ScopeMe.unscoped().findAll({ where: { username: { [Op.ne]: 'ruben' }}});
        }).then(users => {
          expect(users).to.have.length(1);
          expect(users[0].get('email')).to.equal('tobi@fakeemail.com');
        });
      });

      it('should be able to apply other `attributes` scopes', function() {
        return this.ScopeMe.scope('withoutPassword').update({ other_value: 99 }, { where: { other_value: 11 }, returning: true })
          .spread((count, users) => {
            expect(users).to.have.length(1);
            expect(users[0].get('email')).to.equal('tobi@fakeemail.com');
            expect(users[0].get('password')).to.equal(undefined);
          });
      });

      it('should be able to merge scopes with where', function() {
        return this.ScopeMe.scope('lowAccess').update({ username: 'ruben' }, { where: { username: 'dan'}}).then(() => {
          return this.ScopeMe.unscoped().findAll({ where: { username: 'ruben' }});
        }).then(users => {
          expect(users).to.have.length(1);
          expect(users[0].get('email')).to.equal('dan@sequelizejs.com');
        });
      });

      it('should work with empty where', function() {
        return this.ScopeMe.scope('lowAccess').update({
          username: 'ruby'
        }).then(() => {
          return this.ScopeMe.unscoped().findAll({ where: { username: 'ruby' }});
        }).then(users => {
          expect(users).to.have.length(3);
          users.forEach(user => {
            expect(user.get('username')).to.equal('ruby');
          });
        });
      });
    });
  });
});
