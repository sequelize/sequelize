'use strict';

var chai = require('chai')
  , sinon = require('sinon')
  , Sequelize = require('../../../index')
  , Promise = Sequelize.Promise
  , expect = chai.expect
  , Support = require(__dirname + '/../support')
  , DataTypes = require(__dirname + '/../../../lib/data-types')
  , dialect = Support.getTestDialect()
  , datetime = require('chai-datetime')
  , _ = require('lodash')
  , assert = require('assert')
  , current = Support.sequelize;

chai.use(datetime);
chai.config.includeStack = true;

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
      it('supports transactions', function(done) {
        var self = this;
        this.sequelize.transaction().then(function(t) {
          self.User.findOrCreate({ where: { username: 'Username' }, defaults: { data: 'some data' }}, { transaction: t }).then(function() {
            self.User.count().success(function(count) {
              expect(count).to.equal(0);
              t.commit().success(function() {
                self.User.count().success(function(count) {
                  expect(count).to.equal(1);
                  done();
                });
              });
            });
          });
        });
      });

      it('supports more than one models per transaction', function(done) {
        var self = this;
        this.sequelize.transaction().then(function(t) {
          self.User.findOrCreate({ where: { username: 'Username'}, defaults: { data: 'some data' }}, { transaction: t }).then(function() {
            self.Account.findOrCreate({ where: { accountName: 'accountName'}}, { transaction: t}).then(function() {
              t.commit().success(function() {
                done();
              });
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
        return User.findOrCreate({
          where: {
            objectId: 'asdasdasd'
          },
          defaults: {
            username: 'gottlieb'
          }
        }).then(function () {
          throw new Error('I should have been rejected');
        }, function (err) {
          expect(err instanceof Sequelize.UniqueConstraintError).to.be.ok;
          expect(err.fields).to.be.ok;
        });
      });
    });

    if (['sqlite', 'mssql'].indexOf(current.dialect.name) > -1) {
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
          return Promise.map(_.range(50), function (i) {
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

    it('returns instance if already existent. Single find field.', function(done) {
      var self = this,
        data = {
          username: 'Username'
        };

      this.User.create(data).success(function(user) {
        self.User.findOrCreate({ where: {
          username: user.username
        }}).spread(function(_user, created) {
          expect(_user.id).to.equal(user.id);
          expect(_user.username).to.equal('Username');
          expect(created).to.be.false;
          done();
        });
      });
    });

    it('Returns instance if already existent. Multiple find fields.', function(done) {
      var self = this,
        data = {
          username: 'Username',
          data: 'ThisIsData'
        };

      this.User.create(data).success(function(user) {
        self.User.findOrCreate({where: data}).done(function(err, _user, created) {
          expect(_user.id).to.equal(user.id);
          expect(_user.username).to.equal('Username');
          expect(_user.data).to.equal('ThisIsData');
          expect(created).to.be.false;
          done();
        });
      });
    });

    it('creates new instance with default value.', function(done) {
      var data = {
          username: 'Username'
        },
        default_values = {
          data: 'ThisIsData'
        };

      this.User.findOrCreate({ where: data, defaults: default_values}).success(function(user, created) {
        expect(user.username).to.equal('Username');
        expect(user.data).to.equal('ThisIsData');
        expect(created).to.be.true;
        done();
      });
    });

    it('supports .or() (only using default values)', function(done) {
      this.User.findOrCreate({
        where: Sequelize.or({username: 'Fooobzz'}, {secretValue: 'Yolo'}),
        defaults: {username: 'Fooobzz', secretValue: 'Yolo'}
      }).done(function(err, user, created) {
        expect(err).not.to.be.ok;
        expect(user.username).to.equal('Fooobzz');
        expect(user.secretValue).to.equal('Yolo');
        expect(created).to.be.true;

        done();
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
              .catch (Sequelize.ValidationError, function(err) {
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
            }, function (err) {
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
            }, function (err) {
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
    it('works with non-integer primary keys with a default value', function(done) {
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

      this.sequelize.sync({force: true}).done(function(err) {
        expect(err).not.to.be.ok;
        User.create({}).done(function(err, user) {
          expect(err).not.to.be.ok;
          expect(user).to.be.ok;
          expect(user.id).to.be.ok;
          done();
        });
      });
    });

    it('should return an error for a unique constraint error', function(done) {
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

      this.sequelize.sync({force: true}).done(function(err) {
        expect(err).not.to.be.ok;
        User.create({email: 'hello@sequelize.com'}).done(function(err) {
          expect(err).not.to.be.ok;
          User.create({email: 'hello@sequelize.com'}).then(function() {
            assert(false);
          }, function(err) {
            expect(err).to.be.ok;
            expect(err).to.be.an.instanceof(Error);
            done();
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

    if (current.dialect.supports.transactions) {
      it('supports transactions', function(done) {
        var self = this;
        this.sequelize.transaction().then(function(t) {
          self.User.create({ username: 'user' }, { transaction: t }).success(function() {
            self.User.count().success(function(count) {
              expect(count).to.equal(0);
              t.commit().success(function() {
                self.User.count().success(function(count) {
                  expect(count).to.equal(1);
                  done();
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

    it('is possible to use casting when creating an instance', function(done) {
      var self = this
        , type = Support.dialectIsMySQL() ? 'signed' : 'integer'
        , _done = _.after(2, function() {
          done();
        });

      this.User.create({
        intVal: this.sequelize.cast('1', type)
      }).on('sql', function(sql) {
        expect(sql).to.match(new RegExp("CAST\\('1' AS " + type.toUpperCase() + '\\)'));
        _done();
      })
      .success(function(user) {
        self.User.find(user.id).success(function(user) {
          expect(user.intVal).to.equal(1);
          _done();
        });
      });
    });

    it('is possible to use casting multiple times mixed in with other utilities', function(done) {
      var self = this
        , type = this.sequelize.cast(this.sequelize.cast(this.sequelize.literal('1-2'), 'integer'), 'integer')
        , _done = _.after(2, function() {
          done();
        });

      if (Support.dialectIsMySQL()) {
        type = this.sequelize.cast(this.sequelize.cast(this.sequelize.literal('1-2'), 'unsigned'), 'signed');
      }

      this.User.create({
        intVal: type
      }).on('sql', function(sql) {
        if (Support.dialectIsMySQL()) {
          expect(sql).to.contain('CAST(CAST(1-2 AS UNSIGNED) AS SIGNED)');
        } else {
          expect(sql).to.contain('CAST(CAST(1-2 AS INTEGER) AS INTEGER)');
        }

        _done();
      }).success(function(user) {
        self.User.find(user.id).success(function(user) {
          expect(user.intVal).to.equal(-1);
          _done();
        });
      });
    });

    it('is possible to just use .literal() to bypass escaping', function(done) {
      var self = this;

      this.User.create({
        intVal: this.sequelize.literal('CAST(1-2 AS ' + (Support.dialectIsMySQL() ? 'SIGNED' : 'INTEGER') + ')')
      }).success(function(user) {
        self.User.find(user.id).success(function(user) {
          expect(user.intVal).to.equal(-1);
          done();
        });
      });
    });

    it('is possible to use funtions when creating an instance', function(done) {
      var self = this;
      this.User.create({
        secretValue: this.sequelize.fn('upper', 'sequelize')
      }).success(function(user) {
        self.User.find(user.id).success(function(user) {
          expect(user.secretValue).to.equal('SEQUELIZE');
          done();
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

    it('is possible to use functions as default values', function(done) {
      var self = this
        , userWithDefaults;

      if (dialect.indexOf('postgres') === 0) {
        this.sequelize.query('CREATE EXTENSION IF NOT EXISTS "uuid-ossp"').success(function() {
          userWithDefaults = self.sequelize.define('userWithDefaults', {
            uuid: {
              type: 'UUID',
              defaultValue: self.sequelize.fn('uuid_generate_v4')
            }
          });

          userWithDefaults.sync({force: true}).success(function() {
            userWithDefaults.create({}).success(function(user) {
              // uuid validation regex taken from http://stackoverflow.com/a/13653180/800016
              expect(user.uuid).to.match(/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i);
              done();
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

        userWithDefaults.sync({force: true}).done(function(err) {
          expect(err).not.to.be.ok;
          userWithDefaults.create({}).done(function(err, user) {
            expect(err).not.to.be.ok;
            userWithDefaults.find(user.id).done(function(err, user) {
              expect(err).not.to.be.ok;
              var now = new Date()
                , pad = function(number) {
                  if (number > 9) {
                    return number;
                  }
                  return '0' + number;
                };

              expect(user.year).to.equal(now.getUTCFullYear() + '-' + pad(now.getUTCMonth() + 1) + '-' + pad(now.getUTCDate()));
              done();
            });
          });
        });
      } else {
        // functions as default values are not supported in mysql, see http://stackoverflow.com/a/270338/800016
        done();
      }
    });

    it('casts empty arrays correctly for postgresql insert', function(done) {
      if (dialect !== 'postgres') {
        expect('').to.equal('');
        return done();
      }

      var User = this.sequelize.define('UserWithArray', {
        myvals: { type: Sequelize.ARRAY(Sequelize.INTEGER) },
        mystr: { type: Sequelize.ARRAY(Sequelize.STRING) }
      });

      User.sync({force: true}).success(function() {
        User.create({myvals: [], mystr: []}).on('sql', function(sql) {
          expect(sql.indexOf('ARRAY[]::INTEGER[]')).to.be.above(-1);
          expect(sql.indexOf('ARRAY[]::VARCHAR[]')).to.be.above(-1);
          done();
        });
      });
    });

    it('casts empty array correct for postgres update', function(done) {
      if (dialect !== 'postgres') {
        expect('').to.equal('');
        return done();
      }

      var User = this.sequelize.define('UserWithArray', {
        myvals: { type: Sequelize.ARRAY(Sequelize.INTEGER) },
        mystr: { type: Sequelize.ARRAY(Sequelize.STRING) }
      });

      User.sync({force: true}).success(function() {
        User.create({myvals: [1, 2, 3, 4], mystr: ['One', 'Two', 'Three', 'Four']}).on('success', function(user) {
         user.myvals = [];
          user.mystr = [];
          user.save().on('sql', function(sql) {
            expect(sql.indexOf('ARRAY[]::INTEGER[]')).to.be.above(-1);
            expect(sql.indexOf('ARRAY[]::VARCHAR[]')).to.be.above(-1);
            done();
          });
        });
      });
    });

    it("doesn't allow duplicated records with unique:true", function(done) {
      var self = this
        , User = this.sequelize.define('UserWithUniqueUsername', {
            username: { type: Sequelize.STRING, unique: true }
          });

      User.sync({ force: true }).success(function() {
        User.create({ username: 'foo' }).success(function() {
          User.create({ username: 'foo' }).catch (self.sequelize.UniqueConstraintError, function(err) {
            done();
          });
        });
      });
    });

    it('raises an error if created object breaks definition contraints', function(done) {
      var UserNull = this.sequelize.define('UserWithNonNullSmth', {
        username: { type: Sequelize.STRING, unique: true },
        smth: { type: Sequelize.STRING, allowNull: false }
      });

      this.sequelize.options.omitNull = false;

      UserNull.sync({ force: true }).success(function() {
        UserNull.create({ username: 'foo2', smth: null }).error(function(err) {
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
          done();
        });
      });
    });
    it('raises an error if created object breaks definition contraints', function(done) {
      var self = this
        , UserNull = this.sequelize.define('UserWithNonNullSmth', {
            username: { type: Sequelize.STRING, unique: true },
            smth: { type: Sequelize.STRING, allowNull: false }
          });

      this.sequelize.options.omitNull = false;

      UserNull.sync({ force: true }).success(function() {
        UserNull.create({ username: 'foo', smth: 'foo' }).success(function() {
          UserNull.create({ username: 'foo', smth: 'bar' }).catch (self.sequelize.UniqueConstraintError, function(err) {
            done();
          });
        });
      });
    });

    it('raises an error if saving an empty string into a column allowing null or URL', function(done) {
      var StringIsNullOrUrl = this.sequelize.define('StringIsNullOrUrl', {
        str: { type: Sequelize.STRING, allowNull: true, validate: { isURL: true } }
      });

      this.sequelize.options.omitNull = false;

      StringIsNullOrUrl.sync({ force: true }).success(function() {
        StringIsNullOrUrl.create({ str: null }).success(function(str1) {
          expect(str1.str).to.be.null;
          StringIsNullOrUrl.create({ str: 'http://sequelizejs.org' }).success(function(str2) {
            expect(str2.str).to.equal('http://sequelizejs.org');
            StringIsNullOrUrl.create({ str: '' }).error(function(err) {
              expect(err).to.exist;
              expect(err.get('str')[0].message).to.match(/Validation isURL failed/);

              done();
            });
          });
        }).error(done);
      });
    });

    it('raises an error if you mess up the datatype', function(done) {
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
      done();
    });

    it('sets a 64 bit int in bigint', function(done) {
      var User = this.sequelize.define('UserWithBigIntFields', {
        big: Sequelize.BIGINT
      });

      User.sync({ force: true }).success(function() {
        User.create({ big: '9223372036854775807' }).on('success', function(user) {
          expect(user.big).to.be.equal('9223372036854775807');
          done();
        });
      });
    });

    it('sets auto increment fields', function(done) {
      var User = this.sequelize.define('UserWithAutoIncrementField', {
        userid: { type: Sequelize.INTEGER, autoIncrement: true, primaryKey: true, allowNull: false }
      });

      User.sync({ force: true }).success(function() {
        User.create({}).on('success', function(user) {
          expect(user.userid).to.equal(1);

          User.create({}).on('success', function(user) {
            expect(user.userid).to.equal(2);
            done();
          });
        });
      });
    });

    it('allows the usage of options as attribute', function(done) {
      var User = this.sequelize.define('UserWithNameAndOptions', {
        name: Sequelize.STRING,
        options: Sequelize.TEXT
      });

      var options = JSON.stringify({ foo: 'bar', bar: 'foo' });

      User.sync({ force: true }).success(function() {
        User
          .create({ name: 'John Doe', options: options })
          .success(function(user) {
            expect(user.options).to.equal(options);
            done();
          });
      });
    });

    it('allows sql logging', function(done) {
      var User = this.sequelize.define('UserWithUniqueNameAndNonNullSmth', {
        name: {type: Sequelize.STRING, unique: true},
        smth: {type: Sequelize.STRING, allowNull: false}
      });

      User.sync({ force: true }).success(function() {
        User
          .create({ name: 'Fluffy Bunny', smth: 'else' })
          .on('sql', function(sql) {
            expect(sql).to.exist;
            expect(sql.toUpperCase().indexOf('INSERT')).to.be.above(-1);
            done();
          });
      });
    });

    it('should only store the values passed in the whitelist', function(done) {
      var self = this
        , data = { username: 'Peter', secretValue: '42' };

      this.User.create(data, { fields: ['username'] }).success(function(user) {
        self.User.find(user.id).success(function(_user) {
          expect(_user.username).to.equal(data.username);
          expect(_user.secretValue).not.to.equal(data.secretValue);
          expect(_user.secretValue).to.equal(null);
          done();
        });
      });
    });

    it('should store all values if no whitelist is specified', function(done) {
      var self = this
        , data = { username: 'Peter', secretValue: '42' };

      this.User.create(data).success(function(user) {
        self.User.find(user.id).success(function(_user) {
          expect(_user.username).to.equal(data.username);
          expect(_user.secretValue).to.equal(data.secretValue);
          done();
        });
      });
    });

    it('can omit autoincremental columns', function(done) {
      var self = this
        , data = { title: 'Iliad' }
        , dataTypes = [Sequelize.INTEGER, Sequelize.BIGINT]
        , chain = new Sequelize.Utils.QueryChainer()
        , chain2 = new Sequelize.Utils.QueryChainer()
        , books = [];

      dataTypes.forEach(function(dataType, index) {
        books[index] = self.sequelize.define('Book' + index, {
          id: { type: dataType, primaryKey: true, autoIncrement: true },
          title: Sequelize.TEXT
        });
      });

      books.forEach(function(b) {
        chain.add(b.sync({ force: true }));
      });

      chain.run().success(function() {
        books.forEach(function(b) {
          chain2.add(b.create(data));
        });
        chain2.run().success(function(results) {
          results.forEach(function(book, index) {
            expect(book.title).to.equal(data.title);
            expect(book.author).to.equal(data.author);
            expect(books[index].rawAttributes.id.type instanceof dataTypes[index]).to.be.ok;
          });
          done();
        });
      });
    });

    it('saves data with single quote', function(done) {
      var quote = "single'quote"
        , self = this;

      this.User.create({ data: quote }).success(function(user) {
        expect(user.data).to.equal(quote);

        self.User.find({where: { id: user.id }}).success(function(user) {
          expect(user.data).to.equal(quote);
          done();
        });
      });
    });

    it('saves data with double quote', function(done) {
      var quote = 'double"quote'
        , self = this;

      this.User.create({ data: quote }).success(function(user) {
        expect(user.data).to.equal(quote);

        self.User.find({where: { id: user.id }}).success(function(user) {
          expect(user.data).to.equal(quote);
          done();
        });
      });
    });

    it('saves stringified JSON data', function(done) {
      var json = JSON.stringify({ key: 'value' })
        , self = this;

      this.User.create({ data: json }).success(function(user) {
        expect(user.data).to.equal(json);
        self.User.find({where: { id: user.id }}).success(function(user) {
          expect(user.data).to.equal(json);
          done();
        });
      });
    });

    it('stores the current date in createdAt', function(done) {
      this.User.create({ username: 'foo' }).success(function(user) {
        expect(parseInt(+user.createdAt / 5000, 10)).to.be.closeTo(parseInt(+new Date() / 5000, 10), 1.5);
        done();
      });
    });

    it('allows setting custom IDs', function(done) {
      var self = this;
      this.User.create({ id: 42 }).success(function(user) {
        expect(user.id).to.equal(42);

        self.User.find(42).success(function(user) {
          expect(user).to.exist;
          done();
        });
      });
    });

    it('should allow blank creates (with timestamps: false)', function(done) {
      var Worker = this.sequelize.define('Worker', {}, {timestamps: false});
      Worker.sync().done(function() {
        Worker.create({}, {fields: []}).done(function(err, worker) {
          expect(err).not.to.be.ok;
          expect(worker).to.be.ok;
          done();
        });
      });
    });

    it('should allow truly blank creates', function(done) {
      var Worker = this.sequelize.define('Worker', {}, {timestamps: false});
      Worker.sync().done(function() {
        Worker.create({}, {fields: []}).done(function(err, worker) {
          expect(err).not.to.be.ok;
          expect(worker).to.be.ok;
          done();
        });
      });
    });

    it('should only set passed fields', function(done) {
      var User = this.sequelize.define('User', {
        'email': {
          type: DataTypes.STRING
        },
        'name': {
          type: DataTypes.STRING
        }
      });

      this.sequelize.sync({force: true}).done(function(err) {
        expect(err).not.to.be.ok;

        User.create({
          name: 'Yolo Bear',
          email: 'yolo@bear.com'
        }, {
          fields: ['name']
        }).done(function(err, user) {
          expect(err).not.to.be.ok;
          expect(user.name).to.be.ok;
          expect(user.email).not.to.be.ok;

          User.find(user.id).done(function(err, user) {
            expect(err).not.to.be.ok;
            expect(user.name).to.be.ok;
            expect(user.email).not.to.be.ok;
            done();
          });
        });
      });
    });

    describe('enums', function() {
      it('correctly restores enum values', function(done) {
        var self = this
          , Item = self.sequelize.define('Item', {
              state: { type: Sequelize.ENUM, values: ['available', 'in_cart', 'shipped'] }
            });

        Item.sync({ force: true }).success(function() {
          Item.create({ state: 'available' }).success(function(_item) {
            Item.find({ where: { state: 'available' }}).success(function(item) {
              expect(item.id).to.equal(_item.id);
              done();
            });
          });
        });
      });

      it('allows null values', function(done) {
        var Enum = this.sequelize.define('Enum', {
          state: {
            type: Sequelize.ENUM,
            values: ['happy', 'sad'],
            allowNull: true
          }
        });

        Enum.sync({ force: true }).success(function() {
          Enum.create({state: null}).success(function(_enum) {
            expect(_enum.state).to.be.null;
            done();
          });
        });
      });

      describe('when defined via { field: Sequelize.ENUM }', function() {
        it('allows values passed as parameters', function(done) {
          var Enum = this.sequelize.define('Enum', {
            state: Sequelize.ENUM('happy', 'sad')
          });

          Enum.sync({ force: true }).success(function() {
            Enum.create({ state: 'happy' }).success(function() {
              done();
            });
          });
        });

        it('allows values passed as an array', function(done) {
          var Enum = this.sequelize.define('Enum', {
            state: Sequelize.ENUM(['happy', 'sad'])
          });

          Enum.sync({ force: true }).success(function() {
            Enum.create({ state: 'happy' }).success(function() {
              done();
            });
          });
        });
      });

      describe('when defined via { field: { type: Sequelize.ENUM } }', function() {
        it('allows values passed as parameters', function(done) {
          var Enum = this.sequelize.define('Enum', {
            state: {
              type: Sequelize.ENUM('happy', 'sad')
            }
          });

          Enum.sync({ force: true }).success(function() {
            Enum.create({ state: 'happy' }).success(function() {
              done();
            });
          });
        });

        it('allows values passed as an array', function(done) {
          var Enum = this.sequelize.define('Enum', {
            state: {
              type: Sequelize.ENUM(['happy', 'sad'])
            }
          });

          Enum.sync({ force: true }).success(function() {
            Enum.create({ state: 'happy' }).success(function() {
              done();
            });
          });
        });
      });

      describe('can safely sync multiple times', function() {
        it('through the factory', function(done) {
          var Enum = this.sequelize.define('Enum', {
            state: {
              type: Sequelize.ENUM,
              values: ['happy', 'sad'],
              allowNull: true
            }
          });

          Enum.sync({ force: true }).success(function() {
            Enum.sync().success(function() {
              Enum.sync({ force: true }).complete(done);
            });
          });
        });

        it('through sequelize', function(done) {
          var self = this
            , Enum = this.sequelize.define('Enum', {
                state: {
                  type: Sequelize.ENUM,
                  values: ['happy', 'sad'],
                  allowNull: true
                }
              });

          this.sequelize.sync({ force: true }).success(function() {
            self.sequelize.sync().success(function() {
              self.sequelize.sync({ force: true }).complete(done);
            });
          });
        });
      });
    });
  });

  describe('bulkCreate', function() {
    if (current.dialect.supports.transactions) {
      it('supports transactions', function(done) {
        var self = this;
        this.sequelize.transaction().then(function(t) {
          self.User
            .bulkCreate([{ username: 'foo' }, { username: 'bar' }], { transaction: t })
            .success(function() {
              self.User.count().success(function(count1) {
                self.User.count({ transaction: t }).success(function(count2) {
                  expect(count1).to.equal(0);
                  expect(count2).to.equal(2);
                  t.rollback().success(function() { done(); });
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

    it('properly handles disparate field lists', function(done) {
      var self = this
        , data = [{username: 'Peter', secretValue: '42', uniqueName: '1' },
                  {username: 'Paul', uniqueName: '2'},
                  {username: 'Steve', uniqueName: '3'}];

      this.User.bulkCreate(data).success(function() {
        self.User.findAll({where: {username: 'Paul'}}).success(function(users) {
          expect(users.length).to.equal(1);
          expect(users[0].username).to.equal('Paul');
          expect(users[0].secretValue).to.be.null;
          done();
        });
      });
    });

    it('inserts multiple values respecting the white list', function(done) {
      var self = this
        , data = [{ username: 'Peter', secretValue: '42', uniqueName: '1' },
                  { username: 'Paul', secretValue: '23', uniqueName: '2'}];

      this.User.bulkCreate(data, { fields: ['username', 'uniqueName'] }).success(function() {
        self.User.findAll({order: 'id'}).success(function(users) {
          expect(users.length).to.equal(2);
          expect(users[0].username).to.equal('Peter');
          expect(users[0].secretValue).to.be.null;
          expect(users[1].username).to.equal('Paul');
          expect(users[1].secretValue).to.be.null;
          done();
        });
      });
    });

    it('should store all values if no whitelist is specified', function(done) {
      var self = this
        , data = [{ username: 'Peter', secretValue: '42', uniqueName: '1' },
                  { username: 'Paul', secretValue: '23', uniqueName: '2'}];

      this.User.bulkCreate(data).success(function() {
        self.User.findAll({order: 'id'}).success(function(users) {
          expect(users.length).to.equal(2);
          expect(users[0].username).to.equal('Peter');
          expect(users[0].secretValue).to.equal('42');
          expect(users[1].username).to.equal('Paul');
          expect(users[1].secretValue).to.equal('23');
          done();
        });
      });
    });

    it('saves data with single quote', function(done) {
      var self = this
        , quote = "Single'Quote"
        , data = [{ username: 'Peter', data: quote, uniqueName: '1'},
                  { username: 'Paul', data: quote, uniqueName: '2'}];

      this.User.bulkCreate(data).success(function() {
        self.User.findAll({order: 'id'}).success(function(users) {
          expect(users.length).to.equal(2);
          expect(users[0].username).to.equal('Peter');
          expect(users[0].data).to.equal(quote);
          expect(users[1].username).to.equal('Paul');
          expect(users[1].data).to.equal(quote);
          done();
        });
      });
    });

    it('saves data with double quote', function(done) {
      var self = this
        , quote = 'Double"Quote'
        , data = [{ username: 'Peter', data: quote, uniqueName: '1'},
                  { username: 'Paul', data: quote, uniqueName: '2'}];

      this.User.bulkCreate(data).success(function() {
        self.User.findAll({order: 'id'}).success(function(users) {
          expect(users.length).to.equal(2);
          expect(users[0].username).to.equal('Peter');
          expect(users[0].data).to.equal(quote);
          expect(users[1].username).to.equal('Paul');
          expect(users[1].data).to.equal(quote);
          done();
        });
      });
    });

    it('saves stringified JSON data', function(done) {
      var self = this
        , json = JSON.stringify({ key: 'value' })
        , data = [{ username: 'Peter', data: json, uniqueName: '1'},
                  { username: 'Paul', data: json, uniqueName: '2'}];

      this.User.bulkCreate(data).success(function() {
        self.User.findAll({order: 'id'}).success(function(users) {
          expect(users.length).to.equal(2);
          expect(users[0].username).to.equal('Peter');
          expect(users[0].data).to.equal(json);
          expect(users[1].username).to.equal('Paul');
          expect(users[1].data).to.equal(json);
          done();
        });
      });
    });

    it('properly handles a model with a length column', function(done) {
      var UserWithLength = this.sequelize.define('UserWithLength', {
        length: Sequelize.INTEGER
      });

      UserWithLength.sync({force: true}).success(function() {
        UserWithLength.bulkCreate([{ length: 42}, {length: 11}]).success(function() {
          done();
        });
      });
    });

    it('stores the current date in createdAt', function(done) {
      var self = this
        , data = [{ username: 'Peter', uniqueName: '1'},
                  { username: 'Paul', uniqueName: '2'}];

      this.User.bulkCreate(data).success(function() {
        self.User.findAll({order: 'id'}).success(function(users) {
          expect(users.length).to.equal(2);
          expect(users[0].username).to.equal('Peter');
          expect(parseInt(+users[0].createdAt / 5000, 10)).to.be.closeTo(parseInt(+new Date() / 5000, 10), 1.5);
          expect(users[1].username).to.equal('Paul');
          expect(parseInt(+users[1].createdAt / 5000, 10)).to.be.closeTo(parseInt(+new Date() / 5000, 10), 1.5);
          done();
        });
      });
    });

    it('emits an error when validate is set to true', function(done) {
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

      Tasks.sync({ force: true }).success(function() {
        Tasks.bulkCreate([
          {name: 'foo', code: '123'},
          {code: '1234'},
          {name: 'bar', code: '1'}
        ], { validate: true }).error(function(errors) {
          expect(errors).to.not.be.null;
          expect(errors).to.be.an('Array');
          expect(errors).to.have.length(2);
          expect(errors[0].record.code).to.equal('1234');
          expect(errors[0].errors.get('name')[0].type).to.equal('notNull Violation');
          expect(errors[1].record.name).to.equal('bar');
          expect(errors[1].record.code).to.equal('1');
          expect(errors[1].errors.get('code')[0].message).to.equal('Validation len failed');
          done();
        });
      });
    });

    it("doesn't emit an error when validate is set to true but our selectedValues are fine", function(done) {
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

      Tasks.sync({ force: true }).success(function() {
        Tasks.bulkCreate([
          {name: 'foo', code: '123'},
          {code: '1234'}
        ], { fields: ['code'], validate: true }).success(function() {
          // we passed!
          done();
        });
      });
    });

    it('should allow blank arrays (return immediatly)', function(done) {
      var Worker = this.sequelize.define('Worker', {});
      Worker.sync().done(function() {
        Worker.bulkCreate([]).done(function(err, workers) {
          expect(err).not.to.be.ok;
          expect(workers).to.be.ok;
          expect(workers.length).to.equal(0);
          done();
        });
      });
    });

    it('should allow blank creates (with timestamps: false)', function(done) {
      var Worker = this.sequelize.define('Worker', {}, {timestamps: false});
      Worker.sync().done(function() {
        Worker.bulkCreate([{}, {}]).done(function(err, workers) {
          expect(err).not.to.be.ok;
          expect(workers).to.be.ok;
          done();
        });
      });
    });

    it('should allow autoincremented attributes to be set', function(done) {
      var Worker = this.sequelize.define('Worker', {}, {timestamps: false});
      Worker.sync().done(function() {
        Worker.bulkCreate([
          {id: 5},
          {id: 10}
        ]).done(function(err) {
          expect(err).not.to.be.ok;
          Worker.findAll({order: 'id ASC'}).done(function(err, workers) {
            expect(workers[0].id).to.equal(5);
            expect(workers[1].id).to.equal(10);
            done();
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
      it('should support the ignoreDuplicates option', function(done) {
        var self = this
          , data = [{ uniqueName: 'Peter', secretValue: '42' },
                    { uniqueName: 'Paul', secretValue: '23' }];

        this.User.bulkCreate(data, { fields: ['uniqueName', 'secretValue'] }).success(function() {
          data.push({ uniqueName: 'Michael', secretValue: '26' });
          self.User.bulkCreate(data, { fields: ['uniqueName', 'secretValue'], ignoreDuplicates: true }).success(function() {
            self.User.findAll({order: 'id'}).success(function(users) {
              expect(users.length).to.equal(3);
              expect(users[0].uniqueName).to.equal('Peter');
              expect(users[0].secretValue).to.equal('42');
              expect(users[1].uniqueName).to.equal('Paul');
              expect(users[1].secretValue).to.equal('23');
              expect(users[2].uniqueName).to.equal('Michael');
              expect(users[2].secretValue).to.equal('26');
              done();
            });
          });
        });
      });
    } else {
      it('should throw an error when the ignoreDuplicates option is passed', function(done) {
        var self = this
          , data = [{ uniqueName: 'Peter', secretValue: '42' },
                    { uniqueName: 'Paul', secretValue: '23' }];

        this.User.bulkCreate(data, { fields: ['uniqueName', 'secretValue'] }).success(function() {
          data.push({ uniqueName: 'Michael', secretValue: '26' });

          self.User.bulkCreate(data, { fields: ['uniqueName', 'secretValue'], ignoreDuplicates: true }).error(function(err) {
            expect(err).to.exist;
            if (dialect === 'mssql') {
              console.log(err.message);
              expect(err.message).to.match(/mssql does not support the \'ignoreDuplicates\' option./);
            } else {
              expect(err.message).to.match(/postgres does not support the \'ignoreDuplicates\' option./);
            }

            done();
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
      it('correctly restores enum values', function(done) {
        var self = this
          , Item = self.sequelize.define('Item', {
              state: { type: Sequelize.ENUM, values: ['available', 'in_cart', 'shipped'] },
              name: Sequelize.STRING
            });

        Item.sync({ force: true }).success(function() {
          Item.bulkCreate([{state: 'in_cart', name: 'A'}, { state: 'available', name: 'B'}]).success(function() {
            Item.find({ where: { state: 'available' }}).success(function(item) {
              expect(item.name).to.equal('B');
              done();
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
