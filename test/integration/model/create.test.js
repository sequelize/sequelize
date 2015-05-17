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
  , dialect = Support.getTestDialect()
  , _ = require('lodash')
  , assert = require('assert')
  , current = Support.sequelize;

describe(Support.getTestDialectTeaser('Model'), function() {
  beforeEach(function() {
    return Support.prepareTransactionTest(this.sequelize).bind(this).then(function(sequelize) {
      this.sequelize = sequelize;

      this.User = this.sequelize.define('User', {
        username: DataTypes.STRING,
        secretValue: DataTypes.STRING,
        data: DataTypes.STRING,
        intVal: DataTypes.INTEGER,
        theDate: DataTypes.DATE,
        aBool: DataTypes.BOOLEAN,
        uniqueName: { type: DataTypes.STRING, unique: true }
      });
      this.Account = this.sequelize.define('Account', {
        accountName: DataTypes.STRING
      });
      this.Student = this.sequelize.define('Student', {
          no: {type: DataTypes.INTEGER, primaryKey: true},
          name: {type: DataTypes.STRING, allowNull: false}
      });

      return this.sequelize.sync({ force: true });
    });
  });

  describe('findOrCreate', function() {
    if (current.dialect.supports.transactions) {
      it('supports transactions', function() {
        var self = this;
        return this.sequelize.transaction().then(function(t) {
          return self.User.findOrCreate({ where: { username: 'Username' }, defaults: { data: 'some data' }}, { transaction: t }).then(function() {
            return self.User.count().then(function(count) {
              expect(count).to.equal(0);
              return t.commit().then(function() {
                return self.User.count().then(function(count) {
                  expect(count).to.equal(1);
                });
              });
            });
          });
        });
      });

      it('supports more than one models per transaction', function() {
        var self = this;
        return this.sequelize.transaction().then(function(t) {
          return self.User.findOrCreate({ where: { username: 'Username'}, defaults: { data: 'some data' }}, { transaction: t }).then(function() {
            return self.Account.findOrCreate({ where: { accountName: 'accountName'}}, { transaction: t}).then(function() {
              return t.commit();
            });
          });
        });
      });
    }

    it('should error correctly when defaults contain a unique key', function () {
      var User = this.sequelize.define('user', {
        objectId: {
          type: DataTypes.STRING,
          unique: true
        },
        username: {
          type: DataTypes.STRING,
          unique: true
        }
      });

      return User.sync({force: true}).then(function () {
        return User.create({
          username: 'gottlieb'
        });
      }).then(function () {
        return expect(User.findOrCreate({
          where: {
            objectId: 'asdasdasd'
          },
          defaults: {
            username: 'gottlieb'
          }
        })).to.eventually.be.rejectedWith(Sequelize.UniqueConstraintError);
      });
    });

    it('should work with undefined uuid primary key in where', function () {
      var User = this.sequelize.define('User', {
        id: {
          type: DataTypes.UUID,
          primaryKey: true,
          allowNull: false,
          defaultValue: DataTypes.UUIDV4
        },
        name: {
          type: DataTypes.STRING
        }
      });

      return User.sync({force: true}).then(function () {
        return User.findOrCreate({
          where: {
            id: undefined
          },
          defaults: {
            name: Math.random().toString()
          }
        });
      });
    });

    if (['sqlite', 'mssql'].indexOf(current.dialect.name) === -1) {
      it('should not deadlock with no existing entries and no outer transaction', function () {
        var User = this.sequelize.define('User', {
          email: {
            type: DataTypes.STRING,
            unique: 'company_user_email'
          },
          companyId: {
            type: DataTypes.INTEGER,
            unique: 'company_user_email'
          }
        });

        return User.sync({force: true}).then(function () {
          return Promise.map(_.range(50), function (i) {
            return User.findOrCreate({
              where: {
                email: 'unique.email.'+i+'@sequelizejs.com',
                companyId: Math.floor(Math.random() * 5)
              }
            });
          });
        });
      });

      it('should not deadlock with existing entries and no outer transaction', function () {
        var User = this.sequelize.define('User', {
          email: {
            type: DataTypes.STRING,
            unique: 'company_user_email'
          },
          companyId: {
            type: DataTypes.INTEGER,
            unique: 'company_user_email'
          }
        });

        return User.sync({force: true}).then(function () {
          return Promise.map(_.range(50), function (i) {
            return User.findOrCreate({
              where: {
                email: 'unique.email.'+i+'@sequelizejs.com',
                companyId: 2
              }
            });
          }).then(function () {
            return Promise.map(_.range(50), function (i) {
              return User.findOrCreate({
                where: {
                  email: 'unique.email.'+i+'@sequelizejs.com',
                  companyId: 2
                }
              });
            });
          });
        });
      });

      it('should not deadlock with concurrency duplicate entries and no outer transaction', function () {
        var User = this.sequelize.define('User', {
          email: {
            type: DataTypes.STRING,
            unique: 'company_user_email'
          },
          companyId: {
            type: DataTypes.INTEGER,
            unique: 'company_user_email'
          }
        });

        return User.sync({force: true}).then(function () {
          return Promise.map(_.range(50), function () {
            return User.findOrCreate({
              where: {
                email: 'unique.email.1@sequelizejs.com',
                companyId: 2
              }
            });
          });
        });
      });
    }

    it('should support special characters in defaults', function () {
      var User = this.sequelize.define('user', {
        objectId: {
          type: DataTypes.INTEGER,
          unique: true
        },
        description: {
          type: DataTypes.TEXT
        }
      });

      return User.sync({force: true}).then(function () {
        return User.findOrCreate({
          where: {
            objectId: 1
          },
          defaults: {
            description: '$$ and !! and :: and ? and ^ and * and \''
          }
        });
      });
    });

    it('should support bools in defaults', function () {
      var User = this.sequelize.define('user', {
        objectId: {
          type: DataTypes.INTEGER,
          unique: true
        },
        bool: DataTypes.BOOLEAN
      });

      return User.sync({force: true}).then(function () {
        return User.findOrCreate({
          where: {
            objectId: 1
          },
          defaults: {
            bool: false
          }
        });
      });
    });

    it('returns instance if already existent. Single find field.', function() {
      var self = this,
        data = {
          username: 'Username'
        };

      return this.User.create(data).then(function(user) {
        return self.User.findOrCreate({ where: {
          username: user.username
        }}).spread(function(_user, created) {
          expect(_user.id).to.equal(user.id);
          expect(_user.username).to.equal('Username');
          expect(created).to.be.false;
        });
      });
    });

    it('Returns instance if already existent. Multiple find fields.', function() {
      var self = this,
        data = {
          username: 'Username',
          data: 'ThisIsData'
        };

      return this.User.create(data).then(function(user) {
        return self.User.findOrCreate({where: data}).spread(function(_user, created) {
          expect(_user.id).to.equal(user.id);
          expect(_user.username).to.equal('Username');
          expect(_user.data).to.equal('ThisIsData');
          expect(created).to.be.false;
        });
      });
    });

    it('does not include exception catcher in response', function() {
      var self = this
        , data = {
            username: 'Username',
            data: 'ThisIsData'
          };

      return self.User.findOrCreate({
        where: data,
        defaults: {}
      }).spread(function(user, created) {
        expect(user.dataValues.sequelize_caught_exception).to.be.undefined;
      }).then(function () {
        return self.User.findOrCreate({
          where: data,
          defaults: {}
        }).spread(function(user, created) {
          expect(user.dataValues.sequelize_caught_exception).to.be.undefined;
        });
      });
    });

    it('creates new instance with default value.', function() {
      var data = {
          username: 'Username'
        },
        default_values = {
          data: 'ThisIsData'
        };

      return this.User.findOrCreate({ where: data, defaults: default_values}).spread(function(user, created) {
        expect(user.username).to.equal('Username');
        expect(user.data).to.equal('ThisIsData');
        expect(created).to.be.true;
      });
    });

    it('supports .or() (only using default values)', function() {
      return this.User.findOrCreate({
        where: Sequelize.or({username: 'Fooobzz'}, {secretValue: 'Yolo'}),
        defaults: {username: 'Fooobzz', secretValue: 'Yolo'}
      }).spread(function(user, created) {
        expect(user.username).to.equal('Fooobzz');
        expect(user.secretValue).to.equal('Yolo');
        expect(created).to.be.true;
      });
    });

    if (current.dialect.supports.transactions) {
      it('should release transaction when meeting errors', function() {
          var self = this;

          var test = function(times) {
              if (times > 10) {
                  return true;
              }
              return self.Student.findOrCreate({
                where: {
                  no: 1
                }
              })
              .timeout(1000)
              .catch (Promise.TimeoutError, function(e) {
                  throw new Error(e);
              })
              .catch (Sequelize.ValidationError, function() {
                  return test(times + 1);
              });
          };

          return test(0);
      });
    }

    describe('several concurrent calls', function() {
      if (current.dialect.supports.transactions) {
        it('works with a transaction', function() {
          return this.sequelize.transaction().bind(this).then(function(transaction) {
            return Promise.join(
              this.User.findOrCreate({ where: { uniqueName: 'winner' }}, { transaction: transaction }),
              this.User.findOrCreate({ where: { uniqueName: 'winner' }}, { transaction: transaction }),
              function(first, second) {
                 var firstInstance = first[0]
                , firstCreated = first[1]
                , secondInstance = second[0]
                , secondCreated = second[1];

                // Depending on execution order and MAGIC either the first OR the second call should return true
                expect(firstCreated ? !secondCreated : secondCreated).to.be.ok; // XOR

                expect(firstInstance).to.be.ok;
                expect(secondInstance).to.be.ok;

                expect(firstInstance.id).to.equal(secondInstance.id);

                return transaction.commit();
              }
            );
          });
        });
      }

      (dialect !== 'sqlite' ? it : it.skip)('should error correctly when defaults contain a unique key without a transaction', function () {
        var User = this.sequelize.define('user', {
          objectId: {
            type: DataTypes.STRING,
            unique: true
          },
          username: {
            type: DataTypes.STRING,
            unique: true
          }
        });

        return User.sync({force: true}).then(function () {
          return User.create({
            username: 'gottlieb'
          });
        }).then(function () {
          return Promise.join(
            User.findOrCreate({
              where: {
                objectId: 'asdasdasd'
              },
              defaults: {
                username: 'gottlieb'
              }
            }).then(function () {
              throw new Error('I should have ben rejected');
            }).catch(function (err) {
              expect(err instanceof Sequelize.UniqueConstraintError).to.be.ok;
              expect(err.fields).to.be.ok;
            }),
            User.findOrCreate({
              where: {
                objectId: 'asdasdasd'
              },
              defaults: {
                username: 'gottlieb'
              }
            }).then(function () {
              throw new Error('I should have ben rejected');
            }).catch(function (err) {
              expect(err instanceof Sequelize.UniqueConstraintError).to.be.ok;
              expect(err.fields).to.be.ok;
            })
          );
        });
      });

      // Creating two concurrent transactions and selecting / inserting from the same table throws sqlite off
      (dialect !== 'sqlite' ? it : it.skip)('works without a transaction', function() {
        return Promise.join(
          this.User.findOrCreate({ where: { uniqueName: 'winner' }}),
          this.User.findOrCreate({ where: { uniqueName: 'winner' }}),
          function(first, second) {
            var firstInstance = first[0]
              , firstCreated = first[1]
              , secondInstance = second[0]
              , secondCreated = second[1];

            // Depending on execution order and MAGIC either the first OR the second call should return true
            expect(firstCreated ? !secondCreated : secondCreated).to.be.ok; // XOR

            expect(firstInstance).to.be.ok;
            expect(secondInstance).to.be.ok;

            expect(firstInstance.id).to.equal(secondInstance.id);
          }
        );
      });
    });
  });

  describe('create', function() {
    it('works with non-integer primary keys with a default value', function() {
      var User = this.sequelize.define('User', {
        'id': {
          primaryKey: true,
          type: DataTypes.UUID,
          defaultValue: DataTypes.UUIDV4
        },
        'email': {
          type: DataTypes.UUID,
          defaultValue: DataTypes.UUIDV4
        }
      });

      return this.sequelize.sync({force: true}).then(function() {
        return User.create({}).then(function(user) {
          expect(user).to.be.ok;
          expect(user.id).to.be.ok;
        });
      });
    });

    it('should return an error for a unique constraint error', function() {
      var User = this.sequelize.define('User', {
        'email': {
          type: DataTypes.STRING,
          unique: { name: 'email', msg: 'Email is already registered.' },
          validate: {
            notEmpty: true,
            isEmail: true
          }
        }
      });

      return this.sequelize.sync({force: true}).then(function() {
        return User.create({email: 'hello@sequelize.com'}).then(function() {
          return User.create({email: 'hello@sequelize.com'}).then(function() {
            assert(false);
          }).catch(function(err) {
            expect(err).to.be.ok;
            expect(err).to.be.an.instanceof(Error);
          });
        });
      });
    });

    it('works without any primary key', function() {
      var Log = this.sequelize.define('log', {
        level: DataTypes.STRING
      });

      Log.removeAttribute('id');

      return this.sequelize.sync({force: true}).then(function() {
        return Promise.join(
          Log.create({level: 'info'}),
          Log.bulkCreate([
            {level: 'error'},
            {level: 'debug'}
          ])
        );
      }).then(function() {
        return Log.findAll();
      }).then(function(logs) {
        logs.forEach(function(log) {
          expect(log.get('id')).not.to.be.ok;
        });
      });
    });

    it('should be able to set createdAt and updatedAt if using silent: true', function () {
      var User = this.sequelize.define('user', {
        name: DataTypes.STRING
      }, {
        timestamps: true
      });

      var createdAt = new Date(2012, 10, 10, 10, 10, 10);
      var updatedAt = new Date(2011, 11, 11, 11, 11, 11);

      return User.sync({force: true}).then(function () {
        return User.create({
          createdAt: createdAt,
          updatedAt: updatedAt
        }, {
          silent: true
        }).then(function (user) {
          expect(createdAt.getTime()).to.equal(user.get('createdAt').getTime());
          expect(updatedAt.getTime()).to.equal(user.get('updatedAt').getTime());

          return User.findOne({
            updatedAt: {
              ne: null
            }
          }).then(function (user) {
            expect(createdAt.getTime()).to.equal(user.get('createdAt').getTime());
            expect(updatedAt.getTime()).to.equal(user.get('updatedAt').getTime());
          });
        });
      });
    });

    it('works with custom timestamps with a default value', function() {
      var User = this.sequelize.define('User', {
        username: DataTypes.STRING,
        date_of_birth: DataTypes.DATE,
        email: DataTypes.STRING,
        password: DataTypes.STRING,
        created_time: {
          type: DataTypes.DATE,
          allowNull: true,
          defaultValue: DataTypes.NOW
        },
        updated_time: {
          type: DataTypes.DATE,
          allowNull: true,
          defaultValue: DataTypes.NOW
        }
      }, {
        createdAt: 'created_time',
        updatedAt: 'updated_time',
        tableName: 'users',
        underscored: true,
        freezeTableName: true,
        force: false
      });

      return this.sequelize.sync({force: true}).then(function() {
        return User.create({}).then(function(user) {
          expect(user).to.be.ok;
          expect(user.created_time).to.be.ok;
          expect(user.updated_time).to.be.ok;
        });
      });
    });

    it('works with custom timestamps and underscored', function() {
      var User = this.sequelize.define('User', {

      }, {
        createdAt: 'createdAt',
        updatedAt: 'updatedAt',
        underscored: true
      });

      return this.sequelize.sync({force: true}).then(function() {
        return User.create({}).then(function(user) {
          expect(user).to.be.ok;
          expect(user.createdAt).to.be.ok;
          expect(user.updatedAt).to.be.ok;

          expect(user.created_at).not.to.be.ok;
          expect(user.updated_at).not.to.be.ok;
        });
      });
    });

    if (current.dialect.supports.transactions) {
      it('supports transactions', function() {
        var self = this;
        return this.sequelize.transaction().then(function(t) {
          return self.User.create({ username: 'user' }, { transaction: t }).then(function() {
            return self.User.count().then(function(count) {
              expect(count).to.equal(0);
              return t.commit().then(function() {
                return self.User.count().then(function(count) {
                  expect(count).to.equal(1);
                });
              });
            });
          });
        });
      });
    }

    if (current.dialect.supports.returnValues) {
      describe('return values', function () {
        it('should make the autoincremented values available on the returned instances', function () {
          var User = this.sequelize.define('user', {});

          return User.sync({force: true}).then(function () {
            return User.create({}, {returning: true}).then(function (user) {
              expect(user.get('id')).to.be.ok;
              expect(user.get('id')).to.equal(1);
            });
          });
        });

        it('should make the autoincremented values available on the returned instances with custom fields', function () {
          var User = this.sequelize.define('user', {
            maId: {
              type: DataTypes.INTEGER,
              primaryKey: true,
              autoIncrement: true,
              field: 'yo_id'
            }
          });

          return User.sync({force: true}).then(function () {
            return User.create({}, {returning: true}).then(function (user) {
              expect(user.get('maId')).to.be.ok;
              expect(user.get('maId')).to.equal(1);
            });
          });
        });
      });
    }

    it('is possible to use casting when creating an instance', function() {
      var self = this
        , type = Support.dialectIsMySQL() ? 'signed' : 'integer'
        , match = false;

      return this.User.create({
        intVal: this.sequelize.cast('1', type)
      }, {
        logging: function(sql) {
          expect(sql).to.match(new RegExp("CAST\\('1' AS " + type.toUpperCase() + '\\)'));
          match = true;
        }
      }).then(function(user) {
        return self.User.find(user.id).then(function(user) {
          expect(user.intVal).to.equal(1);
          expect(match).to.equal(true);
        });
      });
    });

    it('is possible to use casting multiple times mixed in with other utilities', function() {
      var self = this
        , type = this.sequelize.cast(this.sequelize.cast(this.sequelize.literal('1-2'), 'integer'), 'integer')
        , match = false;

      if (Support.dialectIsMySQL()) {
        type = this.sequelize.cast(this.sequelize.cast(this.sequelize.literal('1-2'), 'unsigned'), 'signed');
      }

      return this.User.create({
        intVal: type
      }, {
        logging: function(sql) {
          if (Support.dialectIsMySQL()) {
            expect(sql).to.contain('CAST(CAST(1-2 AS UNSIGNED) AS SIGNED)');
          } else {
            expect(sql).to.contain('CAST(CAST(1-2 AS INTEGER) AS INTEGER)');
          }
          match = true;
        }
      }).then(function(user) {
        return self.User.find(user.id).then(function(user) {
          expect(user.intVal).to.equal(-1);
          expect(match).to.equal(true);
        });
      });
    });

    it('is possible to just use .literal() to bypass escaping', function() {
      var self = this;

      return this.User.create({
        intVal: this.sequelize.literal('CAST(1-2 AS ' + (Support.dialectIsMySQL() ? 'SIGNED' : 'INTEGER') + ')')
      }).then(function(user) {
        return self.User.find(user.id).then(function(user) {
          expect(user.intVal).to.equal(-1);
        });
      });
    });

    it('is possible to use funtions when creating an instance', function() {
      var self = this;
      return this.User.create({
        secretValue: this.sequelize.fn('upper', 'sequelize')
      }).then(function(user) {
        return self.User.find(user.id).then(function(user) {
          expect(user.secretValue).to.equal('SEQUELIZE');
        });
      });
    });

    it('should work with a non-id named uuid primary key columns', function() {
      var Monkey = this.sequelize.define('Monkey', {
        monkeyId: { type: DataTypes.UUID, primaryKey: true, defaultValue: DataTypes.UUIDV4, allowNull: false }
      });

      return this.sequelize.sync({force: true}).then(function() {
        return Monkey.create();
      }).then(function(monkey) {
        expect(monkey.get('monkeyId')).to.be.ok;
      });
    });

    it('is possible to use functions as default values', function() {
      var self = this
        , userWithDefaults;

      if (dialect.indexOf('postgres') === 0) {
        return this.sequelize.query('CREATE EXTENSION IF NOT EXISTS "uuid-ossp"').then(function() {
          userWithDefaults = self.sequelize.define('userWithDefaults', {
            uuid: {
              type: 'UUID',
              defaultValue: self.sequelize.fn('uuid_generate_v4')
            }
          });

          return userWithDefaults.sync({force: true}).then(function() {
            return userWithDefaults.create({}).then(function(user) {
              // uuid validation regex taken from http://stackoverflow.com/a/13653180/800016
              expect(user.uuid).to.match(/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i);
            });
          });
        });
      } else if (dialect === 'sqlite') {
        // The definition here is a bit hacky. sqlite expects () around the expression for default values, so we call a function without a name
        // to enclose the date function in (). http://www.sqlite.org/syntaxdiagrams.html#column-constraint
        userWithDefaults = self.sequelize.define('userWithDefaults', {
          year: {
            type: Sequelize.STRING,
            defaultValue: self.sequelize.fn('', self.sequelize.fn('date', 'now'))
          }
        });

        return userWithDefaults.sync({force: true}).then(function() {
          return userWithDefaults.create({}).then(function(user) {
            return userWithDefaults.find(user.id).then(function(user) {
              var now = new Date()
                , pad = function(number) {
                  if (number > 9) {
                    return number;
                  }
                  return '0' + number;
                };

              expect(user.year).to.equal(now.getUTCFullYear() + '-' + pad(now.getUTCMonth() + 1) + '-' + pad(now.getUTCDate()));
            });
          });
        });
      } else {
        // functions as default values are not supported in mysql, see http://stackoverflow.com/a/270338/800016
        return void(0);
      }
    });

    it('casts empty arrays correctly for postgresql insert', function() {
      if (dialect !== 'postgres') {
        expect('').to.equal('');
        return void(0);
      }

      var User = this.sequelize.define('UserWithArray', {
        myvals: { type: Sequelize.ARRAY(Sequelize.INTEGER) },
        mystr: { type: Sequelize.ARRAY(Sequelize.STRING) }
      });

      var test = false;
      return User.sync({force: true}).then(function() {
        return User.create({myvals: [], mystr: []}, {
          logging: function(sql) {
            test = true;
            expect(sql.indexOf('ARRAY[]::INTEGER[]')).to.be.above(-1);
            expect(sql.indexOf('ARRAY[]::VARCHAR[]')).to.be.above(-1);
          }
        });
      }).then(function() {
        expect(test).to.be.true;
      });
    });

    it('casts empty array correct for postgres update', function() {
      if (dialect !== 'postgres') {
        expect('').to.equal('');
        return void(0);
      }

      var User = this.sequelize.define('UserWithArray', {
        myvals: { type: Sequelize.ARRAY(Sequelize.INTEGER) },
        mystr: { type: Sequelize.ARRAY(Sequelize.STRING) }
      });
      var test = false;

      return User.sync({force: true}).then(function() {
        return User.create({myvals: [1, 2, 3, 4], mystr: ['One', 'Two', 'Three', 'Four']}).then(function(user) {
         user.myvals = [];
          user.mystr = [];
          return user.save(undefined, {
            logging: function(sql) {
              test = true;
              expect(sql.indexOf('ARRAY[]::INTEGER[]')).to.be.above(-1);
              expect(sql.indexOf('ARRAY[]::VARCHAR[]')).to.be.above(-1);
            }
          });
        });
      }).then(function() {
        expect(test).to.be.true;
      });
    });

    it("doesn't allow duplicated records with unique:true", function() {
      var self = this
        , User = this.sequelize.define('UserWithUniqueUsername', {
            username: { type: Sequelize.STRING, unique: true }
          });

      return User.sync({ force: true }).then(function() {
        return User.create({ username: 'foo' }).then(function() {
          return User.create({ username: 'foo' }).catch(self.sequelize.UniqueConstraintError, function(err) {
            expect(err).to.be.ok;
          });
        });
      });
    });

    it('raises an error if created object breaks definition contraints', function() {
      var UserNull = this.sequelize.define('UserWithNonNullSmth', {
        username: { type: Sequelize.STRING, unique: true },
        smth: { type: Sequelize.STRING, allowNull: false }
      });

      this.sequelize.options.omitNull = false;

      return UserNull.sync({ force: true }).then(function() {
        return UserNull.create({ username: 'foo2', smth: null }).catch(function(err) {
          expect(err).to.exist;
          expect(err.get('smth')[0].path).to.equal('smth');
          if (Support.dialectIsMySQL()) {
            // We need to allow two different errors for MySQL, see:
            // http://dev.mysql.com/doc/refman/5.0/en/server-sql-mode.html#sqlmode_strict_trans_tables
            expect(err.get('smth')[0].type).to.match(/notNull Violation/);
          }
          else if (dialect === 'sqlite') {
            expect(err.get('smth')[0].type).to.match(/notNull Violation/);
          } else {
            expect(err.get('smth')[0].type).to.match(/notNull Violation/);
          }
        });
      });
    });
    it('raises an error if created object breaks definition contraints', function() {
      var self = this
        , UserNull = this.sequelize.define('UserWithNonNullSmth', {
            username: { type: Sequelize.STRING, unique: true },
            smth: { type: Sequelize.STRING, allowNull: false }
          });

      this.sequelize.options.omitNull = false;

      return UserNull.sync({ force: true }).then(function() {
        return UserNull.create({ username: 'foo', smth: 'foo' }).then(function() {
          return UserNull.create({ username: 'foo', smth: 'bar' }).catch (self.sequelize.UniqueConstraintError, function(err) {
            expect(err).to.be.ok;
          });
        });
      });
    });

    it('raises an error if saving an empty string into a column allowing null or URL', function() {
      var StringIsNullOrUrl = this.sequelize.define('StringIsNullOrUrl', {
        str: { type: Sequelize.STRING, allowNull: true, validate: { isURL: true } }
      });

      this.sequelize.options.omitNull = false;

      return StringIsNullOrUrl.sync({ force: true }).then(function() {
        return StringIsNullOrUrl.create({ str: null }).then(function(str1) {
          expect(str1.str).to.be.null;
          return StringIsNullOrUrl.create({ str: 'http://sequelizejs.org' }).then(function(str2) {
            expect(str2.str).to.equal('http://sequelizejs.org');
            return StringIsNullOrUrl.create({ str: '' }).catch(function(err) {
              expect(err).to.exist;
              expect(err.get('str')[0].message).to.match(/Validation isURL failed/);
            });
          });
        });
      });
    });

    it('raises an error if you mess up the datatype', function() {
      var self = this;
      expect(function() {
        self.sequelize.define('UserBadDataType', {
          activity_date: Sequelize.DATe
        });
      }).to.throw(Error, 'Unrecognized data type for field activity_date');

      expect(function() {
        self.sequelize.define('UserBadDataType', {
          activity_date: {type: Sequelize.DATe}
        });
      }).to.throw(Error, 'Unrecognized data type for field activity_date');
    });

    it('sets a 64 bit int in bigint', function() {
      var User = this.sequelize.define('UserWithBigIntFields', {
        big: Sequelize.BIGINT
      });

      return User.sync({ force: true }).then(function() {
        return User.create({ big: '9223372036854775807' }).then(function(user) {
          expect(user.big).to.be.equal('9223372036854775807');
        });
      });
    });

    it('sets auto increment fields', function() {
      var User = this.sequelize.define('UserWithAutoIncrementField', {
        userid: { type: Sequelize.INTEGER, autoIncrement: true, primaryKey: true, allowNull: false }
      });

      return User.sync({ force: true }).then(function() {
        return User.create({}).then(function(user) {
          expect(user.userid).to.equal(1);
          return User.create({}).then(function(user) {
            expect(user.userid).to.equal(2);
          });
        });
      });
    });

    it('allows the usage of options as attribute', function() {
      var User = this.sequelize.define('UserWithNameAndOptions', {
        name: Sequelize.STRING,
        options: Sequelize.TEXT
      });

      var options = JSON.stringify({ foo: 'bar', bar: 'foo' });

      return User.sync({ force: true }).then(function() {
        return User
          .create({ name: 'John Doe', options: options })
          .then(function(user) {
            expect(user.options).to.equal(options);
          });
      });
    });

    it('allows sql logging', function() {
      var User = this.sequelize.define('UserWithUniqueNameAndNonNullSmth', {
        name: {type: Sequelize.STRING, unique: true},
        smth: {type: Sequelize.STRING, allowNull: false}
      });

      var test = false;
      return User.sync({ force: true }).then(function() {
        return User
          .create({ name: 'Fluffy Bunny', smth: 'else' }, {
            logging: function(sql) {
              expect(sql).to.exist;
              test = true;
              expect(sql.toUpperCase().indexOf('INSERT')).to.be.above(-1);
            }
          });
      }).then(function() {
        expect(test).to.be.true;
      });
    });

    it('should only store the values passed in the whitelist', function() {
      var self = this
        , data = { username: 'Peter', secretValue: '42' };

      return this.User.create(data, { fields: ['username'] }).then(function(user) {
        return self.User.find(user.id).then(function(_user) {
          expect(_user.username).to.equal(data.username);
          expect(_user.secretValue).not.to.equal(data.secretValue);
          expect(_user.secretValue).to.equal(null);
        });
      });
    });

    it('should store all values if no whitelist is specified', function() {
      var self = this
        , data = { username: 'Peter', secretValue: '42' };

      return this.User.create(data).then(function(user) {
        return self.User.find(user.id).then(function(_user) {
          expect(_user.username).to.equal(data.username);
          expect(_user.secretValue).to.equal(data.secretValue);
        });
      });
    });

    it('can omit autoincremental columns', function() {
      var self = this
        , data = { title: 'Iliad' }
        , dataTypes = [Sequelize.INTEGER, Sequelize.BIGINT]
        , sync = []
        , promises = []
        , books = [];

      dataTypes.forEach(function(dataType, index) {
        books[index] = self.sequelize.define('Book' + index, {
          id: { type: dataType, primaryKey: true, autoIncrement: true },
          title: Sequelize.TEXT
        });
      });

      books.forEach(function(b) {
        sync.push(b.sync({ force: true }));
      });

      return Promise.all(sync).then(function() {
        books.forEach(function(b, index) {
          promises.push(b.create(data).then(function(book) {
            expect(book.title).to.equal(data.title);
            expect(book.author).to.equal(data.author);
            expect(books[index].rawAttributes.id.type instanceof dataTypes[index]).to.be.ok;
          }));
        });
        return Promise.all(promises);
      });
    });

    it('saves data with single quote', function() {
      var quote = "single'quote"
        , self = this;

      return this.User.create({ data: quote }).then(function(user) {
        expect(user.data).to.equal(quote);
        return self.User.find({where: { id: user.id }}).then(function(user) {
          expect(user.data).to.equal(quote);
        });
      });
    });

    it('saves data with double quote', function() {
      var quote = 'double"quote'
        , self = this;

      return this.User.create({ data: quote }).then(function(user) {
        expect(user.data).to.equal(quote);
        return self.User.find({where: { id: user.id }}).then(function(user) {
          expect(user.data).to.equal(quote);
        });
      });
    });

    it('saves stringified JSON data', function() {
      var json = JSON.stringify({ key: 'value' })
        , self = this;

      return this.User.create({ data: json }).then(function(user) {
        expect(user.data).to.equal(json);
        return self.User.find({where: { id: user.id }}).then(function(user) {
          expect(user.data).to.equal(json);
        });
      });
    });

    it('stores the current date in createdAt', function() {
      return this.User.create({ username: 'foo' }).then(function(user) {
        expect(parseInt(+user.createdAt / 5000, 10)).to.be.closeTo(parseInt(+new Date() / 5000, 10), 1.5);
      });
    });

    it('allows setting custom IDs', function() {
      var self = this;
      return this.User.create({ id: 42 }).then(function(user) {
        expect(user.id).to.equal(42);
        return self.User.find(42).then(function(user) {
          expect(user).to.exist;
        });
      });
    });

    it('should allow blank creates (with timestamps: false)', function() {
      var Worker = this.sequelize.define('Worker', {}, {timestamps: false});
      return Worker.sync().then(function() {
        return Worker.create({}, {fields: []}).then(function(worker) {
          expect(worker).to.be.ok;
        });
      });
    });

    it('should allow truly blank creates', function() {
      var Worker = this.sequelize.define('Worker', {}, {timestamps: false});
      return Worker.sync().then(function() {
        return Worker.create({}, {fields: []}).then(function(worker) {
          expect(worker).to.be.ok;
        });
      });
    });

    it('should only set passed fields', function() {
      var User = this.sequelize.define('User', {
        'email': {
          type: DataTypes.STRING
        },
        'name': {
          type: DataTypes.STRING
        }
      });

      return this.sequelize.sync({force: true}).then(function() {
        return User.create({
          name: 'Yolo Bear',
          email: 'yolo@bear.com'
        }, {
          fields: ['name']
        }).then(function(user) {
          expect(user.name).to.be.ok;
          expect(user.email).not.to.be.ok;
          return User.find(user.id).then(function(user) {
            expect(user.name).to.be.ok;
            expect(user.email).not.to.be.ok;
          });
        });
      });
    });

    describe('enums', function() {
      it('correctly restores enum values', function() {
        var self = this
          , Item = self.sequelize.define('Item', {
              state: { type: Sequelize.ENUM, values: ['available', 'in_cart', 'shipped'] }
            });

        return Item.sync({ force: true }).then(function() {
          return Item.create({ state: 'available' }).then(function(_item) {
            return Item.find({ where: { state: 'available' }}).then(function(item) {
              expect(item.id).to.equal(_item.id);
            });
          });
        });
      });

      it('allows null values', function() {
        var Enum = this.sequelize.define('Enum', {
          state: {
            type: Sequelize.ENUM,
            values: ['happy', 'sad'],
            allowNull: true
          }
        });

        return Enum.sync({ force: true }).then(function() {
          return Enum.create({state: null}).then(function(_enum) {
            expect(_enum.state).to.be.null;
          });
        });
      });

      describe('when defined via { field: Sequelize.ENUM }', function() {
        it('allows values passed as parameters', function() {
          var Enum = this.sequelize.define('Enum', {
            state: Sequelize.ENUM('happy', 'sad')
          });

          return Enum.sync({ force: true }).then(function() {
            return Enum.create({ state: 'happy' });
          });
        });

        it('allows values passed as an array', function() {
          var Enum = this.sequelize.define('Enum', {
            state: Sequelize.ENUM(['happy', 'sad'])
          });

          return Enum.sync({ force: true }).then(function() {
            return Enum.create({ state: 'happy' });
          });
        });
      });

      describe('when defined via { field: { type: Sequelize.ENUM } }', function() {
        it('allows values passed as parameters', function() {
          var Enum = this.sequelize.define('Enum', {
            state: {
              type: Sequelize.ENUM('happy', 'sad')
            }
          });

          return Enum.sync({ force: true }).then(function() {
            return Enum.create({ state: 'happy' });
          });
        });

        it('allows values passed as an array', function() {
          var Enum = this.sequelize.define('Enum', {
            state: {
              type: Sequelize.ENUM(['happy', 'sad'])
            }
          });

          return Enum.sync({ force: true }).then(function() {
            return Enum.create({ state: 'happy' });
          });
        });
      });

      describe('can safely sync multiple times', function() {
        it('through the factory', function() {
          var Enum = this.sequelize.define('Enum', {
            state: {
              type: Sequelize.ENUM,
              values: ['happy', 'sad'],
              allowNull: true
            }
          });

          return Enum.sync({ force: true }).then(function() {
            return Enum.sync().then(function() {
              return Enum.sync({ force: true });
            });
          });
        });

        it('through sequelize', function() {
          var self = this;
          /* jshint ignore:start */
          var Enum = this.sequelize.define('Enum', {
            state: {
              type: Sequelize.ENUM,
              values: ['happy', 'sad'],
              allowNull: true
            }
          });
          /* jshint ignore:end */

          return this.sequelize.sync({ force: true }).then(function() {
            return self.sequelize.sync().then(function() {
              return self.sequelize.sync({ force: true });
            });
          });
        });
      });
    });
  });

  describe('bulkCreate', function() {
    if (current.dialect.supports.transactions) {
      it('supports transactions', function() {
        var self = this;
        return this.sequelize.transaction().then(function(t) {
          return self.User
            .bulkCreate([{ username: 'foo' }, { username: 'bar' }], { transaction: t })
            .then(function() {
              return self.User.count().then(function(count1) {
                return self.User.count({ transaction: t }).then(function(count2) {
                  expect(count1).to.equal(0);
                  expect(count2).to.equal(2);
                  return t.rollback();
                });
              });
            });
        });
      });
    }

    it('should be able to set createdAt and updatedAt if using silent: true', function () {
      var User = this.sequelize.define('user', {
        name: DataTypes.STRING
      }, {
        timestamps: true
      });

      var createdAt = new Date(2012, 10, 10, 10, 10, 10);
      var updatedAt = new Date(2011, 11, 11, 11, 11, 11);
      var values = _.map(new Array(10), function () {
        return {
          createdAt: createdAt,
          updatedAt: updatedAt
        };
      });

      return User.sync({force: true}).then(function () {
        return User.bulkCreate(values, {
          silent: true
        }).then(function () {
          return User.findAll({
            updatedAt: {
              ne: null
            }
          }).then(function (users) {
            users.forEach(function (user) {
              expect(createdAt.getTime()).to.equal(user.get('createdAt').getTime());
              expect(updatedAt.getTime()).to.equal(user.get('updatedAt').getTime());
            });
          });
        });
      });
    });

    it('should not fail on validate: true and individualHooks: true', function () {
      var User = this.sequelize.define('user', {
        name: Sequelize.STRING
      });

      return User.sync({force: true}).then(function () {
        return User.bulkCreate([
          {name: 'James'}
        ], {validate: true, individualHooks: true});
      });
    });

    it('should not insert NULL for unused fields', function () {
      var Beer = this.sequelize.define('Beer', {
          style: Sequelize.STRING,
          size: Sequelize.INTEGER,
      });

      return Beer.sync({force: true}).then(function () {
        return Beer.bulkCreate([{
            style: 'ipa'
        }], {
          logging: function(sql) {
            if (dialect === 'postgres') {
              expect(sql.indexOf('INSERT INTO "Beers" ("id","style","createdAt","updatedAt") VALUES (DEFAULT')).not.be.equal(-1);
            } else if (dialect === 'mssql') {
              expect(sql.indexOf('INSERT INTO [Beers] ([style],[createdAt],[updatedAt]) VALUES')).not.be.equal(-1);
            } else { // mysql, sqlite, mariadb
              expect(sql.indexOf('INSERT INTO `Beers` (`id`,`style`,`createdAt`,`updatedAt`) VALUES (NULL')).not.be.equal(-1);
            }
          }
        });
      });
    });

    it('properly handles disparate field lists', function() {
      var self = this
        , data = [{username: 'Peter', secretValue: '42', uniqueName: '1' },
                  {username: 'Paul', uniqueName: '2'},
                  {username: 'Steve', uniqueName: '3'}];

      return this.User.bulkCreate(data).then(function() {
        return self.User.findAll({where: {username: 'Paul'}}).then(function(users) {
          expect(users.length).to.equal(1);
          expect(users[0].username).to.equal('Paul');
          expect(users[0].secretValue).to.be.null;
        });
      });
    });

    it('inserts multiple values respecting the white list', function() {
      var self = this
        , data = [{ username: 'Peter', secretValue: '42', uniqueName: '1' },
                  { username: 'Paul', secretValue: '23', uniqueName: '2'}];

      return this.User.bulkCreate(data, { fields: ['username', 'uniqueName'] }).then(function() {
        return self.User.findAll({order: 'id'}).then(function(users) {
          expect(users.length).to.equal(2);
          expect(users[0].username).to.equal('Peter');
          expect(users[0].secretValue).to.be.null;
          expect(users[1].username).to.equal('Paul');
          expect(users[1].secretValue).to.be.null;
        });
      });
    });

    it('should store all values if no whitelist is specified', function() {
      var self = this
        , data = [{ username: 'Peter', secretValue: '42', uniqueName: '1' },
                  { username: 'Paul', secretValue: '23', uniqueName: '2'}];

      return this.User.bulkCreate(data).then(function() {
        return self.User.findAll({order: 'id'}).then(function(users) {
          expect(users.length).to.equal(2);
          expect(users[0].username).to.equal('Peter');
          expect(users[0].secretValue).to.equal('42');
          expect(users[1].username).to.equal('Paul');
          expect(users[1].secretValue).to.equal('23');
        });
      });
    });

    it('saves data with single quote', function() {
      var self = this
        , quote = "Single'Quote"
        , data = [{ username: 'Peter', data: quote, uniqueName: '1'},
                  { username: 'Paul', data: quote, uniqueName: '2'}];

      return this.User.bulkCreate(data).then(function() {
        return self.User.findAll({order: 'id'}).then(function(users) {
          expect(users.length).to.equal(2);
          expect(users[0].username).to.equal('Peter');
          expect(users[0].data).to.equal(quote);
          expect(users[1].username).to.equal('Paul');
          expect(users[1].data).to.equal(quote);
        });
      });
    });

    it('saves data with double quote', function() {
      var self = this
        , quote = 'Double"Quote'
        , data = [{ username: 'Peter', data: quote, uniqueName: '1'},
                  { username: 'Paul', data: quote, uniqueName: '2'}];

      return this.User.bulkCreate(data).then(function() {
        return self.User.findAll({order: 'id'}).then(function(users) {
          expect(users.length).to.equal(2);
          expect(users[0].username).to.equal('Peter');
          expect(users[0].data).to.equal(quote);
          expect(users[1].username).to.equal('Paul');
          expect(users[1].data).to.equal(quote);
        });
      });
    });

    it('saves stringified JSON data', function() {
      var self = this
        , json = JSON.stringify({ key: 'value' })
        , data = [{ username: 'Peter', data: json, uniqueName: '1'},
                  { username: 'Paul', data: json, uniqueName: '2'}];

      return this.User.bulkCreate(data).then(function() {
        return self.User.findAll({order: 'id'}).then(function(users) {
          expect(users.length).to.equal(2);
          expect(users[0].username).to.equal('Peter');
          expect(users[0].data).to.equal(json);
          expect(users[1].username).to.equal('Paul');
          expect(users[1].data).to.equal(json);
        });
      });
    });

    it('properly handles a model with a length column', function() {
      var UserWithLength = this.sequelize.define('UserWithLength', {
        length: Sequelize.INTEGER
      });

      return UserWithLength.sync({force: true}).then(function() {
        return UserWithLength.bulkCreate([{ length: 42}, {length: 11}]);
      });
    });

    it('stores the current date in createdAt', function() {
      var self = this
        , data = [{ username: 'Peter', uniqueName: '1'},
                  { username: 'Paul', uniqueName: '2'}];

      return this.User.bulkCreate(data).then(function() {
        return self.User.findAll({order: 'id'}).then(function(users) {
          expect(users.length).to.equal(2);
          expect(users[0].username).to.equal('Peter');
          expect(parseInt(+users[0].createdAt / 5000, 10)).to.be.closeTo(parseInt(+new Date() / 5000, 10), 1.5);
          expect(users[1].username).to.equal('Paul');
          expect(parseInt(+users[1].createdAt / 5000, 10)).to.be.closeTo(parseInt(+new Date() / 5000, 10), 1.5);
        });
      });
    });

    it('emits an error when validate is set to true', function() {
      var Tasks = this.sequelize.define('Task', {
        name: {
          type: Sequelize.STRING,
          allowNull: false
        },
        code: {
          type: Sequelize.STRING,
          validate: {
            len: [3, 10]
          }
        }
      });

      return Tasks.sync({ force: true }).then(function() {
        return Tasks.bulkCreate([
          {name: 'foo', code: '123'},
          {code: '1234'},
          {name: 'bar', code: '1'}
        ], { validate: true }).catch(function(errors) {
          expect(errors).to.not.be.null;
          expect(errors).to.be.an('Array');
          expect(errors).to.have.length(2);
          expect(errors[0].record.code).to.equal('1234');
          expect(errors[0].errors.get('name')[0].type).to.equal('notNull Violation');
          expect(errors[1].record.name).to.equal('bar');
          expect(errors[1].record.code).to.equal('1');
          expect(errors[1].errors.get('code')[0].message).to.equal('Validation len failed');
        });
      });
    });

    it("doesn't emit an error when validate is set to true but our selectedValues are fine", function() {
      var Tasks = this.sequelize.define('Task', {
        name: {
          type: Sequelize.STRING,
          validate: {
            notEmpty: true
          }
        },
        code: {
          type: Sequelize.STRING,
          validate: {
            len: [3, 10]
          }
        }
      });

      return Tasks.sync({ force: true }).then(function() {
        return Tasks.bulkCreate([
          {name: 'foo', code: '123'},
          {code: '1234'}
        ], { fields: ['code'], validate: true });
      });
    });

    it('should allow blank arrays (return immediatly)', function() {
      var Worker = this.sequelize.define('Worker', {});
      return Worker.sync().then(function() {
        return Worker.bulkCreate([]).then(function(workers) {
          expect(workers).to.be.ok;
          expect(workers.length).to.equal(0);
        });
      });
    });

    it('should allow blank creates (with timestamps: false)', function() {
      var Worker = this.sequelize.define('Worker', {}, {timestamps: false});
      return Worker.sync().then(function() {
        return Worker.bulkCreate([{}, {}]).then(function(workers) {
          expect(workers).to.be.ok;
        });
      });
    });

    it('should allow autoincremented attributes to be set', function() {
      var Worker = this.sequelize.define('Worker', {}, {timestamps: false});
      return Worker.sync().then(function() {
        return Worker.bulkCreate([
          {id: 5},
          {id: 10}
        ]).then(function() {
          return Worker.findAll({order: 'id ASC'}).then(function(workers) {
            expect(workers[0].id).to.equal(5);
            expect(workers[1].id).to.equal(10);
          });
        });
      });
    });

    it('should support schemas', function() {
      var Dummy = this.sequelize.define('Dummy', {
        foo: DataTypes.STRING,
        bar: DataTypes.STRING
      }, {
        schema: 'space1',
        tableName: 'Dummy'
      });

      return this.sequelize.dropAllSchemas().bind(this).then(function() {
        return this.sequelize.createSchema('space1');
      }).then(function() {
        return Dummy.sync({force: true});
      }).then(function() {
        return Dummy.bulkCreate([
          {foo: 'a', bar: 'b'},
          {foo: 'c', bar: 'd'}
        ]);
      });
    });

    if (dialect !== 'postgres' && dialect !== 'mssql') {
      it('should support the ignoreDuplicates option', function() {
        var self = this
          , data = [{ uniqueName: 'Peter', secretValue: '42' },
                    { uniqueName: 'Paul', secretValue: '23' }];

        return this.User.bulkCreate(data, { fields: ['uniqueName', 'secretValue'] }).then(function() {
          data.push({ uniqueName: 'Michael', secretValue: '26' });
          return self.User.bulkCreate(data, { fields: ['uniqueName', 'secretValue'], ignoreDuplicates: true }).then(function() {
            return self.User.findAll({order: 'id'}).then(function(users) {
              expect(users.length).to.equal(3);
              expect(users[0].uniqueName).to.equal('Peter');
              expect(users[0].secretValue).to.equal('42');
              expect(users[1].uniqueName).to.equal('Paul');
              expect(users[1].secretValue).to.equal('23');
              expect(users[2].uniqueName).to.equal('Michael');
              expect(users[2].secretValue).to.equal('26');
            });
          });
        });
      });
    } else {
      it('should throw an error when the ignoreDuplicates option is passed', function() {
        var self = this
          , data = [{ uniqueName: 'Peter', secretValue: '42' },
                    { uniqueName: 'Paul', secretValue: '23' }];

        return this.User.bulkCreate(data, { fields: ['uniqueName', 'secretValue'] }).then(function() {
          data.push({ uniqueName: 'Michael', secretValue: '26' });

          return self.User.bulkCreate(data, { fields: ['uniqueName', 'secretValue'], ignoreDuplicates: true }).catch(function(err) {
            if (dialect === 'mssql') {
              expect(err.message).to.match(/mssql does not support the \'ignoreDuplicates\' option./);
            } else {
              expect(err.message).to.match(/postgres does not support the \'ignoreDuplicates\' option./);
            }
          });
        });
      });
    }

    if (current.dialect.supports.returnValues) {
      describe('return values', function () {
        it('should make the autoincremented values available on the returned instances', function () {
          var User = this.sequelize.define('user', {});

          return User.sync({force: true}).then(function () {
            return User.bulkCreate([
              {},
              {},
              {}
            ], {returning: true}).then(function (users) {
              expect(users.length).to.be.ok;
              users.forEach(function (user, i) {
                expect(user.get('id')).to.be.ok;
                expect(user.get('id')).to.equal(i+1);
              });
            });
          });
        });

        it('should make the autoincremented values available on the returned instances with custom fields', function () {
          var User = this.sequelize.define('user', {
            maId: {
              type: DataTypes.INTEGER,
              primaryKey: true,
              autoIncrement: true,
              field: 'yo_id'
            }
          });

          return User.sync({force: true}).then(function () {
            return User.bulkCreate([
              {},
              {},
              {}
            ], {returning: true}).then(function (users) {
              expect(users.length).to.be.ok;
              users.forEach(function (user, i) {
                expect(user.get('maId')).to.be.ok;
                expect(user.get('maId')).to.equal(i+1);
              });
            });
          });
        });
      });
    }

    describe('enums', function() {
      it('correctly restores enum values', function() {
        var self = this
          , Item = self.sequelize.define('Item', {
              state: { type: Sequelize.ENUM, values: ['available', 'in_cart', 'shipped'] },
              name: Sequelize.STRING
            });

        return Item.sync({ force: true }).then(function() {
          return Item.bulkCreate([{state: 'in_cart', name: 'A'}, { state: 'available', name: 'B'}]).then(function() {
            return Item.find({ where: { state: 'available' }}).then(function(item) {
              expect(item.name).to.equal('B');
            });
          });
        });
      });
    });
  });

  it('should support logging', function () {
    var spy = sinon.spy();

    return this.User.create({}, {
      logging: spy
    }).then(function () {
      expect(spy.called).to.be.ok;
    });
  });
});
