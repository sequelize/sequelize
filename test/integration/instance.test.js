'use strict';

/* jshint -W030 */
/* jshint -W110 */
var chai = require('chai')
  , expect = chai.expect
  , Sequelize = require('../../index')
  , Support = require(__dirname + '/support')
  , DataTypes = require(__dirname + '/../../lib/data-types')
  , dialect = Support.getTestDialect()
  , config = require(__dirname + '/../config/config')
  , sinon = require('sinon')
  , uuid = require('node-uuid')
  , current = Support.sequelize;

describe(Support.getTestDialectTeaser('Instance'), function() {
  beforeEach(function() {
    this.User = this.sequelize.define('User', {
      username: { type: DataTypes.STRING },
      uuidv1: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV1 },
      uuidv4: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4 },
      touchedAt: { type: DataTypes.DATE, defaultValue: DataTypes.NOW },
      aNumber: { type: DataTypes.INTEGER },
      bNumber: { type: DataTypes.INTEGER },
      aDate: { type: DataTypes.DATE },

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
      },

      isSuperUser: {
        type: DataTypes.BOOLEAN,
        defaultValue: false
      }
    });
    return this.User.sync({ force: true });
  });

  describe('Escaping', function() {
    it('is done properly for special characters', function() {
      // Ideally we should test more: "\0\n\r\b\t\\\'\"\x1a"
      // But this causes sqlite to fail and exits the entire test suite immediately
      var bio = dialect + "'\"\n" // Need to add the dialect here so in case of failure I know what DB it failed for
        , self = this;

      return this.User.create({ username: bio }).then(function(u1) {
        return self.User.find(u1.id).then(function(u2) {
          expect(u2.username).to.equal(bio);
        });
      });
    });
  });

  describe('isNewRecord', function() {
    it('returns true for non-saved objects', function() {
      var user = this.User.build({ username: 'user' });
      expect(user.id).to.be.null;
      expect(user.isNewRecord).to.be.ok;
    });

    it('returns false for saved objects', function() {
      return this.User.build({ username: 'user' }).save().then(function(user) {
        expect(user.isNewRecord).to.not.be.ok;
      });
    });

    it('returns false for created objects', function() {
      return this.User.create({ username: 'user' }).then(function(user) {
        expect(user.isNewRecord).to.not.be.ok;
      });
    });

    it('returns false for objects found by find method', function() {
      var self = this;
      return this.User.create({ username: 'user' }).then(function() {
        return self.User.create({ username: 'user' }).then(function(user) {
          return self.User.find(user.id).then(function(user) {
            expect(user.isNewRecord).to.not.be.ok;
          });
        });
      });
    });

    it('returns false for objects found by findAll method', function() {
      var self = this
        , users = [];

      for (var i = 0; i < 10; i++) {
        users[users.length] = {username: 'user'};
      }

      return this.User.bulkCreate(users).then(function() {
        return self.User.findAll().then(function(users) {
          users.forEach(function(u) {
            expect(u.isNewRecord).to.not.be.ok;
          });
        });
      });
    });
  });

  describe('isDirty', function() {
    it('returns true for non-saved objects', function() {
      var user = this.User.build({ username: 'user' });
      expect(user.id).to.be.null;
      expect(user.isDirty).to.be.true;
    });

    it('returns false for saved objects', function() {
      return this.User.build({ username: 'user' }).save().then(function(user) {
        expect(user.isDirty).to.be.false;
      });
    });

    it('returns true for changed attribute', function() {
      return this.User.create({ username: 'user' }).then(function(user) {
        user.username = 'new';
        expect(user.isDirty).to.be.true;
      });
    });

    it('returns false for non-changed attribute', function() {
      return this.User.create({ username: 'user' }).then(function(user) {
        user.username = 'user';
        expect(user.isDirty).to.be.false;
      });
    });

    it('returns true for bulk changed attribute', function() {
      return this.User.create({ username: 'user' }).then(function(user) {
        user.setAttributes({
          username: 'new',
          aNumber: 1
        });
        expect(user.isDirty).to.be.true;
      });
    });

    it('returns false for bulk non-changed attribute + model with timestamps', function() {
      return this.User.create({ username: 'user' }).then(function(user) {
        user.setAttributes({
          username: 'user'
        });
        expect(user.isDirty).to.be.false;
      });
    });

    it('returns false for bulk non-changed attribute + model without timestamps', function() {
      var User = this.sequelize.define('User' + parseInt(Math.random() * 10000000), {
        username: DataTypes.STRING
      }, {
        timestamps: false
      });

      return User
        .sync({ force: true })
        .then(function() {
          return User.create({ username: 'user' });
        })
        .then(function(user) {
          user.setAttributes({ username: 'user' });
          expect(user.isDirty).to.be.false;
        });
    });

    it('returns true for changed and bulk non-changed attribute', function() {
      return this.User.create({ username: 'user' }).then(function(user) {
        user.aNumber = 23;
        user.setAttributes({
          username: 'user'
        });
        expect(user.isDirty).to.be.true;
      });
    });

    it('returns true for changed attribute and false for saved object', function() {
      return this.User.create({ username: 'user' }).then(function(user) {
        user.username = 'new';
        expect(user.isDirty).to.be.true;
        return user.save().then(function() {
          expect(user.isDirty).to.be.false;
        });
      });
    });

    it('returns false for created objects', function() {
      return this.User.create({ username: 'user' }).then(function(user) {
        expect(user.isDirty).to.be.false;
      });
    });

    it('returns false for objects found by find method', function() {
      var self = this;
      return this.User.create({ username: 'user' }).then(function(user) {
        return self.User.find(user.id).then(function(user) {
          expect(user.isDirty).to.be.false;
        });
      });
    });

    it('returns false for objects found by findAll method', function() {
      var self = this
        , users = [];

      for (var i = 0; i < 10; i++) {
        users[users.length] = {username: 'user'};
      }

      return this.User.bulkCreate(users).then(function() {
        return self.User.findAll().then(function(users) {
          users.forEach(function(u) {
            expect(u.isDirty).to.be.false;
          });
        });
      });
    });
  });

  describe('increment', function() {
    beforeEach(function() {
      return this.User.create({ id: 1, aNumber: 0, bNumber: 0 });
    });

    if (current.dialect.supports.transactions) {
      it('supports transactions', function() {
        return Support.prepareTransactionTest(this.sequelize).bind({}).then(function(sequelize) {
          var User = sequelize.define('User', { number: Support.Sequelize.INTEGER });

          return User.sync({ force: true }).then(function() {
            return User.create({ number: 1 }).then(function(user) {
              return sequelize.transaction().then(function(t) {
                return user.increment('number', { by: 2, transaction: t }).then(function() {
                  return User.findAll().then(function(users1) {
                    return User.findAll({ transaction: t }).then(function(users2) {
                      expect(users1[0].number).to.equal(1);
                      expect(users2[0].number).to.equal(3);
                      return t.rollback();
                    });
                  });
                });
              });
            });
          });
        });
      });
    }

    it('supports where conditions', function() {
      var self = this;
      return this.User.find(1).then(function(user1) {
        return user1.increment(['aNumber'], { by: 2, where: { bNumber: 1 } }).then(function() {
          return self.User.find(1).then(function(user3) {
            expect(user3.aNumber).to.be.equal(0);
          });
        });
      });
    });

    it('with array', function() {
      var self = this;
      return this.User.find(1).then(function(user1) {
        return user1.increment(['aNumber'], { by: 2 }).then(function() {
          return self.User.find(1).then(function(user3) {
            expect(user3.aNumber).to.be.equal(2);
          });
        });
      });
    });

    it('with single field', function() {
      var self = this;
      return this.User.find(1).then(function(user1) {
        return user1.increment('aNumber', { by: 2 }).then(function() {
          return self.User.find(1).then(function(user3) {
            expect(user3.aNumber).to.be.equal(2);
          });
        });
      });
    });

    it('with single field and no value', function() {
      var self = this;
      return this.User.find(1).then(function(user1) {
        return user1.increment('aNumber').then(function() {
          return self.User.find(1).then(function(user2) {
            expect(user2.aNumber).to.be.equal(1);
          });
        });
      });
    });

    it('should still work right with other concurrent updates', function() {
      var self = this;
      return this.User.find(1).then(function(user1) {
        // Select the user again (simulating a concurrent query)
        return self.User.find(1).then(function(user2) {
          return user2.updateAttributes({
            aNumber: user2.aNumber + 1
          }).then(function() {
            return user1.increment(['aNumber'], { by: 2 }).then(function() {
              return self.User.find(1).then(function(user5) {
                expect(user5.aNumber).to.be.equal(3);
              });
            });
          });
        });
      });
    });

    it('should still work right with other concurrent increments', function() {
      var self = this;
      return this.User.find(1).then(function(user1) {
        return this.sequelize.Promise.all([
          user1.increment(['aNumber'], { by: 2 }),
          user1.increment(['aNumber'], { by: 2 }),
          user1.increment(['aNumber'], { by: 2 })
        ]).then(function() {
          return self.User.find(1).then(function(user2) {
            expect(user2.aNumber).to.equal(6);
          });
        });
      });
    });

    it('with key value pair', function() {
      var self = this;
      return this.User.find(1).then(function(user1) {
        return user1.increment({ 'aNumber': 1, 'bNumber': 2 }).then(function() {
          return self.User.find(1).then(function(user3) {
            expect(user3.aNumber).to.be.equal(1);
            expect(user3.bNumber).to.be.equal(2);
          });
        });
      });
    });

    it('with timestamps set to true', function() {
      var User = this.sequelize.define('IncrementUser', {
        aNumber: DataTypes.INTEGER
      }, { timestamps: true });

      return User.sync({ force: true }).then(function() {
        return User.create({aNumber: 1}).then(function(user) {
          var oldDate = user.updatedAt;
          return this.sequelize.Promise.delay(1000).then(function() {
            return user.increment('aNumber', { by: 1 }).then(function() {
              return User.find(1).then(function(user) {
                expect(user.updatedAt).to.be.afterTime(oldDate);
              });
            });
          });
        });
      });
    });
  });

  describe('decrement', function() {
    beforeEach(function() {
      return this.User.create({ id: 1, aNumber: 0, bNumber: 0 });
    });

    if (current.dialect.supports.transactions) {
      it('supports transactions', function() {
        return Support.prepareTransactionTest(this.sequelize).bind({}).then(function(sequelize) {
          var User = sequelize.define('User', { number: Support.Sequelize.INTEGER });

          return User.sync({ force: true }).then(function() {
            return User.create({ number: 3 }).then(function(user) {
              return sequelize.transaction().then(function(t) {
                return user.decrement('number', { by: 2, transaction: t }).then(function() {
                  return User.findAll().then(function(users1) {
                    return User.findAll({ transaction: t }).then(function(users2) {
                      expect(users1[0].number).to.equal(3);
                      expect(users2[0].number).to.equal(1);
                      return t.rollback();
                    });
                  });
                });
              });
            });
          });
        });
      });
    }

    it('with array', function() {
      var self = this;
      return this.User.find(1).then(function(user1) {
        return user1.decrement(['aNumber'], { by: 2 }).then(function() {
          return self.User.find(1).then(function(user3) {
            expect(user3.aNumber).to.be.equal(-2);
          });
        });
      });
    });

    it('with single field', function() {
      var self = this;
      return this.User.find(1).then(function(user1) {
        return user1.decrement('aNumber', { by: 2 }).then(function() {
          return self.User.find(1).then(function(user3) {
            expect(user3.aNumber).to.be.equal(-2);
          });
        });
      });
    });

    it('with single field and no value', function() {
      var self = this;
      return this.User.find(1).then(function(user1) {
        return user1.decrement('aNumber').then(function() {
          return self.User.find(1).then(function(user2) {
            expect(user2.aNumber).to.be.equal(-1);
          });
        });
      });
    });

    it('should still work right with other concurrent updates', function() {
      var self = this;
      return this.User.find(1).then(function(user1) {
        // Select the user again (simulating a concurrent query)
        return self.User.find(1).then(function(user2) {
          return user2.updateAttributes({
            aNumber: user2.aNumber + 1
          }).then(function() {
            return user1.decrement(['aNumber'], { by: 2 }).then(function() {
              return self.User.find(1).then(function(user5) {
                expect(user5.aNumber).to.be.equal(-1);
              });
            });
          });
        });
      });
    });

    it('should still work right with other concurrent increments', function() {
      var self = this;
      return this.User.find(1).then(function(user1) {
        return this.sequelize.Promise.all([
          user1.decrement(['aNumber'], { by: 2 }),
          user1.decrement(['aNumber'], { by: 2 }),
          user1.decrement(['aNumber'], { by: 2 })
        ]).then(function() {
          return self.User.find(1).then(function(user2) {
            expect(user2.aNumber).to.equal(-6);
          });
        });
      });
    });

    it('with key value pair', function() {
      var self = this;
      return this.User.find(1).then(function(user1) {
        return user1.decrement({ 'aNumber': 1, 'bNumber': 2}).then(function() {
          return self.User.find(1).then(function(user3) {
            expect(user3.aNumber).to.be.equal(-1);
            expect(user3.bNumber).to.be.equal(-2);
          });
        });
      });
    });

    it('with timestamps set to true', function() {
      var User = this.sequelize.define('IncrementUser', {
        aNumber: DataTypes.INTEGER
      }, { timestamps: true });

      return User.sync({ force: true }).then(function() {
        return User.create({aNumber: 1}).then(function(user) {
          var oldDate = user.updatedAt;
          return this.sequelize.Promise.delay(1000).then(function() {
            return user.decrement('aNumber', { by: 1 }).then(function() {
              return User.find(1).then(function(user) {
                expect(user.updatedAt).to.be.afterTime(oldDate);
              });
            });
          });
        });
      });
    });
  });

  describe('reload', function() {
    if (current.dialect.supports.transactions) {
      it('supports transactions', function() {
        return Support.prepareTransactionTest(this.sequelize).bind({}).then(function(sequelize) {
          var User = sequelize.define('User', { username: Support.Sequelize.STRING });

          return User.sync({ force: true }).then(function() {
            return User.create({ username: 'foo' }).then(function(user) {
              return sequelize.transaction().then(function(t) {
                return User.update({ username: 'bar' }, {where: {username: 'foo'}, transaction: t }).then(function() {
                  return user.reload().then(function(user) {
                    expect(user.username).to.equal('foo');
                    return user.reload({ transaction: t }).then(function(user) {
                      expect(user.username).to.equal('bar');
                      return t.rollback();
                    });
                  });
                });
              });
            });
          });
        });
      });
    }

    it('should return a reference to the same DAO instead of creating a new one', function() {
      return this.User.create({ username: 'John Doe' }).then(function(originalUser) {
        return originalUser.updateAttributes({ username: 'Doe John' }).then(function() {
          return originalUser.reload().then(function(updatedUser) {
            expect(originalUser === updatedUser).to.be.true;
          });
        });
      });
    });

    it('should update the values on all references to the DAO', function() {
      var self = this;
      return this.User.create({ username: 'John Doe' }).then(function(originalUser) {
        return self.User.find(originalUser.id).then(function(updater) {
          return updater.updateAttributes({ username: 'Doe John' }).then(function() {
            // We used a different reference when calling updateAttributes, so originalUser is now out of sync
            expect(originalUser.username).to.equal('John Doe');
            return originalUser.reload().then(function(updatedUser) {
              expect(originalUser.username).to.equal('Doe John');
              expect(updatedUser.username).to.equal('Doe John');
            });
          });
        });
      });
    });

    it('should update read only attributes as well (updatedAt)', function() {
      var self = this;

      return this.User.create({ username: 'John Doe' }).then(function(originalUser) {
        var originallyUpdatedAt = originalUser.updatedAt;

        // Wait for a second, so updatedAt will actually be different
        return this.sequelize.Promise.delay(1000).then(function() {
          return self.User.find(originalUser.id).then(function(updater) {
            return updater.updateAttributes({ username: 'Doe John' }).then(function() {
              return originalUser.reload().then(function(updatedUser) {
                expect(originalUser.updatedAt).to.be.above(originallyUpdatedAt);
                expect(updatedUser.updatedAt).to.be.above(originallyUpdatedAt);
              });
            });
          });
        });
      });
    });

    it('should update the associations as well', function() {
      var Book = this.sequelize.define('Book', { title: DataTypes.STRING })
        , Page = this.sequelize.define('Page', { content: DataTypes.TEXT });

      Book.hasMany(Page);
      Page.belongsTo(Book);

      return Book.sync({force: true}).then(function() {
        return Page.sync({force: true}).then(function() {
          return Book.create({ title: 'A very old book' }).then(function(book) {
            return Page.create({ content: 'om nom nom' }).then(function(page) {
              return book.setPages([page]).then(function() {
                return Book.find({
                  where: { id: book.id },
                  include: [Page]
                }).then(function(leBook) {
                  return page.updateAttributes({ content: 'something totally different' }).then(function(page) {
                    expect(leBook.Pages.length).to.equal(1);
                    expect(leBook.Pages[0].content).to.equal('om nom nom');
                    expect(page.content).to.equal('something totally different');
                    return leBook.reload().then(function(leBook) {
                      expect(leBook.Pages.length).to.equal(1);
                      expect(leBook.Pages[0].content).to.equal('something totally different');
                      expect(page.content).to.equal('something totally different');
                    });
                  });
                });
              });
            });
          });
        });
      });
    });
  });

  describe('default values', function() {
    describe('uuid', function() {
      it('should store a string in uuidv1 and uuidv4', function() {
        var user = this.User.build({ username: 'a user'});
        expect(user.uuidv1).to.be.a('string');
        expect(user.uuidv4).to.be.a('string');
      });

      it('should store a string of length 36 in uuidv1 and uuidv4', function() {
        var user = this.User.build({ username: 'a user'});
        expect(user.uuidv1).to.have.length(36);
        expect(user.uuidv4).to.have.length(36);
      });

      it('should store a valid uuid in uuidv1 and uuidv4 that can be parsed to something of length 16', function() {
        var user = this.User.build({ username: 'a user'});
        expect(uuid.parse(user.uuidv1)).to.have.length(16);
        expect(uuid.parse(user.uuidv4)).to.have.length(16);
      });

      it('should store a valid uuid if the field is a primary key named id', function() {
        var Person = this.sequelize.define('Person', {
          id: {
            type: DataTypes.UUID,
            defaultValue: DataTypes.UUIDV1,
            primaryKey: true
          }
        });

        var person = Person.build({});
        expect(person.id).to.be.ok;
        expect(person.id).to.have.length(36);
      });
    });
    describe('current date', function() {
      it('should store a date in touchedAt', function() {
        var user = this.User.build({ username: 'a user'});
        expect(user.touchedAt).to.be.instanceof(Date);
      });

      it('should store the current date in touchedAt', function() {
        var clock = sinon.useFakeTimers();
        clock.tick(5000);
        var user = this.User.build({ username: 'a user'});
        clock.restore();
        expect(+user.touchedAt).to.be.equal(5000);
      });
    });

    describe('allowNull date', function() {
      it('should be just "null" and not Date with Invalid Date', function() {
        var self = this;
        return this.User.build({ username: 'a user'}).save().then(function() {
          return self.User.find({where: {username: 'a user'}}).then(function(user) {
            expect(user.dateAllowNullTrue).to.be.null;
          });
        });
      });

      it('should be the same valid date when saving the date', function() {
        var self = this;
        var date = new Date();
        return this.User.build({ username: 'a user', dateAllowNullTrue: date}).save().then(function() {
          return self.User.find({where: {username: 'a user'}}).then(function(user) {
            expect(user.dateAllowNullTrue.toString()).to.equal(date.toString());
          });
        });
      });
    });

    describe('super user boolean', function() {
      it('should default to false', function() {
        return this.User.build({
            username: 'a user'
          })
          .save()
          .bind(this)
          .then(function() {
            return this.User.find({
              where: {
                username: 'a user'
              }
            })
          .then(function(user) {
            expect(user.isSuperUser).to.be.false;
          });
        });
      });

      it('should override default when given truthy boolean', function() {
        return this.User.build({
            username: 'a user',
            isSuperUser: true
          })
          .save()
          .bind(this)
          .then(function() {
            return this.User.find({
              where: {
                username: 'a user'
              }
            })
          .then(function(user) {
            expect(user.isSuperUser).to.be.true;
          });
        });
      });

      it('should override default when given truthy boolean-string ("true")', function() {
        return this.User.build({
            username: 'a user',
            isSuperUser: "true"
          })
          .save()
          .bind(this)
          .then(function() {
            return this.User.find({
              where: {
                username: 'a user'
              }
            })
          .then(function(user) {
            expect(user.isSuperUser).to.be.true;
          });
        });
      });

      it('should override default when given truthy boolean-int (1)', function() {
        return this.User.build({
          username: 'a user',
          isSuperUser: 1
        })
        .save()
        .bind(this)
        .then(function() {
          return this.User.find({
            where: {
              username: 'a user'
            }
          })
        .then(function(user) {
          expect(user.isSuperUser).to.be.true;
        });
        });
      });

      it('should throw error when given value of incorrect type', function() {
        var callCount = 0;

        return this.User.build({
          username: 'a user',
          isSuperUser: "INCORRECT_VALUE_TYPE"
        })
        .save()
        .then(function () {
          callCount += 1;
        })
        .catch(function(err) {
          expect(callCount).to.equal(0);
          expect(err).to.exist;
          expect(err.message).to.exist;
        });
      });
    });
  });

  describe('complete', function() {
    it('gets triggered if an error occurs', function() {
      return this.User.find({ where: 'asdasdasd' }).catch(function(err) {
        expect(err).to.exist;
        expect(err.message).to.exist;
      });
    });

    it('gets triggered if everything was ok', function() {
      return this.User.count().then(function(result) {
        expect(result).to.exist;
      });
    });
  });

  describe('save', function() {
    if (current.dialect.supports.transactions) {
      it('supports transactions', function() {
        return Support.prepareTransactionTest(this.sequelize).bind({}).then(function(sequelize) {
          var User = sequelize.define('User', { username: Support.Sequelize.STRING });
          return User.sync({ force: true }).then(function() {
            return sequelize.transaction().then(function(t) {
              return User.build({ username: 'foo' }).save({ transaction: t }).then(function() {
                return User.count().then(function(count1) {
                  return User.count({ transaction: t }).then(function(count2) {
                    expect(count1).to.equal(0);
                    expect(count2).to.equal(1);
                    return t.rollback();
                  });
                });
              });
            });
          });
        });
      });
    }

    it('only updates fields in passed array', function() {
      var self = this
      , date = new Date(1990, 1, 1);

      return this.User.create({
        username: 'foo',
        touchedAt: new Date()
      }).then(function(user) {
        user.username = 'fizz';
        user.touchedAt = date;
        return user.save(['username']).then(function() {
          // re-select user
          return self.User.find(user.id).then(function(user2) {
            // name should have changed
            expect(user2.username).to.equal('fizz');
            // bio should be unchanged
            expect(user2.birthDate).not.to.equal(date);
          });
        });
      });
    });

    it('should work on a model with an attribute named length', function () {
      var Box = this.sequelize.define('box', {
        length : DataTypes.INTEGER,
        width : DataTypes.INTEGER,
        height : DataTypes.INTEGER
      });

      return Box.sync({force: true}).then(function () {
        return Box.create({
          length: 1,
          width: 2,
          height: 3
        }).then(function (box) {
          return box.update({
            length: 4,
            width: 5,
            height: 6
          });
        }).then(function () {
          return Box.findOne({}).then(function (box) {
            expect(box.get('length')).to.equal(4);
            expect(box.get('width')).to.equal(5);
            expect(box.get('height')).to.equal(6);
          });
        });
      });
    });

    it('only validates fields in passed array', function() {
      return this.User.build({
        validateTest: 'cake', // invalid, but not saved
        validateCustom: '1'
      }).save(['validateCustom']);
    });

    describe('hooks', function () {
      it('should update attributes added in hooks when default fields are used', function () {
        var User = this.sequelize.define('User' + config.rand(), {
          name: DataTypes.STRING,
          bio: DataTypes.TEXT,
          email: DataTypes.STRING
        });

        User.beforeUpdate(function(instance) {
          instance.set('email', 'B');
        });

        return User.sync({force: true}).then(function() {
          return User.create({
            name: 'A',
            bio: 'A',
            email: 'A'
          }).then(function (user) {
            return user.set({
              name: 'B',
              bio: 'B'
            }).save();
          }).then(function () {
            return User.findOne({});
          }).then(function (user) {
            expect(user.get('name')).to.equal('B');
            expect(user.get('bio')).to.equal('B');
            expect(user.get('email')).to.equal('B');
          });
        });
      });

      it('should update attributes changed in hooks when default fields are used', function () {
        var User = this.sequelize.define('User' + config.rand(), {
          name: DataTypes.STRING,
          bio: DataTypes.TEXT,
          email: DataTypes.STRING
        });

        User.beforeUpdate(function(instance) {
          instance.set('email', 'C');
        });

        return User.sync({force: true}).then(function() {
          return User.create({
            name: 'A',
            bio: 'A',
            email: 'A'
          }).then(function (user) {
            return user.set({
              name: 'B',
              bio: 'B',
              email: 'B'
            }).save();
          }).then(function () {
            return User.findOne({});
          }).then(function (user) {
            expect(user.get('name')).to.equal('B');
            expect(user.get('bio')).to.equal('B');
            expect(user.get('email')).to.equal('C');
          });
        });
      });

      it('should validate attributes added in hooks when default fields are used', function () {
        var User = this.sequelize.define('User' + config.rand(), {
          name: DataTypes.STRING,
          bio: DataTypes.TEXT,
          email: {
            type: DataTypes.STRING,
            validate: {
              isEmail: true
            }
          }
        });

        User.beforeUpdate(function(instance) {
          instance.set('email', 'B');
        });

        return User.sync({force: true}).then(function () {
          return User.create({
            name: 'A',
            bio: 'A',
            email: 'valid.email@gmail.com'
          }).then(function (user) {
            return expect(user.set({
              name: 'B'
            }).save()).to.be.rejectedWith(Sequelize.ValidationError);
          }).then(function () {
            return User.findOne({}).then(function (user) {
              expect(user.get('email')).to.equal('valid.email@gmail.com');
            });
          });
        });
      });

      it('should validate attributes changed in hooks when default fields are used', function () {
        var User = this.sequelize.define('User' + config.rand(), {
          name: DataTypes.STRING,
          bio: DataTypes.TEXT,
          email: {
            type: DataTypes.STRING,
            validate: {
              isEmail: true
            }
          }
        });

        User.beforeUpdate(function(instance) {
          instance.set('email', 'B');
        });

        return User.sync({force: true}).then(function () {
          return User.create({
            name: 'A',
            bio: 'A',
            email: 'valid.email@gmail.com'
          }).then(function (user) {
            return expect(user.set({
              name: 'B',
              email: 'still.valid.email@gmail.com'
            }).save()).to.be.rejectedWith(Sequelize.ValidationError);
          }).then(function () {
            return User.findOne({}).then(function (user) {
              expect(user.get('email')).to.equal('valid.email@gmail.com');
            });
          });
        });
      });
    });

    it('stores an entry in the database', function() {
      var username = 'user'
        , User = this.User
        , user = this.User.build({
          username: username,
          touchedAt: new Date(1984, 8, 23)
        });

      return User.findAll().then(function(users) {
        expect(users).to.have.length(0);
        return user.save().then(function() {
          return User.findAll().then(function(users) {
            expect(users).to.have.length(1);
            expect(users[0].username).to.equal(username);
            expect(users[0].touchedAt).to.be.instanceof(Date);
            expect(users[0].touchedAt).to.equalDate(new Date(1984, 8, 23));
          });
        });
      });
    });

    it('updates the timestamps', function() {
      var now = Date.now()
        , user = null
        , User = this.User;

      // timeout is needed, in order to check the update of the timestamp
      return this.sequelize.Promise.delay(1000).then(function() {
        user = User.build({ username: 'user' });
        return user.save().then(function() {
          expect(now).to.be.below(user.updatedAt.getTime());
        });
      });
    });

    it('does not update timestamps when passing silent=true', function() {
      return this.User.create({ username: 'user' }).then(function(user) {
        var updatedAt = user.updatedAt;
        return this.sequelize.Promise.delay(2000).then(function() {
          return user.update({
            username: 'userman'
          }, {
            silent: true
          }).then(function(user1) {
            expect(user1.updatedAt).to.equalDate(updatedAt);
          });
        });
      });
    });

    it('updates with function and column value', function() {
      var self = this;

      return this.User.create({
        aNumber: 42
      }).then(function(user) {
        user.bNumber = self.sequelize.col('aNumber');
        user.username = self.sequelize.fn('upper', 'sequelize');
        return user.save().then(function() {
          return self.User.find(user.id).then(function(user2) {
            expect(user2.username).to.equal('SEQUELIZE');
            expect(user2.bNumber).to.equal(42);
          });
        });
      });
    });

    describe('without timestamps option', function() {
      it("doesn't update the updatedAt column", function() {
        var User2 = this.sequelize.define('User2', {
          username: DataTypes.STRING,
          updatedAt: DataTypes.DATE
        }, { timestamps: false });
        return User2.sync().then(function() {
          return User2.create({ username: 'john doe' }).then(function(johnDoe) {
            // sqlite and mysql return undefined, whereas postgres returns null
            expect([undefined, null].indexOf(johnDoe.updatedAt)).not.to.be.equal(-1);
          });
        });
      });
    });

    describe('with custom timestamp options', function() {
      var now = Date.now();

      it('updates the createdAt column if updatedAt is disabled', function() {
        var User2 = this.sequelize.define('User2', {
          username: DataTypes.STRING
        }, { updatedAt: false });

        return User2.sync().then(function() {
          return User2.create({ username: 'john doe' }).then(function(johnDoe) {
            expect(johnDoe.updatedAt).to.be.undefined;
            expect(now).to.be.below(johnDoe.createdAt.getTime());
          });
        });
      });

      it('updates the updatedAt column if createdAt is disabled', function() {
        var User2 = this.sequelize.define('User2', {
          username: DataTypes.STRING
        }, { createdAt: false });

        return User2.sync().then(function() {
          return User2.create({ username: 'john doe' }).then(function(johnDoe) {
            expect(johnDoe.createdAt).to.be.undefined;
            expect(now).to.be.below(johnDoe.updatedAt.getTime());
          });
        });
      });
    });

    it('should fail a validation upon creating', function() {
      return this.User.create({aNumber: 0, validateTest: 'hello'}).catch(function(err) {
        expect(err).to.exist;
        expect(err).to.be.instanceof(Object);
        expect(err.get('validateTest')).to.be.instanceof(Array);
        expect(err.get('validateTest')[0]).to.exist;
        expect(err.get('validateTest')[0].message).to.equal('Validation isInt failed');
      });
    });

    it('should fail a validation upon creating with hooks false', function() {
      return this.User.create({aNumber: 0, validateTest: 'hello'}, {hooks: false}).catch(function(err) {
        expect(err).to.exist;
        expect(err).to.be.instanceof(Object);
        expect(err.get('validateTest')).to.be.instanceof(Array);
        expect(err.get('validateTest')[0]).to.exist;
        expect(err.get('validateTest')[0].message).to.equal('Validation isInt failed');
      });
    });

    it('should fail a validation upon building', function() {
      return this.User.build({aNumber: 0, validateCustom: 'aaaaaaaaaaaaaaaaaaaaaaaaaa'}).save()
      .catch(function(err) {
        expect(err).to.exist;
        expect(err).to.be.instanceof(Object);
        expect(err.get('validateCustom')).to.exist;
        expect(err.get('validateCustom')).to.be.instanceof(Array);
        expect(err.get('validateCustom')[0]).to.exist;
        expect(err.get('validateCustom')[0].message).to.equal('Length failed.');
      });
    });

    it('should fail a validation when updating', function() {
      return this.User.create({aNumber: 0}).then(function(user) {
        return user.updateAttributes({validateTest: 'hello'}).catch(function(err) {
          expect(err).to.exist;
          expect(err).to.be.instanceof(Object);
          expect(err.get('validateTest')).to.exist;
          expect(err.get('validateTest')).to.be.instanceof(Array);
          expect(err.get('validateTest')[0]).to.exist;
          expect(err.get('validateTest')[0].message).to.equal('Validation isInt failed');
        });
      });
    });

    it('takes zero into account', function() {
      return this.User.build({ aNumber: 0 }).save(['aNumber']).then(function(user) {
        expect(user.aNumber).to.equal(0);
      });
    });

    it('saves a record with no primary key', function() {
      var HistoryLog = this.sequelize.define('HistoryLog', {
        someText: { type: DataTypes.STRING },
        aNumber: { type: DataTypes.INTEGER },
        aRandomId: { type: DataTypes.INTEGER }
      });
      return HistoryLog.sync().then(function() {
        return HistoryLog.create({ someText: 'Some random text', aNumber: 3, aRandomId: 5 }).then(function(log) {
          return log.updateAttributes({ aNumber: 5 }).then(function(newLog) {
            expect(newLog.aNumber).to.equal(5);
          });
        });
      });
    });

    describe('eagerly loaded objects', function() {
      beforeEach(function() {
        var self = this;
        this.UserEager = this.sequelize.define('UserEagerLoadingSaves', {
          username: DataTypes.STRING,
          age: DataTypes.INTEGER
        }, { timestamps: false });

        this.ProjectEager = this.sequelize.define('ProjectEagerLoadingSaves', {
          title: DataTypes.STRING,
          overdue_days: DataTypes.INTEGER
        }, { timestamps: false });

        this.UserEager.hasMany(this.ProjectEager, { as: 'Projects', foreignKey: 'PoobahId' });
        this.ProjectEager.belongsTo(this.UserEager, { as: 'Poobah', foreignKey: 'PoobahId' });

        return self.UserEager.sync({force: true}).then(function() {
          return self.ProjectEager.sync({force: true});
        });
      });

      it('saves one object that has a collection of eagerly loaded objects', function() {
        var self = this;
        return this.UserEager.create({ username: 'joe', age: 1 }).then(function(user) {
          return self.ProjectEager.create({ title: 'project-joe1', overdue_days: 0 }).then(function(project1) {
            return self.ProjectEager.create({ title: 'project-joe2', overdue_days: 0 }).then(function(project2)  {
              return user.setProjects([project1, project2]).then(function() {
                return self.UserEager.find({where: {age: 1}, include: [{model: self.ProjectEager, as: 'Projects'}]}).then(function(user) {
                  expect(user.username).to.equal('joe');
                  expect(user.age).to.equal(1);
                  expect(user.Projects).to.exist;
                  expect(user.Projects.length).to.equal(2);

                  user.age = user.age + 1; // happy birthday joe
                  return user.save().then(function(user) {
                    expect(user.username).to.equal('joe');
                    expect(user.age).to.equal(2);
                    expect(user.Projects).to.exist;
                    expect(user.Projects.length).to.equal(2);
                  });
                });
              });
            });
          });
        });
      });

      it('saves many objects that each a have collection of eagerly loaded objects', function() {
        var self = this;
        return this.UserEager.create({ username: 'bart', age: 20 }).then(function(bart) {
          return self.UserEager.create({ username: 'lisa', age: 20 }).then(function(lisa) {
            return self.ProjectEager.create({ title: 'detention1', overdue_days: 0 }).then(function(detention1) {
              return self.ProjectEager.create({ title: 'detention2', overdue_days: 0 }).then(function(detention2)  {
                return self.ProjectEager.create({ title: 'exam1', overdue_days: 0 }).then(function(exam1) {
                  return self.ProjectEager.create({ title: 'exam2', overdue_days: 0 }).then(function(exam2)  {
                    return bart.setProjects([detention1, detention2]).then(function() {
                      return lisa.setProjects([exam1, exam2]).then(function() {
                        return self.UserEager.findAll({where: {age: 20}, order: 'username ASC', include: [{model: self.ProjectEager, as: 'Projects'}]}).then(function(simpsons) {
                          var _bart, _lisa;

                          expect(simpsons.length).to.equal(2);

                          _bart = simpsons[0];
                          _lisa = simpsons[1];

                          expect(_bart.Projects).to.exist;
                          expect(_lisa.Projects).to.exist;
                          expect(_bart.Projects.length).to.equal(2);
                          expect(_lisa.Projects.length).to.equal(2);

                          _bart.age = _bart.age + 1; // happy birthday bart - off to Moe's

                          return _bart.save().then(function(savedbart) {
                            expect(savedbart.username).to.equal('bart');
                            expect(savedbart.age).to.equal(21);

                            _lisa.username = 'lsimpson';

                            return _lisa.save().then(function(savedlisa) {
                              expect(savedlisa.username).to.equal('lsimpson');
                              expect(savedlisa.age).to.equal(20);
                            });
                          });
                        });
                      });
                    });
                  });
                });
              });
            });
          });
        });
      });

      it('saves many objects that each has one eagerly loaded object (to which they belong)', function() {
        var self = this;
        return this.UserEager.create({ username: 'poobah', age: 18 }).then(function(user) {
          return self.ProjectEager.create({ title: 'homework', overdue_days: 10 }).then(function(homework) {
            return self.ProjectEager.create({ title: 'party', overdue_days: 2 }).then(function(party)  {
              return user.setProjects([homework, party]).then(function() {
                return self.ProjectEager.findAll({include: [{model: self.UserEager, as: 'Poobah'}]}).then(function(projects) {
                  expect(projects.length).to.equal(2);
                  expect(projects[0].Poobah).to.exist;
                  expect(projects[1].Poobah).to.exist;
                  expect(projects[0].Poobah.username).to.equal('poobah');
                  expect(projects[1].Poobah.username).to.equal('poobah');

                  projects[0].title = 'partymore';
                  projects[1].title = 'partymore';
                  projects[0].overdue_days = 0;
                  projects[1].overdue_days = 0;

                  return projects[0].save().then(function() {
                    return projects[1].save().then(function() {
                      return self.ProjectEager.findAll({where: {title: 'partymore', overdue_days: 0}, include: [{model: self.UserEager, as: 'Poobah'}]}).then(function(savedprojects) {
                        expect(savedprojects.length).to.equal(2);
                        expect(savedprojects[0].Poobah).to.exist;
                        expect(savedprojects[1].Poobah).to.exist;
                        expect(savedprojects[0].Poobah.username).to.equal('poobah');
                        expect(savedprojects[1].Poobah.username).to.equal('poobah');
                      });
                    });
                  });
                });
              });
            });
          });
        });
      });
    });
  });

  describe('many to many relations', function() {
    var udo;
    beforeEach(function() {
      var self = this;
      this.User = this.sequelize.define('UserWithUsernameAndAgeAndIsAdmin', {
        username: DataTypes.STRING,
        age: DataTypes.INTEGER,
        isAdmin: DataTypes.BOOLEAN
      }, {timestamps: false});

      this.Project = this.sequelize.define('NiceProject',
        { title: DataTypes.STRING }, {timestamps: false});

      this.Project.hasMany(this.User);
      this.User.hasMany(this.Project);

      return this.User.sync({ force: true }).then(function() {
        return self.Project.sync({ force: true }).then(function() {
          return self.User.create({ username: 'fnord', age: 1, isAdmin: true })
            .then(function(user) {
              udo = user;
            });
        });
      });
    });

    it.skip('Should assign a property to the instance', function() {
      // @thanpolas rethink this test, it doesn't make sense, a relation has
      // to be created first in the beforeEach().
      return this.User.find({id: udo.id})
        .then(function(user) {
          user.NiceProjectId = 1;
          expect(user.NiceProjectId).to.equal(1);
        });
    });
  });

  describe('toJSON', function() {
    beforeEach(function() {
      var self = this;
      this.User = this.sequelize.define('UserWithUsernameAndAgeAndIsAdmin', {
        username: DataTypes.STRING,
        age: DataTypes.INTEGER,
        isAdmin: DataTypes.BOOLEAN
      }, { timestamps: false });

      this.Project = this.sequelize.define('NiceProject', { title: DataTypes.STRING }, { timestamps: false });

      this.User.hasMany(this.Project, { as: 'Projects', foreignKey: 'lovelyUserId' });
      this.Project.belongsTo(this.User, { as: 'LovelyUser', foreignKey: 'lovelyUserId' });

      return this.User.sync({ force: true }).then(function() {
        return self.Project.sync({ force: true });
      });
    });

    it("dont return instance that isn't defined", function() {
      var self = this;
      return self.Project.create({ lovelyUserId: null })
        .then(function(project) {
          return self.Project.find({
            where: {
              id: project.id
            },
            include: [
              { model: self.User, as: 'LovelyUser' }
            ]
          });
        })
        .then(function(project) {
          var json = project.toJSON();
          expect(json.LovelyUser).to.be.equal(null);
        });
    });

    it("dont return instances that aren't defined", function() {
      var self = this;
      return self.User.create({ username: 'cuss' })
        .then(function(user) {
          return self.User.find({
            where: {
              id: user.id
            },
            include: [
              { model: self.Project, as: 'Projects' }
            ]
          });
        })
        .then(function(user) {
          expect(user.Projects).to.be.instanceof(Array);
          expect(user.Projects).to.be.length(0);
        });
    });

    it('returns an object containing all values', function() {
      var user = this.User.build({ username: 'test.user', age: 99, isAdmin: true });
      expect(user.toJSON()).to.deep.equal({ username: 'test.user', age: 99, isAdmin: true, id: null });
    });

    it('returns a response that can be stringified', function() {
      var user = this.User.build({ username: 'test.user', age: 99, isAdmin: true });
      expect(JSON.stringify(user)).to.deep.equal('{"id":null,"username":"test.user","age":99,"isAdmin":true}');
    });

    it('returns a response that can be stringified and then parsed', function() {
      var user = this.User.build({ username: 'test.user', age: 99, isAdmin: true });
      expect(JSON.parse(JSON.stringify(user))).to.deep.equal({ username: 'test.user', age: 99, isAdmin: true, id: null });
    });

    it('includes the eagerly loaded associations', function() {
      var self = this;
      return this.User.create({ username: 'fnord', age: 1, isAdmin: true }).then(function(user) {
        return self.Project.create({ title: 'fnord' }).then(function(project) {
          return user.setProjects([project]).then(function() {
            return self.User.findAll({include: [{ model: self.Project, as: 'Projects' }]}).then(function(users) {
              var _user = users[0];

              expect(_user.Projects).to.exist;
              expect(JSON.parse(JSON.stringify(_user)).Projects).to.exist;

              return self.Project.findAll({include: [{ model: self.User, as: 'LovelyUser' }]}).then(function(projects) {
                var _project = projects[0];

                expect(_project.LovelyUser).to.exist;
                expect(JSON.parse(JSON.stringify(_project)).LovelyUser).to.exist;
              });
            });
          });
        });
      });
    });
  });

  describe('findAll', function() {
    beforeEach(function() {
      this.ParanoidUser = this.sequelize.define('ParanoidUser', {
        username: { type: DataTypes.STRING }
      }, { paranoid: true });

      this.ParanoidUser.hasOne(this.ParanoidUser);
      return this.ParanoidUser.sync({ force: true });
    });

    it('sql should have paranoid condition', function() {
      var self = this;
      return self.ParanoidUser.create({ username: 'cuss' })
        .then(function() {
          return self.ParanoidUser.findAll();
        })
        .then(function(users) {
          expect(users).to.have.length(1);
          return users[0].destroy();
        })
        .then(function() {
          return self.ParanoidUser.findAll();
        })
        .then(function(users) {
          expect(users).to.have.length(0);
        });
    });

    it('sequelize.and as where should include paranoid condition', function() {
      var self = this;
      return self.ParanoidUser.create({ username: 'cuss' })
        .then(function() {
          return self.ParanoidUser.findAll({
            where: self.sequelize.and({
              username: 'cuss'
            })
          });
        })
        .then(function(users) {
          expect(users).to.have.length(1);
          return users[0].destroy();
        })
        .then(function() {
          return self.ParanoidUser.findAll({
            where: self.sequelize.and({
              username: 'cuss'
            })
          });
        })
        .then(function(users) {
          expect(users).to.have.length(0);
        });
    });

    it('sequelize.or as where should include paranoid condition', function() {
      var self = this;
      return self.ParanoidUser.create({ username: 'cuss' })
        .then(function() {
          return self.ParanoidUser.findAll({
            where: self.sequelize.or({
              username: 'cuss'
            })
          });
        })
        .then(function(users) {
          expect(users).to.have.length(1);
          return users[0].destroy();
        })
        .then(function() {
          return self.ParanoidUser.findAll({
            where: self.sequelize.or({
              username: 'cuss'
            })
          });
        })
        .then(function(users) {
          expect(users).to.have.length(0);
        });
    });

    it('escapes a single single quotes properly in where clauses', function() {
      var self = this;
      return this.User
        .create({ username: "user'name" })
        .then(function() {
          return self.User.findAll({
            where: { username: "user'name" }
          }).then(function(users) {
            expect(users.length).to.equal(1);
            expect(users[0].username).to.equal("user'name");
          });
        });
    });

    it('escapes two single quotes properly in where clauses', function() {
      var self = this;
      return this.User
        .create({ username: "user''name" })
        .then(function() {
          return self.User.findAll({
            where: { username: "user''name" }
          }).then(function(users) {
            expect(users.length).to.equal(1);
            expect(users[0].username).to.equal("user''name");
          });
        });
    });

    it('returns the timestamps if no attributes have been specified', function() {
      var self = this;
      return this.User.create({ username: 'fnord' }).then(function() {
        return self.User.findAll().then(function(users) {
          expect(users[0].createdAt).to.exist;
        });
      });
    });

    it('does not return the timestamps if the username attribute has been specified', function() {
      var self = this;
      return this.User.create({ username: 'fnord' }).then(function() {
        return self.User.findAll({ attributes: ['username'] }).then(function(users) {
          expect(users[0].createdAt).not.to.exist;
          expect(users[0].username).to.exist;
        });
      });
    });

    it('creates the deletedAt property, when defining paranoid as true', function() {
      var self = this;
      return this.ParanoidUser.create({ username: 'fnord' }).then(function() {
        return self.ParanoidUser.findAll().then(function(users) {
          expect(users[0].deletedAt).to.be.null;
        });
      });
    });

    it('destroys a record with a primary key of something other than id', function() {
      var UserDestroy = this.sequelize.define('UserDestroy', {
        newId: {
          type: DataTypes.STRING,
          primaryKey: true
        },
        email: DataTypes.STRING
      });

      return UserDestroy.sync().then(function() {
        return UserDestroy.create({newId: '123ABC', email: 'hello'}).then(function() {
          return UserDestroy.find({where: {email: 'hello'}}).then(function(user) {
            return user.destroy();
          });
        });
      });
    });

    it('sets deletedAt property to a specific date when deleting an instance', function() {
      var self = this;
      return this.ParanoidUser.create({ username: 'fnord' }).then(function() {
        return self.ParanoidUser.findAll().then(function(users) {
          return users[0].destroy().then(function(user) {
            expect(user.deletedAt.getMonth).to.exist;
          });
        });
      });
    });

    it('keeps the deletedAt-attribute with value null, when running updateAttributes', function() {
      var self = this;
      return this.ParanoidUser.create({ username: 'fnord' }).then(function() {
        return self.ParanoidUser.findAll().then(function(users) {
          return users[0].updateAttributes({username: 'newFnord'}).then(function(user) {
            expect(user.deletedAt).not.to.exist;
          });
        });
      });
    });

    it('keeps the deletedAt-attribute with value null, when updating associations', function() {
      var self = this;
      return this.ParanoidUser.create({ username: 'fnord' }).then(function() {
        return self.ParanoidUser.findAll().then(function(users) {
          return self.ParanoidUser.create({ username: 'linkedFnord' }).then(function(linkedUser) {
            return users[0].setParanoidUser(linkedUser).then(function(user) {
              expect(user.deletedAt).not.to.exist;
            });
          });
        });
      });
    });

    it('can reuse query option objects', function() {
      var self = this;
      return this.User.create({ username: 'fnord' }).then(function() {
        var query = { where: { username: 'fnord' }};
        return self.User.findAll(query).then(function(users) {
          expect(users[0].username).to.equal('fnord');
          return self.User.findAll(query).then(function(users) {
            expect(users[0].username).to.equal('fnord');
          });
        });
      });
    });
  });

  describe('find', function() {
    it('can reuse query option objects', function() {
      var self = this;
      return this.User.create({ username: 'fnord' }).then(function() {
        var query = { where: { username: 'fnord' }};
        return self.User.find(query).then(function(user) {
          expect(user.username).to.equal('fnord');
          return self.User.find(query).then(function(user) {
            expect(user.username).to.equal('fnord');
          });
        });
      });
    });
    it('returns null for null, undefined, and unset boolean values', function() {
      var Setting = this.sequelize.define('SettingHelper', {
        setting_key: DataTypes.STRING,
          bool_value: { type: DataTypes.BOOLEAN, allowNull: true },
          bool_value2: { type: DataTypes.BOOLEAN, allowNull: true },
          bool_value3: { type: DataTypes.BOOLEAN, allowNull: true }
      }, { timestamps: false, logging: false });

      return Setting.sync({ force: true }).then(function() {
        return Setting.create({ setting_key: 'test', bool_value: null, bool_value2: undefined }).then(function() {
          return Setting.find({ where: { setting_key: 'test' } }).then(function(setting) {
            expect(setting.bool_value).to.equal(null);
            expect(setting.bool_value2).to.equal(null);
            expect(setting.bool_value3).to.equal(null);
          });
        });
      });
    });
  });

  describe('equals', function() {
    it('can compare records with Date field', function() {
      var self = this;
      return this.User.create({ username: 'fnord' }).then(function(user1) {
        return self.User.find({ where: { username: 'fnord' }}).then(function(user2) {
          expect(user1.equals(user2)).to.be.true;
        });
      });
    });
  });

  describe('values', function() {
    it('returns all values', function() {
      var User = this.sequelize.define('UserHelper', {
        username: DataTypes.STRING
      }, { timestamps: false, logging: false });

      return User.sync().then(function() {
        var user = User.build({ username: 'foo' });
        expect(user.get({ plain: true })).to.deep.equal({ username: 'foo', id: null });
      });
    });
  });

  describe('destroy', function() {
    if (current.dialect.supports.transactions) {
      it('supports transactions', function() {
        return Support.prepareTransactionTest(this.sequelize).bind({}).then(function(sequelize) {
          var User = sequelize.define('User', { username: Support.Sequelize.STRING });

          return User.sync({ force: true }).then(function() {
            return User.create({ username: 'foo' }).then(function(user) {
              return sequelize.transaction().then(function(t) {
                return user.destroy({ transaction: t }).then(function() {
                  return User.count().then(function(count1) {
                    return User.count({ transaction: t }).then(function(count2) {
                      expect(count1).to.equal(1);
                      expect(count2).to.equal(0);
                      return t.rollback();
                    });
                  });
                });
              });
            });
          });
        });
      });
    }

    it('deletes a record from the database if dao is not paranoid', function() {
      var UserDestroy = this.sequelize.define('UserDestroy', {
          name: Support.Sequelize.STRING,
          bio: Support.Sequelize.TEXT
        });

      return UserDestroy.sync({ force: true }).then(function() {
        return UserDestroy.create({name: 'hallo', bio: 'welt'}).then(function(u) {
          return UserDestroy.findAll().then(function(users) {
            expect(users.length).to.equal(1);
            return u.destroy().then(function() {
              return UserDestroy.findAll().then(function(users) {
                expect(users.length).to.equal(0);
              });
            });
          });
        });
      });
    });

    it('allows sql logging of delete statements', function() {
      var UserDelete = this.sequelize.define('UserDelete', {
          name: Support.Sequelize.STRING,
          bio: Support.Sequelize.TEXT
        });

      return UserDelete.sync({ force: true }).then(function() {
        return UserDelete.create({name: 'hallo', bio: 'welt'}).then(function(u) {
          return UserDelete.findAll().then(function(users) {
            expect(users.length).to.equal(1);
            return u.destroy({
              logging: function (sql) {
                expect(sql).to.exist;
                expect(sql.toUpperCase().indexOf('DELETE')).to.be.above(-1);
              }
            });
          });
        });
      });
    });

    it('delete a record of multiple primary keys table', function() {
      var MultiPrimary = this.sequelize.define('MultiPrimary', {
        bilibili: {
          type: Support.Sequelize.CHAR(2),
          primaryKey: true
        },

        guruguru: {
          type: Support.Sequelize.CHAR(2),
          primaryKey: true
        }
      });

      return MultiPrimary.sync({ force: true }).then(function() {
        return MultiPrimary.create({ bilibili: 'bl', guruguru: 'gu' }).then(function() {
          return MultiPrimary.create({ bilibili: 'bl', guruguru: 'ru' }).then(function(m2) {
            return MultiPrimary.findAll().then(function(ms) {
              expect(ms.length).to.equal(2);
              return m2.destroy({
                logging: function(sql) {
                  expect(sql).to.exist;
                  expect(sql.toUpperCase().indexOf('DELETE')).to.be.above(-1);
                  expect(sql.indexOf('ru')).to.be.above(-1);
                  expect(sql.indexOf('bl')).to.be.above(-1);
                }
              }).then(function() {
                return MultiPrimary.findAll().then(function(ms) {
                  expect(ms.length).to.equal(1);
                  expect(ms[0].bilibili).to.equal('bl');
                  expect(ms[0].guruguru).to.equal('gu');
                });
              });
            });
          });
        });
      });
    });
  });

  describe('restore', function() {
    it('returns an error if the model is not paranoid', function() {
      return this.User.create({username: 'Peter', secretValue: '42'}).then(function(user) {
        expect(function() {user.restore();}).to.throw(Error, 'Model is not paranoid');
      });
    });

    it('restores a previously deleted model', function() {
      var self = this
        , ParanoidUser = self.sequelize.define('ParanoidUser', {
          username: DataTypes.STRING,
          secretValue: DataTypes.STRING,
          data: DataTypes.STRING,
          intVal: { type: DataTypes.INTEGER, defaultValue: 1}
        }, {
            paranoid: true
          })
        , data = [{ username: 'Peter', secretValue: '42' },
                  { username: 'Paul', secretValue: '43' },
                  { username: 'Bob', secretValue: '44' }];

      return ParanoidUser.sync({ force: true }).then(function() {
        return ParanoidUser.bulkCreate(data);
      }).then(function() {
        return ParanoidUser.find({where: {secretValue: '42'}});
      }).then(function(user) {
        return user.destroy().then(function() {
          return user.restore();
        });
      }).then(function() {
        return ParanoidUser.find({where: {secretValue: '42'}});
      }).then(function(user) {
        expect(user).to.be.ok;
        expect(user.username).to.equal('Peter');
      });
    });
  });
});
