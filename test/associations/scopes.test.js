/* jshint camelcase: false */
/* jshint expr: true */
var chai      = require('chai')
  , Sequelize = require('../../index')
  , expect    = chai.expect
  , Support   = require(__dirname + '/../support')
  , _         = require('lodash')

chai.config.includeStack = true


// An abstraction layer on top of getter / includes. Makes sure we test all cases work for both includes and regular get calls
var runSuite = function (description, fn) {
  describe(description, function () {
    describe('defaultScope', function () {
      it("should be applied by default", function (done) {
        fn.call(this, {}, function (projects) {
            expect(projects.length).to.equal(1)
            expect(projects[0].started).to.equal(true)
            done()
          }
        )
      })

      it("should be possible to disable it", function (done) {
        fn.call(this, { scope: null }, function (projects) {
            expect(projects.length).to.equal(5)
            done()
          }
        )
      })

      it('can combine default scope and provided where clauses', function (done) {
        fn.call(this, { 
            where: {
              semiRandomNumber: 2
            }
          }, function (projects) {
            expect(projects.length).to.equal(1)

            expect(projects[0].semiRandomNumber).to.equal(2)
            expect(projects[0].started).to.equal(true)
                          
            done()
          }
        )
      })
    })

    describe('other scopes', function () {
      (description === 'using includes' ? it.skip : it)('works with limit and order', function (done) {
        // Order and limit does not work for includes in general
        fn.call(this, { scope: 'recent2'}, function (projects) {
            expect(projects.length).to.equal(2)

            expect(projects[0].semiRandomNumber).to.equal(88)
            expect(projects[1].semiRandomNumber).to.equal(54)             

            done()
          }
        )
      })
      
      it('can combine scopes and provided where clauses', function (done) {
        fn.call(this, { 
            scope: 'notStarted',
            where: {
              semiRandomNumber: 2
            }
          }, function (projects) {
            expect(projects.length).to.equal(1)

            expect(projects[0].semiRandomNumber).to.equal(2)
            expect(projects[0].started).to.equal(false)
                          
            done()
          }
        )
      })

      it('works with scope functions', function (done) {
        fn.call(this, { 
            scope: [
              {method: ['actualValue', 54]}
            ]
          }, function (projects) {
            expect(projects.length).to.equal(1)

            expect(projects[0].semiRandomNumber).to.equal(54)
                          
            done()
          }
        )
      })
    })
  }) 
}

describe(Support.getTestDialectTeaser("Association"), function () {
  describe('Scopes', function () {
    beforeEach(function () {
      this.User = this.sequelize.define('user', {})
      this.Project = this.sequelize.define('project', {
        started: Sequelize.BOOLEAN,
        semiRandomNumber: Sequelize.INTEGER
      })

      this.User.hasMany(this.Project, {
        defaultScope: {
          where: {
            started: true
          }
        }, 
        scopes: {
          recent2: {
            limit: 2,
            order: [['semiRandomNumber', 'DESC']]
          },
          notStarted: {
            where: {
              started: false
            }
          },
          actualValue: function(value) {
            return {
              where: {
                semiRandomNumber: value
              }
            }
          },
        }
      })
    })

    describe('n:m', function () {
      beforeEach(function (done) {
        var self = this
        this.Project.hasMany(this.User)

        this.sequelize.sync({ force: true}).success(function () {
          self.User.create({ id: 12 }).success(function (user) {
            self.Project.bulkCreate([
              { started: false, semiRandomNumber: 88},
              { started: true,  semiRandomNumber: 2},
              { started: false, semiRandomNumber: 2},
              { started: false, semiRandomNumber: 54},
              { started: false, semiRandomNumber: 15}
            ]).success(function () {
              self.Project.findAll().success(function (projects) {
                user.setProjects(projects).success(function () {
                  done()
                })
              })
            })
          })
        })
      })

      runSuite('using includes', function includes(where, assertions) {
        this.User.find({
          where: {
            id: 12
          },
          include: [
            _.defaults(where, { model: this.Project})
          ]
        }).success(function (user) {
          assertions(user.projects)
        })
      })

      runSuite('using regular getters', function regularGetter(where, assertions) {
        this.User.find(12).success(function (user) {
          user.getProjects(where).success(function (projects) {
            assertions(projects)
          })
        })
      })
    })

    describe('1:m', function () {
      beforeEach(function (done) {
        var self = this

        this.sequelize.sync({ force: true}).success(function () {
          self.User.create({ id: 12 }).success(function (user) {
            self.Project.bulkCreate([
              { started: false, userId: user.id, semiRandomNumber: 88},
              { started: true,  userId: user.id, semiRandomNumber: 2},
              { started: false, userId: user.id, semiRandomNumber: 2},
              { started: false, userId: user.id, semiRandomNumber: 54},
              { started: false, userId: user.id, semiRandomNumber: 15}
            ]).success(function () {
              done()
            })
          })
        })
      })

      runSuite('using includes', function includes(where, assertions) {
        this.User.find({
          where: {
            id: 12
          },
          include: [
            _.defaults(where, { model: this.Project})
          ]
        }).success(function (user) {
          assertions(user.projects)
        })
      })

      runSuite('using regular getters', function regularGetter(where, assertions) {
        this.User.find(12).success(function (user) {
          user.getProjects(where).success(function (projects) {
            assertions(projects)
          })
        })
      })
    })
  })
})