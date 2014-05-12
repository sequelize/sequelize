/* jshint camelcase: false */
/* jshint expr: true */
var chai      = require('chai')
  , Sequelize = require('../../index')
  , Promise   = Sequelize.Promise
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
        });

        this.Task = this.sequelize.define('task', {
          id: {
            type: DataTypes.INTEGER,
            allowNull: false,
            primaryKey: true,
            autoIncrement: true,
            field: 'taskId'
          },
          title: {
            type: DataTypes.STRING,
            field: 'name'
          }
        }, {
          tableName: 'tasks',
          timestamps: false
        });

        this.User.hasMany(this.Task, {
          foreignKey: 'user_id'
        });
        this.Task.belongsTo(this.User, {
          foreignKey: 'user_id'
        });

        return Promise.all([
          queryInterface.createTable('users', {
            id: {
              type: DataTypes.INTEGER,
              allowNull: false,
              primaryKey: true,
              autoIncrement: true
            },
            full_name: {
              type: DataTypes.STRING
            }
          }),
          queryInterface.createTable('tasks', {
            taskId: {
              type: DataTypes.INTEGER,
              allowNull: false,
              primaryKey: true,
              autoIncrement: true
            },
            user_id: {
              type: DataTypes.INTEGER
            },
            name: {
              type: DataTypes.STRING
            }
          })
        ])
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

      it('should work with attributes and where on includes', function () {
        var self = this;

        return this.User.create({
          name: 'Foobar'
        }).then(function (user) {
          return user.createTask({
            title: 'DoDat'
          });
        }).then(function () {
          return self.User.findAll({
            include: [
              {model: self.Task, where: {title: 'DoDat'}}
            ]
          });
        }).then(function (users) {
          users.forEach(function (user) {
            expect(user.get('name')).to.be.ok;
            expect(user.get('tasks')[0].get('title')).to.equal('DoDat');
          });
        });
      });

      it('should work with a simple where', function () {
        var self = this;

        return this.User.create({
          name: 'Foobar'
        }).then(function () {
          return self.User.find({
            where: {
              name: 'Foobar'
            }
          });
        }).then(function (user) {
          expect(user).to.be.ok
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