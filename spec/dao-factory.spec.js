if(typeof require === 'function') {
  const buster    = require("buster")
      , Sequelize = require("../index")
      , Helpers   = require('./buster-helpers')
      , _         = require('lodash')
      , dialect   = Helpers.getTestDialect()
}

buster.spec.expose()
buster.testRunner.timeout = 1000

describe(Helpers.getTestDialectTeaser("DAOFactory"), function() {
  before(function(done) {
    Helpers.initTests({
      dialect: dialect,
      beforeComplete: function(sequelize, DataTypes) {
        this.sequelize = sequelize
        this.User      = sequelize.define('User', {
          username:     DataTypes.STRING,
          secretValue:  DataTypes.STRING,
          data:         DataTypes.STRING
        })
      }.bind(this),
      onComplete: function() {
        this.User.sync({ force: true }).success(done)
      }.bind(this)
    })
  })

  describe('constructor', function() {
    it("uses the passed dao name as tablename if freezeTableName", function() {
      var User = this.sequelize.define('FrozenUser', {}, { freezeTableName: true })
      expect(User.tableName).toEqual('FrozenUser')
    })

    it("uses the pluralized dao name as tablename unless freezeTableName", function() {
      var User = this.sequelize.define('SuperUser', {}, { freezeTableName: false })
      expect(User.tableName).toEqual('SuperUsers')
    })

    it("uses checks to make sure dao factory isnt leaking on multiple define", function() {
      var User = this.sequelize.define('SuperUser', {}, { freezeTableName: false })
      var factorySize = this.sequelize.daoFactoryManager.all.length

      var User2 = this.sequelize.define('SuperUser', {}, { freezeTableName: false })
      var factorySize2 = this.sequelize.daoFactoryManager.all.length

      expect(factorySize).toEqual(factorySize2)
    })

    it("attaches class and instance methods", function() {
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
    })

    it("throws an error if 2 autoIncrements are passed", function() {
      Helpers.assertException(function() {
        this.sequelize.define('UserWithTwoAutoIncrements', {
          userid:    { type: Sequelize.INTEGER, primaryKey: true, autoIncrement: true },
          userscore: { type: Sequelize.INTEGER, primaryKey: true, autoIncrement: true }
        })
      }.bind(this), 'Invalid DAO definition. Only one autoincrement field allowed.')
    })

    it('throws an error if a custom model-wide validation is not a function', function() {
      Helpers.assertException(function() {
        this.sequelize.define('Foo', {
          field: {
            type: Sequelize.INTEGER
          }
        }, {
          validate: {
            notFunction: 33
          }
        })
      }.bind(this), 'Members of the validate option must be functions. Model: Foo, error with validate member notFunction')
    })

    it('throws an error if a custom model-wide validation has the same name as a field', function() {
      Helpers.assertException(function() {
        this.sequelize.define('Foo', {
          field: {
            type: Sequelize.INTEGER
          }
        }, {
          validate: {
            field: function() {}
          }
        })
      }.bind(this), 'A model validator function must not have the same name as a field. Model: Foo, field/validation name: field')
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

    it("fills the objects with default values", function() {
      var Task = this.sequelize.define('Task', {
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
    })

    it("fills the objects with default values", function() {
      var Task = this.sequelize.define('Task', {
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
    })

    it("stores the the passed values in a special variable", function() {
      var user = this.User.build({ username: 'John Wayne' })
      expect(user.selectedValues).toEqual({ username: 'John Wayne' })
    })

    it("attaches getter and setter methods from attribute definition", function() {
      var Product = this.sequelize.define('ProductWithSettersAndGetters1', {
        price: {
          type: Sequelize.INTEGER,
          get : function() {
            return 'answer = ' + this.getDataValue('price');
          },
          set : function(v) {
            return this.setDataValue('price', v + 42);
          }
        }
      },{
      });

      expect(Product.build({price: 42}).price).toEqual('answer = 84');

      var p = Product.build({price: 1});

      expect(p.price).toEqual('answer = 43');

      p.price = 0;

      expect(p.price).toEqual('answer = 42'); // ah finally the right answer :-)
    })

    it("attaches getter and setter methods from options", function() {
      var Product = this.sequelize.define('ProductWithSettersAndGetters2', {
        priceInCents: {
          type: Sequelize.INTEGER
        }
      },{
        setterMethods: {
          price: function(value) {
            this.dataValues.priceInCents = value * 100;
          }
        },
        getterMethods: {
          price: function() {
            return '$' + (this.getDataValue('priceInCents') / 100);
          },

          priceInCents: function() {
            return this.dataValues.priceInCents;
          }
        }
      });

      expect(Product.build({price: 20}).priceInCents).toEqual(20 * 100);
      expect(Product.build({priceInCents: 30 * 100}).price).toEqual('$' + 30);
    })

    it("attaches getter and setter methods from options only if not defined in attribute", function() {
      var Product = this.sequelize.define('ProductWithSettersAndGetters3', {
        price1: {
          type: Sequelize.INTEGER,
          set : function(v) { this.setDataValue('price1', v * 10); }
        },
        price2: {
          type: Sequelize.INTEGER,
          get : function(v) { return this.getDataValue('price2') * 10; }
        }
      },{
        setterMethods: {
          price1: function(v) { this.setDataValue('price1', v * 100); }
        },
        getterMethods: {
          price2: function() { return '$' + this.getDataValue('price2'); }
        }
      });

      var p = Product.build({ price1: 1, price2: 2 });

      expect(p.price1).toEqual(10);
      expect(p.price2).toEqual(20);
    })
  })

  describe('findOrCreate', function () {
    it("Returns instace if already existent. Single find field.", function (done) {
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

    it("Returns instace if already existent. Multiple find fields.", function (done) {
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

    it("creates new instance with default value.", function (done) {
      var self = this,
        data = {
          username: 'Username'
        },
        default_values = {
          data: 'ThisIsData'
        };

      this.User.findOrCreate(data, default_values).success(function (user, created) {
        expect(user.username).toEqual('Username')
        expect(user.data).toEqual('ThisIsData')
        expect(created).toBeTrue()

        done()
      })
    })
  })

  describe('create', function() {
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
      var User = this.sequelize.define('UserWithNonNullSmth', {
        username: { type: Sequelize.STRING, unique: true },
        smth:     { type: Sequelize.STRING, allowNull: false }
      })

      User.sync({ force: true }).success(function() {
        User.create({ username: 'foo', smth: null }).error(function(err) {
          expect(err).toBeDefined()

          Helpers.checkMatchForDialects(dialect, err.message, {
            sqlite: /.*SQLITE_CONSTRAINT.*/,
            mysql: "Column 'smth' cannot be null",
            postgres: /.*column "smth" violates not-null.*/
          })

          User.create({ username: 'foo', smth: 'foo' }).success(function() {
            User.create({ username: 'foo', smth: 'bar' }).error(function(err) {
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

    it('raises an error if you mess up the datatype', function() {
      Helpers.assertException(function() {
        this.sequelize.define('UserBadDataType', {
          activity_date: Sequelize.DATe
        })
      }.bind(this), 'Unrecognized data type for field activity_date')

      Helpers.assertException(function() {
        this.sequelize.define('UserBadDataType', {
          activity_date: {type: Sequelize.DATe}
        })
      }.bind(this), 'Unrecognized data type for field activity_date')
    })

    it('sets a 64 bit int in bigint', function(done) {
      var User = this.sequelize.define('UserWithBigIntFields', {
        big: Sequelize.BIGINT
      })

      User.sync({ force: true }).success(function() {
        User.create({ big: '9223372036854775807' }).on('success', function(user) {
          expect(user.big).toEqual( '9223372036854775807' )
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

      dataTypes.forEach(function(dataType, index) {
        var Book = self.sequelize.define('Book'+index, {
          id: { type: dataType, primaryKey: true, autoIncrement: true },
          title: Sequelize.TEXT
        })
        Book.sync({ force: true }).success(function() {
          Book
            .create(data)
            .success(function(book) {
              expect(book.title).toEqual(data.title)
              expect(book.author).toEqual(data.author)
              expect(Book.rawAttributes.id.type.toString())
                .toEqual(dataTypes[index].toString())

              Book.drop()
              if (index >= dataTypes.length - 1) {
                done()
              }
            })
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
        expect(parseInt(+user.createdAt/5000)).toEqual(parseInt(+new Date()/5000))
        done()
      })
    })

    describe('enums', function() {
      before(function(done) {
        this.Item = this.sequelize.define('Item', {
          state: { type: Helpers.Sequelize.ENUM, values: ['available', 'in_cart', 'shipped'] }
        })

        this.sequelize.sync({ force: true }).success(function() {
          this.Item.create({ state: 'available' }).success(function(item) {
            this.item = item
            done()
          }.bind(this))
        }.bind(this))
      })

      it('correctly restores enum values', function(done) {
        this.Item.find({ where: { state: 'available' }}).success(function(item) {
          expect(item.id).toEqual(this.item.id)
          done()
        }.bind(this))
      })
    })
  })

  describe('bulkCreate', function() {

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
          expect(parseInt(+users[0].createdAt/5000)).toEqual(parseInt(+new Date()/5000))

          expect(users[1].username).toEqual("Paul")
          expect(parseInt(+users[1].createdAt/5000)).toEqual(parseInt(+new Date()/5000))

          done()
        })
      })
    })

    describe('enums', function() {
      before(function(done) {
        this.Item = this.sequelize.define('Item', {
          state: { type: Helpers.Sequelize.ENUM, values: ['available', 'in_cart', 'shipped'] },
          name: Sequelize.STRING
        })

        this.sequelize.sync({ force: true }).success(function() {
          this.Item.bulkCreate([{state: 'in_cart', name: 'A'}, { state: 'available', name: 'B'}]).success(function() {
            done()
          }.bind(this))
        }.bind(this))
      })

      it('correctly restores enum values', function(done) {
        this.Item.find({ where: { state: 'available' }}).success(function(item) {
          expect(item.name).toEqual('B')
          done()
        }.bind(this))
      })
    })

  }) // - bulkCreate

  describe('update', function() {

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

        self.User.update({username: 'Bill'}, {secretValue: '42'})
          .success(function() {
            self.User.findAll({order: 'id'}).success(function(users) {
              expect(users.length).toEqual(3)

              expect(users[0].username).toEqual("Bill")
              expect(users[1].username).toEqual("Bill")
              expect(users[2].username).toEqual("Bob")

              expect(parseInt(+users[0].updatedAt/5000)).toEqual(parseInt(+new Date()/5000))
              expect(parseInt(+users[1].updatedAt/5000)).toEqual(parseInt(+new Date()/5000))

              done()
            })
          })
      })
    })

  }) // - update

  describe('destroy', function() {

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

      var self = this
        , User = this.sequelize.define('ParanoidUser', {
            username:     Sequelize.STRING,
            secretValue:  Sequelize.STRING,
            data:         Sequelize.STRING
          }, {
            paranoid: true
          })
        , data = [{ username: 'Peter', secretValue: '42' },
                  { username: 'Paul',  secretValue: '42' },
                  { username: 'Bob',   secretValue: '43' }]

      User.sync({ force: true }).success(function() {

        User.bulkCreate(data).success(function() {

          User.destroy({secretValue: '42'})
            .success(function() {
              User.findAll({order: 'id'}).success(function(users) {
                expect(users.length).toEqual(3)

                expect(users[0].username).toEqual("Peter")
                expect(users[1].username).toEqual("Paul")
                expect(users[2].username).toEqual("Bob")

                expect(parseInt(+users[0].deletedAt/5000)).toEqual(parseInt(+new Date()/5000))
                expect(parseInt(+users[1].deletedAt/5000)).toEqual(parseInt(+new Date()/5000))

                done()
              })
            })
        })

      })

    })

  }) // - destroy

  describe('find', function find() {
    before(function(done) {
      this.User.create({
        username: 'barfooz'
      }).success(function(user) {
        this.user = user
        done()
      }.bind(this))
    })

    it('returns a single dao', function(done) {
      this.User.find(this.user.id).success(function(user) {
        expect(Array.isArray(user)).toBeFalsy()
        expect(user.id).toEqual(this.user.id)
        expect(user.id).toEqual(1)
        done()
      }.bind(this))
    })

    it('returns a single dao given a string id', function(done) {
      this.User.find(this.user.id + '').success(function(user) {
        expect(Array.isArray(user)).toBeFalsy()
        expect(user.id).toEqual(this.user.id)
        expect(user.id).toEqual(1)
        done()
      }.bind(this))
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
      this.User.find({ where: { username: 'foo' } })
        .on('sql', function(sql) {
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
      this.User.create({
        username: 'JohnXOXOXO'
      }).success(function() {
        this.User.find({
          where: { username: 'JohnXOXOXO' },
          attributes: ['username']
        }).success(function(user) {
          expect(user.selectedValues).toEqual({ username: 'JohnXOXOXO' })
          done()
        })
      }.bind(this))
    })

    it('returns the selected fields and all fields of the included table as instance.selectedValues', function(done) {
      this.Mission = this.sequelize.define('Mission', {
        title:  {type: Sequelize.STRING, defaultValue: 'a mission!!'},
        foo:    {type: Sequelize.INTEGER, defaultValue: 2},
      })

      this.Mission.belongsTo(this.User)
      this.User.hasMany(this.Mission)

      this.sequelize.sync({ force: true }).complete(function() {
        this.Mission.create()
        .success(function(mission) {
          this.User.create({
            username: 'John DOE'
          }).success(function(user) {
            mission.setUser(user)
            .success(function() {
              this.User.find({
                where: { username: 'John DOE' },
                attributes: ['username'],
                include: [this.Mission]
              }).success(function(user) {
                expect(user.selectedValues).toEqual({ username: 'John DOE' })
                done()
              })
            }.bind(this))
          }.bind(this))
        }.bind(this))
      }.bind(this))
    })

    it('always honors ZERO as primary key', function(_done) {
      var permutations = [
          0,
          '0',
          {where: {id: 0}},
          {where: {id: '0'}}
        ]
        , done = _.after(2 * permutations.length, _done);

      this.User.create({name: 'jack'}).success(function (jack) {
        this.User.create({name: 'jill'}).success(function (jill) {
          permutations.forEach(function(perm) {
            this.User.find(perm).done(function(err, user) {
              expect(err).toBeNull();
              expect(user).toBeNull();
              done();
            }).on('sql', function(s) {
              expect(s.indexOf(0)).not.toEqual(-1);
              done();
            })
          }.bind(this))
        }.bind(this))
      }.bind(this))
    })

    describe('eager loading', function() {
      before(function() {
        this.Task        = this.sequelize.define('Task', { title: Sequelize.STRING })
        this.Worker      = this.sequelize.define('Worker', { name: Sequelize.STRING })

        this.init = function(callback) {
          this.sequelize.sync({ force: true }).complete(function() {
            this.Worker.create({ name: 'worker' }).success(function(worker) {
              this.Task.create({ title: 'homework' }).success(function(task) {
                this.worker    = worker
                this.task      = task

                callback()
              }.bind(this))
            }.bind(this))
          }.bind(this))
        }.bind(this)
      })

      describe('belongsTo', function() {
        before(function(done) {
          this.Task.belongsTo(this.Worker)
          this.init(function() {
            this.task.setWorker(this.worker).success(done)
          }.bind(this))
        })

        it('throws an error about unexpected input if include contains a non-object', function() {
          Helpers.assertException(function() {
            this.Worker.find({ include: [ 1 ] })
          }.bind(this), 'Include unexpected. Element has to be either an instance of DAOFactory or an object.')
        })

        it('throws an error about missing attributes if include contains an object with daoFactory', function() {
          Helpers.assertException(function() {
            this.Worker.find({ include: [ { daoFactory: this.Worker } ] })
          }.bind(this), 'Include malformed. Expected attributes: daoFactory, as!')
        })

        it('throws an error if included DaoFactory is not associated', function() {
          Helpers.assertException(function() {
            this.Worker.find({ include: [ this.Task ] })
          }.bind(this), 'Task is not associated to Worker!')
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
          }.bind(this))
        })

        it('returns the private and public ip', function(done) {
          var Domain      = this.sequelize.define('Domain', { ip: Sequelize.STRING })
          var Environment = this.sequelize.define('Environment', { name: Sequelize.STRING })

          Environment
            .belongsTo(Domain, { as: 'PrivateDomain', foreignKey: 'privateDomainId' })
            .belongsTo(Domain, { as: 'PublicDomain', foreignKey: 'publicDomainId' })

          this.sequelize.sync({ force: true }).complete(function() {
            Domain.create({ ip: '192.168.0.1' }).success(function(privateIp) {
              Domain.create({ ip: '91.65.189.19' }).success(function(publicIp) {
                Environment.create({ name: 'environment' }).success(function(env) {
                  env.setPrivateDomain(privateIp).success(function() {
                    env.setPublicDomain(publicIp).success(function() {
                      Environment.find({
                        where:   { name: 'environment' },
                        include: [
                          { daoFactory: Domain, as: 'PrivateDomain' },
                          { daoFactory: Domain, as: 'PublicDomain' }
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

      describe('hasOne', function() {
        before(function(done) {
          this.Worker.hasOne(this.Task)

          this.sequelize.sync({ force: true }).complete(function() {
            this.Worker.create({ name: 'worker' }).success(function(worker) {
              this.Task.create({ title: 'homework' }).success(function(task) {
                this.worker  = worker
                this.task    = task

                this.worker.setTask(this.task).success(done)
              }.bind(this))
            }.bind(this))
          }.bind(this))
        })

        it('throws an error if included DaoFactory is not associated', function() {
          Helpers.assertException(function() {
            this.Task.find({ include: [ this.Worker ] })
          }.bind(this), 'Worker is not associated to Task!')
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
          }.bind(this))
        })
      })

      describe('hasOne with alias', function() {
        before(function(done) {
          this.Worker.hasOne(this.Task, { as: 'ToDo' })

          this.sequelize.sync({ force: true }).complete(function() {
            this.Worker.create({ name: 'worker' }).success(function(worker) {
              this.Task.create({ title: 'homework' }).success(function(task) {
                this.worker  = worker
                this.task    = task

                this.worker.setToDo(this.task).success(done)
              }.bind(this))
            }.bind(this))
          }.bind(this))
        })

        it('throws an error if included DaoFactory is not referenced by alias', function() {
          Helpers.assertException(function() {
            this.Worker.find({ include: [ this.Task ] })
          }.bind(this), 'Task is not associated to Worker!')
        })

        it('throws an error if alias is not associated', function() {
          Helpers.assertException(function() {
            this.Worker.find({ include: [ { daoFactory: this.Task, as: 'Work' } ] })
          }.bind(this), 'Task (Work) is not associated to Worker!')
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
          }.bind(this))
        })

        it('returns the associated task via worker.task when daoFactory is aliased with model', function(done) {
          this.Worker.find({
            where:   { name: 'worker' },
            include: [ { model: this.Task, as: 'ToDo' } ]
          }).complete(function(err, worker) {
            expect(worker.toDo.title).toEqual('homework')
            done()
          }.bind(this))
        })
      })

      describe('hasMany', function() {
        before(function(done) {
          this.Worker.hasMany(this.Task)

          this.sequelize.sync({ force: true }).complete(function() {
            this.Worker.create({ name: 'worker' }).success(function(worker) {
              this.Task.create({ title: 'homework' }).success(function(task) {
                this.worker  = worker
                this.task    = task

                this.worker.setTasks([ this.task ]).success(done)
              }.bind(this))
            }.bind(this))
          }.bind(this))
        })

        it('throws an error if included DaoFactory is not associated', function() {
          Helpers.assertException(function() {
            this.Task.find({ include: [ this.Worker ] })
          }.bind(this), 'Worker is not associated to Task!')
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
          }.bind(this))
        })
      })

      describe('hasMany with alias', function() {
        before(function(done) {
          this.Worker.hasMany(this.Task, { as: 'ToDos' })

          this.sequelize.sync({ force: true }).complete(function() {
            this.Worker.create({ name: 'worker' }).success(function(worker) {
              this.Task.create({ title: 'homework' }).success(function(task) {
                this.worker  = worker
                this.task    = task

                this.worker.setToDos([ this.task ]).success(done)
              }.bind(this))
            }.bind(this))
          }.bind(this))
        })

        it('throws an error if included DaoFactory is not referenced by alias', function() {
          Helpers.assertException(function() {
            this.Worker.find({ include: [ this.Task ] })
          }.bind(this), 'Task is not associated to Worker!')
        })

        it('throws an error if alias is not associated', function() {
          Helpers.assertException(function() {
            this.Worker.find({ include: [ { daoFactory: this.Task, as: 'Work' } ] })
          }.bind(this), 'Task (Work) is not associated to Worker!')
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
          }.bind(this))
        })

        it('returns the associated task via worker.task when daoFactory is aliased with model', function(done) {
          this.Worker.find({
            where:   { name: 'worker' },
            include: [ { model: this.Task, as: 'ToDos' } ]
          }).complete(function(err, worker) {
            expect(worker.toDos[0].title).toEqual('homework')
            done()
          }.bind(this))
        })
      })
    })

    describe('queryOptions', function() {
      before(function(done) {
        this.User.create({
          username: 'barfooz'
        }).success(function(user) {
          this.user = user
          done()
        }.bind(this))
      })

      it("should return a DAO when queryOptions are not set", function (done) {
        this.User.find({ where: { username: 'barfooz'}}).done(function (err, user) {
          expect(user).toHavePrototype(this.User.DAO.prototype)

          done();
        }.bind(this))
      })

      it("should return a DAO when raw is false", function (done) {
        this.User.find({ where: { username: 'barfooz'}}, { raw: false }).done(function (err, user) {
          expect(user).toHavePrototype(this.User.DAO.prototype)

          done();
        }.bind(this))
      })

      it("should return raw data when raw is true", function (done) {
        this.User.find({ where: { username: 'barfooz'}}, { raw: true }).done(function (err, user) {
          expect(user).not.toHavePrototype(this.User.DAO.prototype)
          expect(user).toBeObject()

          done();
        }.bind(this))
      })
    }) // - describe: queryOptions
  }) //- describe: find

  describe('findAll', function findAll() {
    describe('eager loading', function() {
      before(function() {
        this.Task     = this.sequelize.define('Task', { title: Sequelize.STRING })
        this.Worker   = this.sequelize.define('Worker', { name: Sequelize.STRING })
      })

      describe('belongsTo', function() {
        before(function(done) {
          this.Task.belongsTo(this.Worker)

          this.sequelize.sync({ force: true }).complete(function() {
            this.Worker.create({ name: 'worker' }).success(function(worker) {
              this.Task.create({ title: 'homework' }).success(function(task) {
                this.worker  = worker
                this.task    = task

                this.task.setWorker(this.worker).success(done)
              }.bind(this))
            }.bind(this))
          }.bind(this))
        })

        it('throws an error about unexpected input if include contains a non-object', function() {
          Helpers.assertException(function() {
            this.Worker.findAll({ include: [ 1 ] })
          }.bind(this), 'Include unexpected. Element has to be either an instance of DAOFactory or an object.')
        })

        it('throws an error about missing attributes if include contains an object with daoFactory', function() {
          Helpers.assertException(function() {
            this.Worker.findAll({ include: [ { daoFactory: this.Worker } ] })
          }.bind(this), 'Include malformed. Expected attributes: daoFactory, as!')
        })

        it('throws an error if included DaoFactory is not associated', function() {
          Helpers.assertException(function() {
            this.Worker.findAll({ include: [ this.Task ] })
          }.bind(this), 'Task is not associated to Worker!')
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
          }.bind(this))
        })
      })

      describe('hasOne', function() {
        before(function(done) {
          this.Worker.hasOne(this.Task)

          this.sequelize.sync({ force: true }).complete(function() {
            this.Worker.create({ name: 'worker' }).success(function(worker) {
              this.Task.create({ title: 'homework' }).success(function(task) {
                this.worker  = worker
                this.task    = task

                this.worker.setTask(this.task).success(done)
              }.bind(this))
            }.bind(this))
          }.bind(this))
        })

        it('throws an error if included DaoFactory is not associated', function() {
          Helpers.assertException(function() {
            this.Task.findAll({ include: [ this.Worker ] })
          }.bind(this), 'Worker is not associated to Task!')
        })

        it('returns the associated task via worker.task', function(done) {
          this.Worker.findAll({
            where:   { name: 'worker' },
            include: [ this.Task ]
          }).complete(function(err, workers) {
            expect(err).toBeNull()
            expect(workers).toBeDefined()
            expect(workers[0].task).toBeDefined()
            expect(workers[0].task.title).toEqual('homework')
            done()
          }.bind(this))
        })
      })

      describe('hasOne with alias', function() {
        before(function(done) {
          this.Worker.hasOne(this.Task, { as: 'ToDo' })

          this.sequelize.sync({ force: true }).complete(function() {
            this.Worker.create({ name: 'worker' }).success(function(worker) {
              this.Task.create({ title: 'homework' }).success(function(task) {
                this.worker  = worker
                this.task    = task

                this.worker.setToDo(this.task).success(done)
              }.bind(this))
            }.bind(this))
          }.bind(this))
        })

        it('throws an error if included DaoFactory is not referenced by alias', function() {
          Helpers.assertException(function() {
            this.Worker.findAll({ include: [ this.Task ] })
          }.bind(this), 'Task is not associated to Worker!')
        })

        it('throws an error if alias is not associated', function() {
          Helpers.assertException(function() {
            this.Worker.findAll({ include: [ { daoFactory: this.Task, as: 'Work' } ] })
          }.bind(this), 'Task (Work) is not associated to Worker!')
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
          }.bind(this))
        })

        it('returns the associated task via worker.task when daoFactory is aliased with model', function(done) {
          this.Worker.findAll({
            where:   { name: 'worker' },
            include: [ { model: this.Task, as: 'ToDo' } ]
          }).complete(function(err, workers) {
            expect(workers[0].toDo.title).toEqual('homework')
            done()
          }.bind(this))
        })
      })

      describe('hasMany', function() {
        before(function(done) {
          this.Worker.hasMany(this.Task)

          this.sequelize.sync({ force: true }).complete(function() {
            this.Worker.create({ name: 'worker' }).success(function(worker) {
              this.Task.create({ title: 'homework' }).success(function(task) {
                this.worker  = worker
                this.task    = task

                this.worker.setTasks([ this.task ]).success(done)
              }.bind(this))
            }.bind(this))
          }.bind(this))
        })

        it('throws an error if included DaoFactory is not associated', function() {
          Helpers.assertException(function() {
            this.Task.findAll({ include: [ this.Worker ] })
          }.bind(this), 'Worker is not associated to Task!')
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
          }.bind(this))
        })
      })

      describe('hasMany with alias', function() {
        before(function(done) {
          this.Worker.hasMany(this.Task, { as: 'ToDos' })

          this.sequelize.sync({ force: true }).complete(function() {
            this.Worker.create({ name: 'worker' }).success(function(worker) {
              this.Task.create({ title: 'homework' }).success(function(task) {
                this.worker  = worker
                this.task    = task

                this.worker.setToDos([ this.task ]).success(done)
              }.bind(this))
            }.bind(this))
          }.bind(this))
        })

        it('throws an error if included DaoFactory is not referenced by alias', function() {
          Helpers.assertException(function() {
            this.Worker.findAll({ include: [ this.Task ] })
          }.bind(this), 'Task is not associated to Worker!')
        })

        it('throws an error if alias is not associated', function() {
          Helpers.assertException(function() {
            this.Worker.findAll({ include: [ { daoFactory: this.Task, as: 'Work' } ] })
          }.bind(this), 'Task (Work) is not associated to Worker!')
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
          }.bind(this))
        })

        it('returns the associated task via worker.task when daoFactory is aliased with model', function(done) {
          this.Worker.findAll({
            where:   { name: 'worker' },
            include: [ { daoFactory: this.Task, as: 'ToDos' } ]
          }).complete(function(err, workers) {
            expect(workers[0].toDos[0].title).toEqual('homework')
            done()
          }.bind(this))
        })
      })

      describe('queryOptions', function() {
        before(function(done) {
          this.User.create({
            username: 'barfooz'
          }).success(function(user) {
            this.user = user
            done()
          }.bind(this))
        })

        it("should return a DAO when queryOptions are not set", function (done) {
          this.User.findAll({ where: { username: 'barfooz'}}).done(function (err, users) {
            users.forEach(function (user) {
              expect(user).toHavePrototype(this.User.DAO.prototype)
            }, this)


            done();
          }.bind(this))
        })

        it("should return a DAO when raw is false", function (done) {
          this.User.findAll({ where: { username: 'barfooz'}}, { raw: false }).done(function (err, users) {
            users.forEach(function (user) {
              expect(user).toHavePrototype(this.User.DAO.prototype)
            }, this)

            done();
          }.bind(this))
        })

        it("should return raw data when raw is true", function (done) {
          this.User.findAll({ where: { username: 'barfooz'}}, { raw: true }).done(function (err, users) {
            users.forEach(function (user) {
              expect(user).not.toHavePrototype(this.User.DAO.prototype)
              expect(users[0]).toBeObject()
            }, this)

            done();
          }.bind(this))
        })
      }) // - describe: queryOptions
    })
  }) //- describe: findAll

  describe('min', function() {
    before(function(done) {
      this.UserWithAge = this.sequelize.define('UserWithAge', {
        age: Sequelize.INTEGER
      })

      this.UserWithDec = this.sequelize.define('UserWithDec', {
        value: Sequelize.DECIMAL(10, 3)
      })

      this.UserWithAge.sync({ force: true }).success(function(){
        this.UserWithDec.sync({ force: true }).success(done)
      }.bind(this))
    })

    it("should return the min value", function(done) {
      this.UserWithAge.create({ age: 2 }).success(function() {
        this.UserWithAge.create({ age: 3 }).success(function() {
          this.UserWithAge.min('age').success(function(min) {
            expect(min).toEqual(2)
            done()
          })
        }.bind(this))
      }.bind(this))
    })

    it('allows sql logging', function(done) {
      this.UserWithAge.min('age').on('sql', function(sql) {
        expect(sql).toBeDefined()
        expect(sql.toUpperCase().indexOf("SELECT")).toBeGreaterThan(-1)
        done()
      })
    })

    it("should allow decimals in min", function(done){
      this.UserWithDec.create({value: 3.5}).success(function(){
        this.UserWithDec.create({ value: 5.5 }).success(function(){
          this.UserWithDec.min('value').success(function(min){
            expect(min).toEqual(3.5)
            done()
          })
        }.bind(this))
      }.bind(this))
    })
  }) //- describe: min

  describe('max', function() {
    before(function(done) {
      this.UserWithAge = this.sequelize.define('UserWithAge', {
        age: Sequelize.INTEGER
      })

      this.UserWithDec = this.sequelize.define('UserWithDec', {
        value: Sequelize.DECIMAL(10, 3)
      })

      this.UserWithAge.sync({ force: true }).success(function(){
        this.UserWithDec.sync({ force: true }).success(done)
      }.bind(this))
    })

    it("should return the max value", function(done) {
      this.UserWithAge.create({ age: 2 }).success(function() {
        this.UserWithAge.create({ age: 3 }).success(function() {
          this.UserWithAge.max('age').success(function(max) {
            expect(max).toEqual(3)
            done()
          })
        }.bind(this))
      }.bind(this))
    })

    it("should allow decimals in max", function(done){
      this.UserWithDec.create({value: 3.5}).success(function(){
        this.UserWithDec.create({ value: 5.5 }).success(function(){
          this.UserWithDec.max('value').success(function(max){
            expect(max).toEqual(5.5)
            done()
          })
        }.bind(this))
      }.bind(this))
    })

    it('allows sql logging', function(done) {
      this.UserWithAge.max('age').on('sql', function(sql) {
        expect(sql).toBeDefined()
        expect(sql.toUpperCase().indexOf("SELECT")).toBeGreaterThan(-1)
        done()
      })
    })
  }) //- describe: max

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
          }.bind(this))
        }.bind(this))
      }.bind(this))
    })
  })
})
