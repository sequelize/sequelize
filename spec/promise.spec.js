if (typeof require === 'function') {
  const buster  = require("buster")
      , Helpers = require('./buster-helpers')
      , dialect = Helpers.getTestDialect()
      , _ = require('lodash')
}

buster.spec.expose()

describe(Helpers.getTestDialectTeaser("Promise"), function () {
  before(function (done) {
    var self = this

    Helpers.initTests({
      dialect: dialect,
      beforeComplete: function (sequelize, DataTypes) {
        self.sequelize = sequelize
        self.User      = sequelize.define('User', {
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

        self.HistoryLog = sequelize.define('HistoryLog', {
          someText:  { type: DataTypes.STRING },
          aNumber:   { type: DataTypes.INTEGER },
          aRandomId: { type: DataTypes.INTEGER }
        })

        self.ParanoidUser = sequelize.define('ParanoidUser', {
          username: { type: DataTypes.STRING }
        }, {
          paranoid: true
        })

        self.ParanoidUser.hasOne(self.ParanoidUser)
      },
      onComplete: function () {
        self.User.sync({ force: true }).then(function () {
            return self.HistoryLog.sync({ force: true })
          }).then(function () {
            return self.ParanoidUser.sync({force: true })
          })
          .then(function () {done()}, done)
      }
    })
  })

  describe('increment', function () {
    before(function (done) {
      this.User.create({ id: 1, aNumber: 0, bNumber: 0 }).done(done)
    });

    it('with array', function (done) {
      var self = this;

      // Select something
      this.User.find(1).then(function (user1) {
        return user1.increment(['aNumber'], 2)
      }).then(function (user2) {
        return self.User.find(1)
      }).then(function (user3) {
        expect(user3.aNumber).toBe(2);
        done();
      }, done);
    });

    it('should still work right with other concurrent updates', function (done) {
      var self = this;
      // Select something
      this.User.find(1).then(function (user1) {
        // Select the user again (simulating a concurrent query)
        return self.User.find(1).then(function (user2) {
          return user2.updateAttributes({
            aNumber: user2.aNumber + 1
          }).then(function (user3) {
            return user1.increment(['aNumber'], 2)
          }).then(function (user4) {
            return self.User.find(1)
          }).then(function (user5) {
            expect(user5.aNumber).toBe(3);
            done();
          }, done)
        });
      });
    });

    it('with key value pair', function (done) {
      var self = this;

      // Select something
      this.User.find(1).then(function (user1) {
        return user1.increment({ 'aNumber': 1, 'bNumber': 2})
      }).then(function () {
        return self.User.find(1)
      }).then(function (user3) {
        expect(user3.aNumber).toBe(1);
        expect(user3.bNumber).toBe(2);
        done();
      }, done);
    });
  });

  describe('decrement', function () {
    before(function (done) {
      this.User.create({ id: 1, aNumber: 0, bNumber: 0 }).done(done)
    });

    it('with array', function (done) {
      var self = this;

      // Select something
      this.User.find(1).then(function (user1) {
        return user1.decrement(['aNumber'], 2)
      }).then(function () {
        return self.User.find(1);
      }).then(function (user3) {
        expect(user3.aNumber).toBe(-2);
        done();
      }, done);
    });

    it('with single field', function (done) {
      var self = this;

      // Select something
      this.User.find(1).then(function (user1) {
        return user1.decrement(['aNumber'], 2)
      }).then(function () {
        return self.User.find(1);
      }).then(function (user3) {
        expect(user3.aNumber).toBe(-2);
        done();
      }, done);
    });

    it('should still work right with other concurrent decrements', function (done) {
      var self = this;
      // Select something
      this.User.find(1).then(function (user1) {
        var _done = _.after(3, function () {
          self.User.find(1).then(function (user2) {
            expect(user2.aNumber).toEqual(-6);
            done();
          })
        });

        user1.decrement(['aNumber'], 2).done(_done);
        user1.decrement(['aNumber'], 2).done(_done);
        user1.decrement(['aNumber'], 2).done(_done);
      });
    });
  });

  describe('reload', function () {
    it("should return a reference to the same DAO instead of creating a new one", function (done) {
      this.User.create({ username: 'John Doe' }).then(function (originalUser) {

        return originalUser.updateAttributes({ username: 'Doe John' }).then(function () {
          return originalUser.reload()
        }).then(function (updatedUser) {
          expect(originalUser === updatedUser).toBeTrue()
          done();
        }, done)
      })
    })

    it("should update the values on all references to the DAO", function (done) {
      var self = this

      this.User.create({ username: 'John Doe' }).then(function (originalUser) {
        return self.User.find(originalUser.id).then(function (updater) {
          return updater.updateAttributes({ username: 'Doe John' })
        }).then(function () {
          // We used a different reference when calling updateAttributes, so originalUser is now out of sync
          expect(originalUser.username).toEqual('John Doe')
          return originalUser.reload()
        }).then(function (updatedUser) {
          expect(originalUser.username).toEqual('Doe John')
          expect(updatedUser.username).toEqual('Doe John')

          done();
        }, done)
      })
    })


    it("should update the associations as well", function (done) {
      var Book = this.sequelize.define('Book', { title:   Helpers.Sequelize.STRING })
        , Page = this.sequelize.define('Page', { content: Helpers.Sequelize.TEXT })

      Book.hasMany(Page)
      Page.belongsTo(Book)

      this.sequelize.sync({ force: true }).then(function () {
        return Book.create({ title: 'A very old book' })
      }).then(function (book) {
        return Page.create({ content: 'om nom nom' }).then(function (page) {
          return book.setPages([ page ]).then(function () {
            return Book.find({
              where: (dialect === 'postgres' ? '"Books"."id"=' : '`Books`.`id`=') + book.id,
              include: [Page]
            }).then(function (leBook) {
              return page.updateAttributes({ content: 'something totally different' }).then(function (page) {
                expect(leBook.pages[0].content).toEqual('om nom nom')
                expect(page.content).toEqual('something totally different')

                return leBook.reload().then(function (leBook) {
                  expect(leBook.pages[0].content).toEqual('something totally different')
                  expect(page.content).toEqual('something totally different')

                  done()
                })
              })
            })
          })
        })
      }, done)
    })
  });

  describe('complete', function () {
    it("gets triggered if an error occurs", function (done) {
      this.User.find({ where: "asdasdasd" }).then(null, function (err) {
        expect(err).toBeDefined()
        expect(err.message).toBeDefined()
        done()
      })
    })

    it("gets triggered if everything was ok", function (done) {
      this.User.count().then(function (result) {
        expect(result).toBeDefined()
        done()
      })
    })
  })

  describe('save', function () {
    it('should fail a validation upon creating', function (done) {
      this.User.create({aNumber: 0, validateTest: 'hello'}).then(null, function (err) {
        expect(err).toBeDefined()
        expect(err).toBeObject()
        expect(err.validateTest).toBeArray()
        expect(err.validateTest[0]).toBeDefined()
        expect(err.validateTest[0].indexOf('Invalid integer')).toBeGreaterThan(-1);
        done();
      });
    })

    it('should fail a validation upon building', function (done) {
      this.User.build({aNumber: 0, validateCustom: 'aaaaaaaaaaaaaaaaaaaaaaaaaa'}).save()
      .then(null, function (err) {
        expect(err).toBeDefined()
        expect(err).toBeObject()
        expect(err.validateCustom).toBeDefined()
        expect(err.validateCustom).toBeArray()
        expect(err.validateCustom[0]).toBeDefined()
        expect(err.validateCustom[0]).toEqual('Length failed.')
        done()
      })
    })

    it('should fail a validation when updating', function (done) {
      this.User.create({aNumber: 0}).then(function (user) {
        return user.updateAttributes({validateTest: 'hello'})
      }).then(null, function (err) {
        expect(err).toBeDefined()
        expect(err).toBeObject()
        expect(err.validateTest).toBeDefined()
        expect(err.validateTest).toBeArray()
        expect(err.validateTest[0]).toBeDefined()
        expect(err.validateTest[0].indexOf('Invalid integer')).toBeGreaterThan(-1)
        done()
      })
    })
  })
})
