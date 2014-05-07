/* jshint camelcase: false */
/* jshint expr: true */
var chai      = require('chai')
  , Sequelize = require('../../index')
  , expect    = chai.expect
  , Support   = require(__dirname + '/../support')
  , DataTypes = require(__dirname + "/../../lib/data-types")
  , dialect   = Support.getTestDialect()
  , datetime  = require('chai-datetime')

chai.use(datetime)
chai.config.includeStack = true

describe(Support.getTestDialectTeaser("Model"), function () {
  describe('attributes', function () {
    describe('field', function () {
      it('should create and fetch with alternative field names from a simple model', function () {
        var queryInterface = this.sequelize.getQueryInterface()
          , User = this.sequelize.define('user', {
            name: {
              type: DataTypes.STRING,
              field: 'full_name'
            }
          }, {
            tableName: 'users',
            timestamps: false
          })

        return queryInterface.createTable('users', {
          id: {
            type: DataTypes.INTEGER,
            allowNull: false,
            primaryKey: true,
            autoIncrement: true
          },
          full_name: {
            type: DataTypes.STRING
          }
        }).then(function () {
          return User.create({
            name: 'Foobar'
          });
        }).then(function () {
          return User.find({
            limit: 1
          });
        }).then(function (user) {
          expect(user.get('name')).to.equal('Foobar');
        });
      })
    })
  })
})