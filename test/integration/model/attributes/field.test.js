'use strict';

const chai = require('chai'),
  sinon = require('sinon'),
  Sequelize = require('../../../../index'),
  Promise = Sequelize.Promise,
  expect = chai.expect,
  Support = require(__dirname + '/../../support'),
  DataTypes = require(__dirname + '/../../../../lib/data-types'),
  dialect = Support.getTestDialect();

describe(Support.getTestDialectTeaser('Model'), () => {

  before(function() {
    this.clock = sinon.useFakeTimers();
  });

  after(function() {
    this.clock.restore();
  });

  describe('attributes', () => {
    describe('field', () => {
      beforeEach(function() {
        const queryInterface = this.sequelize.getQueryInterface();

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
          },
          taskCount: {
            type: DataTypes.INTEGER,
            field: 'task_count',
            defaultValue: 0,
            allowNull: false
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
          text: { type: DataTypes.STRING, field: 'comment_text' },
          notes: { type: DataTypes.STRING, field: 'notes' },
          likes: { type: DataTypes.INTEGER, field: 'like_count' },
          createdAt: { type: DataTypes.DATE, field: 'created_at', allowNull: false },
          updatedAt: { type: DataTypes.DATE, field: 'updated_at', allowNull: false }
        }, {
          tableName: 'comments',
          timestamps: true
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

        this.User.belongsToMany(this.Comment, {
          foreignKey: 'userId',
          otherKey: 'commentId',
          through: 'userComments'
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
            },
            task_count: {
              type: DataTypes.INTEGER,
              allowNull: false,
              defaultValue: 0
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
            },
            like_count: {
              type: DataTypes.INTEGER
            },
            created_at: {
              type: DataTypes.DATE,
              allowNull: false
            },
            updated_at: {
              type: DataTypes.DATE
            }
          }),
          queryInterface.createTable('userComments', {
            commentId: {
              type: DataTypes.INTEGER
            },
            userId: {
              type: DataTypes.INTEGER
            }
          })
        ]);
      });

      describe('primaryKey', () => {
        describe('in combination with allowNull', () => {
          beforeEach(function() {
            this.ModelUnderTest = this.sequelize.define('ModelUnderTest', {
              identifier: {
                primaryKey: true,
                type: Sequelize.STRING,
                allowNull: false
              }
            });

            return this.ModelUnderTest.sync({ force: true });
          });

          it('sets the column to not allow null', function() {
            return this
              .ModelUnderTest
              .describe()
              .then(fields => {
                expect(fields.identifier).to.include({ allowNull: false });
              });
          });
        });

        it('should support instance.destroy()', function() {
          return this.User.create().then(user => {
            return user.destroy();
          });
        });

        it('should support Model.destroy()', function() {
          return this.User.create().bind(this).then(function(user) {
            return this.User.destroy({
              where: {
                id: user.get('id')
              }
            });
          });
        });
      });

      describe('field and attribute name is the same', () => {
        beforeEach(function() {
          return this.Comment.bulkCreate([
            { notes: 'Number one'},
            { notes: 'Number two'}
          ]);
        });

        it('bulkCreate should work', function() {
          return this.Comment.findAll().then(comments => {
            expect(comments[0].notes).to.equal('Number one');
            expect(comments[1].notes).to.equal('Number two');
          });
        });

        it('find with where should work', function() {
          return this.Comment.findAll({ where: { notes: 'Number one' }}).then(comments => {
            expect(comments).to.have.length(1);
            expect(comments[0].notes).to.equal('Number one');
          });
        });

        it('reload should work', function() {
          return this.Comment.findById(1).then(comment => {
            return comment.reload();
          });
        });

        it('save should work', function() {
          return this.Comment.create({ notes: 'my note' }).then(comment => {
            comment.notes = 'new note';
            return comment.save();
          }).then(comment => {
            return comment.reload();
          }).then(comment => {
            expect(comment.notes).to.equal('new note');
          });
        });
      });

      it('increment should work', function() {
        return this.Comment.destroy({ truncate: true })
          .then(() => this.Comment.create({ note: 'oh boy, here I go again', likes: 23 }))
          .then(comment => comment.increment('likes'))
          .then(comment => comment.reload())
          .then(comment => {
            expect(comment.likes).to.be.equal(24);
          });
      });

      it('decrement should work', function() {
        return this.Comment.destroy({ truncate: true })
          .then(() => this.Comment.create({ note: 'oh boy, here I go again', likes: 23 }))
          .then(comment => comment.decrement('likes'))
          .then(comment => comment.reload())
          .then(comment => {
            expect(comment.likes).to.be.equal(22);
          });
      });

      it('sum should work', function() {
        return this.Comment.destroy({ truncate: true })
          .then(() => this.Comment.create({ note: 'oh boy, here I go again', likes: 23 }))
          .then(() => this.Comment.sum('likes'))
          .then(likes => {
            expect(likes).to.be.equal(23);
          });
      });

      it('should create, fetch and update with alternative field names from a simple model', function() {
        const self = this;

        return this.User.create({
          name: 'Foobar'
        }).then(() => {
          return self.User.find({
            limit: 1
          });
        }).then(user => {
          expect(user.get('name')).to.equal('Foobar');
          return user.updateAttributes({
            name: 'Barfoo'
          });
        }).then(() => {
          return self.User.find({
            limit: 1
          });
        }).then(user => {
          expect(user.get('name')).to.equal('Barfoo');
        });
      });

      it('should bulk update', function() {
        const Entity = this.sequelize.define('Entity', {
          strField: {type: Sequelize.STRING, field: 'str_field'}
        });

        return this.sequelize.sync({force: true}).then(() => {
          return Entity.create({strField: 'foo'});
        }).then(() => {
          return Entity.update(
            {strField: 'bar'},
            {where: {strField: 'foo'}}
          );
        }).then(() => {
          return Entity.findOne({
            where: {
              strField: 'bar'
            }
          }).then(entity => {
            expect(entity).to.be.ok;
            expect(entity.get('strField')).to.equal('bar');
          });
        });
      });

      it('should not contain the field properties after create', function() {
        const Model = this.sequelize.define('test', {
          id: {
            type: Sequelize.INTEGER,
            field: 'test_id',
            autoIncrement: true,
            primaryKey: true,
            validate: {
              min: 1
            }
          },
          title: {
            allowNull: false,
            type: Sequelize.STRING(255),
            field: 'test_title'
          }
        }, {
          timestamps: true,
          underscored: true,
          freezeTableName: true
        });

        return Model.sync({force: true}).then(() => {
          return Model.create({title: 'test'}).then(data => {
            expect(data.get('test_title')).to.be.an('undefined');
            expect(data.get('test_id')).to.be.an('undefined');
          });
        });
      });

      it('should make the aliased auto incremented primary key available after create', function() {
        return this.User.create({
          name: 'Barfoo'
        }).then(user => {
          expect(user.get('id')).to.be.ok;
        });
      });

      it('should work with where on includes for find', function() {
        const self = this;

        return this.User.create({
          name: 'Barfoo'
        }).then(user => {
          return user.createTask({
            title: 'DatDo'
          });
        }).then(task => {
          return task.createComment({
            text: 'Comment'
          });
        }).then(() => {
          return self.Task.find({
            include: [
              {model: self.Comment},
              {model: self.User}
            ],
            where: {title: 'DatDo'}
          });
        }).then(task => {
          expect(task.get('title')).to.equal('DatDo');
          expect(task.get('comments')[0].get('text')).to.equal('Comment');
          expect(task.get('user')).to.be.ok;
        });
      });

      it('should work with where on includes for findAll', function() {
        const self = this;

        return this.User.create({
          name: 'Foobar'
        }).then(user => {
          return user.createTask({
            title: 'DoDat'
          });
        }).then(task => {
          return task.createComment({
            text: 'Comment'
          });
        }).then(() => {
          return self.User.findAll({
            include: [
              {model: self.Task, where: {title: 'DoDat'}, include: [
                {model: self.Comment}
              ]}
            ]
          });
        }).then(users => {
          users.forEach(user => {
            expect(user.get('name')).to.be.ok;
            expect(user.get('tasks')[0].get('title')).to.equal('DoDat');
            expect(user.get('tasks')[0].get('comments')).to.be.ok;
          });
        });
      });

      it('should work with increment', function() {
        return this.User.create().then(user => {
          return user.increment('taskCount');
        });
      });

      it('should work with a simple where', function() {
        const self = this;

        return this.User.create({
          name: 'Foobar'
        }).then(() => {
          return self.User.find({
            where: {
              name: 'Foobar'
            }
          });
        }).then(user => {
          expect(user).to.be.ok;
        });
      });

      it('should work with a where or', function() {
        const self = this;

        return this.User.create({
          name: 'Foobar'
        }).then(() => {
          return self.User.find({
            where: self.sequelize.or({
              name: 'Foobar'
            }, {
              name: 'Lollerskates'
            })
          });
        }).then(user => {
          expect(user).to.be.ok;
        });
      });

      it('should work with bulkCreate and findAll', function() {
        const self = this;
        return this.User.bulkCreate([{
          name: 'Abc'
        }, {
          name: 'Bcd'
        }, {
          name: 'Cde'
        }]).then(() => {
          return self.User.findAll();
        }).then(users => {
          users.forEach(user => {
            expect(['Abc', 'Bcd', 'Cde'].indexOf(user.get('name')) !== -1).to.be.true;
          });
        });
      });

      it('should support renaming of sequelize method fields', function() {
        const Test = this.sequelize.define('test', {
          someProperty: Sequelize.VIRTUAL // Since we specify the AS part as a part of the literal string, not with sequelize syntax, we have to tell sequelize about the field
        });

        return this.sequelize.sync({ force: true }).then(() => {
          return Test.create({});
        }).then(() => {
          let findAttributes;
          if (dialect === 'mssql') {
            findAttributes = [
              Sequelize.literal('CAST(CASE WHEN EXISTS(SELECT 1) THEN 1 ELSE 0 END AS BIT) AS "someProperty"'),
              [Sequelize.literal('CAST(CASE WHEN EXISTS(SELECT 1) THEN 1 ELSE 0 END AS BIT)'), 'someProperty2']
            ];
          } else {
            findAttributes = [
              Sequelize.literal('EXISTS(SELECT 1) AS "someProperty"'),
              [Sequelize.literal('EXISTS(SELECT 1)'), 'someProperty2']
            ];
          }

          return Test.findAll({
            attributes: findAttributes
          });

        }).then(tests => {
          expect(tests[0].get('someProperty')).to.be.ok;
          expect(tests[0].get('someProperty2')).to.be.ok;
        });
      });

      it('should sync foreign keys with custom field names', function() {
        return this.sequelize.sync({ force: true })
          .then(() => {
            const attrs = this.Task.tableAttributes;
            expect(attrs.user_id.references.model).to.equal('users');
            expect(attrs.user_id.references.key).to.equal('userId');
          });
      });

      it('should find the value of an attribute with a custom field name', function() {
        return this.User.create({ name: 'test user' })
          .then(() => {
            return this.User.find({ where: { name: 'test user' } });
          })
          .then(user => {
            expect(user.name).to.equal('test user');
          });
      });

      it('field names that are the same as property names should create, update, and read correctly', function() {
        const self = this;

        return this.Comment.create({
          notes: 'Foobar'
        }).then(() => {
          return self.Comment.find({
            limit: 1
          });
        }).then(comment => {
          expect(comment.get('notes')).to.equal('Foobar');
          return comment.updateAttributes({
            notes: 'Barfoo'
          });
        }).then(() => {
          return self.Comment.find({
            limit: 1
          });
        }).then(comment => {
          expect(comment.get('notes')).to.equal('Barfoo');
        });
      });

      it('should work with a belongsTo association getter', function() {
        const userId = Math.floor(Math.random() * 100000);
        return Promise.join(
          this.User.create({
            id: userId
          }),
          this.Task.create({
            user_id: userId
          })
        ).spread((user, task) => {
          return [user, task.getUser()];
        }).spread((userA, userB) => {
          expect(userA.get('id')).to.equal(userB.get('id'));
          expect(userA.get('id')).to.equal(userId);
          expect(userB.get('id')).to.equal(userId);
        });
      });

      it('should work with paranoid instance.destroy()', function() {
        const User = this.sequelize.define('User', {
          deletedAt: {
            type: DataTypes.DATE,
            field: 'deleted_at'
          }
        }, {
          timestamps: true,
          paranoid: true
        });

        return User.sync({force: true})
          .bind(this)
          .then(() => {
            return User.create();
          })
          .then(user => {
            return user.destroy();
          })
          .then(function() {
            this.clock.tick(1000);
            return User.findAll();
          })
          .then(users => {
            expect(users.length).to.equal(0);
          });
      });

      it('should work with paranoid Model.destroy()', function() {
        const User = this.sequelize.define('User', {
          deletedAt: {
            type: DataTypes.DATE,
            field: 'deleted_at'
          }
        }, {
          timestamps: true,
          paranoid: true
        });

        return User.sync({force: true}).then(() => {
          return User.create().then(user => {
            return User.destroy({where: {id: user.get('id')}});
          }).then(() => {
            return User.findAll().then(users => {
              expect(users.length).to.equal(0);
            });
          });
        });
      });

      it('should work with `belongsToMany` association `count`', function() {
        return this.User.create({
          name: 'John'
        })
          .then(user => user.countComments())
          .then(commentCount => expect(commentCount).to.equal(0));
      });

      it('should work with `hasMany` association `count`', function() {
        return this.User.create({
          name: 'John'
        })
          .then(user => user.countTasks())
          .then(taskCount => expect(taskCount).to.equal(0));
      });
    });
  });
});
