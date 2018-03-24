'use strict';

const chai = require('chai'),
  Sequelize = require('../../../index'),
  expect = chai.expect,
  Support = require(__dirname + '/../support'),
  dialect = Support.getTestDialect(),
  DataTypes = require(__dirname + '/../../../lib/data-types');

describe(Support.getTestDialectTeaser('DAO'), () => {
  describe('Values', () => {
    describe('set', () => {
      it('doesn\'t overwrite generated primary keys', function() {
        const User = this.sequelize.define('User', {
          name: {type: DataTypes.STRING}
        });

        const user = User.build({id: 1, name: 'Mick'});

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
        const User = this.sequelize.define('User', {
          identifier: {type: DataTypes.STRING, primaryKey: true}
        });

        const user = User.build({identifier: 'identifier'});

        expect(user.get('identifier')).to.equal('identifier');
        user.set('identifier', 'another identifier');
        expect(user.get('identifier')).to.equal('identifier');
      });

      it('doesn\'t set timestamps', function() {
        const User = this.sequelize.define('User', {
          identifier: {type: DataTypes.STRING, primaryKey: true}
        });

        const user = User.build({}, {
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
        const User = this.sequelize.define('User', {
          identifier: {type: DataTypes.STRING, primaryKey: true}
        }, {
          underscored: true
        });

        const user = User.build({}, {
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
        const User = this.sequelize.define('User', {
          name: {type: DataTypes.STRING},
          email_hidden: {type: DataTypes.STRING}
        }, {
          setterMethods: {
            email_secret(value) {
              this.set('email_hidden', value);
            }
          }
        });

        const user = User.build();

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
        const self = this,
          User = this.sequelize.define('User', {
            d: DataTypes.DATE,
            b: DataTypes.BOOLEAN,
            always_false: {
              type: DataTypes.BOOLEAN,
              defaultValue: false
            }
          }, {timestamps: false});

        return User.sync({ force: true }).then(() => {
          return User.create({}).then(user => {
            // Create the user first to set the proper default values. PG does not support column references in insert,
            // so we must create a record with the right value for always_false, then reference it in an update
            let now = dialect === 'sqlite' ? self.sequelize.fn('', self.sequelize.fn('datetime', 'now')) : self.sequelize.fn('NOW');
            if (dialect === 'mssql') {
              now = self.sequelize.fn('', self.sequelize.fn('getdate'));
            }
            user.set({
              d: now,
              b: self.sequelize.col('always_false')
            });

            expect(user.get('d')).to.be.instanceof(self.sequelize.Utils.Fn);
            expect(user.get('b')).to.be.instanceof(self.sequelize.Utils.Col);

            return user.save().then(() => {
              return user.reload().then(() => {
                expect(user.d).to.equalDate(new Date());
                expect(user.b).to.equal(false);
              });
            });
          });
        });
      });

      describe('includes', () => {
        it('should support basic includes', function() {
          const Product = this.sequelize.define('product', {
            title: Sequelize.STRING
          });
          const Tag = this.sequelize.define('tag', {
            name: Sequelize.STRING
          });
          const User = this.sequelize.define('user', {
            first_name: Sequelize.STRING,
            last_name: Sequelize.STRING
          });

          Product.hasMany(Tag);
          Product.belongsTo(User);

          const product = Product.build({}, {
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
          expect(product.tags[0]).to.be.instanceof(Tag);
          expect(product.user).to.be.ok;
          expect(product.user).to.be.instanceof(User);
        });

        it('should support basic includes (with raw: true)', function() {
          const Product = this.sequelize.define('Product', {
            title: Sequelize.STRING
          });
          const Tag = this.sequelize.define('tag', {
            name: Sequelize.STRING
          });
          const User = this.sequelize.define('user', {
            first_name: Sequelize.STRING,
            last_name: Sequelize.STRING
          });

          Product.hasMany(Tag);
          Product.belongsTo(User);

          const product = Product.build({}, {
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
          expect(product.tags[0]).to.be.instanceof(Tag);
          expect(product.user).to.be.ok;
          expect(product.user).to.be.instanceof(User);
        });
      });
    });

    describe('get', () => {
      it('should use custom attribute getters in get(key)', function() {
        const Product = this.sequelize.define('Product', {
          price: {
            type: Sequelize.FLOAT,
            get() {
              return this.dataValues.price * 100;
            }
          }
        });

        const product = Product.build({
          price: 10
        });
        expect(product.get('price')).to.equal(1000);
      });

      it('should custom virtual getters in get(key)', function() {
        const Product = this.sequelize.define('Product', {
          priceInCents: {
            type: Sequelize.FLOAT
          }
        }, {
          getterMethods: {
            price() {
              return this.dataValues.priceInCents / 100;
            }
          }
        });

        const product = Product.build({
          priceInCents: 1000
        });
        expect(product.get('price')).to.equal(10);
      });

      it('should use custom getters in toJSON', function() {
        const Product = this.sequelize.define('Product', {
          price: {
            type: Sequelize.STRING,
            get() {
              return this.dataValues.price * 100;
            }
          }
        }, {
          getterMethods: {
            withTaxes() {
              return this.get('price') * 1.25;
            }
          }
        });

        const product = Product.build({
          price: 10
        });
        expect(product.toJSON()).to.deep.equal({withTaxes: 1250, price: 1000, id: null});
      });

      it('should work with save', function() {
        const Contact = this.sequelize.define('Contact', {
          first: { type: Sequelize.STRING },
          last: { type: Sequelize.STRING },
          tags: {
            type: Sequelize.STRING,
            get(field) {
              const val = this.getDataValue(field);
              return JSON.parse(val);
            },
            set(val, field) {
              this.setDataValue(field, JSON.stringify(val));
            }
          }
        });

        return this.sequelize.sync().then(() => {
          const contact = Contact.build({
            first: 'My',
            last: 'Name',
            tags: ['yes', 'no']
          });
          expect(contact.get('tags')).to.deep.equal(['yes', 'no']);

          return contact.save().then(me => {
            expect(me.get('tags')).to.deep.equal(['yes', 'no']);
          });
        });
      });

      describe('plain', () => {
        it('should return plain values when true', function() {
          const Product = this.sequelize.define('product', {
            title: Sequelize.STRING
          });
          const User = this.sequelize.define('user', {
            first_name: Sequelize.STRING,
            last_name: Sequelize.STRING
          });

          Product.belongsTo(User);

          const product = Product.build({}, {
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

          expect(product.get('user', {plain: true})).not.to.be.instanceof(User);
          expect(product.get({plain: true}).user).not.to.be.instanceof(User);
        });
      });

      describe('clone', () => {
        it('should copy the values', function() {
          const Product = this.sequelize.define('product', {
            title: Sequelize.STRING
          });

          const product = Product.build({
            id: 1,
            title: 'Chair'
          }, {raw: true});

          const values = product.get({clone: true});
          delete values.title;

          expect(product.get({clone: true}).title).to.be.ok;
        });
      });

      it('can pass parameters to getters', function() {
        const Product = this.sequelize.define('product', {
          title: Sequelize.STRING
        }, {
          getterMethods: {
            rating(key, options) {
              if (options.apiVersion > 1) {
                return 100;
              }

              return 5;
            }
          }
        });

        const User = this.sequelize.define('user', {
          first_name: Sequelize.STRING,
          last_name: Sequelize.STRING
        }, {
          getterMethods: {
            height(key, options) {
              if (options.apiVersion > 1) {
                return 185; // cm
              }

              return 6.06; // ft
            }
          }
        });

        Product.belongsTo(User);

        const product = Product.build({}, {
          include: [
            User
          ]
        });

        product.set({
          id: 1,
          title: 'Chair',
          user: {
            id: 1,
            first_name: 'Jozef',
            last_name: 'Hartinger'
          }
        });

        expect(product.get('rating')).to.equal(5);
        expect(product.get('rating', {apiVersion: 2})).to.equal(100);

        expect(product.get({plain: true})).to.have.property('rating', 5);
        expect(product.get({plain: true}).user).to.have.property('height', 6.06);
        expect(product.get({plain: true, apiVersion: 1})).to.have.property('rating', 5);
        expect(product.get({plain: true, apiVersion: 1}).user).to.have.property('height', 6.06);
        expect(product.get({plain: true, apiVersion: 2})).to.have.property('rating', 100);
        expect(product.get({plain: true, apiVersion: 2}).user).to.have.property('height', 185);

        expect(product.get('user').get('height', {apiVersion: 2})).to.equal(185);
      });
    });

    describe('changed', () => {
      it('should return false if object was built from database', function() {
        const User = this.sequelize.define('User', {
          name: {type: DataTypes.STRING}
        });

        return User.sync().then(() => {
          return User.create({name: 'Jan Meier'}).then(user => {
            expect(user.changed('name')).to.be.false;
            expect(user.changed()).not.to.be.ok;
          });
        }).then(() => {
          return User.bulkCreate([{name: 'Jan Meier'}]).spread(user => {
            expect(user.changed('name')).to.be.false;
            expect(user.changed()).not.to.be.ok;
          });
        });
      });

      it('should return true if previous value is different', function() {
        const User = this.sequelize.define('User', {
          name: {type: DataTypes.STRING}
        });

        const user = User.build({
          name: 'Jan Meier'
        });
        user.set('name', 'Mick Hansen');
        expect(user.changed('name')).to.be.true;
        expect(user.changed()).to.be.ok;
      });

      it('should return false immediately after saving', function() {
        const User = this.sequelize.define('User', {
          name: {type: DataTypes.STRING}
        });

        return User.sync().then(() => {
          const user = User.build({
            name: 'Jan Meier'
          });
          user.set('name', 'Mick Hansen');
          expect(user.changed('name')).to.be.true;
          expect(user.changed()).to.be.ok;

          return user.save().then(() => {
            expect(user.changed('name')).to.be.false;
            expect(user.changed()).not.to.be.ok;
          });
        });
      });

      it('should be available to a afterUpdate hook', function() {
        const User = this.sequelize.define('User', {
          name: {type: DataTypes.STRING}
        });
        let changed;

        User.afterUpdate(instance => {
          changed = instance.changed();
          return;
        });

        return User.sync({force: true}).then(() => {
          return User.create({
            name: 'Ford Prefect'
          });
        }).then(user => {
          return user.update({
            name: 'Arthur Dent'
          });
        }).then(user => {
          expect(changed).to.be.ok;
          expect(changed.length).to.be.ok;
          expect(changed.indexOf('name') > -1).to.be.ok;
          expect(user.changed()).not.to.be.ok;
        });
      });
    });

    describe('previous', () => {
      it('should return an object with the previous values', function() {
        const User = this.sequelize.define('User', {
          name: { type: DataTypes.STRING },
          title: { type: DataTypes.STRING }
        });

        const user = User.build({
          name: 'Jan Meier',
          title: 'Mr'
        });

        user.set('name', 'Mick Hansen');
        user.set('title', 'Dr');

        expect(user.previous()).to.eql({ name: 'Jan Meier', title: 'Mr' });
      });

      it('should return the previous value', function() {
        const User = this.sequelize.define('User', {
          name: {type: DataTypes.STRING}
        });

        const user = User.build({
          name: 'Jan Meier'
        });
        user.set('name', 'Mick Hansen');

        expect(user.previous('name')).to.equal('Jan Meier');
        expect(user.get('name')).to.equal('Mick Hansen');
      });
    });
  });
});
