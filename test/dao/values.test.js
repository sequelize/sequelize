/* jshint camelcase: false */
var chai      = require('chai')
  , Sequelize = require('../../index')
  , expect    = chai.expect
  , Support   = require(__dirname + '/../support')
  , DataTypes = require(__dirname + "/../../lib/data-types")
  , dialect   = Support.getTestDialect()
  , config    = require(__dirname + "/../config/config")
  , sinon     = require('sinon')
  , datetime  = require('chai-datetime')
  , uuid      = require('node-uuid')
  , _         = require('lodash')

chai.use(datetime)
chai.Assertion.includeStack = true

describe(Support.getTestDialectTeaser("DAO"), function () {
  describe('Values', function () {
    describe('set', function () {
      it('doesn\'t overwrite primary keys', function () {
        var User = this.sequelize.define('User', {
          identifier: {type: DataTypes.STRING, primaryKey: true}
        })

        var user = User.build({identifier: 'identifier'})

        expect(user.get('identifier')).to.equal('identifier')
        user.set('identifier', 'another identifier')
        expect(user.get('identifier')).to.equal('identifier')
      })

      it('doesn\'t set timestamps', function () {
        var User = this.sequelize.define('User', {
          identifier: {type: DataTypes.STRING, primaryKey: true}
        })

        var user = User.build()

        user.set({
          createdAt: new Date(2000, 1, 1),
          updatedAt: new Date(2000, 1, 1)
        })

        expect(user.get('createdAt')).not.to.be.ok
        expect(user.get('updatedAt')).not.to.be.ok
      })

      describe('includes', function () {
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

          var product
          product = Product.build({}, {
            include: [
              User,
              Tag
            ]
          })

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
          })

          expect(product.tags).to.be.ok
          expect(product.tags.length).to.equal(2)
          expect(product.tags[0].Model).to.equal(Tag)
          expect(product.user).to.be.ok
          expect(product.user.Model).to.equal(User)
        })

        it('should support basic includes (with raw: true)', function () {
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

          var product
          product = Product.build({}, {
            include: [
              User,
              Tag
            ]
          })

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
          }, {raw: true})

          expect(product.tags).to.be.ok
          expect(product.tags.length).to.equal(2)
          expect(product.tags[0].Model).to.equal(Tag)
          expect(product.user).to.be.ok
          expect(product.user.Model).to.equal(User)
        })
      })
    })

    describe('get', function () {
      it('should use custom attribute getters in get(key)', function () {
        var Product = this.sequelize.define('Product', {
          price: {
            type: Sequelize.FLOAT,
            get: function() {
              return this.dataValues['price'] * 100
            }
          }
        })

        var product = Product.build({
          price: 10
        })
        expect(product.get('price')).to.equal(1000)
      })

      it('should custom virtual getters in get(key)', function () {
        var Product = this.sequelize.define('Product', {
          priceInCents: {
            type: Sequelize.FLOAT
          }
        }, {
          getterMethods: {
            price: function() {
              return this.dataValues['priceInCents'] / 100
            }
          }
        })

        var product = Product.build({
          priceInCents: 1000
        })
        expect(product.get('price')).to.equal(10)
      })

      it('should use custom getters in toJSON', function () {
        var Product = this.sequelize.define('Product', {
          price: {
            type: Sequelize.STRING,
            get: function() {
              return this.dataValues['price'] * 100
            }
          }
        }, {
          getterMethods: {
            withTaxes: function() {
              return this.get('price') * 1.25
            }
          }
        })

        var product = Product.build({
          price: 10
        })
        expect(product.toJSON()).to.deep.equal({withTaxes: 1250, price: 1000, id: null})
      })
    })

    describe('changed', function () {
      it('should return false if object was built from database', function (done) {
        var User = this.sequelize.define('User', {
          name: {type: DataTypes.STRING}
        })

        User.sync().done(function (err) {
          User.create({name: 'Jan Meier'}).done(function (err, user) {
            expect(err).not.to.be.ok
            expect(user.changed('name')).to.be.false
            expect(user.changed()).not.to.be.ok
            expect(user.isDirty).to.be.false
            done()
          });
        })
      })

      it('should return true if previous value is different', function () {
        var User = this.sequelize.define('User', {
          name: {type: DataTypes.STRING}
        })

        var user = User.build({
          name: 'Jan Meier'
        })
        user.set('name', 'Mick Hansen')
        expect(user.changed('name')).to.be.true
        expect(user.changed()).to.be.ok
        expect(user.isDirty).to.be.true
      })

      it('should return false immediately after saving', function (done) {
        var User = this.sequelize.define('User', {
          name: {type: DataTypes.STRING}
        })

        User.sync().done(function (err) {
          var user = User.build({
            name: 'Jan Meier'
          })
          user.set('name', 'Mick Hansen')
          expect(user.changed('name')).to.be.true
          expect(user.changed()).to.be.ok
          expect(user.isDirty).to.be.true

          user.save().done(function (err) {
            expect(err).not.to.be.ok
            expect(user.changed('name')).to.be.false
            expect(user.changed()).not.to.be.ok
            expect(user.isDirty).to.be.false
            done()
          })
        })
      })

      it('setting the same value twice should not impact the result', function () {
        var User = this.sequelize.define('User', {
          name: {type: DataTypes.STRING}
        })
        var user = User.build({
          name: 'Jan Meier'
        })
        user.set('name', 'Mick Hansen')
        user.set('name', 'Mick Hansen')
        expect(user.changed('name')).to.be.true
        expect(user.changed()).to.be.ok
        expect(user.isDirty).to.be.true
        expect(user.previous('name')).to.equal('Jan Meier')
      })
    })

    describe('previous', function () {
      it('should return the previous value', function () {
        var User = this.sequelize.define('User', {
          name: {type: DataTypes.STRING}
        })

        var user = User.build({
          name: 'Jan Meier'
        })
        user.set('name', 'Mick Hansen')
        
        expect(user.previous('name')).to.equal('Jan Meier')
        expect(user.get('name')).to.equal('Mick Hansen')
      })
    })
  })
})