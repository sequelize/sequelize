"use strict";

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
          },
		  notes: {
			type: DataTypes.STRING,
			field: 'notes'
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
            },
			notes: {
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

    it('should support renaming of sequelize method fields', function () {
      var User = this.sequelize.define('user', {
        someProperty: Sequelize.VIRTUAL // Since we specify the AS part as a part of the literal string, not with sequelize syntax, we have to tell sequelize about the field
      });

      return this.sequelize.sync({ force: true }).then(function () {
        return User.create({});
      }).then(function () {
        return User.findAll({
          attributes: [
            Sequelize.literal('EXISTS(SELECT 1) AS "someProperty"'),
            [Sequelize.literal('EXISTS(SELECT 1)'), 'someProperty2']
          ]
        });
      }).then(function (users) {
        expect(users[0].get('someProperty')).to.be.ok;
        expect(users[0].get('someProperty2')).to.be.ok;
      });
    });
	  
	  it('field names that are the same as property names should create, update, and read correctly', function () {
        var self = this;

        return this.Comment.create({
          notes: 'Foobar'
        }).then(function () {
          return self.Comment.find({
            limit: 1
          });
        }).then(function (comment) {
          expect(comment.get('notes')).to.equal('Foobar');
          return comment.updateAttributes({
            notes: 'Barfoo'
          });
        }).then(function () {
          return self.Comment.find({
            limit: 1
          });
        }).then(function (comment) {
          expect(comment.get('notes')).to.equal('Barfoo');
        });
      });
	  
    });

    describe('types', function () {
      describe('VIRTUAL', function () {
        beforeEach(function () {
          this.User = this.sequelize.define('user', {
            storage: Sequelize.STRING,
            field1: {
              type: Sequelize.VIRTUAL,
              set: function (val) {
                this.setDataValue('storage', val);
                this.setDataValue('field1', val);
              },
              get: function () {
                return this.getDataValue('field1');
              }
            },
            field2: {
              type: Sequelize.VIRTUAL,
              get: function () {
                return 42;
              }
            },
            virtualWithDefault: {
              type: Sequelize.VIRTUAL,
              defaultValue: 'cake'
            }
          }, { timestamps: false });

          this.Task = this.sequelize.define('task', {});
          this.Project = this.sequelize.define('project', {});

          this.Task.belongsTo(this.User);
          this.Project.hasMany(this.User);
          this.User.hasMany(this.Project);

          this.sqlAssert = function(sql) {
            expect(sql.indexOf('field1')).to.equal(-1);
            expect(sql.indexOf('field2')).to.equal(-1);
          };

          return this.sequelize.sync({ force: true });
        });

        it('should not be ignored in dataValues get', function () {
          var user = this.User.build({
            field1: 'field1_value',
            field2: 'field2_value'
          });

          expect(user.get()).to.deep.equal({ storage: 'field1_value', field1: 'field1_value', virtualWithDefault: 'cake', field2: 42, id: null });
        });

        it('should be ignored in table creation', function () {
          return this.sequelize.getQueryInterface().describeTable(this.User.tableName).then(function (fields) {
            expect(Object.keys(fields).length).to.equal(2);
          });
        });

        it('should be ignored in find, findAll and includes', function () {
          return Promise.all([
            this.User.find().on('sql', this.sqlAssert),
            this.User.findAll().on('sql', this.sqlAssert),
            this.Task.findAll({
              include: [
                this.User
              ]
            }).on('sql', this.sqlAssert),
            this.Project.findAll({
              include: [
                this.User
              ]
            }).on('sql', this.sqlAssert)
          ]);
        });

        it("should allow me to store selected values", function () {
          var Post = this.sequelize.define('Post', {
              text: Sequelize.TEXT,
              someBoolean: {
                type: Sequelize.VIRTUAL
              }
            });

          return this.sequelize.sync({ force: true}).then(function () {
            return Post.bulkCreate([{ text: 'text1' },{ text: 'text2' }]);
          }).then(function () {
            return Post.find({ attributes: ['id','text',Sequelize.literal('EXISTS(SELECT 1) AS "someBoolean"')] });
          }).then(function (post) {
            expect(post.get('someBoolean')).to.be.ok;
            expect(post.get().someBoolean).to.be.ok;
          });
        });

        it('should be ignored in create and updateAttributes', function () {
          return this.User.create({
            field1: 'something'
          }).then(function (user) {
            // We already verified that the virtual is not added to the table definition, so if this succeeds, were good

            expect(user.virtualWithDefault).to.equal('cake');
            expect(user.storage).to.equal('something');
            return user.updateAttributes({
              field1: 'something else'
            });
          }).then(function (user) {
            expect(user.virtualWithDefault).to.equal('cake');
            expect(user.storage).to.equal('something else');
          });
        });

        it('should be ignored in bulkCreate and and bulkUpdate', function () {
          var self = this;
          return this.User.bulkCreate([{
            field1: 'something'
          }]).on('sql', this.sqlAssert).then(function () {
            return self.User.findAll();
          }).then(function (users) {
            expect(users[0].storage).to.equal('something');
          });
        });
      });
    });
  });
});