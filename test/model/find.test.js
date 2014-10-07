/* jshint camelcase: false */
/* jshint expr: true */
var chai      = require('chai')
  , Sequelize = require('../../index')
  , Promise   = Sequelize.Promise
  , expect    = chai.expect
  , Support   = require(__dirname + '/../support')
  , DataTypes = require(__dirname + "/../../lib/data-types")
  , dialect   = Support.getTestDialect()
  , config    = require(__dirname + "/../config/config")
  , datetime  = require('chai-datetime')
  , promised  =  require("chai-as-promised")
  , _         = require('lodash')
  , async     = require('async')
  , current   = Support.sequelize;


chai.use(promised);
chai.use(datetime)
chai.config.includeStack = true

describe(Support.getTestDialectTeaser("Model"), function () {
  beforeEach(function(done) {
    this.User = this.sequelize.define('User', {
      username:     DataTypes.STRING,
      secretValue:  DataTypes.STRING,
      data:         DataTypes.STRING,
      intVal:       DataTypes.INTEGER,
      theDate:      DataTypes.DATE,
      aBool:        DataTypes.BOOLEAN
    })

    this.User.sync({ force: true }).success(function() {
      done()
    })
  })

  describe('find', function() {
    if (current.dialect.supports.transactions) {
      it('supports transactions', function(done) {
        Support.prepareTransactionTest(this.sequelize, function(sequelize) {
          var User = sequelize.define('User', { username: Sequelize.STRING })

          User.sync({ force: true }).success(function() {
            sequelize.transaction().then(function(t) {
              User.create({ username: 'foo' }, { transaction: t }).success(function() {
                User.find({
                  where: { username: 'foo' }
                }).success(function(user1) {
                  User.find({
                    where: { username: 'foo' },
                  }, { transaction: t }).success(function(user2) {
                    expect(user1).to.be.null
                    expect(user2).to.not.be.null

                    t.rollback().success(function() {
                      done()
                    })
                  })
                })
              })
            })
          })
        })
      })
    }

    describe('general / basic function', function() {
      beforeEach(function(done) {
        var self = this
        this.User.create({username: 'barfooz'}).success(function(user) {
          self.UserPrimary = self.sequelize.define('UserPrimary', {
            specialkey: {
              type: DataTypes.STRING,
              primaryKey: true
            }
          })

          self.UserPrimary.sync({force: true}).success(function() {
            self.UserPrimary.create({specialkey: 'a string'}).success(function() {
              self.user = user
              done()
            })
          })
        })
      })

      if (Support.dialectIsMySQL()) {
        // Bit fields interpreted as boolean need conversion from buffer / bool.
        // Sqlite returns the inserted value as is, and postgres really should the built in bool type instead

        it('allows bit fields as booleans', function () {
          var self = this,
            bitUser = this.sequelize.define('bituser', {
              bool: 'BIT(1)'
            }, {
              timestamps: false
            });

          // First use a custom data type def to create the bit field
          return bitUser.sync({ force: true }).then(function () {
            // Then change the definition to BOOLEAN
            bitUser = self.sequelize.define('bituser', {
              bool: DataTypes.BOOLEAN
            }, {
              timestamps: false
            });

            return bitUser.bulkCreate([
              { bool: 0 },
              { bool: 1 }
            ]);
          }).then(function () {
            return bitUser.findAll();
          }).then(function (bitUsers) {
            expect(bitUsers[0].bool).not.to.be.ok;
            expect(bitUsers[1].bool).to.be.ok;
          });
        });
      }

      it('does not modify the passed arguments', function (done) {
        var options = { where: ['specialkey = ?', 'awesome']}

        this.UserPrimary.find(options).success(function() {
          expect(options).to.deep.equal({ where: ['specialkey = ?', 'awesome']})
          done()
        })
      })

      it('treats questionmarks in an array', function(done) {
        this.UserPrimary.find({
          where: ['specialkey = ?', 'awesome']
        }).on('sql', function(sql) {
          expect(sql).to.contain("WHERE specialkey = 'awesome'")
          done()
        })
      })

      it('doesn\'t throw an error when entering in a non integer value for a specified primary field', function(done) {
        this.UserPrimary.find('a string').success(function(user) {
          expect(user.specialkey).to.equal('a string')
          done()
        })
      })

      it.skip('doesn\'t throw an error when entering in a non integer value', function(done) {
        this.User.find('a string value').success(function(user) {
          expect(user).to.be.null
          done()
        })
      })

      it('returns a single dao', function(done) {
        var self = this
        this.User.find(this.user.id).success(function(user) {
          expect(Array.isArray(user)).to.not.be.ok
          expect(user.id).to.equal(self.user.id)
          expect(user.id).to.equal(1)
          done()
        })
      })

      it('returns a single dao given a string id', function(done) {
        var self = this
        this.User.find(this.user.id + '').success(function(user) {
          expect(Array.isArray(user)).to.not.be.ok
          expect(user.id).to.equal(self.user.id)
          expect(user.id).to.equal(1)
          done()
        })
      })

      it.only("should make aliased attributes available", function(done) {
        this.User.find({
          where: { id: 1 },
          attributes: ['id', ['username', 'name']]
        }).success(function(user) {
          expect(user.dataValues.name).to.equal('barfooz')
          done()
        })
      })

      it("should not try to convert boolean values if they are not selected", function(done) {
        var UserWithBoolean = this.sequelize.define('UserBoolean', {
          active: Sequelize.BOOLEAN
        })

        UserWithBoolean.sync({force: true}).success(function () {
          UserWithBoolean.create({ active: true }).success(function(user) {
            UserWithBoolean.find({ where: { id: user.id }, attributes: [ 'id' ] }).success(function(user) {
              expect(user.active).not.to.exist
              done()
            })
          })
        })
      })

      it('finds a specific user via where option', function(done) {
        this.User.find({ where: { username: 'barfooz' } }).success(function(user) {
          expect(user.username).to.equal('barfooz')
          done()
        })
      })

      it("doesn't find a user if conditions are not matching", function(done) {
        this.User.find({ where: { username: 'foo' } }).success(function(user) {
          expect(user).to.be.null
          done()
        })
      })

      it('allows sql logging', function(done) {
        this.User.find({ where: { username: 'foo' } }).on('sql', function(sql) {
          expect(sql).to.exist
          expect(sql.toUpperCase().indexOf("SELECT")).to.be.above(-1)
          done()
        })
      })

      it('ignores passed limit option', function(done) {
        this.User.find({ limit: 10 }).success(function(user) {
          // it returns an object instead of an array
          expect(Array.isArray(user)).to.not.be.ok
          expect(user.dataValues.hasOwnProperty('username')).to.be.ok
          done()
        })
      })

      it('finds entries via primary keys', function(done) {
        var self = this
          , UserPrimary = self.sequelize.define('UserWithPrimaryKey', {
          identifier: {type: Sequelize.STRING, primaryKey: true},
          name: Sequelize.STRING
        })

        UserPrimary.sync({ force: true }).success(function() {
          UserPrimary.create({
            identifier: 'an identifier',
            name: 'John'
          }).success(function(u) {
            expect(u.id).not.to.exist

            UserPrimary.find('an identifier').success(function(u2) {
              expect(u2.identifier).to.equal('an identifier')
              expect(u2.name).to.equal('John')
              done()
            })
          })
        })
      })

      it('finds entries via a string primary key called id', function(done) {
        var self = this
          , UserPrimary = self.sequelize.define('UserWithPrimaryKey', {
          id: {type: Sequelize.STRING, primaryKey: true},
          name: Sequelize.STRING
        })

        UserPrimary.sync({ force: true }).success(function() {
          UserPrimary.create({
            id: 'a string based id',
            name: 'Johnno'
          }).success(function() {
            UserPrimary.find('a string based id').success(function(u2) {
              expect(u2.id).to.equal('a string based id')
              expect(u2.name).to.equal('Johnno')
              done()
            })
          })
        })
      })

      it('always honors ZERO as primary key', function(_done) {
        var self = this
          , permutations = [
            0,
            '0',
            {where: {id: 0}},
            {where: {id: '0'}}
          ]
          , done = _.after(2 * permutations.length, _done)

        this.User.bulkCreate([{username: 'jack'}, {username: 'jack'}]).success(function() {
          permutations.forEach(function(perm) {
            self.User.find(perm).done(function(err, user) {
              expect(err).to.be.null
              expect(user).to.be.null
              done()
            }).on('sql', function(s) {
              expect(s.indexOf(0)).not.to.equal(-1)
              done()
            })
          })
        })
      })

      it('should allow us to find IDs using capital letters', function(done) {
        var User = this.sequelize.define('User' + config.rand(), {
          ID: { type: Sequelize.INTEGER, primaryKey: true, autoIncrement: true },
          Login: { type: Sequelize.STRING }
        })

        User.sync({ force: true }).success(function() {
          User.create({Login: 'foo'}).success(function() {
            User.find(1).success(function(user) {
              expect(user).to.exist
              expect(user.ID).to.equal(1)
              done()
            })
          })
        })
      })
    })

    describe('eager loading', function() {
      beforeEach(function(done) {
        var self         = this
        self.Task        = self.sequelize.define('Task', { title: Sequelize.STRING })
        self.Worker      = self.sequelize.define('Worker', { name: Sequelize.STRING })

        this.init = function(callback) {
          self.sequelize.sync({ force: true }).success(function() {
            self.Worker.create({ name: 'worker' }).success(function(worker) {
              self.Task.create({ title: 'homework' }).success(function(task) {
                self.worker    = worker
                self.task      = task
                callback()
              })
            })
          })
        }
        done()
      })

      describe('belongsTo', function() {
        describe('generic', function() {
          it('throws an error about unexpected input if include contains a non-object', function(done) {
            var self = this
            self.Worker.find({ include: [ 1 ] }).catch(function(err) {
              expect(err.message).to.equal('Include unexpected. Element has to be either a Model, an Association or an object.');
              done()
            })
          })

          it('throws an error if included DaoFactory is not associated', function(done) {
            var self = this
            self.Worker.find({ include: [ self.Task ] }).catch(function(err) {
              expect(err.message).to.equal('Task is not associated to Worker!');
              done()
            })
          })

          it('returns the associated worker via task.worker', function(done) {
            var self = this
            this.Task.belongsTo(this.Worker)
            this.init(function() {
              self.task.setWorker(self.worker).success(function() {
                self.Task.find({
                  where:   { title: 'homework' },
                  include: [ self.Worker ]
                }).complete(function(err, task) {
                  expect(err).to.be.null
                  expect(task).to.exist
                  expect(task.Worker).to.exist
                  expect(task.Worker.name).to.equal('worker')
                  done()
                })
              })
            })
          })
        })

        it('returns the private and public ip', function(done) {
          var self = Object.create(this)
          self.Domain      = self.sequelize.define('Domain', { ip: Sequelize.STRING })
          self.Environment = self.sequelize.define('Environment', { name: Sequelize.STRING })
          self.Environment.belongsTo(self.Domain, { as: 'PrivateDomain', foreignKey: 'privateDomainId' })
          self.Environment.belongsTo(self.Domain, { as: 'PublicDomain', foreignKey: 'publicDomainId' })

          self.Domain.sync({ force: true }).success(function() {
            self.Environment.sync({ force: true }).success(function() {
              self.Domain.create({ ip: '192.168.0.1' }).success(function(privateIp) {
                self.Domain.create({ ip: '91.65.189.19' }).success(function(publicIp) {
                  self.Environment.create({ name: 'environment' }).success(function(env) {
                    env.setPrivateDomain(privateIp).success(function() {
                      env.setPublicDomain(publicIp).success(function() {
                        self.Environment.find({
                          where:   { name: 'environment' },
                          include: [
                            { daoFactory: self.Domain, as: 'PrivateDomain' },
                            { daoFactory: self.Domain, as: 'PublicDomain' }
                          ]
                        }).complete(function(err, environment) {
                          expect(err).to.be.null
                          expect(environment).to.exist
                          expect(environment.PrivateDomain).to.exist
                          expect(environment.PrivateDomain.ip).to.equal('192.168.0.1')
                          expect(environment.PublicDomain).to.exist
                          expect(environment.PublicDomain.ip).to.equal('91.65.189.19')
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

        it('eager loads with non-id primary keys', function(done) {
          var self = this
          self.User = self.sequelize.define('UserPKeagerbelong', {
            username: {
              type: Sequelize.STRING,
              primaryKey: true
            }
          })
          self.Group = self.sequelize.define('GroupPKeagerbelong', {
            name: {
              type: Sequelize.STRING,
              primaryKey: true
            }
          })
          self.User.belongsTo(self.Group)

          self.sequelize.sync({ force: true }).success(function() {
            self.Group.create({ name: 'people' }).success(function() {
              self.User.create({ username: 'someone', GroupPKeagerbelongName: 'people' }).success(function() {
                self.User.find({
                  where: {
                    username: 'someone'
                  },
                  include: [self.Group]
                }).complete(function (err, someUser) {
                  expect(err).to.be.null
                  expect(someUser).to.exist
                  expect(someUser.username).to.equal('someone')
                  expect(someUser.GroupPKeagerbelong.name).to.equal('people')
                  done()
                })
              })
            })
          })
        })

        it('getting parent data in many to one relationship', function(done) {
          var User = this.sequelize.define('User', {
            id:  {type: Sequelize.INTEGER, autoIncrement: true, primaryKey: true},
            username:  {type: Sequelize.STRING}
          })

          var Message = this.sequelize.define('Message', {
            id:  {type: Sequelize.INTEGER, autoIncrement: true, primaryKey: true},
            user_id:  {type: Sequelize.INTEGER},
            message:  {type: Sequelize.STRING}
          })

          User.hasMany(Message)
          Message.belongsTo(User, { foreignKey: 'user_id' })

          this.sequelize.sync({ force: true }).success(function() {
            User.create({username: 'test_testerson'}).success(function(user) {
              Message.create({user_id: user.id, message: 'hi there!'}).success(function() {
                Message.create({user_id: user.id, message: 'a second message'}).success(function() {
                  Message.findAll({

                    where: {user_id: user.id},
                    attributes: [
                      'user_id',
                      'message'
                    ],
                    include: [{ model: User, attributes: ['username'] }]

                  }).success(function(messages) {
                    expect(messages.length).to.equal(2);

                    expect(messages[0].message).to.equal('hi there!');
                    expect(messages[0].User.username).to.equal('test_testerson');

                    expect(messages[1].message).to.equal('a second message');
                    expect(messages[1].User.username).to.equal('test_testerson');

                    done()

                  })
                })
              })
            })
          })
        })

        it('allows mulitple assocations of the same model with different alias', function (done) {
          var self = this

          this.Worker.belongsTo(this.Task, { as: 'ToDo' })
          this.Worker.belongsTo(this.Task, { as: 'DoTo' })
          this.init(function () {
            self.Worker.find({
              include: [
                { model: self.Task, as: 'ToDo' },
                { model: self.Task, as: 'DoTo' }
              ]
            }).success(function () {
              // Just being able to include both shows that this test works, so no assertions needed
              done()
            })
          })
        })
      })

      describe('hasOne', function() {
        beforeEach(function(done) {
          var self = this
          this.Worker.hasOne(this.Task)
          this.init(function() {
            self.worker.setTask(self.task).success(function() {
              done()
            })
          })
        })

        it('throws an error if included DaoFactory is not associated', function(done) {
          var self = this
          self.Task.find({ include: [ self.Worker ] }).catch(function(err) {
            expect(err.message).to.equal('Worker is not associated to Task!');
            done()
          })
        })

        it('returns the associated task via worker.task', function(done) {
          this.Worker.find({
            where:   { name: 'worker' },
            include: [ this.Task ]
          }).complete(function(err, worker) {
            expect(err).to.be.null
            expect(worker).to.exist
            expect(worker.Task).to.exist
            expect(worker.Task.title).to.equal('homework')
            done()
          })
        })

        it('eager loads with non-id primary keys', function(done) {
          var self = this
          self.User = self.sequelize.define('UserPKeagerone', {
            username: {
              type: Sequelize.STRING,
              primaryKey: true
            }
          })
          self.Group = self.sequelize.define('GroupPKeagerone', {
            name: {
              type: Sequelize.STRING,
              primaryKey: true
            }
          })
          self.Group.hasOne(self.User)

          self.sequelize.sync({ force: true }).success(function() {
            self.Group.create({ name: 'people' }).success(function() {
              self.User.create({ username: 'someone', GroupPKeageroneName: 'people' }).success(function() {
                self.Group.find({
                  where: {
                    name: 'people'
                  },
                  include: [self.User]
                }).complete(function (err, someGroup) {
                  expect(err).to.be.null
                  expect(someGroup).to.exist
                  expect(someGroup.name).to.equal('people')
                  expect(someGroup.UserPKeagerone.username).to.equal('someone')
                  done()
                })
              })
            })
          })
        })
      })

      describe('hasOne with alias', function() {
        it('throws an error if included DaoFactory is not referenced by alias', function(done) {
          var self = this
          self.Worker.find({ include: [ self.Task ] }).catch(function(err) {
            expect(err.message).to.equal('Task is not associated to Worker!');
            done()
          })
        })

        describe('alias', function() {
          beforeEach(function(done) {
            var self = this
            this.Worker.hasOne(this.Task, { as: 'ToDo' })
            this.init(function() {
              self.worker.setToDo(self.task).success(function() {
                done()
              })
            })
          })

          it('throws an error if alias is not associated', function(done) {
            var self = this
            self.Worker.find({ include: [ { daoFactory: self.Task, as: 'Work' } ] }).catch(function(err) {
              expect(err.message).to.equal('Task (Work) is not associated to Worker!');
              done()
            })
          })

          it('returns the associated task via worker.task', function(done) {
            this.Worker.find({
              where:   { name: 'worker' },
              include: [ { daoFactory: this.Task, as: 'ToDo' } ]
            }).complete(function(err, worker) {
              expect(err).to.be.null
              expect(worker).to.exist
              expect(worker.ToDo).to.exist
              expect(worker.ToDo.title).to.equal('homework')
              done()
            })
          })

          it('returns the associated task via worker.task when daoFactory is aliased with model', function(done) {
            this.Worker.find({
              where:   { name: 'worker' },
              include: [ { model: this.Task, as: 'ToDo' } ]
            }).complete(function(err, worker) {
              expect(worker.ToDo.title).to.equal('homework')
              done()
            })
          })

           it('allows mulitple assocations of the same model with different alias', function (done) {
            var self = this

            this.Worker.hasOne(this.Task, { as: 'DoTo' })
            this.init(function () {
              self.Worker.find({
                include: [
                  { model: self.Task, as: 'ToDo' },
                  { model: self.Task, as: 'DoTo' }
                ]
              }).success(function () {
                // Just being able to include both shows that this test works, so no assertions needed
                done()
              })
            })
          })
        })
      })

      describe('hasMany', function() {
        beforeEach(function(done) {
          var self = this
          this.Worker.hasMany(this.Task)
          this.init(function() {
            self.worker.setTasks([ self.task ]).success(function() {
              done()
            })
          })
        })

        it('throws an error if included DaoFactory is not associated', function(done) {
          var self = this
          self.Task.find({ include: [ self.Worker ] }).catch(function(err) {
            expect(err.message).to.equal('Worker is not associated to Task!');
            done()
          })
        })

        it('returns the associated tasks via worker.tasks', function(done) {
          this.Worker.find({
            where:   { name: 'worker' },
            include: [ this.Task ]
          }).complete(function(err, worker) {
            expect(err).to.be.null
            expect(worker).to.exist
            expect(worker.Tasks).to.exist
            expect(worker.Tasks[0].title).to.equal('homework')
            done()
          })
        })

        it('including two has many relations should not result in duplicate values', function(done) {
          var self = this

          self.Contact = self.sequelize.define('Contact', { name: DataTypes.TEXT })
          self.Photo = self.sequelize.define('Photo', { img: DataTypes.TEXT })
          self.PhoneNumber = self.sequelize.define('PhoneNumber', { phone: DataTypes.TEXT })

          self.Contact.hasMany(self.Photo, { as: 'Photos' })
          self.Contact.hasMany(self.PhoneNumber)

          self.sequelize.sync({ force: true }).success(function() {
            self.Contact.create({ name: 'Boris' }).success(function(someContact) {
              self.Photo.create({ img: 'img.jpg' }).success(function(somePhoto) {
                self.PhoneNumber.create({ phone: '000000' }).success(function(somePhone1) {
                  self.PhoneNumber.create({ phone: '111111' }).success(function(somePhone2) {
                    someContact.setPhotos([somePhoto]).complete(function (err) {
                      expect(err).to.be.null
                      someContact.setPhoneNumbers([somePhone1, somePhone2]).complete(function () {
                        self.Contact.find({
                          where: {
                            name: 'Boris'
                          },
                          include: [self.PhoneNumber, { daoFactory: self.Photo, as: 'Photos' }]
                        }).complete(function (err, fetchedContact) {
                          expect(err).to.be.null
                          expect(fetchedContact).to.exist
                          expect(fetchedContact.Photos.length).to.equal(1)
                          expect(fetchedContact.PhoneNumbers.length).to.equal(2)
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

        it('eager loads with non-id primary keys', function(done) {
          var self = this
          self.User = self.sequelize.define('UserPKeagerone', {
            username: {
              type: Sequelize.STRING,
              primaryKey: true
            }
          })
          self.Group = self.sequelize.define('GroupPKeagerone', {
            name: {
              type: Sequelize.STRING,
              primaryKey: true
            }
          })
          self.Group.hasMany(self.User)
          self.User.hasMany(self.Group)

          self.sequelize.sync({ force: true }).success(function() {
            self.User.create({ username: 'someone' }).success(function(someUser) {
              self.Group.create({ name: 'people' }).success(function(someGroup) {
                someUser.setGroupPKeagerones([someGroup]).complete(function (err) {
                  expect(err).to.be.null
                  self.User.find({
                    where: {
                      username: 'someone'
                    },
                    include: [self.Group]
                  }).complete(function (err, someUser) {
                    expect(err).to.be.null
                    expect(someUser).to.exist
                    expect(someUser.username).to.equal('someone')
                    expect(someUser.GroupPKeagerones[0].name).to.equal('people')
                    done()
                  })
                })
              })
            })
          })
        })
      })

      describe('hasMany with alias', function() {
        it('throws an error if included DaoFactory is not referenced by alias', function(done) {
          var self = this
          self.Worker.find({ include: [ self.Task ] }).catch(function(err) {
            expect(err.message).to.equal('Task is not associated to Worker!');
            done()
          })
        })

        describe('alias', function() {
          beforeEach(function(done) {
            var self = this
            this.Worker.hasMany(this.Task, { as: 'ToDos' })
            this.init(function() {
              self.worker.setToDos([ self.task ]).success(function() {
                done()
              })
            })
          })

          it('throws an error if alias is not associated', function(done) {
            var self = this
            self.Worker.find({ include: [ { daoFactory: self.Task, as: 'Work' } ] }).catch(function(err) {
              expect(err.message).to.equal('Task (Work) is not associated to Worker!');
              done()
            })
          })

          it('returns the associated task via worker.task', function(done) {
            this.Worker.find({
              where:   { name: 'worker' },
              include: [ { daoFactory: this.Task, as: 'ToDos' } ]
            }).complete(function(err, worker) {
              expect(err).to.be.null
              expect(worker).to.exist
              expect(worker.ToDos).to.exist
              expect(worker.ToDos[0].title).to.equal('homework')
              done()
            })
          })

          it('returns the associated task via worker.task when daoFactory is aliased with model', function(done) {
            this.Worker.find({
              where:   { name: 'worker' },
              include: [ { model: this.Task, as: 'ToDos' } ]
            }).complete(function(err, worker) {
              expect(worker.ToDos[0].title).to.equal('homework')
              done()
            })
          })

          it('allows mulitple assocations of the same model with different alias', function (done) {
            var self = this

            this.Worker.hasMany(this.Task, { as: 'DoTos' })
            this.init(function () {
              self.Worker.find({
                include: [
                  { model: self.Task, as: 'ToDos' },
                  { model: self.Task, as: 'DoTos' }
                ]
              }).success(function () {
                // Just being able to include both shows that this test works, so no assertions needed
                done()
              })
            })
          })
        })
      })

      describe('hasMany (N:M) with alias', function () {
        beforeEach(function () {
          this.Product  = this.sequelize.define('Product', { title: Sequelize.STRING })
          this.Tag      = this.sequelize.define('Tag', { name: Sequelize.STRING })
        })

        it('returns the associated models when using through as string and alias', function (done) {
          var self = this

          this.Product.hasMany(this.Tag, {as: 'tags', through: 'product_tag'})
          this.Tag.hasMany(this.Product, {as: 'products', through: 'product_tag'})

          this.sequelize.sync().done(function () {
            async.auto({
              createProducts: function (callback) {
                self.Product.bulkCreate([
                  {title: 'Chair'},
                  {title: 'Desk'},
                  {title: 'Handbag'},
                  {title: 'Dress'},
                  {title: 'Jan'}
                ]).done(callback)
              },
              // bulkCreate doesn't include id for some reason, not going to fix tis now
              products: ['createProducts', function (callback) {
                self.Product.findAll().done(callback)
              }],
              createTags: function (callback) {
                self.Tag.bulkCreate([
                  {name: 'Furniture'},
                  {name: 'Clothing'},
                  {name: 'People'}
                ]).done(callback)
              },
              tags: ['createTags', function (callback) {
                self.Tag.findAll().done(callback)
              }],
            }, function (err, results) {
              expect(err).not.to.exist

              var products = results.products
                , tags = results.tags

              async.parallel([
                function (callback) {
                  products[0].setTags([tags[0], tags[1]]).done(callback)
                },
                function (callback) {
                  products[1].addTag(tags[0]).done(callback)
                },
                function (callback) {
                  products[2].addTag(tags[1]).done(callback)
                },
                function (callback) {
                  products[3].setTags([tags[1]]).done(callback)
                },
                function (callback) {
                  products[4].setTags([tags[2]]).done(callback)
                }
              ], function (err) {
                expect(err).not.to.exist

                async.parallel([
                  function (callback) {
                    self.Tag.find({
                      where: {
                        id: tags[0].id
                      },
                      include: [
                        {model: self.Product, as: 'products'}
                      ]
                    }).done(function (err, tag) {
                      expect(tag).to.exist
                      expect(tag.products.length).to.equal(2)
                      callback()
                    })
                  },
                  function (callback) {
                    tags[1].getProducts().done(function (err, products) {
                      expect(products.length).to.equal(3)
                      callback()
                    })
                  },
                  function (callback) {
                    self.Product.find({
                      where: {
                        id: products[0].id
                      },
                      include: [
                        {model: self.Tag, as: 'tags'}
                      ]
                    }).done(function (err, product) {
                      expect(product).to.exist
                      expect(product.tags.length).to.equal(2)
                      callback()
                    })
                  },
                  function (callback) {
                    products[1].getTags().done(function (err, tags) {
                      expect(tags.length).to.equal(1)
                      callback()
                    })
                  },
                ], done)
              })
            })
          })
        })

        it('returns the associated models when using through as model and alias', function () {
          // Exactly the same code as the previous test, just with a through model instance, and promisified
          var ProductTag = this.sequelize.define('product_tag');

          this.Product.hasMany(this.Tag, {as: 'tags', through: ProductTag})
          this.Tag.hasMany(this.Product, {as: 'products', through: ProductTag})

          return this.sequelize.sync().bind(this).then(function () {
            return Promise.all([
              this.Product.bulkCreate([
                {title: 'Chair'},
                {title: 'Desk'},
                {title: 'Handbag'},
                {title: 'Dress'},
                {title: 'Jan'}
              ]),
              this.Tag.bulkCreate([
                {name: 'Furniture'},
                {name: 'Clothing'},
                {name: 'People'}
              ])
            ]);
          }).then(function () {
            return Promise.all([
              this.Product.findAll(),
              this.Tag.findAll()
            ])
          }).spread(function (products, tags) {
            this.products = products;
            this.tags = tags;

            return Promise.all([
              products[0].setTags([tags[0], tags[1]]),
              products[1].addTag(tags[0]),
              products[2].addTag(tags[1]),
              products[3].setTags([tags[1]]),
              products[4].setTags([tags[2]])
            ])
          }).then(function () {
            return Promise.all([
              expect(this.Tag.find({
                where: {
                  id: this.tags[0].id
                },
                include: [
                  {model: this.Product, as: 'products'}
                ]
              })).to.eventually.have.property('products').to.have.length(2),
              expect(this.Product.find({
                where: {
                  id: this.products[0].id
                },
                include: [
                  {model: this.Tag, as: 'tags'}
                ]
              })).to.eventually.have.property('tags').to.have.length(2),
              expect(this.tags[1].getProducts()).to.eventually.have.length(3),
              expect(this.products[1].getTags()).to.eventually.have.length(1),
            ]);
          });
        })
      })
    })

    describe('queryOptions', function() {
      beforeEach(function(done) {
        var self = this
        this.User.create({username: 'barfooz'}).success(function(user) {
          self.user = user
          done()
        })
      })

      it("should return a DAO when queryOptions are not set", function(done) {
        var self = this
        this.User.find({ where: { username: 'barfooz'}}).done(function(err, user) {
          expect(user).to.be.instanceOf(self.User.DAO)
          done()
        })
      })

      it("should return a DAO when raw is false", function(done) {
        var self = this
        this.User.find({ where: { username: 'barfooz'}}, { raw: false }).done(function(err, user) {
          expect(user).to.be.instanceOf(self.User.DAO)
          done()
        })
      })

      it("should return raw data when raw is true", function(done) {
        var self = this
        this.User.find({ where: { username: 'barfooz'}}, { raw: true }).done(function(err, user) {
          expect(user).to.not.be.instanceOf(self.User.DAO)
          expect(user).to.be.instanceOf(Object)
          done()
        })
      })
    })
  })
})
