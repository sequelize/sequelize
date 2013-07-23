/* jshint camelcase: false */
var buster  = require("buster")
  , Helpers = require('./buster-helpers')
  , dialect = Helpers.getTestDialect()
  , config    = require(__dirname + "/config/config")
  , DataTypes = require(__dirname + "/../lib/data-types")
  , _ = require('lodash')

buster.spec.expose()
buster.testRunner.timeout = 1000

describe(Helpers.getTestDialectTeaser("DAO"), function() {
  var sequelize = Helpers.createSequelizeInstance({dialect: dialect})
    , User = sequelize.define('User', {
    username:  { type: DataTypes.STRING },
    touchedAt: { type: DataTypes.DATE, defaultValue: DataTypes.NOW },
    aNumber:   { type: DataTypes.INTEGER },
    bNumber:   { type: DataTypes.INTEGER },

    validateTest: {
      type: DataTypes.INTEGER,
      allowNull: true,
      validate: {isInt: true}
    },
    validateCustom: {
      type: DataTypes.STRING,
      allowNull: true,
      validate: {len: {msg: 'Length failed.', args: [1,20]}}
    },

    dateAllowNullTrue: {
      type: DataTypes.DATE,
      allowNull: true
    }
  })

  before(function(done) {
    var self = this

    self.sequelize = sequelize
    self.User      = User
    Helpers.clearDatabase(this.sequelize, function(){
      self.User.sync({ force: true }).success(done)
    })
  })

  describe('Escaping', function() {
    it('is done properly for special characters', function(done) {
      // Ideally we should test more: "\0\n\r\b\t\\\'\"\x1a"
      // But this causes sqlite to fail and exits the entire test suite immediately
      var bio = dialect + "'\"\n" // Need to add the dialect here so in case of failure I know what DB it failed for
        , self = this

      this.User.create({ username: bio }).success(function(u1) {
        self.User.find(u1.id).success(function(u2) {
          expect(u2.username).toEqual(bio)
          done()
        })
      })
    })
  })

  describe('isNewRecord', function() {
    it('returns true for non-saved objects', function(done) {
      var user = this.User.build({ username: 'user' })
      expect(user.id).toBeNull()
      expect(user.isNewRecord).toBeTruthy()
      done()
    })

    it("returns false for saved objects", function(done) {
      this.User.build({ username: 'user' }).save().success(function(user) {
        expect(user.isNewRecord).toBeFalsy()
        done()
      })
    })

    it("returns false for created objects", function(done) {
      this.User.create({ username: 'user' }).success(function(user) {
        expect(user.isNewRecord).toBeFalsy()
        done()
      })
    })

    it("returns false for objects found by find method", function(done) {
      var self = this
      this.User.create({ username: 'user' }).success(function() {
        self.User.create({ username: 'user' }).success(function(user) {
          self.User.find(user.id).success(function(user) {
            expect(user.isNewRecord).toBeFalsy()
            done()
          })
        })
      })
    })

    it("returns false for objects found by findAll method", function(done) {
      var self = this
        , users = []

      for (var i = 0; i < 10; i++) {
        users[users.length] = {username: 'user'}
      }

      this.User.bulkCreate(users).success(function() {
        self.User.findAll().success(function(users) {
          users.forEach(function(u) {
            expect(u.isNewRecord).toBeFalsy()
          })
          done()
        })
      })
    })
  })

  describe('increment', function () {
    before(function(done) {
      this.User.create({ id: 1, aNumber: 0, bNumber: 0 }).done(done)
    })

    it('with array', function(done) {
      var self = this
      this.User.find(1).done(function(err, user1) {
        user1.increment(['aNumber'], 2).done(function() {
          self.User.find(1).done(function(err, user3) {
            expect(user3.aNumber).toBe(2)
            done()
          })
        })
      })
    })

    it('with single field', function(done) {
      var self = this
      this.User.find(1).done(function(err, user1) {
        user1.increment('aNumber', 2).done(function() {
          self.User.find(1).done(function(err, user3) {
            expect(user3.aNumber).toBe(2)
            done()
          })
        })
      })
    })

    it('should still work right with other concurrent updates', function(done) {
      var self = this
      this.User.find(1).done(function (err, user1) {
        // Select the user again (simulating a concurrent query)
        self.User.find(1).done(function (err, user2) {
          user2.updateAttributes({
            aNumber: user2.aNumber + 1
          }).done(function () {
            user1.increment(['aNumber'], 2).done(function() {
              self.User.find(1).done(function(err, user5) {
                expect(user5.aNumber).toBe(3)
                done()
              })
            })
          })
        })
      })
    })

    it('should still work right with other concurrent increments', function(done) {
      var self = this
      this.User.find(1).done(function(err, user1) {
        var _done = _.after(3, function() {
          self.User.find(1).done(function(err, user2) {
            expect(user2.aNumber).toEqual(6)
            done()
          })
        })

        user1.increment(['aNumber'], 2).done(_done)
        user1.increment(['aNumber'], 2).done(_done)
        user1.increment(['aNumber'], 2).done(_done)
      })
    })

    it('with key value pair', function(done) {
      var self = this
      this.User.find(1).done(function(err, user1) {
        user1.increment({ 'aNumber': 1, 'bNumber': 2}).done(function() {
          self.User.find(1).done(function (err, user3) {
            expect(user3.aNumber).toBe(1)
            expect(user3.bNumber).toBe(2)
            done()
          })
        })
      })
    })
  })

  describe('decrement', function () {
    before(function(done) {
      this.User.create({ id: 1, aNumber: 0, bNumber: 0 }).done(done)
    })

    it('with array', function(done) {
      var self = this
      this.User.find(1).done(function(err, user1) {
        user1.decrement(['aNumber'], 2).done(function() {
          self.User.find(1).done(function(err, user3) {
            expect(user3.aNumber).toBe(-2)
            done()
          })
        })
      })
    })

    it('with single field', function(done) {
      var self = this
      this.User.find(1).done(function(err, user1) {
        user1.decrement('aNumber', 2).done(function() {
          self.User.find(1).done(function(err, user3) {
            expect(user3.aNumber).toBe(-2)
            done()
          })
        })
      })
    })

    it('should still work right with other concurrent updates', function(done) {
      var self = this
      this.User.find(1).done(function(err, user1) {
        // Select the user again (simulating a concurrent query)
        self.User.find(1).done(function(err, user2) {
          user2.updateAttributes({
            aNumber: user2.aNumber + 1
          }).done(function () {
            user1.decrement(['aNumber'], 2).done(function() {
              self.User.find(1).done(function(err, user5) {
                expect(user5.aNumber).toBe(-1)
                done()
              })
            })
          })
        })
      })
    })

    it('should still work right with other concurrent increments', function(done) {
      var self = this
      this.User.find(1).done(function(err, user1) {
        var _done = _.after(3, function() {
          self.User.find(1).done(function (err, user2) {
            expect(user2.aNumber).toEqual(-6)
            done()
          })
        })

        user1.decrement(['aNumber'], 2).done(_done)
        user1.decrement(['aNumber'], 2).done(_done)
        user1.decrement(['aNumber'], 2).done(_done)
      })
    })

    it('with key value pair', function(done) {
      var self = this
      this.User.find(1).done(function(err, user1) {
        user1.decrement({ 'aNumber': 1, 'bNumber': 2}).done(function() {
          self.User.find(1).done(function(err, user3) {
            expect(user3.aNumber).toBe(-1)
            expect(user3.bNumber).toBe(-2)
            done()
          })
        })
      })
    })
  })

  describe('reload', function () {
    it("should return a reference to the same DAO instead of creating a new one", function(done) {
      this.User.create({ username: 'John Doe' }).done(function(err, originalUser) {
        originalUser.updateAttributes({ username: 'Doe John' }).done(function() {
          originalUser.reload().done(function (err, updatedUser) {
            expect(originalUser === updatedUser).toBeTrue()
            done()
          })
        })
      })
    })

    it("should update the values on all references to the DAO", function(done) {
      var self = this
      this.User.create({ username: 'John Doe' }).done(function(err, originalUser) {
        self.User.find(originalUser.id).done(function(err, updater) {
          updater.updateAttributes({ username: 'Doe John' }).done(function() {
            // We used a different reference when calling updateAttributes, so originalUser is now out of sync
            expect(originalUser.username).toEqual('John Doe')

            originalUser.reload().done(function(err, updatedUser) {
              expect(originalUser.username).toEqual('Doe John')
              expect(updatedUser.username).toEqual('Doe John')
              done()
            })
          })
        })
      })
    })

    it("should update read only attributes as well (updatedAt)", function(done) {
      var self = this
      this.timeout = 2000

      this.User.create({ username: 'John Doe' }).done(function(err, originalUser) {
        var originallyUpdatedAt = originalUser.updatedAt

        // Wait for a second, so updatedAt will actually be different
        setTimeout(function () {
          self.User.find(originalUser.id).done(function(err, updater) {
            updater.updateAttributes({ username: 'Doe John' }).done(function () {
              originalUser.reload().done(function(err, updatedUser) {
                expect(originalUser.updatedAt).toBeGreaterThan(originallyUpdatedAt)
                expect(updatedUser.updatedAt).toBeGreaterThan(originallyUpdatedAt)
                done()
              })
            })
          })
        }, 1000)
      })
    })

    it("should update the associations as well", function(done) {
      var Book = this.sequelize.define('Book', { title:   Helpers.Sequelize.STRING })
        , Page = this.sequelize.define('Page', { content: Helpers.Sequelize.TEXT })

      Book.hasMany(Page)
      Page.belongsTo(Book)

      Book.sync().success(function() {
        Page.sync().success(function() {
          Book.create({ title: 'A very old book' }).success(function(book) {
            Page.create({ content: 'om nom nom' }).success(function(page) {
              book.setPages([ page ]).success(function() {
                Book.find({
                  where: (dialect === 'postgres' ? '"Books"."id"=' : '`Books`.`id`=') + book.id,
                  include: [Page]
                }).success(function(leBook) {
                  page.updateAttributes({ content: 'something totally different' }).success(function(page) {
                    expect(leBook.pages[0].content).toEqual('om nom nom')
                    expect(page.content).toEqual('something totally different')

                    leBook.reload().success(function(leBook) {
                      expect(leBook.pages[0].content).toEqual('something totally different')
                      expect(page.content).toEqual('something totally different')
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
  })

  describe('default values', function() {
    describe('current date', function() {
      it('should store a date in touchedAt', function(done) {
        var user = this.User.build({ username: 'a user'})
        expect(user.touchedAt instanceof Date).toBeTrue()
        done()
      })

      it("should store the current date in touchedAt", function(done) {
        this.useFakeTimers().tick(5000)
        var user = this.User.build({ username: 'a user'})
        expect(+user.touchedAt).toBe(5000)
        done()
      })
    })

    describe('allowNull date', function() {
      it('should be just "null" and not Date with Invalid Date', function(done) {
        var self = this
        this.User.build({ username: 'a user'}).save().success(function() {
          self.User.find({where: {username: 'a user'}}).success(function(user) {
            expect(user.dateAllowNullTrue).toBe(null)
            done()
          })
        })
      })

      it('should be the same valid date when saving the date', function(done) {
        var self = this
        var date = new Date()
        this.User.build({ username: 'a user', dateAllowNullTrue: date}).save().success(function() {
          self.User.find({where: {username: 'a user'}}).success(function(user) {
            expect(user.dateAllowNullTrue.toString()).toEqual(date.toString())
            done()
          })
        })
      })
    })
  })

  describe('complete', function() {
    it("gets triggered if an error occurs", function(done) {
      this.User.find({ where: "asdasdasd" }).complete(function(err) {
        expect(err).toBeDefined()
        expect(err.message).toBeDefined()
        done()
      })
    })

    it("gets triggered if everything was ok", function(done) {
      this.User.count().complete(function(err, result) {
        expect(err).toBeNull()
        expect(result).toBeDefined()
        done()
      })
    })
  })

  describe('save', function() {
    it('only updates fields in passed array', function(done) {
      var self   = this
        , userId = null
        , date   = new Date(1990, 01, 01)

      this.User.create({
        username: 'foo',
        touchedAt: new Date()
      }).success(function(user) {
        user.username = 'fizz'
        user.touchedAt = date
        user.save(['username']).success(function(){
          // re-select user
          self.User.find(user.id).success(function(user2) {
            // name should have changed
            expect(user2.username).toEqual('fizz')
            // bio should be unchanged
            expect(user2.birthDate).not.toEqual(date)
            done()
          })
        })
      })
    })

    it("stores an entry in the database", function(done) {
      var username = 'user'
        , self     = this
        , user     = this.User.build({
          username: username,
          touchedAt: new Date(1984, 8, 23)
        })

      self.User.all().success(function(users) {
        expect(users.length).toEqual(0)
        user.save().success(function(){
          self.User.all().success(function(users) {
            expect(users.length).toEqual(1)
            expect(users[0].username).toEqual(username)
            expect(users[0].touchedAt instanceof Date).toBe(true)
            expect(users[0].touchedAt).toEqual(new Date(1984, 8, 23))
            done()
          })
        })
      })
    })

    it("updates the timestamps", function(done) {
      this.timeout = 1000 * 5
      var now       = Date.now()
        , user      = null
        , updatedAt = null
        , self      = this

      // timeout is needed, in order to check the update of the timestamp
      var build = function() {
        user      = self.User.build({ username: 'user' })
        updatedAt = user.updatedAt
        expect(updatedAt.getTime()).toBeGreaterThan(now)

        setTimeout(function() {
          user.save().success(function() {
            expect(updatedAt.getTime()).toBeLessThan(user.updatedAt.getTime())
            done()
          })
        }, 1000)
      }

      setTimeout(build, 1000)
    })

    describe('without timestamps option', function() {
      it("doesn't update the updatedAt column", function(done) {
        var User2 = sequelize.define('User2', {
          username: DataTypes.STRING,
          updatedAt: DataTypes.DATE
        }, { timestamps: false })
        User2.sync().success(function() {
          User2.create({ username: 'john doe' }).success(function(johnDoe) {
            // sqlite and mysql return undefined, whereas postgres returns null
            expect([undefined, null].indexOf(johnDoe.updatedAt)).not.toBe(-1)
            done()
          })
        })
      })
    })

    it('should fail a validation upon creating', function(done){
      this.User.create({aNumber: 0, validateTest: 'hello'}).error(function(err){
        expect(err).toBeDefined()
        expect(err).toBeObject()
        expect(err.validateTest).toBeArray()
        expect(err.validateTest[0]).toBeDefined()
        expect(err.validateTest[0].indexOf('Invalid integer')).toBeGreaterThan(-1)
        done()
      })
    })

    it('should fail a validation upon building', function(done){
      this.User.build({aNumber: 0, validateCustom: 'aaaaaaaaaaaaaaaaaaaaaaaaaa'}).save()
      .error(function(err){
        expect(err).toBeDefined()
        expect(err).toBeObject()
        expect(err.validateCustom).toBeDefined()
        expect(err.validateCustom).toBeArray()
        expect(err.validateCustom[0]).toBeDefined()
        expect(err.validateCustom[0]).toEqual('Length failed.')
        done()
      })
    })

    it('should fail a validation when updating', function(done){
      this.User.create({aNumber: 0}).success(function(user){
        user.updateAttributes({validateTest: 'hello'}).error(function(err){
          expect(err).toBeDefined()
          expect(err).toBeObject()
          expect(err.validateTest).toBeDefined()
          expect(err.validateTest).toBeArray()
          expect(err.validateTest[0]).toBeDefined()
          expect(err.validateTest[0].indexOf('Invalid integer:')).toBeGreaterThan(-1)
          done()
        })
      })
    })

    it('takes zero into account', function(done) {
      this.User.build({ aNumber: 0 }).save([ 'aNumber' ]).success(function(user) {
        expect(user.aNumber).toEqual(0)
        done()
      })
    })

    it('saves a record with no primary key', function(done){
      var HistoryLog = sequelize.define('HistoryLog', {
        someText:  { type: DataTypes.STRING },
        aNumber:   { type: DataTypes.INTEGER },
        aRandomId: { type: DataTypes.INTEGER }
      })
      HistoryLog.sync().success(function() {
        HistoryLog.create({ someText: 'Some random text', aNumber: 3, aRandomId: 5 }).success(function(log) {
          log.updateAttributes({ aNumber: 5 }).success(function(newLog){
            expect(newLog.aNumber).toEqual(5)
            done()
          })
        })
      })
    })

    before(function(done) {
      var self = this
      this.UserEager = this.sequelize.define('UserEagerLoadingSaves', {
        username: DataTypes.STRING,
        age: DataTypes.INTEGER
      }, { timestamps: false })

      this.ProjectEager = this.sequelize.define('ProjectEagerLoadingSaves', {
        title: DataTypes.STRING,
        overdue_days: DataTypes.INTEGER
      }, { timestamps: false })

      this.UserEager.hasMany(this.ProjectEager,   { as: 'Projects'   })
      this.ProjectEager.belongsTo(this.UserEager, { as: 'Poobah'     })

      self.UserEager.sync({force: true}).success(function() {
        self.ProjectEager.sync({force: true}).success(done)
      })
    })

    it('saves one object that has a collection of eagerly loaded objects', function(done) {
      var self = this
      this.UserEager.create({ username: 'joe', age: 1 }).success(function(user) {
        self.ProjectEager.create({ title: 'project-joe1', overdue_days: 0 }).success(function(project1) {
          self.ProjectEager.create({ title: 'project-joe2', overdue_days: 0 }).success(function(project2)  {
            user.setProjects([project1, project2]).success(function() {
              self.UserEager.find({where: {age: 1}, include: [{model: self.ProjectEager, as: 'Projects'}]}).success(function(user) {
                expect(user.username).toEqual('joe')
                expect(user.age).toEqual(1)
                expect(user.projects).toBeDefined()
                expect(user.projects.length).toEqual(2)

                user.age = user.age + 1 // happy birthday joe

                user.save().success(function() {
                  expect(user.username).toEqual('joe')
                  expect(user.age).toEqual(2)
                  expect(user.projects).toBeDefined()
                  expect(user.projects.length).toEqual(2)
                  done()
                })
              })
            })
          })
        })
      })
    })

    it('saves many objects that each a have collection of eagerly loaded objects', function(done) {
      var self = this
      this.UserEager.create({ username: 'bart', age: 20 }).success(function(bart) {
        self.UserEager.create({ username: 'lisa', age: 20 }).success(function(lisa) {
          self.ProjectEager.create({ title: 'detention1', overdue_days: 0 }).success(function(detention1) {
            self.ProjectEager.create({ title: 'detention2', overdue_days: 0 }).success(function(detention2)  {
              self.ProjectEager.create({ title: 'exam1', overdue_days: 0 }).success(function(exam1) {
                self.ProjectEager.create({ title: 'exam2', overdue_days: 0 }).success(function(exam2)  {
                  bart.setProjects([detention1, detention2]).success(function() {
                    lisa.setProjects([exam1, exam2]).success(function() {
                      self.UserEager.findAll({where: {age: 20}, order: 'username ASC', include: [{model: self.ProjectEager, as: 'Projects'}]}).success(function(simpsons) {
                        var _bart, _lisa

                        expect(simpsons.length).toEqual(2)

                        _bart = simpsons[0]
                        _lisa = simpsons[1]

                        expect(_bart.projects).toBeDefined()
                        expect(_lisa.projects).toBeDefined()
                        expect(_bart.projects.length).toEqual(2)
                        expect(_lisa.projects.length).toEqual(2)

                        _bart.age = _bart.age + 1 // happy birthday bart - off to Moe's

                        _bart.save().success(function(savedbart) {
                          expect(savedbart.username).toEqual('bart')
                          expect(savedbart.age).toEqual(21)

                          _lisa.username = 'lsimpson'

                          _lisa.save().success(function(savedlisa) {
                            expect(savedlisa.username).toEqual('lsimpson')
                            expect(savedlisa.age).toEqual(20)

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
        })
      })
    })

    it('saves many objects that each has one eagerly loaded object (to which they belong)', function(done) {
      var self = this
      this.UserEager.create({ username: 'poobah', age: 18 }).success(function(user) {
        self.ProjectEager.create({ title: 'homework', overdue_days: 10 }).success(function(homework) {
          self.ProjectEager.create({ title: 'party', overdue_days: 2 }).success(function(party)  {
            user.setProjects([homework, party]).success(function() {
              self.ProjectEager.findAll({include: [{model: self.UserEager, as: 'Poobah'}]}).success(function(projects) {

                expect(projects.length).toEqual(2)
                expect(projects[0].poobah).toBeDefined()
                expect(projects[1].poobah).toBeDefined()
                expect(projects[0].poobah.username).toEqual('poobah')
                expect(projects[1].poobah.username).toEqual('poobah')

                projects[0].title        = 'partymore'
                projects[1].title        = 'partymore'
                projects[0].overdue_days = 0
                projects[1].overdue_days = 0

                projects[0].save().success(function() {
                  projects[1].save().success(function() {
                    self.ProjectEager.findAll({where: {title: 'partymore', overdue_days: 0}, include: [{model: self.UserEager, as: 'Poobah'}]}).success(function(savedprojects) {

                      expect(savedprojects.length).toEqual(2)
                      expect(savedprojects[0].poobah).toBeDefined()
                      expect(savedprojects[1].poobah).toBeDefined()
                      expect(savedprojects[0].poobah.username).toEqual('poobah')
                      expect(savedprojects[1].poobah.username).toEqual('poobah')

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
  })

  describe('toJSON', function() {
    before(function(done) {
      var self = this
      this.User = this.sequelize.define('UserWithUsernameAndAgeAndIsAdmin', {
        username: Helpers.Sequelize.STRING,
        age:      Helpers.Sequelize.INTEGER,
        isAdmin:  Helpers.Sequelize.BOOLEAN
      }, { timestamps: false })

      this.Project = this.sequelize.define('NiceProject', { title: Helpers.Sequelize.STRING }, { timestamps: false })

      this.User.hasMany(this.Project, { as: 'Projects' })
      this.Project.belongsTo(this.User, { as: 'LovelyUser' })

      this.User.sync({ force: true }).success(function() {
        self.Project.sync({ force: true }).success(done)
      })
    })

    it('returns an object containing all values', function(done) {
      var user = this.User.build({ username: 'test.user', age: 99, isAdmin: true })
      expect(user.toJSON()).toEqual({ username: 'test.user', age: 99, isAdmin: true, id: null })
      done()
    })

    it('returns a response that can be stringified', function(done) {
      var user = this.User.build({ username: 'test.user', age: 99, isAdmin: true })
      expect(JSON.stringify(user)).toEqual('{"username":"test.user","age":99,"isAdmin":true,"id":null}')
      done()
    })

    it('returns a response that can be stringified and then parsed', function(done) {
      var user = this.User.build({ username: 'test.user', age: 99, isAdmin: true })
      expect(JSON.parse(JSON.stringify(user))).toEqual({ username: 'test.user', age: 99, isAdmin: true, id: null })
      done()
    })

    it('includes the eagerly loaded associations', function(done) {
      var self = this
      this.User.create({ username: 'fnord', age: 1, isAdmin: true }).success(function(user) {
        self.Project.create({ title: 'fnord' }).success(function(project) {
          user.setProjects([ project ]).success(function() {
            self.User.findAll({include: [ { model: self.Project, as: 'Projects' } ]}).success(function(users) {
              var _user = users[0]

              expect(_user.projects).toBeDefined()
              expect(JSON.parse(JSON.stringify(_user)).projects).toBeDefined()

              self.Project.findAll({include: [ { model: self.User, as: 'LovelyUser' } ]}).success(function(projects) {
                var _project = projects[0]

                expect(_project.lovelyUser).toBeDefined()
                expect(JSON.parse(JSON.stringify(_project)).lovelyUser).toBeDefined()

                done()
              })
            })
          })
        })
      })
    })
  })

  describe('findAll', function() {
    before(function(done) {
      this.ParanoidUser = sequelize.define('ParanoidUser', {
        username: { type: DataTypes.STRING }
      }, { paranoid: true })

      this.ParanoidUser.hasOne(this.ParanoidUser)
      this.ParanoidUser.sync({ force: true }).success(done)
    })

    it("escapes a single single quotes properly in where clauses", function(done) {
      var self = this

      this.User
        .create({ username: "user'name" })
        .success(function() {
          self.User.findAll({
            where: { username: "user'name" }
          }).success(function(users) {
            expect(users.length).toEqual(1)
            expect(users[0].username).toEqual("user'name")
            done()
          })
        })
    })

    it("escapes two single quotes properly in where clauses", function(done) {
      var self = this

      this.User
        .create({ username: "user''name" })
        .success(function() {
          self.User.findAll({
            where: { username: "user''name" }
          }).success(function(users) {
            expect(users.length).toEqual(1)
            expect(users[0].username).toEqual("user''name")
            done()
          })
        })
    })

    it("returns the timestamps if no attributes have been specified", function(done) {
      var self = this
      this.User.create({ username: 'fnord' }).success(function() {
        self.User.findAll().success(function(users) {
          expect(users[0].createdAt).toBeDefined()
          done()
        })
      })
    })

    it("does not return the timestamps if the username attribute has been specified", function(done) {
      var self = this
      this.User.create({ username: 'fnord' }).success(function() {
        self.User.findAll({ attributes: ['username'] }).success(function(users) {
          expect(users[0].createdAt).not.toBeDefined()
          expect(users[0].username).toBeDefined()
          done()
        })
      })
    })

    it("creates the deletedAt property, when defining paranoid as true", function(done) {
      var self = this
      this.ParanoidUser.create({ username: 'fnord' }).success(function() {
        self.ParanoidUser.findAll().success(function(users) {
          expect(users[0].deletedAt).toBeDefined()
          expect(users[0].deletedAt).toBe(null)
          done()
        })
      })
    })

    it("sets deletedAt property to a specific date when deleting an instance", function(done) {
      var self = this
      this.ParanoidUser.create({ username: 'fnord' }).success(function() {
        self.ParanoidUser.findAll().success(function(users) {
          users[0].destroy().success(function(user) {
            expect(user.deletedAt.getMonth).toBeDefined()
            done()
          })
        })
      })
    })

    it("keeps the deletedAt-attribute with value null, when running updateAttributes", function(done) {
      var self = this
      this.ParanoidUser.create({ username: 'fnord' }).success(function() {
        self.ParanoidUser.findAll().success(function(users) {
          users[0].updateAttributes({username: 'newFnord'}).success(function(user) {
            expect(user.deletedAt).toBe(null)
            done()
          })
        })
      })
    })

    it("keeps the deletedAt-attribute with value null, when updating associations", function(done) {
      var self = this
      this.ParanoidUser.create({ username: 'fnord' }).success(function() {
        self.ParanoidUser.findAll().success(function(users) {
          self.ParanoidUser.create({ username: 'linkedFnord' }).success(function(linkedUser) {
            users[0].setParanoidUser( linkedUser ).success(function(user) {
              expect(user.deletedAt).toBe(null)
              done()
            })
          })
        })
      })
    })

    it("can reuse query option objects", function(done) {
      var self = this
      this.User.create({ username: 'fnord' }).success(function() {
        var query = { where: { username: 'fnord' }}

        self.User.findAll(query).success(function(users) {
          expect(users[0].username).toEqual('fnord')
          self.User.findAll(query).success(function(users) {
            expect(users[0].username).toEqual('fnord')
            done()
          })
        })
      })
    })
  })

  describe('find', function() {
    it("can reuse query option objects", function(done) {
      var self = this
      this.User.create({ username: 'fnord' }).success(function() {
        var query = { where: { username: 'fnord' }}

        self.User.find(query).success(function(user) {
          expect(user.username).toEqual('fnord')

          self.User.find(query).success(function(user) {
            expect(user.username).toEqual('fnord')
            done()
          })
        })
      })
    })
  })

  describe('equals', function() {
    it("can compare records with Date field", function(done) {
      var self = this
      this.User.create({ username: 'fnord' }).success(function(user1) {
        var query = { where: { username: 'fnord' }}

        self.User.find(query).success(function(user2) {
          expect(user1.equals(user2)).toBeTrue()
          done()
        })
      })
    })
  })

  describe('values', function() {
    it('returns all values', function(done) {
      var User = this.sequelize.define('UserHelper', {
        username: Helpers.Sequelize.STRING
      }, { timestamps: false, logging: false })

      User.sync().success(function() {
        var user = User.build({ username: 'foo' })
        expect(user.values).toEqual({ username: "foo", id: null })
        done()
      })
    })
  })

  describe('updateAttributes', function() {
    it("updates attributes in the database", function(done) {
      this.User.create({ username: 'user' }).success(function(user) {
        expect(user.username).toEqual('user')
        user.updateAttributes({ username: 'person' }).success(function(user) {
          expect(user.username).toEqual('person')
          done()
        })
      })
    })

    it("ignores unknown attributes", function(done) {
      this.User.create({ username: 'user' }).success(function(user) {
        user.updateAttributes({ username: 'person', foo: 'bar'}).success(function(user) {
          expect(user.username).toEqual('person')
          expect(user.foo).not.toBeDefined()
          done()
        })
      })
    })

    it("doesn't update primary keys or timestamps", function(done) {
      var User = this.sequelize.define('User' + config.rand(), {
        name: Helpers.Sequelize.STRING,
        bio: Helpers.Sequelize.TEXT,
        identifier: {type: Helpers.Sequelize.STRING, primaryKey: true}
      })

      User.sync({ force: true }).success(function(){
        User.create({
          name: 'snafu',
          identifier: 'identifier'
        }).success(function(user) {
          var oldCreatedAt  = user.createdAt
            , oldIdentifier = user.identifier

          user.updateAttributes({
            name: 'foobar',
            createdAt: new Date(2000, 1, 1),
            identifier: 'another identifier'
          }).success(function(user) {
            expect(user.createdAt).toEqual(oldCreatedAt)
            expect(user.identifier).toEqual(oldIdentifier)
            done()
          })
        })
      })
    })

    it("uses primary keys in where clause", function(done) {
      var User = this.sequelize.define('User' + config.rand(), {
        name: Helpers.Sequelize.STRING,
        bio: Helpers.Sequelize.TEXT,
        identifier: {type: Helpers.Sequelize.STRING, primaryKey: true}
      })

      User.sync({ force: true }).success(function(){
        User.create({
          name: 'snafu',
          identifier: 'identifier'
        }).success(function(user) {
          var emitter = user.updateAttributes({name: 'foobar'})
          emitter.success(function() {
            expect(emitter.query.sql).toMatch(/WHERE [`"]identifier[`"]..identifier./)
            done()
          })
        })
      })
    })

    it('stores and restores null values', function(done) {
      var Download = this.sequelize.define('download', {
        startedAt: Helpers.Sequelize.DATE,
        canceledAt: Helpers.Sequelize.DATE,
        finishedAt: Helpers.Sequelize.DATE
      })

      Download.sync().success(function() {
        Download.create({
          startedAt: new Date()
        }).success(function(download) {
          expect(download.startedAt instanceof Date).toBeTrue()
          expect(download.canceledAt).toBeFalsy()
          expect(download.finishedAt).toBeFalsy()

          download.updateAttributes({
            canceledAt: new Date()
          }).success(function(download) {
            expect(download.startedAt instanceof Date).toBeTrue()
            expect(download.canceledAt instanceof Date).toBeTrue()
            expect(download.finishedAt).toBeFalsy()

            Download.all({
              where: (dialect === 'postgres' ? '"finishedAt" IS NULL' : "`finishedAt` IS NULL")
            }).success(function(downloads) {
              downloads.forEach(function(download) {
                expect(download.startedAt instanceof Date).toBeTrue()
                expect(download.canceledAt instanceof Date).toBeTrue()
                expect(download.finishedAt).toBeFalsy()
              })

              done()
            })
          })
        })
      })
    })
  })
})
