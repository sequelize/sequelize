'use strict';

/* jshint -W030 */
/* jshint -W110 */
var chai = require('chai')
  , Sequelize = require('../../../../index')
  , expect = chai.expect
  , Promise = Sequelize.Promise
  , Support = require(__dirname + '/../../support');

describe(Support.getTestDialectTeaser('Model'), function() {
  describe('scopes', function() {
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
          orderScope: {
            order: 'access_level DESC'
          },
          limitScope: {
            limit: 2
          },
          highValue: {
            where: {
              other_value: {
                gte: 10
              }
            }
          },
          isTony: {
            where: {
              username: 'tony'
            }
          },
          sequelizeTeam: {
            where: {
              email: {
                like: '%@sequelizejs.com'
              }
            }
          },
          noArgs: function () {
            // This does not make much sense, since it does not actually need to be in a function,
            // In reality it could be used to do for example new Date or random in the scope - but we want it deterministic

            return {
              where: {
                other_value: 7
              }
            };
          },
          actualValue: function(value) {
            return {
              where: {
                other_value: value
              }
            };
          },
          complexFunction: function(username, accessLevel) {
            return {
              where: {
                username: {
                  like: username
                },
                access_level: {
                  gte: accessLevel
                }
              }
            };
          },
          lowAccess: {
            where: {
              access_level: {
                lte: 5
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
                { access_level : 3 }
              ]
            }
          }
        }
      });

      return this.sequelize.sync({force: true}).then(function() {
        var records = [
          {username: 'tony', email: 'tony@sequelizejs.com', access_level: 3, other_value: 7, parent_id: 1},
          {username: 'tobi', email: 'tobi@fakeemail.com', access_level: 10, other_value: 11, parent_id: 2},
          {username: 'dan', email: 'dan@sequelizejs.com', access_level: 5, other_value: 10, parent_id: 1},
          {username: 'fred', email: 'fred@foobar.com', access_level: 3, other_value: 7, parent_id: 1}
        ];
        return this.ScopeMe.bulkCreate(records);
      }.bind(this));
    });

    it('should be able use where in scope', function() {
      return this.ScopeMe.scope({where: { parent_id: 2 }}).findAll().then(function(users) {
        expect(users).to.have.length(1);
        expect(users[0].username).to.equal('tobi');
      });
    });

    it('should be able to combine scope and findAll where clauses', function() {
      return this.ScopeMe.scope({where: { parent_id: 1 }}).findAll({ where: {access_level: 3}}).then(function(users) {
        expect(users).to.have.length(2);
        expect(['tony', 'fred'].indexOf(users[0].username) !== -1).to.be.true;
        expect(['tony', 'fred'].indexOf(users[1].username) !== -1).to.be.true;
      });
    });

    it('should be able to use a defaultScope if declared', function() {
      return this.ScopeMe.all().then(function(users) {
        expect(users).to.have.length(2);
        expect([10, 5].indexOf(users[0].access_level) !== -1).to.be.true;
        expect([10, 5].indexOf(users[1].access_level) !== -1).to.be.true;
        expect(['dan', 'tobi'].indexOf(users[0].username) !== -1).to.be.true;
        expect(['dan', 'tobi'].indexOf(users[1].username) !== -1).to.be.true;
      });
    });

    it('should be able to amend the default scope with a find object', function() {
      return this.ScopeMe.findAll({where: {username: 'dan'}}).then(function(users) {
        expect(users).to.have.length(1);
        expect(users[0].username).to.equal('dan');
      });
    });

    it('should be able to override the default scope', function() {
      return this.ScopeMe.scope('sequelizeTeam').findAll().then(function(users) {
        expect(users).to.have.length(2);
        expect(users[0].username).to.equal('tony');
        expect(users[1].username).to.equal('dan');
      });
    });

    it('should be able to combine two scopes', function() {
      return this.ScopeMe.scope(['sequelizeTeam', 'highValue']).findAll().then(function(users) {
        expect(users).to.have.length(1);
        expect(users[0].username).to.equal('dan');
      });
    });

    it('should be able to combine default with another scope', function () {
      return this.ScopeMe.scope(['defaultScope', {method: ['actualValue', 11]}]).findAll().then(function(users) {
        expect(users).to.have.length(1);
        expect(users[0].username).to.equal('tobi');
      });
    });

    it("should be able to call a scope that's a function", function() {
      return this.ScopeMe.scope({method: ['actualValue', 11]}).findAll().then(function(users) {
        expect(users).to.have.length(1);
        expect(users[0].username).to.equal('tobi');
      });
    });

    it('should be able to handle multiple function scopes', function() {
      return this.ScopeMe.scope([{method: ['actualValue', 10]}, {method: ['complexFunction', 'dan', '5']}]).findAll().then(function(users) {
        expect(users).to.have.length(1);
        expect(users[0].username).to.equal('dan');
      });
    });

    it('should be able to handle $and in scopes', function () {
      return this.ScopeMe.scope('andScope').findAll().then(function(users) {
        expect(users).to.have.length(1);
        expect(users[0].username).to.equal('tony');
      });
    });

    it('should be able to merge scopes', function() {
      return this.ScopeMe.scope(['highValue', 'isTony', {merge: true, method: ['actualValue', 7]}]).findAll().then(function(users) {
        expect(users).to.have.length(1);
        expect(users[0].username).to.equal('tony');
      });
    });

    describe('should not overwrite', function() {
      it('default scope with values from previous finds', function() {
        return this.ScopeMe.findAll({ where: { other_value: 10 }}).bind(this).then(function(users) {
          expect(users).to.have.length(1);

          return this.ScopeMe.findAll();
        }).then(function(users) {
          // This should not have other_value: 10
          expect(users).to.have.length(2);
        });

      });

      it('other scopes with values from previous finds', function() {
        return this.ScopeMe.scope('highValue').findAll({ where: { access_level: 10 }}).bind(this).then(function(users) {
          expect(users).to.have.length(1);

          return this.ScopeMe.scope('highValue').findAll();
        }).then(function(users) {
          // This should not have other_value: 10
          expect(users).to.have.length(2);
        });
      });

      it('function scopes', function() {
        return Promise.all([
          this.ScopeMe.scope({method: ['actualValue', 11]}).findAll(),
          this.ScopeMe.scope({method: ['actualValue', 10]}).findAll(),
          this.ScopeMe.scope('noArgs').findAll()
        ]).spread(function (users1, users2, users3) {
          expect(users1).to.have.length(1);
          expect(users1[0].other_value).to.equal(11);

          expect(users2).to.have.length(1);
          expect(users2[0].other_value).to.equal(10);

          expect(users3).to.have.length(2);
          expect(users3[0].other_value).to.equal(7);
          expect(users3[1].other_value).to.equal(7);
        });
      });
    });

    it('should give us the correct order if we declare an order in our scope', function() {
      return this.ScopeMe.scope('sequelizeTeam', 'orderScope').findAll().then(function(users) {
        expect(users).to.have.length(2);
        expect(users[0].username).to.equal('dan');
        expect(users[1].username).to.equal('tony');
      });
    });

    it('should give us the correct order as well as a limit if we declare such in our scope', function() {
      return this.ScopeMe.scope(['orderScope', 'limitScope']).findAll().then(function(users) {
        expect(users).to.have.length(2);
        expect(users[0].username).to.equal('tobi');
        expect(users[1].username).to.equal('dan');
      });
    });

    it('should be able to remove all scopes', function() {
      return expect(this.ScopeMe.scope(null).findAll()).to.eventually.have.length(4);
    });

    it('should have no problem performing findOrCreate', function() {
      return this.ScopeMe.findOrCreate({ where: {username: 'fake'}}).spread(function(user) {
        expect(user.username).to.equal('fake');
      });
    });

    it('should be able to hold multiple scope objects', function() {
      var sequelizeTeam = this.ScopeMe.scope('sequelizeTeam', 'orderScope')
        , tobi = this.ScopeMe.scope({method: ['actualValue', 11]});

      return sequelizeTeam.all().then(function(team) {
        return tobi.all().then(function(t) {
          expect(team).to.have.length(2);
          expect(team[0].username).to.equal('dan');
          expect(team[1].username).to.equal('tony');

          expect(t).to.have.length(1);
          expect(t[0].username).to.equal('tobi');
        });
      });
    });

    it("should emit an error for scopes that don't exist", function() {
      expect(this.ScopeMe.scope.bind(this.ScopeMe, 'doesntexist', {silent: false})).to.throw('Invalid scope doesntexist called.');
    });
  });
});
