var chai      = require('chai')
  , expect    = chai.expect
  , Support   = require(__dirname + '/support')
  , DataTypes = require(__dirname + "/../lib/data-types")
  , dialect   = Support.getTestDialect()
  , _         = require('lodash')

chai.Assertion.includeStack = true

describe(Support.getTestDialectTeaser("Promise"), function () {
  beforeEach(function(done) {
    this.User = this.sequelize.define('User', {
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
        validate: {len: {msg: 'Length failed.', args: [1, 20]}}
      },

      dateAllowNullTrue: {
        type: DataTypes.DATE,
        allowNull: true
      }
    })

    this.User.sync({ force: true }).then(function() { done() })
  })

  describe('increment', function () {
    beforeEach(function(done) {
      this.User.create({ id: 1, aNumber: 0, bNumber: 0 }).done(done)
    })

    it('with array', function(done) {
      var self = this

      this.User
        .find(1)
        .then(function(user) {
          expect(user.id).to.equal(1)
          return user.increment(['aNumber'], 2)
        })
        .then(function(user) {
          // The following assertion would rock hard, but it's not implemented :(
          // expect(user.aNumber).to.equal(2)
          return self.User.find(1)
        })
        .then(function(user) {
          expect(user.aNumber).to.equal(2)
          done()
        })
    });

    it('should still work right with other concurrent updates', function(done) {
      var self = this

      // Select something
      this.User
        .find(1)
        .then(function (user1) {
        // Select the user again (simulating a concurrent query)
          return self.User.find(1)
            .then(function (user2) {
              return user2
                .updateAttributes({ aNumber: user2.aNumber + 1 })
                .then(function() { return user1.increment(['aNumber'], 2) })
                .then(function() { return self.User.find(1) })
                .then(function(user5) {
                  expect(user5.aNumber).to.equal(3)
                  done()
                })
            })
        })
    })

    it('with key value pair', function(done) {
      var self = this

      this.User
        .find(1)
        .then(function(user1) {
          return user1.increment({ 'aNumber': 1, 'bNumber': 2})
        })
        .then(function () {
          return self.User.find(1)
        })
        .then(function (user3) {
          expect(user3.aNumber).to.equal(1)
          expect(user3.bNumber).to.equal(2)
          done()
        })
    })
  })

  describe('decrement', function () {
    beforeEach(function (done) {
      this.User.create({ id: 1, aNumber: 0, bNumber: 0 }).done(done)
    })

    it('with array', function(done) {
      var self = this

      this.User
        .find(1)
        .then(function(user1) {
          return user1.decrement(['aNumber'], 2)
        })
        .then(function(user2) {
          return self.User.find(1)
        })
        .then(function(user3) {
          expect(user3.aNumber).to.equal(-2)
          done()
        })
    })

    it('with single field', function(done) {
      var self = this

      this.User
        .find(1)
        .then(function(user1) {
          return user1.decrement(['aNumber'], 2)
        })
        .then(function(user3) {
          return self.User.find(1)
        })
        .then(function (user3) {
          expect(user3.aNumber).to.equal(-2)
          done()
        })
    })

    it('should still work right with other concurrent decrements', function(done) {
      var self = this

      this.User
        .find(1)
        .then(function(user1) {
          var _done = _.after(3, function() {
            self.User
              .find(1)
              .then(function(user2) {
                expect(user2.aNumber).to.equal(-6)
                done()
              })
          })

          user1.decrement(['aNumber'], 2).done(_done)
          user1.decrement(['aNumber'], 2).done(_done)
          user1.decrement(['aNumber'], 2).done(_done)
        })
      })
  })

  describe('reload', function () {
    it("should return a reference to the same DAO instead of creating a new one", function(done) {
      this.User
        .create({ username: 'John Doe' })
        .then(function(originalUser) {
          return originalUser
            .updateAttributes({ username: 'Doe John' })
            .then(function () {
              return originalUser.reload()
            })
            .then(function(updatedUser) {
              expect(originalUser === updatedUser).to.be.true
              done()
            })
        })
    })

    it("should update the values on all references to the DAO", function(done) {
      var self = this

      this.User
        .create({ username: 'John Doe' })
        .then(function(originalUser) {
          return self.User
            .find(originalUser.id)
            .then(function(updater) {
              return updater.updateAttributes({ username: 'Doe John' })
            })
            .then(function () {
              // We used a different reference when calling updateAttributes, so originalUser is now out of sync
              expect(originalUser.username).to.equal('John Doe')
              return originalUser.reload()
            }).then(function(updatedUser) {
              expect(originalUser.username).to.equal('Doe John')
              expect(updatedUser.username).to.equal('Doe John')
              done()
            })
      })
    })


    it("should update the associations as well", function (done) {
      var Book = this.sequelize.define('Book', { title:   DataTypes.STRING })
        , Page = this.sequelize.define('Page', { content: DataTypes.TEXT })

      Book.hasMany(Page)
      Page.belongsTo(Book)

      Book
        .sync({ force: true })
        .then(function() {
          Page
            .sync({ force: true })
            .then(function() {
              return Book.create({ title: 'A very old book' })
            })
            .then(function (book) {
              return Page
                .create({ content: 'om nom nom' })
                .then(function(page) {
                  return book
                    .setPages([ page ])
                    .then(function() {
                      return Book
                        .find({
                          where: (dialect === 'postgres' ? '"Books"."id"=' : '`Books`.`id`=') + book.id,
                          include: [Page]
                        })
                        .then(function (leBook) {
                          return page
                            .updateAttributes({ content: 'something totally different' })
                            .then(function (page) {
                              expect(leBook.pages[0].content).to.equal('om nom nom')
                              expect(page.content).to.equal('something totally different')

                              return leBook
                                .reload()
                                .then(function (leBook) {
                                  expect(leBook.pages[0].content).to.equal('something totally different')
                                  expect(page.content).to.equal('something totally different')
                                  done()
                              })
                            })
                        })
                    })
            })
        }, done)
      })
    })
  })

  describe('complete', function () {
    it("gets triggered if an error occurs", function(done) {
      this.User.find({ where: "asdasdasd" }).then(null, function(err) {
        expect(err).to.be.ok
        expect(err.message).to.be.ok
        done()
      })
    })

    it("gets triggered if everything was ok", function(done) {
      this.User.count().then(function(result) {
        expect(result).to.not.be.undefined
        done()
      })
    })
  })

  describe('save', function () {
    it('should fail a validation upon creating', function(done) {
      this.User.create({aNumber: 0, validateTest: 'hello'}).then(null, function(err) {
        expect(err).to.be.ok
        expect(err).to.be.an("object")
        expect(err.validateTest).to.be.an("array")
        expect(err.validateTest[0]).to.be.ok
        expect(err.validateTest[0].indexOf('Invalid integer')).to.be.greaterThan(-1)
        done()
      });
    })

    it('should fail a validation upon building', function(done) {
      this.User.build({aNumber: 0, validateCustom: 'aaaaaaaaaaaaaaaaaaaaaaaaaa'}).save()
      .then(null, function(err) {
        expect(err).to.be.ok
        expect(err).to.be.an("object")
        expect(err.validateCustom).to.be.ok
        expect(err.validateCustom).to.be.an("array")
        expect(err.validateCustom[0]).to.be.ok
        expect(err.validateCustom[0]).to.equal('Length failed.')
        done()
      })
    })

    it('should fail a validation when updating', function(done) {
      this.User.create({aNumber: 0}).then(function (user) {
        return user.updateAttributes({validateTest: 'hello'})
      }).then(null, function(err) {
        expect(err).to.be.ok
        expect(err).to.be.an("object")
        expect(err.validateTest).to.be.ok
        expect(err.validateTest).to.be.an("array")
        expect(err.validateTest[0]).to.be.ok
        expect(err.validateTest[0].indexOf('Invalid integer')).to.be.greaterThan(-1)
        done()
      })
    })
  })
})
