'use strict';

const chai = require('chai'),
  sinon = require('sinon'),
  Sequelize = require('../../../index'),
  Promise = Sequelize.Promise,
  expect = chai.expect,
  Support = require('../support'),
  dialect = Support.getTestDialect(),
  DataTypes = require('../../../lib/data-types'),
  config = require('../../config/config'),
  current = Support.sequelize;

describe(Support.getTestDialectTeaser('Model'), () => {
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

  describe('findOne', () => {
    if (current.dialect.supports.transactions) {
      it('supports transactions', function() {
        return Support.prepareTransactionTest(this.sequelize).then(sequelize => {
          const User = sequelize.define('User', { username: Sequelize.STRING });

          return User.sync({ force: true }).then(() => {
            return sequelize.transaction().then(t => {
              return User.create({ username: 'foo' }, { transaction: t }).then(() => {
                return User.findOne({
                  where: { username: 'foo' }
                }).then(user1 => {
                  return User.findOne({
                    where: { username: 'foo' },
                    transaction: t
                  }).then(user2 => {
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

    describe('general / basic function', () => {
      beforeEach(function() {
        return this.User.create({ username: 'barfooz' }).then(user => {
          this.UserPrimary = this.sequelize.define('UserPrimary', {
            specialkey: {
              type: DataTypes.STRING,
              primaryKey: true
            }
          });

          return this.UserPrimary.sync({ force: true }).then(() => {
            return this.UserPrimary.create({ specialkey: 'a string' }).then(() => {
              this.user = user;
            });
          });
        });
      });

      if (dialect === 'mysql') {
        // Bit fields interpreted as boolean need conversion from buffer / bool.
        // Sqlite returns the inserted value as is, and postgres really should the built in bool type instead

        it('allows bit fields as booleans', function() {
          let bitUser = this.sequelize.define('bituser', {
            bool: 'BIT(1)'
          }, {
            timestamps: false
          });

          // First use a custom data type def to create the bit field
          return bitUser.sync({ force: true }).then(() => {
            // Then change the definition to BOOLEAN
            bitUser = this.sequelize.define('bituser', {
              bool: DataTypes.BOOLEAN
            }, {
              timestamps: false
            });

            return bitUser.bulkCreate([
              { bool: 0 },
              { bool: 1 }
            ]);
          }).then(() => {
            return bitUser.findAll();
          }).then(bitUsers => {
            expect(bitUsers[0].bool).not.to.be.ok;
            expect(bitUsers[1].bool).to.be.ok;
          });
        });
      }

      it('treats questionmarks in an array', function() {
        let test = false;
        return this.UserPrimary.findOne({
          where: { 'specialkey': 'awesome' },
          logging(sql) {
            test = true;
            expect(sql).to.match(/WHERE ["|`|[]UserPrimary["|`|\]]\.["|`|[]specialkey["|`|\]] = N?'awesome'/);
          }
        }).then(() => {
          expect(test).to.be.true;
        });
      });

      it('doesn\'t throw an error when entering in a non integer value for a specified primary field', function() {
        return this.UserPrimary.findByPk('a string').then(user => {
          expect(user.specialkey).to.equal('a string');
        });
      });

      it('returns a single dao', function() {
        return this.User.findByPk(this.user.id).then(user => {
          expect(Array.isArray(user)).to.not.be.ok;
          expect(user.id).to.equal(this.user.id);
          expect(user.id).to.equal(1);
        });
      });

      it('returns a single dao given a string id', function() {
        return this.User.findByPk(this.user.id.toString()).then(user => {
          expect(Array.isArray(user)).to.not.be.ok;
          expect(user.id).to.equal(this.user.id);
          expect(user.id).to.equal(1);
        });
      });

      it('should make aliased attributes available', function() {
        return this.User.findOne({
          where: { id: 1 },
          attributes: ['id', ['username', 'name']]
        }).then(user => {
          expect(user.dataValues.name).to.equal('barfooz');
        });
      });

      it('should fail with meaningful error message on invalid attributes definition', function() {
        expect(this.User.findOne({
          where: { id: 1 },
          attributes: ['id', ['username']]
        })).to.be.rejectedWith('["username"] is not a valid attribute definition. Please use the following format: [\'attribute definition\', \'alias\']');
      });

      it('should not try to convert boolean values if they are not selected', function() {
        const UserWithBoolean = this.sequelize.define('UserBoolean', {
          active: Sequelize.BOOLEAN
        });

        return UserWithBoolean.sync({ force: true }).then(() => {
          return UserWithBoolean.create({ active: true }).then(user => {
            return UserWithBoolean.findOne({ where: { id: user.id }, attributes: ['id'] }).then(user => {
              expect(user.active).not.to.exist;
            });
          });
        });
      });

      it('finds a specific user via where option', function() {
        return this.User.findOne({ where: { username: 'barfooz' } }).then(user => {
          expect(user.username).to.equal('barfooz');
        });
      });

      it('doesn\'t find a user if conditions are not matching', function() {
        return this.User.findOne({ where: { username: 'foo' } }).then(user => {
          expect(user).to.be.null;
        });
      });

      it('allows sql logging', function() {
        let test = false;
        return this.User.findOne({
          where: { username: 'foo' },
          logging(sql) {
            test = true;
            expect(sql).to.exist;
            expect(sql.toUpperCase()).to.include('SELECT');
          }
        }).then(() => {
          expect(test).to.be.true;
        });
      });

      it('ignores passed limit option', function() {
        return this.User.findOne({ limit: 10 }).then(user => {
          // it returns an object instead of an array
          expect(Array.isArray(user)).to.not.be.ok;
          expect(user.dataValues.hasOwnProperty('username')).to.be.ok;
        });
      });

      it('finds entries via primary keys', function() {
        const UserPrimary = this.sequelize.define('UserWithPrimaryKey', {
          identifier: { type: Sequelize.STRING, primaryKey: true },
          name: Sequelize.STRING
        });

        return UserPrimary.sync({ force: true }).then(() => {
          return UserPrimary.create({
            identifier: 'an identifier',
            name: 'John'
          }).then(u => {
            expect(u.id).not.to.exist;
            return UserPrimary.findByPk('an identifier').then(u2 => {
              expect(u2.identifier).to.equal('an identifier');
              expect(u2.name).to.equal('John');
            });
          });
        });
      });

      it('finds entries via a string primary key called id', function() {
        const UserPrimary = this.sequelize.define('UserWithPrimaryKey', {
          id: { type: Sequelize.STRING, primaryKey: true },
          name: Sequelize.STRING
        });

        return UserPrimary.sync({ force: true }).then(() => {
          return UserPrimary.create({
            id: 'a string based id',
            name: 'Johnno'
          }).then(() => {
            return UserPrimary.findByPk('a string based id').then(u2 => {
              expect(u2.id).to.equal('a string based id');
              expect(u2.name).to.equal('Johnno');
            });
          });
        });
      });

      it('always honors ZERO as primary key', function() {
        const permutations = [
          0,
          '0'
        ];
        let count = 0;

        return this.User.bulkCreate([{ username: 'jack' }, { username: 'jack' }]).then(() => {
          return Sequelize.Promise.map(permutations, perm => {
            return this.User.findByPk(perm, {
              logging(s) {
                expect(s).to.include(0);
                count++;
              }
            }).then(user => {
              expect(user).to.be.null;
            });
          });
        }).then(() => {
          expect(count).to.be.equal(permutations.length);
        });
      });

      it('should allow us to find IDs using capital letters', function() {
        const User = this.sequelize.define(`User${config.rand()}`, {
          ID: { type: Sequelize.INTEGER, primaryKey: true, autoIncrement: true },
          Login: { type: Sequelize.STRING }
        });

        return User.sync({ force: true }).then(() => {
          return User.create({ Login: 'foo' }).then(() => {
            return User.findByPk(1).then(user => {
              expect(user).to.exist;
              expect(user.ID).to.equal(1);
            });
          });
        });
      });

      if (dialect === 'postgres' || dialect === 'sqlite') {
        it('should allow case-insensitive find on CITEXT type', function() {
          const User = this.sequelize.define('UserWithCaseInsensitiveName', {
            username: Sequelize.CITEXT
          });

          return User.sync({ force: true }).then(() => {
            return User.create({ username: 'longUserNAME' });
          }).then(() => {
            return User.findOne({ where: { username: 'LONGusername' } });
          }).then(user => {
            expect(user).to.exist;
            expect(user.username).to.equal('longUserNAME');
          });
        });
      }
    });

    describe('eager loading', () => {
      beforeEach(function() {
        this.Task = this.sequelize.define('Task', { title: Sequelize.STRING });
        this.Worker = this.sequelize.define('Worker', { name: Sequelize.STRING });

        this.init = function(callback) {
          return this.sequelize.sync({ force: true }).then(() => {
            return this.Worker.create({ name: 'worker' }).then(worker => {
              return this.Task.create({ title: 'homework' }).then(task => {
                this.worker = worker;
                this.task = task;
                return callback();
              });
            });
          });
        };
      });

      describe('belongsTo', () => {
        describe('generic', () => {
          it('throws an error about unexpected input if include contains a non-object', function() {
            return this.Worker.findOne({ include: [1] }).catch(err => {
              expect(err.message).to.equal('Include unexpected. Element has to be either a Model, an Association or an object.');
            });
          });

          it('throws an error if included DaoFactory is not associated', function() {
            return this.Worker.findOne({ include: [this.Task] }).catch(err => {
              expect(err.message).to.equal('Task is not associated to Worker!');
            });
          });

          it('returns the associated worker via task.worker', function() {
            this.Task.belongsTo(this.Worker);
            return this.init(() => {
              return this.task.setWorker(this.worker).then(() => {
                return this.Task.findOne({
                  where: { title: 'homework' },
                  include: [this.Worker]
                }).then(task => {
                  expect(task).to.exist;
                  expect(task.Worker).to.exist;
                  expect(task.Worker.name).to.equal('worker');
                });
              });
            });
          });
        });

        it('returns the private and public ip', function() {
          const ctx = Object.create(this);
          ctx.Domain = ctx.sequelize.define('Domain', { ip: Sequelize.STRING });
          ctx.Environment = ctx.sequelize.define('Environment', { name: Sequelize.STRING });
          ctx.Environment.belongsTo(ctx.Domain, { as: 'PrivateDomain', foreignKey: 'privateDomainId' });
          ctx.Environment.belongsTo(ctx.Domain, { as: 'PublicDomain', foreignKey: 'publicDomainId' });

          return ctx.Domain.sync({ force: true }).then(() => {
            return ctx.Environment.sync({ force: true }).then(() => {
              return ctx.Domain.create({ ip: '192.168.0.1' }).then(privateIp => {
                return ctx.Domain.create({ ip: '91.65.189.19' }).then(publicIp => {
                  return ctx.Environment.create({ name: 'environment' }).then(env => {
                    return env.setPrivateDomain(privateIp).then(() => {
                      return env.setPublicDomain(publicIp).then(() => {
                        return ctx.Environment.findOne({
                          where: { name: 'environment' },
                          include: [
                            { model: ctx.Domain, as: 'PrivateDomain' },
                            { model: ctx.Domain, as: 'PublicDomain' }
                          ]
                        }).then(environment => {
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
          this.User = this.sequelize.define('UserPKeagerbelong', {
            username: {
              type: Sequelize.STRING,
              primaryKey: true
            }
          });
          this.Group = this.sequelize.define('GroupPKeagerbelong', {
            name: {
              type: Sequelize.STRING,
              primaryKey: true
            }
          });
          this.User.belongsTo(this.Group);

          return this.sequelize.sync({ force: true }).then(() => {
            return this.Group.create({ name: 'people' }).then(() => {
              return this.User.create({ username: 'someone', GroupPKeagerbelongName: 'people' }).then(() => {
                return this.User.findOne({
                  where: {
                    username: 'someone'
                  },
                  include: [this.Group]
                }).then(someUser => {
                  expect(someUser).to.exist;
                  expect(someUser.username).to.equal('someone');
                  expect(someUser.GroupPKeagerbelong.name).to.equal('people');
                });
              });
            });
          });
        });

        it('getting parent data in many to one relationship', function() {
          const User = this.sequelize.define('User', {
            id: { type: Sequelize.INTEGER, autoIncrement: true, primaryKey: true },
            username: { type: Sequelize.STRING }
          });

          const Message = this.sequelize.define('Message', {
            id: { type: Sequelize.INTEGER, autoIncrement: true, primaryKey: true },
            user_id: { type: Sequelize.INTEGER },
            message: { type: Sequelize.STRING }
          });

          User.hasMany(Message);
          Message.belongsTo(User, { foreignKey: 'user_id' });

          return this.sequelize.sync({ force: true }).then(() => {
            return User.create({ username: 'test_testerson' }).then(user => {
              return Message.create({ user_id: user.id, message: 'hi there!' }).then(() => {
                return Message.create({ user_id: user.id, message: 'a second message' }).then(() => {
                  return Message.findAll({
                    where: { user_id: user.id },
                    attributes: [
                      'user_id',
                      'message'
                    ],
                    include: [{ model: User, attributes: ['username'] }]
                  }).then(messages => {
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
          this.Worker.belongsTo(this.Task, { as: 'ToDo' });
          this.Worker.belongsTo(this.Task, { as: 'DoTo' });
          return this.init(() => {
            return this.Worker.findOne({
              include: [
                { model: this.Task, as: 'ToDo' },
                { model: this.Task, as: 'DoTo' }
              ]
            });
          });
        });
      });

      describe('hasOne', () => {
        beforeEach(function() {
          this.Worker.hasOne(this.Task);
          return this.init(() => {
            return this.worker.setTask(this.task);
          });
        });

        it('throws an error if included DaoFactory is not associated', function() {
          return this.Task.findOne({ include: [this.Worker] }).catch(err => {
            expect(err.message).to.equal('Worker is not associated to Task!');
          });
        });

        it('returns the associated task via worker.task', function() {
          return this.Worker.findOne({
            where: { name: 'worker' },
            include: [this.Task]
          }).then(worker => {
            expect(worker).to.exist;
            expect(worker.Task).to.exist;
            expect(worker.Task.title).to.equal('homework');
          });
        });

        it('eager loads with non-id primary keys', function() {
          this.User = this.sequelize.define('UserPKeagerone', {
            username: {
              type: Sequelize.STRING,
              primaryKey: true
            }
          });
          this.Group = this.sequelize.define('GroupPKeagerone', {
            name: {
              type: Sequelize.STRING,
              primaryKey: true
            }
          });
          this.Group.hasOne(this.User);

          return this.sequelize.sync({ force: true }).then(() => {
            return this.Group.create({ name: 'people' }).then(() => {
              return this.User.create({ username: 'someone', GroupPKeageroneName: 'people' }).then(() => {
                return this.Group.findOne({
                  where: {
                    name: 'people'
                  },
                  include: [this.User]
                }).then(someGroup => {
                  expect(someGroup).to.exist;
                  expect(someGroup.name).to.equal('people');
                  expect(someGroup.UserPKeagerone.username).to.equal('someone');
                });
              });
            });
          });
        });
      });

      describe('hasOne with alias', () => {
        it('throws an error if included DaoFactory is not referenced by alias', function() {
          return this.Worker.findOne({ include: [this.Task] }).catch(err => {
            expect(err.message).to.equal('Task is not associated to Worker!');
          });
        });

        describe('alias', () => {
          beforeEach(function() {
            this.Worker.hasOne(this.Task, { as: 'ToDo' });
            return this.init(() => {
              return this.worker.setToDo(this.task);
            });
          });

          it('throws an error indicating an incorrect alias was entered if an association and alias exist but the alias doesn\'t match', function() {
            return this.Worker.findOne({ include: [{ model: this.Task, as: 'Work' }] }).catch(err => {
              expect(err.message).to.equal('Task is associated to Worker using an alias. You\'ve included an alias (Work), but it does not match the alias(es) defined in your association (ToDo).');
            });
          });

          it('returns the associated task via worker.task', function() {
            return this.Worker.findOne({
              where: { name: 'worker' },
              include: [{ model: this.Task, as: 'ToDo' }]
            }).then(worker => {
              expect(worker).to.exist;
              expect(worker.ToDo).to.exist;
              expect(worker.ToDo.title).to.equal('homework');
            });
          });

          it('returns the associated task via worker.task when daoFactory is aliased with model', function() {
            return this.Worker.findOne({
              where: { name: 'worker' },
              include: [{ model: this.Task, as: 'ToDo' }]
            }).then(worker => {
              expect(worker.ToDo.title).to.equal('homework');
            });
          });

          it('allows mulitple assocations of the same model with different alias', function() {
            this.Worker.hasOne(this.Task, { as: 'DoTo' });
            return this.init(() => {
              return this.Worker.findOne({
                include: [
                  { model: this.Task, as: 'ToDo' },
                  { model: this.Task, as: 'DoTo' }
                ]
              });
            });
          });
        });
      });

      describe('hasMany', () => {
        beforeEach(function() {
          this.Worker.hasMany(this.Task);
          return this.init(() => {
            return this.worker.setTasks([this.task]);
          });
        });

        it('throws an error if included DaoFactory is not associated', function() {
          return this.Task.findOne({ include: [this.Worker] }).catch(err => {
            expect(err.message).to.equal('Worker is not associated to Task!');
          });
        });

        it('returns the associated tasks via worker.tasks', function() {
          return this.Worker.findOne({
            where: { name: 'worker' },
            include: [this.Task]
          }).then(worker => {
            expect(worker).to.exist;
            expect(worker.Tasks).to.exist;
            expect(worker.Tasks[0].title).to.equal('homework');
          });
        });

        it('including two has many relations should not result in duplicate values', function() {
          this.Contact = this.sequelize.define('Contact', { name: DataTypes.STRING });
          this.Photo = this.sequelize.define('Photo', { img: DataTypes.TEXT });
          this.PhoneNumber = this.sequelize.define('PhoneNumber', { phone: DataTypes.TEXT });

          this.Contact.hasMany(this.Photo, { as: 'Photos' });
          this.Contact.hasMany(this.PhoneNumber);

          return this.sequelize.sync({ force: true }).then(() => {
            return this.Contact.create({ name: 'Boris' }).then(someContact => {
              return this.Photo.create({ img: 'img.jpg' }).then(somePhoto => {
                return this.PhoneNumber.create({ phone: '000000' }).then(somePhone1 => {
                  return this.PhoneNumber.create({ phone: '111111' }).then(somePhone2 => {
                    return someContact.setPhotos([somePhoto]).then(() => {
                      return someContact.setPhoneNumbers([somePhone1, somePhone2]).then(() => {
                        return this.Contact.findOne({
                          where: {
                            name: 'Boris'
                          },
                          include: [this.PhoneNumber, { model: this.Photo, as: 'Photos' }]
                        }).then(fetchedContact => {
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
          this.User = this.sequelize.define('UserPKeagerone', {
            username: {
              type: Sequelize.STRING,
              primaryKey: true
            }
          });
          this.Group = this.sequelize.define('GroupPKeagerone', {
            name: {
              type: Sequelize.STRING,
              primaryKey: true
            }
          });
          this.Group.belongsToMany(this.User, { through: 'group_user' });
          this.User.belongsToMany(this.Group, { through: 'group_user' });

          return this.sequelize.sync({ force: true }).then(() => {
            return this.User.create({ username: 'someone' }).then(someUser => {
              return this.Group.create({ name: 'people' }).then(someGroup => {
                return someUser.setGroupPKeagerones([someGroup]).then(() => {
                  return this.User.findOne({
                    where: {
                      username: 'someone'
                    },
                    include: [this.Group]
                  }).then(someUser => {
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

      describe('hasMany with alias', () => {
        it('throws an error if included DaoFactory is not referenced by alias', function() {
          return this.Worker.findOne({ include: [this.Task] }).catch(err => {
            expect(err.message).to.equal('Task is not associated to Worker!');
          });
        });

        describe('alias', () => {
          beforeEach(function() {
            this.Worker.hasMany(this.Task, { as: 'ToDos' });
            return this.init(() => {
              return this.worker.setToDos([this.task]);
            });
          });

          it('throws an error indicating an incorrect alias was entered if an association and alias exist but the alias doesn\'t match', function() {
            return this.Worker.findOne({ include: [{ model: this.Task, as: 'Work' }] }).catch(err => {
              expect(err.message).to.equal('Task is associated to Worker using an alias. You\'ve included an alias (Work), but it does not match the alias(es) defined in your association (ToDos).');
            });
          });

          it('returns the associated task via worker.task', function() {
            return this.Worker.findOne({
              where: { name: 'worker' },
              include: [{ model: this.Task, as: 'ToDos' }]
            }).then(worker => {
              expect(worker).to.exist;
              expect(worker.ToDos).to.exist;
              expect(worker.ToDos[0].title).to.equal('homework');
            });
          });

          it('returns the associated task via worker.task when daoFactory is aliased with model', function() {
            return this.Worker.findOne({
              where: { name: 'worker' },
              include: [{ model: this.Task, as: 'ToDos' }]
            }).then(worker => {
              expect(worker.ToDos[0].title).to.equal('homework');
            });
          });

          it('allows mulitple assocations of the same model with different alias', function() {
            this.Worker.hasMany(this.Task, { as: 'DoTos' });
            return this.init(() => {
              return this.Worker.findOne({
                include: [
                  { model: this.Task, as: 'ToDos' },
                  { model: this.Task, as: 'DoTos' }
                ]
              });
            });
          });
        });
      });

      describe('hasMany (N:M) with alias', () => {
        beforeEach(function() {
          this.Product = this.sequelize.define('Product', { title: Sequelize.STRING });
          this.Tag = this.sequelize.define('Tag', { name: Sequelize.STRING });
        });

        it('returns the associated models when using through as string and alias', function() {
          this.Product.belongsToMany(this.Tag, { as: 'tags', through: 'product_tag' });
          this.Tag.belongsToMany(this.Product, { as: 'products', through: 'product_tag' });

          return this.sequelize.sync().then(() => {
            return Promise.all([
              this.Product.bulkCreate([
                { title: 'Chair' },
                { title: 'Desk' },
                { title: 'Handbag' },
                { title: 'Dress' },
                { title: 'Jan' }
              ]),
              this.Tag.bulkCreate([
                { name: 'Furniture' },
                { name: 'Clothing' },
                { name: 'People' }
              ])
            ]).then(() => {
              return Promise.all([
                this.Product.findAll(),
                this.Tag.findAll()
              ]);
            }).then(([products, tags]) => {
              this.products = products;
              this.tags = tags;
              return Promise.all([
                products[0].setTags([tags[0], tags[1]]),
                products[1].addTag(tags[0]),
                products[2].addTag(tags[1]),
                products[3].setTags([tags[1]]),
                products[4].setTags([tags[2]])
              ]).then(() => {
                return Promise.all([
                  this.Tag.findOne({
                    where: {
                      id: tags[0].id
                    },
                    include: [
                      { model: this.Product, as: 'products' }
                    ]
                  }).then(tag => {
                    expect(tag).to.exist;
                    expect(tag.products.length).to.equal(2);
                  }),
                  tags[1].getProducts().then(products => {
                    expect(products.length).to.equal(3);
                  }),
                  this.Product.findOne({
                    where: {
                      id: products[0].id
                    },
                    include: [
                      { model: this.Tag, as: 'tags' }
                    ]
                  }).then(product => {
                    expect(product).to.exist;
                    expect(product.tags.length).to.equal(2);
                  }),
                  products[1].getTags().then(tags => {
                    expect(tags.length).to.equal(1);
                  })
                ]);
              });
            });
          });
        });

        it('returns the associated models when using through as model and alias', function() {
          // Exactly the same code as the previous test, just with a through model instance, and promisified
          const ProductTag = this.sequelize.define('product_tag');

          this.Product.belongsToMany(this.Tag, { as: 'tags', through: ProductTag });
          this.Tag.belongsToMany(this.Product, { as: 'products', through: ProductTag });

          return this.sequelize.sync().then(() => {
            return Promise.all([
              this.Product.bulkCreate([
                { title: 'Chair' },
                { title: 'Desk' },
                { title: 'Handbag' },
                { title: 'Dress' },
                { title: 'Jan' }
              ]),
              this.Tag.bulkCreate([
                { name: 'Furniture' },
                { name: 'Clothing' },
                { name: 'People' }
              ])
            ]);
          }).then(() => {
            return Promise.all([
              this.Product.findAll(),
              this.Tag.findAll()
            ]);
          }).then(([products, tags]) => {
            this.products = products;
            this.tags = tags;

            return Promise.all([
              products[0].setTags([tags[0], tags[1]]),
              products[1].addTag(tags[0]),
              products[2].addTag(tags[1]),
              products[3].setTags([tags[1]]),
              products[4].setTags([tags[2]])
            ]);
          }).then(() => {
            return Promise.all([
              expect(this.Tag.findOne({
                where: {
                  id: this.tags[0].id
                },
                include: [
                  { model: this.Product, as: 'products' }
                ]
              })).to.eventually.have.property('products').to.have.length(2),
              expect(this.Product.findOne({
                where: {
                  id: this.products[0].id
                },
                include: [
                  { model: this.Tag, as: 'tags' }
                ]
              })).to.eventually.have.property('tags').to.have.length(2),
              expect(this.tags[1].getProducts()).to.eventually.have.length(3),
              expect(this.products[1].getTags()).to.eventually.have.length(1)
            ]);
          });
        });
      });
    });

    describe('queryOptions', () => {
      beforeEach(function() {
        return this.User.create({ username: 'barfooz' }).then(user => {
          this.user = user;
        });
      });

      it('should return a DAO when queryOptions are not set', function() {
        return this.User.findOne({ where: { username: 'barfooz' } }).then(user => {
          expect(user).to.be.instanceOf(this.User);
        });
      });

      it('should return a DAO when raw is false', function() {
        return this.User.findOne({ where: { username: 'barfooz' }, raw: false }).then(user => {
          expect(user).to.be.instanceOf(this.User);
        });
      });

      it('should return raw data when raw is true', function() {
        return this.User.findOne({ where: { username: 'barfooz' }, raw: true }).then(user => {
          expect(user).to.not.be.instanceOf(this.User);
          expect(user).to.be.instanceOf(Object);
        });
      });
    });

    it('should support logging', function() {
      const spy = sinon.spy();

      return this.User.findOne({
        where: {},
        logging: spy
      }).then(() => {
        expect(spy.called).to.be.ok;
      });
    });

    describe('rejectOnEmpty mode', () => {
      it('throws error when record not found by findOne', function() {
        return expect(this.User.findOne({
          where: {
            username: 'ath-kantam-pradakshnami'
          },
          rejectOnEmpty: true
        })).to.eventually.be.rejectedWith(Sequelize.EmptyResultError);
      });

      it('throws error when record not found by findByPk', function() {
        return expect(this.User.findByPk(4732322332323333232344334354234, {
          rejectOnEmpty: true
        })).to.eventually.be.rejectedWith(Sequelize.EmptyResultError);
      });

      it('throws error when record not found by find', function() {
        return expect(this.User.findOne({
          where: {
            username: 'some-username-that-is-not-used-anywhere'
          },
          rejectOnEmpty: true
        })).to.eventually.be.rejectedWith(Sequelize.EmptyResultError);
      });

      it('works from model options', () => {
        const Model = current.define('Test', {
          username: Sequelize.STRING(100)
        }, {
          rejectOnEmpty: true
        });

        return Model.sync({ force: true })
          .then(() => {
            return expect(Model.findOne({
              where: {
                username: 'some-username-that-is-not-used-anywhere'
              }
            })).to.eventually.be.rejectedWith(Sequelize.EmptyResultError);
          });
      });

      it('override model options', () => {
        const Model = current.define('Test', {
          username: Sequelize.STRING(100)
        }, {
          rejectOnEmpty: true
        });

        return Model.sync({ force: true })
          .then(() => {
            return expect(Model.findOne({
              rejectOnEmpty: false,
              where: {
                username: 'some-username-that-is-not-used-anywhere'
              }
            })).to.eventually.be.deep.equal(null);
          });
      });

      it('resolve null when disabled', () => {
        const Model = current.define('Test', {
          username: Sequelize.STRING(100)
        });

        return Model.sync({ force: true })
          .then(() => {
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
