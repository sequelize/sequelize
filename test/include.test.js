/* jshint camelcase: false */
/* jshint expr: true */
var chai      = require('chai')
  , Sequelize = require('../index')
  , expect    = chai.expect
  , Support   = require(__dirname + '/support')
  , DataTypes = require(__dirname + "/../lib/data-types")
  , dialect   = Support.getTestDialect()
  , config    = require(__dirname + "/config/config")
  , sinon     = require('sinon')
  , datetime  = require('chai-datetime')
  , _         = require('lodash')
  , moment    = require('moment')
  , async     = require('async')

chai.use(datetime)
chai.Assertion.includeStack = true

describe(Support.getTestDialectTeaser("Include"), function () {
  it('should support a simple nested belongsTo -> belongsTo include', function (done) {
    var Task = this.sequelize.define('Task', {})
      , User = this.sequelize.define('User', {})
      , Group = this.sequelize.define('Group', {})

    Task.belongsTo(User)
    User.belongsTo(Group)

    this.sequelize.sync({force: true}).done(function () {
      async.auto({
        task: function (callback) {
          Task.create().done(callback)
        },
        user: function (callback) {
          User.create().done(callback)
        },
        group: function (callback) {
          Group.create().done(callback)
        },
        taskUser: ['task', 'user', function (callback, results) {
          results.task.setUser(results.user).done(callback)
        }],
        userGroup: ['user', 'group', function (callback, results) {
          results.user.setGroup(results.group).done(callback)
        }]
      }, function (err, results) {
        expect(err).not.to.be.ok

        Task.find({
          id: results.task.id,
          include: [
            {model: User, include: [
              {model: Group}
            ]}
          ]
        }).done(function (err, task) {
          expect(err).not.to.be.ok
          expect(task.user).to.be.ok
          expect(task.user.group).to.be.ok
          done()
        })
      })
    })
  })
})