/* jshint camelcase: false */
var buster    = require("buster")
  , Sequelize = require("../index")
  , Helpers   = require('./buster-helpers')
  , _         = require('lodash')
  , moment    = require('moment')
  , dialect   = Helpers.getTestDialect()
  , DataTypes = require(__dirname + "/../lib/data-types")

buster.spec.expose()
buster.testRunner.timeout = 1000

describe(Helpers.getTestDialectTeaser("DAOFactory"), function() {
  var sequelize = Helpers.createSequelizeInstance({dialect: dialect})
    , User = sequelize.define('User', {
    username:     DataTypes.STRING,
    secretValue:  DataTypes.STRING,
    data:         DataTypes.STRING,
    intVal:       DataTypes.INTEGER,
    theDate:      DataTypes.DATE
  })

  before(function(done) {
    this.sequelize = sequelize
    this.DataTypes = DataTypes
    this.User = User
    var self = this
    Helpers.clearDatabase(this.sequelize, function() {
      self.User.sync({ force: true }).success(done)
    })
  })

  describe('constructor', function() {
    it("uses the passed dao name as tablename if freezeTableName", function(done) {
      var User = this.sequelize.define('FrozenUser', {}, { freezeTableName: true })
      expect(User.tableName).toEqual('FrozenUser')
      done()
    })

    it("uses the pluralized dao name as tablename unless freezeTableName", function(done) {
      var User = this.sequelize.define('SuperUser', {}, { freezeTableName: false })
      expect(User.tableName).toEqual('SuperUsers')
      done()
    })

    it("uses checks to make sure dao factory isnt leaking on multiple define", function(done) {
      this.sequelize.define('SuperUser', {}, { freezeTableName: false })
      var factorySize = this.sequelize.daoFactoryManager.all.length

      this.sequelize.define('SuperUser', {}, { freezeTableName: false })
      var factorySize2 = this.sequelize.daoFactoryManager.all.length

      expect(factorySize).toEqual(factorySize2)
      done()
    })

    it("attaches class and instance methods", function(done) {
      var User = this.sequelize.define('UserWithClassAndInstanceMethods', {}, {
        classMethods: { doSmth: function(){ return 1 } },
        instanceMethods: { makeItSo: function(){ return 2}}
      })

      expect(User.doSmth).toBeDefined()
      expect(User.doSmth()).toEqual(1)
      expect(User.makeItSo).not.toBeDefined()

      expect(User.build().doSmth).not.toBeDefined()
      expect(User.build().makeItSo).toBeDefined()
      expect(User.build().makeItSo()).toEqual(2)
      done()
    })

    it("throws an error if 2 autoIncrements are passed", function(done) {
      var self = this
      expect(function() {
        self.sequelize.define('UserWithTwoAutoIncrements', {
          userid:    { type: Sequelize.INTEGER, primaryKey: true, autoIncrement: true },
          userscore: { type: Sequelize.INTEGER, primaryKey: true, autoIncrement: true }
        })
      }).toThrow('Error', 'Invalid DAO definition. Only one autoincrement field allowed.')
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
      }).toThrow('Error', 'Members of the validate option must be functions. Model: Foo, error with validate member notFunction')
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
      }).toThrow('Error', 'A model validator function must not have the same name as a field. Model: Foo, field/validation name: field')
      done()
    })
  })

  describe('build', function() {
    it("doesn't create database entries", function(done) {
      this.User.build({ username: 'John Wayne' })
      this.User.all().success(function(users) {
        expect(users.length).toEqual(0)
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
      expect(Task.build().title).toEqual('a task!')
      expect(Task.build().foo).toEqual(2)
      expect(Task.build().bar).toEqual(undefined)
      expect(Task.build().foobar).toEqual('asd')
      expect(Task.build().flag).toEqual(false)
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
      expect(Task.build().title).toEqual('a task!')
      expect(Task.build().foo).toEqual(2)
      expect(Task.build().bar).toEqual(undefined)
      expect(Task.build().foobar).toEqual('asd')
      expect(Task.build().flag).toEqual(false)
      done()
    })

    it("stores the the passed values in a special variable", function(done) {
      var user = this.User.build({ username: 'John Wayne' })
      expect(user.selectedValues).toEqual({ username: 'John Wayne' })
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

      expect(Product.build({price: 42}).price).toEqual('answer = 84')

      var p = Product.build({price: 1})
      expect(p.price).toEqual('answer = 43');

      p.price = 0
      expect(p.price).toEqual('answer = 42')
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

      expect(Product.build({price: 20}).priceInCents).toEqual(20 * 100)
      expect(Product.build({priceInCents: 30 * 100}).price).toEqual('$' + 30)
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

      expect(p.price1).toEqual(10)
      expect(p.price2).toEqual(20)
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
          expect(_user.id).toEqual(user.id)
          expect(_user.username).toEqual('Username')
          expect(created).toBeFalse()
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
          expect(_user.id).toEqual(user.id)
          expect(_user.username).toEqual('Username')
          expect(_user.data).toEqual('ThisIsData')
          expect(created).toBeFalse()
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
        expect(user.username).toEqual('Username')
        expect(user.data).toEqual('ThisIsData')
        expect(created).toBeTrue()
        done()
      })
    })
  })

  describe('create', function() {
    it("casts empty arrays correctly for postgresql", function(done) {
      if (dialect !== "postgres" && dialect !== "postgresql-native") {
        expect('').toEqual('')
        return done()
      }

      var User = this.sequelize.define('UserWithArray', {
        myvals: { type: Sequelize.ARRAY(Sequelize.INTEGER) },
        mystr: { type: Sequelize.ARRAY(Sequelize.STRING) }
      })

      User.sync({force: true}).success(function() {
        User.create({myvals: [], mystr: []}).on('sql', function(sql){
          expect(sql.indexOf('ARRAY[]::INTEGER[]')).toBeGreaterThan(-1)
          expect(sql.indexOf('ARRAY[]::VARCHAR[]')).toBeGreaterThan(-1)
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
            expect(err).toBeDefined()

            Helpers.checkMatchForDialects(dialect, err.message, {
              sqlite: /.*SQLITE_CONSTRAINT.*/,
              mysql: /.*Duplicate\ entry.*/,
              postgres: /.*duplicate\ key\ value.*/
            })

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

      UserNull.sync({ force: true }).success(function() {
        UserNull.create({ username: 'foo', smth: null }).error(function(err) {
          expect(err).toBeDefined()

          Helpers.checkMatchForDialects(dialect, err.message, {
            sqlite: /.*SQLITE_CONSTRAINT.*/,
            // We need to allow two different errors for MySQL, see:
            // http://dev.mysql.com/doc/refman/5.0/en/server-sql-mode.html#sqlmode_strict_trans_tables
            mysql: /(Column 'smth' cannot be null|Field 'smth' doesn't have a default value)/,
            postgres: /.*column "smth" violates not-null.*/
          })

          UserNull.create({ username: 'foo', smth: 'foo' }).success(function() {
            UserNull.create({ username: 'foo', smth: 'bar' }).error(function(err) {
              expect(err).toBeDefined()

              Helpers.checkMatchForDialects(dialect, err.message, {
                sqlite: /.*SQLITE_CONSTRAINT.*/,
                mysql: "Duplicate entry 'foo' for key 'username'",
                postgres: /.*duplicate key value violates unique constraint.*/
              })

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
      }).toThrow('Error', 'Unrecognized data type for field activity_date')

      expect(function() {
        self.sequelize.define('UserBadDataType', {
          activity_date: {type: Sequelize.DATe}
        })
      }).toThrow('Error', 'Unrecognized data type for field activity_date')
      done()
    })

    it('sets a 64 bit int in bigint', function(done) {
      var User = this.sequelize.define('UserWithBigIntFields', {
        big: Sequelize.BIGINT
      })

      User.sync({ force: true }).success(function() {
        User.create({ big: '9223372036854775807' }).on('success', function(user) {
          expect(user.big).toBe( '9223372036854775807' )
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
          expect(user.userid).toEqual(1)

          User.create({}).on('success', function(user) {
            expect(user.userid).toEqual(2)
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
            expect(user.options).toEqual(options)
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
            expect(sql).toBeDefined()
            expect(sql.toUpperCase().indexOf("INSERT")).toBeGreaterThan(-1)
            done()
          })
      })
    })

    it('should only store the values passed in the whitelist', function(done) {
      var self = this
        , data = { username: 'Peter', secretValue: '42' }

      this.User.create(data, ['username']).success(function(user) {
        self.User.find(user.id).success(function(_user) {
          expect(_user.username).toEqual(data.username)
          expect(_user.secretValue).not.toEqual(data.secretValue)
          expect(_user.secretValue).toEqual(null)
          done()
        })
      })
    })

    it('should store all values if no whitelist is specified', function(done) {
      var self = this
        , data = { username: 'Peter', secretValue: '42' }

      this.User.create(data).success(function(user) {
        self.User.find(user.id).success(function(_user) {
          expect(_user.username).toEqual(data.username)
          expect(_user.secretValue).toEqual(data.secretValue)
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
            expect(book.title).toEqual(data.title)
            expect(book.author).toEqual(data.author)
            expect(books[index].rawAttributes.id.type.toString())
              .toEqual(dataTypes[index].toString())
          })
          done()
        })
      })
    })

    it('saves data with single quote', function(done) {
      var quote = "single'quote"
        , self  = this

      this.User.create({ data: quote }).success(function(user) {
        expect(user.data).toEqual(quote, 'memory single quote')

        self.User.find({where: { id: user.id }}).success(function(user) {
          expect(user.data).toEqual(quote, 'SQL single quote')
          done()
        })
      })
    })

    it('saves data with double quote', function(done) {
      var quote = 'double"quote'
        , self  = this

      this.User.create({ data: quote }).success(function(user) {
        expect(user.data).toEqual(quote, 'memory double quote')

        self.User.find({where: { id: user.id }}).success(function(user) {
          expect(user.data).toEqual(quote, 'SQL double quote')
          done()
        })
      })
    })

    it('saves stringified JSON data', function(done) {
      var json = JSON.stringify({ key: 'value' })
        , self = this

      this.User.create({ data: json }).success(function(user) {
        expect(user.data).toEqual(json, 'memory data')
        self.User.find({where: { id: user.id }}).success(function(user) {
          expect(user.data).toEqual(json, 'SQL data')
          done()
        })
      })
    })

    it('stores the current date in createdAt', function(done) {
      this.User.create({ username: 'foo' }).success(function(user) {
        expect(parseInt(+user.createdAt/5000, 10)).toEqual(parseInt(+new Date()/5000, 10))
        done()
      })
    })

    it('allows setting custom IDs', function(done) {
      var self = this
      this.User.create({ id: 42 }).success(function (user) {
        expect(user.id).toEqual(42)

        self.User.find(42).success(function (user) {
          expect(user).toBeDefined()
          done()
        })
      })
    })

    describe('enums', function() {
      it('correctly restores enum values', function(done) {
        var self = this
        this.Item = this.sequelize.define('Item', {
          state: { type: Helpers.Sequelize.ENUM, values: ['available', 'in_cart', 'shipped'] }
        })

        this.Item.sync({ force: true }).success(function() {
          self.Item.create({ state: 'available' }).success(function(item) {
            self.item = item
            self.Item.find({ where: { state: 'available' }}).success(function(item) {
              expect(item.id).toEqual(self.item.id)
              done()
            })
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
          expect(users.length).toEqual(1)
          expect(users[0].username).toEqual("Paul")
          expect(users[0].secretValue).toBeNull()
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
          expect(users.length).toEqual(2)
          expect(users[0].username).toEqual("Peter")
          expect(users[0].secretValue).toBeNull();
          expect(users[1].username).toEqual("Paul")
          expect(users[1].secretValue).toBeNull();
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
          expect(users.length).toEqual(2)
          expect(users[0].username).toEqual("Peter")
          expect(users[0].secretValue).toEqual('42')
          expect(users[1].username).toEqual("Paul")
          expect(users[1].secretValue).toEqual('23')
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
          expect(users.length).toEqual(2)
          expect(users[0].username).toEqual("Peter")
          expect(users[0].data).toEqual(quote)
          expect(users[1].username).toEqual("Paul")
          expect(users[1].data).toEqual(quote)
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
          expect(users.length).toEqual(2)
          expect(users[0].username).toEqual("Peter")
          expect(users[0].data).toEqual(quote)
          expect(users[1].username).toEqual("Paul")
          expect(users[1].data).toEqual(quote)
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
          expect(users.length).toEqual(2)
          expect(users[0].username).toEqual("Peter")
          expect(users[0].data).toEqual(json)
          expect(users[1].username).toEqual("Paul")
          expect(users[1].data).toEqual(json)
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
          expect(users.length).toEqual(2)
          expect(users[0].username).toEqual("Peter")
          expect(parseInt(+users[0].createdAt/5000, 10)).toEqual(parseInt(+new Date()/5000, 10))
          expect(users[1].username).toEqual("Paul")
          expect(parseInt(+users[1].createdAt/5000, 10)).toEqual(parseInt(+new Date()/5000, 10))
          done()
        })
      })
    })

    describe('enums', function() {
      before(function(done) {
        var self = this
        this.Item = this.sequelize.define('Item', {
          state: { type: Helpers.Sequelize.ENUM, values: ['available', 'in_cart', 'shipped'] },
          name: Sequelize.STRING
        })

        this.Item.sync({ force: true }).success(function() {
          self.Item.bulkCreate([{state: 'in_cart', name: 'A'}, { state: 'available', name: 'B'}]).success(function() {
            done()
          })
        })
      })

      it('correctly restores enum values', function(done) {
        this.Item.find({ where: { state: 'available' }}).success(function(item) {
          expect(item.name).toEqual('B')
          done()
        })
      })
    })
  })

  describe('update', function() {
    it('allows sql logging of updated statements', function(done) {
      var User = this.sequelize.define('User', {
        name: Sequelize.STRING,
        bio: Sequelize.TEXT
      }, {
          paranoid:true
        })

      User.sync({ force: true }).success(function() {
        User.create({ name: 'meg', bio: 'none' }).success(function(u) {
          expect(u).toBeDefined()
          expect(u).not.toBeNull()
          u.updateAttributes({name: 'brian'}).on('sql', function(sql) {
            expect(sql).toBeDefined()
            expect(sql.toUpperCase().indexOf("UPDATE")).toBeGreaterThan(-1)
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
              expect(users.length).toEqual(3)

              users.forEach(function (user) {
                if (user.secretValue == '42') {
                  expect(user.username).toEqual("Bill")
                } else {
                  expect(user.username).toEqual("Bob")
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
            expect(users.length).toEqual(3)

            expect(users[0].username).toEqual("Bill")
            expect(users[1].username).toEqual("Bill")
            expect(users[2].username).toEqual("Bob")

            expect(parseInt(+users[0].updatedAt/5000, 10)).toEqual(parseInt(+new Date()/5000, 10))
            expect(parseInt(+users[1].updatedAt/5000, 10)).toEqual(parseInt(+new Date()/5000, 10))

            done()
          })
        })
      })
    })
  })

  describe('destroy', function() {
    it('deletes a record from the database if dao is not paranoid', function(done) {
      var User = this.sequelize.define('User', {
          name: Sequelize.STRING,
          bio: Sequelize.TEXT
        })

      User.sync({ force: true }).success(function() {
        User.create({name: 'hallo', bio: 'welt'}).success(function(u) {
          User.all().success(function(users) {
            expect(users.length).toEqual(1)
            u.destroy().success(function() {
              User.all().success(function(users) {
                expect(users.length).toEqual(0)
                done()
              })
            })
          })
        })
      })
    })

    it('allows sql logging of delete statements', function(done) {
      var User = this.sequelize.define('User', {
          name: Sequelize.STRING,
          bio: Sequelize.TEXT
        })

      User.sync({ force: true }).success(function() {
        User.create({name: 'hallo', bio: 'welt'}).success(function(u) {
          User.all().success(function(users) {
            expect(users.length).toEqual(1)
            u.destroy().on('sql', function(sql) {
              expect(sql).toBeDefined()
              expect(sql.toUpperCase().indexOf("DELETE")).toBeGreaterThan(-1)
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
              expect(users.length).toEqual(1)
              expect(users[0].username).toEqual("Bob")
              done()
            })
          })
      })
    })

    it('sets deletedAt to the current timestamp if paranoid is true', function(done) {
      var User = this.sequelize.define('ParanoidUser', {
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

      User.sync({ force: true }).success(function() {
        User.bulkCreate(data).success(function() {
          User.destroy({secretValue: '42'}).success(function() {
            User.findAll({order: 'id'}).success(function(users) {
              expect(users.length).toEqual(3)

              expect(users[0].username).toEqual("Peter")
              expect(users[1].username).toEqual("Paul")
              expect(users[2].username).toEqual("Bob")

              expect(parseInt(+users[0].deletedAt/5000, 10)).toEqual(parseInt(+new Date()/5000, 10))
              expect(parseInt(+users[1].deletedAt/5000, 10)).toEqual(parseInt(+new Date()/5000, 10))

              done()
            })
          })
        })
      })
    })
  })

  describe('special where conditions', function() {
    before(function(done) {
      var self = this

      this.User.create({
        username: 'boo',
        intVal: 5,
        theDate: '2013-01-01 12:00'
      }).success(function(user){
        self.user = user
        self.User.create({
          username: 'boo2',
          intVal: 10,
          theDate: '2013-01-10 12:00'
        }).success(function(user2){
          self.user2 = user2
          done()
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
        expect(users[0].username).toEqual('boo2')
        expect(users[0].intVal).toEqual(10)
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
        expect(users[0].username).toEqual('boo2')
        expect(users[0].intVal).toEqual(10)
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
        expect(users[0].username).toEqual('boo')
        expect(users[0].intVal).toEqual(5)
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
        expect(users[0].username).toEqual('boo')
        expect(users[0].intVal).toEqual(5)
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
        expect(users[0].username).toEqual('boo')
        expect(users[0].intVal).toEqual(5)
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
        expect(users[0].username).toEqual('boo2')
        expect(users[0].intVal).toEqual(10)
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
        expect(user.username).toEqual('boo2')
        expect(user.intVal).toEqual(10)
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
        expect(user.username).toEqual('boo2')
        expect(user.intVal).toEqual(10)
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
        expect(user.username).toEqual('boo')
        expect(user.intVal).toEqual(5)
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
        expect(user.username).toEqual('boo')
        expect(user.intVal).toEqual(5)
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
        expect(users[0].username).toEqual('boo')
        expect(users[0].intVal).toEqual(5)
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
        expect(user.username).toEqual('boo')
        expect(user.intVal).toEqual(5)
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
        expect(users[0].username).toEqual('boo')
        expect(users[0].intVal).toEqual(5)
        expect(users[1].username).toEqual('boo2')
        expect(users[1].intVal).toEqual(10)
        done()
      })
    })
  })

  describe('find', function() {
    describe('general / basic function', function() {
      before(function(done) {
        var self = this
        this.User.create({username: 'barfooz'}).success(function(user) {
          self.UserPrimary = self.sequelize.define('UserPrimary', {
            specialKey: {
              type: self.DataTypes.STRING,
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
          expect(user.specialKey).toEqual('a string')
          done()
        })
      })

      it('doesn\'t throw an error when entering in a non integer value', function(done) {
        this.User.find('a string value').success(function(user) {
          expect(user).toBeNull()
          done()
        })
      })

      it('returns a single dao', function(done) {
        var self = this
        this.User.find(this.user.id).success(function(user) {
          expect(Array.isArray(user)).toBeFalsy()
          expect(user.id).toEqual(self.user.id)
          expect(user.id).toEqual(1)
          done()
        })
      })

      it('returns a single dao given a string id', function(done) {
        var self = this
        this.User.find(this.user.id + '').success(function(user) {
          expect(Array.isArray(user)).toBeFalsy()
          expect(user.id).toEqual(self.user.id)
          expect(user.id).toEqual(1)
          done()
        })
      })

      it("should make aliased attributes available", function(done) {
        this.User.find({
          where: { id: 1 },
          attributes: ['id', ['username', 'name']]
        }).success(function(user) {
          expect(user.name).toEqual('barfooz')
          done()
        })
      })

      it("should not try to convert boolean values if they are not selected", function(done) {
        var UserWithBoolean = this.sequelize.define('user', {
          active: Sequelize.BOOLEAN
        })

        UserWithBoolean.sync({force: true}).success(function () {
          UserWithBoolean.create({ active: true }).success(function(user) {
            UserWithBoolean.find({ where: { id: user.id }, attributes: [ 'id' ] }).success(function(user) {
              expect(user.active).not.toBeDefined()
              done()
            })
          })
        })
      })

      it('finds a specific user via where option', function(done) {
        this.User.find({ where: { username: 'barfooz' } }).success(function(user) {
          expect(user.username).toEqual('barfooz')
          done()
        })
      })

      it("doesn't find a user if conditions are not matching", function(done) {
        this.User.find({ where: { username: 'foo' } }).success(function(user) {
          expect(user).toBeNull()
          done()
        })
      })

      it('allows sql logging', function(done) {
        this.User.find({ where: { username: 'foo' } }).on('sql', function(sql) {
          expect(sql).toBeDefined()
          expect(sql.toUpperCase().indexOf("SELECT")).toBeGreaterThan(-1)
          done()
        })
      })

      it('ignores passed limit option', function(done) {
        this.User.find({ limit: 10 }).success(function(user) {
          // it returns an object instead of an array
          expect(Array.isArray(user)).toBeFalsy()
          expect(user.hasOwnProperty('username')).toBeTruthy()
          done()
        })
      })

      it('finds entries via primary keys', function(done) {
        var User = this.sequelize.define('UserWithPrimaryKey', {
          identifier: {type: Sequelize.STRING, primaryKey: true},
          name: Sequelize.STRING
        })

        User.sync({ force: true }).success(function() {
          User.create({
            identifier: 'an identifier',
            name: 'John'
          }).success(function(u) {
            expect(u.id).not.toBeDefined()

            User.find('an identifier').success(function(u2) {
              expect(u2.identifier).toEqual('an identifier')
              expect(u2.name).toEqual('John')
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
            expect(user.selectedValues).toEqual({ username: 'JohnXOXOXO' })
            done()
          })
        })
      })

      it('returns the selected fields and all fields of the included table as instance.selectedValues', function(done) {
        var self = this
        this.Mission = this.sequelize.define('Mission', {
          title:  {type: Sequelize.STRING, defaultValue: 'a mission!!'},
          foo:    {type: Sequelize.INTEGER, defaultValue: 2},
        })

        this.Mission.belongsTo(this.User)
        this.User.hasMany(this.Mission)

        this.Mission.sync({ force: true }).success(function() {
          self.Mission.create().success(function(mission) {
            self.User.create({username: 'John DOE'}).success(function(user) {
              mission.setUser(user).success(function() {
                self.User.find({
                  where: { username: 'John DOE' },
                  attributes: ['username'],
                  include: [self.Mission]
                }).success(function(user) {
                  expect(user.selectedValues).toEqual({ username: 'John DOE' })
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
          , done = _.after(2 * permutations.length, _done);

        this.User.bulkCreate([{username: 'jack'}, {username: 'jack'}]).success(function() {
          permutations.forEach(function(perm) {
            self.User.find(perm).done(function(err, user) {
              expect(err).toBeNull();
              expect(user).toBeNull();
              done();
            }).on('sql', function(s) {
              expect(s.indexOf(0)).not.toEqual(-1);
              done();
            })
          })
        })
      })
    })

    describe('eager loading', function() {
      before(function(done) {
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
          before(function(done) {
            var self = this
            this.Task.belongsTo(this.Worker)
            this.init(function() {
              self.task.setWorker(self.worker).success(done)
            })
          })

          it('throws an error about unexpected input if include contains a non-object', function(done) {
            var self = this
            expect(function() {
              self.Worker.find({ include: [ 1 ] })
            }).toThrow('Error', 'Include unexpected. Element has to be either an instance of DAOFactory or an object.')
            done()
          })

          it('throws an error about missing attributes if include contains an object with daoFactory', function(done) {
            var self = this
            expect(function() {
              self.Worker.find({ include: [ { daoFactory: self.Worker } ] })
            }).toThrow('Error', 'Include malformed. Expected attributes: daoFactory, as!')
            done()
          })

          it('throws an error if included DaoFactory is not associated', function(done) {
            var self = this
            expect(function() {
              self.Worker.find({ include: [ self.Task ] })
            }).toThrow('Error', 'Task is not associated to Worker!')
            done()
          })

          it('returns the associated worker via task.worker', function(done) {
            this.Task.find({
              where:   { title: 'homework' },
              include: [ this.Worker ]
            }).complete(function(err, task) {
              expect(err).toBeNull()
              expect(task).toBeDefined()
              expect(task.worker).toBeDefined()
              expect(task.worker.name).toEqual('worker')
              done()
            })
          })
        })

        it('returns the private and public ip', function(done) {
          var self = this
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
                          expect(err).toBeNull()
                          expect(environment).toBeDefined()
                          expect(environment.privateDomain).toBeDefined()
                          expect(environment.privateDomain.ip).toEqual('192.168.0.1')
                          expect(environment.publicDomain).toBeDefined()
                          expect(environment.publicDomain.ip).toEqual('91.65.189.19')
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

      describe('hasOne', function() {
        before(function(done) {
          var self = this
          this.Worker.hasOne(this.Task)
          this.init(function() {
            self.worker.setTask(self.task).success(done)
          })
        })

        it('throws an error if included DaoFactory is not associated', function(done) {
          var self = this
          expect(function() {
            self.Task.find({ include: [ self.Worker ] })
          }).toThrow('Error', 'Worker is not associated to Task!')
          done()
        })

        it('returns the associated task via worker.task', function(done) {
          this.Worker.find({
            where:   { name: 'worker' },
            include: [ this.Task ]
          }).complete(function(err, worker) {
            expect(err).toBeNull()
            expect(worker).toBeDefined()
            expect(worker.task).toBeDefined()
            expect(worker.task.title).toEqual('homework')
            done()
          })
        })
      })

      describe('hasOne with alias', function() {
        before(function(done) {
          var self = this
          this.Worker.hasOne(this.Task, { as: 'ToDo' })
          this.init(function() {
            self.worker.setToDo(self.task).success(done)
          })
        })

        it('throws an error if included DaoFactory is not referenced by alias', function(done) {
          var self = this
          expect(function() {
            self.Worker.find({ include: [ self.Task ] })
          }).toThrow('Error', 'Task is not associated to Worker!')
          done()
        })

        it('throws an error if alias is not associated', function(done) {
          var self = this
          expect(function() {
            self.Worker.find({ include: [ { daoFactory: self.Task, as: 'Work' } ] })
          }).toThrow('Error', 'Task (Work) is not associated to Worker!')
          done()
        })

        it('returns the associated task via worker.task', function(done) {
          this.Worker.find({
            where:   { name: 'worker' },
            include: [ { daoFactory: this.Task, as: 'ToDo' } ]
          }).complete(function(err, worker) {
            expect(err).toBeNull()
            expect(worker).toBeDefined()
            expect(worker.toDo).toBeDefined()
            expect(worker.toDo.title).toEqual('homework')
            done()
          })
        })

        it('returns the associated task via worker.task when daoFactory is aliased with model', function(done) {
          this.Worker.find({
            where:   { name: 'worker' },
            include: [ { model: this.Task, as: 'ToDo' } ]
          }).complete(function(err, worker) {
            expect(worker.toDo.title).toEqual('homework')
            done()
          })
        })
      })

      describe('hasMany', function() {
        before(function(done) {
          var self = this
          this.Worker.hasMany(this.Task)
          this.init(function() {
            self.worker.setTasks([ self.task ]).success(done)
          })
        })

        it('throws an error if included DaoFactory is not associated', function(done) {
          var self = this
          expect(function() {
            self.Task.find({ include: [ self.Worker ] })
          }).toThrow('Error', 'Worker is not associated to Task!')
          done()
        })

        it('returns the associated tasks via worker.tasks', function(done) {
          this.Worker.find({
            where:   { name: 'worker' },
            include: [ this.Task ]
          }).complete(function(err, worker) {
            expect(err).toBeNull()
            expect(worker).toBeDefined()
            expect(worker.tasks).toBeDefined()
            expect(worker.tasks[0].title).toEqual('homework')
            done()
          })
        })
      })

      describe('hasMany with alias', function() {
        before(function(done) {
          var self = this
          this.Worker.hasMany(this.Task, { as: 'ToDos' })
          this.init(function() {
            self.worker.setToDos([ self.task ]).success(done)
          })
        })

        it('throws an error if included DaoFactory is not referenced by alias', function(done) {
          var self = this
          expect(function() {
            self.Worker.find({ include: [ self.Task ] })
          }).toThrow('Error', 'Task is not associated to Worker!')
          done()
        })

        it('throws an error if alias is not associated', function(done) {
          var self = this
          expect(function() {
            self.Worker.find({ include: [ { daoFactory: self.Task, as: 'Work' } ] })
          }).toThrow('Error', 'Task (Work) is not associated to Worker!')
          done()
        })

        it('returns the associated task via worker.task', function(done) {
          this.Worker.find({
            where:   { name: 'worker' },
            include: [ { daoFactory: this.Task, as: 'ToDos' } ]
          }).complete(function(err, worker) {
            expect(err).toBeNull()
            expect(worker).toBeDefined()
            expect(worker.toDos).toBeDefined()
            expect(worker.toDos[0].title).toEqual('homework')
            done()
          })
        })

        it('returns the associated task via worker.task when daoFactory is aliased with model', function(done) {
          this.Worker.find({
            where:   { name: 'worker' },
            include: [ { model: this.Task, as: 'ToDos' } ]
          }).complete(function(err, worker) {
            expect(worker.toDos[0].title).toEqual('homework')
            done()
          })
        })
      })
    })

    describe('queryOptions', function() {
      before(function(done) {
        var self = this
        this.User.create({
          username: 'barfooz'
        }).success(function(user) {
          self.user = user
          done()
        })
      })

      it("should return a DAO when queryOptions are not set", function(done) {
        var self = this
        this.User.find({ where: { username: 'barfooz'}}).done(function(err, user) {
          expect(user).toHavePrototype(self.User.DAO.prototype)
          done()
        })
      })

      it("should return a DAO when raw is false", function(done) {
        var self = this
        this.User.find({ where: { username: 'barfooz'}}, { raw: false }).done(function(err, user) {
          expect(user).toHavePrototype(self.User.DAO.prototype)
          done()
        })
      })

      it("should return raw data when raw is true", function(done) {
        var self = this
        this.User.find({ where: { username: 'barfooz'}}, { raw: true }).done(function(err, user) {
          expect(user).not.toHavePrototype(self.User.DAO.prototype)
          expect(user).toBeObject()
          done()
        })
      })
    })
  })

  describe('findAll', function() {
    describe('eager loading', function() {
      describe('belongsTo', function() {
        before(function(done) {
          var self = this
          this.Task     = this.sequelize.define('TaskBelongsTo', { title: Sequelize.STRING })
          this.Worker   = this.sequelize.define('Worker', { name: Sequelize.STRING })
          this.Task.belongsTo(this.Worker)

          this.Worker.sync({ force: true }).success(function() {
            self.Task.sync({ force: true }).success(function() {
              self.Worker.create({ name: 'worker' }).success(function(worker) {
                self.Task.create({ title: 'homework' }).success(function(task) {
                  self.worker  = worker
                  self.task    = task

                  self.task.setWorker(self.worker).success(done)
                })
              })
            })
          })
        })

        it('throws an error about unexpected input if include contains a non-object', function(done) {
          var self = this
          expect(function() {
            self.Worker.findAll({ include: [ 1 ] })
          }).toThrow('Error', 'Include unexpected. Element has to be either an instance of DAOFactory or an object.')
          done()
        })

        it('throws an error about missing attributes if include contains an object with daoFactory', function(done) {
          var self = this
          expect(function() {
            self.Worker.findAll({ include: [ { daoFactory: self.Worker } ] })
          }).toThrow('Error', 'Include malformed. Expected attributes: daoFactory, as!')
          done()
        })

        it('throws an error if included DaoFactory is not associated', function(done) {
          var self = this
          expect(function() {
            self.Worker.findAll({ include: [ self.Task ] })
          }).toThrow('Error', 'Task is not associated to Worker!')
          done()
        })

        it('returns the associated worker via task.worker', function(done) {
          this.Task.findAll({
            where:   { title: 'homework' },
            include: [ this.Worker ]
          }).complete(function(err, tasks) {
            expect(err).toBeNull()
            expect(tasks).toBeDefined()
            expect(tasks[0].worker).toBeDefined()
            expect(tasks[0].worker.name).toEqual('worker')
            done()
          })
        })
      })

      describe('hasOne', function() {
        before(function(done) {
          var self = this
          this.Task     = this.sequelize.define('TaskHasOne', { title: Sequelize.STRING })
          this.Worker   = this.sequelize.define('Worker', { name: Sequelize.STRING })
          this.Worker.hasOne(this.Task)
          this.Worker.sync({ force: true }).success(function() {
            self.Task.sync({ force: true }).success(function() {
              self.Worker.create({ name: 'worker' }).success(function(worker) {
                self.Task.create({ title: 'homework' }).success(function(task) {
                  self.worker  = worker
                  self.task    = task

                  self.worker.setTaskHasOne(self.task).success(done)
                })
              })
            })
          })
        })

        it('throws an error if included DaoFactory is not associated', function(done) {
          var self = this
          expect(function() {
            self.Task.findAll({ include: [ self.Worker ] })
          }).toThrow('Error', 'Worker is not associated to Task!')
          done()
        })

        it('returns the associated task via worker.task', function(done) {
          this.Worker.findAll({
            where:   { name: 'worker' },
            include: [ this.Task ]
          }).complete(function(err, workers) {
            expect(err).toBeNull()
            expect(workers).toBeDefined()
            expect(workers[0].taskHasOne).toBeDefined()
            expect(workers[0].taskHasOne.title).toEqual('homework')
            done()
          })
        })
      })

      describe('hasOne with alias', function() {
        before(function(done) {
          var self = this
          this.Task     = this.sequelize.define('Task', { title: Sequelize.STRING })
          this.Worker   = this.sequelize.define('Worker', { name: Sequelize.STRING })
          this.Worker.hasOne(this.Task, { as: 'ToDo' })

          this.Worker.sync({ force: true }).success(function() {
            self.Task.sync({ force: true }).success(function() {
              self.Worker.create({ name: 'worker' }).success(function(worker) {
                self.Task.create({ title: 'homework' }).success(function(task) {
                  self.worker  = worker
                  self.task    = task

                  self.worker.setToDo(self.task).success(done)
                })
              })
            })
          })
        })

        it('throws an error if included DaoFactory is not referenced by alias', function(done) {
          var self = this
          expect(function() {
            self.Worker.findAll({ include: [ self.Task ] })
          }).toThrow('Error', 'Task is not associated to Worker!')
          done()
        })

        it('throws an error if alias is not associated', function(done) {
          var self = this
          expect(function() {
            self.Worker.findAll({ include: [ { daoFactory: self.Task, as: 'Work' } ] })
          }).toThrow('Error', 'Task (Work) is not associated to Worker!')
          done()
        })

        it('returns the associated task via worker.task', function(done) {
          this.Worker.findAll({
            where:   { name: 'worker' },
            include: [ { daoFactory: this.Task, as: 'ToDo' } ]
          }).complete(function(err, workers) {
            expect(err).toBeNull()
            expect(workers).toBeDefined()
            expect(workers[0].toDo).toBeDefined()
            expect(workers[0].toDo.title).toEqual('homework')
            done()
          })
        })

        it('returns the associated task via worker.task when daoFactory is aliased with model', function(done) {
          this.Worker.findAll({
            where:   { name: 'worker' },
            include: [ { model: this.Task, as: 'ToDo' } ]
          }).complete(function(err, workers) {
            expect(workers[0].toDo.title).toEqual('homework')
            done()
          })
        })
      })

      describe('hasMany', function() {
        before(function(done) {
          var self = this
          this.Task     = this.sequelize.define('Task', { title: Sequelize.STRING })
          this.Worker   = this.sequelize.define('Worker', { name: Sequelize.STRING })
          this.Worker.hasMany(this.Task)

          this.Worker.sync({ force: true }).success(function() {
            self.Task.sync({ force: true }).success(function() {
              self.Worker.create({ name: 'worker' }).success(function(worker) {
                self.Task.create({ title: 'homework' }).success(function(task) {
                  self.worker  = worker
                  self.task    = task

                  self.worker.setTasks([ self.task ]).success(done)
                })
              })
            })
          })
        })

        it('throws an error if included DaoFactory is not associated', function(done) {
          var self = this
          expect(function() {
            self.Task.findAll({ include: [ self.Worker ] })
          }).toThrow('Error', 'Worker is not associated to Task!')
          done()
        })

        it('returns the associated tasks via worker.tasks', function(done) {
          this.Worker.findAll({
            where:   { name: 'worker' },
            include: [ this.Task ]
          }).complete(function(err, workers) {
            expect(err).toBeNull()
            expect(workers).toBeDefined()
            expect(workers[0].tasks).toBeDefined()
            expect(workers[0].tasks[0].title).toEqual('homework')
            done()
          })
        })
      })

      describe('hasMany with alias', function() {
        before(function(done) {
          var self = this
          this.Task     = this.sequelize.define('Task', { title: Sequelize.STRING })
          this.Worker   = this.sequelize.define('Worker', { name: Sequelize.STRING })
          this.Worker.hasMany(this.Task, { as: 'ToDos' })

          this.Worker.sync({ force: true }).success(function() {
            self.Task.sync({ force: true }).success(function() {
              self.Worker.create({ name: 'worker' }).success(function(worker) {
                self.Task.create({ title: 'homework' }).success(function(task) {
                  self.worker  = worker
                  self.task    = task

                  self.worker.setToDos([ self.task ]).success(done)
                })
              })
            })
          })
        })

        it('throws an error if included DaoFactory is not referenced by alias', function(done) {
          var self = this
          expect(function() {
            self.Worker.findAll({ include: [ self.Task ] })
          }).toThrow('Error', 'Task is not associated to Worker!')
          done()
        })

        it('throws an error if alias is not associated', function(done) {
          var self = this
          expect(function() {
            self.Worker.findAll({ include: [ { daoFactory: self.Task, as: 'Work' } ] })
          }).toThrow('Error', 'Task (Work) is not associated to Worker!')
          done()
        })

        it('returns the associated task via worker.task', function(done) {
          this.Worker.findAll({
            where:   { name: 'worker' },
            include: [ { daoFactory: this.Task, as: 'ToDos' } ]
          }).complete(function(err, workers) {
            expect(err).toBeNull()
            expect(workers).toBeDefined()
            expect(workers[0].toDos).toBeDefined()
            expect(workers[0].toDos[0].title).toEqual('homework')
            done()
          })
        })

        it('returns the associated task via worker.task when daoFactory is aliased with model', function(done) {
          this.Worker.findAll({
            where:   { name: 'worker' },
            include: [ { daoFactory: this.Task, as: 'ToDos' } ]
          }).complete(function(err, workers) {
            expect(workers[0].toDos[0].title).toEqual('homework')
            done()
          })
        })
      })

      describe('queryOptions', function() {
        before(function(done) {
          var self = this
          this.User.create({
            username: 'barfooz'
          }).success(function(user) {
            self.user = user
            done()
          })
        })

        it("should return a DAO when queryOptions are not set", function(done) {
          var self = this
          this.User.findAll({ where: { username: 'barfooz'}}).done(function(err, users) {
            users.forEach(function (user) {
              expect(user).toHavePrototype(self.User.DAO.prototype)
            })
            done()
          })
        })

        it("should return a DAO when raw is false", function(done) {
          var self = this
          this.User.findAll({ where: { username: 'barfooz'}}, { raw: false }).done(function(err, users) {
            users.forEach(function (user) {
              expect(user).toHavePrototype(self.User.DAO.prototype)
            })
            done()
          })
        })

        it("should return raw data when raw is true", function(done) {
          var self = this
          this.User.findAll({ where: { username: 'barfooz'}}, { raw: true }).done(function(err, users) {
            users.forEach(function(user) {
              expect(user).not.toHavePrototype(self.User.DAO.prototype)
              expect(users[0]).toBeObject()
            })
            done()
          })
        })
      })
    })

    describe('normal findAll', function() {
      before(function(done) {
        var self = this
        this.User.create({username: 'user', data: 'foobar', theDate: moment().toDate()}).success(function(user) {
          self.User.create({username: 'user2', data: 'bar', theDate: moment().toDate()}).success(function(user2){
            self.users = [user].concat(user2)
            done()
          })
        })
      })

      it("finds all entries", function(done) {
        this.User.findAll().on('success', function(users) {
          expect(users.length).toEqual(2)
          done()
        })
      })

      it("finds all users matching the passed conditions", function(done) {
        this.User.findAll({where: "id != " + this.users[1].id}).success(function(users) {
          expect(users.length).toEqual(1)
          done()
        })
      })

      it("can also handle array notation", function(done) {
        var self = this
        this.User.findAll({where: ['id = ?', this.users[1].id]}).success(function(users) {
          expect(users.length).toEqual(1)
          expect(users[0].id).toEqual(self.users[1].id)
          done()
        })
      })

      it("sorts the results via id in ascending order", function(done) {
        this.User.findAll().success(function(users) {
          expect(users.length).toEqual(2);
          expect(users[0].id).toBeLessThan(users[1].id)
          done()
        })
      })

      it("sorts the results via id in descending order", function(done) {
        this.User.findAll({ order: "id DESC" }).success(function(users) {
          expect(users[0].id).toBeGreaterThan(users[1].id)
          done()
        })
      })

      it("sorts the results via a date column", function(done) {
        var self = this
        self.User.create({username: 'user3', data: 'bar', theDate: moment().add('hours', 2).toDate()}).success(function(){
          self.User.findAll({ order: 'theDate DESC' }).success(function(users) {
            expect(users[0].id).toBeGreaterThan(users[2].id)
            done()
          })
        })
      })

      it("handles offset and limit", function(done) {
        var self = this
        this.User.bulkCreate([{username: 'bobby'}, {username: 'tables'}]).success(function() {
          self.User.findAll({ limit: 2, offset: 2 }).success(function(users) {
            expect(users.length).toEqual(2)
            expect(users[0].id).toEqual(3)
            done()
          })
        })
      })
    })
  })

  describe('findAndCountAll', function() {
    before(function(done) {
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
        expect(info.count).toEqual(2)
        expect(Array.isArray(info.rows)).toBeTruthy()
        expect(info.rows.length).toEqual(2)
        done()
      })
    })

    it("handles where clause with ordering [only]", function(done) {
      this.User.findAndCountAll({where: "id != " + this.users[0].id, order: 'id ASC'}).success(function(info) {
        expect(info.count).toEqual(2)
        expect(Array.isArray(info.rows)).toBeTruthy()
        expect(info.rows.length).toEqual(2)
        done()
      })
    })

    it("handles offset", function(done) {
      this.User.findAndCountAll({offset: 1}).success(function(info) {
        expect(info.count).toEqual(3)
        expect(Array.isArray(info.rows)).toBeTruthy()
        expect(info.rows.length).toEqual(2)
        done()
      })
    })

    it("handles limit", function(done) {
      this.User.findAndCountAll({limit: 1}).success(function(info) {
        expect(info.count).toEqual(3)
        expect(Array.isArray(info.rows)).toBeTruthy()
        expect(info.rows.length).toEqual(1)
        done()
      })
    })

    it("handles offset and limit", function(done) {
      this.User.findAndCountAll({offset: 1, limit: 1}).success(function(info) {
        expect(info.count).toEqual(3)
        expect(Array.isArray(info.rows)).toBeTruthy()
        expect(info.rows.length).toEqual(1)
        done()
      })
    })
  })

  describe('all', function() {
    before(function(done) {
      this.User.bulkCreate([
        {username: 'user', data: 'foobar'},
        {username: 'user2', data: 'bar'}
      ]).complete(done)
    })

    it("should return all users", function(done) {
      this.User.all().on('success', function(users) {
        expect(users.length).toEqual(2)
        done()
      })
    })
  })

  describe('equals', function() {
    it("correctly determines equality of objects", function(done) {
      this.User.create({username: 'hallo', data: 'welt'}).success(function(u) {
        expect(u.equals(u)).toBeTruthy()
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
            expect(u.equals(u)).toBeTruthy()
            done()
          })
        })
      })
    }
  })

  describe('equalsOneOf', function() {
    // sqlite can't handle multiple primary keys
    if (dialect !== "sqlite") {
      before(function(done) {
        this.userKey = this.sequelize.define('userKeys', {
          foo: {type: Sequelize.STRING, primaryKey: true},
          bar: {type: Sequelize.STRING, primaryKey: true},
          name: Sequelize.STRING,
          bio: Sequelize.TEXT
        })

        this.userKey.sync({ force: true }).success(done)
      })

      it('determines equality if one is matching', function(done) {
        this.userKey.create({foo: '1', bar: '2', name: 'hallo', bio: 'welt'}).success(function(u) {
          expect(u.equalsOneOf([u, {a: 1}])).toBeTruthy()
          done()
        })
      })

      it("doesn't determine equality if none is matching", function(done) {
        this.userKey.create({foo: '1', bar: '2', name: 'hallo', bio: 'welt'}).success(function(u) {
          expect(u.equalsOneOf([{b: 2}, {a: 1}])).toBeFalsy()
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
          expect(count).toEqual(2)
          done()
        })
      })
    })

    it('allows sql logging', function(done) {
      this.User.count().on('sql', function(sql) {
        expect(sql).toBeDefined()
        expect(sql.toUpperCase().indexOf("SELECT")).toBeGreaterThan(-1)
        done()
      })
    })

    it('filters object', function(done) {
      var self = this
      this.User.create({username: 'user1'}).success(function() {
        self.User.create({username: 'foo'}).success(function() {
          self.User.count({where: "username LIKE '%us%'"}).success(function(count) {
            expect(count).toEqual(1)
            done()
          })
        })
      })
    })
  })

  describe('min', function() {
    before(function(done) {
      var self = this
      this.UserWithAge = this.sequelize.define('UserWithAge', {
        age: Sequelize.INTEGER
      })

      this.UserWithDec = this.sequelize.define('UserWithDec', {
        value: Sequelize.DECIMAL(10, 3)
      })

      this.UserWithAge.sync({ force: true }).success(function(){
        self.UserWithDec.sync({ force: true }).success(done)
      })
    })

    it("should return the min value", function(done) {
      var self = this
      this.UserWithAge.bulkCreate([{age: 3}, { age: 2 }]).success(function() {
        self.UserWithAge.min('age').success(function(min) {
          expect(min).toEqual(2)
          done()
        })
      })
    })

    it('allows sql logging', function(done) {
      this.UserWithAge.min('age').on('sql', function(sql) {
        expect(sql).toBeDefined()
        expect(sql.toUpperCase().indexOf("SELECT")).toBeGreaterThan(-1)
        done()
      })
    })

    it("should allow decimals in min", function(done){
      var self = this
      this.UserWithDec.bulkCreate([{value: 5.5}, {value: 3.5}]).success(function(){
        self.UserWithDec.min('value').success(function(min){
          expect(min).toEqual(3.5)
          done()
        })
      })
    })
  })

  describe('max', function() {
    before(function(done) {
      var self = this
      this.UserWithAge = this.sequelize.define('UserWithAge', {
        age: Sequelize.INTEGER,
        order: Sequelize.INTEGER
      })

      this.UserWithDec = this.sequelize.define('UserWithDec', {
        value: Sequelize.DECIMAL(10, 3)
      })

      this.UserWithAge.sync({ force: true }).success(function(){
        self.UserWithDec.sync({ force: true }).success(done)
      })
    })

    it("should return the max value for a field named the same as an SQL reserved keyword", function(done) {
      var self = this
      this.UserWithAge.bulkCreate([{age: 2, order: 3}, {age: 3, order: 5}]).success(function(){
        self.UserWithAge.max('order').success(function(max) {
          expect(max).toEqual(5)
          done()
        })
      })
    })

    it("should return the max value", function(done) {
      var self = this
      self.UserWithAge.bulkCreate([{age: 2}, {age: 3}]).success(function() {
        self.UserWithAge.max('age').success(function(max) {
          expect(max).toEqual(3)
          done()
        })
      })
    })

    it("should allow decimals in max", function(done) {
      var self = this
      this.UserWithDec.bulkCreate([{value: 3.5}, {value: 5.5}]).success(function(){
        self.UserWithDec.max('value').success(function(max){
          expect(max).toEqual(5.5)
          done()
        })
      })
    })

    it('allows sql logging', function(done) {
      this.UserWithAge.max('age').on('sql', function(sql) {
        expect(sql).toBeDefined()
        expect(sql.toUpperCase().indexOf("SELECT")).toBeGreaterThan(-1)
        done()
      })
    })
  })

  describe('schematic support', function() {
    before(function(done){
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
            self.UserSpecial.schema('special').sync({force: true}).success(function(UserSpecialSync){
              self.UserSpecialSync = UserSpecialSync;
              done()
            })
          })
        })
      })
    })

    it("should be able to list schemas", function(done){
      this.sequelize.showAllSchemas().success(function(schemas){
        expect(schemas).toBeDefined()
        expect(schemas[0]).toBeArray()
        expect(schemas[0].length).toEqual(2)
        done()
      })
    })

    if (dialect === "mysql") {
      it("should take schemaDelimiter into account if applicable", function(done){
        var UserSpecialUnderscore = this.sequelize.define('UserSpecialUnderscore', {age: Sequelize.INTEGER}, {schema: 'hello', schemaDelimiter: '_'})
        var UserSpecialDblUnderscore = this.sequelize.define('UserSpecialDblUnderscore', {age: Sequelize.INTEGER})
        UserSpecialUnderscore.sync({force: true}).success(function(User){
          UserSpecialDblUnderscore.schema('hello', '__').sync({force: true}).success(function(DblUser){
            DblUser.create({age: 3}).on('sql', function(dblSql){
              User.create({age: 3}).on('sql', function(sql){
                expect(dblSql).toBeDefined()
                expect(dblSql.indexOf('INSERT INTO `hello__UserSpecialDblUnderscores`')).toBeGreaterThan(-1)
                expect(sql).toBeDefined()
                expect(sql.indexOf('INSERT INTO `hello_UserSpecialUnderscores`')).toBeGreaterThan(-1)
                done()
              })
            })
          })
        })
      })
    }

    it("should be able to create and update records under any valid schematic", function(done){
      var self = this

      self.UserPublic.sync({ force: true }).success(function(UserPublicSync){
        UserPublicSync.create({age: 3}).on('sql', function(UserPublic){
          self.UserSpecialSync.schema('special').create({age: 3})
          .on('sql', function(UserSpecial){
            expect(UserSpecial).toBeDefined()
            expect(UserPublic).toBeDefined()
            if (dialect === "postgres") {
              expect(self.UserSpecialSync.getTableName()).toEqual('"special"."UserSpecials"');
              expect(UserSpecial.indexOf('INSERT INTO "special"."UserSpecials"')).toBeGreaterThan(-1)
              expect(UserPublic.indexOf('INSERT INTO "UserPublics"')).toBeGreaterThan(-1)
            } else if (dialect === "sqlite") {
              expect(self.UserSpecialSync.getTableName()).toEqual('`special`.`UserSpecials`');
              expect(UserSpecial.indexOf('INSERT INTO `special.UserSpecials`')).toBeGreaterThan(-1)
              expect(UserPublic.indexOf('INSERT INTO `UserPublics`')).toBeGreaterThan(-1)
            } else {
              expect(self.UserSpecialSync.getTableName()).toEqual('`special.UserSpecials`');
              expect(UserSpecial.indexOf('INSERT INTO `special.UserSpecials`')).toBeGreaterThan(-1)
              expect(UserPublic.indexOf('INSERT INTO `UserPublics`')).toBeGreaterThan(-1)
            }
          })
          .success(function(UserSpecial){
            UserSpecial.updateAttributes({age: 5})
            .on('sql', function(user){
              expect(user).toBeDefined()
              if (dialect === "postgres") {
                expect(user.indexOf('UPDATE "special"."UserSpecials"')).toBeGreaterThan(-1)
              } else {
                expect(user.indexOf('UPDATE `special.UserSpecials`')).toBeGreaterThan(-1)
              }
              done()
            })
          })
        })
      })
    })
  })

  describe('references', function() {
    before(function(done) {
      this.Author = this.sequelize.define('author', { firstName: Sequelize.STRING })
      done()
    })

    describe("use of existing dao factory", function() {
      before(function(done) {
        this.Post = this.sequelize.define('post', {
          title:    Sequelize.STRING,
          authorId: {
            type:          Sequelize.INTEGER,
            references:    this.Author,
            referencesKey: "id"
          }
        })

        this.Author.hasMany(this.Post)
        this.Post.belongsTo(this.Author)
        done()
      })

      it('references the author table', function(done) {
        var self = this
        this.Author.sync({ force: true }).success(function() {
          self.Post.sync({ force: true }).on('sql', function(sql) {
            if (dialect === 'postgres') {
              expect(sql).toMatch(/"authorId" INTEGER REFERENCES "authors" \("id"\)/)
            } else if (dialect === 'mysql') {
              expect(sql).toMatch(/FOREIGN KEY \(`authorId`\) REFERENCES `authors` \(`id`\)/)
            } else if (dialect === 'sqlite') {
              expect(sql).toMatch(/`authorId` INTEGER REFERENCES `authors` \(`id`\)/)
            } else {
              throw new Error('Undefined dialect!')
            }

            done()
          })
        })
      })
    })

    describe('use of table name as string', function() {
      before(function(done) {
        this.Post = this.sequelize.define('post', {
          title:    Sequelize.STRING,
          authorId: {
            type:          Sequelize.INTEGER,
            references:    'authors',
            referencesKey: "id"
          }
        })

        this.Author.hasMany(this.Post)
        this.Post.belongsTo(this.Author)
        done()
      })

      it('references the author table', function(done) {
        var self = this
        this.Author.sync({ force: true }).success(function() {
          self.Post.sync({ force: true }).on('sql', function(sql) {
            if (dialect === 'postgres') {
              expect(sql).toMatch(/"authorId" INTEGER REFERENCES "authors" \("id"\)/)
            } else if (dialect === 'mysql') {
              expect(sql).toMatch(/FOREIGN KEY \(`authorId`\) REFERENCES `authors` \(`id`\)/)
            } else if (dialect === 'sqlite') {
              expect(sql).toMatch(/`authorId` INTEGER REFERENCES `authors` \(`id`\)/)
            } else {
              throw new Error('Undefined dialect!')
            }

            done()
          })
        })
      })
    })

    describe('use of invalid table name', function() {
      before(function(done) {
        this.Post = this.sequelize.define('post', {
          title:    Sequelize.STRING,
          authorId: {
            type:          Sequelize.INTEGER,
            references:    '4uth0r5',
            referencesKey: "id"
          }
        })

        this.Author.hasMany(this.Post)
        this.Post.belongsTo(this.Author)
        done()
      })

      it("emits the error event as the referenced table name is invalid", function(done) {
        this.timeout = 2500
        var self = this
        this.Author.sync({ force: true }).success(function() {
          self.Post.sync({ force: true }).success(function() {
            if (dialect === 'sqlite') {
              // sorry ... but sqlite is too stupid to understand whats going on ...
              expect(1).toEqual(1)
              done()
            } else {
              // the parser should not end up here ...
              expect(2).toEqual(1)
            }
          }).error(function(err) {
            if (dialect === 'mysql') {
              expect(err.message).toMatch(/ER_CANNOT_ADD_FOREIGN/)
            } else if (dialect === 'sqlite') {
              // the parser should not end up here ... see above
              expect(1).toEqual(2)
            } else if (dialect === 'postgres') {
              expect(err.message).toMatch(/relation "4uth0r5" does not exist/)
            } else {
              throw new Error('Undefined dialect!')
            }

            done()
          })
        })
      })
    })
  })
})
