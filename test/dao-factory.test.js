/* jshint camelcase: false */
/* jshint expr: true */
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

    it('allows us us to predefine the ID column with our own specs', function(done) {
      var User = this.sequelize.define('UserCol', {
        id: {
          type: Sequelize.STRING,
          defaultValue: 'User',
          primaryKey: true
        }
      })

      User.sync({ force: true }).success(function() {
        User.create({id: 'My own ID!'}).success(function(user) {
          expect(user.id).to.equal('My own ID!')
          done()
        })
      })
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

    it('should allow me to set a default value for createdAt and updatedAt', function(done) {
      var UserTable = this.sequelize.define('UserCol', {
        aNumber: Sequelize.INTEGER,
        createdAt: {
          type: Sequelize.DATE,
          defaultValue: moment('2012-01-01').toDate()
        },
        updatedAt: {
          type: Sequelize.DATE,
          defaultValue: moment('2012-01-02').toDate()
        }
      }, { timestamps: true })

      UserTable.sync({ force: true }).success(function() {
        UserTable.create({aNumber: 5}).success(function(user) {
          UserTable.bulkCreate([
            {aNumber: 10},
            {aNumber: 12}
          ]).success(function() {
            UserTable.all({where: {aNumber: { gte: 10 }}}).success(function(users) {
              expect(moment(user.createdAt).format('YYYY-MM-DD')).to.equal('2012-01-01')
              expect(moment(user.updatedAt).format('YYYY-MM-DD')).to.equal('2012-01-02')
              users.forEach(function(u) {
                expect(moment(u.createdAt).format('YYYY-MM-DD')).to.equal('2012-01-01')
                expect(moment(u.updatedAt).format('YYYY-MM-DD')).to.equal('2012-01-02')
              })
              done()
            })
          })
        })
      })
    })

    it('should allow me to set a function as default value', function(done) {
      var defaultFunction = sinon.stub().returns(5)
      var UserTable = this.sequelize.define('UserCol', {
        aNumber: {
          type: Sequelize.INTEGER,
          defaultValue: defaultFunction
        }
      }, { timestamps: true })

      UserTable.sync({ force: true }).success(function() {
        UserTable.create().success(function(user) {
            UserTable.create().success(function(user2) {
              expect(user.aNumber).to.equal(5)
              expect(user2.aNumber).to.equal(5)
              expect(defaultFunction.callCount).to.equal(2)
              done()
            })
          })
      })
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

    it('should work with both paranoid and underscored being true', function(done) {
      var UserTable = this.sequelize.define('UserCol', {
        aNumber: Sequelize.INTEGER
      }, {
        paranoid: true,
        underscored: true
      })

      UserTable.sync({force: true}).success(function() {
        UserTable.create({aNumber: 30}).success(function(user) {
          UserTable.count().success(function(c) {
            expect(c).to.equal(1)
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

    it("stores the passed values in a special variable", function(done) {
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

    describe('include', function () {
      it('should support basic includes', function () {
        var Product = this.sequelize.define('Product', {
          title: Sequelize.STRING
        })
        var Tag = this.sequelize.define('Tag', {
          name: Sequelize.STRING
        })
        var User = this.sequelize.define('User', {
          first_name: Sequelize.STRING,
          last_name: Sequelize.STRING
        })

        Product.hasMany(Tag)
        Product.belongsTo(User)

        var product = Product.build({
          id: 1,
          title: 'Chair',
          tags: [
            {id: 1, name: 'Alpha'},
            {id: 2, name: 'Beta'}
          ],
          user: {
            id: 1,
            first_name: 'Mick',
            last_name: 'Hansen'
          }
        }, {
          include: [
            User,
            Tag
          ]
        })

        expect(product.tags).to.be.ok
        expect(product.tags.length).to.equal(2)
        expect(product.tags[0].Model).to.equal(Tag)
        expect(product.user).to.be.ok
        expect(product.user.Model).to.equal(User)
      })

      it('should support includes with aliases', function () {
        var Product = this.sequelize.define('Product', {
          title: Sequelize.STRING
        })
        var Tag = this.sequelize.define('Tag', {
          name: Sequelize.STRING
        })
        var User = this.sequelize.define('User', {
          first_name: Sequelize.STRING,
          last_name: Sequelize.STRING
        })

        Product.hasMany(Tag, {as: 'Categories'})
        Product.hasMany(User, {as: 'Followers', through: 'product_followers'})
        User.hasMany(Product, {as: 'Following', through: 'product_followers'})

        var product = Product.build({
          id: 1,
          title: 'Chair',
          categories: [
            {id: 1, name: 'Alpha'},
            {id: 2, name: 'Beta'},
            {id: 3, name: 'Charlie'},
            {id: 4, name: 'Delta'}
          ],
          followers: [
            {
              id: 1,
              first_name: 'Mick',
              last_name: 'Hansen'
            },
            {
              id: 2,
              first_name: 'Jan',
              last_name: 'Meier'
            }
          ]
        }, {
          include: [
            {model: User, as: 'Followers'},
            {model: Tag, as: 'Categories'}
          ]
        })

        expect(product.categories).to.be.ok
        expect(product.categories.length).to.equal(4)
        expect(product.categories[0].Model).to.equal(Tag)
        expect(product.followers).to.be.ok
        expect(product.followers.length).to.equal(2)
        expect(product.followers[0].Model).to.equal(User)
      })
    })
  })

  describe('find', function() {
    it('supports the transaction option in the first parameter', function(done) {
      Support.prepareTransactionTest(this.sequelize, function(sequelize) {
        var User = sequelize.define('User', { username: Sequelize.STRING, foo: Sequelize.STRING })

        User.sync({ force: true }).success(function() {
          sequelize.transaction(function(t) {
            User.create({ username: 'foo' }, { transaction: t }).success(function() {
              User.find({ where: { username: 'foo' }, transaction: t }).success(function(user) {
                expect(user).to.not.be.null
                t.rollback().success(function() { done() })
              })
            })
          })
        })
      })
    })
  })

  describe('findOrInitialize', function() {
    it('supports transactions', function(done) {
      Support.prepareTransactionTest(this.sequelize, function(sequelize) {
        var User = sequelize.define('User', { username: Sequelize.STRING, foo: Sequelize.STRING })

        User.sync({ force: true }).success(function() {
          sequelize.transaction(function(t) {
            User.create({ username: 'foo' }, { transaction: t }).success(function() {
              User.findOrInitialize({ username: 'foo' }).success(function(user1) {
                User.findOrInitialize({ username: 'foo' }, { transaction: t }).success(function(user2) {
                  User.findOrInitialize({ username: 'foo' }, { foo: 'asd' }, { transaction: t }).success(function(user3) {
                    expect(user1.isNewRecord).to.be.true
                    expect(user2.isNewRecord).to.be.false
                    expect(user3.isNewRecord).to.be.false
                    t.commit().success(function() { done() })
                  })
                })
              })
            })
          })
        })
      })
    })

    describe('returns an instance if it already exists', function() {
      it('with a single find field', function (done) {
        var self = this

        this.User.create({ username: 'Username' }).success(function (user) {
          self.User.findOrInitialize({
            username: user.username
          }).success(function (_user, initialized) {
            expect(_user.id).to.equal(user.id)
            expect(_user.username).to.equal('Username')
            expect(initialized).to.be.false
            done()
          })
        })
      })

      it('with multiple find fields', function(done) {
        var self = this

        this.User.create({ username: 'Username', data: 'data' }).success(function (user) {
          self.User.findOrInitialize({
            username: user.username,
            data: user.data
          }).success(function (_user, initialized) {
            expect(_user.id).to.equal(user.id)
            expect(_user.username).to.equal('Username')
            expect(_user.data).to.equal('data')
            expect(initialized).to.be.false
            done()
          })
        })
      })

      it('builds a new instance with default value.', function(done) {
        var data = {
            username: 'Username'
          },
          default_values = {
            data: 'ThisIsData'
          }

        this.User.findOrInitialize(data, default_values).success(function(user, initialized) {
          expect(user.id).to.be.null
          expect(user.username).to.equal('Username')
          expect(user.data).to.equal('ThisIsData')
          expect(initialized).to.be.true
          expect(user.isNewRecord).to.be.true
          expect(user.isDirty).to.be.true
          done()
        })
      })
    })
  })

  describe('update', function() {
    it('supports transactions', function(done) {
      Support.prepareTransactionTest(this.sequelize, function(sequelize) {
        var User = sequelize.define('User', { username: Sequelize.STRING })

        User.sync({ force: true }).done(function() {
          User.create({ username: 'foo' }).done(function() {
            sequelize.transaction(function(t) {
              User.update({ username: 'bar' }, {}, { transaction: t }).done(function(err) {
                User.all().done(function(err, users1) {
                  User.all({ transaction: t }).done(function(err, users2) {
                    expect(users1[0].username).to.equal('foo')
                    expect(users2[0].username).to.equal('bar')
                    t.rollback().success(function(){ done() })
                  })
                })
              })
            })
          })
        })
      })
    })

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

    it('updates with casting', function (done) {
      var self = this

      this.User.create({
        username: 'John'
      }).success(function(user) {
        self.User.update({username: self.sequelize.cast('1', 'char')}, {username: 'John'}).success(function() {
          self.User.all().success(function(users) {
            expect(users[0].username).to.equal('1')
            done()
          })
        })
      })
    })

    it('updates with function and column value', function (done) {
      var self = this

      this.User.create({
        username: 'John'
      }).success(function(user) {
        self.User.update({username: self.sequelize.fn('upper', self.sequelize.col('username'))}, {username: 'John'}).success(function () {
          self.User.all().success(function(users) {
            expect(users[0].username).to.equal('JOHN')
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
        self.User.update({username: 'Bill'}, {secretValue: '42'}).done(function(err) {
          console.log(err)
          expect(err).not.to.be.ok
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
    it('supports transactions', function(done) {
      Support.prepareTransactionTest(this.sequelize, function(sequelize) {
        var User = sequelize.define('User', { username: Sequelize.STRING })

        User.sync({ force: true }).success(function() {
          User.create({ username: 'foo' }).success(function() {
            sequelize.transaction(function(t) {
              User.destroy({}, { transaction: t }).success(function() {
                User.count().success(function(count1) {
                  User.count({ transaction: t }).success(function(count2) {
                    expect(count1).to.equal(1)
                    expect(count2).to.equal(0)
                    t.rollback().success(function(){ done() })
                  })
                })
              })
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
        , ident = self.sequelize.queryInterface.QueryGenerator.quoteIdentifier
        , escape = self.sequelize.queryInterface.QueryGenerator.quote
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
          // since we save in UTC, let's format to UTC time
          var date = moment().utc().format('YYYY-MM-DD h:mm')
          ParanoidUser.destroy({secretValue: '42'}).success(function() {
            ParanoidUser.findAll({order: 'id'}).success(function(users) {
              expect(users.length).to.equal(1)
              expect(users[0].username).to.equal("Bob")

              self.sequelize.query('SELECT * FROM ' + ident('ParanoidUsers') + ' WHERE ' + ident('deletedAt') + ' IS NOT NULL ORDER BY ' + ident('id'), null, {raw: true}).success(function(users) {
                expect(users[0].username).to.equal("Peter")
                expect(users[1].username).to.equal("Paul")

                if (dialect === "sqlite") {
                  expect(moment(users[0].deletedAt).format('YYYY-MM-DD h:mm')).to.equal(date)
                  expect(moment(users[1].deletedAt).format('YYYY-MM-DD h:mm')).to.equal(date)
                } else {
                  expect(moment(users[0].deletedAt).utc().format('YYYY-MM-DD h:mm')).to.equal(date)
                  expect(moment(users[1].deletedAt).utc().format('YYYY-MM-DD h:mm')).to.equal(date)
                }
                done()
              })
            })
          })
        })
      })
    })

    describe("can't find records marked as deleted with paranoid being true", function() {
      it('with the DAOFactory', function(done) {
        var User = this.sequelize.define('UserCol', {
          username: Sequelize.STRING
        }, { paranoid: true })

        User.sync({ force: true }).success(function() {
          User.bulkCreate([
            {username: 'Toni'},
            {username: 'Tobi'},
            {username: 'Max'}
          ]).success(function() {
            User.find(1).success(function(user) {
              user.destroy().success(function() {
                User.find(1).success(function(user) {
                  expect(user).to.be.null
                  User.count().success(function(cnt) {
                    expect(cnt).to.equal(2)
                    User.all().success(function(users) {
                      expect(users).to.have.length(2)
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

    it('should delete a paranoid record if I set force to true', function(done) {
      var self = this
      var User = this.sequelize.define('paranoiduser', {
        username: Sequelize.STRING
      }, { paranoid: true })

      User.sync({ force: true }).success(function() {
        User.bulkCreate([
          {username: 'Bob'},
          {username: 'Tobi'},
          {username: 'Max'},
          {username: 'Tony'}
        ]).success(function() {
          User.find({where: {username: 'Bob'}}).success(function(user) {
            user.destroy({force: true}).success(function() {
              User.find({where: {username: 'Bob'}}).success(function(user) {
                expect(user).to.be.null
                User.find({where: {username: 'Tobi'}}).success(function(tobi) {
                  tobi.destroy().success(function() {
                    self.sequelize.query('SELECT * FROM paranoidusers WHERE username=\'Tobi\'', null, {raw: true, plain: true}).success(function(result) {
                      expect(result.username).to.equal('Tobi')
                      User.destroy({username: 'Tony'}).success(function() {
                        self.sequelize.query('SELECT * FROM paranoidusers WHERE username=\'Tony\'', null, {raw: true, plain: true}).success(function(result) {
                          expect(result.username).to.equal('Tony')
                          User.destroy({username: ['Tony', 'Max']}, {force: true}).success(function() {
                            self.sequelize.query('SELECT * FROM paranoidusers', null, {raw: true}).success(function(users) {
                              expect(users).to.have.length(1)
                              expect(users[0].username).to.equal('Tobi')
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
    it('supports transactions', function(done) {
      Support.prepareTransactionTest(this.sequelize, function(sequelize) {
        var User = sequelize.define('User', { username: Sequelize.STRING })

        User.sync({ force: true }).success(function() {
          sequelize.transaction(function(t) {
            User.create({ username: 'foo' }, { transaction: t }).success(function() {
              User.count().success(function(count1) {
                User.count({ transaction: t }).success(function(count2) {
                  expect(count1).to.equal(0)
                  expect(count2).to.equal(1)
                  t.rollback().success(function(){ done() })
                })
              })
            })
          })
        })
      })
    })

    it('counts all created objects', function(done) {
      var self = this
      this.User.bulkCreate([{username: 'user1'}, {username: 'user2'}]).success(function() {
        self.User.count().success(function(count) {
          expect(count).to.equal(2)
          done()
        })
      })
    })

    it('does not modify the passed arguments', function (done) {
      var options = { where: ['username = ?', 'user1']}

      this.User.count(options).success(function(count) {
        expect(options).to.deep.equal({ where: ['username = ?', 'user1']})
        done()
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

    it('supports transactions', function(done) {
      Support.prepareTransactionTest(this.sequelize, function(sequelize) {
        var User = sequelize.define('User', { age: Sequelize.INTEGER })

        User.sync({ force: true }).success(function() {
          sequelize.transaction(function(t) {
            User.bulkCreate([{ age: 2 }, { age: 5 }, { age: 3 }], { transaction: t }).success(function() {
              User.min('age').success(function(min1) {
                User.min('age', { transaction: t }).success(function(min2) {
                  expect(min1).to.be.not.ok
                  expect(min2).to.equal(2)
                  t.rollback().success(function(){ done() })
                })
              })
            })
          })
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

    it("should allow strings in min", function(done) {
      var self = this
      this.User.bulkCreate([{username: 'bbb'}, {username: 'yyy'}]).success(function(){
        self.User.min('username').success(function(min){
          expect(min).to.equal('bbb')
          done()
        })
      })
    })

    it("should allow dates in min", function(done){
      var self = this
      this.User.bulkCreate([{theDate: new Date(2000, 01, 01)}, {theDate: new Date(1990, 01, 01)}]).success(function(){
        self.User.min('theDate').success(function(min){
          expect(min).to.be.a('Date');
          expect(new Date(1990, 01, 01)).to.equalDate(min)
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

    it('supports transactions', function(done) {
      Support.prepareTransactionTest(this.sequelize, function(sequelize) {
        var User = sequelize.define('User', { age: Sequelize.INTEGER })

        User.sync({ force: true }).success(function() {
          sequelize.transaction(function(t) {
            User.bulkCreate([{ age: 2 }, { age: 5 }, { age: 3 }], { transaction: t }).success(function() {
              User.max('age').success(function(min1) {
                User.max('age', { transaction: t }).success(function(min2) {
                  expect(min1).to.be.not.ok
                  expect(min2).to.equal(5)
                  t.rollback().success(function(){ done() })
                })
              })
            })
          })
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

    it("should allow dates in max", function(done) {
      var self = this
      this.User.bulkCreate([{theDate: new Date(2013, 12, 31)}, {theDate: new Date(2000, 01, 01)}]).success(function(){
        self.User.max('theDate').success(function(max){
          expect(max).to.be.a('Date');
          expect(max).to.equalDate(new Date(2013, 12, 31))
          done()
        })
      })
    })

    it("should allow strings in max", function(done) {
      var self = this
      this.User.bulkCreate([{username: 'aaa'}, {username: 'zzz'}]).success(function(){
        self.User.max('username').success(function(max){
          expect(max).to.equal('zzz')
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
        expect(schemas[0]).to.have.length((dialect === "postgres" ? 2 : 1))
        done()
      })
    })

    if (Support.dialectIsMySQL() || dialect === "sqlite") {
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
            if (dialect === "sqlite" || Support.dialectIsMySQL()) {
              expect(sql).to.not.contain('special')
              _done()
            }
          })
          .success(function(table) {
            if (dialect === "postgres") {
              expect(table.id.defaultValue).to.not.contain('special')
              _done()
            }

            self.sequelize.queryInterface.describeTable('Publics', 'special')
            .on('sql', function(sql) {
              if (dialect === "sqlite" || Support.dialectIsMySQL()) {
                expect(sql).to.contain('special')
                _done()
              }
            })
            .success(function(table) {
              if (dialect === "postgres") {
                expect(table.id.defaultValue).to.contain('special')
                _done()
              }
            })
          })
        })
      })
    })

    it('should be able to reference a table with a schema set', function(done) {
      var self = this
      var sequelize = this.sequelize

      var UserPub = this.sequelize.define('UserPub', {
        username: Sequelize.STRING
      }, { schema: 'prefix' })

      var ItemPub = this.sequelize.define('ItemPub', {
        name: Sequelize.STRING
      }, { schema: 'prefix' })

      UserPub.hasMany(ItemPub, {
        foreignKeyConstraint: true
      })

      var run = function() {
        UserPub.sync({ force: true }).success(function() {
          ItemPub.sync({ force: true }).on('sql', function(sql) {
            if (dialect === "postgres") {
              expect(sql).to.match(/REFERENCES\s+"prefix"\."UserPubs" \("id"\)/)
            } else {
              expect(sql).to.match(/REFERENCES\s+`prefix\.UserPubs` \(`id`\)/)
            }
            done()
          })
        })
      }

      if (dialect === "postgres") {
        this.sequelize.queryInterface.createSchema('prefix').success(function() {
          run.call(self)
        })
      } else {
        run.call(self)
      }
    })

    it("should be able to create and update records under any valid schematic", function(done){
      var self = this

      self.UserPublic.sync({ force: true }).done(function(err, UserPublicSync){
        expect(err).not.to.be.ok
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
          .done(function(err, UserSpecial){
            expect(err).not.to.be.ok
            UserSpecial.updateAttributes({age: 5})
            .on('sql', function(user){
              expect(user).to.exist
              if (dialect === "postgres") {
                expect(user.indexOf('UPDATE "special"."UserSpecials"')).to.be.above(-1)
              } else {
                expect(user.indexOf('UPDATE `special.UserSpecials`')).to.be.above(-1)
              }
              done()
            }).error(function (err) {
              expect(err).not.to.be.ok
            })
          })
        }).error(function (err) {
          expect(err).not.to.be.ok
        })
      })
    })
  })

  describe('references', function() {
    beforeEach(function(done) {
      var self = this

      this.sequelize.getQueryInterface().dropTable('posts', { force: true }).success(function() {
        self.sequelize.getQueryInterface().dropTable('authors', { force: true }).success(function() {
          self.Author = self.sequelize.define('author', { firstName: Sequelize.STRING })
          self.Author.sync().success(function() {
            done()
          })
        })
      })
    })

    afterEach(function(done) {
      var self = this

      this.sequelize.getQueryInterface().dropTable('posts', { force: true }).success(function() {
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

      // The posts table gets dropped in the before filter.
      Post.sync().on('sql', function(sql) {
        if (dialect === 'postgres') {
          expect(sql).to.match(/"authorId" INTEGER REFERENCES "authors" \("id"\)/)
        } else if (Support.dialectIsMySQL()) {
          expect(sql).to.match(/FOREIGN KEY \(`authorId`\) REFERENCES `authors` \(`id`\)/)
        } else if (dialect === 'sqlite') {
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

      // The posts table gets dropped in the before filter.
      Post.sync().on('sql', function(sql) {
        if (dialect === 'postgres') {
          expect(sql).to.match(/"authorId" INTEGER REFERENCES "authors" \("id"\)/)
        } else if (Support.dialectIsMySQL()) {
          expect(sql).to.match(/FOREIGN KEY \(`authorId`\) REFERENCES `authors` \(`id`\)/)
        } else if (dialect === 'sqlite') {
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

      // The posts table gets dropped in the before filter.
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
        if (Support.dialectIsMySQL(true)) {
          expect(err.message).to.match(/ER_CANNOT_ADD_FOREIGN|ER_CANT_CREATE_TABLE/)
        } else if (dialect === 'mariadb') {
          expect(err.message).to.match(/Can\'t create table/)
        } else if (dialect === 'sqlite') {
          // the parser should not end up here ... see above
          expect(1).to.equal(2)
        } else if (dialect === 'postgres') {
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
        var _dialect = dialect === 'mariadb' ? 'mysql' : dialect

        expect(this.User.dataset().sql.dialectName).to.equal(_dialect)
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
          mariadb: 'SELECT username FROM `' + this.User.tableName + '`;',
          mysql:    'SELECT username FROM `' + this.User.tableName + '`;',
          sqlite:   'SELECT username FROM "' + this.User.tableName + '";'
        }
        expect(sql).to.equal(sqlMap[dialect])
      })

      it("transforms node-sql instances with chaining into a proper sql string", function() {
        var sql    = this.User.select("username").select("firstName").group("username").toSql()
        var sqlMap = {
          postgres: 'SELECT username, firstName FROM "' + this.User.tableName + '" GROUP BY username;',
          mariadb:    'SELECT username, firstName FROM `' + this.User.tableName + '` GROUP BY username;',
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
          .sync({ force: true })
          .then(function() { return self.User.create({ username: "foo" }) })
          .then(function() { return self.User.create({ username: "bar" }) })
          .then(function() { return self.User.create({ username: "baz" }) })
          .then(function() { done() })
      })

      it('supports transactions', function(done) {
        Support.prepareTransactionTest(this.sequelize, function(sequelize) {
          var User = sequelize.define('User', { username: Sequelize.STRING })

          User.sync({ force: true }).success(function() {
            sequelize.transaction(function(t) {
              User.create({ username: 'foo' }, { transaction: t }).success(function() {
                User.where({ username: "foo" }).exec().success(function(users1) {
                  User.where({ username: "foo" }).exec({ transaction: t }).success(function(users2) {
                    expect(users1).to.have.length(0)
                    expect(users2).to.have.length(1)
                    t.rollback().success(function() { done() })
                  })
                })
              })
            })
          })
        })
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


  describe('paranoid is true and where is an array', function() {

    beforeEach(function(done) {
      this.User = this.sequelize.define('User', {username: DataTypes.STRING }, { paranoid: true })
      this.Project = this.sequelize.define('Project', { title: DataTypes.STRING }, { paranoid: true })
      
      this.Project.hasMany(this.User)
      this.User.hasMany(this.Project)
      
      var self = this
      this.sequelize.sync({ force: true }).success(function() {
        self.User.bulkCreate([{
          username: 'leia'
        }, {
          username: 'luke'
        }, {
          username: 'vader'
        }]).success(function() {
          self.Project.bulkCreate([{
            title: 'republic'
          },{
            title: 'empire'
          }]).success(function() {
            self.User.findAll().success(function(users){
              self.Project.findAll().success(function(projects){
                var leia = users[0]
                  , luke = users[1]
                  , vader = users[2]
                  , republic = projects[0]
                  , empire = projects[1]
                leia.setProjects([republic]).success(function(){
                  luke.setProjects([republic]).success(function(){
                    vader.setProjects([empire]).success(function(){
                      leia.destroy().success(function() {
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

    it('should not fail with an include', function(done) {
      var tableName = ''
        , ident = this.sequelize.queryInterface.QueryGenerator.quoteIdentifier
        , escape = this.sequelize.queryInterface.QueryGenerator.escape
      if(this.Project.tableName) {
        tableName = ident(this.Project.tableName) + '.'
      }
      this.User.findAll({
        where: [
          tableName + ident('title') + ' = ' + escape('republic')
        ],
        include: [
          {model: this.Project}
        ]
      }).success(function(users){

        try{
          expect(users.length).to.be.equal(1)
          expect(users[0].username).to.be.equal('luke')
          done()
        }catch(e){
          done(e)
        }
      }).error(done)
    })

    it('should not overwrite a specified deletedAt', function(done) {
      var tableName = ''
        , ident = this.sequelize.queryInterface.QueryGenerator.quoteIdentifier
      if(this.User.tableName) {
        tableName = ident(this.User.tableName) + '.'
      }
      this.User.findAll({
        where: [
          tableName + ident('deletedAt') + ' IS NOT NULL '
        ],
        include: [
          {model: this.Project}
        ]
      }).success(function(users){

        try{
          expect(users.length).to.be.equal(1)
          expect(users[0].username).to.be.equal('leia')
          done()
        }catch(e){
          done(e)
        }
      }).error(done)
    })
  
  })

})
