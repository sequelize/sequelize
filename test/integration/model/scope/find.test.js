'use strict';

const chai = require('chai'),
  Sequelize = require('../../../../index'),
  expect = chai.expect,
  Support = require(__dirname + '/../../support');

describe(Support.getTestDialectTeaser('Model'), () => {
  describe('scopes', () => {
    beforeEach(function() {
      this.ScopeMe = this.sequelize.define('ScopeMe', {
        username: Sequelize.STRING,
        email: Sequelize.STRING,
        access_level: Sequelize.INTEGER,
        other_value: Sequelize.INTEGER,
        parent_id: Sequelize.INTEGER
      }, {
        defaultScope: {
          where: {
            access_level: {
              gte: 5
            }
          }
        },
        scopes: {
          highValue: {
            where: {
              other_value: {
                gte: 10
              }
            }
          },
          andScope: {
            where: {
              $and: [
                {
                  email: {
                    like: '%@sequelizejs.com'
                  }
                },
                { access_level: 3 }
              ]
            }
          }
        }
      });

      return this.sequelize.sync({force: true}).then(() => {
        const records = [
          {username: 'tony', email: 'tony@sequelizejs.com', access_level: 3, other_value: 7, parent_id: 1},
          {username: 'tobi', email: 'tobi@fakeemail.com', access_level: 10, other_value: 11, parent_id: 2},
          {username: 'dan', email: 'dan@sequelizejs.com', access_level: 5, other_value: 10, parent_id: 1},
          {username: 'fred', email: 'fred@foobar.com', access_level: 3, other_value: 7, parent_id: 1}
        ];
        return this.ScopeMe.bulkCreate(records);
      });
    });

    it('should be able use where in scope', function() {
      return this.ScopeMe.scope({where: { parent_id: 2 }}).findAll().then(users => {
        expect(users).to.have.length(1);
        expect(users[0].username).to.equal('tobi');
      });
    });

    it('should be able to combine scope and findAll where clauses', function() {
      return this.ScopeMe.scope({where: { parent_id: 1 }}).findAll({ where: {access_level: 3}}).then(users => {
        expect(users).to.have.length(2);
        expect(['tony', 'fred'].indexOf(users[0].username) !== -1).to.be.true;
        expect(['tony', 'fred'].indexOf(users[1].username) !== -1).to.be.true;
      });
    });

    it('should be able to use a defaultScope if declared', function() {
      return this.ScopeMe.all().then(users => {
        expect(users).to.have.length(2);
        expect([10, 5].indexOf(users[0].access_level) !== -1).to.be.true;
        expect([10, 5].indexOf(users[1].access_level) !== -1).to.be.true;
        expect(['dan', 'tobi'].indexOf(users[0].username) !== -1).to.be.true;
        expect(['dan', 'tobi'].indexOf(users[1].username) !== -1).to.be.true;
      });
    });

    it('should be able to handle $and in scopes', function() {
      return this.ScopeMe.scope('andScope').findAll().then(users => {
        expect(users).to.have.length(1);
        expect(users[0].username).to.equal('tony');
      });
    });

    describe('should not overwrite', () => {
      it('default scope with values from previous finds', function() {
        return this.ScopeMe.findAll({ where: { other_value: 10 }}).bind(this).then(function(users) {
          expect(users).to.have.length(1);

          return this.ScopeMe.findAll();
        }).then(users => {
          // This should not have other_value: 10
          expect(users).to.have.length(2);
        });

      });

      it('other scopes with values from previous finds', function() {
        return this.ScopeMe.scope('highValue').findAll({ where: { access_level: 10 }}).bind(this).then(function(users) {
          expect(users).to.have.length(1);

          return this.ScopeMe.scope('highValue').findAll();
        }).then(users => {
          // This should not have other_value: 10
          expect(users).to.have.length(2);
        });
      });
    });

    it('should have no problem performing findOrCreate', function() {
      return this.ScopeMe.findOrCreate({ where: {username: 'fake'}}).spread(user => {
        expect(user.username).to.equal('fake');
      });
    });
  });
});
