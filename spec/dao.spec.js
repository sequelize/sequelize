if (typeof require === 'function') {
  const buster  = require("buster")
      , Helpers = require('./buster-helpers')
      , dialect = Helpers.getTestDialect()
      , _ = require('lodash')
}

buster.spec.expose()
buster.testRunner.timeout = 1000

describe(Helpers.getTestDialectTeaser("DAO"), function() {
  before(function(done) {
    var self = this

    Helpers.initTests({
      dialect: dialect,
      beforeComplete: function(sequelize, DataTypes) {
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
            validate: {len: {msg: 'Length failed.', args: [1,20]}}
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

        self.ParanoidUser.hasOne( self.ParanoidUser )
      },
      onComplete: function() {
        self.User.sync({ force: true }).success(function(){
          self.HistoryLog.sync({ force: true }).success(function(){
            self.ParanoidUser.sync({force: true }).success(done)
          })
        })
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
      this.User.find(1).done(function (err, user1) {
        user1.increment(['aNumber'], 2).done(function (err, user2) {

          self.User.find(1).done(function (err, user3) {
            expect(user3.aNumber).toBe(2);
            done();
          });
        });
      });
    });

    it('with single field', function (done) {
      var self = this;

      // Select something
      this.User.find(1).done(function (err, user1) {
        user1.increment('aNumber', 2).done(function (err, user2) {

          self.User.find(1).done(function (err, user3) {
            expect(user3.aNumber).toBe(2);
            done();
          });
        });
      });
    });

    it('should still work right with other concurrent updates', function (done) {
      var self = this;
      // Select something
      this.User.find(1).done(function (err, user1) {
        // Select the user again (simulating a concurrent query)
        self.User.find(1).done(function (err, user2) {
          user2.updateAttributes({
            aNumber: user2.aNumber + 1
          }).done(function (err, user3) {
            user1.increment(['aNumber'], 2).done(function (err, user4) {

              self.User.find(1).done(function (err, user5) {
                expect(user5.aNumber).toBe(3);
                done();
              });
            });
          });
        });
      });
    });

    it('should still work right with other concurrent increments', function (done) {
      var self = this;
      // Select something
      this.User.find(1).done(function (err, user1) {
        var _done = _.after(3, function () {
          self.User.find(1).done(function (err, user2) {
            expect(user2.aNumber).toEqual(6);
            done();
          })
        });

        user1.increment(['aNumber'], 2).done(_done);
        user1.increment(['aNumber'], 2).done(_done);
        user1.increment(['aNumber'], 2).done(_done);
      });
    });

    it('with key value pair', function (done) {
      var self = this;

      // Select something
      this.User.find(1).done(function (err, user1) {
        user1.increment({ 'aNumber': 1, 'bNumber': 2}).done(function (err, user2) {

          self.User.find(1).done(function (err, user3) {
            expect(user3.aNumber).toBe(1);
            expect(user3.bNumber).toBe(2);
            done();
          });
        });
      });
    });
  });

  describe('decrement', function () {
    before(function (done) {
      this.User.create({ id: 1, aNumber: 0, bNumber: 0 }).done(done)
    });

    it('with array', function (done) {
      var self = this;

      // Select something
      this.User.find(1).done(function (err, user1) {
        user1.decrement(['aNumber'], 2).done(function (err, user2) {

          self.User.find(1).done(function (err, user3) {
            expect(user3.aNumber).toBe(-2);
            done();
          });
        });
      });
    });

    it('with single field', function (done) {
      var self = this;

      // Select something
      this.User.find(1).done(function (err, user1) {
        user1.decrement('aNumber', 2).done(function (err, user2) {

          self.User.find(1).done(function (err, user3) {
            expect(user3.aNumber).toBe(-2);
            done();
          });
        });
      });
    });

    it('should still work right with other concurrent updates', function (done) {
      var self = this;
      // Select something
      this.User.find(1).done(function (err, user1) {
        // Select the user again (simulating a concurrent query)
        self.User.find(1).done(function (err, user2) {
          user2.updateAttributes({
            aNumber: user2.aNumber + 1
          }).done(function (err, user3) {
            user1.decrement(['aNumber'], 2).done(function (err, user4) {

              self.User.find(1).done(function (err, user5) {
                expect(user5.aNumber).toBe(-1);
                done();
              });
            });
          });
        });
      });
    });

    it('should still work right with other concurrent increments', function (done) {
      var self = this;
      // Select something
      this.User.find(1).done(function (err, user1) {
        var _done = _.after(3, function () {
          self.User.find(1).done(function (err, user2) {
            expect(user2.aNumber).toEqual(-6);
            done();
          })
        });

        user1.decrement(['aNumber'], 2).done(_done);
        user1.decrement(['aNumber'], 2).done(_done);
        user1.decrement(['aNumber'], 2).done(_done);
      });
    });

    it('with key value pair', function (done) {
      var self = this;

      // Select something
      this.User.find(1).done(function (err, user1) {
        user1.decrement({ 'aNumber': 1, 'bNumber': 2}).done(function (err, user2) {

          self.User.find(1).done(function (err, user3) {
            expect(user3.aNumber).toBe(-1);
            expect(user3.bNumber).toBe(-2);
            done();
          });
        });
      });
    });
  });

  describe('reload', function () {
    it("should return a reference to the same DAO instead of creating a new one", function (done) {
      this.User.create({ username: 'John Doe' }).done(function (err, originalUser) {

        originalUser.updateAttributes({ username: 'Doe John' }).done(function () {
          originalUser.reload().done(function (err, updatedUser) {
            expect(originalUser === updatedUser).toBeTrue()
            done();
          })
        })
      })
    })

    it("should update the values on all references to the DAO", function (done) {
      var self = this

      this.User.create({ username: 'John Doe' }).done(function (err, originalUser) {
        self.User.find(originalUser.id).done(function (err, updater) {
          updater.updateAttributes({ username: 'Doe John' }).done(function () {
            // We used a different reference when calling updateAttributes, so originalUser is now out of sync
            expect(originalUser.username).toEqual('John Doe')

            originalUser.reload().done(function (err, updatedUser) {
              expect(originalUser.username).toEqual('Doe John')
              expect(updatedUser.username).toEqual('Doe John')

              done();
            })
          })
        })
      })
    })

    it("should update read only attributes as well (updatedAt)", function (done) {
      var self = this
      this.timeout = 2000;

      this.User.create({ username: 'John Doe' }).done(function (err, originalUser) {
        var originallyUpdatedAt = originalUser.updatedAt

        // Wait for a second, so updatedAt will actually be different
        setTimeout(function () {
          self.User.find(originalUser.id).done(function (err, updater) {
            updater.updateAttributes({ username: 'Doe John' }).done(function () {
              originalUser.reload().done(function (err, updatedUser) {
                expect(originalUser.updatedAt).toBeGreaterThan(originallyUpdatedAt)
                expect(updatedUser.updatedAt).toBeGreaterThan(originallyUpdatedAt)

                done();
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

      this.sequelize.sync({ force: true }).success(function() {
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
        }.bind(this))
      }.bind(this))
    })
  });

  describe('default values', function() {
    describe('current date', function() {
      it('should store a date in touchedAt', function() {
        var user = this.User.build({ username: 'a user'})
        expect(user.touchedAt instanceof Date).toBeTrue()
      })

      it("should store the current date in touchedAt", function() {
        this.useFakeTimers().tick(5000)

        var user = this.User.build({ username: 'a user'})
        expect(+user.touchedAt).toBe(5000)
      })
    })

    describe('allowNull date', function() {
      it('should be just "null" and not Date with Invalid Date', function(done) {
        var self = this;
        this.User.build({ username: 'a user'}).save().success(function() {
          self.User.find({where: {username: 'a user'}}).success(function(user) {
            expect(user.dateAllowNullTrue).toBe(null)
            done()
          })
        })
      })

      it('should be the same valid date when saving the date', function(done) {
        var self = this;
        var date = new Date();
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
      this.User.find({ where: "asdasdasd" }).complete(function(err, result) {
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
    it('should fail a validation upon creating', function(done){
      this.User.create({aNumber: 0, validateTest: 'hello'}).error(function(err){
        expect(err).toBeDefined()
        expect(err).toBeObject()
        expect(err.validateTest).toBeArray()
        expect(err.validateTest[0]).toBeDefined()
        expect(err.validateTest[0].indexOf('Invalid integer')).toBeGreaterThan(-1);
        done();
      });
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
          expect(err.validateTest[0].indexOf('Invalid integer')).toBeGreaterThan(-1)
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
      this.HistoryLog.create({ someText: 'Some random text', aNumber: 3, aRandomId: 5 }).success(function(log) {
        log.updateAttributes({ aNumber: 5 }).success(function(newLog){
          expect(newLog.aNumber).toEqual(5)
          done()
        })
      })
    })
  })

  describe('toJSON', function toJSON() {
    before(function(done) {
      this.User = this.sequelize.define('UserWithUsernameAndAgeAndIsAdmin', {
        username: Helpers.Sequelize.STRING,
        age:      Helpers.Sequelize.INTEGER,
        isAdmin:  Helpers.Sequelize.BOOLEAN
      }, { timestamps: false })

      this.Project = this.sequelize.define('NiceProject', { title: Helpers.Sequelize.STRING }, { timestamps: false })

      this.User.hasMany(this.Project, { as: 'Projects' })
      this.Project.belongsTo(this.User, { as: 'LovelyUser' })

      this.sequelize.sync({ force: true }).success(done)
    })

    it('returns an object containing all values', function() {
      var user = this.User.build({ username: 'test.user', age: 99, isAdmin: true })
      expect(user.toJSON()).toEqual({ username: 'test.user', age: 99, isAdmin: true, id: null })
    })

    it('returns a response that can be stringified', function() {
      var user = this.User.build({ username: 'test.user', age: 99, isAdmin: true })
      expect(JSON.stringify(user)).toEqual('{"username":"test.user","age":99,"isAdmin":true,"id":null}')
    })

    it('returns a response that can be stringified and then parsed', function() {
      var user = this.User.build({ username: 'test.user', age: 99, isAdmin: true })
      expect(JSON.parse(JSON.stringify(user))).toEqual({ username: 'test.user', age: 99, isAdmin: true, id: null })
    })

    it('includes the eagerly loaded associations', function(done) {
      this.User.create({ username: 'fnord', age: 1, isAdmin: true }).success(function(user) {
        this.Project.create({ title: 'fnord' }).success(function(project) {
          user.setProjects([ project ]).success(function() {
            this.User.findAll({include: [ { model: this.Project, as: 'Projects' } ]}).success(function(users) {
              var _user = users[0]

              expect(_user.projects).toBeDefined()
              expect(JSON.parse(JSON.stringify(_user)).projects).toBeDefined()

              this.Project.findAll({include: [ { model: this.User, as: 'LovelyUser' } ]}).success(function(projects) {
                var _project = projects[0]

                expect(_project.lovelyUser).toBeDefined()
                expect(JSON.parse(JSON.stringify(_project)).lovelyUser).toBeDefined()

                done()
              })
            }.bind(this))
          }.bind(this))
        }.bind(this))
      }.bind(this))
    })
  })

  describe('findAll', function findAll() {
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
      this.User.create({ username: 'fnord' }).success(function() {
        this.User.findAll().success(function(users) {
          expect(users[0].createdAt).toBeDefined()
          done()
        }.bind(this))
      }.bind(this))
    })

    it("does not return the timestamps if the username attribute has been specified", function(done) {
      this.User.create({ username: 'fnord' }).success(function() {
        this.User.findAll({ attributes: ['username'] }).success(function(users) {
          expect(users[0].createdAt).not.toBeDefined()
          expect(users[0].username).toBeDefined()

          done()
        }.bind(this))
      }.bind(this))
    })

    it("creates the deletedAt property, when defining paranoid as true", function(done) {
      this.ParanoidUser.create({ username: 'fnord' }).success(function() {
        this.ParanoidUser.findAll().success(function(users) {
          expect(users[0].deletedAt).toBeDefined()
          expect(users[0].deletedAt).toBe(null)
          done()
        }.bind(this))
      }.bind(this))
    })

    it("sets deletedAt property to a specific date when deleting an instance", function(done) {
      this.ParanoidUser.create({ username: 'fnord' }).success(function() {
        this.ParanoidUser.findAll().success(function(users) {
          users[0].destroy().success(function(user) {
            expect(user.deletedAt.getMonth).toBeDefined()
            done()
          }.bind(this))
        }.bind(this))
      }.bind(this))
    })

    it("keeps the deletedAt-attribute with value null, when running updateAttributes", function(done) {
      this.ParanoidUser.create({ username: 'fnord' }).success(function() {
        this.ParanoidUser.findAll().success(function(users) {
          users[0].updateAttributes({username: 'newFnord'}).success(function(user) {
            expect(user.deletedAt).toBe(null)
            done()
          }.bind(this))
        }.bind(this))
      }.bind(this))
    })

    it("keeps the deletedAt-attribute with value null, when updating associations", function(done) {
      this.ParanoidUser.create({ username: 'fnord' }).success(function() {
        this.ParanoidUser.findAll().success(function(users) {
          this.ParanoidUser.create({ username: 'linkedFnord' }).success(function( linkedUser ) {
            users[0].setParanoidUser( linkedUser ).success(function(user) {
              expect(user.deletedAt).toBe(null)
              done()
            }.bind(this))
          }.bind(this))
        }.bind(this))
      }.bind(this))
    })

    it("can reuse query option objects", function(done) {
      this.User.create({ username: 'fnord' }).success(function() {
        var query = { where: { username: 'fnord' }}

        this.User.findAll(query).success(function(users) {
          expect(users[0].username).toEqual('fnord')

          this.User.findAll(query).success(function(users) {
            expect(users[0].username).toEqual('fnord')
            done()
          }.bind(this))
        }.bind(this))
      }.bind(this))
    })
  })

  describe('find', function find() {
    it("can reuse query option objects", function(done) {
      this.User.create({ username: 'fnord' }).success(function() {
        var query = { where: { username: 'fnord' }}

        this.User.find(query).success(function(user) {
          expect(user.username).toEqual('fnord')

          this.User.find(query).success(function(user) {
            expect(user.username).toEqual('fnord')
            done()
          }.bind(this))
        }.bind(this))
      }.bind(this))
    })
  })

  describe('equals', function find() {
    it("can compare records with Date field", function(done) {
      this.User.create({ username: 'fnord' }).success(function(user1) {
        var query = { where: { username: 'fnord' }}

        this.User.find(query).success(function(user2) {
          expect(user1.equals(user2)).toBeTrue()
          done()
        }.bind(this))
      }.bind(this))
    })
  })

  describe('updateAttributes', function() {
    it('stores and restores null values', function(done) {
      var Download = this.sequelize.define('download', {
        startedAt: Helpers.Sequelize.DATE,
        canceledAt: Helpers.Sequelize.DATE,
        finishedAt: Helpers.Sequelize.DATE
      })

      Download.sync({ force: true }).success(function() {
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
