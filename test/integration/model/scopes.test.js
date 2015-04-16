'use strict';

/* jshint -W030 */
/* jshint -W110 */
var chai = require('chai')
  , Sequelize = require('../../../index')
  , expect = chai.expect
  , Support = require(__dirname + '/../support')
  , DataTypes = require(__dirname + '/../../../lib/data-types');

chai.config.includeStack = true;

describe(Support.getTestDialectTeaser('Model'), function() {
  beforeEach(function() {
    return Support.prepareTransactionTest(this.sequelize).bind(this).then(function(sequelize) {
      this.sequelize = sequelize;
      this.User = this.sequelize.define('User', {
        username: DataTypes.STRING,
        secretValue: DataTypes.STRING,
        data: DataTypes.STRING,
        intVal: DataTypes.INTEGER,
        theDate: DataTypes.DATE,
        aBool: DataTypes.BOOLEAN
      });

      return this.User.sync({ force: true });
    });
  });

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
          sequelizeTeam: {
            where: ['email LIKE \'%@sequelizejs.com\'']
          },
          fakeEmail: {
            where: ['email LIKE \'%@fakeemail.com\'']
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
          canBeTony: {
            where: {
              username: ['tony']
            }
          },
          canBeDan: {
            where: {
              username: {
                in : 'dan'
              }
            }
          },
          actualValue: function(value) {
            return {
              where: {
                other_value: value
              }
            };
          },
          complexFunction: function(email, accessLevel) {
            return {
              where: ['email like ? AND access_level >= ?', email + '%', accessLevel]
            };
          },
          lowAccess: {
            where: {
              access_level: {
                lte: 5
              }
            }
          },
          escape: {
            where: {
              username: "escape'd"
            }
          }
        }
      });

      return this.sequelize.sync({force: true}).then(function() {
        var records = [
          {username: 'dan', email: 'dan@sequelizejs.com', access_level: 5, other_value: 10, parent_id: 1},
          {username: 'tobi', email: 'tobi@fakeemail.com', access_level: 10, other_value: 11, parent_id: 2},
          {username: 'tony', email: 'tony@sequelizejs.com', access_level: 3, other_value: 7, parent_id: 1},
          {username: 'fred', email: 'fred@foobar.com', access_level: 3, other_value: 7, parent_id: 1}
        ];
        return this.ScopeMe.bulkCreate(records);
      }.bind(this));
    });

    it('should be able use where in scope', function() {
      return this.ScopeMe.scope({where: { parent_id: 2 }}).findAll().then(function(users) {
        expect(users).to.be.an.instanceof(Array);
        expect(users.length).to.equal(1);
        expect(users[0].username).to.equal('tobi');
      });
    });

    it('should be able to combine scope and findAll where clauses', function() {
      return this.ScopeMe.scope({where: { parent_id: 1 }}).findAll({ where: {access_level: 3}}).then(function(users) {
        expect(users).to.be.an.instanceof(Array);
        expect(users.length).to.equal(2);
        expect(['tony', 'fred'].indexOf(users[0].username) !== -1).to.be.true;
        expect(['tony', 'fred'].indexOf(users[1].username) !== -1).to.be.true;
      });
    });

    it('should have no problems with escaping SQL', function() {
      var self = this;
      return this.ScopeMe.create({username: 'escape\'d', email: 'fake@fakemail.com'}).then(function() {
        return self.ScopeMe.scope('escape').all().then(function(users) {
          expect(users).to.be.an.instanceof(Array);
          expect(users.length).to.equal(1);
          expect(users[0].username).to.equal('escape\'d');
        });
      });
    });

    it('should be able to use a defaultScope if declared', function() {
      return this.ScopeMe.all().then(function(users) {
        expect(users).to.be.an.instanceof(Array);
        expect(users.length).to.equal(2);
        expect([10, 5].indexOf(users[0].access_level) !== -1).to.be.true;
        expect([10, 5].indexOf(users[1].access_level) !== -1).to.be.true;
        expect(['dan', 'tobi'].indexOf(users[0].username) !== -1).to.be.true;
        expect(['dan', 'tobi'].indexOf(users[1].username) !== -1).to.be.true;
      });
    });

    it('should be able to amend the default scope with a find object', function() {
      return this.ScopeMe.findAll({where: {username: 'dan'}}).then(function(users) {
        expect(users).to.be.an.instanceof(Array);
        expect(users.length).to.equal(1);
        expect(users[0].username).to.equal('dan');
      });
    });

    it('should be able to override the default scope', function() {
      return this.ScopeMe.scope('fakeEmail').findAll().then(function(users) {
        expect(users).to.be.an.instanceof(Array);
        expect(users.length).to.equal(1);
        expect(users[0].username).to.equal('tobi');
      });
    });

    it('should be able to combine two scopes', function() {
      return this.ScopeMe.scope(['sequelizeTeam', 'highValue']).findAll().then(function(users) {
        expect(users).to.be.an.instanceof(Array);
        expect(users.length).to.equal(1);
        expect(users[0].username).to.equal('dan');
      });
    });

    it("should be able to call a scope that's a function", function() {
      return this.ScopeMe.scope({method: ['actualValue', 11]}).findAll().then(function(users) {
        expect(users).to.be.an.instanceof(Array);
        expect(users.length).to.equal(1);
        expect(users[0].username).to.equal('tobi');
      });
    });

    it('should be able to handle multiple function scopes', function() {
      return this.ScopeMe.scope([{method: ['actualValue', 10]}, {method: ['complexFunction', 'dan', '5']}]).findAll().then(function(users) {
        expect(users).to.be.an.instanceof(Array);
        expect(users.length).to.equal(1);
        expect(users[0].username).to.equal('dan');
      });
    });

    it('should be able to stack the same field in the where clause', function() {
      return this.ScopeMe.scope(['canBeDan', 'canBeTony']).findAll().then(function(users) {
        expect(users).to.be.an.instanceof(Array);
        expect(users.length).to.equal(2);
        expect(['dan', 'tony'].indexOf(users[0].username) !== -1).to.be.true;
        expect(['dan', 'tony'].indexOf(users[1].username) !== -1).to.be.true;
      });
    });

    it('should be able to merge scopes', function() {
      return this.ScopeMe.scope(['highValue', 'isTony', {merge: true, method: ['actualValue', 7]}]).findAll().then(function(users) {
        expect(users).to.be.an.instanceof(Array);
        expect(users.length).to.equal(1);
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
        return this.ScopeMe.scope({method: ['actualValue', 11]}).findAll().bind(this).then(function(users) {
          expect(users).to.have.length(1);
          expect(users[0].other_value).to.equal(11);

          return this.ScopeMe.scope({method: ['actualValue', 10]}).findAll();
        }).then(function(users) {
           expect(users).to.have.length(1);
           expect(users[0].other_value).to.equal(10);
        });
      });
    });

    it('should give us the correct order if we declare an order in our scope', function() {
      return this.ScopeMe.scope('sequelizeTeam', 'orderScope').findAll().then(function(users) {
        expect(users).to.be.an.instanceof(Array);
        expect(users.length).to.equal(2);
        expect(users[0].username).to.equal('dan');
        expect(users[1].username).to.equal('tony');
      });
    });

    it('should give us the correct order as well as a limit if we declare such in our scope', function() {
      return this.ScopeMe.scope(['orderScope', 'limitScope']).findAll().then(function(users) {
        expect(users).to.be.an.instanceof(Array);
        expect(users.length).to.equal(2);
        expect(users[0].username).to.equal('tobi');
        expect(users[1].username).to.equal('dan');
      });
    });

    it('should have no problems combining scopes and traditional where object', function() {
      return this.ScopeMe.scope('sequelizeTeam').findAll({where: {other_value: 10}}).then(function(users) {
        expect(users).to.be.an.instanceof(Array);
        expect(users.length).to.equal(1);
        expect(users[0].username).to.equal('dan');
        expect(users[0].access_level).to.equal(5);
        expect(users[0].other_value).to.equal(10);
      });
    });

    it('should be able to remove all scopes', function() {
      return this.ScopeMe.scope(null).findAll().then(function(users) {
        expect(users).to.be.an.instanceof(Array);
        expect(users.length).to.equal(4);
      });
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
          expect(team).to.be.an.instanceof(Array);
          expect(team.length).to.equal(2);
          expect(team[0].username).to.equal('dan');
          expect(team[1].username).to.equal('tony');

          expect(t).to.be.an.instanceof(Array);
          expect(t.length).to.equal(1);
          expect(t[0].username).to.equal('tobi');
        });
      });
    });

    it("should gracefully omit any scopes that don't exist", function() {
      return this.ScopeMe.scope('sequelizeTeam', 'orderScope', 'doesntexist').all().then(function(team) {
        expect(team).to.be.an.instanceof(Array);
        expect(team.length).to.equal(2);
        expect(team[0].username).to.equal('dan');
        expect(team[1].username).to.equal('tony');
      });
    });

    it("should gracefully omit any scopes that don't exist through an array", function() {
      return this.ScopeMe.scope(['sequelizeTeam', 'orderScope', 'doesntexist']).all().then(function(team) {
        expect(team).to.be.an.instanceof(Array);
        expect(team.length).to.equal(2);
        expect(team[0].username).to.equal('dan');
        expect(team[1].username).to.equal('tony');
      });
    });

    it("should gracefully omit any scopes that don't exist through an object", function() {
      return this.ScopeMe.scope('sequelizeTeam', 'orderScope', {method: 'doesntexist'}).all().then(function(team) {
        expect(team).to.be.an.instanceof(Array);
        expect(team.length).to.equal(2);
        expect(team[0].username).to.equal('dan');
        expect(team[1].username).to.equal('tony');
      });
    });

    it("should emit an error for scopes that don't exist with silent: false", function() {
      expect(this.ScopeMe.scope.bind(this.ScopeMe, 'doesntexist', {silent: false})).to.throw('Invalid scope doesntexist called.');
    });
  });
});
