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
      beforeEach(function () {
        var queryInterface = this.sequelize.getQueryInterface();

        this.User = this.sequelize.define('user', {
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
        });
      });

      it('should create, fetch and update with alternative field names from a simple model', function () {
        var self = this;

        return this.User.create({
          name: 'Foobar'
        }).then(function () {
          return self.User.find({
            limit: 1
          });
        }).then(function (user) {
          expect(user.get('name')).to.equal('Foobar');
          return user.updateAttributes({
            name: 'Barfoo'
          });
        }).then(function () {
          return self.User.find({
            limit: 1
          });
        }).then(function (user) {
          expect(user.get('name')).to.equal('Barfoo');
        })
      });

      it('should work with bulkCreate and findAll', function () {
        var self = this;
        return this.User.bulkCreate([{
          name: 'Abc',
        }, {
          name: 'Bcd'
        }, {
          name: 'Cde'
        }]).then(function () {
          return self.User.findAll();
        }).then(function (users) {
          users.forEach(function (user) {
            expect(['Abc', 'Bcd', 'Cde'].indexOf(user.get('name')) !== -1).to.be.true
          });
        });
      });
    })
  })
})