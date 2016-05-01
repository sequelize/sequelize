'use strict';

/* jshint -W030 */
/* jshint -W110 */
var chai = require('chai')
  , sinon = require('sinon')
  , Sequelize = require('../../../index')
  , Promise = Sequelize.Promise
  , expect = chai.expect
  , Support = require(__dirname + '/../support')
  , DataTypes = require(__dirname + '/../../../lib/data-types')
  , config = require(__dirname + '/../../config/config')
  , current = Support.sequelize
  , dialect = Support.getTestDialect();

describe(Support.getTestDialectTeaser('Model'), function() {
  beforeEach(function() {
    this.User = this.sequelize.define('User', {
      username: DataTypes.STRING,
      secretValue: DataTypes.STRING,
      data: DataTypes.STRING,
      intVal: DataTypes.INTEGER,
      theDate: DataTypes.DATE,
      aBool: DataTypes.BOOLEAN
    });

    return this.User.sync({ force: true });
  });

  describe('find', function() {
    if (current.dialect.supports.transactions) {
      it('supports transactions', function() {
        return Support.prepareTransactionTest(this.sequelize).bind({}).then(function(sequelize) {
          var User = sequelize.define('User', { username: Sequelize.STRING });

          return User.sync({ force: true }).then(function() {
            return sequelize.transaction().then(function(t) {
              return User.create({ username: 'foo' }, { transaction: t }).then(function() {
                return User.findOne({
                  where: { username: 'foo' }
                }).then(function(user1) {
                  return User.findOne({
                    where: { username: 'foo' },
                    transaction: t
                  }).then(function (user2) {
                    expect(user1).to.be.null;
                    expect(user2).to.not.be.null;
                    return t.rollback();
                  });
                });
              });
            });
          });
        });
      });
    }

    describe('general / basic function', function() {
      beforeEach(function() {
        var self = this;
        return this.User.create({username: 'barfooz'}).then(function(user) {
          self.UserPrimary = self.sequelize.define('UserPrimary', {
            specialkey: {
              type: DataTypes.STRING,
              primaryKey: true
            }
          });

          return self.UserPrimary.sync({force: true}).then(function() {
            return self.UserPrimary.create({specialkey: 'a string'}).then(function() {
              self.user = user;
            });
          });
        });
      });

      if (Support.dialectIsMySQL()) {
        // Bit fields interpreted as boolean need conversion from buffer / bool.
        // Sqlite returns the inserted value as is, and postgres really should the built in bool type instead

        it('allows bit fields as booleans', function() {
          var self = this,
            bitUser = this.sequelize.define('bituser', {
              bool: 'BIT(1)'
            }, {
              timestamps: false
            });

          // First use a custom data type def to create the bit field
          return bitUser.sync({ force: true }).then(function() {
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
          }).then(function() {
            return bitUser.findAll();
          }).then(function(bitUsers) {
            expect(bitUsers[0].bool).not.to.be.ok;
            expect(bitUsers[1].bool).to.be.ok;
          });
        });
      }

      it('does not modify the passed arguments', function() {
        var options;
        if (dialect.name === 'oracle') {
          options = { where: ['"specialkey" = ?', 'awesome']};
        } else {
          options = { where: ['specialkey = ?', 'awesome']};
        }

        return this.UserPrimary.findOne(options).then(function() {
          expect(options).to.deep.equal({ where: ['specialkey = ?', 'awesome']});
        });
      });

      it('treats questionmarks in an array', function() {
        var test = false;
        var wherestr = '';
        if (dialect.name === 'oracle') {
          wherestr = '"specialkey" = ?';
        } else {
          wherestr = 'specialkey = ?';
        }
        return this.UserPrimary.findOne({
          where: [wherestr, 'awesome'],
          logging: function(sql) {
            test = true;
            expect(sql).to.match(/WHERE specialkey = N?'awesome'/);
          }
        }).then(function() {
          expect(test).to.be.true;
        });
      });

      it('doesn\'t throw an error when entering in a non integer value for a specified primary field', function() {
        return this.UserPrimary.findById('a string').then(function(user) {
          expect(user.specialkey).to.equal('a string');
        });
      });

      it('returns a single dao', function() {
        var self = this;
        return this.User.findById(this.user.id).then(function(user) {
          expect(Array.isArray(user)).to.not.be.ok;
          expect(user.id).to.equal(self.user.id);
          expect(user.id).to.equal(1);
        });
      });

      it('returns a single dao given a string id', function() {
        var self = this;
        return this.User.findById(this.user.id + '').then(function(user) {
          expect(Array.isArray(user)).to.not.be.ok;
          expect(user.id).to.equal(self.user.id);
          expect(user.id).to.equal(1);
        });
      });

      it('should make aliased attributes available', function() {
        return this.User.findOne({
          where: { id: 1 },
          attributes: ['id', ['username', 'name']]
        }).then(function(user) {
          expect(user.dataValues.name).to.equal('barfooz');
        });
      });

      it('should not try to convert boolean values if they are not selected', function() {
        var UserWithBoolean = this.sequelize.define('UserBoolean', {
          active: Sequelize.BOOLEAN
        });

        return UserWithBoolean.sync({force: true}).then(function() {
          return UserWithBoolean.create({ active: true }).then(function(user) {
            return UserWithBoolean.findOne({ where: { id: user.id }, attributes: ['id'] }).then(function(user) {
              expect(user.active).not.to.exist;
            });
          });
        });
      });

      it('finds a specific user via where option', function() {
        return this.User.findOne({ where: { username: 'barfooz' } }).then(function(user) {
          expect(user.username).to.equal('barfooz');
        });
      });

      it('doesn\'t find a user if conditions are not matching', function() {
        return this.User.findOne({ where: { username: 'foo' } }).then(function(user) {
          expect(user).to.be.null;
        });
      });

      it('allows sql logging', function() {
        var test = false;
        return this.User.findOne({
          where: { username: 'foo' },
          logging: function(sql) {
            test = true;
            expect(sql).to.exist;
            expect(sql.toUpperCase().indexOf('SELECT')).to.be.above(-1);
          }
        }).then(function() {
          expect(test).to.be.true;
        });
      });

      it('ignores passed limit option', function() {
        return this.User.findOne({ limit: 10 }).then(function(user) {
          // it returns an object instead of an array
          expect(Array.isArray(user)).to.not.be.ok;
          expect(user.dataValues.hasOwnProperty('username')).to.be.ok;
        });
      });

      it('finds entries via primary keys', function() {
        var self = this
          , UserPrimary = self.sequelize.define('UserWithPrimaryKey', {
              identifier: {type: Sequelize.STRING, primaryKey: true},
              name: Sequelize.STRING
            });

        return UserPrimary.sync({ force: true }).then(function() {
          return UserPrimary.create({
            identifier: 'an identifier',
            name: 'John'
          }).then(function(u) {
            expect(u.id).not.to.exist;
            return UserPrimary.findById('an identifier').then(function(u2) {
              expect(u2.identifier).to.equal('an identifier');
              expect(u2.name).to.equal('John');
            });
          });
        });
      });

      it('finds entries via a string primary key called id', function() {
        var self = this
          , UserPrimary = self.sequelize.define('UserWithPrimaryKey', {
              id: {type: Sequelize.STRING, primaryKey: true},
              name: Sequelize.STRING
            });

        return UserPrimary.sync({ force: true }).then(function() {
          return UserPrimary.create({
            id: 'a string based id',
            name: 'Johnno'
          }).then(function() {
            return UserPrimary.findById('a string based id').then(function(u2) {
              expect(u2.id).to.equal('a string based id');
              expect(u2.name).to.equal('Johnno');
            });
          });
        });
      });

      it('always honors ZERO as primary key', function() {
        var self = this
          , permutations = [
            0,
            '0'
          ]
          , count = 0;

        return this.User.bulkCreate([{username: 'jack'}, {username: 'jack'}]).then(function() {
          return self.sequelize.Promise.map(permutations, function(perm) {
            return self.User.findById(perm, {
              logging: function(s) {
                expect(s.indexOf(0)).not.to.equal(-1);
                count++;
              }
            }).then(function(user) {
              expect(user).to.be.null;
            });
          });
        }).then(function() {
          expect(count).to.be.equal(permutations.length);
        });
      });

      it('should allow us to find IDs using capital letters', function() {
        var User = this.sequelize.define('User' + config.rand(), {
          ID: { type: Sequelize.INTEGER, primaryKey: true, autoIncrement: true },
          Login: { type: Sequelize.STRING }
        });

        return User.sync({ force: true }).then(function() {
          return User.create({Login: 'foo'}).then(function() {
            return User.findById(1).then(function(user) {
              expect(user).to.exist;
              expect(user.ID).to.equal(1);
            });
          });
        });
      });
    });

    describe('eager loading', function() {
      beforeEach(function() {
        var self = this;
        self.Task = self.sequelize.define('Task', { title: Sequelize.STRING });
        self.Worker = self.sequelize.define('Worker', { name: Sequelize.STRING });

        this.init = function(callback) {
          return self.sequelize.sync({ force: true }).then(function() {
            return self.Worker.create({ name: 'worker' }).then(function(worker) {
              return self.Task.create({ title: 'homework' }).then(function(task) {
                self.worker = worker;
                self.task = task;
                return callback();
              });
            });
          });
        };
      });

      describe('belongsTo', function() {
        describe('generic', function() {
          it('throws an error about unexpected input if include contains a non-object', function() {
            var self = this;
            return self.Worker.findOne({ include: [1] }).catch (function(err) {
              expect(err.message).to.equal('Include unexpected. Element has to be either a Model, an Association or an object.');
            });
          });

          it('throws an error if included DaoFactory is not associated', function() {
            var self = this;
            return self.Worker.findOne({ include: [self.Task] }).catch (function(err) {
              expect(err.message).to.equal('Task is not associated to Worker!');
            });
          });

          it('returns the associated worker via task.worker', function() {
            var self = this;
            this.Task.belongsTo(this.Worker);
            return this.init(function() {
              return self.task.setWorker(self.worker).then(function() {
                return self.Task.findOne({
                  where: { title: 'homework' },
                  include: [self.Worker]
                }).then(function(task) {
                  expect(task).to.exist;
                  expect(task.Worker).to.exist;
                  expect(task.Worker.name).to.equal('worker');
                });
              });
            });
          });
        });

        it('returns the private and public ip', function() {
          var self = Object.create(this);
          self.Domain = self.sequelize.define('Domain', { ip: Sequelize.STRING });
          self.Environment = self.sequelize.define('Environment', { name: Sequelize.STRING });
          self.Environment.belongsTo(self.Domain, { as: 'PrivateDomain', foreignKey: 'privateDomainId' });
          self.Environment.belongsTo(self.Domain, { as: 'PublicDomain', foreignKey: 'publicDomainId' });

          return self.Domain.sync({ force: true }).then(function() {
            return self.Environment.sync({ force: true }).then(function() {
              return self.Domain.create({ ip: '192.168.0.1' }).then(function(privateIp) {
                return self.Domain.create({ ip: '91.65.189.19' }).then(function(publicIp) {
                  return self.Environment.create({ name: 'environment' }).then(function(env) {
                    return env.setPrivateDomain(privateIp).then(function() {
                      return env.setPublicDomain(publicIp).then(function() {
                        return self.Environment.findOne({
                          where: { name: 'environment' },
                          include: [
                            { model: self.Domain, as: 'PrivateDomain' },
                            { model: self.Domain, as: 'PublicDomain' }
                          ]
                        }).then(function(environment) {
                          expect(environment).to.exist;
                          expect(environment.PrivateDomain).to.exist;
                          expect(environment.PrivateDomain.ip).to.equal('192.168.0.1');
                          expect(environment.PublicDomain).to.exist;
                          expect(environment.PublicDomain.ip).to.equal('91.65.189.19');
                        });
                      });
                    });
                  });
                });
              });
            });
          });
        });

        it('eager loads with non-id primary keys', function() {
          var self = this;
          self.User = self.sequelize.define('UserPKeagerbelong', {
            username: {
              type: Sequelize.STRING,
              primaryKey: true
            }
          });
          self.Group = self.sequelize.define('GroupPKeagerbelong', {
            name: {
              type: Sequelize.STRING,
              primaryKey: true
            }
          });
          self.User.belongsTo(self.Group);

          return self.sequelize.sync({ force: true }).then(function() {
            return self.Group.create({ name: 'people' }).then(function() {
              return self.User.create({ username: 'someone', GroupPKeagerbelongName: 'people' }).then(function() {
                return self.User.findOne({
                  where: {
                    username: 'someone'
                  },
                  include: [self.Group]
                }).then(function(someUser) {
                  expect(someUser).to.exist;
                  expect(someUser.username).to.equal('someone');
                  expect(someUser.GroupPKeagerbelong.name).to.equal('people');
                });
              });
            });
          });
        });

        it('getting parent data in many to one relationship', function() {
          var User = this.sequelize.define('User', {
            id: {type: Sequelize.INTEGER, autoIncrement: true, primaryKey: true},
            username: {type: Sequelize.STRING}
          });

          var Message = this.sequelize.define('Message', {
            id: {type: Sequelize.INTEGER, autoIncrement: true, primaryKey: true},
            user_id: {type: Sequelize.INTEGER},
            message: {type: Sequelize.STRING}
          });

          User.hasMany(Message);
          Message.belongsTo(User, { foreignKey: 'user_id' });

          return this.sequelize.sync({ force: true }).then(function() {
            return User.create({username: 'test_testerson'}).then(function(user) {
              return Message.create({user_id: user.id, message: 'hi there!'}).then(function() {
                return Message.create({user_id: user.id, message: 'a second message'}).then(function() {
                  return Message.findAll({
                    where: {user_id: user.id},
                    attributes: [
                      'user_id',
                      'message'
                    ],
                    include: [{ model: User, attributes: ['username'] }]
                  }).then(function(messages) {
                    expect(messages.length).to.equal(2);

                    expect(messages[0].message).to.equal('hi there!');
                    expect(messages[0].User.username).to.equal('test_testerson');

                    expect(messages[1].message).to.equal('a second message');
                    expect(messages[1].User.username).to.equal('test_testerson');
                  });
                });
              });
            });
          });
        });

        it('allows mulitple assocations of the same model with different alias', function() {
          var self = this;

          this.Worker.belongsTo(this.Task, { as: 'ToDo' });
          this.Worker.belongsTo(this.Task, { as: 'DoTo' });
          return this.init(function() {
            return self.Worker.findOne({
              include: [
                { model: self.Task, as: 'ToDo' },
                { model: self.Task, as: 'DoTo' }
              ]
            });
          });
        });
      });

      describe('hasOne', function() {
        beforeEach(function() {
          var self = this;
          this.Worker.hasOne(this.Task);
          return this.init(function() {
            return self.worker.setTask(self.task);
          });
        });

        it('throws an error if included DaoFactory is not associated', function() {
          var self = this;
          return self.Task.findOne({ include: [self.Worker] }).catch (function(err) {
            expect(err.message).to.equal('Worker is not associated to Task!');
          });
        });

        it('returns the associated task via worker.task', function() {
          return this.Worker.findOne({
            where: { name: 'worker' },
            include: [this.Task]
          }).then(function(worker) {
            expect(worker).to.exist;
            expect(worker.Task).to.exist;
            expect(worker.Task.title).to.equal('homework');
          });
        });

        it('eager loads with non-id primary keys', function() {
          var self = this;
          self.User = self.sequelize.define('UserPKeagerone', {
            username: {
              type: Sequelize.STRING,
              primaryKey: true
            }
          });
          self.Group = self.sequelize.define('GroupPKeagerone', {
            name: {
              type: Sequelize.STRING,
              primaryKey: true
            }
          });
          self.Group.hasOne(self.User);

          return self.sequelize.sync({ force: true }).then(function() {
            return self.Group.create({ name: 'people' }).then(function() {
              return self.User.create({ username: 'someone', GroupPKeageroneName: 'people' }).then(function() {
                return self.Group.findOne({
                  where: {
                    name: 'people'
                  },
                  include: [self.User]
                }).then(function(someGroup) {
                  expect(someGroup).to.exist;
                  expect(someGroup.name).to.equal('people');
                  expect(someGroup.UserPKeagerone.username).to.equal('someone');
                });
              });
            });
          });
        });
      });

      describe('hasOne with alias', function() {
        it('throws an error if included DaoFactory is not referenced by alias', function() {
          var self = this;
          return self.Worker.findOne({ include: [self.Task] }).catch (function(err) {
            expect(err.message).to.equal('Task is not associated to Worker!');
          });
        });

        describe('alias', function() {
          beforeEach(function() {
            var self = this;
            this.Worker.hasOne(this.Task, { as: 'ToDo' });
            return this.init(function() {
              return self.worker.setToDo(self.task);
            });
          });

          it('throws an error if alias is not associated', function() {
            var self = this;
            return self.Worker.findOne({ include: [{ model: self.Task, as: 'Work' }] }).catch (function(err) {
              expect(err.message).to.equal('Task (Work) is not associated to Worker!');
            });
          });

          it('returns the associated task via worker.task', function() {
            return this.Worker.findOne({
              where: { name: 'worker' },
              include: [{ model: this.Task, as: 'ToDo' }]
            }).then(function(worker) {
              expect(worker).to.exist;
              expect(worker.ToDo).to.exist;
              expect(worker.ToDo.title).to.equal('homework');
            });
          });

          it('returns the associated task via worker.task when daoFactory is aliased with model', function() {
            return this.Worker.findOne({
              where: { name: 'worker' },
              include: [{ model: this.Task, as: 'ToDo' }]
            }).then(function(worker) {
              expect(worker.ToDo.title).to.equal('homework');
            });
          });

           it('allows mulitple assocations of the same model with different alias', function() {
            var self = this;

            this.Worker.hasOne(this.Task, { as: 'DoTo' });
            return this.init(function() {
              return self.Worker.findOne({
                include: [
                  { model: self.Task, as: 'ToDo' },
                  { model: self.Task, as: 'DoTo' }
                ]
              });
            });
          });
        });
      });

      describe('hasMany', function() {
        beforeEach(function() {
          var self = this;
          this.Worker.hasMany(this.Task);
          return this.init(function() {
            return self.worker.setTasks([self.task]);
          });
        });

        it('throws an error if included DaoFactory is not associated', function() {
          var self = this;
          return self.Task.findOne({ include: [self.Worker] }).catch (function(err) {
            expect(err.message).to.equal('Worker is not associated to Task!');
          });
        });

        it('returns the associated tasks via worker.tasks', function() {
          return this.Worker.findOne({
            where: { name: 'worker' },
            include: [this.Task]
          }).then(function(worker) {
            expect(worker).to.exist;
            expect(worker.Tasks).to.exist;
            expect(worker.Tasks[0].title).to.equal('homework');
          });
        });

        it('including two has many relations should not result in duplicate values', function() {
          var self = this;

          self.Contact = self.sequelize.define('Contact', { name: DataTypes.STRING });
          self.Photo = self.sequelize.define('Photo', { img: DataTypes.TEXT });
          self.PhoneNumber = self.sequelize.define('PhoneNumber', { phone: DataTypes.TEXT });

          self.Contact.hasMany(self.Photo, { as: 'Photos' });
          self.Contact.hasMany(self.PhoneNumber);

          return self.sequelize.sync({ force: true }).then(function() {
            return self.Contact.create({ name: 'Boris' }).then(function(someContact) {
              return self.Photo.create({ img: 'img.jpg' }).then(function(somePhoto) {
                return self.PhoneNumber.create({ phone: '000000' }).then(function(somePhone1) {
                  return self.PhoneNumber.create({ phone: '111111' }).then(function(somePhone2) {
                    return someContact.setPhotos([somePhoto]).then(function() {
                      return someContact.setPhoneNumbers([somePhone1, somePhone2]).then(function() {
                        return self.Contact.findOne({
                          where: {
                            name: 'Boris'
                          },
                          include: [self.PhoneNumber, { model: self.Photo, as: 'Photos' }]
                        }).then(function(fetchedContact) {
                          expect(fetchedContact).to.exist;
                          expect(fetchedContact.Photos.length).to.equal(1);
                          expect(fetchedContact.PhoneNumbers.length).to.equal(2);
                        });
                      });
                    });
                  });
                });
              });
            });
          });
        });

        it('eager loads with non-id primary keys', function() {
          var self = this;
          self.User = self.sequelize.define('UserPKeagerone', {
            username: {
              type: Sequelize.STRING,
              primaryKey: true
            }
          });
          self.Group = self.sequelize.define('GroupPKeagerone', {
            name: {
              type: Sequelize.STRING,
              primaryKey: true
            }
          });
          self.Group.belongsToMany(self.User, {through: 'group_user'});
          self.User.belongsToMany(self.Group, {through: 'group_user'});

          return self.sequelize.sync({ force: true }).then(function() {
            return self.User.create({ username: 'someone' }).then(function(someUser) {
              return self.Group.create({ name: 'people' }).then(function(someGroup) {
                return someUser.setGroupPKeagerones([someGroup]).then(function() {
                  return self.User.findOne({
                    where: {
                      username: 'someone'
                    },
                    include: [self.Group]
                  }).then(function(someUser) {
                    expect(someUser).to.exist;
                    expect(someUser.username).to.equal('someone');
                    expect(someUser.GroupPKeagerones[0].name).to.equal('people');
                  });
                });
              });
            });
          });
        });
      });

      describe('hasMany with alias', function() {
        it('throws an error if included DaoFactory is not referenced by alias', function() {
          var self = this;
          return self.Worker.findOne({ include: [self.Task] }).catch (function(err) {
            expect(err.message).to.equal('Task is not associated to Worker!');
          });
        });

        describe('alias', function() {
          beforeEach(function() {
            var self = this;
            this.Worker.hasMany(this.Task, { as: 'ToDos' });
            return this.init(function() {
              return self.worker.setToDos([self.task]);
            });
          });

          it('throws an error if alias is not associated', function() {
            var self = this;
            return self.Worker.findOne({ include: [{ model: self.Task, as: 'Work' }] }).catch (function(err) {
              expect(err.message).to.equal('Task (Work) is not associated to Worker!');
            });
          });

          it('returns the associated task via worker.task', function() {
            return this.Worker.findOne({
              where: { name: 'worker' },
              include: [{ model: this.Task, as: 'ToDos' }]
            }).then(function(worker) {
              expect(worker).to.exist;
              expect(worker.ToDos).to.exist;
              expect(worker.ToDos[0].title).to.equal('homework');
            });
          });

          it('returns the associated task via worker.task when daoFactory is aliased with model', function() {
            return this.Worker.findOne({
              where: { name: 'worker' },
              include: [{ model: this.Task, as: 'ToDos' }]
            }).then(function(worker) {
              expect(worker.ToDos[0].title).to.equal('homework');
            });
          });

          it('allows mulitple assocations of the same model with different alias', function() {
            var self = this;

            this.Worker.hasMany(this.Task, { as: 'DoTos' });
            return this.init(function() {
              return self.Worker.findOne({
                include: [
                  { model: self.Task, as: 'ToDos' },
                  { model: self.Task, as: 'DoTos' }
                ]
              });
            });
          });
        });
      });

      describe('hasMany (N:M) with alias', function() {
        beforeEach(function() {
          this.Product = this.sequelize.define('Product', { title: Sequelize.STRING });
          this.Tag = this.sequelize.define('Tag', { name: Sequelize.STRING });
        });

        it('returns the associated models when using through as string and alias', function() {
          var self = this;

          this.Product.belongsToMany(this.Tag, {as: 'tags', through: 'product_tag'});
          this.Tag.belongsToMany(this.Product, {as: 'products', through: 'product_tag'});

          return this.sequelize.sync().then(function() {
            return Promise.all([
              self.Product.bulkCreate([
                {title: 'Chair'},
                {title: 'Desk'},
                {title: 'Handbag'},
                {title: 'Dress'},
                {title: 'Jan'}
              ]),
              self.Tag.bulkCreate([
                {name: 'Furniture'},
                {name: 'Clothing'},
                {name: 'People'}
              ])
            ]).then(function() {
              return Promise.all([
                self.Product.findAll(),
                self.Tag.findAll()
              ]);
            }).spread(function(products, tags) {
              self.products = products;
              self.tags = tags;
              return Promise.all([
                  products[0].setTags([tags[0], tags[1]]),
                  products[1].addTag(tags[0]),
                  products[2].addTag(tags[1]),
                  products[3].setTags([tags[1]]),
                  products[4].setTags([tags[2]])
              ]).then(function() {
                return Promise.all([
                  self.Tag.findOne({
                    where: {
                      id: tags[0].id
                    },
                    include: [
                      {model: self.Product, as: 'products'}
                    ]
                  }).then(function(tag) {
                    expect(tag).to.exist;
                    expect(tag.products.length).to.equal(2);
                  }),
                  tags[1].getProducts().then(function(products) {
                    expect(products.length).to.equal(3);
                  }),
                  self.Product.findOne({
                    where: {
                      id: products[0].id
                    },
                    include: [
                      {model: self.Tag, as: 'tags'}
                    ]
                  }).then(function(product) {
                    expect(product).to.exist;
                    expect(product.tags.length).to.equal(2);
                  }),
                  products[1].getTags().then(function(tags) {
                    expect(tags.length).to.equal(1);
                  })
                ]);
              });
            });
          });
        });

        it('returns the associated models when using through as model and alias', function() {
          // Exactly the same code as the previous test, just with a through model instance, and promisified
          var ProductTag = this.sequelize.define('product_tag');

          this.Product.belongsToMany(this.Tag, {as: 'tags', through: ProductTag});
          this.Tag.belongsToMany(this.Product, {as: 'products', through: ProductTag});

          return this.sequelize.sync().bind(this).then(function() {
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
          }).then(function() {
            return Promise.all([
              this.Product.findAll(),
              this.Tag.findAll()
            ]);
          }).spread(function(products, tags) {
            this.products = products;
            this.tags = tags;

            return Promise.all([
              products[0].setTags([tags[0], tags[1]]),
              products[1].addTag(tags[0]),
              products[2].addTag(tags[1]),
              products[3].setTags([tags[1]]),
              products[4].setTags([tags[2]])
            ]);
          }).then(function() {
            return Promise.all([
              expect(this.Tag.findOne({
                where: {
                  id: this.tags[0].id
                },
                include: [
                  {model: this.Product, as: 'products'}
                ]
              })).to.eventually.have.property('products').to.have.length(2),
              expect(this.Product.findOne({
                where: {
                  id: this.products[0].id
                },
                include: [
                  {model: this.Tag, as: 'tags'}
                ]
              })).to.eventually.have.property('tags').to.have.length(2),
              expect(this.tags[1].getProducts()).to.eventually.have.length(3),
              expect(this.products[1].getTags()).to.eventually.have.length(1)
            ]);
          });
        });
      });
    });

    describe('queryOptions', function() {
      beforeEach(function() {
        var self = this;
        return this.User.create({username: 'barfooz'}).then(function(user) {
          self.user = user;
        });
      });

      it('should return a DAO when queryOptions are not set', function() {
        var self = this;
        return this.User.findOne({ where: { username: 'barfooz'}}).then(function(user) {
          expect(user).to.be.instanceOf(self.User.Instance);
        });
      });

      it('should return a DAO when raw is false', function() {
        var self = this;
        return this.User.findOne({ where: { username: 'barfooz'}, raw: false }).then(function(user) {
          expect(user).to.be.instanceOf(self.User.Instance);
        });
      });

      it('should return raw data when raw is true', function() {
        var self = this;
        return this.User.findOne({ where: { username: 'barfooz'}, raw: true }).then(function(user) {
          expect(user).to.not.be.instanceOf(self.User.Instance);
          expect(user).to.be.instanceOf(Object);
        });
      });
    });

    it('should support logging', function () {
      var spy = sinon.spy();

      return this.User.findOne({
        where: {},
        logging: spy
      }).then(function () {
        expect(spy.called).to.be.ok;
      });
    });

    describe('rejectOnEmpty mode', function() {
      it('throws error when record not found by findOne', function() {
        return expect(this.User.findOne({
          where: {
            username: 'ath-kantam-pradakshnami'
          },
          rejectOnEmpty: true
        })).to.eventually.be.rejectedWith(Sequelize.EmptyResultError);
      });

      it('throws error when record not found by findById', function() {
        return expect(this.User.findById(4732322332323333232344334354234, {
          rejectOnEmpty: true
        })).to.eventually.be.rejectedWith(Sequelize.EmptyResultError);
      });

      it('throws error when record not found by find', function() {
        return expect(this.User.find({
          where: {
            username: 'some-username-that-is-not-used-anywhere'
          },
          rejectOnEmpty: true
        })).to.eventually.be.rejectedWith(Sequelize.EmptyResultError);
      });

      it('works from model options', function() {
        var Model = current.define('Test', {
          username: Sequelize.STRING(100)
        },{
          rejectOnEmpty: true
        });

        return Model.sync({ force: true })
          .then(function() {
            return expect(Model.findOne({
              where: {
                username: 'some-username-that-is-not-used-anywhere'
              }
            })).to.eventually.be.rejectedWith(Sequelize.EmptyResultError);
          });
      });

      it('resolve null when disabled', function() {
        var Model = current.define('Test', {
          username: Sequelize.STRING(100)
        });

        return Model.sync({ force: true })
          .then(function() {
            return expect(Model.findOne({
              where: {
                username: 'some-username-that-is-not-used-anywhere-for-sure-this-time'
              }
            })).to.eventually.be.equal(null);
          });
      });

    });

  });
});
