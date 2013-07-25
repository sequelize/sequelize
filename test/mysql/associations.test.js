var chai      = require('chai')
  , expect    = chai.expect
  , Support   = require(__dirname + '/../support')
  , dialect   = Support.getTestDialect()
  , sinon     = require('sinon')
  , DataTypes = require(__dirname + "/../../lib/data-types")

chai.Assertion.includeStack = true

if (dialect.match(/^mysql/)) {
  describe('[MYSQL Specific] Associations', function() {
    describe('many-to-many', function() {
      describe('where tables have the same prefix', function() {
        it("should create a table wp_table1wp_table2s", function(done) {
          var Table2 = this.sequelize.define('wp_table2', {foo: DataTypes.STRING})
            , Table1 = this.sequelize.define('wp_table1', {foo: DataTypes.STRING})
            , self = this

          Table1.hasMany(Table2)
          Table2.hasMany(Table1)
          Table1.sync({ force: true }).success(function() {
            Table2.sync({ force: true }).success(function() {
              expect(self.sequelize.daoFactoryManager.getDAO('wp_table1swp_table2s')).to.exist
              done()
            })
          })
        })
      })

      describe('when join table name is specified', function() {
        beforeEach(function(done){
          var Table2 = this.sequelize.define('ms_table1', {foo: DataTypes.STRING})
            , Table1 = this.sequelize.define('ms_table2', {foo: DataTypes.STRING})

          Table1.hasMany(Table2, {joinTableName: 'table1_to_table2'})
          Table2.hasMany(Table1, {joinTableName: 'table1_to_table2'})
          Table1.sync({ force: true }).success(function() {
            Table2.sync({ force: true }).success(function() {
              done()
            })
          })
        })

        it("should not use only a specified name", function() {
          expect(this.sequelize.daoFactoryManager.getDAO('ms_table1sms_table2s')).not.to.exist
          expect(this.sequelize.daoFactoryManager.getDAO('table1_to_table2')).to.exist
        })
      })
    })


    describe('HasMany', function() {
      beforeEach(function(done) {
        //prevent periods from occurring in the table name since they are used to delimit (table.column)
        this.User  = this.sequelize.define('User' + Math.ceil(Math.random()*10000000), { name: DataTypes.STRING })
        this.Task  = this.sequelize.define('Task' + Math.ceil(Math.random()*10000000), { name: DataTypes.STRING })
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

        this.User.sync({ force: true }).success(function() {
          self.Task.sync({ force: true }).success(function() {
            self.User.bulkCreate(users).success(function() {
              self.Task.bulkCreate(tasks).success(function() {
                done()
              })
            })
          })
        })
      })

      describe('addDAO / getDAO', function() {
        beforeEach(function(done) {
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
            expect(_tasks.length).to.equal(0)
            self.user.addTask(self.task).on('success', function() {
              self.user.getTasks().on('success', function(_tasks) {
                expect(_tasks.length).to.equal(1)
                done()
              })
            })
          })
        })
      })

      describe('removeDAO', function() {
        beforeEach(function(done) {
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
            expect(__tasks.length).to.equal(0)
            self.user.setTasks(self.tasks).on('success', function() {
              self.user.getTasks().on('success', function(_tasks) {
                expect(_tasks.length).to.equal(self.tasks.length)
                self.user.removeTask(self.tasks[0]).on('success', function() {
                  self.user.getTasks().on('success', function(_tasks) {
                    expect(_tasks.length).to.equal(self.tasks.length - 1)
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
