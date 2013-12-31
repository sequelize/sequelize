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
  })
})