if(typeof require === 'function') {
  const buster  = require("buster")
      , Helpers = require('./buster-helpers')
      , dialect = Helpers.getTestDialect()
      , _ = require('underscore')
}

buster.spec.expose()

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
          bNumber:   { type: DataTypes.INTEGER }
        })

        self.HistoryLog = sequelize.define('HistoryLog', {
          someText:  { type: DataTypes.STRING },
          aNumber:   { type: DataTypes.INTEGER },
          aRandomId: { type: DataTypes.INTEGER }
        })
      },
      onComplete: function() {
        self.User.sync({ force: true }).success(function(){
          self.HistoryLog.sync({ force: true }).success(done)
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
      }, {
        timestamps: false,
        logging: true
      })

      this.User.sync({ force: true }).success(done)
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
  })
})
