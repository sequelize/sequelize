/* jshint camelcase: false */
var chai      = require('chai')
  , Sequelize = require('../index')
  , expect    = chai.expect
  , Support   = require(__dirname + '/support')
  , DataTypes = require(__dirname + "/../lib/data-types")
  , dialect   = Support.getTestDialect()
  , config    = require(__dirname + "/config/config")
  , sinon     = require('sinon')
  , datetime  = require('chai-datetime')
  , _         = require('lodash')
  , moment    = require('moment')

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
      aBool:        DataTypes.BOOLEAN
    })
    this.User.sync({ force: true }).success(function() {
      done()
    })
  })

  describe('constructor', function() {
    it("uses the passed dao name as tablename if freezeTableName", function(done) {
      var User = this.sequelize.define('FrozenUser', {}, { freezeTableName: true })
      expect(User.tableName).to.equal('FrozenUser')
      done()
    })

    it("uses the pluralized dao name as tablename unless freezeTableName", function(done) {
      var User = this.sequelize.define('SuperUser', {}, { freezeTableName: false })
      expect(User.tableName).to.equal('SuperUsers')
      done()
    })

    it("uses checks to make sure dao factory isnt leaking on multiple define", function(done) {
      this.sequelize.define('SuperUser', {}, { freezeTableName: false })
      var factorySize = this.sequelize.daoFactoryManager.all.length

      this.sequelize.define('SuperUser', {}, { freezeTableName: false })
      var factorySize2 = this.sequelize.daoFactoryManager.all.length

      expect(factorySize).to.equal(factorySize2)
      done()
    })

    it("attaches class and instance methods", function(done) {
      var User = this.sequelize.define('UserWithClassAndInstanceMethods', {}, {
        classMethods: { doSmth: function(){ return 1 } },
        instanceMethods: { makeItSo: function(){ return 2}}
      })

      expect(User.doSmth).to.exist
      expect(User.doSmth()).to.equal(1)
      expect(User.makeItSo).not.to.exist

      expect(User.build().doSmth).not.to.exist
      expect(User.build().makeItSo).to.exist
      expect(User.build().makeItSo()).to.equal(2)
      done()
    })

    it("throws an error if 2 autoIncrements are passed", function(done) {
      var self = this
      expect(function() {
        self.sequelize.define('UserWithTwoAutoIncrements', {
          userid:    { type: Sequelize.INTEGER, primaryKey: true, autoIncrement: true },
          userscore: { type: Sequelize.INTEGER, primaryKey: true, autoIncrement: true }
        })
      }).to.throw(Error, 'Invalid DAO definition. Only one autoincrement field allowed.')
      done()
    })

    it('throws an error if a custom model-wide validation is not a function', function(done) {
      var self = this
      expect(function() {
        self.sequelize.define('Foo', {
          field: Sequelize.INTEGER
        }, {
          validate: {
            notFunction: 33
          }
        })
      }).to.throw(Error, 'Members of the validate option must be functions. Model: Foo, error with validate member notFunction')
      done()
    })

    it('throws an error if a custom model-wide validation has the same name as a field', function(done) {
      var self = this
      expect(function() {
        self.sequelize.define('Foo', {
          field: Sequelize.INTEGER
        }, {
          validate: {
            field: function() {}
          }
        })
      }).to.throw(Error, 'A model validator function must not have the same name as a field. Model: Foo, field/validation name: field')
      done()
    })

    it('should allow me to override updatedAt, createdAt, and deletedAt fields', function(done) {
      var UserTable = this.sequelize.define('UserCol', {
        aNumber: Sequelize.INTEGER
      }, {
        timestamps: true,
        updatedAt: 'updatedOn',
        createdAt: 'dateCreated',
        deletedAt: 'deletedAtThisTime',
        paranoid: true
      })

      UserTable.sync({force: true}).success(function() {
        UserTable.create({aNumber: 4}).success(function(user) {
          expect(user.updatedOn).to.exist
          expect(user.dateCreated).to.exist
          user.destroy().success(function(user) {
            expect(user.deletedAtThisTime).to.exist
            done()
          })
        })
      })
    })

    it('should allow me to override updatedAt, createdAt, and deletedAt fields with underscored being true', function(done) {
      var UserTable = this.sequelize.define('UserCol', {
        aNumber: Sequelize.INTEGER
      }, {
        timestamps: true,
        updatedAt: 'updatedOn',
        createdAt: 'dateCreated',
        deletedAt: 'deletedAtThisTime',
        paranoid: true,
        underscored: true
      })

      UserTable.sync({force: true}).success(function() {
        UserTable.create({aNumber: 4}).success(function(user) {
          expect(user.updated_on).to.exist
          expect(user.date_created).to.exist
          user.destroy().success(function(user) {
            expect(user.deleted_at_this_time).to.exist
            done()
          })
        })
      })
    })
  })

  describe('build', function() {
    it("doesn't create database entries", function(done) {
      this.User.build({ username: 'John Wayne' })
      this.User.all().success(function(users) {
        expect(users).to.have.length(0)
        done()
      })
    })

    it("fills the objects with default values", function(done) {
      var Task = this.sequelize.define('TaskBuild', {
        title:  {type: Sequelize.STRING, defaultValue: 'a task!'},
        foo:    {type: Sequelize.INTEGER, defaultValue: 2},
        bar:    {type: Sequelize.DATE},
        foobar: {type: Sequelize.TEXT, defaultValue: 'asd'},
        flag:   {type: Sequelize.BOOLEAN, defaultValue: false}
      })
      expect(Task.build().title).to.equal('a task!')
      expect(Task.build().foo).to.equal(2)
      expect(Task.build().bar).to.not.be.ok
      expect(Task.build().foobar).to.equal('asd')
      expect(Task.build().flag).to.be.false
      done()
    })

    it("fills the objects with default values", function(done) {
      var Task = this.sequelize.define('TaskBuild', {
        title:  {type: Sequelize.STRING, defaultValue: 'a task!'},
        foo:    {type: Sequelize.INTEGER, defaultValue: 2},
        bar:    {type: Sequelize.DATE},
        foobar: {type: Sequelize.TEXT, defaultValue: 'asd'},
        flag:   {type: Sequelize.BOOLEAN, defaultValue: false}
      }, { timestamps: false })
      expect(Task.build().title).to.equal('a task!')
      expect(Task.build().foo).to.equal(2)
      expect(Task.build().bar).to.not.be.ok
      expect(Task.build().foobar).to.equal('asd')
      expect(Task.build().flag).to.be.false
      done()
    })

    it("stores the the passed values in a special variable", function(done) {
      var user = this.User.build({ username: 'John Wayne' })
      expect(user.selectedValues).to.deep.equal({ username: 'John Wayne' })
      done()
    })

    it("attaches getter and setter methods from attribute definition", function(done) {
      var Product = this.sequelize.define('ProductWithSettersAndGetters1', {
        price: {
          type: Sequelize.INTEGER,
          get : function() {
            return 'answer = ' + this.getDataValue('price')
          },
          set : function(v) {
            return this.setDataValue('price', v + 42)
          }
        }
      })

      expect(Product.build({price: 42}).price).to.equal('answer = 84')

      var p = Product.build({price: 1})
      expect(p.price).to.equal('answer = 43');

      p.price = 0
      expect(p.price).to.equal('answer = 42')
      done()
    })

    it("attaches getter and setter methods from options", function(done) {
      var Product = this.sequelize.define('ProductWithSettersAndGetters2', {
        priceInCents: Sequelize.INTEGER
      },{
        setterMethods: {
          price: function(value) {
            this.dataValues.priceInCents = value * 100
          }
        },
        getterMethods: {
          price: function() {
            return '$' + (this.getDataValue('priceInCents') / 100)
          },

          priceInCents: function() {
            return this.dataValues.priceInCents
          }
        }
      });

      expect(Product.build({price: 20}).priceInCents).to.equal(20 * 100)
      expect(Product.build({priceInCents: 30 * 100}).price).to.equal('$' + 30)
      done()
    })

    it("attaches getter and setter methods from options only if not defined in attribute", function(done) {
      var Product = this.sequelize.define('ProductWithSettersAndGetters3', {
        price1: {
          type: Sequelize.INTEGER,
          set : function(v) { this.setDataValue('price1', v * 10) }
        },
        price2: {
          type: Sequelize.INTEGER,
          get : function() { return this.getDataValue('price2') * 10 }
        }
      },{
        setterMethods: {
          price1: function(v) { this.setDataValue('price1', v * 100) }
        },
        getterMethods: {
          price2: function() { return '$' + this.getDataValue('price2') }
        }
      });

      var p = Product.build({ price1: 1, price2: 2 })

      expect(p.price1).to.equal(10)
      expect(p.price2).to.equal(20)
      done()
    })
  })

  describe('findOrCreate', function () {
    it("Returns instace if already existent. Single find field.", function(done) {
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

    it("Returns instace if already existent. Multiple find fields.", function(done) {
      var self = this,
        data = {
          username: 'Username',
          data: 'ThisIsData'
        };

      this.User.create(data).success(function (user) {
        self.User.findOrCreate(data).success(function (_user, created) {
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
  })

  describe('create', function() {
    it("casts empty arrays correctly for postgresql", function(done) {
      if (dialect !== "postgres" && dialect !== "postgresql-native") {
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
            else if (dialect === "mysql") {
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

          if (dialect === "mysql") {
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
              else if (dialect === "mysql") {
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

      this.User.create(data, ['username']).success(function(user) {
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

    it('can omitt autoincremental columns', function(done) {
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
    })
  })

  describe('bulkCreate', function() {
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

      this.User.bulkCreate(data, ['username']).success(function() {
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
        ], null, {validate: true}).error(function(errors) {
          expect(errors).to.not.be.null
          expect(errors).to.be.instanceof(Array)
          expect(errors).to.have.length(2)
          expect(errors[0].record.code).to.equal('1234')
          expect(errors[0].errors.name[0]).to.equal('name cannot be null')
          expect(errors[1].record.name).to.equal('bar')
          expect(errors[1].record.code).to.equal('1')
          expect(errors[1].errors.code[0]).to.match(/String is not in range/)
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
        ], ['code'], {validate: true}).success(function() {
          // we passed!
          done()
        })
      })
    })

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

  describe('update', function() {
    it('updates the attributes that we select only without updating createdAt', function(done) {
      var User = this.sequelize.define('User1', {
        username: Sequelize.STRING,
        secretValue: Sequelize.STRING
      }, {
          paranoid:true
        })

      User.sync({ force: true }).success(function() {
        User.create({username: 'Peter', secretValue: '42'}).success(function(user) {
          user.updateAttributes({ secretValue: '43' }, ['secretValue']).on('sql', function(sql) {
            expect(sql).to.match(/UPDATE\s+[`"]+User1s[`"]+\s+SET\s+[`"]+secretValue[`"]='43',[`"]+updatedAt[`"]+='[^`",]+'\s+WHERE [`"]+id[`"]+=1/)
            done()
          })
        })
      })
    })

    it('allows sql logging of updated statements', function(done) {
      var User = this.sequelize.define('User', {
        name: Sequelize.STRING,
        bio: Sequelize.TEXT
      }, {
          paranoid:true
        })

      User.sync({ force: true }).success(function() {
        User.create({ name: 'meg', bio: 'none' }).success(function(u) {
          expect(u).to.exist
          expect(u).not.to.be.null
          u.updateAttributes({name: 'brian'}).on('sql', function(sql) {
            expect(sql).to.exist
            expect(sql.toUpperCase().indexOf("UPDATE")).to.be.above(-1)
            done()
          })
        })
      })
    })

    it('updates only values that match filter', function(done) {
      var self = this
        , data = [{ username: 'Peter', secretValue: '42' },
                  { username: 'Paul',  secretValue: '42' },
                  { username: 'Bob',   secretValue: '43' }]

      this.User.bulkCreate(data).success(function() {

        self.User.update({username: 'Bill'}, {secretValue: '42'})
          .success(function() {
            self.User.findAll({order: 'id'}).success(function(users) {
              expect(users.length).to.equal(3)

              users.forEach(function (user) {
                if (user.secretValue == '42') {
                  expect(user.username).to.equal("Bill")
                } else {
                  expect(user.username).to.equal("Bob")
                }
              })

              done()
            })
          })
      })
    })

    it('sets updatedAt to the current timestamp', function(done) {
      var self = this
        , data = [{ username: 'Peter', secretValue: '42' },
                  { username: 'Paul',  secretValue: '42' },
                  { username: 'Bob',   secretValue: '43' }]

      this.User.bulkCreate(data).success(function() {
        self.User.update({username: 'Bill'}, {secretValue: '42'}).success(function() {
          self.User.findAll({order: 'id'}).success(function(users) {
            expect(users.length).to.equal(3)

            expect(users[0].username).to.equal("Bill")
            expect(users[1].username).to.equal("Bill")
            expect(users[2].username).to.equal("Bob")

            expect(parseInt(+users[0].updatedAt/5000, 10)).to.be.closeTo(parseInt(+new Date()/5000, 10), 1)
            expect(parseInt(+users[1].updatedAt/5000, 10)).to.be.closeTo(parseInt(+new Date()/5000, 10), 1)

            done()
          })
        })
      })
    })
  })

  describe('destroy', function() {
    it('deletes a record from the database if dao is not paranoid', function(done) {
      var UserDestroy = this.sequelize.define('UserDestory', {
          name: Sequelize.STRING,
          bio: Sequelize.TEXT
        })

      UserDestroy.sync({ force: true }).success(function() {
        UserDestroy.create({name: 'hallo', bio: 'welt'}).success(function(u) {
          UserDestroy.all().success(function(users) {
            expect(users.length).to.equal(1)
            u.destroy().success(function() {
              UserDestroy.all().success(function(users) {
                expect(users.length).to.equal(0)
                done()
              })
            })
          })
        })
      })
    })

    it('allows sql logging of delete statements', function(done) {
      var UserDelete = this.sequelize.define('UserDelete', {
          name: Sequelize.STRING,
          bio: Sequelize.TEXT
        })

      UserDelete.sync({ force: true }).success(function() {
        UserDelete.create({name: 'hallo', bio: 'welt'}).success(function(u) {
          UserDelete.all().success(function(users) {
            expect(users.length).to.equal(1)
            u.destroy().on('sql', function(sql) {
              expect(sql).to.exist
              expect(sql.toUpperCase().indexOf("DELETE")).to.be.above(-1)
              done()
            })
          })
        })
      })
    })

    it('deletes values that match filter', function(done) {
      var self = this
        , data = [{ username: 'Peter', secretValue: '42' },
                  { username: 'Paul',  secretValue: '42' },
                  { username: 'Bob',   secretValue: '43' }]

      this.User.bulkCreate(data).success(function() {
        self.User.destroy({secretValue: '42'})
          .success(function() {
            self.User.findAll({order: 'id'}).success(function(users) {
              expect(users.length).to.equal(1)
              expect(users[0].username).to.equal("Bob")
              done()
            })
          })
      })
    })

    it('sets deletedAt to the current timestamp if paranoid is true', function(done) {
      var self = this
        , ParanoidUser = self.sequelize.define('ParanoidUser', {
          username:     Sequelize.STRING,
          secretValue:  Sequelize.STRING,
          data:         Sequelize.STRING,
          intVal:       { type: Sequelize.INTEGER, defaultValue: 1}
        }, {
            paranoid: true
          })
        , data = [{ username: 'Peter', secretValue: '42' },
                  { username: 'Paul',  secretValue: '42' },
                  { username: 'Bob',   secretValue: '43' }]

      ParanoidUser.sync({ force: true }).success(function() {
        ParanoidUser.bulkCreate(data).success(function() {
          var date = parseInt(+new Date()/5000, 10)
          ParanoidUser.destroy({secretValue: '42'}).success(function() {
            ParanoidUser.findAll({order: 'id'}).success(function(users) {
              expect(users.length).to.equal(3)

              expect(users[0].username).to.equal("Peter")
              expect(users[1].username).to.equal("Paul")
              expect(users[2].username).to.equal("Bob")

              expect(parseInt(+users[0].deletedAt/5000, 10)).to.equal(date)
              expect(parseInt(+users[1].deletedAt/5000, 10)).to.equal(date)

              done()
            })
          })
        })
      })
    })
  })

  describe('special where conditions/smartWhere object', function() {
    beforeEach(function(done) {
      var self = this

      this.User.bulkCreate([
        {username: 'boo', intVal: 5, theDate: '2013-01-01 12:00'},
        {username: 'boo2', intVal: 10, theDate: '2013-01-10 12:00'}
      ]).success(function(user2) {
        done()
      })
    })

    it('should be able to find a row using like', function(done) {
      this.User.findAll({
        where: {
          username: {
            like: '%2'
          }
        }
      }).success(function(users) {
        expect(users).to.be.an.instanceof(Array)
        expect(users).to.have.length(1)
        expect(users[0].username).to.equal('boo2')
        expect(users[0].intVal).to.equal(10)
        done()
      })
    })

    it('should be able to find a row using not like', function(done) {
      this.User.findAll({
        where: {
          username: {
            nlike: '%2'
          }
        }
      }).success(function(users) {
        expect(users).to.be.an.instanceof(Array)
        expect(users).to.have.length(1)
        expect(users[0].username).to.equal('boo')
        expect(users[0].intVal).to.equal(5)
        done()
      })
    })

    it('should be able to find a row between a certain date using the between shortcut', function(done) {
      this.User.findAll({
        where: {
          theDate: {
            '..': ['2013-01-02', '2013-01-11']
          }
        }
      }).success(function(users) {
        expect(users[0].username).to.equal('boo2')
        expect(users[0].intVal).to.equal(10)
        done()
      })
    })

    it('should be able to find a row not between a certain integer using the not between shortcut', function(done) {
      this.User.findAll({
        where: {
          intVal: {
            '!..': [8, 10]
          }
        }
      }).success(function(users) {
        expect(users[0].username).to.equal('boo')
        expect(users[0].intVal).to.equal(5)
        done()
      })
    })

    it('should be able to handle false/true values just fine...', function(done) {
      var User = this.User
        , escapeChar = (dialect === "postgres" || dialect === "postgres-native") ? '"' : '`'

      User.bulkCreate([
        {username: 'boo5', aBool: false},
        {username: 'boo6', aBool: true}
      ]).success(function() {
        User.all({where: [escapeChar + 'aBool' + escapeChar + ' = ?', false]}).success(function(users) {
          expect(users).to.have.length(1)
          expect(users[0].username).to.equal('boo5')

          User.all({where: [escapeChar + 'aBool' + escapeChar + ' = ?', true]}).success(function(_users) {
            expect(_users).to.have.length(1)
            expect(_users[0].username).to.equal('boo6')
            done()
          })
        })
      })
    })

    it('should be able to handle false/true values through associations as well...', function(done) {
      var User = this.User
        , escapeChar = (dialect === "postgres" || dialect === "postgres-native") ? '"' : '`'
      var Passports = this.sequelize.define('Passports', {
        isActive: Sequelize.BOOLEAN
      })

      User.hasMany(Passports)
      Passports.belongsTo(User)

      User.sync({ force: true }).success(function() {
        Passports.sync({ force: true }).success(function() {
          User.bulkCreate([
            {username: 'boo5', aBool: false},
            {username: 'boo6', aBool: true}
          ]).success(function() {
            Passports.bulkCreate([
              {isActive: true},
              {isActive: false}
            ]).success(function() {
              User.find(1).success(function(user) {
                Passports.find(1).success(function(passport) {
                  user.setPassports([passport]).success(function() {
                    User.find(2).success(function(_user) {
                      Passports.find(2).success(function(_passport) {
                        _user.setPassports([_passport]).success(function() {
                          _user.getPassports({where: [escapeChar + 'isActive' + escapeChar + ' = ?', false]}).success(function(theFalsePassport) {
                            user.getPassports({where: [escapeChar + 'isActive' + escapeChar + ' = ?', true]}).success(function(theTruePassport) {
                              expect(theFalsePassport).to.have.length(1)
                              expect(theFalsePassport[0].isActive).to.be.false
                              expect(theTruePassport).to.have.length(1)
                              expect(theTruePassport[0].isActive).to.be.true
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
          })
        })
      })
    })

    it('should be able to retun a record with primaryKey being null for new inserts', function(done) {
      var Session = this.sequelize.define('Session', {
          token: { type: DataTypes.TEXT, allowNull: false },
          lastUpdate: { type: DataTypes.DATE, allowNull: false }
        }, {
            charset: 'utf8',
            collate: 'utf8_general_ci',
            omitNull: true
          })

        , User = this.sequelize.define('User', {
            name: { type: DataTypes.STRING, allowNull: false, unique: true },
            password: { type: DataTypes.STRING, allowNull: false },
            isAdmin: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: false }
          }, {
            charset: 'utf8',
            collate: 'utf8_general_ci'
          })

      User.hasMany(Session, { as: 'Sessions' })
      Session.belongsTo(User)

      Session.sync({ force: true }).success(function() {
        User.sync({ force: true }).success(function() {
          User.create({name: 'Name1', password: '123', isAdmin: false}).success(function(user) {
            var sess = Session.build({
              lastUpdate: new Date(),
              token: '123'
            })

            user.addSession(sess).success(function(u) {
              expect(u.token).to.equal('123')
              done()
            })
          })
        })
      })
    })

    it('should be able to find a row between a certain date', function(done) {
      this.User.findAll({
        where: {
          theDate: {
            between: ['2013-01-02', '2013-01-11']
          }
        }
      }).success(function(users) {
        expect(users[0].username).to.equal('boo2')
        expect(users[0].intVal).to.equal(10)
        done()
      })
    })

    it('should be able to find a row between a certain date and an additional where clause', function(done) {
      this.User.findAll({
        where: {
          theDate: {
            between: ['2013-01-02', '2013-01-11']
          },
          intVal: 10
        }
      }).success(function(users) {
        expect(users[0].username).to.equal('boo2')
        expect(users[0].intVal).to.equal(10)
        done()
      })
    })

    it('should be able to find a row not between a certain integer', function(done) {
      this.User.findAll({
        where: {
          intVal: {
            nbetween: [8, 10]
          }
        }
      }).success(function(users) {
        expect(users[0].username).to.equal('boo')
        expect(users[0].intVal).to.equal(5)
        done()
      })
    })

    it('should be able to find a row using not between and between logic', function(done) {
      this.User.findAll({
        where: {
          theDate: {
            between: ['2012-12-10', '2013-01-02'],
            nbetween: ['2013-01-04', '2013-01-20']
          }
        }
      }).success(function(users) {
        expect(users[0].username).to.equal('boo')
        expect(users[0].intVal).to.equal(5)
        done()
      })
    })

    it('should be able to find a row using not between and between logic with dates', function(done) {
      this.User.findAll({
        where: {
          theDate: {
            between: [new Date('2012-12-10'), new Date('2013-01-02')],
            nbetween: [new Date('2013-01-04'), new Date('2013-01-20')]
          }
        }
      }).success(function(users) {
        expect(users[0].username).to.equal('boo')
        expect(users[0].intVal).to.equal(5)
        done()
      })
    })

    it('should be able to find a row using greater than or equal to logic with dates', function(done) {
      this.User.findAll({
        where: {
          theDate: {
            gte: new Date('2013-01-09')
          }
        }
      }).success(function(users) {
        expect(users[0].username).to.equal('boo2')
        expect(users[0].intVal).to.equal(10)
        done()
      })
    })

    it('should be able to find a row using greater than or equal to', function(done) {
      this.User.find({
        where: {
          intVal: {
            gte: 6
          }
        }
      }).success(function(user) {
        expect(user.username).to.equal('boo2')
        expect(user.intVal).to.equal(10)
        done()
      })
    })

    it('should be able to find a row using greater than', function(done) {
      this.User.find({
        where: {
          intVal: {
            gt: 5
          }
        }
      }).success(function(user) {
        expect(user.username).to.equal('boo2')
        expect(user.intVal).to.equal(10)
        done()
      })
    })

    it('should be able to find a row using lesser than or equal to', function(done) {
      this.User.find({
        where: {
          intVal: {
            lte: 5
          }
        }
      }).success(function(user) {
        expect(user.username).to.equal('boo')
        expect(user.intVal).to.equal(5)
        done()
      })
    })

    it('should be able to find a row using lesser than', function(done) {
      this.User.find({
        where: {
          intVal: {
            lt: 6
          }
        }
      }).success(function(user) {
        expect(user.username).to.equal('boo')
        expect(user.intVal).to.equal(5)
        done()
      })
    })

    it('should have no problem finding a row using lesser and greater than', function(done) {
      this.User.findAll({
        where: {
          intVal: {
            lt: 6,
            gt: 4
          }
        }
      }).success(function(users) {
        expect(users[0].username).to.equal('boo')
        expect(users[0].intVal).to.equal(5)
        done()
      })
    })

    it('should be able to find a row using not equal to logic', function(done) {
      this.User.find({
        where: {
          intVal: {
            ne: 10
          }
        }
      }).success(function(user) {
        expect(user.username).to.equal('boo')
        expect(user.intVal).to.equal(5)
        done()
      })
    })

    it('should be able to find multiple users with any of the special where logic properties', function(done) {
      this.User.findAll({
        where: {
          intVal: {
            lte: 10
          }
        }
      }).success(function(users) {
        expect(users[0].username).to.equal('boo')
        expect(users[0].intVal).to.equal(5)
        expect(users[1].username).to.equal('boo2')
        expect(users[1].intVal).to.equal(10)
        done()
      })
    })
  })

  describe('find', function() {
    describe('general / basic function', function() {
      beforeEach(function(done) {
        var self = this
        this.User.create({username: 'barfooz'}).success(function(user) {
          self.UserPrimary = self.sequelize.define('UserPrimary', {
            specialKey: {
              type: DataTypes.STRING,
              primaryKey: true
            }
          })

          self.UserPrimary.sync({force: true}).success(function() {
            self.UserPrimary.create({specialKey: 'a string'}).success(function() {
              self.user = user
              done()
            })
          })
        })
      })

      it('doesn\'t throw an error when entering in a non integer value for a specified primary field', function(done) {
        this.UserPrimary.find('a string').success(function(user) {
          expect(user.specialKey).to.equal('a string')
          done()
        })
      })

      it('doesn\'t throw an error when entering in a non integer value', function(done) {
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

      it("should make aliased attributes available", function(done) {
        this.User.find({
          where: { id: 1 },
          attributes: ['id', ['username', 'name']]
        }).success(function(user) {
          expect(user.name).to.equal('barfooz')
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
          expect(user.hasOwnProperty('username')).to.be.ok
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
          }).success(function(u) {
            UserPrimary.find('a string based id').success(function(u2) {
              expect(u2.id).to.equal('a string based id')
              expect(u2.name).to.equal('Johnno')
              done()
            })
          })
        })
      })


      it('returns the selected fields as instance.selectedValues', function(done) {
        var self = this
        this.User.create({
          username: 'JohnXOXOXO'
        }).success(function() {
          self.User.find({
            where: { username: 'JohnXOXOXO' },
            attributes: ['username']
          }).success(function(user) {
            expect(user.selectedValues).to.have.property('username', 'JohnXOXOXO')
            done()
          })
        })
      })

      it('returns the selected fields and all fields of the included table as instance.selectedValues', function(done) {
        var self = this
        self.Mission = self.sequelize.define('Mission', {
          title:  {type: Sequelize.STRING, defaultValue: 'a mission!!'},
          foo:    {type: Sequelize.INTEGER, defaultValue: 2},
        })

        self.Mission.belongsTo(self.User)
        self.User.hasMany(self.Mission)

        self.Mission.sync({ force: true }).success(function() {
          self.Mission.create().success(function(mission) {
            self.User.create({username: 'John DOE'}).success(function(user) {
              mission.setUser(user).success(function() {
                self.User.find({
                  where: { username: 'John DOE' },
                  attributes: ['username'],
                  include: [self.Mission]
                }).success(function(user) {
                  expect(user.selectedValues).to.deep.equal({ username: 'John DOE' })
                  done()
                })
              })
            })
          })
        })
      })

      it('returns the selected fields for both the base table and the included table as instance.selectedValues', function(done) {
        var self = this
        self.Mission = self.sequelize.define('Mission', {
          title:  {type: Sequelize.STRING, defaultValue: 'another mission!!'},
          foo:    {type: Sequelize.INTEGER, defaultValue: 4},
        })

        self.Mission.belongsTo(self.User)
        self.User.hasMany(self.Mission)

        self.Mission.sync({ force: true }).success(function() {
          self.Mission.create().success(function(mission) {
            self.User.create({username: 'Brain Picker'}).success(function(user) {
              mission.setUser(user).success(function() {
                self.User.find({
                  where: { username: 'Brain Picker' },
                  attributes: ['username'],
                  include: [{model: self.Mission, as: self.Mission.tableName, attributes: ['title']}]
                }).success(function(user) {
                  expect(user.selectedValues).to.deep.equal({ username: 'Brain Picker' })
                  expect(user.missions[0].selectedValues).to.deep.equal({ id: 1, title: 'another mission!!'})
                  expect(user.missions[0].foo).not.to.exist
                  done()
                })
              })
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
          self.Task.sync({ force: true }).success(function() {
            self.Worker.sync({ force: true }).success(function() {
              self.Worker.create({ name: 'worker' }).success(function(worker) {
                self.Task.create({ title: 'homework' }).success(function(task) {
                  self.worker    = worker
                  self.task      = task
                  callback()
                })
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
            expect(function() {
              self.Worker.find({ include: [ 1 ] })
            }).to.throw(Error, 'Include unexpected. Element has to be either an instance of DAOFactory or an object.')
            done()
          })

          it('throws an error about missing attributes if include contains an object with daoFactory', function(done) {
            var self = this
            expect(function() {
              self.Worker.find({ include: [ { daoFactory: self.Worker } ] })
            }).to.throw(Error, 'Include malformed. Expected attributes: daoFactory, as!')
            done()
          })

          it('throws an error if included DaoFactory is not associated', function(done) {
            var self = this
            expect(function() {
              self.Worker.find({ include: [ self.Task ] })
            }).to.throw(Error, 'Task is not associated to Worker!')
            done()
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
                  expect(task.worker).to.exist
                  expect(task.worker.name).to.equal('worker')
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
          self.Environment
            .belongsTo(self.Domain, { as: 'PrivateDomain', foreignKey: 'privateDomainId' })
            .belongsTo(self.Domain, { as: 'PublicDomain', foreignKey: 'publicDomainId' })

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
                          expect(environment.privateDomain).to.exist
                          expect(environment.privateDomain.ip).to.equal('192.168.0.1')
                          expect(environment.publicDomain).to.exist
                          expect(environment.publicDomain.ip).to.equal('91.65.189.19')
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
            self.User.create({ username: 'someone', GroupPKeagerbelongId: 'people' }).success(function() {
              self.Group.create({ name: 'people' }).success(function() {
                self.User.find({
                   where: {
                    username: 'someone'
                  },
                   include: [self.Group]
                 }).complete(function (err, someUser) {
                   expect(err).to.be.null
                   expect(someUser).to.exist
                   expect(someUser.username).to.equal('someone')
                   expect(someUser.groupPKeagerbelong.name).to.equal('people')
                   done()
                 })
              })
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
          expect(function() {
            self.Task.find({ include: [ self.Worker ] })
          }).to.throw(Error, 'Worker is not associated to Task!')
          done()
        })

        it('returns the associated task via worker.task', function(done) {
          this.Worker.find({
            where:   { name: 'worker' },
            include: [ this.Task ]
          }).complete(function(err, worker) {
            expect(err).to.be.null
            expect(worker).to.exist
            expect(worker.task).to.exist
            expect(worker.task.title).to.equal('homework')
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
            self.User.create({ username: 'someone', GroupPKeageroneId: 'people' }).success(function() {
              self.Group.create({ name: 'people' }).success(function() {
                self.Group.find({
                   where: {
                    name: 'people'
                  },
                   include: [self.User]
                 }).complete(function (err, someGroup) {
                   expect(err).to.be.null
                   expect(someGroup).to.exist
                   expect(someGroup.name).to.equal('people')
                   expect(someGroup.userPKeagerone.username).to.equal('someone')
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
          expect(function() {
            self.Worker.find({ include: [ self.Task ] })
          }).to.throw(Error, 'Task is not associated to Worker!')
          done()
        })

        describe('alias', function(done) {
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
            expect(function() {
              self.Worker.find({ include: [ { daoFactory: self.Task, as: 'Work' } ] })
            }).to.throw(Error, 'Task (Work) is not associated to Worker!')
            done()
          })

          it('returns the associated task via worker.task', function(done) {
            this.Worker.find({
              where:   { name: 'worker' },
              include: [ { daoFactory: this.Task, as: 'ToDo' } ]
            }).complete(function(err, worker) {
              expect(err).to.be.null
              expect(worker).to.exist
              expect(worker.toDo).to.exist
              expect(worker.toDo.title).to.equal('homework')
              done()
            })
          })

          it('returns the associated task via worker.task when daoFactory is aliased with model', function(done) {
            this.Worker.find({
              where:   { name: 'worker' },
              include: [ { model: this.Task, as: 'ToDo' } ]
            }).complete(function(err, worker) {
              expect(worker.toDo.title).to.equal('homework')
              done()
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
          expect(function() {
            self.Task.find({ include: [ self.Worker ] })
          }).to.throw(Error, 'Worker is not associated to Task!')
          done()
        })

        it('returns the associated tasks via worker.tasks', function(done) {
          this.Worker.find({
            where:   { name: 'worker' },
            include: [ this.Task ]
          }).complete(function(err, worker) {
            expect(err).to.be.null
            expect(worker).to.exist
            expect(worker.tasks).to.exist
            expect(worker.tasks[0].title).to.equal('homework')
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
          self.Group.hasMany(self.User)
          self.User.hasMany(self.Group)

          self.sequelize.sync({ force: true }).success(function() {
            self.User.create({ username: 'someone' }).success(function(someUser) {
              self.Group.create({ name: 'people' }).success(function(someGroup) {
                someUser.setGroupPKeagerones([someGroup]).complete(function (err, data) {
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
                    expect(someUser.groupPKeagerones[0].name).to.equal('people')
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
          expect(function() {
            self.Worker.find({ include: [ self.Task ] })
          }).to.throw(Error, 'Task is not associated to Worker!')
          done()
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
            expect(function() {
              self.Worker.find({ include: [ { daoFactory: self.Task, as: 'Work' } ] })
            }).to.throw(Error, 'Task (Work) is not associated to Worker!')
            done()
          })

          it('returns the associated task via worker.task', function(done) {
            this.Worker.find({
              where:   { name: 'worker' },
              include: [ { daoFactory: this.Task, as: 'ToDos' } ]
            }).complete(function(err, worker) {
              expect(err).to.be.null
              expect(worker).to.exist
              expect(worker.toDos).to.exist
              expect(worker.toDos[0].title).to.equal('homework')
              done()
            })
          })

          it('returns the associated task via worker.task when daoFactory is aliased with model', function(done) {
            this.Worker.find({
              where:   { name: 'worker' },
              include: [ { model: this.Task, as: 'ToDos' } ]
            }).complete(function(err, worker) {
              expect(worker.toDos[0].title).to.equal('homework')
              done()
            })
          })
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

  describe('findAll', function() {
    describe('eager loading', function() {
      describe('belongsTo', function() {
        beforeEach(function(done) {
          var self = this
          self.Task     = self.sequelize.define('TaskBelongsTo', { title: Sequelize.STRING })
          self.Worker   = self.sequelize.define('Worker', { name: Sequelize.STRING })
          self.Task.belongsTo(self.Worker)

          self.Worker.sync({ force: true }).success(function() {
            self.Task.sync({ force: true }).success(function() {
              self.Worker.create({ name: 'worker' }).success(function(worker) {
                self.Task.create({ title: 'homework' }).success(function(task) {
                  self.worker  = worker
                  self.task    = task

                  self.task.setWorker(self.worker).success(function() {
                    done()
                  })
                })
              })
            })
          })
        })

        it('throws an error about unexpected input if include contains a non-object', function(done) {
          var self = this
          expect(function() {
            self.Worker.all({ include: [ 1 ] })
          }).to.throw(Error, 'Include unexpected. Element has to be either an instance of DAOFactory or an object.')
          done()
        })

        it('throws an error about missing attributes if include contains an object with daoFactory', function(done) {
          var self = this
          expect(function() {
            self.Worker.all({ include: [ { daoFactory: self.Worker } ] })
          }).to.throw(Error, 'Include malformed. Expected attributes: daoFactory, as!')
          done()
        })

        it('throws an error if included DaoFactory is not associated', function(done) {
          var self = this
          expect(function() {
            self.Worker.all({ include: [ self.Task ] })
          }).to.throw(Error, 'TaskBelongsTo is not associated to Worker!')
          done()
        })

        it('returns the associated worker via task.worker', function(done) {
          this.Task.all({
            where:   { title: 'homework' },
            include: [ this.Worker ]
          }).complete(function(err, tasks) {
            expect(err).to.be.null
            expect(tasks).to.exist
            expect(tasks[0].worker).to.exist
            expect(tasks[0].worker.name).to.equal('worker')
            done()
          })
        })
      })

      describe('hasOne', function() {
        beforeEach(function(done) {
          var self = this
          self.Task     = self.sequelize.define('TaskHasOne', { title: Sequelize.STRING })
          self.Worker   = self.sequelize.define('Worker', { name: Sequelize.STRING })
          self.Worker.hasOne(self.Task)
          self.Worker.sync({ force: true }).success(function() {
            self.Task.sync({ force: true }).success(function() {
              self.Worker.create({ name: 'worker' }).success(function(worker) {
                self.Task.create({ title: 'homework' }).success(function(task) {
                  self.worker  = worker
                  self.task    = task

                  self.worker.setTaskHasOne(self.task).success(function() {
                    done()
                  })
                })
              })
            })
          })
        })

        it('throws an error if included DaoFactory is not associated', function(done) {
          var self = this
          expect(function() {
            self.Task.all({ include: [ self.Worker ] })
          }).to.throw(Error, 'Worker is not associated to TaskHasOne!')
          done()
        })

        it('returns the associated task via worker.task', function(done) {
          this.Worker.all({
            where:   { name: 'worker' },
            include: [ this.Task ]
          }).complete(function(err, workers) {
            expect(err).to.be.null
            expect(workers).to.exist
            expect(workers[0].taskHasOne).to.exist
            expect(workers[0].taskHasOne.title).to.equal('homework')
            done()
          })
        })
      })

      describe('hasOne with alias', function() {
        beforeEach(function(done) {
          var self = this
          self.Task     = self.sequelize.define('Task', { title: Sequelize.STRING })
          self.Worker   = self.sequelize.define('Worker', { name: Sequelize.STRING })
          self.Worker.hasOne(self.Task, { as: 'ToDo' })

          self.Worker.sync({ force: true }).success(function() {
            self.Task.sync({ force: true }).success(function() {
              self.Worker.create({ name: 'worker' }).success(function(worker) {
                self.Task.create({ title: 'homework' }).success(function(task) {
                  self.worker  = worker
                  self.task    = task

                  self.worker.setToDo(self.task).success(function() {
                    done()
                  })
                })
              })
            })
          })
        })

        it('throws an error if included DaoFactory is not referenced by alias', function(done) {
          var self = this
          expect(function() {
            self.Worker.all({ include: [ self.Task ] })
          }).to.throw(Error, 'Task is not associated to Worker!')
          done()
        })

        it('throws an error if alias is not associated', function(done) {
          var self = this
          expect(function() {
            self.Worker.all({ include: [ { daoFactory: self.Task, as: 'Work' } ] })
          }).to.throw(Error, 'Task (Work) is not associated to Worker!')
          done()
        })

        it('returns the associated task via worker.task', function(done) {
          this.Worker.all({
            where:   { name: 'worker' },
            include: [ { daoFactory: this.Task, as: 'ToDo' } ]
          }).complete(function(err, workers) {
            expect(err).to.be.null
            expect(workers).to.exist
            expect(workers[0].toDo).to.exist
            expect(workers[0].toDo.title).to.equal('homework')
            done()
          })
        })

        it('returns the associated task via worker.task when daoFactory is aliased with model', function(done) {
          this.Worker.all({
            where:   { name: 'worker' },
            include: [ { model: this.Task, as: 'ToDo' } ]
          }).complete(function(err, workers) {
            expect(workers[0].toDo.title).to.equal('homework')
            done()
          })
        })
      })

      describe('hasMany', function() {
        beforeEach(function(done) {
          var self = this
          self.Task     = self.sequelize.define('Task', { title: Sequelize.STRING })
          self.Worker   = self.sequelize.define('Worker', { name: Sequelize.STRING })
          self.Worker.hasMany(self.Task)

          self.Worker.sync({ force: true }).success(function() {
            self.Task.sync({ force: true }).success(function() {
              self.Worker.create({ name: 'worker' }).success(function(worker) {
                self.Task.create({ title: 'homework' }).success(function(task) {
                  self.worker  = worker
                  self.task    = task

                  self.worker.setTasks([ self.task ]).success(function() {
                    done()
                  })
                })
              })
            })
          })
        })

        it('throws an error if included DaoFactory is not associated', function(done) {
          var self = this
          expect(function() {
            self.Task.findAll({ include: [ self.Worker ] })
          }).to.throw(Error, 'Worker is not associated to Task!')
          done()
        })

        it('returns the associated tasks via worker.tasks', function(done) {
          this.Worker.findAll({
            where:   { name: 'worker' },
            include: [ this.Task ]
          }).complete(function(err, workers) {
            expect(err).to.be.null
            expect(workers).to.exist
            expect(workers[0].tasks).to.exist
            expect(workers[0].tasks[0].title).to.equal('homework')
            done()
          })
        })
      })

      describe('hasMany with alias', function() {
        beforeEach(function(done) {
          var self = this
          self.Task     = self.sequelize.define('Task', { title: Sequelize.STRING })
          self.Worker   = self.sequelize.define('Worker', { name: Sequelize.STRING })
          self.Worker.hasMany(self.Task, { as: 'ToDos' })

          self.Worker.sync({ force: true }).success(function() {
            self.Task.sync({ force: true }).success(function() {
              self.Worker.create({ name: 'worker' }).success(function(worker) {
                self.Task.create({ title: 'homework' }).success(function(task) {
                  self.worker  = worker
                  self.task    = task

                  self.worker.setToDos([ self.task ]).success(function() {
                    done()
                  })
                })
              })
            })
          })
        })

        it('throws an error if included DaoFactory is not referenced by alias', function(done) {
          var self = this
          expect(function() {
            self.Worker.findAll({ include: [ self.Task ] })
          }).to.throw(Error, 'Task is not associated to Worker!')
          done()
        })

        it('throws an error if alias is not associated', function(done) {
          var self = this
          expect(function() {
            self.Worker.findAll({ include: [ { daoFactory: self.Task, as: 'Work' } ] })
          }).to.throw(Error, 'Task (Work) is not associated to Worker!')
          done()
        })

        it('returns the associated task via worker.task', function(done) {
          this.Worker.findAll({
            where:   { name: 'worker' },
            include: [ { daoFactory: this.Task, as: 'ToDos' } ]
          }).complete(function(err, workers) {
            expect(err).to.be.null
            expect(workers).to.exist
            expect(workers[0].toDos).to.exist
            expect(workers[0].toDos[0].title).to.equal('homework')
            done()
          })
        })

        it('returns the associated task via worker.task when daoFactory is aliased with model', function(done) {
          this.Worker.findAll({
            where:   { name: 'worker' },
            include: [ { daoFactory: this.Task, as: 'ToDos' } ]
          }).complete(function(err, workers) {
            expect(workers[0].toDos[0].title).to.equal('homework')
            done()
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
          this.User.findAll({ where: { username: 'barfooz'}}).done(function(err, users) {
            users.forEach(function (user) {
              expect(user).to.be.instanceOf(self.User.DAO)
            })
            done()
          })
        })

        it("should return a DAO when raw is false", function(done) {
          var self = this
          this.User.findAll({ where: { username: 'barfooz'}}, { raw: false }).done(function(err, users) {
            users.forEach(function (user) {
              expect(user).to.be.instanceOf(self.User.DAO)
            })
            done()
          })
        })

        it("should return raw data when raw is true", function(done) {
          var self = this
          this.User.findAll({ where: { username: 'barfooz'}}, { raw: true }).done(function(err, users) {
            users.forEach(function(user) {
              expect(user).to.not.be.instanceOf(self.User.DAO)
              expect(users[0]).to.be.instanceOf(Object)
            })
            done()
          })
        })
      })
    })

    describe('normal findAll', function() {
      beforeEach(function(done) {
        var self = this
        this.User.create({username: 'user', data: 'foobar', theDate: moment().toDate()}).success(function(user) {
          self.User.create({username: 'user2', data: 'bar', theDate: moment().toDate()}).success(function(user2){
            self.users = [user].concat(user2)
            done()
          })
        })
      })

      it("finds all entries", function(done) {
        this.User.all().on('success', function(users) {
          expect(users.length).to.equal(2)
          done()
        })
      })

      it("finds all users matching the passed conditions", function(done) {
        this.User.findAll({where: "id != " + this.users[1].id}).success(function(users) {
          expect(users.length).to.equal(1)
          done()
        })
      })

      it("can also handle array notation", function(done) {
        var self = this
        this.User.findAll({where: ['id = ?', this.users[1].id]}).success(function(users) {
          expect(users.length).to.equal(1)
          expect(users[0].id).to.equal(self.users[1].id)
          done()
        })
      })

      it("sorts the results via id in ascending order", function(done) {
        this.User.findAll().success(function(users) {
          expect(users.length).to.equal(2);
          expect(users[0].id).to.be.below(users[1].id)
          done()
        })
      })

      it("sorts the results via id in descending order", function(done) {
        this.User.findAll({ order: "id DESC" }).success(function(users) {
          expect(users[0].id).to.be.above(users[1].id)
          done()
        })
      })

      it("sorts the results via a date column", function(done) {
        var self = this
        self.User.create({username: 'user3', data: 'bar', theDate: moment().add('hours', 2).toDate()}).success(function(){
          self.User.findAll({ order: 'theDate DESC' }).success(function(users) {
            expect(users[0].id).to.be.above(users[2].id)
            done()
          })
        })
      })

      it("handles offset and limit", function(done) {
        var self = this
        this.User.bulkCreate([{username: 'bobby'}, {username: 'tables'}]).success(function() {
          self.User.findAll({ limit: 2, offset: 2 }).success(function(users) {
            expect(users.length).to.equal(2)
            expect(users[0].id).to.equal(3)
            done()
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
            User.findAll({ID: 1}).success(function(user) {
              expect(user).to.be.instanceof(Array)
              expect(user).to.have.length(1)
              done()
            })
          })
        })
      })
    })
  })

  describe('findAndCountAll', function() {
    beforeEach(function(done) {
      var self = this
      this.User.bulkCreate([
        {username: 'user', data: 'foobar'},
        {username: 'user2', data: 'bar'},
        {username: 'bobby', data: 'foo'}
      ]).success(function() {
        self.User.all().success(function(users){
          self.users = users
          done()
        })
      })
    })

    it("handles where clause [only]", function(done) {
      this.User.findAndCountAll({where: "id != " + this.users[0].id}).success(function(info) {
        expect(info.count).to.equal(2)
        expect(Array.isArray(info.rows)).to.be.ok
        expect(info.rows.length).to.equal(2)
        done()
      })
    })

    it("handles where clause with ordering [only]", function(done) {
      this.User.findAndCountAll({where: "id != " + this.users[0].id, order: 'id ASC'}).success(function(info) {
        expect(info.count).to.equal(2)
        expect(Array.isArray(info.rows)).to.be.ok
        expect(info.rows.length).to.equal(2)
        done()
      })
    })

    it("handles offset", function(done) {
      this.User.findAndCountAll({offset: 1}).success(function(info) {
        expect(info.count).to.equal(3)
        expect(Array.isArray(info.rows)).to.be.ok
        expect(info.rows.length).to.equal(2)
        done()
      })
    })

    it("handles limit", function(done) {
      this.User.findAndCountAll({limit: 1}).success(function(info) {
        expect(info.count).to.equal(3)
        expect(Array.isArray(info.rows)).to.be.ok
        expect(info.rows.length).to.equal(1)
        done()
      })
    })

    it("handles offset and limit", function(done) {
      this.User.findAndCountAll({offset: 1, limit: 1}).success(function(info) {
        expect(info.count).to.equal(3)
        expect(Array.isArray(info.rows)).to.be.ok
        expect(info.rows.length).to.equal(1)
        done()
      })
    })
    it("handles attributes", function(done) {
      this.User.findAndCountAll({where: "id != " + this.users[0].id, attributes: ['data']}).success(function(info) {
        expect(info.count).to.equal(2)
        expect(Array.isArray(info.rows)).to.be.ok
        expect(info.rows.length).to.equal(2)
        expect(info.rows[0].selectedValues).to.not.have.property('username')
        expect(info.rows[1].selectedValues).to.not.have.property('username')
        done()
      })
    })
  })

  describe('all', function() {
    beforeEach(function(done) {
      this.User.bulkCreate([
        {username: 'user', data: 'foobar'},
        {username: 'user2', data: 'bar'}
      ]).complete(function() {
        done()
      })
    })

    it("should return all users", function(done) {
      this.User.all().on('success', function(users) {
        expect(users.length).to.equal(2)
        done()
      })
    })
  })

  describe('equals', function() {
    it("correctly determines equality of objects", function(done) {
      this.User.create({username: 'hallo', data: 'welt'}).success(function(u) {
        expect(u.equals(u)).to.be.ok
        done()
      })
    })

    // sqlite can't handle multiple primary keys
    if(dialect !== "sqlite") {
      it("correctly determines equality with multiple primary keys", function(done) {
        var userKeys = this.sequelize.define('userkeys', {
          foo: {type: Sequelize.STRING, primaryKey: true},
          bar: {type: Sequelize.STRING, primaryKey: true},
          name: Sequelize.STRING,
          bio: Sequelize.TEXT
        })

        userKeys.sync({ force: true }).success(function() {
          userKeys.create({foo: '1', bar: '2', name: 'hallo', bio: 'welt'}).success(function(u) {
            expect(u.equals(u)).to.be.ok
            done()
          })
        })
      })
    }
  })

  describe('equalsOneOf', function() {
    // sqlite can't handle multiple primary keys
    if (dialect !== "sqlite") {
      beforeEach(function(done) {
        this.userKey = this.sequelize.define('userKeys', {
          foo: {type: Sequelize.STRING, primaryKey: true},
          bar: {type: Sequelize.STRING, primaryKey: true},
          name: Sequelize.STRING,
          bio: Sequelize.TEXT
        })

        this.userKey.sync({ force: true }).success(function(){
          done()
        })
      })

      it('determines equality if one is matching', function(done) {
        this.userKey.create({foo: '1', bar: '2', name: 'hallo', bio: 'welt'}).success(function(u) {
          expect(u.equalsOneOf([u, {a: 1}])).to.be.ok
          done()
        })
      })

      it("doesn't determine equality if none is matching", function(done) {
        this.userKey.create({foo: '1', bar: '2', name: 'hallo', bio: 'welt'}).success(function(u) {
          expect(u.equalsOneOf([{b: 2}, {a: 1}])).to.not.be.ok
          done()
        })
      })
    }
  })

  describe('count', function() {
    it('counts all created objects', function(done) {
      var self = this
      this.User.bulkCreate([{username: 'user1'}, {username: 'user2'}]).success(function() {
        self.User.count().success(function(count) {
          expect(count).to.equal(2)
          done()
        })
      })
    })

    it('allows sql logging', function(done) {
      this.User.count().on('sql', function(sql) {
        expect(sql).to.exist
        expect(sql.toUpperCase().indexOf("SELECT")).to.be.above(-1)
        done()
      })
    })

    it('filters object', function(done) {
      var self = this
      this.User.create({username: 'user1'}).success(function() {
        self.User.create({username: 'foo'}).success(function() {
          self.User.count({where: "username LIKE '%us%'"}).success(function(count) {
            expect(count).to.equal(1)
            done()
          })
        })
      })
    })
  })

  describe('min', function() {
    beforeEach(function(done) {
      var self = this
      this.UserWithAge = this.sequelize.define('UserWithAge', {
        age: Sequelize.INTEGER
      })

      this.UserWithDec = this.sequelize.define('UserWithDec', {
        value: Sequelize.DECIMAL(10, 3)
      })

      this.UserWithAge.sync({ force: true }).success(function() {
        self.UserWithDec.sync({ force: true }).success(function() {
          done()
        })
      })
    })

    it("should return the min value", function(done) {
      var self = this
      this.UserWithAge.bulkCreate([{age: 3}, { age: 2 }]).success(function() {
        self.UserWithAge.min('age').success(function(min) {
          expect(min).to.equal(2)
          done()
        })
      })
    })

    it('allows sql logging', function(done) {
      this.UserWithAge.min('age').on('sql', function(sql) {
        expect(sql).to.exist
        expect(sql.toUpperCase().indexOf("SELECT")).to.be.above(-1)
        done()
      })
    })

    it("should allow decimals in min", function(done){
      var self = this
      this.UserWithDec.bulkCreate([{value: 5.5}, {value: 3.5}]).success(function(){
        self.UserWithDec.min('value').success(function(min){
          expect(min).to.equal(3.5)
          done()
        })
      })
    })
  })

  describe('max', function() {
    beforeEach(function(done) {
      var self = this
      this.UserWithAge = this.sequelize.define('UserWithAge', {
        age: Sequelize.INTEGER,
        order: Sequelize.INTEGER
      })

      this.UserWithDec = this.sequelize.define('UserWithDec', {
        value: Sequelize.DECIMAL(10, 3)
      })

      this.UserWithAge.sync({ force: true }).success(function() {
        self.UserWithDec.sync({ force: true }).success(function() {
          done()
        })
      })
    })

    it("should return the max value for a field named the same as an SQL reserved keyword", function(done) {
      var self = this
      this.UserWithAge.bulkCreate([{age: 2, order: 3}, {age: 3, order: 5}]).success(function(){
        self.UserWithAge.max('order').success(function(max) {
          expect(max).to.equal(5)
          done()
        })
      })
    })

    it("should return the max value", function(done) {
      var self = this
      self.UserWithAge.bulkCreate([{age: 2}, {age: 3}]).success(function() {
        self.UserWithAge.max('age').success(function(max) {
          expect(max).to.equal(3)
          done()
        })
      })
    })

    it("should allow decimals in max", function(done) {
      var self = this
      this.UserWithDec.bulkCreate([{value: 3.5}, {value: 5.5}]).success(function(){
        self.UserWithDec.max('value').success(function(max){
          expect(max).to.equal(5.5)
          done()
        })
      })
    })

    it('allows sql logging', function(done) {
      this.UserWithAge.max('age').on('sql', function(sql) {
        expect(sql).to.exist
        expect(sql.toUpperCase().indexOf("SELECT")).to.be.above(-1)
        done()
      })
    })
  })

  describe('scopes', function() {
    beforeEach(function(done) {
      this.ScopeMe = this.sequelize.define('ScopeMe', {
        username: Sequelize.STRING,
        email: Sequelize.STRING,
        access_level: Sequelize.INTEGER,
        other_value: Sequelize.INTEGER
      }, {
        defaultScope: {
          where: {
            access_level: {
              gte: 5
            }
          }
        },
        scopes: {
          orderScope: {
            order: 'access_level DESC'
          },
          limitScope: {
            limit: 2
          },
          sequelizeTeam: {
            where: ['email LIKE \'%@sequelizejs.com\'']
          },
          fakeEmail: {
            where: ['email LIKE \'%@fakeemail.com\'']
          },
          highValue: {
            where: {
              other_value: {
                gte: 10
              }
            }
          },
          isTony: {
            where: {
              username: 'tony'
            }
          },
          canBeTony: {
            where: {
              username: ['tony']
            }
          },
          canBeDan: {
            where: {
              username: {
                in: 'dan'
              }
            }
          },
          actualValue: function(value) {
            return {
              where: {
                other_value: value
              }
            }
          },
          complexFunction: function(email, accessLevel) {
            return {
              where: ['email like ? AND access_level >= ?', email + '%', accessLevel]
            }
          },
          lowAccess: {
            where: {
              access_level: {
                lte: 5
              }
            }
          },
          escape: {
            where: {
              username: "escape'd"
            }
          }
        }
      })

      this.sequelize.sync({force: true}).success(function() {
        var records = [
          {username: 'dan', email: 'dan@sequelizejs.com', access_level: 5, other_value: 10},
          {username: 'tobi', email: 'tobi@fakeemail.com', access_level: 10, other_value: 11},
          {username: 'tony', email: 'tony@sequelizejs.com', access_level: 3, other_value: 7}
        ];
        this.ScopeMe.bulkCreate(records).success(function() {
          done()
        })
      }.bind(this))
    })

    it("should have no problems with escaping SQL", function(done) {
      var self = this
      this.ScopeMe.create({username: 'escape\'d', email: 'fake@fakemail.com'}).success(function(){
        self.ScopeMe.scope('escape').all().success(function(users){
          expect(users).to.be.an.instanceof(Array)
          expect(users.length).to.equal(1)
          expect(users[0].username).to.equal('escape\'d');
          done()
        })
      })
    })

    it("should be able to use a defaultScope if declared", function(done) {
      this.ScopeMe.all().success(function(users) {
        expect(users).to.be.an.instanceof(Array)
        expect(users.length).to.equal(2)
        expect([10,5].indexOf(users[0].access_level) !== -1).to.be.true
        expect([10,5].indexOf(users[1].access_level) !== -1).to.be.true
        expect(['dan', 'tobi'].indexOf(users[0].username) !== -1).to.be.true
        expect(['dan', 'tobi'].indexOf(users[1].username) !== -1).to.be.true
        done()
      })
    })

    it("should be able to amend the default scope with a find object", function(done) {
      this.ScopeMe.findAll({where: {username: 'dan'}}).success(function(users) {
        expect(users).to.be.an.instanceof(Array)
        expect(users.length).to.equal(1)
        expect(users[0].username).to.equal('dan')
        done()
      })
    })

    it("should be able to override the default scope", function(done) {
      this.ScopeMe.scope('fakeEmail').findAll().success(function(users) {
        expect(users).to.be.an.instanceof(Array)
        expect(users.length).to.equal(1)
        expect(users[0].username).to.equal('tobi')
        done()
      })
    })

    it("should be able to combine two scopes", function(done) {
      this.ScopeMe.scope(['sequelizeTeam', 'highValue']).findAll().success(function(users) {
        expect(users).to.be.an.instanceof(Array)
        expect(users.length).to.equal(1)
        expect(users[0].username).to.equal('dan')
        done()
      })
    })

    it("should be able to call a scope that's a function", function(done) {
      this.ScopeMe.scope({method: ['actualValue', 11]}).findAll().success(function(users) {
        expect(users).to.be.an.instanceof(Array)
        expect(users.length).to.equal(1)
        expect(users[0].username).to.equal('tobi')
        done()
      })
    })

    it("should be able to handle multiple function scopes", function(done) {
      this.ScopeMe.scope([{method: ['actualValue', 10]}, {method: ['complexFunction', 'dan', '5']}]).findAll().success(function(users) {
        expect(users).to.be.an.instanceof(Array)
        expect(users.length).to.equal(1)
        expect(users[0].username).to.equal('dan')
        done()
      })
    })

    it("should be able to stack the same field in the where clause", function(done) {
      this.ScopeMe.scope(['canBeDan', 'canBeTony']).findAll().success(function(users) {
        expect(users).to.be.an.instanceof(Array)
        expect(users.length).to.equal(2)
        expect(['dan', 'tony'].indexOf(users[0].username) !== -1).to.be.true
        expect(['dan', 'tony'].indexOf(users[1].username) !== -1).to.be.true
        done()
      })
    })

    it("should be able to merge scopes", function(done) {
      this.ScopeMe.scope(['highValue', 'isTony', {merge: true, method: ['actualValue', 7]}]).findAll().success(function(users) {
        expect(users).to.be.an.instanceof(Array)
        expect(users.length).to.equal(1)
        expect(users[0].username).to.equal('tony')
        done()
      })
    })

    it("should give us the correct order if we declare an order in our scope", function(done) {
      this.ScopeMe.scope('sequelizeTeam', 'orderScope').findAll().success(function(users) {
        expect(users).to.be.an.instanceof(Array)
        expect(users.length).to.equal(2)
        expect(users[0].username).to.equal('dan')
        expect(users[1].username).to.equal('tony')
        done()
      })
    })

    it("should give us the correct order as well as a limit if we declare such in our scope", function(done) {
      this.ScopeMe.scope(['orderScope', 'limitScope']).findAll().success(function(users) {
        expect(users).to.be.an.instanceof(Array)
        expect(users.length).to.equal(2)
        expect(users[0].username).to.equal('tobi')
        expect(users[1].username).to.equal('dan')
        done()
      })
    })

    it("should have no problems combining scopes and traditional where object", function(done) {
      this.ScopeMe.scope('sequelizeTeam').findAll({where: {other_value: 10}}).success(function(users) {
        expect(users).to.be.an.instanceof(Array)
        expect(users.length).to.equal(1)
        expect(users[0].username).to.equal('dan')
        expect(users[0].access_level).to.equal(5)
        expect(users[0].other_value).to.equal(10)
        done()
      })
    })

    it("should be able to remove all scopes", function(done) {
      this.ScopeMe.scope(null).findAll().success(function(users) {
        expect(users).to.be.an.instanceof(Array)
        expect(users.length).to.equal(3)
        done()
      })
    })

    it("should have no problem performing findOrCreate", function(done) {
      this.ScopeMe.findOrCreate({username: 'fake'}).success(function(user) {
        expect(user.username).to.equal('fake')
        done()
      })
    })

    it("should be able to hold multiple scope objects", function(done) {
      var sequelizeTeam = this.ScopeMe.scope('sequelizeTeam', 'orderScope')
        , tobi = this.ScopeMe.scope({method: ['actualValue', 11]})

      sequelizeTeam.all().success(function(team) {
        tobi.all().success(function(t) {
          expect(team).to.be.an.instanceof(Array)
          expect(team.length).to.equal(2)
          expect(team[0].username).to.equal('dan')
          expect(team[1].username).to.equal('tony')

          expect(t).to.be.an.instanceof(Array)
          expect(t.length).to.equal(1)
          expect(t[0].username).to.equal('tobi')
          done()
        })
      })
    })

    it("should gracefully omit any scopes that don't exist", function(done) {
      this.ScopeMe.scope('sequelizeTeam', 'orderScope', 'doesntexist').all().success(function(team) {
        expect(team).to.be.an.instanceof(Array)
        expect(team.length).to.equal(2)
        expect(team[0].username).to.equal('dan')
        expect(team[1].username).to.equal('tony')
        done()
      })
    })

    it("should gracefully omit any scopes that don't exist through an array", function(done) {
      this.ScopeMe.scope(['sequelizeTeam', 'orderScope', 'doesntexist']).all().success(function(team) {
        expect(team).to.be.an.instanceof(Array)
        expect(team.length).to.equal(2)
        expect(team[0].username).to.equal('dan')
        expect(team[1].username).to.equal('tony')
        done()
      })
    })

    it("should gracefully omit any scopes that don't exist through an object", function(done) {
      this.ScopeMe.scope('sequelizeTeam', 'orderScope', {method: 'doesntexist'}).all().success(function(team) {
        expect(team).to.be.an.instanceof(Array)
        expect(team.length).to.equal(2)
        expect(team[0].username).to.equal('dan')
        expect(team[1].username).to.equal('tony')
        done()
      })
    })

    it("should emit an error for scopes that don't exist with silent: false", function(done) {
      try {
        this.ScopeMe.scope('doesntexist', {silent: false})
      } catch (err) {
        expect(err.message).to.equal('Invalid scope doesntexist called.')
        done()
      }
    })
  })

  describe('schematic support', function() {
    beforeEach(function(done){
      var self = this;

      this.UserPublic = this.sequelize.define('UserPublic', {
        age: Sequelize.INTEGER
      })

      this.UserSpecial = this.sequelize.define('UserSpecial', {
        age: Sequelize.INTEGER
      })

      self.sequelize.dropAllSchemas().success(function(){
        self.sequelize.createSchema('schema_test').success(function(){
          self.sequelize.createSchema('special').success(function(){
            self.UserSpecial.schema('special').sync({force: true}).success(function(UserSpecialSync) {
              self.UserSpecialSync = UserSpecialSync
              done()
            })
          })
        })
      })
    })

    it("should be able to list schemas", function(done){
      this.sequelize.showAllSchemas().success(function(schemas) {
        expect(schemas).to.exist
        expect(schemas[0]).to.be.instanceof(Array)
        // sqlite & MySQL doesn't actually create schemas unless Model.sync() is called
        // Postgres supports schemas natively
        expect(schemas[0]).to.have.length((dialect === "postgres" || dialect === "postgres-native" ? 2 : 1))
        done()
      })
    })

    if (dialect === "mysql" || dialect === "sqlite") {
      it("should take schemaDelimiter into account if applicable", function(done){
        var UserSpecialUnderscore = this.sequelize.define('UserSpecialUnderscore', {age: Sequelize.INTEGER}, {schema: 'hello', schemaDelimiter: '_'})
        var UserSpecialDblUnderscore = this.sequelize.define('UserSpecialDblUnderscore', {age: Sequelize.INTEGER})
        UserSpecialUnderscore.sync({force: true}).success(function(User){
          UserSpecialDblUnderscore.schema('hello', '__').sync({force: true}).success(function(DblUser){
            DblUser.create({age: 3}).on('sql', function(dblSql){
              User.create({age: 3}).on('sql', function(sql){
                expect(dblSql).to.exist
                expect(dblSql.indexOf('INSERT INTO `hello__UserSpecialDblUnderscores`')).to.be.above(-1)
                expect(sql).to.exist
                expect(sql.indexOf('INSERT INTO `hello_UserSpecialUnderscores`')).to.be.above(-1)
                done()
              })
            })
          })
        })
      })
    }

    it("should describeTable using the default schema settings", function(done) {
      var self = this
        , UserPublic = this.sequelize.define('Public', {
        username: Sequelize.STRING
      })

      var _done = _.after(2, function() {
        done()
      })

      UserPublic.sync({ force: true }).success(function() {
        UserPublic.schema('special').sync({ force: true }).success(function() {
          self.sequelize.queryInterface.describeTable('Publics')
          .on('sql', function(sql) {
            if (dialect === "sqlite" || dialect === "mysql") {
              expect(sql).to.not.contain('special')
              _done()
            }
          })
          .success(function(table) {
            if (dialect === "postgres" || dialect === "postgres-native") {
              expect(table.id.defaultValue).to.not.contain('special')
              _done()
            }

            self.sequelize.queryInterface.describeTable('Publics', 'special')
            .on('sql', function(sql) {
              if (dialect === "sqlite" || dialect === "mysql") {
                expect(sql).to.contain('special')
                _done()
              }
            })
            .success(function(table) {
              if (dialect === "postgres" || dialect === "postgres-native") {
                expect(table.id.defaultValue).to.contain('special')
                _done()
              }
            })
          })
        })
      })
    })

    it("should be able to create and update records under any valid schematic", function(done){
      var self = this

      self.UserPublic.sync({ force: true }).success(function(UserPublicSync){
        UserPublicSync.create({age: 3}).on('sql', function(UserPublic){
          self.UserSpecialSync.schema('special').create({age: 3})
          .on('sql', function(UserSpecial){
            expect(UserSpecial).to.exist
            expect(UserPublic).to.exist
            if (dialect === "postgres") {
              expect(self.UserSpecialSync.getTableName()).to.equal('"special"."UserSpecials"');
              expect(UserSpecial.indexOf('INSERT INTO "special"."UserSpecials"')).to.be.above(-1)
              expect(UserPublic.indexOf('INSERT INTO "UserPublics"')).to.be.above(-1)
            } else if (dialect === "sqlite") {
              expect(self.UserSpecialSync.getTableName()).to.equal('`special`.`UserSpecials`');
              expect(UserSpecial.indexOf('INSERT INTO `special.UserSpecials`')).to.be.above(-1)
              expect(UserPublic.indexOf('INSERT INTO `UserPublics`')).to.be.above(-1)
            } else {
              expect(self.UserSpecialSync.getTableName()).to.equal('`special.UserSpecials`');
              expect(UserSpecial.indexOf('INSERT INTO `special.UserSpecials`')).to.be.above(-1)
              expect(UserPublic.indexOf('INSERT INTO `UserPublics`')).to.be.above(-1)
            }
          })
          .success(function(UserSpecial){
            UserSpecial.updateAttributes({age: 5})
            .on('sql', function(user){
              expect(user).to.exist
              if (dialect === "postgres") {
                expect(user.indexOf('UPDATE "special"."UserSpecials"')).to.be.above(-1)
              } else {
                expect(user.indexOf('UPDATE `special.UserSpecials`')).to.be.above(-1)
              }
              done()
            })
          })
        })
      })
    })
  })

  describe('references', function() {
    this.timeout(3000)
    beforeEach(function(done) {
      this.Author = this.sequelize.define('author', { firstName: Sequelize.STRING })
      this.Author.sync({ force: true }).success(function() {
        done()
      })
    })

    afterEach(function(done) {
      var self = this

      self.sequelize.getQueryInterface().dropTable('posts', { force: true }).success(function() {
        self.sequelize.getQueryInterface().dropTable('authors', { force: true }).success(function() {
          done()
        })
      })
    })

    it('uses an existing dao factory and references the author table', function(done) {
      var self    = this
        , Post    = this.sequelize.define('post', {
            title:    Sequelize.STRING,
            authorId: {
              type:          Sequelize.INTEGER,
              references:    this.Author,
              referencesKey: "id"
            }
          })

      this.Author.hasMany(Post)
      Post.belongsTo(this.Author)

      Post.sync().on('sql', function(sql) {
        if (dialect === 'postgres') {
          expect(sql).to.match(/"authorId" INTEGER REFERENCES "authors" \("id"\)/)
        }
        else if (dialect === 'mysql') {
          expect(sql).to.match(/FOREIGN KEY \(`authorId`\) REFERENCES `authors` \(`id`\)/)
        }
        else if (dialect === 'sqlite') {
          expect(sql).to.match(/`authorId` INTEGER REFERENCES `authors` \(`id`\)/)
        } else {
          throw new Error('Undefined dialect!')
        }

        done()
      })
    })

    it('uses a table name as a string and references the author table', function(done) {
      var self    = this
        , Post    = self.sequelize.define('post', {
            title:    Sequelize.STRING,
            authorId: {
              type:          Sequelize.INTEGER,
              references:    'authors',
              referencesKey: "id"
            }
          })

      this.Author.hasMany(Post)
      Post.belongsTo(this.Author)

      Post.sync().on('sql', function(sql) {
        if (dialect === 'postgres') {
          expect(sql).to.match(/"authorId" INTEGER REFERENCES "authors" \("id"\)/)
        }
        else if (dialect === 'mysql') {
          expect(sql).to.match(/FOREIGN KEY \(`authorId`\) REFERENCES `authors` \(`id`\)/)
        }
        else if (dialect === 'sqlite') {
          expect(sql).to.match(/`authorId` INTEGER REFERENCES `authors` \(`id`\)/)
        } else {
          throw new Error('Undefined dialect!')
        }

        done()
      })
    })

    it("emits an error event as the referenced table name is invalid", function(done) {
      var self    = this
        , Post    = this.sequelize.define('post', {
            title:    Sequelize.STRING,
            authorId: {
              type:          Sequelize.INTEGER,
              references:    '4uth0r5',
              referencesKey: "id"
            }
          })

      this.Author.hasMany(Post)
      Post.belongsTo(this.Author)

      Post.sync().success(function() {
        if (dialect === 'sqlite') {
          // sorry ... but sqlite is too stupid to understand whats going on ...
          expect(1).to.equal(1)
          done()
        } else {
          // the parser should not end up here ...
          expect(2).to.equal(1)
          done()
        }
      }).error(function(err) {
        if (dialect === 'mysql') {
          expect(err.message).to.match(/ER_CANNOT_ADD_FOREIGN|ER_CANT_CREATE_TABLE/)
        }
        else if (dialect === 'sqlite') {
          // the parser should not end up here ... see above
          expect(1).to.equal(2)
        }
        else if (dialect === 'postgres') {
          expect(err.message).to.match(/relation "4uth0r5" does not exist/)
        } else {
          throw new Error('Undefined dialect!')
        }

        done()
      })
    })
  })

  describe("syntax sugar", function() {
    before(function(done) {
      this.User = this.sequelize.define("user", {
        username:  Sequelize.STRING,
        firstName: Sequelize.STRING,
        lastName:  Sequelize.STRING
      })

      this.User.sync({ force: true }).success(function() {
        done()
      })
    })

    describe("dataset", function() {
      it("returns a node-sql instance with the correct dialect", function() {
        expect(this.User.dataset().sql.dialectName).to.equal(dialect)
      })

      it("allows me to generate sql queries", function() {
        var query = this.User.dataset().select("username").toQuery()
        expect(Object.keys(query)).to.eql(['text', 'values'])
      })
    })

    describe("select", function() {
      it("sets .select() as an alias to .dataset().select()", function() {
        var query1 = this.User.select("username").toQuery()
          , query2 = this.User.dataset().select("username").toQuery()

        expect(query1.text).to.equal(query2.text)
      })
    })

    describe("toSql", function() {
      it("transforms the node-sql instance into a proper sql string", function() {
        var sql    = this.User.select("username").toSql()
        var sqlMap = {
          postgres: 'SELECT username FROM "' + this.User.tableName + '";',
          mysql:    'SELECT username FROM `' + this.User.tableName + '`;',
          sqlite:   'SELECT username FROM "' + this.User.tableName + '";'
        }
        expect(sql).to.equal(sqlMap[dialect])
      })

      it("transforms node-sql instances with chaining into a proper sql string", function() {
        var sql    = this.User.select("username").select("firstName").group("username").toSql()
        var sqlMap = {
          postgres: 'SELECT username, firstName FROM "' + this.User.tableName + '" GROUP BY username;',
          mysql:    'SELECT username, firstName FROM `' + this.User.tableName + '` GROUP BY username;',
          sqlite:   'SELECT username, firstName FROM "' + this.User.tableName + '" GROUP BY username;'
        }
        expect(sql).to.equal(sqlMap[dialect])
      })
    })

    describe("exec", function() {
      beforeEach(function(done) {
        var self = this

        this
          .User
          .create({ username: "foo" })
          .then(function() {
            return self.User.create({ username: "bar" })
          })
          .then(function() {
            return self.User.create({ username: "baz" })
          })
          .then(function() { done() })
      })

      it("selects all users with name 'foo'", function(done) {
        this
          .User
          .where({ username: "foo" })
          .exec()
          .success(function(users) {
            expect(users).to.have.length(1)
            expect(users[0].username).to.equal("foo")
            done()
          })
      })

      it("returns an instanceof DAO", function(done) {
        var DAO = require(__dirname + "/../lib/dao")

        this.User.where({ username: "foo" }).exec().success(function(users) {
          expect(users[0]).to.be.instanceOf(DAO)
          done()
        })
      })

      it("returns all users in the db", function(done) {
        this.User.select().exec().success(function(users) {
          expect(users).to.have.length(3)
          done()
        })
      })

      it("can handle or queries", function(done) {
        this
          .User
          .where(this.User.dataset().username.equals("bar").or(this.User.dataset().username.equals("baz")))
          .exec()
          .success(function(users) {
            expect(users).to.have.length(2)
            done()
          })
      })
    })
  })

  describe("blob", function() {
    beforeEach(function(done) {
      this.BlobUser = this.sequelize.define("blobUser", {
        data: Sequelize.BLOB
      })

      this.BlobUser.sync({ force: true }).success(function() {
        done()
      })
    })

    describe("buffers", function () {
      it("should be able to take a buffer as parameter to a BLOB field", function (done) {
        this.BlobUser.create({
          data: new Buffer('Sequelize')
        }).success(function (user) {
          expect(user).to.be.ok
          done()
        })
      })

      it("should return a buffer when fetching a blob", function (done) {
        var self = this
        this.BlobUser.create({
          data: new Buffer('Sequelize')
        }).success(function (user) {
          self.BlobUser.find(user.id).success(function (user) {
            expect(user.data).to.be.an.instanceOf(Buffer)
            expect(user.data.toString()).to.have.string('Sequelize')
            done()
          })
        })
      })
    })

    describe("strings", function () {
      it("should be able to take a string as parameter to a BLOB field", function (done) {
        this.BlobUser.create({
          data: 'Sequelize'
        }).success(function (user) {
          expect(user).to.be.ok
          done()
        })
      })

      it("should return a buffer when fetching a BLOB, even when the BLOB was inserted as a string", function (done) {
        var self = this
        this.BlobUser.create({
          data: 'Sequelize'
        }).success(function (user) {
          self.BlobUser.find(user.id).success(function (user) {
            expect(user.data).to.be.an.instanceOf(Buffer)
            expect(user.data.toString()).to.have.string('Sequelize')
            done()
          })
        })
      })
    })
  })
})
