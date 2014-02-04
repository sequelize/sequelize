/* jshint camelcase: false */
/* jshint expr: true */
var chai      = require('chai')
  , Sequelize = require('../../index')
  , expect    = chai.expect
  , Support   = require(__dirname + '/../support')
  , DataTypes = require(__dirname + "/../../lib/data-types")
  , dialect   = Support.getTestDialect()
  , config    = require(__dirname + "/../config/config")
  , sinon     = require('sinon')
  , datetime  = require('chai-datetime')
  , _         = require('lodash')
  , moment    = require('moment')
  , async     = require('async')

chai.use(datetime)
chai.Assertion.includeStack = true

describe(Support.getTestDialectTeaser("DAOFactory"), function () {
  beforeEach(function(done) {
    this.User = this.sequelize.define('User', {
      username:     DataTypes.STRING,
      secretValue:  DataTypes.STRING,
      data:         DataTypes.STRING,
      intVal:       DataTypes.INTEGER,
      theDate:      DataTypes.DATE,
      aBool:        DataTypes.BOOLEAN,
      uniqueName:   { type: DataTypes.STRING, unique: true }
    })

    this.User.sync({ force: true }).success(function() {
      done()
    })
  })

  describe('findOrCreate', function () {
    it("supports transactions", function(done) {
      var self = this

      Support.prepareTransactionTest(this.sequelize, function(sequelize) {
        var User = sequelize.define('user_with_transaction', { username: Sequelize.STRING, data: Sequelize.STRING })

        User
          .sync({ force: true })
          .success(function() {
            sequelize.transaction(function(t) {
              User.findOrCreate({ username: 'Username' }, { data: 'some data' }, { transaction: t }).complete(function(err) {
                expect(err).to.be.null

                User.count().success(function(count) {
                  expect(count).to.equal(0)
                  t.commit().success(function() {
                    User.count().success(function(count) {
                      expect(count).to.equal(1)
                      done()
                    })
                  })
                })
              })
            })
          })
      })
    })

    it("returns instance if already existent. Single find field.", function(done) {
      var self = this,
        data = {
          username: 'Username'
        };

      this.User.create(data).success(function (user) {
        self.User.findOrCreate({
          username: user.username
        }).success(function (_user, created) {
          expect(_user.id).to.equal(user.id)
          expect(_user.username).to.equal('Username')
          expect(created).to.be.false
          done()
        })
      })
    })

    it("Returns instance if already existent. Multiple find fields.", function(done) {
      var self = this,
        data = {
          username: 'Username',
          data: 'ThisIsData'
        };

      this.User.create(data).success(function (user) {
        self.User.findOrCreate(data).done(function (err, _user, created) {
          expect(_user.id).to.equal(user.id)
          expect(_user.username).to.equal('Username')
          expect(_user.data).to.equal('ThisIsData')
          expect(created).to.be.false
          done()
        })
      })
    })

    it("creates new instance with default value.", function(done) {
      var data = {
          username: 'Username'
        },
        default_values = {
          data: 'ThisIsData'
        };

      this.User.findOrCreate(data, default_values).success(function(user, created) {
        expect(user.username).to.equal('Username')
        expect(user.data).to.equal('ThisIsData')
        expect(created).to.be.true
        done()
      })
    })

    it("supports .or() (only using default values)", function (done) {
      this.User.findOrCreate(
        Sequelize.or({username: 'Fooobzz'}, {secretValue: 'Yolo'}),
        {username: 'Fooobzz', secretValue: 'Yolo'}
      ).done(function (err, user, created) {
        expect(err).not.to.be.ok
        expect(user.username).to.equal('Fooobzz')
        expect(user.secretValue).to.equal('Yolo')
        expect(created).to.be.true

        done()
      })
    })
  })

  describe('create', function() {
    it('supports transactions', function(done) {
      var self = this

      Support.prepareTransactionTest(this.sequelize, function(sequelize) {
        var User = sequelize.define('user_with_transaction', { username: Sequelize.STRING })

        User.sync({ force: true }).success(function() {
          sequelize.transaction(function(t) {
            User.create({ username: 'user' }, { transaction: t }).success(function() {
              User.count().success(function(count) {
                expect(count).to.equal(0)
                t.commit().success(function() {
                  User.count().success(function(count) {
                    expect(count).to.equal(1)
                    done()
                  })
                })
              })
            })
          })
        })
      })
    })

    it('is possible to use casting when creating an instance', function (done) {
      var self = this
        , type = Support.dialectIsMySQL() ? 'signed' : 'integer'
        , _done = _.after(2, function() {
          done()
        })

      this.User.create({
        intVal: this.sequelize.cast('1', type)
      }).on('sql', function (sql) {
        expect(sql).to.match(new RegExp('CAST\\(1 AS ' + type.toUpperCase() + '\\)'))
        _done()
      })
      .success(function (user) {
        self.User.find(user.id).success(function (user) {
          expect(user.intVal).to.equal(1)
          _done()
        })
      })
    })

    it('is possible to use casting multiple times mixed in with other utilities', function (done) {
      var self  = this
        , type  = this.sequelize.cast(this.sequelize.cast(this.sequelize.literal('1-2'), 'integer'), 'integer')
        , _done = _.after(2, function() {
          done()
        })

      if (Support.dialectIsMySQL()) {
        type = this.sequelize.cast(this.sequelize.cast(this.sequelize.literal('1-2'), 'unsigned'), 'signed')
      }

      this.User.create({
        intVal: type
      }).on('sql', function (sql) {
        if (Support.dialectIsMySQL()) {
          expect(sql).to.contain('CAST(CAST(1-2 AS UNSIGNED) AS SIGNED)')
        } else {
          expect(sql).to.contain('CAST(CAST(1-2 AS INTEGER) AS INTEGER)')
        }

        _done()
      }).success(function (user) {
        self.User.find(user.id).success(function (user) {
          expect(user.intVal).to.equal(-1)
          _done()
        })
      })
    })

    it('is possible to just use .literal() to bypass escaping', function (done) {
      var self = this

      this.User.create({
        intVal: this.sequelize.literal('CAST(1-2 AS ' + (Support.dialectIsMySQL() ? 'SIGNED' : 'INTEGER') + ')')
      }).success(function (user) {
        self.User.find(user.id).success(function (user) {
          expect(user.intVal).to.equal(-1)
          done()
        })
      })
    })

    it('is possible for .literal() to contain other utility functions', function (done) {
      var self = this

      this.User.create({
        intVal: this.sequelize.literal(this.sequelize.cast('1-2', (Support.dialectIsMySQL() ? 'SIGNED' : 'INTEGER')))
      }).success(function (user) {
        self.User.find(user.id).success(function (user) {
          expect(user.intVal).to.equal(-1)
          done()
        })
      })
    })

    it('is possible to use funtions when creating an instance', function (done) {
      var self = this
      this.User.create({
        secretValue: this.sequelize.fn('upper', 'sequelize')
      }).success(function (user) {
        self.User.find(user.id).success(function (user) {
          expect(user.secretValue).to.equal('SEQUELIZE')
          done()
        })
      })
    })

    it('is possible to use functions as default values', function (done) {
      var self = this
        , userWithDefaults

      if (dialect.indexOf('postgres') === 0) {
        this.sequelize.query('CREATE EXTENSION IF NOT EXISTS "uuid-ossp"').success(function() {
          userWithDefaults = self.sequelize.define('userWithDefaults', {
            uuid: {
              type: 'UUID',
              defaultValue: self.sequelize.fn('uuid_generate_v4')
            }
          })

          userWithDefaults.sync({force: true}).success(function () {
            userWithDefaults.create({}).success(function (user) {
              // uuid validation regex taken from http://stackoverflow.com/a/13653180/800016
              expect(user.uuid).to.match(/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i)
              done()
            })
          })
        })
      } else if (dialect === 'sqlite') {
        // The definition here is a bit hacky. sqlite expects () around the expression for default values, so we call a function without a name
        // to enclose the date function in (). http://www.sqlite.org/syntaxdiagrams.html#column-constraint
        userWithDefaults = self.sequelize.define('userWithDefaults', {
          year: {
            type: Sequelize.STRING,
            defaultValue: self.sequelize.fn('', self.sequelize.fn('date', 'now'))
          }
        })

        userWithDefaults.sync({force: true}).success(function () {
          userWithDefaults.create({}).success(function (user) {
            userWithDefaults.find(user.id).success(function (user) {
              var now = new Date()
                , pad = function (number) {
                  if (number > 9) {
                    return number
                  }
                  return '0' + number
                }

              expect(user.year).to.equal(now.getUTCFullYear() + '-' + pad(now.getUTCMonth() + 1) + '-' + pad(now.getUTCDate()))
              done()
            })
          })
        })
      } else {
        // functions as default values are not supported in mysql, see http://stackoverflow.com/a/270338/800016
        done()
      }
    })

    it("casts empty arrays correctly for postgresql insert", function(done) {
      if (dialect !== "postgres") {
        expect('').to.equal('')
        return done()
      }

      var User = this.sequelize.define('UserWithArray', {
        myvals: { type: Sequelize.ARRAY(Sequelize.INTEGER) },
        mystr: { type: Sequelize.ARRAY(Sequelize.STRING) }
      })

      User.sync({force: true}).success(function() {
        User.create({myvals: [], mystr: []}).on('sql', function(sql){
          expect(sql.indexOf('ARRAY[]::INTEGER[]')).to.be.above(-1)
          expect(sql.indexOf('ARRAY[]::VARCHAR[]')).to.be.above(-1)
          done()
        })
      })
    })

    it("casts empty array correct for postgres update", function(done) {
      if (dialect !== "postgres") {
        expect('').to.equal('')
        return done()
      }

      var User = this.sequelize.define('UserWithArray', {
        myvals: { type: Sequelize.ARRAY(Sequelize.INTEGER) },
        mystr: { type: Sequelize.ARRAY(Sequelize.STRING) }
      })

      User.sync({force: true}).success(function() {
        User.create({myvals: [1,2,3,4], mystr: ["One", "Two", "Three", "Four"]}).on('success', function(user){
         user.myvals = []
          user.mystr = []
          user.save().on('sql', function(sql) {
            expect(sql.indexOf('ARRAY[]::INTEGER[]')).to.be.above(-1)
            expect(sql.indexOf('ARRAY[]::VARCHAR[]')).to.be.above(-1)
            done()
          })
        })
      })
    })

    it("doesn't allow duplicated records with unique:true", function(done) {
      var User = this.sequelize.define('UserWithUniqueUsername', {
        username: { type: Sequelize.STRING, unique: true }
      })

      User.sync({ force: true }).success(function() {
        User.create({ username:'foo' }).success(function() {
          User.create({ username: 'foo' }).error(function(err) {
            expect(err).to.exist

            if (dialect === "sqlite") {
              expect(err.message).to.match(/.*SQLITE_CONSTRAINT.*/)
            }
            else if (Support.dialectIsMySQL()) {
              expect(err.message).to.match(/.*Duplicate\ entry.*/)
            } else {
              expect(err.message).to.match(/.*duplicate\ key\ value.*/)
            }

            done()
          })
        })
      })
    })

    it("raises an error if created object breaks definition contraints", function(done) {
      var UserNull = this.sequelize.define('UserWithNonNullSmth', {
        username: { type: Sequelize.STRING, unique: true },
        smth:     { type: Sequelize.STRING, allowNull: false }
      })

      this.sequelize.options.omitNull = false

      UserNull.sync({ force: true }).success(function() {
        UserNull.create({ username: 'foo2', smth: null }).error(function(err) {
          expect(err).to.exist

          if (Support.dialectIsMySQL()) {
            // We need to allow two different errors for MySQL, see:
            // http://dev.mysql.com/doc/refman/5.0/en/server-sql-mode.html#sqlmode_strict_trans_tables
            expect(err.message).to.match(/(Column 'smth' cannot be null|Field 'smth' doesn't have a default value)/)
          }
          else if (dialect === "sqlite") {
            expect(err.message).to.match(/.*SQLITE_CONSTRAINT.*/)
          } else {
            expect(err.message).to.match(/.*column "smth" violates not-null.*/)
          }

          UserNull.create({ username: 'foo', smth: 'foo' }).success(function() {
            UserNull.create({ username: 'foo', smth: 'bar' }).error(function(err) {
              expect(err).to.exist

              if (dialect === "sqlite") {
                expect(err.message).to.match(/.*SQLITE_CONSTRAINT.*/)
              }
              else if (Support.dialectIsMySQL()) {
                expect(err.message).to.match(/Duplicate entry 'foo' for key 'username'/)
              } else {
                expect(err.message).to.match(/.*duplicate key value violates unique constraint.*/)
              }

              done()
            })
          })
        })
      })
    })

    it("raises an error if saving an empty string into a column allowing null or URL", function(done) {
      var StringIsNullOrUrl = this.sequelize.define('StringIsNullOrUrl', {
        str: { type: Sequelize.STRING, allowNull: true, validate: { isUrl: true } }
      })

      this.sequelize.options.omitNull = false

      StringIsNullOrUrl.sync({ force: true }).success(function() {
        StringIsNullOrUrl.create({ str: null }).success(function(str1) {
          expect(str1.str).to.be.null

          StringIsNullOrUrl.create({ str: 'http://sequelizejs.org' }).success(function(str2) {
            expect(str2.str).to.equal('http://sequelizejs.org')

            StringIsNullOrUrl.create({ str: '' }).error(function(err) {
              expect(err).to.exist
              expect(err.str[0]).to.match(/Invalid URL: str/)

              done()
            })
          })
        })
      })
    })

    it('raises an error if you mess up the datatype', function(done) {
      var self = this
      expect(function() {
        self.sequelize.define('UserBadDataType', {
          activity_date: Sequelize.DATe
        })
      }).to.throw(Error, 'Unrecognized data type for field activity_date')

      expect(function() {
        self.sequelize.define('UserBadDataType', {
          activity_date: {type: Sequelize.DATe}
        })
      }).to.throw(Error, 'Unrecognized data type for field activity_date')
      done()
    })

    it('sets a 64 bit int in bigint', function(done) {
      var User = this.sequelize.define('UserWithBigIntFields', {
        big: Sequelize.BIGINT
      })

      User.sync({ force: true }).success(function() {
        User.create({ big: '9223372036854775807' }).on('success', function(user) {
          expect(user.big).to.be.equal( '9223372036854775807' )
          done()
        })
      })
    })

    it('sets auto increment fields', function(done) {
      var User = this.sequelize.define('UserWithAutoIncrementField', {
        userid: { type: Sequelize.INTEGER, autoIncrement: true, primaryKey: true, allowNull: false }
      })

      User.sync({ force: true }).success(function() {
        User.create({}).on('success', function(user) {
          expect(user.userid).to.equal(1)

          User.create({}).on('success', function(user) {
            expect(user.userid).to.equal(2)
            done()
          })
        })
      })
    })

    it('allows the usage of options as attribute', function(done) {
      var User = this.sequelize.define('UserWithNameAndOptions', {
        name: Sequelize.STRING,
        options: Sequelize.TEXT
      })

      var options = JSON.stringify({ foo: 'bar', bar: 'foo' })

      User.sync({ force: true }).success(function() {
        User
          .create({ name: 'John Doe', options: options })
          .success(function(user) {
            expect(user.options).to.equal(options)
            done()
          })
      })
    })

    it('allows sql logging', function(done) {
      var User = this.sequelize.define('UserWithUniqueNameAndNonNullSmth', {
        name: {type: Sequelize.STRING, unique: true},
        smth: {type: Sequelize.STRING, allowNull: false}
      })

      User.sync({ force: true }).success(function() {
        User
          .create({ name: 'Fluffy Bunny', smth: 'else' })
          .on('sql', function(sql) {
            expect(sql).to.exist
            expect(sql.toUpperCase().indexOf("INSERT")).to.be.above(-1)
            done()
          })
      })
    })

    it('should only store the values passed in the whitelist', function(done) {
      var self = this
        , data = { username: 'Peter', secretValue: '42' }

      this.User.create(data, { fields: ['username'] }).success(function(user) {
        self.User.find(user.id).success(function(_user) {
          expect(_user.username).to.equal(data.username)
          expect(_user.secretValue).not.to.equal(data.secretValue)
          expect(_user.secretValue).to.equal(null)
          done()
        })
      })
    })

    it('should store all values if no whitelist is specified', function(done) {
      var self = this
        , data = { username: 'Peter', secretValue: '42' }

      this.User.create(data).success(function(user) {
        self.User.find(user.id).success(function(_user) {
          expect(_user.username).to.equal(data.username)
          expect(_user.secretValue).to.equal(data.secretValue)
          done()
        })
      })
    })

    it('can omit autoincremental columns', function(done) {
      var self = this
        , data = { title: 'Iliad' }
        , dataTypes = [Sequelize.INTEGER, Sequelize.BIGINT]
        , chain = new Sequelize.Utils.QueryChainer()
        , chain2 = new Sequelize.Utils.QueryChainer()
        , books = []

      dataTypes.forEach(function(dataType, index) {
        books[index] = self.sequelize.define('Book'+index, {
          id: { type: dataType, primaryKey: true, autoIncrement: true },
          title: Sequelize.TEXT
        })
      })

      books.forEach(function(b) {
        chain.add(b.sync({ force: true }))
      })

      chain.run().success(function() {
        books.forEach(function(b) {
          chain2.add(b.create(data))
        })
        chain2.run().success(function(results) {
          results.forEach(function(book, index) {
            expect(book.title).to.equal(data.title)
            expect(book.author).to.equal(data.author)
            expect(books[index].rawAttributes.id.type.toString())
              .to.equal(dataTypes[index].toString())
          })
          done()
        })
      })
    })

    it('saves data with single quote', function(done) {
      var quote = "single'quote"
        , self  = this

      this.User.create({ data: quote }).success(function(user) {
        expect(user.data).to.equal(quote)

        self.User.find({where: { id: user.id }}).success(function(user) {
          expect(user.data).to.equal(quote)
          done()
        })
      })
    })

    it('saves data with double quote', function(done) {
      var quote = 'double"quote'
        , self  = this

      this.User.create({ data: quote }).success(function(user) {
        expect(user.data).to.equal(quote)

        self.User.find({where: { id: user.id }}).success(function(user) {
          expect(user.data).to.equal(quote)
          done()
        })
      })
    })

    it('saves stringified JSON data', function(done) {
      var json = JSON.stringify({ key: 'value' })
        , self = this

      this.User.create({ data: json }).success(function(user) {
        expect(user.data).to.equal(json)
        self.User.find({where: { id: user.id }}).success(function(user) {
          expect(user.data).to.equal(json)
          done()
        })
      })
    })

    it('stores the current date in createdAt', function(done) {
      this.User.create({ username: 'foo' }).success(function(user) {
        expect(parseInt(+user.createdAt/5000, 10)).to.be.closeTo(parseInt(+new Date()/5000, 10), 1.5)
        done()
      })
    })

    it('allows setting custom IDs', function(done) {
      var self = this
      this.User.create({ id: 42 }).success(function (user) {
        expect(user.id).to.equal(42)

        self.User.find(42).success(function (user) {
          expect(user).to.exist
          done()
        })
      })
    })

    it('should allow blank creates (with timestamps: false)', function (done) {
      var Worker = this.sequelize.define('Worker', {}, {timestamps: false})
      Worker.sync().done(function(err) {
        Worker.create({}, {fields: []}).done(function (err, worker) {
          expect(err).not.to.be.ok
          expect(worker).to.be.ok
          done()
        })
      })
    })

    it('should allow truly blank creates', function (done) {
      var Worker = this.sequelize.define('Worker', {}, {timestamps: false})
      Worker.sync().done(function(err) {
        Worker.create({}, {fields: []}).done(function (err, worker) {
          expect(err).not.to.be.ok
          expect(worker).to.be.ok
          done()
        })
      })
    })

    describe('enums', function() {
      it('correctly restores enum values', function(done) {
        var self = this
          , Item = self.sequelize.define('Item', {
          state: { type: Sequelize.ENUM, values: ['available', 'in_cart', 'shipped'] }
        })

        Item.sync({ force: true }).success(function() {
          Item.create({ state: 'available' }).success(function(_item) {
            Item.find({ where: { state: 'available' }}).success(function(item) {
              expect(item.id).to.equal(_item.id)
              done()
            })
          })
        })
      })

      it('allows null values', function(done) {
        var Enum = this.sequelize.define('Enum', {
          state: {
            type: Sequelize.ENUM,
            values: ['happy', 'sad'],
            allowNull: true
          }
        })

        Enum.sync({ force: true }).success(function() {
          Enum.create({state: null}).success(function(_enum) {
            expect(_enum.state).to.be.null
            done()
          })
        })
      })

      describe('when defined via { field: Sequelize.ENUM }', function() {
        it('allows values passed as parameters', function(done) {
          var Enum = this.sequelize.define('Enum', {
            state: Sequelize.ENUM('happy', 'sad')
          })

          Enum.sync({ force: true }).success(function() {
            Enum.create({ state: 'happy' }).success(function(_item) {
              done()
            });
          });
        })

        it('allows values passed as an array', function(done) {
          var Enum = this.sequelize.define('Enum', {
            state: Sequelize.ENUM(['happy', 'sad'])
          })

          Enum.sync({ force: true }).success(function() {
            Enum.create({ state: 'happy' }).success(function(_item) {
              done()
            });
          });
        })
      })

      describe('when defined via { field: { type: Sequelize.ENUM } }', function() {
        it('allows values passed as parameters', function(done) {
          var Enum = this.sequelize.define('Enum', {
            state: {
              type: Sequelize.ENUM('happy', 'sad')
            }
          })

          Enum.sync({ force: true }).success(function() {
            Enum.create({ state: 'happy' }).success(function(_item) {
              done()
            });
          });
        })

        it('allows values passed as an array', function(done) {
          var Enum = this.sequelize.define('Enum', {
            state: {
              type: Sequelize.ENUM(['happy', 'sad'])
            }
          })

          Enum.sync({ force: true }).success(function() {
            Enum.create({ state: 'happy' }).success(function(_item) {
              done()
            });
          });
        })
      })

      describe('can safely sync multiple times', function(done) {
        it('through the factory', function(done) {
          var Enum = this.sequelize.define('Enum', {
            state: {
              type: Sequelize.ENUM,
              values: ['happy', 'sad'],
              allowNull: true
            }
          })

          Enum.sync({ force: true }).success(function() {
            Enum.sync().success(function() {
              Enum.sync({ force: true }).complete(done)
            })
          })
        })

        it('through sequelize', function(done) {
          var self = this
            , Enum = this.sequelize.define('Enum', {
            state: {
              type: Sequelize.ENUM,
              values: ['happy', 'sad'],
              allowNull: true
            }
          })

          this.sequelize.sync({ force: true }).success(function() {
            self.sequelize.sync().success(function() {
              self.sequelize.sync({ force: true }).complete(done)
            })
          })
        })
      })
    })
  })

  describe('bulkCreate', function() {
    it("supports transactions", function(done) {
      Support.prepareTransactionTest(this.sequelize, function(sequelize) {
        var User = sequelize.define('User', { username: Sequelize.STRING })

        User.sync({ force: true }).success(function() {
          sequelize.transaction(function(t) {
            User
              .bulkCreate([{ username: 'foo' }, { username: 'bar' }], { transaction: t })
              .success(function() {
                User.count().success(function(count1) {
                  User.count({ transaction: t }).success(function(count2) {
                    expect(count1).to.equal(0)
                    expect(count2).to.equal(2)
                    t.rollback().success(function(){ done() })
                  })
                })
              })
          })
        })
      })
    })

    it('properly handles disparate field lists', function(done) {
      var self = this
        , data = [{username: 'Peter', secretValue: '42' },
                  {username: 'Paul'},
                  {username: 'Steve'}]

      this.User.bulkCreate(data).success(function() {
        self.User.findAll({where: {username: 'Paul'}}).success(function(users) {
          expect(users.length).to.equal(1)
          expect(users[0].username).to.equal("Paul")
          expect(users[0].secretValue).to.be.null
          done()
        })
      })
    })

    it('inserts multiple values respecting the white list', function(done) {
      var self = this
        , data = [{ username: 'Peter', secretValue: '42' },
                  { username: 'Paul', secretValue: '23'}]

      this.User.bulkCreate(data, { fields: ['username'] }).success(function() {
        self.User.findAll({order: 'id'}).success(function(users) {
          expect(users.length).to.equal(2)
          expect(users[0].username).to.equal("Peter")
          expect(users[0].secretValue).to.be.null;
          expect(users[1].username).to.equal("Paul")
          expect(users[1].secretValue).to.be.null;
          done()
        })
      })
    })

    it('should store all values if no whitelist is specified', function(done) {
      var self = this
        , data = [{ username: 'Peter', secretValue: '42' },
                  { username: 'Paul', secretValue: '23'}]

      this.User.bulkCreate(data).success(function() {
        self.User.findAll({order: 'id'}).success(function(users) {
          expect(users.length).to.equal(2)
          expect(users[0].username).to.equal("Peter")
          expect(users[0].secretValue).to.equal('42')
          expect(users[1].username).to.equal("Paul")
          expect(users[1].secretValue).to.equal('23')
          done()
        })
      })
    })

    it('saves data with single quote', function(done) {
      var self = this
        , quote = "Single'Quote"
        , data = [{ username: 'Peter', data: quote},
                  { username: 'Paul', data: quote}]

      this.User.bulkCreate(data).success(function() {
        self.User.findAll({order: 'id'}).success(function(users) {
          expect(users.length).to.equal(2)
          expect(users[0].username).to.equal("Peter")
          expect(users[0].data).to.equal(quote)
          expect(users[1].username).to.equal("Paul")
          expect(users[1].data).to.equal(quote)
          done()
        })
      })
    })

    it('saves data with double quote', function(done) {
      var self = this
        , quote = 'Double"Quote'
        , data = [{ username: 'Peter', data: quote},
                  { username: 'Paul', data: quote}]

      this.User.bulkCreate(data).success(function() {
        self.User.findAll({order: 'id'}).success(function(users) {
          expect(users.length).to.equal(2)
          expect(users[0].username).to.equal("Peter")
          expect(users[0].data).to.equal(quote)
          expect(users[1].username).to.equal("Paul")
          expect(users[1].data).to.equal(quote)
          done()
        })
      })
    })

    it('saves stringified JSON data', function(done) {
      var self = this
        , json = JSON.stringify({ key: 'value' })
        , data = [{ username: 'Peter', data: json},
                  { username: 'Paul', data: json}]

      this.User.bulkCreate(data).success(function() {
        self.User.findAll({order: 'id'}).success(function(users) {
          expect(users.length).to.equal(2)
          expect(users[0].username).to.equal("Peter")
          expect(users[0].data).to.equal(json)
          expect(users[1].username).to.equal("Paul")
          expect(users[1].data).to.equal(json)
          done()
        })
      })
    })

    it('stores the current date in createdAt', function(done) {
      var self = this
        , data = [{ username: 'Peter'},
                  { username: 'Paul'}]

      this.User.bulkCreate(data).success(function() {
        self.User.findAll({order: 'id'}).success(function(users) {
          expect(users.length).to.equal(2)
          expect(users[0].username).to.equal('Peter')
          expect(parseInt(+users[0].createdAt/5000, 10)).to.be.closeTo(parseInt(+new Date()/5000, 10), 1.5)
          expect(users[1].username).to.equal('Paul')
          expect(parseInt(+users[1].createdAt/5000, 10)).to.be.closeTo(parseInt(+new Date()/5000, 10), 1.5)
          done()
        })
      })
    })

    it('emits an error when validate is set to true', function(done) {
      var Tasks = this.sequelize.define('Task', {
        name: {
          type: Sequelize.STRING,
          validate: {
            notNull: { args: true, msg: 'name cannot be null' }
          }
        },
        code: {
          type: Sequelize.STRING,
          validate: {
            len: [3, 10]
          }
        }
      })

      Tasks.sync({ force: true }).success(function() {
        Tasks.bulkCreate([
          {name: 'foo', code: '123'},
          {code: '1234'},
          {name: 'bar', code: '1'}
        ], { validate: true }).error(function(errors) {
          expect(errors).to.not.be.null
          expect(errors).to.be.instanceof(Array)
          expect(errors).to.have.length(2)
          expect(errors[0].record.code).to.equal('1234')
          expect(errors[0].errors.name[0]).to.equal('name cannot be null')
          expect(errors[1].record.name).to.equal('bar')
          expect(errors[1].record.code).to.equal('1')
          expect(errors[1].errors.code[0]).to.equal('String is not in range: code')
          done()
        })
      })
    })

    it("doesn't emit an error when validate is set to true but our selectedValues are fine", function(done) {
      var Tasks = this.sequelize.define('Task', {
        name: {
          type: Sequelize.STRING,
          validate: {
            notNull: { args: true, msg: 'name cannot be null' }
          }
        },
        code: {
          type: Sequelize.STRING,
          validate: {
            len: [3, 10]
          }
        }
      })

      Tasks.sync({ force: true }).success(function() {
        Tasks.bulkCreate([
          {name: 'foo', code: '123'},
          {code: '1234'}
        ], { fields: ['code'], validate: true }).success(function() {
          // we passed!
          done()
        })
      })
    })

    it('should allow blank arrays (return immediatly)', function (done) {
      var Worker = this.sequelize.define('Worker', {})
      Worker.sync().done(function(err) {
        Worker.bulkCreate([]).done(function (err, workers) {
          expect(err).not.to.be.ok
          expect(workers).to.be.ok
          expect(workers.length).to.equal(0)
          done()
        })
      })
    })

    it('should allow blank creates (with timestamps: false)', function (done) {
      var Worker = this.sequelize.define('Worker', {}, {timestamps: false})
      Worker.sync().done(function(err) {
        Worker.bulkCreate([{}, {}]).done(function (err, workers) {
          expect(err).not.to.be.ok
          expect(workers).to.be.ok
          done()
        })
      })
    })

    it('should allow autoincremented attributes to be set', function (done) {
      var Worker = this.sequelize.define('Worker', {}, {timestamps: false})
      Worker.sync().done(function(err) {
        Worker.bulkCreate([
          {id: 5},
          {id: 10}
        ]).done(function (err) {
          expect(err).not.to.be.ok
          Worker.findAll({order: 'id ASC'}).done(function (err, workers) {
            expect(workers[0].id).to.equal(5)
            expect(workers[1].id).to.equal(10)
            done()
          })
        })
      })
    })

    if (Support.getTestDialect() !== 'postgres') {
      it("should support the ignoreDuplicates option", function(done) {
        var self = this
          , data = [{ uniqueName: 'Peter', secretValue: '42' },
                    { uniqueName: 'Paul', secretValue: '23' }]

        this.User.bulkCreate(data, { fields: ['uniqueName', 'secretValue'] }).success(function() {
          data.push({ uniqueName: 'Michael', secretValue: '26' });
          self.User.bulkCreate(data, { fields: ['uniqueName', 'secretValue'], ignoreDuplicates: true }).success(function() {
            self.User.findAll({order: 'id'}).success(function(users) {
              expect(users.length).to.equal(3)
              expect(users[0].uniqueName).to.equal("Peter")
              expect(users[0].secretValue).to.equal("42");
              expect(users[1].uniqueName).to.equal("Paul")
              expect(users[1].secretValue).to.equal("23");
              expect(users[2].uniqueName).to.equal("Michael")
              expect(users[2].secretValue).to.equal("26");
              done()
            });
          });
        })
      })
    } else {
      it("should throw an error when the ignoreDuplicates option is passed", function(done) {
        var self = this
          , data = [{ uniqueName: 'Peter', secretValue: '42' },
                    { uniqueName: 'Paul', secretValue: '23' }]

        this.User.bulkCreate(data, { fields: ['uniqueName', 'secretValue'] }).success(function() {
          data.push({ uniqueName: 'Michael', secretValue: '26' });

          self.User.bulkCreate(data, { fields: ['uniqueName', 'secretValue'], ignoreDuplicates: true }).error(function(err) {
            expect(err).to.exist
            expect(err.message).to.match(/Postgres does not support the \'ignoreDuplicates\' option./)

            done();
          })
        })
      })
    }

    describe('enums', function() {
      it('correctly restores enum values', function(done) {
        var self = this
          , Item = self.sequelize.define('Item', {
          state: { type: Sequelize.ENUM, values: ['available', 'in_cart', 'shipped'] },
          name: Sequelize.STRING
        })

        Item.sync({ force: true }).success(function() {
          Item.bulkCreate([{state: 'in_cart', name: 'A'}, { state: 'available', name: 'B'}]).success(function() {
            Item.find({ where: { state: 'available' }}).success(function(item) {
              expect(item.name).to.equal('B')
              done()
            })
          })
        })
      })
    })
  })
})
