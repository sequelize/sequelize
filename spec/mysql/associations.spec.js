/* jshint camelcase: false */
var buster  = require("buster")
  , config  = require('../config/config')
  , Helpers = require('../buster-helpers')
  , dialect = Helpers.getTestDialect()

buster.spec.expose()
buster.testRunner.timeout = 1000

var sequelize = Helpers.createSequelizeInstance({dialect: dialect})

if (dialect.match(/^mysql/)) {
  describe('[MYSQL] Associations', function() {
    before(function(done) {
      var self = this
      this.sequelize = sequelize
      Helpers.clearDatabase(this.sequelize, done)
    })

    describe('many-to-many', function() {
      describe('where tables have the same prefix', function() {
        it("should create a table wp_table1wp_table2s", function(done) {
          var Table2 = this.sequelize.define('wp_table2', {foo: Helpers.Sequelize.STRING})
            , Table1 = this.sequelize.define('wp_table1', {foo: Helpers.Sequelize.STRING})
            , self = this

          Table1.hasMany(Table2)
          Table2.hasMany(Table1)
          this.sequelize.sync({ force: true }).success(function() {
            expect(self.sequelize.daoFactoryManager.getDAO('wp_table1swp_table2s')).toBeDefined()
            done()
          })
        })
      })

      describe('when join table name is specified', function() {
        before(function(done){
          var Table2 = this.sequelize.define('ms_table1', {foo: Helpers.Sequelize.STRING})
            , Table1 = this.sequelize.define('ms_table2', {foo: Helpers.Sequelize.STRING})

          Table1.hasMany(Table2, {joinTableName: 'table1_to_table2'})
          Table2.hasMany(Table1, {joinTableName: 'table1_to_table2'})
          this.sequelize.sync({ force: true }).success(done)
        })

        it("should not use a combined name", function(done) {
          expect(this.sequelize.daoFactoryManager.getDAO('ms_table1sms_table2s')).not.toBeDefined()
          done()
        })

        it("should use the specified name", function(done) {
          expect(this.sequelize.daoFactoryManager.getDAO('table1_to_table2')).toBeDefined()
          done()
        })
      })
    })


    describe('HasMany', function() {
      before(function(done) {
        //prevent periods from occurring in the table name since they are used to delimit (table.column)
        this.User  = this.sequelize.define('User' + Math.ceil(Math.random()*10000000), { name: Helpers.Sequelize.STRING })
        this.Task  = this.sequelize.define('Task' + Math.ceil(Math.random()*10000000), { name: Helpers.Sequelize.STRING })
        this.users = null
        this.tasks = null

        this.User.hasMany(this.Task, {as:'Tasks'})
        this.Task.hasMany(this.User, {as:'Users'})

        var self = this
          , users = []
          , tasks = []

        for (var i = 0; i < 5; ++i) {
          users[users.length] = {name: 'User' + Math.random()}
        }

        for (var x = 0; x < 5; ++x) {
          tasks[tasks.length] = {name: 'Task' + Math.random()}
        }

        this.sequelize.sync({ force: true }).success(function() {
          self.User.bulkCreate(users).success(function() {
            self.Task.bulkCreate(tasks).success(done)
          })
        })
      })

      describe('addDAO / getDAO', function() {
        before(function(done) {
          var self = this

          self.user = null
          self.task = null

          self.User.all().success(function(_users) {
            self.Task.all().success(function(_tasks) {
              self.user = _users[0]
              self.task = _tasks[0]
              done()
            })
          })
        })

        it('should correctly add an association to the dao', function(done) {
          var self = this

          self.user.getTasks().on('success', function(_tasks) {
            expect(_tasks.length).toEqual(0)
            self.user.addTask(self.task).on('success', function() {
              self.user.getTasks().on('success', function(_tasks) {
                expect(_tasks.length).toEqual(1)
                done()
              })
            })
          })
        })
      })

      describe('removeDAO', function() {
        before(function(done) {
          var self = this

          self.user = null
          self.tasks = null

          self.User.all().success(function(_users) {
            self.Task.all().success(function(_tasks) {
              self.user = _users[0]
              self.tasks = _tasks
              done()
            })
          })
        })

        it("should correctly remove associated objects", function(done) {
          var self = this

          self.user.getTasks().on('success', function(__tasks) {
            expect(__tasks.length).toEqual(0)
            self.user.setTasks(self.tasks).on('success', function() {
              self.user.getTasks().on('success', function(_tasks) {
                expect(_tasks.length).toEqual(self.tasks.length)
                self.user.removeTask(self.tasks[0]).on('success', function() {
                  self.user.getTasks().on('success', function(_tasks) {
                    expect(_tasks.length).toEqual(self.tasks.length - 1)
                    done()
                  })
                })
              })
            })
          })
        })
      })
    })
  })
}
