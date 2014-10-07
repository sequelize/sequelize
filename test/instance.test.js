/* jshint camelcase: false */
var chai      = require('chai')
  , expect    = chai.expect
  , Support   = require(__dirname + '/support')
  , DataTypes = require(__dirname + "/../lib/data-types")
  , dialect   = Support.getTestDialect()
  , config    = require(__dirname + "/config/config")
  , sinon     = require('sinon')
  , datetime  = require('chai-datetime')
  , uuid      = require('node-uuid')
  , _         = require('lodash')
  , current   = Support.sequelize;


chai.use(datetime)
chai.config.includeStack = true

describe(Support.getTestDialectTeaser("Instance"), function () {
  beforeEach(function(done) {
    this.User = this.sequelize.define('User', {
      username:  { type: DataTypes.STRING },
      uuidv1:    { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV1 },
      uuidv4:    { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4 },
      touchedAt: { type: DataTypes.DATE, defaultValue: DataTypes.NOW },
      aNumber:   { type: DataTypes.INTEGER },
      bNumber:   { type: DataTypes.INTEGER },
      aDate:     { type: DataTypes.DATE },

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
    this.User.sync({ force: true }).success(function() {
      done()
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
          expect(u2.username).to.equal(bio)
          done()
        })
      }).error(function(err) {
        done(err)
      });
    })
  })

  describe('isNewRecord', function() {
    it('returns true for non-saved objects', function(done) {
      var user = this.User.build({ username: 'user' })
      expect(user.id).to.be.null
      expect(user.isNewRecord).to.be.ok
      done()
    })

    it("returns false for saved objects", function(done) {
      this.User.build({ username: 'user' }).save().success(function(user) {
        expect(user.isNewRecord).to.not.be.ok
        done()
      })
    })

    it("returns false for created objects", function(done) {
      this.User.create({ username: 'user' }).success(function(user) {
        expect(user.isNewRecord).to.not.be.ok
        done()
      })
    })

    it("returns false for objects found by find method", function(done) {
      var self = this
      this.User.create({ username: 'user' }).success(function() {
        self.User.create({ username: 'user' }).success(function(user) {
          self.User.find(user.id).success(function(user) {
            expect(user.isNewRecord).to.not.be.ok
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
            expect(u.isNewRecord).to.not.be.ok
          })
          done()
        })
      })
    })
  })

  describe('isDirty', function() {
    it('returns true for non-saved objects', function(done) {
      var user = this.User.build({ username: 'user' })
      expect(user.id).to.be.null
      expect(user.isDirty).to.be.true
      done()
    })

    it("returns false for saved objects", function(done) {
      this.User.build({ username: 'user' }).save().success(function(user) {
        expect(user.isDirty).to.be.false
        done()
      })
    })

    it("returns true for changed attribute", function(done) {
      this.User.create({ username: 'user' }).success(function(user) {
        user.username = 'new'
        expect(user.isDirty).to.be.true
        done()
      })
    })

    it("returns false for non-changed attribute", function(done) {
      this.User.create({ username: 'user' }).success(function(user) {
        user.username = 'user'
        expect(user.isDirty).to.be.false
        done()
      })
    })

    it("returns false for non-changed date attribute", function(done) {
      this.User.create({ aDate: new Date(2013, 6, 31, 14, 25, 21) }).success(function(user) {
        user.aDate = '2013-07-31 14:25:21'
        expect(user.isDirty).to.be.false
        done()
      })
    })

    // In my opinion this is bad logic, null is different from an empty string
    it.skip("returns false for two empty attributes", function(done) {
      this.User.create({ username: null }).success(function(user) {
        user.username = ''
        expect(user.isDirty).to.be.false
        done()
      })
    })

    it("returns true for bulk changed attribute", function(done) {
      this.User.create({ username: 'user' }).success(function(user) {
        user.setAttributes({
          username: 'new',
          aNumber: 1
        })
        expect(user.isDirty).to.be.true
        done()
      })
    })

    it("returns true for bulk non-changed attribute + model with timestamps", function(done) {
      this.User.create({ username: 'user' }).success(function(user) {
        user.setAttributes({
          username: 'user'
        })

        expect(user.isDirty).to.be.rue
        done()
      })
    })

    it("returns false for bulk non-changed attribute + model without timestamps", function(done) {
      var User = this.sequelize.define('User' + parseInt(Math.random() * 10000000), {
        username: DataTypes.STRING
      }, {
        timestamps: false
      })

      User
        .sync({ force: true })
        .then(function() {
          return User.create({ username: "user" })
        })
        .then(function(user) {
          return user.setAttributes({ username: "user" })
          expect(user.isDirty).to.be.false
        })
        .then(function() {
          done()
        })
    })

    it("returns true for changed and bulk non-changed attribute", function(done) {
      this.User.create({ username: 'user' }).success(function(user) {
        user.aNumber = 23
        user.setAttributes({
          username: 'user'
        })
        expect(user.isDirty).to.be.true
        done()
      })
    })

    it("returns true for changed attribute and false for saved object", function(done) {
      this.User.create({ username: 'user' }).success(function(user) {
        user.username = 'new'
        expect(user.isDirty).to.be.true
        user.save().success(function() {
          expect(user.isDirty).to.be.false
          done()
        })
      })
    })

    it("returns false for created objects", function(done) {
      this.User.create({ username: 'user' }).success(function(user) {
        expect(user.isDirty).to.be.false
        done()
      })
    })

    it("returns false for objects found by find method", function(done) {
      var self = this
      this.User.create({ username: 'user' }).success(function(user) {
        self.User.find(user.id).success(function(user) {
          expect(user.isDirty).to.be.false
          done()
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
            expect(u.isDirty).to.be.false
          })
          done()
        })
      })
    })
  })

  describe('increment', function () {
    beforeEach(function(done) {
      this.User.create({ id: 1, aNumber: 0, bNumber: 0 }).complete(function(){
        done()
      })
    })

    if (current.dialect.supports.transactions) {
      it('supports transactions', function(done) {
        Support.prepareTransactionTest(this.sequelize, function(sequelize) {
          var User = sequelize.define('User', { number: Support.Sequelize.INTEGER })

          User.sync({ force: true }).success(function() {
            User.create({ number: 1 }).success(function(user) {
              sequelize.transaction().then(function(t) {
                user.increment('number', { by: 2, transaction: t }).success(function() {
                  User.all().success(function(users1) {
                    User.all({ transaction: t }).success(function(users2) {
                      expect(users1[0].number).to.equal(1)
                      expect(users2[0].number).to.equal(3)
                      t.rollback().success(function() { done() })
                    })
                  })
                })
              })
            })
          })
        })
      })
    }

    it('supports where conditions', function(done) {
      var self = this
      this.User.find(1).complete(function(err, user1) {
        user1.increment(['aNumber'], { by: 2, where: { bNumber: 1 } }).complete(function() {
          self.User.find(1).complete(function(err, user3) {
            expect(user3.aNumber).to.be.equal(0)
            done()
          })
        })
      })
    })

    it('with array', function(done) {
      var self = this
      this.User.find(1).complete(function(err, user1) {
        user1.increment(['aNumber'], { by: 2 }).complete(function() {
          self.User.find(1).complete(function(err, user3) {
            expect(user3.aNumber).to.be.equal(2)
            done()
          })
        })
      })
    })

    it('with single field', function(done) {
      var self = this
      this.User.find(1).complete(function(err, user1) {
        user1.increment('aNumber', { by: 2 }).complete(function() {
          self.User.find(1).complete(function(err, user3) {
            expect(user3.aNumber).to.be.equal(2)
            done()
          })
        })
      })
    })

    it('with single field and no value', function(done) {
      var self = this
      this.User.find(1).complete(function(err, user1) {
        user1.increment('aNumber').complete(function() {
          self.User.find(1).complete(function(err, user2) {
            expect(user2.aNumber).to.be.equal(1)
            done()
          })
        })
      })
    })

    it('should still work right with other concurrent updates', function(done) {
      var self = this
      this.User.find(1).complete(function (err, user1) {
        // Select the user again (simulating a concurrent query)
        self.User.find(1).complete(function (err, user2) {
          user2.updateAttributes({
            aNumber: user2.aNumber + 1
          }).complete(function () {
            user1.increment(['aNumber'], { by: 2 }).complete(function() {
              self.User.find(1).complete(function(err, user5) {
                expect(user5.aNumber).to.be.equal(3)
                done()
              })
            })
          })
        })
      })
    })

    it('should still work right with other concurrent increments', function(done) {
      var self = this
      this.User.find(1).complete(function(err, user1) {
        var _done = _.after(3, function() {
          self.User.find(1).complete(function(err, user2) {
            expect(user2.aNumber).to.equal(6)
            done()
          })
        })

        user1.increment(['aNumber'], { by: 2 }).complete(_done)
        user1.increment(['aNumber'], { by: 2 }).complete(_done)
        user1.increment(['aNumber'], { by: 2 }).complete(_done)
      })
    })

    it('with key value pair', function(done) {
      var self = this
      this.User.find(1).complete(function(err, user1) {
        user1.increment({ 'aNumber': 1, 'bNumber': 2 }).success(function() {
          self.User.find(1).complete(function (err, user3) {
            expect(user3.aNumber).to.be.equal(1)
            expect(user3.bNumber).to.be.equal(2)
            done()
          })
        })
      })
    })

    it('with timestamps set to true', function (done) {
      var User = this.sequelize.define('IncrementUser', {
        aNumber: DataTypes.INTEGER
      }, { timestamps: true })

      User.sync({ force: true }).success(function() {
        User.create({aNumber: 1}).success(function (user) {
          var oldDate = user.updatedAt
          setTimeout(function () {
            user.increment('aNumber', { by: 1 }).success(function() {
              User.find(1).success(function (user) {
                expect(user.updatedAt).to.be.afterTime(oldDate)
                done()
              })
            })
          }, 1000)
        })
      })
    })
  })

  describe('decrement', function () {
    beforeEach(function(done) {
      this.User.create({ id: 1, aNumber: 0, bNumber: 0 }).complete(done)
    })

    if (current.dialect.supports.transactions) {
      it('supports transactions', function(done) {
        Support.prepareTransactionTest(this.sequelize, function(sequelize) {
          var User = sequelize.define('User', { number: Support.Sequelize.INTEGER })

          User.sync({ force: true }).success(function() {
            User.create({ number: 3 }).success(function(user) {
              sequelize.transaction().then(function(t) {
                user.decrement('number', { by: 2, transaction: t }).success(function() {
                  User.all().success(function(users1) {
                    User.all({ transaction: t }).success(function(users2) {
                      expect(users1[0].number).to.equal(3)
                      expect(users2[0].number).to.equal(1)
                      t.rollback().success(function() { done() })
                    })
                  })
                })
              })
            })
          })
        })
      })
    }

    it('with array', function(done) {
      var self = this
      this.User.find(1).complete(function(err, user1) {
        user1.decrement(['aNumber'], { by: 2 }).complete(function() {
          self.User.find(1).complete(function(err, user3) {
            expect(user3.aNumber).to.be.equal(-2)
            done()
          })
        })
      })
    })

    it('with single field', function(done) {
      var self = this
      this.User.find(1).complete(function(err, user1) {
        user1.decrement('aNumber', { by: 2 }).complete(function() {
          self.User.find(1).complete(function(err, user3) {
            expect(user3.aNumber).to.be.equal(-2)
            done()
          })
        })
      })
    })

    it('with single field and no value', function(done) {
      var self = this
      this.User.find(1).complete(function(err, user1) {
        user1.decrement('aNumber').complete(function() {
          self.User.find(1).complete(function(err, user2) {
            expect(user2.aNumber).to.be.equal(-1)
            done()
          })
        })
      })
    })

    it('should still work right with other concurrent updates', function(done) {
      var self = this
      this.User.find(1).complete(function(err, user1) {
        // Select the user again (simulating a concurrent query)
        self.User.find(1).complete(function(err, user2) {
          user2.updateAttributes({
            aNumber: user2.aNumber + 1
          }).complete(function () {
            user1.decrement(['aNumber'], { by: 2 }).complete(function() {
              self.User.find(1).complete(function(err, user5) {
                expect(user5.aNumber).to.be.equal(-1)
                done()
              })
            })
          })
        })
      })
    })

    it('should still work right with other concurrent increments', function(done) {
      var self = this
      this.User.find(1).complete(function(err, user1) {
        var _done = _.after(3, function() {
          self.User.find(1).complete(function (err, user2) {
            expect(user2.aNumber).to.equal(-6)
            done()
          })
        })

        user1.decrement(['aNumber'], { by: 2 }).complete(_done)
        user1.decrement(['aNumber'], { by: 2 }).complete(_done)
        user1.decrement(['aNumber'], { by: 2 }).complete(_done)
      })
    })

    it('with key value pair', function(done) {
      var self = this
      this.User.find(1).complete(function(err, user1) {
        user1.decrement({ 'aNumber': 1, 'bNumber': 2}).complete(function() {
          self.User.find(1).complete(function(err, user3) {
            expect(user3.aNumber).to.be.equal(-1)
            expect(user3.bNumber).to.be.equal(-2)
            done()
          })
        })
      })
    })

    it('with timestamps set to true', function (done) {
      var User = this.sequelize.define('IncrementUser', {
        aNumber: DataTypes.INTEGER
      }, { timestamps: true })

      User.sync({ force: true }).success(function() {
        User.create({aNumber: 1}).success(function (user) {
          var oldDate = user.updatedAt
          setTimeout(function () {
            user.decrement('aNumber', { by: 1 }).success(function() {
              User.find(1).success(function (user) {
                expect(user.updatedAt).to.be.afterTime(oldDate)
                done()
              })
            })
          }, 1000)
        })
      })
    })
  })

  describe('reload', function () {
    if (current.dialect.supports.transactions) {
      it('supports transactions', function(done) {
        Support.prepareTransactionTest(this.sequelize, function(sequelize) {
          var User = sequelize.define('User', { username: Support.Sequelize.STRING })

          User.sync({ force: true }).success(function() {
            User.create({ username: 'foo' }).success(function(user) {
              sequelize.transaction().then(function(t) {
                User.update({ username: 'bar' }, {where: {username: 'foo'}, transaction: t }).success(function() {
                  user.reload().success(function(user) {
                    expect(user.username).to.equal('foo')
                    user.reload({ transaction: t }).success(function(user) {
                      expect(user.username).to.equal('bar')
                      t.rollback().success(function() { done() })
                    })
                  })
                })
              })
            })
          })
        })
      })
    }

    it("should return a reference to the same DAO instead of creating a new one", function(done) {
      this.User.create({ username: 'John Doe' }).complete(function(err, originalUser) {
        originalUser.updateAttributes({ username: 'Doe John' }).complete(function() {
          originalUser.reload().complete(function (err, updatedUser) {
            expect(originalUser === updatedUser).to.be.true
            done()
          })
        })
      })
    })

    it("should update the values on all references to the DAO", function(done) {
      var self = this
      this.User.create({ username: 'John Doe' }).complete(function(err, originalUser) {
        self.User.find(originalUser.id).complete(function(err, updater) {
          updater.updateAttributes({ username: 'Doe John' }).complete(function() {
            // We used a different reference when calling updateAttributes, so originalUser is now out of sync
            expect(originalUser.username).to.equal('John Doe')

            originalUser.reload().complete(function(err, updatedUser) {
              expect(originalUser.username).to.equal('Doe John')
              expect(updatedUser.username).to.equal('Doe John')
              done()
            })
          })
        })
      })
    })

    it("should update read only attributes as well (updatedAt)", function(done) {
      var self = this

      this.User.create({ username: 'John Doe' }).complete(function(err, originalUser) {
        var originallyUpdatedAt = originalUser.updatedAt

        // Wait for a second, so updatedAt will actually be different
        setTimeout(function () {
          self.User.find(originalUser.id).complete(function(err, updater) {
            updater.updateAttributes({ username: 'Doe John' }).complete(function () {
              originalUser.reload().complete(function(err, updatedUser) {
                expect(originalUser.updatedAt).to.be.above(originallyUpdatedAt)
                expect(updatedUser.updatedAt).to.be.above(originallyUpdatedAt)
                done()
              })
            })
          })
        }, 1000)
      })
    })

    it("should update the associations as well", function(done) {
      var Book = this.sequelize.define('Book', { title:   DataTypes.STRING })
        , Page = this.sequelize.define('Page', { content: DataTypes.TEXT })

      Book.hasMany(Page)
      Page.belongsTo(Book)

      Book.sync({force: true}).success(function() {
        Page.sync({force: true}).success(function() {
          Book.create({ title: 'A very old book' }).success(function(book) {
            Page.create({ content: 'om nom nom' }).success(function(page) {
              book.setPages([ page ]).success(function() {
                Book.find({
                  where: { id : book.id },
                  include: [Page]
                }).success(function(leBook) {
                  page.updateAttributes({ content: 'something totally different' }).success(function(page) {
                    expect(leBook.Pages.length).to.equal(1)
                    expect(leBook.Pages[0].content).to.equal('om nom nom')
                    expect(page.content).to.equal('something totally different')

                    leBook.reload().success(function(leBook) {
                      expect(leBook.Pages.length).to.equal(1)
                      expect(leBook.Pages[0].content).to.equal('something totally different')
                      expect(page.content).to.equal('something totally different')
                      done()
                    });
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
    describe('uuid', function() {
      it('should store a string in uuidv1 and uuidv4', function(done) {
        var user = this.User.build({ username: 'a user'})
        expect(user.uuidv1).to.be.a('string')
        expect(user.uuidv4).to.be.a('string')
        done()
      })
      it('should store a string of length 36 in uuidv1 and uuidv4', function(done) {
        var user = this.User.build({ username: 'a user'})
        expect(user.uuidv1).to.have.length(36)
        expect(user.uuidv4).to.have.length(36)
        done()
      })
      it('should store a valid uuid in uuidv1 and uuidv4 that can be parsed to something of length 16', function(done) {
        var user = this.User.build({ username: 'a user'})
        expect(uuid.parse(user.uuidv1)).to.have.length(16)
        expect(uuid.parse(user.uuidv4)).to.have.length(16)
        done()
      })

      it('should store a valid uuid if the field is a primary key named id', function () {
        var Person = this.sequelize.define('Person', {
          id: {
            type: DataTypes.UUID,
            defaultValue: DataTypes.UUIDV1,
            primaryKey: true
          }
        })

        var person = Person.build({})
        expect(person.id).to.be.ok
        expect(person.id).to.have.length(36)
      })
    })
    describe('current date', function() {
      it('should store a date in touchedAt', function(done) {
        var user = this.User.build({ username: 'a user'})
        expect(user.touchedAt).to.be.instanceof(Date)
        done()
      })

      it("should store the current date in touchedAt", function(done) {
        var clock = sinon.useFakeTimers()
        clock.tick(5000)
        var user = this.User.build({ username: 'a user'})
        clock.restore()
        expect(+user.touchedAt).to.be.equal(5000)
        done()
      })
    })

    describe('allowNull date', function() {
      it('should be just "null" and not Date with Invalid Date', function(done) {
        var self = this
        this.User.build({ username: 'a user'}).save().success(function() {
          self.User.find({where: {username: 'a user'}}).success(function(user) {
            expect(user.dateAllowNullTrue).to.be.null
            done()
          })
        })
      })

      it('should be the same valid date when saving the date', function(done) {
        var self = this
        var date = new Date()
        this.User.build({ username: 'a user', dateAllowNullTrue: date}).save().success(function() {
          self.User.find({where: {username: 'a user'}}).success(function(user) {
            expect(user.dateAllowNullTrue.toString()).to.equal(date.toString())
            done()
          })
        })
      })
    })
  })

  describe('complete', function() {
    it("gets triggered if an error occurs", function(done) {
      this.User.find({ where: "asdasdasd" }).complete(function(err) {
        expect(err).to.exist
        expect(err.message).to.exist
        done()
      })
    })

    it("gets triggered if everything was ok", function(done) {
      this.User.count().complete(function(err, result) {
        expect(err).to.be.null
        expect(result).to.exist
        done()
      })
    })
  })

  describe('save', function() {
    if (current.dialect.supports.transactions) {
      it('supports transactions', function(done) {
        Support.prepareTransactionTest(this.sequelize, function(sequelize) {
          var User = sequelize.define('User', { username: Support.Sequelize.STRING })

          User.sync({ force: true }).success(function() {
            sequelize.transaction().then(function(t) {
              User.build({ username: 'foo' }).save({ transaction: t }).success(function() {
                User.count().success(function(count1) {
                  User.count({ transaction: t }).success(function(count2) {
                    expect(count1).to.equal(0)
                    expect(count2).to.equal(1)
                    t.rollback().success(function(){ done() })
                  })
                })
              })
            })
          })
        })
      })
    }

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
            expect(user2.username).to.equal('fizz')
            // bio should be unchanged
            expect(user2.birthDate).not.to.equal(date)
            done()
          })
        })
      })
    })

    it('only validates fields in passed array', function (done) {
      this.User.build({
        validateTest: 'cake', // invalid, but not saved
        validateCustom: '1'
      }).save(['validateCustom']).success(function () {
        done()
      })
    })

    it("stores an entry in the database", function(done) {
      var username = 'user'
        , User     = this.User
        , user     = this.User.build({
          username: username,
          touchedAt: new Date(1984, 8, 23)
        })

      User.all().success(function(users) {
        expect(users).to.have.length(0)
        user.save().success(function(){
          User.all().success(function(users) {
            expect(users).to.have.length(1)
            expect(users[0].username).to.equal(username)
            expect(users[0].touchedAt).to.be.instanceof(Date)
            expect(users[0].touchedAt).to.equalDate(new Date(1984, 8, 23))
            done()
          })
        })
      })
    })

    it("updates the timestamps", function(done) {
      var now       = Date.now()
        , user      = null
        , updatedAt = null
        , User      = this.User

      // timeout is needed, in order to check the update of the timestamp
      var build = function(callback) {
        user      = User.build({ username: 'user' })

        var save = user.save()

        save.success(function() {
          expect(now).to.be.below(user.updatedAt.getTime())
          callback()
        })
      }

      // closures are fun :)
      setTimeout(function() {
        build(function() {
          done()
        })
      }, 1000)
    })

    it('does not update timestamps when passing silent=true', function() {
      var self = this
      return this.User.create({ username: 'user' }).then(function (user) {
        var updatedAt = user.updatedAt

        return new self.sequelize.Promise(function (resolve) {
          setTimeout(function () {
            user.updateAttributes({
              username: 'userman'
            }, {
              // silent: true
            }).then(function () {
              expect(user.updatedAt).to.equalDate(updatedAt)

              resolve()
            })
          }, 2000)
        })
      })
    })

    it('updates with function and column value', function (done) {
      var self = this

      this.User.create({
        aNumber: 42
      }).success(function(user) {
        user.bNumber = self.sequelize.col('aNumber')
        user.username = self.sequelize.fn('upper', 'sequelize')

        user.save().success(function(){
          self.User.find(user.id).success(function(user2) {
            expect(user2.username).to.equal('SEQUELIZE')
            expect(user2.bNumber).to.equal(42)
            done()
          })
        })
      })
    })

    describe('without timestamps option', function() {
      it("doesn't update the updatedAt column", function(done) {
        var User2 = this.sequelize.define('User2', {
          username: DataTypes.STRING,
          updatedAt: DataTypes.DATE
        }, { timestamps: false })
        User2.sync().success(function() {
          User2.create({ username: 'john doe' }).success(function(johnDoe) {
            // sqlite and mysql return undefined, whereas postgres returns null
            expect([undefined, null].indexOf(johnDoe.updatedAt)).not.to.be.equal(-1)
            done()
          })
        })
      })
    })

    describe('with custom timestamp options', function() {
      var now = Date.now()

      it("updates the createdAt column if updatedAt is disabled", function(done) {
        var User2 = this.sequelize.define('User2', {
          username: DataTypes.STRING
        }, { updatedAt: false })

        User2.sync().success(function() {
          User2.create({ username: 'john doe' }).success(function(johnDoe) {
            expect(johnDoe.updatedAt).to.be.undefined;
            expect(now).to.be.below(johnDoe.createdAt.getTime())
            done()
          })
        })
      })

      it("updates the updatedAt column if createdAt is disabled", function(done) {
        var User2 = this.sequelize.define('User2', {
          username: DataTypes.STRING
        }, { createdAt: false })

        User2.sync().success(function() {
          User2.create({ username: 'john doe' }).success(function(johnDoe) {
            expect(johnDoe.createdAt).to.be.undefined;
            expect(now).to.be.below(johnDoe.updatedAt.getTime())
            done()
          })
        })
      })
    })

    it('should fail a validation upon creating', function(done){
      this.User.create({aNumber: 0, validateTest: 'hello'}).error(function(err){
        expect(err).to.exist
        expect(err).to.be.instanceof(Object)
        expect(err.get('validateTest')).to.be.instanceof(Array)
        expect(err.get('validateTest')[0]).to.exist
        expect(err.get('validateTest')[0].message).to.equal('Validation isInt failed')
        done()
      })
    })

    it('should fail a validation upon building', function(done){
      this.User.build({aNumber: 0, validateCustom: 'aaaaaaaaaaaaaaaaaaaaaaaaaa'}).save()
      .error(function(err){
        expect(err).to.exist
        expect(err).to.be.instanceof(Object)
        expect(err.get('validateCustom')).to.exist
        expect(err.get('validateCustom')).to.be.instanceof(Array)
        expect(err.get('validateCustom')[0]).to.exist
        expect(err.get('validateCustom')[0].message).to.equal('Length failed.')
        done()
      })
    })

    it('should fail a validation when updating', function(done){
      this.User.create({aNumber: 0}).success(function(user){
        user.updateAttributes({validateTest: 'hello'}).error(function(err){
          expect(err).to.exist
          expect(err).to.be.instanceof(Object)
          expect(err.get('validateTest')).to.exist
          expect(err.get('validateTest')).to.be.instanceof(Array)
          expect(err.get('validateTest')[0]).to.exist
          expect(err.get('validateTest')[0].message).to.equal('Validation isInt failed')
          done()
        })
      })
    })

    it('takes zero into account', function(done) {
      this.User.build({ aNumber: 0 }).save([ 'aNumber' ]).success(function(user) {
        expect(user.aNumber).to.equal(0)
        done()
      })
    })

    it('saves a record with no primary key', function(done){
      var HistoryLog = this.sequelize.define('HistoryLog', {
        someText:  { type: DataTypes.STRING },
        aNumber:   { type: DataTypes.INTEGER },
        aRandomId: { type: DataTypes.INTEGER }
      })
      HistoryLog.sync().success(function() {
        HistoryLog.create({ someText: 'Some random text', aNumber: 3, aRandomId: 5 }).success(function(log) {
          log.updateAttributes({ aNumber: 5 }).success(function(newLog){
            expect(newLog.aNumber).to.equal(5)
            done()
          })
        })
      })
    })

    describe('eagerly loaded objects', function() {
      beforeEach(function(done) {
        var self = this
        this.UserEager = this.sequelize.define('UserEagerLoadingSaves', {
          username: DataTypes.STRING,
          age: DataTypes.INTEGER
        }, { timestamps: false })

        this.ProjectEager = this.sequelize.define('ProjectEagerLoadingSaves', {
          title: DataTypes.STRING,
          overdue_days: DataTypes.INTEGER
        }, { timestamps: false })

        this.UserEager.hasMany(this.ProjectEager,   { as: 'Projects', foreignKey: 'PoobahId' })
        this.ProjectEager.belongsTo(this.UserEager, { as: 'Poobah', foreignKey: 'PoobahId' })

        self.UserEager.sync({force: true}).success(function() {
          self.ProjectEager.sync({force: true}).success(function() {
            done()
          })
        })
      })

      it('saves one object that has a collection of eagerly loaded objects', function(done) {
        var self = this
        this.UserEager.create({ username: 'joe', age: 1 }).success(function(user) {
          self.ProjectEager.create({ title: 'project-joe1', overdue_days: 0 }).success(function(project1) {
            self.ProjectEager.create({ title: 'project-joe2', overdue_days: 0 }).success(function(project2)  {
              user.setProjects([project1, project2]).success(function() {
                self.UserEager.find({where: {age: 1}, include: [{model: self.ProjectEager, as: 'Projects'}]}).success(function(user) {
                  expect(user.username).to.equal('joe')
                  expect(user.age).to.equal(1)
                  expect(user.Projects).to.exist
                  expect(user.Projects.length).to.equal(2)

                  user.age = user.age + 1 // happy birthday joe

                  user.save().done(function(err) {
                    expect(err).not.to.be.ok

                    expect(user.username).to.equal('joe')
                    expect(user.age).to.equal(2)
                    expect(user.Projects).to.exist
                    expect(user.Projects.length).to.equal(2)
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

                          expect(simpsons.length).to.equal(2)

                          _bart = simpsons[0]
                          _lisa = simpsons[1]

                          expect(_bart.Projects).to.exist
                          expect(_lisa.Projects).to.exist
                          expect(_bart.Projects.length).to.equal(2)
                          expect(_lisa.Projects.length).to.equal(2)

                          _bart.age = _bart.age + 1 // happy birthday bart - off to Moe's

                          _bart.save().success(function(savedbart) {
                            expect(savedbart.username).to.equal('bart')
                            expect(savedbart.age).to.equal(21)

                            _lisa.username = 'lsimpson'

                            _lisa.save().success(function(savedlisa) {
                              expect(savedlisa.username).to.equal('lsimpson')
                              expect(savedlisa.age).to.equal(20)

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
                  expect(projects.length).to.equal(2)
                  expect(projects[0].Poobah).to.exist
                  expect(projects[1].Poobah).to.exist
                  expect(projects[0].Poobah.username).to.equal('poobah')
                  expect(projects[1].Poobah.username).to.equal('poobah')

                  projects[0].title        = 'partymore'
                  projects[1].title        = 'partymore'
                  projects[0].overdue_days = 0
                  projects[1].overdue_days = 0

                  projects[0].save().success(function() {
                    projects[1].save().success(function() {
                      self.ProjectEager.findAll({where: {title: 'partymore', overdue_days: 0}, include: [{model: self.UserEager, as: 'Poobah'}]}).success(function(savedprojects) {

                        expect(savedprojects.length).to.equal(2)
                        expect(savedprojects[0].Poobah).to.exist
                        expect(savedprojects[1].Poobah).to.exist
                        expect(savedprojects[0].Poobah.username).to.equal('poobah')
                        expect(savedprojects[1].Poobah.username).to.equal('poobah')

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
  describe('many to many relations', function() {
    var udo;
    beforeEach(function(done) {
      var self = this
      this.User = this.sequelize.define('UserWithUsernameAndAgeAndIsAdmin', {
        username: DataTypes.STRING,
        age:      DataTypes.INTEGER,
        isAdmin:  DataTypes.BOOLEAN
      }, {timestamps: false})

      this.Project = this.sequelize.define('NiceProject',
        { title: DataTypes.STRING }, {timestamps: false})

      this.Project.hasMany(this.User)
      this.User.hasMany(this.Project)

      this.User.sync({ force: true }).success(function() {
        self.Project.sync({ force: true }).success(function() {
          self.User.create({ username: 'fnord', age: 1, isAdmin: true })
            .success(function(user) {
              udo = user
              done()
            })
        })
      })
    })
    it.skip('Should assign a property to the instance', function(done) {
      // @thanpolas rethink this test, it doesn't make sense, a relation has
      // to be created first in the beforeEach().
      var self = this;
      this.User.find({id: udo.id})
        .success(function(user) {
          user.NiceProjectId = 1;
          expect(user.NiceProjectId).to.equal(1);
          done();
        })
    })
  })

  describe('toJSON', function() {
    beforeEach(function(done) {
      var self = this
      this.User = this.sequelize.define('UserWithUsernameAndAgeAndIsAdmin', {
        username: DataTypes.STRING,
        age:      DataTypes.INTEGER,
        isAdmin:  DataTypes.BOOLEAN
      }, { timestamps: false })

      this.Project = this.sequelize.define('NiceProject', { title: DataTypes.STRING }, { timestamps: false })

      this.User.hasMany(this.Project, { as: 'Projects', foreignKey: 'lovelyUserId' })
      this.Project.belongsTo(this.User, { as: 'LovelyUser', foreignKey: 'lovelyUserId' })

      this.User.sync({ force: true }).success(function() {
        self.Project.sync({ force: true }).success(function() {
          done()
        })
      })
    })

    it("dont return instance that isn't defined", function ( done ) {
      var self = this;

      self.Project.create({ lovelyUserId: null })
        .then(function ( project ) {
          return self.Project.find({
            where: {
              id: project.id,
            },
            include: [
              { model: self.User, as: 'LovelyUser' }
            ]
          })
        })
        .then(function ( project ) {
          var json = project.toJSON();

          expect( json.LovelyUser ).to.be.equal( null )
        })
        .done( done )
        .catch( done );

    });

    it("dont return instances that aren't defined", function ( done ) {
      var self = this;

      self.User.create({ username: 'cuss' })
        .then(function ( user ) {
          return self.User.find({
            where: {
              id: user.id,
            },
            include: [
              { model: self.Project, as: 'Projects' }
            ]
          })
        })
        .then(function ( user ) {
          var json = user.toJSON();

          expect( user.Projects ).to.be.instanceof( Array )
          expect( user.Projects ).to.be.length( 0 )
        })
        .done( done )
        .catch( done );

    });

    it('returns an object containing all values', function(done) {
      var user = this.User.build({ username: 'test.user', age: 99, isAdmin: true })
      expect(user.toJSON()).to.deep.equal({ username: 'test.user', age: 99, isAdmin: true, id: null })
      done()
    })

    it('returns a response that can be stringified', function(done) {
      var user = this.User.build({ username: 'test.user', age: 99, isAdmin: true })
      expect(JSON.stringify(user)).to.deep.equal('{"id":null,"username":"test.user","age":99,"isAdmin":true}')
      done()
    })

    it('returns a response that can be stringified and then parsed', function(done) {
      var user = this.User.build({ username: 'test.user', age: 99, isAdmin: true })
      expect(JSON.parse(JSON.stringify(user))).to.deep.equal({ username: 'test.user', age: 99, isAdmin: true, id: null })
      done()
    })

    it('includes the eagerly loaded associations', function(done) {
      var self = this
      this.User.create({ username: 'fnord', age: 1, isAdmin: true }).success(function(user) {
        self.Project.create({ title: 'fnord' }).success(function(project) {
          user.setProjects([ project ]).success(function() {
            self.User.findAll({include: [ { model: self.Project, as: 'Projects' } ]}).success(function(users) {
              var _user = users[0]

              expect(_user.Projects).to.exist
              expect(JSON.parse(JSON.stringify(_user)).Projects).to.exist

              self.Project.findAll({include: [ { model: self.User, as: 'LovelyUser' } ]}).success(function(projects) {
                var _project = projects[0]

                expect(_project.LovelyUser).to.exist
                expect(JSON.parse(JSON.stringify(_project)).LovelyUser).to.exist

                done()
              })
            })
          })
        })
      })
    })
  })

  describe('findAll', function() {
    beforeEach(function(done) {
      this.ParanoidUser = this.sequelize.define('ParanoidUser', {
        username: { type: DataTypes.STRING }
      }, { paranoid: true })

      this.ParanoidUser.hasOne(this.ParanoidUser)
      this.ParanoidUser.sync({ force: true }).success(function() {
        done()
      })
    })

    it("sql should have paranoid condition", function ( done ) {
      var self = this;

      self.ParanoidUser.create({ username: 'cuss' })
        .then(function () {
          return self.ParanoidUser.findAll();
        })
        .then(function ( users ) {
          expect( users ).to.have.length( 1 );

          return users[ 0 ].destroy();
        })
        .then(function () {
          return self.ParanoidUser.findAll();
        })
        .then(function ( users ) {
          expect( users ).to.have.length( 0 );
        })
        .done( done )
        .catch( done );
    });

    it("sequelize.and as where should include paranoid condition", function ( done ) {
      var self = this;

      self.ParanoidUser.create({ username: 'cuss' })
        .then(function () {
          return self.ParanoidUser.findAll({
            where: self.sequelize.and({
              username: 'cuss'
            })
          });
        })
        .then(function ( users ) {
          expect( users ).to.have.length( 1 );

          return users[ 0 ].destroy();
        })
        .then(function () {
          return self.ParanoidUser.findAll({
            where: self.sequelize.and({
              username: 'cuss'
            })
          });
        })
        .then(function ( users ) {
          expect( users ).to.have.length( 0 );
        })
        .done( done )
        .catch( done );

    });

    it("sequelize.or as where should include paranoid condition", function ( done ) {
      var self = this;

      self.ParanoidUser.create({ username: 'cuss' })
        .then(function () {
          return self.ParanoidUser.findAll({
            where: self.sequelize.or({
              username: 'cuss'
            })
          });
        })
        .then(function ( users ) {
          expect( users ).to.have.length( 1 );

          return users[ 0 ].destroy();
        })
        .then(function () {
          return self.ParanoidUser.findAll({
            where: self.sequelize.or({
              username: 'cuss'
            })
          });
        })
        .then(function ( users ) {
          expect( users ).to.have.length( 0 );
        })
        .done( done )
        .catch( done );

    });

    it("escapes a single single quotes properly in where clauses", function(done) {
      var self = this

      this.User
        .create({ username: "user'name" })
        .success(function() {
          self.User.findAll({
            where: { username: "user'name" }
          }).success(function(users) {
            expect(users.length).to.equal(1)
            expect(users[0].username).to.equal("user'name")
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
            expect(users.length).to.equal(1)
            expect(users[0].username).to.equal("user''name")
            done()
          })
        })
    })

    it("returns the timestamps if no attributes have been specified", function(done) {
      var self = this
      this.User.create({ username: 'fnord' }).success(function() {
        self.User.findAll().success(function(users) {
          expect(users[0].createdAt).to.exist
          done()
        })
      })
    })

    it("does not return the timestamps if the username attribute has been specified", function(done) {
      var self = this
      this.User.create({ username: 'fnord' }).success(function() {
        self.User.findAll({ attributes: ['username'] }).success(function(users) {
          expect(users[0].createdAt).not.to.exist
          expect(users[0].username).to.exist
          done()
        })
      })
    })

    it("creates the deletedAt property, when defining paranoid as true", function(done) {
      var self = this
      this.ParanoidUser.create({ username: 'fnord' }).success(function() {
        self.ParanoidUser.findAll().success(function(users) {
          expect(users[0].deletedAt).to.be.null
          done()
        })
      })
    })

    it('destroys a record with a primary key of something other than id', function(done) {
      var UserDestroy = this.sequelize.define('UserDestroy', {
        newId: {
          type: DataTypes.STRING,
          primaryKey: true
        },
        email: DataTypes.STRING
      })

      UserDestroy.sync().success(function() {
        UserDestroy.create({newId: '123ABC', email: 'hello'}).success(function() {
          UserDestroy.find({where: {email: 'hello'}}).success(function(user) {
            user.destroy().on('sql', function(sql) {
              if (dialect === "postgres" || dialect === "postgres-native") {
                expect(sql).to.equal('DELETE FROM "UserDestroys" WHERE "newId" IN (SELECT "newId" FROM "UserDestroys" WHERE "newId"=\'123ABC\' LIMIT 1)')
              }
              else if (Support.dialectIsMySQL()) {
                expect(sql).to.equal("DELETE FROM `UserDestroys` WHERE `newId`='123ABC' LIMIT 1")
              } else if(dialect === 'mssql'){
                expect(sql).to.equal('DELETE FROM "UserDestroys" WHERE "newId"=\'123ABC\' ;SELECT @@ROWCOUNT AS AFFECTEDROWS;')
              }else {
                expect(sql).to.equal("DELETE FROM `UserDestroys` WHERE `newId`='123ABC'")
              }
              done()
            })
          })
        })
      })
    })

    it("sets deletedAt property to a specific date when deleting an instance", function(done) {
      var self = this
      this.ParanoidUser.create({ username: 'fnord' }).success(function() {
        self.ParanoidUser.findAll().success(function(users) {
          users[0].destroy().success(function(user) {
            expect(user.deletedAt.getMonth).to.exist
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
            expect(user.deletedAt).not.to.exist
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
              expect(user.deletedAt).not.to.exist
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
          expect(users[0].username).to.equal('fnord')
          self.User.findAll(query).success(function(users) {
            expect(users[0].username).to.equal('fnord')
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
          expect(user.username).to.equal('fnord')

          self.User.find(query).success(function(user) {
            expect(user.username).to.equal('fnord')
            done()
          })
        })
      })
    })
    it("returns null for null, undefined, and unset boolean values", function(done) {
      var Setting = this.sequelize.define('SettingHelper', {
        setting_key: DataTypes.STRING,
          bool_value: { type: DataTypes.BOOLEAN, allowNull: true },
          bool_value2: { type: DataTypes.BOOLEAN, allowNull: true },
          bool_value3: { type: DataTypes.BOOLEAN, allowNull: true }
      }, { timestamps: false, logging: false })

      Setting.sync({ force: true }).success(function() {
        Setting.create({ setting_key: 'test', bool_value: null, bool_value2: undefined }).success(function() {
          Setting.find({ where: { setting_key: 'test' } }).success(function(setting) {
            expect(setting.bool_value).to.equal(null)
            expect(setting.bool_value2).to.equal(null)
            expect(setting.bool_value3).to.equal(null)
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
          if(dialect === 'mssql'){
            user1.dataValues.uuidv1 = user1.dataValues.uuidv1.toUpperCase();
            user1.dataValues.uuidv4 = user1.dataValues.uuidv4.toUpperCase();
          }
          expect(user1.equals(user2)).to.be.true
          done()
        })
      })
    })
  })

  describe('values', function() {
    it('returns all values', function(done) {
      var User = this.sequelize.define('UserHelper', {
        username: DataTypes.STRING
      }, { timestamps: false, logging: false })

      User.sync().success(function() {
        var user = User.build({ username: 'foo' })
        expect(user.values).to.deep.equal({ username: "foo", id: null })
        done()
      })
    })
  })

  describe('updateAttributes', function() {
    if (current.dialect.supports.transactions) {
      it('supports transactions', function(done) {
        Support.prepareTransactionTest(this.sequelize, function(sequelize) {
          var User = sequelize.define('User', { username: Support.Sequelize.STRING })

          User.sync({ force: true }).success(function() {
            User.create({ username: 'foo' }).success(function(user) {
              sequelize.transaction().then(function(t) {
                user.updateAttributes({ username: 'bar' }, { transaction: t }).success(function() {
                  User.all().success(function(users1) {
                    User.all({ transaction: t }).success(function(users2) {
                      expect(users1[0].username).to.equal('foo')
                      expect(users2[0].username).to.equal('bar')
                      t.rollback().success(function(){ done() })
                    })
                  })
                })
              })
            })
          })
        })
      })
    }

    it("updates attributes in the database", function(done) {
      this.User.create({ username: 'user' }).success(function(user) {
        expect(user.username).to.equal('user')
        user.updateAttributes({ username: 'person' }).success(function(user) {
          expect(user.username).to.equal('person')
          done()
        })
      })
    })

    it("ignores unknown attributes", function(done) {
      this.User.create({ username: 'user' }).success(function(user) {
        user.updateAttributes({ username: 'person', foo: 'bar'}).success(function(user) {
          expect(user.username).to.equal('person')
          expect(user.foo).not.to.exist
          done()
        })
      })
    })

    it("doesn't update primary keys or timestamps", function(done) {
      var User = this.sequelize.define('User' + config.rand(), {
        name: DataTypes.STRING,
        bio: DataTypes.TEXT,
        identifier: {type: DataTypes.STRING, primaryKey: true}
      })

      User.sync({ force: true }).success(function(){
        User.create({
          name: 'snafu',
          identifier: 'identifier'
        }).success(function(user) {
          var oldCreatedAt  = user.createdAt
            , oldUpdatedAt  = user.updatedAt
            , oldIdentifier = user.identifier

          setTimeout(function () {
            user.updateAttributes({
              name: 'foobar',
              createdAt: new Date(2000, 1, 1),
              identifier: 'another identifier'
            }).success(function(user) {
              expect(new Date(user.createdAt)).to.equalDate(new Date(oldCreatedAt))
              expect(new Date(user.updatedAt)).to.not.equalTime(new Date(oldUpdatedAt))
              expect(user.identifier).to.equal(oldIdentifier)
              done()
            })
          }, 1000)
        })
      })
    })

    it("uses primary keys in where clause", function(done) {
      var User = this.sequelize.define('User' + config.rand(), {
        name: DataTypes.STRING,
        bio: DataTypes.TEXT,
        identifier: {type: DataTypes.STRING, primaryKey: true}
      })

      User.sync({ force: true }).success(function(){
        User.create({
          name: 'snafu',
          identifier: 'identifier'
        }).success(function(user) {
          var emitter = user.updateAttributes({name: 'foobar'})
          emitter.on('sql', function(sql) {
            expect(sql).to.match(/WHERE [`"]identifier[`"]..identifier./)
            done()
          })
        })
      })
    })

    it('stores and restores null values', function(done) {
      var Download = this.sequelize.define('download', {
        startedAt: DataTypes.DATE,
        canceledAt: DataTypes.DATE,
        finishedAt: DataTypes.DATE
      })

      Download.sync().success(function() {
        Download.create({
          startedAt: new Date()
        }).success(function(download) {
          expect(download.startedAt instanceof Date).to.be.true
          expect(download.canceledAt).to.not.be.ok
          expect(download.finishedAt).to.not.be.ok

          download.updateAttributes({
            canceledAt: new Date()
          }).success(function(download) {
            expect(download.startedAt instanceof Date).to.be.true
            expect(download.canceledAt instanceof Date).to.be.true
            expect(download.finishedAt).to.not.be.ok

            Download.all({
              where: (dialect === 'postgres' || dialect === 'mssql' ? '"finishedAt" IS NULL' : "`finishedAt` IS NULL")
            }).success(function(downloads) {
              downloads.forEach(function(download) {
                expect(download.startedAt instanceof Date).to.be.true
                expect(download.canceledAt instanceof Date).to.be.true
                expect(download.finishedAt).to.not.be.ok
                done()
              })
            })
          })
        })
      })
    })
  })

  describe('destroy', function() {
    if (current.dialect.supports.transactions) {
      it('supports transactions', function(done) {
        Support.prepareTransactionTest(this.sequelize, function(sequelize) {
          var User = sequelize.define('User', { username: Support.Sequelize.STRING })

          User.sync({ force: true }).success(function() {
            User.create({ username: 'foo' }).success(function(user) {
              sequelize.transaction().then(function(t) {
                user.destroy({ transaction: t }).success(function() {
                  User.count().success(function(count1) {
                    User.count({ transaction: t }).success(function(count2) {
                      expect(count1).to.equal(1)
                      expect(count2).to.equal(0)
                      t.rollback().success(function() { done() })
                    })
                  })
                })
              })
            })
          })
        })
      })
    }

    it('deletes a record from the database if dao is not paranoid', function(done) {
      var UserDestroy = this.sequelize.define('UserDestroy', {
          name: Support.Sequelize.STRING,
          bio: Support.Sequelize.TEXT
        })

      UserDestroy.sync({ force: true }).success(function() {
        UserDestroy.create({name: 'hallo', bio: 'welt'}).success(function(u) {
          UserDestroy.all().success(function(users) {
            expect(users.length).to.equal(1)
            u.destroy().success(function() {
              UserDestroy.all().success(function(users) {
                expect(users.length).to.equal(0)
                done()
              })
            })
          })
        })
      })
    })

    it('allows sql logging of delete statements', function(done) {
      var UserDelete = this.sequelize.define('UserDelete', {
          name: Support.Sequelize.STRING,
          bio: Support.Sequelize.TEXT
        })

      UserDelete.sync({ force: true }).success(function() {
        UserDelete.create({name: 'hallo', bio: 'welt'}).success(function(u) {
          UserDelete.all().success(function(users) {
            expect(users.length).to.equal(1)
            u.destroy().on('sql', function(sql) {
              expect(sql).to.exist
              expect(sql.toUpperCase().indexOf("DELETE")).to.be.above(-1)
              done()
            })
          })
        })
      })
    })
  })

  describe("restore", function(){
    it("returns an error if the model is not paranoid", function(){
      var self = this;

      return this.User.create({username : "Peter", secretValue : "42"})
      .then(function(user){
        expect(function(){user.restore();}).to.throw(Error, "Model is not paranoid");
      })
    })

    it("restores a previously deleted model", function(){
      var self = this
        , ParanoidUser = self.sequelize.define('ParanoidUser', {
          username:     DataTypes.STRING,
          secretValue:  DataTypes.STRING,
          data:         DataTypes.STRING,
          intVal:       { type: DataTypes.INTEGER, defaultValue: 1}
        }, {
            paranoid: true
          })
        , data = [{ username: 'Peter', secretValue: '42' },
                  { username: 'Paul',  secretValue: '43' },
                  { username: 'Bob',   secretValue: '44' }]

      return ParanoidUser.sync({ force: true }).then(function() {
        return ParanoidUser.bulkCreate(data)
      }).then(function() {
        return ParanoidUser.find({where : {secretValue : "42"}});
      }).then(function(user){
        return user.destroy()
        .then(function(){
          return user.restore();
        });
      }).then(function() {
        return ParanoidUser.find({where : {secretValue : "42"}})
      }).then(function(user){
        expect(user).to.be.ok
        expect(user.username).to.equal("Peter")
      })
    })
  })
})
