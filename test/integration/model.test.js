'use strict';

var chai = require('chai')
  , Sequelize = require('../../index')
  , expect = chai.expect
  , Support = require(__dirname + '/support')
  , DataTypes = require(__dirname + '/../../lib/data-types')
  , dialect = Support.getTestDialect()
  , config = require(__dirname + '/../config/config')
  , sinon = require('sinon')
  , datetime = require('chai-datetime')
  , _ = require('lodash')
  , moment = require('moment')
  , current = Support.sequelize;

chai.use(datetime);
chai.config.includeStack = true;

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

  describe('constructor', function() {
    it('uses the passed dao name as tablename if freezeTableName', function() {
      var User = this.sequelize.define('FrozenUser', {}, { freezeTableName: true });
      expect(User.tableName).to.equal('FrozenUser');
    });

    it('uses the pluralized dao name as tablename unless freezeTableName', function() {
      var User = this.sequelize.define('SuperUser', {}, { freezeTableName: false });
      expect(User.tableName).to.equal('SuperUsers');
    });

    it('uses checks to make sure dao factory isnt leaking on multiple define', function() {
      this.sequelize.define('SuperUser', {}, { freezeTableName: false });
      var factorySize = this.sequelize.daoFactoryManager.all.length;

      this.sequelize.define('SuperUser', {}, { freezeTableName: false });
      var factorySize2 = this.sequelize.daoFactoryManager.all.length;

      expect(factorySize).to.equal(factorySize2);
    });

    it('attaches class and instance methods', function() {
      var User = this.sequelize.define('UserWithClassAndInstanceMethods', {}, {
        classMethods: { doSmth: function() { return 1; } },
        instanceMethods: { makeItSo: function() { return 2; } }
      });

      expect(User.doSmth).to.exist;
      expect(User.doSmth()).to.equal(1);
      expect(User.makeItSo).not.to.exist;

      expect(User.build().doSmth).not.to.exist;
      expect(User.build().makeItSo).to.exist;
      expect(User.build().makeItSo()).to.equal(2);
    });

    it('allows us us to predefine the ID column with our own specs', function() {
      var User = this.sequelize.define('UserCol', {
        id: {
          type: Sequelize.STRING,
          defaultValue: 'User',
          primaryKey: true
        }
      });

      return User.sync({ force: true }).then(function() {
        return expect(User.create({id: 'My own ID!'})).to.eventually.have.property('id', 'My own ID!');
      });
    });

    it('throws an error if 2 autoIncrements are passed', function() {
      var self = this;
      expect(function() {
        self.sequelize.define('UserWithTwoAutoIncrements', {
          userid: { type: Sequelize.INTEGER, primaryKey: true, autoIncrement: true },
          userscore: { type: Sequelize.INTEGER, primaryKey: true, autoIncrement: true }
        });
      }).to.throw(Error, 'Invalid Instance definition. Only one autoincrement field allowed.');
    });

    it('throws an error if a custom model-wide validation is not a function', function() {
      var self = this;
      expect(function() {
        self.sequelize.define('Foo', {
          field: Sequelize.INTEGER
        }, {
          validate: {
            notFunction: 33
          }
        });
      }).to.throw(Error, 'Members of the validate option must be functions. Model: Foo, error with validate member notFunction');
    });

    it('throws an error if a custom model-wide validation has the same name as a field', function() {
      var self = this;
      expect(function() {
        self.sequelize.define('Foo', {
          field: Sequelize.INTEGER
        }, {
          validate: {
            field: function() {}
          }
        });
      }).to.throw(Error, 'A model validator function must not have the same name as a field. Model: Foo, field/validation name: field');
    });

    it('should allow me to set a default value for createdAt and updatedAt', function() {
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
      }, { timestamps: true });

      return UserTable.sync({ force: true }).then(function() {
        return UserTable.create({aNumber: 5}).then(function(user) {
          return UserTable.bulkCreate([
            {aNumber: 10},
            {aNumber: 12}
          ]).then(function() {
            return UserTable.findAll({where: {aNumber: { gte: 10 }}}).then(function(users) {
              expect(moment(user.createdAt).format('YYYY-MM-DD')).to.equal('2012-01-01');
              expect(moment(user.updatedAt).format('YYYY-MM-DD')).to.equal('2012-01-02');
              users.forEach(function(u) {
                expect(moment(u.createdAt).format('YYYY-MM-DD')).to.equal('2012-01-01');
                expect(moment(u.updatedAt).format('YYYY-MM-DD')).to.equal('2012-01-02');
              });
            });
          });
        });
      });
    });

    it('should allow me to set a function as default value', function() {
      var defaultFunction = sinon.stub().returns(5);
      var UserTable = this.sequelize.define('UserCol', {
        aNumber: {
          type: Sequelize.INTEGER,
          defaultValue: defaultFunction
        }
      }, { timestamps: true });

      return UserTable.sync({ force: true }).then(function() {
        return UserTable.create().then(function(user) {
            return UserTable.create().then(function(user2) {
              expect(user.aNumber).to.equal(5);
              expect(user2.aNumber).to.equal(5);
              expect(defaultFunction.callCount).to.equal(2);
            });
          });
      });
    });

    it('should allow me to override updatedAt, createdAt, and deletedAt fields', function() {
      var UserTable = this.sequelize.define('UserCol', {
        aNumber: Sequelize.INTEGER
      }, {
        timestamps: true,
        updatedAt: 'updatedOn',
        createdAt: 'dateCreated',
        deletedAt: 'deletedAtThisTime',
        paranoid: true
      });

      return UserTable.sync({force: true}).then(function() {
        return UserTable.create({aNumber: 4}).then(function(user) {
          expect(user.updatedOn).to.exist;
          expect(user.dateCreated).to.exist;
          return user.destroy().then(function(user) {
            expect(user.deletedAtThisTime).to.exist;
          });
        });
      });
    });

    it('should allow me to disable some of the timestamp fields', function() {
      var UpdatingUser = this.sequelize.define('UpdatingUser', {
        name: DataTypes.STRING
      }, {
        timestamps: true,
        updatedAt: false,
        createdAt: false,
        deletedAt: 'deletedAtThisTime',
        paranoid: true
      });

      return UpdatingUser.sync({force: true}).then(function() {
        return UpdatingUser.create({
          name: 'heyo'
        }).then(function(user) {
          expect(user.createdAt).not.to.exist;
          expect(user.false).not.to.exist; //  because, you know we might accidentally add a field named 'false'

          user.name = 'heho';
          return user.save().then(function(user) {
            expect(user.updatedAt).not.to.exist;
            return user.destroy().then(function(user) {
              expect(user.deletedAtThisTime).to.exist;
            });
          });
        });
      });
    });

    it('should allow me to override updatedAt, createdAt, and deletedAt fields with underscored being true', function() {
      var UserTable = this.sequelize.define('UserCol', {
        aNumber: Sequelize.INTEGER
      }, {
        timestamps: true,
        updatedAt: 'updatedOn',
        createdAt: 'dateCreated',
        deletedAt: 'deletedAtThisTime',
        paranoid: true,
        underscored: true
      });

      return UserTable.sync({force: true}).then(function() {
        return UserTable.create({aNumber: 4}).then(function(user) {
          expect(user.updated_on).to.exist;
          expect(user.date_created).to.exist;
          return user.destroy().then(function(user) {
            expect(user.deleted_at_this_time).to.exist;
          });
        });
      });
    });

    it('returns proper defaultValues after save when setter is set', function() {
      var titleSetter = sinon.spy()
        , Task = this.sequelize.define('TaskBuild', {
          title: {
            type: Sequelize.STRING(50),
            allowNull: false,
            defaultValue: ''
          }
        }, {
          setterMethods: {
            title: titleSetter
          }
        });

      return Task.sync({force: true}).then(function() {
        return Task.build().save().then(function(record) {
          expect(record.title).to.be.a('string');
          expect(record.title).to.equal('');
          expect(titleSetter.notCalled).to.be.ok; // The setter method should not be invoked for default values
        });
      });
    });

    it('should work with both paranoid and underscored being true', function() {
      var UserTable = this.sequelize.define('UserCol', {
        aNumber: Sequelize.INTEGER
      }, {
        paranoid: true,
        underscored: true
      });

      return UserTable.sync({force: true}).then(function() {
        return UserTable.create({aNumber: 30}).then(function(user) {
          return UserTable.count().then(function(c) {
            expect(c).to.equal(1);
          });
        });
      });
    });

    it('allows multiple column unique keys to be defined', function() {
      var User = this.sequelize.define('UserWithUniqueUsername', {
        username: { type: Sequelize.STRING, unique: 'user_and_email' },
        email: { type: Sequelize.STRING, unique: 'user_and_email' },
        aCol: { type: Sequelize.STRING, unique: 'a_and_b' },
        bCol: { type: Sequelize.STRING, unique: 'a_and_b' }
      });

      return User.sync({ force: true, logging: _.after(2, _.once(function(sql) {
        if (dialect === 'mssql') {
          expect(sql).to.match(/CONSTRAINT\s*([`"\[]?user_and_email[`"\]]?)?\s*UNIQUE\s*\([`"\[]?username[`"\]]?, [`"\[]?email[`"\]]?\)/);
          expect(sql).to.match(/CONSTRAINT\s*([`"\[]?a_and_b[`"\]]?)?\s*UNIQUE\s*\([`"\[]?aCol[`"\]]?, [`"\[]?bCol[`"\]]?\)/);
        } else {
          expect(sql).to.match(/UNIQUE\s*([`"]?user_and_email[`"]?)?\s*\([`"]?username[`"]?, [`"]?email[`"]?\)/);
          expect(sql).to.match(/UNIQUE\s*([`"]?a_and_b[`"]?)?\s*\([`"]?aCol[`"]?, [`"]?bCol[`"]?\)/);
        }
      }))});
    });

    it('allows unique on column with field aliases', function() {
      var User = this.sequelize.define('UserWithUniqueFieldAlias', {
        userName: { type: Sequelize.STRING, unique: 'user_name_unique', field: 'user_name' }
      });
      return User.sync({ force: true }).bind(this).then(function() {
        return this.sequelize.queryInterface.showIndex(User.tableName).then(function(indexes) {
          var idxPrimary, idxUnique;
          if (dialect === 'sqlite') {
            expect(indexes).to.have.length(1);
            idxUnique = indexes[0];
            expect(idxUnique.primary).to.equal(false);
            expect(idxUnique.unique).to.equal(true);
            expect(idxUnique.fields).to.deep.equal([{attribute: 'user_name', length: undefined, order: undefined}]);
          } else if (dialect === 'mysql') {
            expect(indexes).to.have.length(2);
            idxPrimary = indexes[0];
            idxUnique = indexes[1];
            expect(idxUnique.primary).to.equal(false);
            expect(idxUnique.unique).to.equal(true);
            expect(idxUnique.fields).to.deep.equal([{attribute: 'user_name', length: undefined, order: 'ASC'}]);
            expect(idxUnique.type).to.equal('BTREE');
          } else if (dialect === 'postgres') {
            expect(indexes).to.have.length(2);
            idxPrimary = indexes[0];
            idxUnique = indexes[1];
            expect(idxUnique.primary).to.equal(false);
            expect(idxUnique.unique).to.equal(true);
            expect(idxUnique.fields).to.deep.equal([{attribute: 'user_name', collate: undefined, order: undefined, length: undefined}]);
          } else if (dialect === 'mssql') {
            expect(indexes).to.have.length(2);
            idxPrimary = indexes[0];
            idxUnique = indexes[1];
            expect(idxUnique.primary).to.equal(false);
            expect(idxUnique.unique).to.equal(true);
            expect(idxUnique.fields).to.deep.equal([{attribute: 'user_name', collate: undefined, length: undefined, order: 'ASC'}]);
          }
        });
      });
    });

    it('allows us to customize the error message for unique constraint', function() {

      var self = this
        , User = this.sequelize.define('UserWithUniqueUsername', {
            username: { type: Sequelize.STRING, unique: { name: 'user_and_email', msg: 'User and email must be unique' }},
            email: { type: Sequelize.STRING, unique: 'user_and_email' }
          });

      return User.sync({ force: true }).bind(this).then(function() {
        return self.sequelize.Promise.all([
          User.create({username: 'tobi', email: 'tobi@tobi.me'}),
          User.create({username: 'tobi', email: 'tobi@tobi.me'})]);
      }).catch (self.sequelize.UniqueConstraintError, function(err) {
        expect(err.message).to.equal('User and email must be unique');
      });
    });

    // If you use migrations to create unique indexes that have explicit names and/or contain fields
    // that have underscore in their name. Then sequelize must use the index name to map the custom message to the error thrown from db.
    it('allows us to map the customized error message with unique constraint name', function() {
      // Fake migration style index creation with explicit index definition
      var self = this
        , User = this.sequelize.define('UserWithUniqueUsername', {
            user_id: { type: Sequelize.INTEGER},
            email: { type: Sequelize.STRING}
          }, {
            indexes: [
            {
              name: 'user_and_email_index',
              msg: 'User and email must be unique',
              unique: true,
              method: 'BTREE',
              fields: ['user_id', {attribute: 'email', collate: dialect === 'sqlite' ? 'RTRIM' : 'en_US', order: 'DESC', length: 5}]
            }]
          });

      return User.sync({ force: true }).bind(this).then(function() {
        // Redefine the model to use the index in database and override error message
        User = self.sequelize.define('UserWithUniqueUsername', {
            user_id: { type: Sequelize.INTEGER, unique: { name: 'user_and_email_index', msg: 'User and email must be unique' }},
            email: { type: Sequelize.STRING, unique: 'user_and_email_index'}
          });
        return self.sequelize.Promise.all([
          User.create({user_id: 1, email: 'tobi@tobi.me'}),
          User.create({user_id: 1, email: 'tobi@tobi.me'})]);
      }).catch (self.sequelize.UniqueConstraintError, function(err) {
        expect(err.message).to.equal('User and email must be unique');
      });
    });

    it('should allow the user to specify indexes in options', function() {
      var indices = [{
        name: 'a_b_uniq',
        unique: true,
        method: 'BTREE',
        fields: ['fieldB', {attribute: 'fieldA', collate: dialect === 'sqlite' ? 'RTRIM' : 'en_US', order: 'DESC', length: 5}]
      }];

      if (dialect !== 'mssql') {
        indices.push({
          type: 'FULLTEXT',
          fields: ['fieldC'],
          concurrently: true
        });
      }

      var Model = this.sequelize.define('model', {
        fieldA: Sequelize.STRING,
        fieldB: Sequelize.INTEGER,
        fieldC: Sequelize.STRING
      }, {
        indexes: indices,
        engine: 'MyISAM'
      });

      return this.sequelize.sync().bind(this).then(function() {
        return this.sequelize.sync(); // The second call should not try to create the indices again
      }).then(function() {
        return this.sequelize.queryInterface.showIndex(Model.tableName);
      }).spread(function() {
        var primary, idx1, idx2;

        if (dialect === 'sqlite') {
          // PRAGMA index_info does not return the primary index
          idx1 = arguments[0];
          idx2 = arguments[1];

          expect(idx1.fields).to.deep.equal([
            { attribute: 'fieldB', length: undefined, order: undefined},
            { attribute: 'fieldA', length: undefined, order: undefined}
          ]);

          expect(idx2.fields).to.deep.equal([
            { attribute: 'fieldC', length: undefined, order: undefined}
          ]);
        } else if (dialect === 'mssql') {
          idx1 = arguments[0];

          expect(idx1.fields).to.deep.equal([
            { attribute: 'fieldB', length: undefined, order: 'ASC', collate: undefined},
            { attribute: 'fieldA', length: undefined, order: 'DESC', collate: undefined}
          ]);
        } else if (dialect === 'postgres') {
          // Postgres returns indexes in alphabetical order
          primary = arguments[2];
          idx1 = arguments[0];
          idx2 = arguments[1];

          expect(idx1.fields).to.deep.equal([
            { attribute: 'fieldB', length: undefined, order: undefined, collate: undefined},
            { attribute: 'fieldA', length: undefined, order: 'DESC', collate: 'en_US'}
          ]);

          expect(idx2.fields).to.deep.equal([
            { attribute: 'fieldC', length: undefined, order: undefined, collate: undefined}
          ]);
        } else {
          // And finally mysql returns the primary first, and then the rest in the order they were defined
          primary = arguments[0];
          idx1 = arguments[1];
          idx2 = arguments[2];

          expect(primary.primary).to.be.ok;

          expect(idx1.type).to.equal('BTREE');
          expect(idx2.type).to.equal('FULLTEXT');

          expect(idx1.fields).to.deep.equal([
            { attribute: 'fieldB', length: undefined, order: 'ASC'},
            { attribute: 'fieldA', length: 5, order: 'ASC'}
          ]);

          expect(idx2.fields).to.deep.equal([
            { attribute: 'fieldC', length: undefined, order: undefined}
          ]);
        }

        expect(idx1.name).to.equal('a_b_uniq');
        expect(idx1.unique).to.be.ok;

        if (dialect !== 'mssql') {
          expect(idx2.name).to.equal('models_field_c');
          expect(idx2.unique).not.to.be.ok;
        }
      });
    });
  });

  describe('build', function() {
    it("doesn't create database entries", function() {
      this.User.build({ username: 'John Wayne' });
      return this.User.findAll().then(function(users) {
        expect(users).to.have.length(0);
      });
    });

    it('fills the objects with default values', function() {
      var Task = this.sequelize.define('TaskBuild', {
        title: {type: Sequelize.STRING, defaultValue: 'a task!'},
        foo: {type: Sequelize.INTEGER, defaultValue: 2},
        bar: {type: Sequelize.DATE},
        foobar: {type: Sequelize.TEXT, defaultValue: 'asd'},
        flag: {type: Sequelize.BOOLEAN, defaultValue: false}
      });

      expect(Task.build().title).to.equal('a task!');
      expect(Task.build().foo).to.equal(2);
      expect(Task.build().bar).to.not.be.ok;
      expect(Task.build().foobar).to.equal('asd');
      expect(Task.build().flag).to.be.false;
    });

    it('fills the objects with default values', function() {
      var Task = this.sequelize.define('TaskBuild', {
        title: {type: Sequelize.STRING, defaultValue: 'a task!'},
        foo: {type: Sequelize.INTEGER, defaultValue: 2},
        bar: {type: Sequelize.DATE},
        foobar: {type: Sequelize.TEXT, defaultValue: 'asd'},
        flag: {type: Sequelize.BOOLEAN, defaultValue: false}
      }, { timestamps: false });
      expect(Task.build().title).to.equal('a task!');
      expect(Task.build().foo).to.equal(2);
      expect(Task.build().bar).to.not.be.ok;
      expect(Task.build().foobar).to.equal('asd');
      expect(Task.build().flag).to.be.false;
    });

    it('attaches getter and setter methods from attribute definition', function() {
      var Product = this.sequelize.define('ProductWithSettersAndGetters1', {
        price: {
          type: Sequelize.INTEGER,
          get: function() {
            return 'answer = ' + this.getDataValue('price');
          },
          set: function(v) {
            return this.setDataValue('price', v + 42);
          }
        }
      });

      expect(Product.build({price: 42}).price).to.equal('answer = 84');

      var p = Product.build({price: 1});
      expect(p.price).to.equal('answer = 43');

      p.price = 0;
      expect(p.price).to.equal('answer = 42');
    });

    it('attaches getter and setter methods from options', function() {
      var Product = this.sequelize.define('ProductWithSettersAndGetters2', {
        priceInCents: Sequelize.INTEGER
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

      expect(Product.build({price: 20}).priceInCents).to.equal(20 * 100);
      expect(Product.build({priceInCents: 30 * 100}).price).to.equal('$' + 30);
    });

    it('attaches getter and setter methods from options only if not defined in attribute', function() {
      var Product = this.sequelize.define('ProductWithSettersAndGetters3', {
        price1: {
          type: Sequelize.INTEGER,
          set: function(v) { this.setDataValue('price1', v * 10); }
        },
        price2: {
          type: Sequelize.INTEGER,
          get: function() { return this.getDataValue('price2') * 10; }
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

      expect(p.price1).to.equal(10);
      expect(p.price2).to.equal(20);
    });

    describe('include', function() {
      it('should support basic includes', function() {
        var Product = this.sequelize.define('Product', {
          title: Sequelize.STRING
        });
        var Tag = this.sequelize.define('Tag', {
          name: Sequelize.STRING
        });
        var User = this.sequelize.define('User', {
          first_name: Sequelize.STRING,
          last_name: Sequelize.STRING
        });

        Product.hasMany(Tag);
        Product.belongsTo(User);

        var product = Product.build({
          id: 1,
          title: 'Chair',
          Tags: [
            {id: 1, name: 'Alpha'},
            {id: 2, name: 'Beta'}
          ],
          User: {
            id: 1,
            first_name: 'Mick',
            last_name: 'Hansen'
          }
        }, {
          include: [
            User,
            Tag
          ]
        });

        expect(product.Tags).to.be.ok;
        expect(product.Tags.length).to.equal(2);
        expect(product.Tags[0].Model).to.equal(Tag);
        expect(product.User).to.be.ok;
        expect(product.User.Model).to.equal(User);
      });

      it('should support includes with aliases', function() {
        var Product = this.sequelize.define('Product', {
          title: Sequelize.STRING
        });
        var Tag = this.sequelize.define('Tag', {
          name: Sequelize.STRING
        });
        var User = this.sequelize.define('User', {
          first_name: Sequelize.STRING,
          last_name: Sequelize.STRING
        });

        Product.hasMany(Tag, {as: 'categories'});
        Product.hasMany(User, {as: 'followers', through: 'product_followers'});
        User.hasMany(Product, {as: 'following', through: 'product_followers'});

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
            {model: User, as: 'followers'},
            {model: Tag, as: 'categories'}
          ]
        });

        expect(product.categories).to.be.ok;
        expect(product.categories.length).to.equal(4);
        expect(product.categories[0].Model).to.equal(Tag);
        expect(product.followers).to.be.ok;
        expect(product.followers.length).to.equal(2);
        expect(product.followers[0].Model).to.equal(User);
      });
    });
  });

  describe('find', function() {
    if (current.dialect.supports.transactions) {
      it('supports the transaction option in the first parameter', function() {
        return Support.prepareTransactionTest(this.sequelize).bind({}).then(function(sequelize) {
          var User = sequelize.define('User', { username: Sequelize.STRING, foo: Sequelize.STRING });
          return User.sync({ force: true }).then(function() {
            return sequelize.transaction().then(function(t) {
              return User.create({ username: 'foo' }, { transaction: t }).then(function() {
                return User.find({ where: { username: 'foo' }, transaction: t }).then(function(user) {
                  expect(user).to.not.be.null;
                  return t.rollback();
                });
              });
            });
          });
        });
      });
    }

    it('should not fail if model is paranoid and where is an empty array', function() {
      var User = this.sequelize.define('User', { username: Sequelize.STRING }, { paranoid: true });

      return User.sync({ force: true })
        .then(function() {
          return User.create({ username: 'A fancy name' });
        })
        .then(function(u) {
          return User.find({ where: [] });
        })
        .then(function(u) {
          expect(u.username).to.equal('A fancy name');
        });
    });
  });

  describe('findOrInitialize', function() {

    if (current.dialect.supports.transactions) {
      it('supports transactions', function() {
        return Support.prepareTransactionTest(this.sequelize).bind({}).then(function(sequelize) {
          var User = sequelize.define('User', { username: Sequelize.STRING, foo: Sequelize.STRING });

          return User.sync({ force: true }).then(function() {
            return sequelize.transaction().then(function(t) {
              return User.create({ username: 'foo' }, { transaction: t }).then(function() {
                return User.findOrInitialize({
                  where: {username: 'foo'}
                }).spread(function(user1) {
                  return User.findOrInitialize({
                    where: {username: 'foo'},
                    transaction: t
                  }).spread(function(user2) {
                    return User.findOrInitialize({
                      where: {username: 'foo'},
                      defaults: { foo: 'asd' },
                      transaction: t
                    }).spread(function(user3) {
                      expect(user1.isNewRecord).to.be.true;
                      expect(user2.isNewRecord).to.be.false;
                      expect(user3.isNewRecord).to.be.false;
                      return t.commit();
                    });
                  });
                });
              });
            });
          });
        });
      });
    }

    describe('returns an instance if it already exists', function() {
      it('with a single find field', function() {
        var self = this;

        return this.User.create({ username: 'Username' }).then(function(user) {
          return self.User.findOrInitialize({
            where: { username: user.username }
          }).spread(function(_user, initialized) {
            expect(_user.id).to.equal(user.id);
            expect(_user.username).to.equal('Username');
            expect(initialized).to.be.false;
          });
        });
      });

      it('with multiple find fields', function() {
        var self = this;

        return this.User.create({ username: 'Username', data: 'data' }).then(function(user) {
          return self.User.findOrInitialize({ where: {
            username: user.username,
            data: user.data
          }}).spread(function(_user, initialized) {
            expect(_user.id).to.equal(user.id);
            expect(_user.username).to.equal('Username');
            expect(_user.data).to.equal('data');
            expect(initialized).to.be.false;
          });
        });
      });

      it('builds a new instance with default value.', function() {
        var data = {
            username: 'Username'
          },
          default_values = {
            data: 'ThisIsData'
          };

        return this.User.findOrInitialize({
          where: data,
          defaults: default_values
        }).spread(function(user, initialized) {
          expect(user.id).to.be.null;
          expect(user.username).to.equal('Username');
          expect(user.data).to.equal('ThisIsData');
          expect(initialized).to.be.true;
          expect(user.isNewRecord).to.be.true;
          expect(user.isDirty).to.be.true;
        });
      });
    });
  });

  describe('update', function() {
    it('throws an error if no where clause is given', function() {
      var User = this.sequelize.define('User', { username: DataTypes.STRING });

      return this.sequelize.sync({ force: true }).then(function() {
        return User.update();
      }).then(function() {
        throw new Error('Update should throw an error if no where clause is given.');
      }, function(err) {
        expect(err).to.be.an.instanceof(Error);
        expect(err.message).to.equal('Missing where attribute in the options parameter passed to update.');
      });
    });

    if (current.dialect.supports.transactions) {
      it('supports transactions', function() {
        return Support.prepareTransactionTest(this.sequelize).bind({}).then(function(sequelize) {
          var User = sequelize.define('User', { username: Sequelize.STRING });

          return User.sync({ force: true }).then(function() {
            return User.create({ username: 'foo' }).then(function() {
              return sequelize.transaction().then(function(t) {
                return User.update({ username: 'bar' }, {where: {username: 'foo'}, transaction: t }).then(function() {
                  return User.findAll().then(function(users1) {
                    return User.findAll({ transaction: t }).then(function(users2) {
                      expect(users1[0].username).to.equal('foo');
                      expect(users2[0].username).to.equal('bar');
                      return t.rollback();
                    });
                  });
                });
              });
            });
          });
        });
      });
    }

    it('updates the attributes that we select only without updating createdAt', function() {
      var User = this.sequelize.define('User1', {
        username: Sequelize.STRING,
        secretValue: Sequelize.STRING
      }, {
          paranoid: true
        });

      return User.sync({ force: true }).then(function() {
        return User.create({username: 'Peter', secretValue: '42'}).then(function(user) {
          return user.updateAttributes({ secretValue: '43' }, ['secretValue']).on('sql', function(sql) {
            if (dialect === 'mssql') {
              expect(sql).to.not.contain('createdAt');
            } else {
              expect(sql).to.match(/UPDATE\s+[`"]+User1s[`"]+\s+SET\s+[`"]+secretValue[`"]='43',[`"]+updatedAt[`"]+='[^`",]+'\s+WHERE [`"]+id[`"]+\s=\s1/);
            }
          });
        });
      });
    });

    it('allows sql logging of updated statements', function() {
      var User = this.sequelize.define('User', {
        name: Sequelize.STRING,
        bio: Sequelize.TEXT
      }, {
          paranoid: true
        });

      return User.sync({ force: true }).then(function() {
        return User.create({ name: 'meg', bio: 'none' }).then(function(u) {
          expect(u).to.exist;
          expect(u).not.to.be.null;
          return u.updateAttributes({name: 'brian'}).on('sql', function(sql) {
            expect(sql).to.exist;
            expect(sql.toUpperCase().indexOf('UPDATE')).to.be.above(-1);
          });
        });
      });
    });

    it('updates only values that match filter', function() {
      var self = this
        , data = [{ username: 'Peter', secretValue: '42' },
                  { username: 'Paul', secretValue: '42' },
                  { username: 'Bob', secretValue: '43' }];

      return this.User.bulkCreate(data).then(function() {
        return self.User.update({username: 'Bill'}, {where: {secretValue: '42'}}).then(function() {
          return self.User.findAll({order: 'id'}).then(function(users) {
            expect(users.length).to.equal(3);

            users.forEach(function(user) {
              if (user.secretValue === '42') {
                expect(user.username).to.equal('Bill');
              } else {
                expect(user.username).to.equal('Bob');
              }
            });

          });
        });
      });
    });

    it('updates with casting', function() {
      var self = this;
      return this.User.create({
        username: 'John'
      }).then(function(user) {
        return self.User.update({username: self.sequelize.cast('1', dialect === 'mssql' ? 'nvarchar' : 'char')}, {where: {username: 'John'}}).then(function() {
          return self.User.findAll().then(function(users) {
            expect(users[0].username).to.equal('1');
          });
        });
      });
    });

    it('updates with function and column value', function() {
      var self = this;

      return this.User.create({
        username: 'John'
      }).then(function(user) {
        return self.User.update({username: self.sequelize.fn('upper', self.sequelize.col('username'))}, {where: {username: 'John'}}).then(function() {
          return self.User.findAll().then(function(users) {
            expect(users[0].username).to.equal('JOHN');
          });
        });
      });
    });

    it('sets updatedAt to the current timestamp', function() {
      var data = [{ username: 'Peter', secretValue: '42' },
                  { username: 'Paul', secretValue: '42' },
                  { username: 'Bob', secretValue: '43' }];

      return this.User.bulkCreate(data).bind(this).then(function() {
        return this.User.findAll({order: 'id'});
      }).then(function(users) {
        this.updatedAt = users[0].updatedAt;

        expect(this.updatedAt).to.be.ok;
        expect(this.updatedAt).to.equalTime(users[2].updatedAt); // All users should have the same updatedAt

        // Pass the time so we can actually see a change
        return this.sequelize.Promise.delay(1000).bind(this).then(function() {
          return this.User.update({username: 'Bill'}, {where: {secretValue: '42'}});
        });
      }).then(function() {
        return this.User.findAll({order: 'id'});
      }).then(function(users) {
        expect(users[0].username).to.equal('Bill');
        expect(users[1].username).to.equal('Bill');
        expect(users[2].username).to.equal('Bob');

        expect(users[0].updatedAt).to.be.afterTime(this.updatedAt);
        expect(users[2].updatedAt).to.equalTime(this.updatedAt);
      });
    });

    it('returns the number of affected rows', function() {
      var self = this
        , data = [{ username: 'Peter', secretValue: '42' },
                  { username: 'Paul', secretValue: '42' },
                  { username: 'Bob', secretValue: '43' }];

      return this.User.bulkCreate(data).then(function() {
        return self.User.update({username: 'Bill'}, {where: {secretValue: '42'}}).spread(function(affectedRows) {
          expect(affectedRows).to.equal(2);
        }).then(function() {
          return self.User.update({username: 'Bill'}, {where: {secretValue: '44'}}).spread(function(affectedRows) {
            expect(affectedRows).to.equal(0);
          });
        });
      });
    });

    if (dialect === 'postgres') {
      it('returns the affected rows if `options.returning` is true', function() {
        var self = this
          , data = [{ username: 'Peter', secretValue: '42' },
                    { username: 'Paul', secretValue: '42' },
                    { username: 'Bob', secretValue: '43' }];

        return this.User.bulkCreate(data).then(function() {
          return self.User.update({ username: 'Bill' }, { where: {secretValue: '42' }, returning: true }).spread(function(count, rows) {
            expect(count).to.equal(2);
            expect(rows).to.have.length(2);
          }).then(function() {
            return self.User.update({ username: 'Bill'}, { where: {secretValue: '44' }, returning: true }).spread(function(count, rows) {
              expect(count).to.equal(0);
              expect(rows).to.have.length(0);
            });
          });
        });
      });
    }

    if (Support.dialectIsMySQL()) {
      it('supports limit clause', function() {
        var self = this
          , data = [{ username: 'Peter', secretValue: '42' },
                    { username: 'Peter', secretValue: '42' },
                    { username: 'Peter', secretValue: '42' }];

        return this.User.bulkCreate(data).then(function() {
          return self.User.update({secretValue: '43'}, {where: {username: 'Peter'}, limit: 1}).spread(function(affectedRows) {
            expect(affectedRows).to.equal(1);
          });
        });
      });
    }

  });

  describe('destroy', function() {
    it('truncate should clear the table', function() {
      var User = this.sequelize.define('User', { username: DataTypes.STRING }),
          data = [
            { username: 'user1' },
            { username: 'user2' }
          ];

      return this.sequelize.sync({ force: true }).then(function() {
        return User.bulkCreate(data);
      }).then(function() {
        return User.destroy({ truncate: true });
      }).then(function() {
        return expect(User.findAll()).to.eventually.have.length(0);
      });
    });

    it('throws an error if no where clause is given', function() {
      var User = this.sequelize.define('User', { username: DataTypes.STRING });

      return this.sequelize.sync({ force: true }).then(function() {
        return User.destroy();
      }).then(function() {
        throw new Error('Destroy should throw an error if no where clause is given.');
      }, function(err) {
        expect(err).to.be.an.instanceof(Error);
        expect(err.message).to.equal('Missing where or truncate attribute in the options parameter passed to destroy.');
      });
    });

    it('deletes all instances when given an empty where object', function() {
      var User = this.sequelize.define('User', { username: DataTypes.STRING }),
          data = [
            { username: 'user1' },
            { username: 'user2' }
          ];

      return this.sequelize.sync({ force: true }).then(function() {
        return User.bulkCreate(data);
      }).then(function() {
        return User.destroy({ where: {} });
      }).then(function(affectedRows) {
        expect(affectedRows).to.equal(2);
        return User.findAll();
      }).then(function(users) {
        expect(users).to.have.length(0);
      });
    });

    if (current.dialect.supports.transactions) {
      it('supports transactions', function() {
        return Support.prepareTransactionTest(this.sequelize).bind({}).then(function(sequelize) {
          var User = sequelize.define('User', { username: Sequelize.STRING });

          return User.sync({ force: true }).then(function() {
            return User.create({ username: 'foo' }).then(function() {
              return sequelize.transaction().then(function(t) {
                return User.destroy({
                  where: {},
                  transaction: t
                }).then(function() {
                  return User.count().then(function(count1) {
                    return User.count({ transaction: t }).then(function(count2) {
                      expect(count1).to.equal(1);
                      expect(count2).to.equal(0);
                      return t.rollback();
                    });
                  });
                });
              });
            });
          });
        });
      });
    }

    it('deletes values that match filter', function() {
      var self = this
        , data = [{ username: 'Peter', secretValue: '42' },
                  { username: 'Paul', secretValue: '42' },
                  { username: 'Bob', secretValue: '43' }];

      return this.User.bulkCreate(data).then(function() {
        return self.User.destroy({where: {secretValue: '42'}})
          .then(function() {
            return self.User.findAll({order: 'id'}).then(function(users) {
              expect(users.length).to.equal(1);
              expect(users[0].username).to.equal('Bob');
            });
          });
      });
    });

    it('works without a primary key', function() {
      var Log = this.sequelize.define('Log', {
        client_id: DataTypes.INTEGER,
        content: DataTypes.TEXT,
        timestamp: DataTypes.DATE
      });
      Log.removeAttribute('id');

      return Log.sync({force: true}).then(function() {
        return Log.create({
          client_id: 13,
          content: 'Error!',
          timestamp: new Date()
        });
      }).then(function() {
        return Log.destroy({
          where: {
            client_id: 13
          }
        });
      }).then(function() {
        return Log.findAll().then(function(logs) {
          expect(logs.length).to.equal(0);
        });
      });
    });

    it('supports .field', function() {
      var UserProject = this.sequelize.define('UserProject', {
        userId: {
          type: DataTypes.INTEGER,
          field: 'user_id'
        }
      });

      return UserProject.sync({force: true}).then(function() {
        return UserProject.create({
          userId: 10
        });
      }).then(function(userProject) {
        return UserProject.destroy({
          where: {
            userId: 10
          }
        });
      }).then(function() {
        return UserProject.findAll();
      }).then(function(userProjects) {
        expect(userProjects.length).to.equal(0);
      });
    });

    it('sets deletedAt to the current timestamp if paranoid is true', function() {
      var self = this
        , qi = this.sequelize.queryInterface.QueryGenerator.quoteIdentifier.bind(this.sequelize.queryInterface.QueryGenerator)
        , ParanoidUser = self.sequelize.define('ParanoidUser', {
          username: Sequelize.STRING,
          secretValue: Sequelize.STRING,
          data: Sequelize.STRING,
          intVal: { type: Sequelize.INTEGER, defaultValue: 1}
        }, {
            paranoid: true
          })
        , data = [{ username: 'Peter', secretValue: '42' },
                  { username: 'Paul', secretValue: '42' },
                  { username: 'Bob', secretValue: '43' }];

      return ParanoidUser.sync({ force: true }).then(function() {
        return ParanoidUser.bulkCreate(data);
      }).bind({}).then(function() {
        // since we save in UTC, let's format to UTC time
        this.date = moment().utc().format('YYYY-MM-DD h:mm');
        return ParanoidUser.destroy({where: {secretValue: '42'}});
      }).then(function() {
        return ParanoidUser.findAll({order: 'id'});
      }).then(function(users) {
        expect(users.length).to.equal(1);
        expect(users[0].username).to.equal('Bob');

        return self.sequelize.query('SELECT * FROM ' + qi('ParanoidUsers') + ' WHERE ' + qi('deletedAt') + ' IS NOT NULL ORDER BY ' + qi('id'));
      }).spread(function(users) {
        expect(users[0].username).to.equal('Peter');
        expect(users[1].username).to.equal('Paul');

        expect(moment(new Date(users[0].deletedAt)).utc().format('YYYY-MM-DD h:mm')).to.equal(this.date);
        expect(moment(new Date(users[1].deletedAt)).utc().format('YYYY-MM-DD h:mm')).to.equal(this.date);
      });
    });

    describe("can't find records marked as deleted with paranoid being true", function() {
      it('with the DAOFactory', function() {
        var User = this.sequelize.define('UserCol', {
          username: Sequelize.STRING
        }, { paranoid: true });

        return User.sync({ force: true }).then(function() {
          return User.bulkCreate([
            {username: 'Toni'},
            {username: 'Tobi'},
            {username: 'Max'}
          ]).then(function() {
            return User.find(1).then(function(user) {
              return user.destroy().then(function() {
                return User.find(1).then(function(user) {
                  expect(user).to.be.null;
                  return User.count().then(function(cnt) {
                    expect(cnt).to.equal(2);
                    return User.findAll().then(function(users) {
                      expect(users).to.have.length(2);
                    });
                  });
                });
              });
            });
          });
        });
      });
    });

    describe('can find paranoid records if paranoid is marked as false in query', function() {
      it('with the DAOFactory', function() {
        var User = this.sequelize.define('UserCol', {
          username: Sequelize.STRING
        }, { paranoid: true });

        return User.sync({ force: true })
          .then(function() {
            return User.bulkCreate([
              {username: 'Toni'},
              {username: 'Tobi'},
              {username: 'Max'}
            ]);
          })
          .then(function() { return User.find(1); })
          .then(function(user) { return user.destroy(); })
          .then(function() { return User.find({ where: 1, paranoid: false }); })
          .then(function(user) {
            expect(user).to.exist;
            return User.find(1);
          })
          .then(function(user) {
            expect(user).to.be.null;
            return [User.count(), User.count({ paranoid: false })];
          })
          .spread(function(cnt, cntWithDeleted) {
            expect(cnt).to.equal(2);
            expect(cntWithDeleted).to.equal(3);
          });
      });
    });

    it('should include deleted associated records if include has paranoid marked as false', function() {
        var User = this.sequelize.define('User', {
          username: Sequelize.STRING
        }, { paranoid: true });
        var Pet = this.sequelize.define('Pet', {
          name: Sequelize.STRING,
          UserId: Sequelize.INTEGER
        }, { paranoid: true });

        User.hasMany(Pet);
        Pet.belongsTo(User);

        var user;
        return User.sync({ force: true })
          .then(function() { return Pet.sync({ force: true }); })
          .then(function() { return User.create({ username: 'Joe' }); })
          .then(function(_user) {
            user = _user;
            return Pet.bulkCreate([
              { name: 'Fido', UserId: user.id },
              { name: 'Fifi', UserId: user.id }
            ]);
          })
          .then(function() { return Pet.find(1); })
          .then(function(pet) { return pet.destroy(); })
          .then(function() {
            return [
              User.find({ where: {id: user.id}, include: Pet }),
              User.find({
                where: {id: user.id},
                include: [{ model: Pet, paranoid: false }]
              })
            ];
          })
          .spread(function(user, userWithDeletedPets) {
            expect(user).to.exist;
            expect(user.Pets).to.have.length(1);
            expect(userWithDeletedPets).to.exist;
            expect(userWithDeletedPets.Pets).to.have.length(2);
          });
    });

    it('should delete a paranoid record if I set force to true', function() {
      var self = this;
      var User = this.sequelize.define('paranoiduser', {
        username: Sequelize.STRING
      }, { paranoid: true });

      return User.sync({ force: true }).then(function() {
        return User.bulkCreate([
          {username: 'Bob'},
          {username: 'Tobi'},
          {username: 'Max'},
          {username: 'Tony'}
        ]);
      }).then(function() {
        return User.find({where: {username: 'Bob'}});
      }).then(function(user) {
        return user.destroy({force: true});
      }).then(function() {
        return expect(User.find({where: {username: 'Bob'}})).to.eventually.be.null;
      }).then(function(user) {
        return User.find({where: {username: 'Tobi'}});
      }).then(function(tobi) {
        return tobi.destroy();
      }).then(function() {
        return self.sequelize.query('SELECT * FROM paranoidusers WHERE username=\'Tobi\'', { plain: true});
      }).then(function(result) {
        expect(result.username).to.equal('Tobi');
        return User.destroy({where: {username: 'Tony'}});
      }).then(function() {
        return self.sequelize.query('SELECT * FROM paranoidusers WHERE username=\'Tony\'', { plain: true});
      }).then(function(result) {
        expect(result.username).to.equal('Tony');
        return User.destroy({where: {username: ['Tony', 'Max']}, force: true});
      }).then(function() {
        return self.sequelize.query('SELECT * FROM paranoidusers', null, {raw: true});
      }).spread(function(users) {
        expect(users).to.have.length(1);
        expect(users[0].username).to.equal('Tobi');
      });
    });

    it('returns the number of affected rows', function() {
      var self = this
        , data = [{ username: 'Peter', secretValue: '42' },
                  { username: 'Paul', secretValue: '42' },
                  { username: 'Bob', secretValue: '43' }];

      return this.User.bulkCreate(data).then(function() {
        return self.User.destroy({where: {secretValue: '42'}}).then(function(affectedRows) {
          expect(affectedRows).to.equal(2);
        });
      }).then(function() {
        return self.User.destroy({where: {secretValue: '44'}}).then(function(affectedRows) {
          expect(affectedRows).to.equal(0);
        });
      });
    });

    it('supports table schema/prefix', function() {
      var self = this
      , data = [{ username: 'Peter', secretValue: '42' },
           { username: 'Paul', secretValue: '42' },
           { username: 'Bob', secretValue: '43' }]
      , prefixUser = self.User.schema('prefix');

      var run = function() {
        return prefixUser.sync({ force: true }).then(function() {
          return prefixUser.bulkCreate(data).then(function() {
            return prefixUser.destroy({where: {secretValue: '42'}}).then(function() {
              return prefixUser.findAll({order: 'id'}).then(function(users) {
                expect(users.length).to.equal(1);
                expect(users[0].username).to.equal('Bob');
              });
            });
          });
        });
      };

      return this.sequelize.queryInterface.dropAllSchemas().then(function() {
        return self.sequelize.queryInterface.createSchema('prefix').then(function() {
          return run.call(self);
        });
      });
    });
  });

  describe('restore', function() {
    it('returns an error if the model is not paranoid', function() {
      var self = this;

      return this.User.create({username: 'Peter', secretValue: '42'})
      .then(function(user) {
        expect(function() {self.User.restore({where: {secretValue: '42'}});}).to.throw(Error, 'Model is not paranoid');
      });
    });

    it('restores a previously deleted model', function() {
      var self = this
        , ParanoidUser = self.sequelize.define('ParanoidUser', {
          username: Sequelize.STRING,
          secretValue: Sequelize.STRING,
          data: Sequelize.STRING,
          intVal: { type: Sequelize.INTEGER, defaultValue: 1}
        }, {
            paranoid: true
          })
        , data = [{ username: 'Peter', secretValue: '42' },
                  { username: 'Paul', secretValue: '43' },
                  { username: 'Bob', secretValue: '44' }];

      return ParanoidUser.sync({ force: true }).then(function() {
        return ParanoidUser.bulkCreate(data);
      }).then(function() {
        return ParanoidUser.destroy({where: {secretValue: '42'}});
      }).then(function() {
        return ParanoidUser.restore({where: {secretValue: '42'}});
      }).then(function() {
        return ParanoidUser.find({where: {secretValue: '42'}});
      }).then(function(user) {
        expect(user).to.be.ok;
        expect(user.username).to.equal('Peter');
      });
    });
  });

  describe('equals', function() {
    it('correctly determines equality of objects', function() {
      return this.User.create({username: 'hallo', data: 'welt'}).then(function(u) {
        expect(u.equals(u)).to.be.ok;
      });
    });

    // sqlite can't handle multiple primary keys
    if (dialect !== 'sqlite') {
      it('correctly determines equality with multiple primary keys', function() {
        var userKeys = this.sequelize.define('userkeys', {
          foo: {type: Sequelize.STRING, primaryKey: true},
          bar: {type: Sequelize.STRING, primaryKey: true},
          name: Sequelize.STRING,
          bio: Sequelize.TEXT
        });

        return userKeys.sync({ force: true }).then(function() {
          return userKeys.create({foo: '1', bar: '2', name: 'hallo', bio: 'welt'}).then(function(u) {
            expect(u.equals(u)).to.be.ok;
          });
        });
      });
    }
  });

  describe('equalsOneOf', function() {
    // sqlite can't handle multiple primary keys
    if (dialect !== 'sqlite') {
      beforeEach(function() {
        this.userKey = this.sequelize.define('userKeys', {
          foo: {type: Sequelize.STRING, primaryKey: true},
          bar: {type: Sequelize.STRING, primaryKey: true},
          name: Sequelize.STRING,
          bio: Sequelize.TEXT
        });

        return this.userKey.sync({ force: true });
      });

      it('determines equality if one is matching', function() {
        return this.userKey.create({foo: '1', bar: '2', name: 'hallo', bio: 'welt'}).then(function(u) {
          expect(u.equalsOneOf([u, {a: 1}])).to.be.ok;
        });
      });

      it("doesn't determine equality if none is matching", function() {
        return this.userKey.create({foo: '1', bar: '2', name: 'hallo', bio: 'welt'}).then(function(u) {
          expect(u.equalsOneOf([{b: 2}, {a: 1}])).to.not.be.ok;
        });
      });
    }
  });

  describe('count', function() {
    if (current.dialect.supports.transactions) {
      it('supports transactions', function() {
        return Support.prepareTransactionTest(this.sequelize).bind({}).then(function(sequelize) {
          var User = sequelize.define('User', { username: Sequelize.STRING });

          return User.sync({ force: true }).then(function() {
            return sequelize.transaction().then(function(t) {
              return User.create({ username: 'foo' }, { transaction: t }).then(function() {
                return User.count().then(function(count1) {
                  return User.count({ transaction: t }).then(function(count2) {
                    expect(count1).to.equal(0);
                    expect(count2).to.equal(1);
                    return t.rollback();
                  });
                });
              });
            });
          });
        });
      });
    }

    it('counts all created objects', function() {
      var self = this;
      return this.User.bulkCreate([{username: 'user1'}, {username: 'user2'}]).then(function() {
        return self.User.count().then(function(count) {
          expect(count).to.equal(2);
        });
      });
    });
    it('returns multiple rows when using group', function() {
      var self = this;
      return this.User.bulkCreate([
        {username: 'user1', data: 'A'},
        {username: 'user2', data: 'A'},
        {username: 'user3', data: 'B'}
      ]).then(function() {
        return self.User.count({
          attributes: ['data'],
          group: ['data']
        }).then(function(count) {
          expect(count.length).to.equal(2);
        });
      });
    });

    it('does not modify the passed arguments', function() {
      var options = { where: ['username = ?', 'user1']};

      return this.User.count(options).then(function(count) {
        expect(options).to.deep.equal({ where: ['username = ?', 'user1']});
      });
    });

    it('allows sql logging', function() {
      return this.User.count().on('sql', function(sql) {
        expect(sql).to.exist;
        expect(sql.toUpperCase().indexOf('SELECT')).to.be.above(-1);
      });
    });

    it('filters object', function() {
      var self = this;
      return this.User.create({username: 'user1'}).then(function() {
        return self.User.create({username: 'foo'}).then(function() {
          return self.User.count({where: "username LIKE '%us%'"}).then(function(count) {
            expect(count).to.equal(1);
          });
        });
      });
    });

    it('supports distinct option', function() {
      var Post = this.sequelize.define('Post', {});
      var PostComment = this.sequelize.define('PostComment', {});
      Post.hasMany(PostComment);
      return Post.sync({ force: true }).then(function() {
        return PostComment.sync({ force: true }).then(function() {
          return Post.create({}).then(function(post) {
            return PostComment.bulkCreate([{ PostId: post.id },{ PostId: post.id }]).then(function() {
              return Post.count({ include: [{ model: PostComment, required: false }] }).then(function(count1) {
                return Post.count({ distinct: true, include: [{ model: PostComment, required: false }] }).then(function(count2) {
                  expect(count1).to.equal(2);
                  expect(count2).to.equal(1);
                });
              });
            });
          });
        });
      });
    });

  });

  describe('min', function() {
    beforeEach(function() {
      var self = this;
      this.UserWithAge = this.sequelize.define('UserWithAge', {
        age: Sequelize.INTEGER
      });

      this.UserWithDec = this.sequelize.define('UserWithDec', {
        value: Sequelize.DECIMAL(10, 3)
      });

      return this.UserWithAge.sync({ force: true }).then(function() {
        return self.UserWithDec.sync({ force: true });
      });
    });

    if (current.dialect.supports.transactions) {
      it('supports transactions', function() {
        return Support.prepareTransactionTest(this.sequelize).bind({}).then(function(sequelize) {
          var User = sequelize.define('User', { age: Sequelize.INTEGER });

          return User.sync({ force: true }).then(function() {
            return sequelize.transaction().then(function(t) {
              return User.bulkCreate([{ age: 2 }, { age: 5 }, { age: 3 }], { transaction: t }).then(function() {
                return User.min('age').then(function(min1) {
                  return User.min('age', { transaction: t }).then(function(min2) {
                    expect(min1).to.be.not.ok;
                    expect(min2).to.equal(2);
                    return t.rollback();
                  });
                });
              });
            });
          });
        });
      });
    }

    it('should return the min value', function() {
      var self = this;
      return this.UserWithAge.bulkCreate([{age: 3}, { age: 2 }]).then(function() {
        return self.UserWithAge.min('age').then(function(min) {
          expect(min).to.equal(2);
        });
      });
    });

    it('allows sql logging', function() {
      return this.UserWithAge.min('age').on('sql', function(sql) {
        expect(sql).to.exist;
        expect(sql.toUpperCase().indexOf('SELECT')).to.be.above(-1);
      });
    });

    it('should allow decimals in min', function() {
      var self = this;
      return this.UserWithDec.bulkCreate([{value: 5.5}, {value: 3.5}]).then(function() {
        return self.UserWithDec.min('value').then(function(min) {
          expect(min).to.equal(3.5);
        });
      });
    });

    it('should allow strings in min', function() {
      var self = this;
      return this.User.bulkCreate([{username: 'bbb'}, {username: 'yyy'}]).then(function() {
        return self.User.min('username').then(function(min) {
          expect(min).to.equal('bbb');
        });
      });
    });

    it('should allow dates in min', function() {
      var self = this;
      return this.User.bulkCreate([{theDate: new Date(2000, 1, 1)}, {theDate: new Date(1990, 1, 1)}]).then(function() {
        return self.User.min('theDate').then(function(min) {
          expect(min).to.be.a('Date');
          expect(new Date(1990, 1, 1)).to.equalDate(min);
        });
      });
    });
  });

  describe('max', function() {
    beforeEach(function() {
      var self = this;
      this.UserWithAge = this.sequelize.define('UserWithAge', {
        age: Sequelize.INTEGER,
        order: Sequelize.INTEGER
      });

      this.UserWithDec = this.sequelize.define('UserWithDec', {
        value: Sequelize.DECIMAL(10, 3)
      });

      return this.UserWithAge.sync({ force: true }).then(function() {
        return self.UserWithDec.sync({ force: true });
      });
    });

    if (current.dialect.supports.transactions) {
      it('supports transactions', function() {
        return Support.prepareTransactionTest(this.sequelize).bind({}).then(function(sequelize) {
          var User = sequelize.define('User', { age: Sequelize.INTEGER });

          return User.sync({ force: true }).then(function() {
            return sequelize.transaction().then(function(t) {
              return User.bulkCreate([{ age: 2 }, { age: 5 }, { age: 3 }], { transaction: t }).then(function() {
                return User.max('age').then(function(min1) {
                  return User.max('age', { transaction: t }).then(function(min2) {
                    expect(min1).to.be.not.ok;
                    expect(min2).to.equal(5);
                    return t.rollback();
                  });
                });
              });
            });
          });
        });
      });
    }

    it('should return the max value for a field named the same as an SQL reserved keyword', function() {
      var self = this;
      return this.UserWithAge.bulkCreate([{age: 2, order: 3}, {age: 3, order: 5}]).then(function() {
        return self.UserWithAge.max('order').then(function(max) {
          expect(max).to.equal(5);
        });
      });
    });

    it('should return the max value', function() {
      var self = this;
      return self.UserWithAge.bulkCreate([{age: 2}, {age: 3}]).then(function() {
        return self.UserWithAge.max('age').then(function(max) {
          expect(max).to.equal(3);
        });
      });
    });

    it('should allow decimals in max', function() {
      var self = this;
      return this.UserWithDec.bulkCreate([{value: 3.5}, {value: 5.5}]).then(function() {
        return self.UserWithDec.max('value').then(function(max) {
          expect(max).to.equal(5.5);
        });
      });
    });

    it('should allow dates in max', function() {
      var self = this;
      return this.User.bulkCreate([
        {theDate: new Date(2013, 11, 31)},
        {theDate: new Date(2000, 1, 1)}
      ]).then(function() {
        return self.User.max('theDate').then(function(max) {
          expect(max).to.be.a('Date');
          expect(max).to.equalDate(new Date(2013, 11, 31));
        });
      });
    });

    it('should allow strings in max', function() {
      var self = this;
      return this.User.bulkCreate([{username: 'aaa'}, {username: 'zzz'}]).then(function() {
        return self.User.max('username').then(function(max) {
          expect(max).to.equal('zzz');
        });
      });
    });

    it('allows sql logging', function() {
      return this.UserWithAge.max('age').on('sql', function(sql) {
        expect(sql).to.exist;
        expect(sql.toUpperCase().indexOf('SELECT')).to.be.above(-1);
      });
    });
  });

  describe('sum', function() {
    beforeEach(function() {
      var self = this;
      this.UserWithAge = this.sequelize.define('UserWithAge', {
        age: Sequelize.INTEGER,
        order: Sequelize.INTEGER,
        gender: Sequelize.ENUM('male', 'female')
      });

      this.UserWithDec = this.sequelize.define('UserWithDec', {
        value: Sequelize.DECIMAL(10, 3)
      });

      return this.UserWithAge.sync({ force: true }).then(function() {
        return self.UserWithDec.sync({ force: true });
      });
    });

    it('should return the sum of the values for a field named the same as an SQL reserved keyword', function() {
      var self = this;
      return this.UserWithAge.bulkCreate([{age: 2, order: 3}, {age: 3, order: 5}]).then(function() {
        return self.UserWithAge.sum('order').then(function(sum) {
          expect(sum).to.equal(8);
        });
      });
    });

    it('should return the sum of a field in various records', function() {
      var self = this;
      return self.UserWithAge.bulkCreate([{age: 2}, {age: 3}]).then(function() {
        return self.UserWithAge.sum('age').then(function(sum) {
          expect(sum).to.equal(5);
        });
      });
    });

    it('should allow decimals in sum', function() {
      var self = this;
      return this.UserWithDec.bulkCreate([{value: 3.5}, {value: 5.25}]).then(function() {
        return self.UserWithDec.sum('value').then(function(sum) {
          expect(sum).to.equal(8.75);
        });
      });
    });

    it('should accept a where clause', function() {
      var options = { where: { 'gender': 'male' }};

      var self = this;
      return self.UserWithAge.bulkCreate([{age: 2, gender: 'male'}, {age: 3, gender: 'female'}]).then(function() {
        return self.UserWithAge.sum('age', options).then(function(sum) {
          expect(sum).to.equal(2);
        });
      });
    });

    it('allows sql logging', function() {
      return this.UserWithAge.sum('age').on('sql', function(sql) {
        expect(sql).to.exist;
        expect(sql.toUpperCase().indexOf('SELECT')).to.be.above(-1);
      });
    });
  });

  describe('schematic support', function() {
    beforeEach(function() {
      var self = this;

      this.UserPublic = this.sequelize.define('UserPublic', {
        age: Sequelize.INTEGER
      });

      this.UserSpecial = this.sequelize.define('UserSpecial', {
        age: Sequelize.INTEGER
      });

      return self.sequelize.dropAllSchemas().then(function() {
        return self.sequelize.createSchema('schema_test').then(function() {
          return self.sequelize.createSchema('special').then(function() {
            return self.UserSpecial.schema('special').sync({force: true}).then(function(UserSpecialSync) {
              self.UserSpecialSync = UserSpecialSync;
            });
          });
        });
      });
    });

    it('should be able to drop with schemas', function() {
      return this.UserSpecial.drop();
    });

    it('should be able to list schemas', function() {
      return this.sequelize.showAllSchemas().then(function(schemas) {
        expect(schemas).to.be.instanceof(Array);

        // FIXME: reenable when schema support is properly added
        if (dialect !== 'mssql') {
          // sqlite & MySQL doesn't actually create schemas unless Model.sync() is called
          // Postgres supports schemas natively
          expect(schemas).to.have.length((dialect === 'postgres' ? 2 : 1));
        }

      });
    });

    if (Support.dialectIsMySQL() || dialect === 'sqlite') {
      it('should take schemaDelimiter into account if applicable', function() {
        var UserSpecialUnderscore = this.sequelize.define('UserSpecialUnderscore', {age: Sequelize.INTEGER}, {schema: 'hello', schemaDelimiter: '_'});
        var UserSpecialDblUnderscore = this.sequelize.define('UserSpecialDblUnderscore', {age: Sequelize.INTEGER});
        return UserSpecialUnderscore.sync({force: true}).then(function(User) {
          return UserSpecialDblUnderscore.schema('hello', '__').sync({force: true}).then(function(DblUser) {
            return DblUser.create({age: 3}).on('sql', function(dblSql) {
              expect(dblSql).to.exist;
              expect(dblSql.indexOf('INSERT INTO `hello__UserSpecialDblUnderscores`')).to.be.above(-1);
            }).then(function() {
              return User.create({age: 3}).on('sql', function(sql) {
                expect(sql).to.exist;
                expect(sql.indexOf('INSERT INTO `hello_UserSpecialUnderscores`')).to.be.above(-1);
              });
            });
          });
        });
      });
    }

    it('should describeTable using the default schema settings', function() {
      var self = this
        , UserPublic = this.sequelize.define('Public', {
            username: Sequelize.STRING
          })
        , count = 0;

      return UserPublic.sync({ force: true }).then(function() {
        return UserPublic.schema('special').sync({ force: true }).then(function() {
          return self.sequelize.queryInterface.describeTable('Publics')
          .on('sql', function(sql) {
            if (dialect === 'sqlite' || Support.dialectIsMySQL() || dialect === 'mssql') {
              expect(sql).to.not.contain('special');
              count++;
            }
          })
          .then(function(table) {
            if (dialect === 'postgres') {
              expect(table.id.defaultValue).to.not.contain('special');
              count++;
            }

            return self.sequelize.queryInterface.describeTable('Publics', 'special')
            .on('sql', function(sql) {
              if (dialect === 'sqlite' || Support.dialectIsMySQL() || dialect === 'mssql') {
                expect(sql).to.contain('special');
                count++;
              }
            })
            .then(function(table) {
              if (dialect === 'postgres') {
                expect(table.id.defaultValue).to.contain('special');
                count++;
              }
            });
          }).then(function() {
            expect(count).to.equal(2);
          });
        });
      });
    });

    it('should be able to reference a table with a schema set', function() {
      var self = this;

      var UserPub = this.sequelize.define('UserPub', {
        username: Sequelize.STRING
      }, { schema: 'prefix' });

      var ItemPub = this.sequelize.define('ItemPub', {
        name: Sequelize.STRING
      }, { schema: 'prefix' });

      UserPub.hasMany(ItemPub, {
        foreignKeyConstraint: true
      });

      var run = function() {
        return UserPub.sync({ force: true }).then(function() {
          return ItemPub.sync({ force: true, logging: _.after(2, _.once(function(sql) {
            if (dialect === 'postgres') {
              expect(sql).to.match(/REFERENCES\s+"prefix"\."UserPubs" \("id"\)/);
            } else if (dialect === 'mssql') {
              expect(sql).to.match(/REFERENCES\s+\[prefix\]\.\[UserPubs\] \(\[id\]\)/);
            } else {
              expect(sql).to.match(/REFERENCES\s+`prefix\.UserPubs` \(`id`\)/);
            }

          }))});
        });
      };

      if (dialect === 'postgres') {
        return this.sequelize.queryInterface.dropAllSchemas().then(function() {
          return self.sequelize.queryInterface.createSchema('prefix').then(function() {
            return run.call(self);
          });
        });
      } else {
        return run.call(self);
      }
    });

    it('should be able to create and update records under any valid schematic', function() {
      var self = this;
      return self.UserPublic.sync({ force: true }).then(function(UserPublicSync) {
        return UserPublicSync.create({age: 3}).on('sql', function(UserPublic) {
          expect(UserPublic).to.exist;
          if (dialect === 'postgres') {
            expect(self.UserSpecialSync.getTableName().toString()).to.equal('"special"."UserSpecials"');
            expect(UserPublic.indexOf('INSERT INTO "UserPublics"')).to.be.above(-1);
          } else if (dialect === 'sqlite') {
            expect(self.UserSpecialSync.getTableName().toString()).to.equal('`special.UserSpecials`');
            expect(UserPublic.indexOf('INSERT INTO `UserPublics`')).to.be.above(-1);
          } else if (dialect === 'mssql') {
            expect(self.UserSpecialSync.getTableName().toString()).to.equal('[special].[UserSpecials]');
            expect(UserPublic.indexOf('INSERT INTO [UserPublics]')).to.be.above(-1);
          } else {
            expect(self.UserSpecialSync.getTableName().toString()).to.equal('`special.UserSpecials`');
            expect(UserPublic.indexOf('INSERT INTO `UserPublics`')).to.be.above(-1);
          }
        })
        .then(function(UserPublic) {
          return self.UserSpecialSync.schema('special').create({age: 3})
          .on('sql', function(UserSpecial) {
            expect(UserSpecial).to.exist;
            if (dialect === 'postgres') {
              expect(UserSpecial.indexOf('INSERT INTO "special"."UserSpecials"')).to.be.above(-1);
            } else if (dialect === 'sqlite') {
              expect(UserSpecial.indexOf('INSERT INTO `special.UserSpecials`')).to.be.above(-1);
            } else if (dialect === 'mssql') {
              expect(UserSpecial.indexOf('INSERT INTO [special].[UserSpecials]')).to.be.above(-1);
            } else {
              expect(UserSpecial.indexOf('INSERT INTO `special.UserSpecials`')).to.be.above(-1);
            }
          })
          .then(function(UserSpecial) {
            return UserSpecial.updateAttributes({age: 5})
            .on('sql', function(user) {
              expect(user).to.exist;
              if (dialect === 'postgres') {
                expect(user.indexOf('UPDATE "special"."UserSpecials"')).to.be.above(-1);
              } else if (dialect === 'mssql') {
                expect(user.indexOf('UPDATE [special].[UserSpecials]')).to.be.above(-1);
              } else {
                expect(user.indexOf('UPDATE `special.UserSpecials`')).to.be.above(-1);
              }
            });
          });
        });
      });
    });
  });

  describe('references', function() {
    beforeEach(function() {
      var self = this;

      this.Author = this.sequelize.define('author', { firstName: Sequelize.STRING });

      return this.sequelize.getQueryInterface().dropTable('posts', { force: true }).then(function() {
        return self.sequelize.getQueryInterface().dropTable('authors', { force: true });
      }).then(function() {
        return self.Author.sync();
      });
    });

    it('uses an existing dao factory and references the author table', function() {
      var self = this
        , Post = this.sequelize.define('post', {
            title: Sequelize.STRING,
            authorId: {
              type: Sequelize.INTEGER,
              references: this.Author,
              referencesKey: 'id'
            }
          });

      this.Author.hasMany(Post);
      Post.belongsTo(this.Author);

      // The posts table gets dropped in the before filter.
      return Post.sync({logging: _.once(function(sql) {
        if (dialect === 'postgres') {
          expect(sql).to.match(/"authorId" INTEGER REFERENCES "authors" \("id"\)/);
        } else if (Support.dialectIsMySQL()) {
          expect(sql).to.match(/FOREIGN KEY \(`authorId`\) REFERENCES `authors` \(`id`\)/);
        } else if (dialect === 'mssql') {
          expect(sql).to.match(/FOREIGN KEY \(\[authorId\]\) REFERENCES \[authors\] \(\[id\]\)/);
        } else if (dialect === 'sqlite') {
          expect(sql).to.match(/`authorId` INTEGER REFERENCES `authors` \(`id`\)/);
        } else {
          throw new Error('Undefined dialect!');
        }
      })});
    });

    it('uses a table name as a string and references the author table', function() {
      var self = this
        , Post = self.sequelize.define('post', {
            title: Sequelize.STRING,
            authorId: {
              type: Sequelize.INTEGER,
              references: 'authors',
              referencesKey: 'id'
            }
          });

      this.Author.hasMany(Post);
      Post.belongsTo(this.Author);

      // The posts table gets dropped in the before filter.
      return Post.sync({logging: _.once(function(sql) {
        if (dialect === 'postgres') {
          expect(sql).to.match(/"authorId" INTEGER REFERENCES "authors" \("id"\)/);
        } else if (Support.dialectIsMySQL()) {
          expect(sql).to.match(/FOREIGN KEY \(`authorId`\) REFERENCES `authors` \(`id`\)/);
        } else if (dialect === 'sqlite') {
          expect(sql).to.match(/`authorId` INTEGER REFERENCES `authors` \(`id`\)/);
        } else if (dialect === 'mssql') {
          expect(sql).to.match(/FOREIGN KEY \(\[authorId\]\) REFERENCES \[authors\] \(\[id\]\)/);
        } else {
          throw new Error('Undefined dialect!');
        }
      })});
    });

    it('emits an error event as the referenced table name is invalid', function() {
      var self = this
        , Post = this.sequelize.define('post', {
            title: Sequelize.STRING,
            authorId: {
              type: Sequelize.INTEGER,
              references: '4uth0r5',
              referencesKey: 'id'
            }
          });

      this.Author.hasMany(Post);
      Post.belongsTo(this.Author);

      // The posts table gets dropped in the before filter.
      return Post.sync().then(function() {
        if (dialect === 'sqlite') {
          // sorry ... but sqlite is too stupid to understand whats going on ...
          expect(1).to.equal(1);
        } else {
          // the parser should not end up here ...
          expect(2).to.equal(1);
        }

        return;
      }).catch (function(err) {
        if (Support.dialectIsMySQL(true)) {
          expect(err.message).to.match(/ER_CANNOT_ADD_FOREIGN|ER_CANT_CREATE_TABLE/);
        } else if (dialect === 'mariadb') {
          expect(err.message).to.match(/Can\'t create table/);
        } else if (dialect === 'sqlite') {
          // the parser should not end up here ... see above
          expect(1).to.equal(2);
        } else if (dialect === 'postgres') {
          expect(err.message).to.match(/relation "4uth0r5" does not exist/);
        } else if (dialect === 'mssql') {
          expect(err.message).to.match(/Could not create constraint/);
        } else {
          throw new Error('Undefined dialect!');
        }
      });
    });

    it('works with comments', function() {
      // Test for a case where the comment was being moved to the end of the table when there was also a reference on the column, see #1521
      var Member = this.sequelize.define('Member', {})
        , Profile = this.sequelize.define('Profile', {
        id: {
          type: Sequelize.INTEGER,
          primaryKey: true,
          references: Member,
          referencesKey: 'id',
          autoIncrement: false,
          comment: 'asdf'
        }
      });

      return this.sequelize.sync({ force: true });
    });
  });

  describe('blob', function() {
    beforeEach(function() {
      this.BlobUser = this.sequelize.define('blobUser', {
        data: Sequelize.BLOB
      });

      return this.BlobUser.sync({ force: true });
    });

    describe('buffers', function() {
      it('should be able to take a buffer as parameter to a BLOB field', function() {
        return this.BlobUser.create({
          data: new Buffer('Sequelize')
        }).then(function(user) {
          expect(user).to.be.ok;
        });
      });

      it('should return a buffer when fetching a blob', function() {
        var self = this;
        return this.BlobUser.create({
          data: new Buffer('Sequelize')
        }).then(function(user) {
          return self.BlobUser.find(user.id).then(function(user) {
            expect(user.data).to.be.an.instanceOf(Buffer);
            expect(user.data.toString()).to.have.string('Sequelize');
          });
        });
      });

      it('should work when the database returns null', function() {
        var self = this;
        return this.BlobUser.create({
          // create a null column
        }).then(function(user) {
          return self.BlobUser.find(user.id).then(function(user) {
            expect(user.data).to.be.null;
          });
        });
      });
    });

    if (dialect !== 'mssql') {
      // NOTE: someone remember to inform me about the intent of these tests. Are
      //       you saying that data passed in as a string is automatically converted
      //       to binary? i.e. "Sequelize" is CAST as binary, OR that actual binary
      //       data is passed in, in string form? Very unclear, and very different.

      describe('strings', function() {
        it('should be able to take a string as parameter to a BLOB field', function() {
          return this.BlobUser.create({
            data: 'Sequelize'
          }).then(function(user) {
            expect(user).to.be.ok;
          });
        });

        it('should return a buffer when fetching a BLOB, even when the BLOB was inserted as a string', function() {
          var self = this;
          return this.BlobUser.create({
            data: 'Sequelize'
          }).then(function(user) {
            return self.BlobUser.find(user.id).then(function(user) {
              expect(user.data).to.be.an.instanceOf(Buffer);
              expect(user.data.toString()).to.have.string('Sequelize');
            });
          });
        });
      });
    }

  });

  describe('paranoid is true and where is an array', function() {

    beforeEach(function() {
      this.User = this.sequelize.define('User', {username: DataTypes.STRING }, { paranoid: true });
      this.Project = this.sequelize.define('Project', { title: DataTypes.STRING }, { paranoid: true });

      this.Project.hasMany(this.User);
      this.User.hasMany(this.Project);

      var self = this;
      return this.sequelize.sync({ force: true }).then(function() {
        return self.User.bulkCreate([{
          username: 'leia'
        }, {
          username: 'luke'
        }, {
          username: 'vader'
        }]).then(function() {
          return self.Project.bulkCreate([{
            title: 'republic'
          },{
            title: 'empire'
          }]).then(function() {
            return self.User.findAll().then(function(users) {
              return self.Project.findAll().then(function(projects) {
                var leia = users[0]
                  , luke = users[1]
                  , vader = users[2]
                  , republic = projects[0]
                  , empire = projects[1];
                return leia.setProjects([republic]).then(function() {
                  return luke.setProjects([republic]).then(function() {
                    return vader.setProjects([empire]).then(function() {
                      return leia.destroy();
                    });
                  });
                });
              });
            });
          });
        });
      });
    });

    it('should not fail when array contains Sequelize.or / and', function() {
      return this.User.findAll({
        where: [
          this.sequelize.or({ username: 'vader' }, { username: 'luke' }),
          this.sequelize.and({ id: [1, 2, 3] })
        ]
      })
        .then(function(res) {
          expect(res).to.have.length(2);
        });
    });

    it('should not fail with an include', function() {
      return this.User.findAll({
        where: [
          this.sequelize.queryInterface.QueryGenerator.quoteIdentifiers('Projects.title') + ' = ' + this.sequelize.queryInterface.QueryGenerator.escape('republic')
        ],
        include: [
          {model: this.Project}
        ]
      }).then(function(users) {
        expect(users.length).to.be.equal(1);
        expect(users[0].username).to.be.equal('luke');
      });
    });

    it('should not overwrite a specified deletedAt by setting paranoid: false', function() {
      var tableName = '';
      if (this.User.name) {
        tableName = this.sequelize.queryInterface.QueryGenerator.quoteIdentifier(this.User.name) + '.';
      }
      return this.User.findAll({
        paranoid: false,
        where: [
          tableName + this.sequelize.queryInterface.QueryGenerator.quoteIdentifier('deletedAt') + ' IS NOT NULL '
        ],
        include: [
          {model: this.Project}
        ]
      }).then(function(users) {
        expect(users.length).to.be.equal(1);
        expect(users[0].username).to.be.equal('leia');
      });
    });

    it('should not overwrite a specified deletedAt (complex query) by setting paranoid: false', function() {
      return this.User.findAll({
        paranoid: false,
        where: [
          this.sequelize.or({ username: 'leia' }, { username: 'luke' }),
          this.sequelize.and(
            { id: [1, 2, 3] },
            this.sequelize.or({ deletedAt: null }, { deletedAt: { gt: new Date(0) } })
          )
        ]
      })
        .then(function(res) {
          expect(res).to.have.length(2);
        });
    });

  });

  if (dialect !== 'sqlite' && current.dialect.supports.transactions) {
    it('supports multiple async transactions', function() {
      this.timeout(25000);
      var self = this;
      return Support.prepareTransactionTest(this.sequelize).bind({}).then(function(sequelize) {
        var User = sequelize.define('User', { username: Sequelize.STRING });
        var testAsync = function() {
          return sequelize.transaction().then(function(t) {
            return User.create({
              username: 'foo'
            }, {
              transaction: t
            }).then(function() {
              return User.findAll({
                where: {
                  username: 'foo'
                }
              }).then(function(users) {
                expect(users).to.have.length(0);
              });
            }).then(function() {
              return User.findAll({
                where: {
                  username: 'foo'
                },
                transaction: t
              }).then(function(users) {
                expect(users).to.have.length(1);
              });
            }).then(function() {
              return t;
            });
          }).then(function(t) {
            return t.rollback();
          });
        };
        return User.sync({ force: true }).then(function() {
          var tasks = [];
          for (var i = 0; i < 1000; i++) {
            tasks.push(testAsync.bind(this));
          }
          return self.sequelize.Promise.resolve(tasks).map(function(entry) {
            return entry();
          }, {
            // Needs to be one less than ??? else the non transaction query won't ever get a connection
            concurrency: (sequelize.config.pool && sequelize.config.pool.max || 5) - 1
          });
        });
      });
    });
  }

  describe('Unique', function() {
    it('should set unique when unique is true', function() {
      var self = this;
      var uniqueTrue = self.sequelize.define('uniqueTrue', {
        str: { type: Sequelize.STRING, unique: true }
      });

      return uniqueTrue.sync({force: true, logging: _.after(2, _.once(function(s) {
        expect(s).to.match(/UNIQUE/);
      }))});
    });

    it('should not set unique when unique is false', function() {
      var self = this;
      var uniqueFalse = self.sequelize.define('uniqueFalse', {
        str: { type: Sequelize.STRING, unique: false }
      });

      return uniqueFalse.sync({force: true, logging: _.after(2, _.once(function(s) {
        expect(s).not.to.match(/UNIQUE/);
      }))});
    });

    it('should not set unique when unique is unset', function() {
      var self = this;
      var uniqueUnset = self.sequelize.define('uniqueUnset', {
        str: { type: Sequelize.STRING }
      });

      return uniqueUnset.sync({force: true, logging: _.after(2, _.once(function(s) {
        expect(s).not.to.match(/UNIQUE/);
      }))});
    });
  });

  it('should be possible to use a key named UUID as foreign key', function() {
    var project = this.sequelize.define('project', {
      UserId: {
        type: Sequelize.STRING,
        references: 'Users',
        referencesKey: 'UUID'
      }
    });

    var user = this.sequelize.define('Users', {
      UUID: {
        type: Sequelize.STRING,
        primaryKey: true,
        unique: true,
        allowNull: false,
        validate: {
          notNull: true,
          notEmpty: true
        }
      }
    });

    return this.sequelize.sync({force: true});
  });

  describe('bulkCreate errors', function() {
    it('should return array of errors if validate and individualHooks are true', function() {
      var self = this
        , data = [{ username: null },
                  { username: null },
                  { username: null }];

      var user = this.sequelize.define('Users', {
        username: {
          type: Sequelize.STRING,
          allowNull: false,
          validate: {
            notNull: true,
            notEmpty: true
          }
        }
      });

      return user.bulkCreate(data, {
        validate: true,
        individualHooks: true
      })
      .catch(function(errors) {
        expect(errors).to.be.instanceof(Array);
      });
    });
  });
});
