'use strict';

/* jshint -W030 */
var chai = require('chai')
  , Sequelize = require('../../../index')
  , expect = chai.expect
  , Support = require(__dirname + '/../support')
  , dialect = Support.getTestDialect()
  , DataTypes = require(__dirname + '/../../../lib/data-types');

chai.config.includeStack = true;

describe(Support.getTestDialectTeaser('DAO'), function() {
  describe('Values', function() {
    describe('set', function() {
      it('doesn\'t overwrite generated primary keys', function() {
        var User = this.sequelize.define('User', {
          name: {type: DataTypes.STRING}
        });

        var user = User.build({id: 1, name: 'Mick'});

        expect(user.get('id')).to.equal(1);
        expect(user.get('name')).to.equal('Mick');
        user.set({
          id: 2,
          name: 'Jan'
        });
        expect(user.get('id')).to.equal(1);
        expect(user.get('name')).to.equal('Jan');
      });

      it('doesn\'t overwrite defined primary keys', function() {
        var User = this.sequelize.define('User', {
          identifier: {type: DataTypes.STRING, primaryKey: true}
        });

        var user = User.build({identifier: 'identifier'});

        expect(user.get('identifier')).to.equal('identifier');
        user.set('identifier', 'another identifier');
        expect(user.get('identifier')).to.equal('identifier');
      });

      it('doesn\'t set timestamps', function() {
        var User = this.sequelize.define('User', {
          identifier: {type: DataTypes.STRING, primaryKey: true}
        });

        var user = User.build({}, {
          isNewRecord: false
        });

        user.set({
          createdAt: new Date(2000, 1, 1),
          updatedAt: new Date(2000, 1, 1)
        });

        expect(user.get('createdAt')).not.to.be.ok;
        expect(user.get('updatedAt')).not.to.be.ok;
      });

      it('doesn\'t set underscored timestamps', function() {
        var User = this.sequelize.define('User', {
          identifier: {type: DataTypes.STRING, primaryKey: true}
        }, {
          underscored: true
        });

        var user = User.build({}, {
          isNewRecord: false
        });

        user.set({
          created_at: new Date(2000, 1, 1),
          updated_at: new Date(2000, 1, 1)
        });

        expect(user.get('created_at')).not.to.be.ok;
        expect(user.get('updated_at')).not.to.be.ok;
      });

      it('doesn\'t set value if not a dynamic setter or a model attribute', function() {
        var User = this.sequelize.define('User', {
          name: {type: DataTypes.STRING},
          email_hidden: {type: DataTypes.STRING}
        }, {
          setterMethods: {
            email_secret: function(value) {
              this.set('email_hidden', value);
            }
          }
        });

        var user = User.build();

        user.set({
          name: 'antonio banderaz',
          email: 'antonio@banderaz.com',
          email_secret: 'foo@bar.com'
        });

        user.set('email', 'antonio@banderaz.com');

        expect(user.get('name')).to.equal('antonio banderaz');
        expect(user.get('email_hidden')).to.equal('foo@bar.com');
        expect(user.get('email')).not.to.be.ok;
        expect(user.dataValues.email).not.to.be.ok;
      });

      it('allows use of sequelize.fn and sequelize.col in date and bool fields', function() {
        var self = this
          , User = this.sequelize.define('User', {
              d: DataTypes.DATE,
              b: DataTypes.BOOLEAN,
              always_false: {
                type: DataTypes.BOOLEAN,
                defaultValue: false
              }
            }, {timestamps: false});

        return User.sync({ force: true }).then(function() {
          return User.create({}).then(function(user) {
            // Create the user first to set the proper default values. PG does not support column references in insert,
            // so we must create a record with the right value for always_false, then reference it in an update
            var now = dialect === 'sqlite' ? self.sequelize.fn('', self.sequelize.fn('datetime', 'now')) : self.sequelize.fn('NOW');
            if (dialect === 'mssql') {
              now = self.sequelize.fn('', self.sequelize.fn('getdate'));
            }
            user.set({
              d: now,
              b: self.sequelize.col('always_false')
            });

            expect(user.get('d')).to.be.instanceof(self.sequelize.Utils.fn);
            expect(user.get('b')).to.be.instanceof(self.sequelize.Utils.col);

            return user.save().then(function() {
              return user.reload().then(function() {
                expect(user.d).to.equalDate(new Date());
                expect(user.b).to.equal(false);
              });
            });
          });
        });
      });

      describe('includes', function() {
        it('should support basic includes', function() {
          var Product = this.sequelize.define('product', {
            title: Sequelize.STRING
          });
          var Tag = this.sequelize.define('tag', {
            name: Sequelize.STRING
          });
          var User = this.sequelize.define('user', {
            first_name: Sequelize.STRING,
            last_name: Sequelize.STRING
          });

          Product.hasMany(Tag);
          Product.belongsTo(User);

          var product;
          product = Product.build({}, {
            include: [
              User,
              Tag
            ]
          });

          product.set({
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
          });

          expect(product.tags).to.be.ok;
          expect(product.tags.length).to.equal(2);
          expect(product.tags[0].Model).to.equal(Tag);
          expect(product.user).to.be.ok;
          expect(product.user.Model).to.equal(User);
        });

        it('should support basic includes (with raw: true)', function() {
          var Product = this.sequelize.define('Product', {
            title: Sequelize.STRING
          });
          var Tag = this.sequelize.define('tag', {
            name: Sequelize.STRING
          });
          var User = this.sequelize.define('user', {
            first_name: Sequelize.STRING,
            last_name: Sequelize.STRING
          });

          Product.hasMany(Tag);
          Product.belongsTo(User);

          var product;
          product = Product.build({}, {
            include: [
              User,
              Tag
            ]
          });

          product.set({
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
          }, {raw: true});

          expect(product.tags).to.be.ok;
          expect(product.tags.length).to.equal(2);
          expect(product.tags[0].Model).to.equal(Tag);
          expect(product.user).to.be.ok;
          expect(product.user.Model).to.equal(User);
        });
      });
    });

    describe('get', function() {
      it('should use custom attribute getters in get(key)', function() {
        var Product = this.sequelize.define('Product', {
          price: {
            type: Sequelize.FLOAT,
            get: function() {
              return this.dataValues.price * 100;
            }
          }
        });

        var product = Product.build({
          price: 10
        });
        expect(product.get('price')).to.equal(1000);
      });

      it('should custom virtual getters in get(key)', function() {
        var Product = this.sequelize.define('Product', {
          priceInCents: {
            type: Sequelize.FLOAT
          }
        }, {
          getterMethods: {
            price: function() {
              return this.dataValues.priceInCents / 100;
            }
          }
        });

        var product = Product.build({
          priceInCents: 1000
        });
        expect(product.get('price')).to.equal(10);
      });

      it('should use custom getters in toJSON', function() {
        var Product = this.sequelize.define('Product', {
          price: {
            type: Sequelize.STRING,
            get: function() {
              return this.dataValues.price * 100;
            }
          }
        }, {
          getterMethods: {
            withTaxes: function() {
              return this.get('price') * 1.25;
            }
          }
        });

        var product = Product.build({
          price: 10
        });
        expect(product.toJSON()).to.deep.equal({withTaxes: 1250, price: 1000, id: null});
      });

      it('should work with save', function() {
        var Contact = this.sequelize.define('Contact', {
          first: { type: Sequelize.STRING },
          last: { type: Sequelize.STRING },
          tags: {
            type: Sequelize.STRING,
            get: function(field) {
              var val = this.getDataValue(field);
              return JSON.parse(val);
            },
            set: function(val, field) {
              this.setDataValue(field, JSON.stringify(val));
            }
          }
        });

        return this.sequelize.sync().then(function() {
          var contact = Contact.build({
            first: 'My',
            last: 'Name',
            tags: ['yes', 'no']
          });
          expect(contact.get('tags')).to.deep.equal(['yes', 'no']);

          return contact.save().then(function(me) {
            expect(me.get('tags')).to.deep.equal(['yes', 'no']);
          });
        });
      });

      describe('plain', function() {
        it('should return plain values when true', function() {
          var Product = this.sequelize.define('product', {
            title: Sequelize.STRING
          });
          var User = this.sequelize.define('user', {
            first_name: Sequelize.STRING,
            last_name: Sequelize.STRING
          });

          Product.belongsTo(User);

          var product = Product.build({}, {
            include: [
              User
            ]
          });

          product.set({
            id: 1,
            title: 'Chair',
            user: {
              id: 1,
              first_name: 'Mick',
              last_name: 'Hansen'
            }
          }, {raw: true});

          expect(product.get('user', {plain: true}).$Model).not.to.be.ok;
          expect(product.get({plain: true}).user.$Model).not.to.be.ok;
        });
      });

      describe('clone', function() {
        it('should copy the values', function () {
          var Product = this.sequelize.define('product', {
            title: Sequelize.STRING
          });

          var product = Product.build({
            id: 1,
            title: 'Chair',
          }, {raw: true});

          var values = product.get({clone: true});
          delete values.title;

          expect(product.get({clone: true}).title).to.be.ok;
        });
      });
    });

    describe('changed', function() {
      it('should return false if object was built from database', function() {
        var User = this.sequelize.define('User', {
          name: {type: DataTypes.STRING}
        });

        return User.sync().then(function() {
          return User.create({name: 'Jan Meier'}).then(function(user) {
            expect(user.changed('name')).to.be.false;
            expect(user.changed()).not.to.be.ok;
            expect(user.isDirty).to.be.false;
          });
        });
      });

      it('should return true if previous value is different', function() {
        var User = this.sequelize.define('User', {
          name: {type: DataTypes.STRING}
        });

        var user = User.build({
          name: 'Jan Meier'
        });
        user.set('name', 'Mick Hansen');
        expect(user.changed('name')).to.be.true;
        expect(user.changed()).to.be.ok;
        expect(user.isDirty).to.be.true;
      });

      it('should return false immediately after saving', function() {
        var User = this.sequelize.define('User', {
          name: {type: DataTypes.STRING}
        });

        return User.sync().then(function() {
          var user = User.build({
            name: 'Jan Meier'
          });
          user.set('name', 'Mick Hansen');
          expect(user.changed('name')).to.be.true;
          expect(user.changed()).to.be.ok;
          expect(user.isDirty).to.be.true;

          return user.save().then(function() {
            expect(user.changed('name')).to.be.false;
            expect(user.changed()).not.to.be.ok;
            expect(user.isDirty).to.be.false;
          });
        });
      });

      it('should be available to a afterUpdate hook', function () {
        var User = this.sequelize.define('User', {
          name: {type: DataTypes.STRING}
        });
        var changed;

        User.afterUpdate(function (instance) {
          changed = instance.changed();
          return;
        });

        return User.sync({force: true}).then(function () {
          return User.create({
            name: 'Ford Prefect'
          });
        }).then(function (user) {
          return user.update({
            name: 'Arthur Dent'
          });
        }).then(function (user) {
          expect(changed).to.be.ok;
          expect(changed.length).to.be.ok;
          expect(changed.indexOf('name') > -1).to.be.ok;
          expect(user.changed()).not.to.be.ok;
        });
      });
    });

    describe('previous', function() {
      it('should return the previous value', function() {
        var User = this.sequelize.define('User', {
          name: {type: DataTypes.STRING}
        });

        var user = User.build({
          name: 'Jan Meier'
        });
        user.set('name', 'Mick Hansen');

        expect(user.previous('name')).to.equal('Jan Meier');
        expect(user.get('name')).to.equal('Mick Hansen');
      });
    });
  });
});
