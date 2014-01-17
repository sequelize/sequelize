/* jshint camelcase: false */
/* jshint expr: true */
var chai      = require('chai')
  , Sequelize = require('../../index')
  , expect    = chai.expect
  , Support   = require(__dirname + '/../support')
  , DataTypes = require(__dirname + "/../../lib/data-types")
  , dialect   = Support.getTestDialect()
  , config    = require(__dirname + "/../config/config")
  , sinon     = require('sinon')
  , datetime  = require('chai-datetime')
  , _         = require('lodash')
  , moment    = require('moment')
  , async     = require('async')

chai.use(datetime)
chai.Assertion.includeStack = true

describe(Support.getTestDialectTeaser("DAOFactory"), function () {
  beforeEach(function(done) {
    this.User = this.sequelize.define('User', {
      username:     DataTypes.STRING,
      secretValue:  DataTypes.STRING,
      data:         DataTypes.STRING,
      intVal:       DataTypes.INTEGER,
      theDate:      DataTypes.DATE,
      aBool:        DataTypes.BOOLEAN
    })

    this.User.sync({ force: true }).success(function() {
      done()
    })
  })

  describe('scopes', function() {
    beforeEach(function(done) {
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
                in: 'dan'
              }
            }
          },
          actualValue: function(value) {
            return {
              where: {
                other_value: value
              }
            }
          },
          complexFunction: function(email, accessLevel) {
            return {
              where: ['email like ? AND access_level >= ?', email + '%', accessLevel]
            }
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
      })

      this.sequelize.sync({force: true}).success(function() {
        var records = [
          {username: 'dan', email: 'dan@sequelizejs.com', access_level: 5, other_value: 10},
          {username: 'tobi', email: 'tobi@fakeemail.com', access_level: 10, other_value: 11},
          {username: 'tony', email: 'tony@sequelizejs.com', access_level: 3, other_value: 7}
        ];
        this.ScopeMe.bulkCreate(records).success(function() {
          done()
        })
      }.bind(this))
    })

    it("should have no problems with escaping SQL", function(done) {
      var self = this
      this.ScopeMe.create({username: 'escape\'d', email: 'fake@fakemail.com'}).success(function(){
        self.ScopeMe.scope('escape').all().success(function(users){
          expect(users).to.be.an.instanceof(Array)
          expect(users.length).to.equal(1)
          expect(users[0].username).to.equal('escape\'d');
          done()
        })
      })
    })

    it("should be able to use a defaultScope if declared", function(done) {
      this.ScopeMe.all().success(function(users) {
        expect(users).to.be.an.instanceof(Array)
        expect(users.length).to.equal(2)
        expect([10,5].indexOf(users[0].access_level) !== -1).to.be.true
        expect([10,5].indexOf(users[1].access_level) !== -1).to.be.true
        expect(['dan', 'tobi'].indexOf(users[0].username) !== -1).to.be.true
        expect(['dan', 'tobi'].indexOf(users[1].username) !== -1).to.be.true
        done()
      })
    })

    it("should be able to amend the default scope with a find object", function(done) {
      this.ScopeMe.findAll({where: {username: 'dan'}}).success(function(users) {
        expect(users).to.be.an.instanceof(Array)
        expect(users.length).to.equal(1)
        expect(users[0].username).to.equal('dan')
        done()
      })
    })

    it("should be able to override the default scope", function(done) {
      this.ScopeMe.scope('fakeEmail').findAll().success(function(users) {
        expect(users).to.be.an.instanceof(Array)
        expect(users.length).to.equal(1)
        expect(users[0].username).to.equal('tobi')
        done()
      })
    })

    it("should be able to combine two scopes", function(done) {
      this.ScopeMe.scope(['sequelizeTeam', 'highValue']).findAll().success(function(users) {
        expect(users).to.be.an.instanceof(Array)
        expect(users.length).to.equal(1)
        expect(users[0].username).to.equal('dan')
        done()
      })
    })

    it("should be able to call a scope that's a function", function(done) {
      this.ScopeMe.scope({method: ['actualValue', 11]}).findAll().success(function(users) {
        expect(users).to.be.an.instanceof(Array)
        expect(users.length).to.equal(1)
        expect(users[0].username).to.equal('tobi')
        done()
      })
    })

    it("should be able to handle multiple function scopes", function(done) {
      this.ScopeMe.scope([{method: ['actualValue', 10]}, {method: ['complexFunction', 'dan', '5']}]).findAll().success(function(users) {
        expect(users).to.be.an.instanceof(Array)
        expect(users.length).to.equal(1)
        expect(users[0].username).to.equal('dan')
        done()
      })
    })

    it("should be able to stack the same field in the where clause", function(done) {
      this.ScopeMe.scope(['canBeDan', 'canBeTony']).findAll().success(function(users) {
        expect(users).to.be.an.instanceof(Array)
        expect(users.length).to.equal(2)
        expect(['dan', 'tony'].indexOf(users[0].username) !== -1).to.be.true
        expect(['dan', 'tony'].indexOf(users[1].username) !== -1).to.be.true
        done()
      })
    })

    it("should be able to merge scopes", function(done) {
      this.ScopeMe.scope(['highValue', 'isTony', {merge: true, method: ['actualValue', 7]}]).findAll().success(function(users) {
        expect(users).to.be.an.instanceof(Array)
        expect(users.length).to.equal(1)
        expect(users[0].username).to.equal('tony')
        done()
      })
    })

    it("should give us the correct order if we declare an order in our scope", function(done) {
      this.ScopeMe.scope('sequelizeTeam', 'orderScope').findAll().success(function(users) {
        expect(users).to.be.an.instanceof(Array)
        expect(users.length).to.equal(2)
        expect(users[0].username).to.equal('dan')
        expect(users[1].username).to.equal('tony')
        done()
      })
    })

    it("should give us the correct order as well as a limit if we declare such in our scope", function(done) {
      this.ScopeMe.scope(['orderScope', 'limitScope']).findAll().success(function(users) {
        expect(users).to.be.an.instanceof(Array)
        expect(users.length).to.equal(2)
        expect(users[0].username).to.equal('tobi')
        expect(users[1].username).to.equal('dan')
        done()
      })
    })

    it("should have no problems combining scopes and traditional where object", function(done) {
      this.ScopeMe.scope('sequelizeTeam').findAll({where: {other_value: 10}}).success(function(users) {
        expect(users).to.be.an.instanceof(Array)
        expect(users.length).to.equal(1)
        expect(users[0].username).to.equal('dan')
        expect(users[0].access_level).to.equal(5)
        expect(users[0].other_value).to.equal(10)
        done()
      })
    })

    it("should be able to remove all scopes", function(done) {
      this.ScopeMe.scope(null).findAll().success(function(users) {
        expect(users).to.be.an.instanceof(Array)
        expect(users.length).to.equal(3)
        done()
      })
    })

    it("should have no problem performing findOrCreate", function(done) {
      this.ScopeMe.findOrCreate({username: 'fake'}).success(function(user) {
        expect(user.username).to.equal('fake')
        done()
      })
    })

    it("should be able to hold multiple scope objects", function(done) {
      var sequelizeTeam = this.ScopeMe.scope('sequelizeTeam', 'orderScope')
        , tobi = this.ScopeMe.scope({method: ['actualValue', 11]})

      sequelizeTeam.all().success(function(team) {
        tobi.all().success(function(t) {
          expect(team).to.be.an.instanceof(Array)
          expect(team.length).to.equal(2)
          expect(team[0].username).to.equal('dan')
          expect(team[1].username).to.equal('tony')

          expect(t).to.be.an.instanceof(Array)
          expect(t.length).to.equal(1)
          expect(t[0].username).to.equal('tobi')
          done()
        })
      })
    })

    it("should gracefully omit any scopes that don't exist", function(done) {
      this.ScopeMe.scope('sequelizeTeam', 'orderScope', 'doesntexist').all().success(function(team) {
        expect(team).to.be.an.instanceof(Array)
        expect(team.length).to.equal(2)
        expect(team[0].username).to.equal('dan')
        expect(team[1].username).to.equal('tony')
        done()
      })
    })

    it("should gracefully omit any scopes that don't exist through an array", function(done) {
      this.ScopeMe.scope(['sequelizeTeam', 'orderScope', 'doesntexist']).all().success(function(team) {
        expect(team).to.be.an.instanceof(Array)
        expect(team.length).to.equal(2)
        expect(team[0].username).to.equal('dan')
        expect(team[1].username).to.equal('tony')
        done()
      })
    })

    it("should gracefully omit any scopes that don't exist through an object", function(done) {
      this.ScopeMe.scope('sequelizeTeam', 'orderScope', {method: 'doesntexist'}).all().success(function(team) {
        expect(team).to.be.an.instanceof(Array)
        expect(team.length).to.equal(2)
        expect(team[0].username).to.equal('dan')
        expect(team[1].username).to.equal('tony')
        done()
      })
    })

    it("should emit an error for scopes that don't exist with silent: false", function(done) {
      try {
        this.ScopeMe.scope('doesntexist', {silent: false})
      } catch (err) {
        expect(err.message).to.equal('Invalid scope doesntexist called.')
        done()
      }
    })
  })
})