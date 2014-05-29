/* jshint camelcase: false */
/* jshint expr: true */
var chai      = require('chai')
  , Sequelize = require('../../index')
  , Promise   = Sequelize.Promise
  , expect    = chai.expect
  , Support   = require(__dirname + '/../support')
  , DataTypes = require(__dirname + "/../../lib/data-types")
  , dialect   = Support.getTestDialect()
  , datetime  = require('chai-datetime');

chai.use(datetime);
chai.config.includeStack = true;

describe(Support.getTestDialectTeaser("Model"), function () {
  describe('attributes', function () {
    describe('field', function () {
      beforeEach(function () {
        var queryInterface = this.sequelize.getQueryInterface();

        this.User = this.sequelize.define('user', {
          id: {
            type: DataTypes.INTEGER,
            allowNull: false,
            primaryKey: true,
            autoIncrement: true,
            field: 'userId'
          },
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

        this.Comment = this.sequelize.define('comment', {
          id: {
            type: DataTypes.INTEGER,
            allowNull: false,
            primaryKey: true,
            autoIncrement: true,
            field: 'commentId'
          },
          text: {
            type: DataTypes.STRING,
            field: 'comment_text'
          }
        }, {
          tableName: 'comments',
          timestamps: false
        });

        this.User.hasMany(this.Task, {
          foreignKey: 'user_id'
        });
        this.Task.belongsTo(this.User, {
          foreignKey: 'user_id'
        });
        this.Task.hasMany(this.Comment, {
          foreignKey: 'task_id'
        });
        this.Comment.belongsTo(this.Task, {
          foreignKey: 'task_id'
        });

        return Promise.all([
          queryInterface.createTable('users', {
            userId: {
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
          }),
          queryInterface.createTable('comments', {
            commentId: {
              type: DataTypes.INTEGER,
              allowNull: false,
              primaryKey: true,
              autoIncrement: true
            },
            task_id: {
              type: DataTypes.INTEGER
            },
            comment_text: {
              type: DataTypes.STRING
            }
          })
        ]);
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
        });
      });

      it('should make the aliased auto incremented primary key available after create', function () {
        var self = this;
        return this.User.create({
          name: 'Barfoo'
        }).then(function (user) {
          expect(user.get('id')).to.be.ok;
        });
      });

      it('should work with where on includes for find', function () {
        var self = this;

        return this.User.create({
          name: 'Barfoo'
        }).then(function (user) {
          return user.createTask({
            title: 'DatDo'
          });
        }).then(function (task) {
          return task.createComment({
            text: 'Comment'
          });
        }).then(function () {
          return self.Task.find({
            include: [
              {model: self.Comment},
              {model: self.User}
            ],
            where: {title: 'DatDo'}
          });
        }).then(function (task) {
          expect(task.get('title')).to.equal('DatDo');
          expect(task.get('comments')[0].get('text')).to.equal('Comment');
          expect(task.get('user')).to.be.ok;
        });
      });

      it('should work with where on includes for findAll', function () {
        var self = this;

        return this.User.create({
          name: 'Foobar'
        }).then(function (user) {
          return user.createTask({
            title: 'DoDat'
          });
        }).then(function (task) {
          return task.createComment({
            text: 'Comment'
          });
        }).then(function () {
          return self.User.findAll({
            include: [
              {model: self.Task, where: {title: 'DoDat'}, include: [
                {model: self.Comment}
              ]}
            ]
          });
        }).then(function (users) {
          users.forEach(function (user) {
            expect(user.get('name')).to.be.ok;
            expect(user.get('tasks')[0].get('title')).to.equal('DoDat');
            expect(user.get('tasks')[0].get('comments')).to.be.ok;
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
          expect(user).to.be.ok;
        });
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
            expect(['Abc', 'Bcd', 'Cde'].indexOf(user.get('name')) !== -1).to.be.true;
          });
        });
      });
    });

    describe('types', function () {
      describe('VIRTUAL', function () {
        it('should be ignored in create, updateAttributes and find');
        it('should be ignored in bulkCreate and findAll');
      });
    });
  });
});