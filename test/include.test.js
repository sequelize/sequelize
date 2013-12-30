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
  describe('find', function () {
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
            where: {
              id: results.task.id
            },
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

  it('should support a simple nested hasOne -> hasOne include', function (done) {
      var Task = this.sequelize.define('Task', {})
        , User = this.sequelize.define('User', {})
        , Group = this.sequelize.define('Group', {})

      User.hasOne(Task)
      Group.hasOne(User)

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
          userTask: ['user', 'task', function (callback, results) {
            results.user.setTask(results.task).done(callback)
          }],
          groupUser: ['group', 'user', function (callback, results) {
            results.group.setUser(results.user).done(callback)
          }]
        }, function (err, results) {
          expect(err).not.to.be.ok

          Group.find({
            where: {
              id: results.group.id
            },
            include: [
              {model: User, include: [
                {model: Task}
              ]}
            ]
          }).done(function (err, group) {
            expect(err).not.to.be.ok
            expect(group.user).to.be.ok
            expect(group.user.task).to.be.ok
            done()
          })
        })
      })
    })

    it('should support a simple nested hasMany -> belongsTo include', function (done) {
      var Task = this.sequelize.define('Task', {})
        , User = this.sequelize.define('User', {})
        , Project = this.sequelize.define('Project', {})

      User.hasMany(Task)
      Task.belongsTo(Project)

      this.sequelize.sync({force: true}).done(function () {
        async.auto({
          user: function (callback) {
            User.create().done(callback)
          },
          projects: function (callback) {
            Project.bulkCreate([{}, {}]).done(function () {
              Project.findAll().done(callback)
            })
          },
          tasks: ['projects', function(callback, results) {
            Task.bulkCreate([
              {ProjectId: results.projects[0].id},
              {ProjectId: results.projects[1].id},
              {ProjectId: results.projects[0].id},
              {ProjectId: results.projects[1].id}
            ]).done(function () {
              Task.findAll().done(callback)
            })
          }],
          userTasks: ['user', 'tasks', function (callback, results) {
            results.user.setTasks(results.tasks).done(callback)
          }]
        }, function (err, results) {
          User.find({
            where: {
              id: results.user.id
            },
            include: [
              {model: Task, include: [
                {model: Project}
              ]}
            ]
          }).done(function (err, user) {
            expect(err).not.to.be.ok
            expect(user.tasks).to.be.ok
            expect(user.tasks.length).to.equal(4)

            user.tasks.forEach(function (task) {
              expect(task.project).to.be.ok
            })
            
            done()
          })
        })
      })
    })
  })
})