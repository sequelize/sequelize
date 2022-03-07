'use strict';

const chai = require('chai'),
  sinon = require('sinon'),
  Sequelize = require('sequelize'),
  expect = chai.expect,
  Support = require('../../support'),
  DataTypes = require('sequelize/lib/data-types'),
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
      beforeEach(async function() {
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

        await Promise.all([
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
          beforeEach(async function() {
            this.ModelUnderTest = this.sequelize.define('ModelUnderTest', {
              identifier: {
                primaryKey: true,
                type: Sequelize.STRING,
                allowNull: false
              }
            });

            await this.ModelUnderTest.sync({ force: true });
          });

          it('sets the column to not allow null', async function() {
            const fields = await this
              .ModelUnderTest
              .describe();

            expect(fields.identifier).to.include({ allowNull: false });
          });
        });

        it('should support instance.destroy()', async function() {
          const user = await this.User.create();
          await user.destroy();
        });

        it('should support Model.destroy()', async function() {
          const user = await this.User.create();

          await this.User.destroy({
            where: {
              id: user.get('id')
            }
          });
        });
      });

      describe('field and attribute name is the same', () => {
        beforeEach(async function() {
          await this.Comment.bulkCreate([
            { notes: 'Number one' },
            { notes: 'Number two' }
          ]);
        });

        it('bulkCreate should work', async function() {
          const comments = await this.Comment.findAll();
          expect(comments[0].notes).to.equal('Number one');
          expect(comments[1].notes).to.equal('Number two');
        });

        it('find with where should work', async function() {
          const comments = await this.Comment.findAll({ where: { notes: 'Number one' } });
          expect(comments).to.have.length(1);
          expect(comments[0].notes).to.equal('Number one');
        });

        it('reload should work', async function() {
          const comment = await this.Comment.findByPk(1);
          await comment.reload();
        });

        it('save should work', async function() {
          const comment1 = await this.Comment.create({ notes: 'my note' });
          comment1.notes = 'new note';
          const comment0 = await comment1.save();
          const comment = await comment0.reload();
          expect(comment.notes).to.equal('new note');
        });
      });

      it('increment should work', async function() {
        await this.Comment.destroy({ truncate: true });
        const comment1 = await this.Comment.create({ note: 'oh boy, here I go again', likes: 23 });
        const comment0 = await comment1.increment('likes');
        const comment = await comment0.reload();
        expect(comment.likes).to.be.equal(24);
      });

      it('decrement should work', async function() {
        await this.Comment.destroy({ truncate: true });
        const comment1 = await this.Comment.create({ note: 'oh boy, here I go again', likes: 23 });
        const comment0 = await comment1.decrement('likes');
        const comment = await comment0.reload();
        expect(comment.likes).to.be.equal(22);
      });

      it('sum should work', async function() {
        await this.Comment.destroy({ truncate: true });
        await this.Comment.create({ note: 'oh boy, here I go again', likes: 23 });
        const likes = await this.Comment.sum('likes');
        expect(likes).to.be.equal(23);
      });

      it('should create, fetch and update with alternative field names from a simple model', async function() {
        await this.User.create({
          name: 'Foobar'
        });

        const user0 = await this.User.findOne({
          limit: 1
        });

        expect(user0.get('name')).to.equal('Foobar');

        await user0.update({
          name: 'Barfoo'
        });

        const user = await this.User.findOne({
          limit: 1
        });

        expect(user.get('name')).to.equal('Barfoo');
      });

      it('should bulk update', async function() {
        const Entity = this.sequelize.define('Entity', {
          strField: { type: Sequelize.STRING, field: 'str_field' }
        });

        await this.sequelize.sync({ force: true });
        await Entity.create({ strField: 'foo' });

        await Entity.update(
          { strField: 'bar' },
          { where: { strField: 'foo' } }
        );

        const entity = await Entity.findOne({
          where: {
            strField: 'bar'
          }
        });

        expect(entity).to.be.ok;
        expect(entity.get('strField')).to.equal('bar');
      });

      it('should not contain the field properties after create', async function() {
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

        await Model.sync({ force: true });
        const data = await Model.create({ title: 'test' });
        expect(data.get('test_title')).to.be.an('undefined');
        expect(data.get('test_id')).to.be.an('undefined');
      });

      it('should make the aliased auto incremented primary key available after create', async function() {
        const user = await this.User.create({
          name: 'Barfoo'
        });

        expect(user.get('id')).to.be.ok;
      });

      it('should work with where on includes for find', async function() {
        const user = await this.User.create({
          name: 'Barfoo'
        });

        const task0 = await user.createTask({
          title: 'DatDo'
        });

        await task0.createComment({
          text: 'Comment'
        });

        const task = await this.Task.findOne({
          include: [
            { model: this.Comment },
            { model: this.User }
          ],
          where: { title: 'DatDo' }
        });

        expect(task.get('title')).to.equal('DatDo');
        expect(task.get('comments')[0].get('text')).to.equal('Comment');
        expect(task.get('user')).to.be.ok;
      });

      it('should work with where on includes for findAll', async function() {
        const user = await this.User.create({
          name: 'Foobar'
        });

        const task = await user.createTask({
          title: 'DoDat'
        });

        await task.createComment({
          text: 'Comment'
        });

        const users = await this.User.findAll({
          include: [
            { model: this.Task, where: { title: 'DoDat' }, include: [
              { model: this.Comment }
            ] }
          ]
        });

        users.forEach(user => {
          expect(user.get('name')).to.be.ok;
          expect(user.get('tasks')[0].get('title')).to.equal('DoDat');
          expect(user.get('tasks')[0].get('comments')).to.be.ok;
        });
      });

      it('should work with increment', async function() {
        const user = await this.User.create();
        await user.increment('taskCount');
      });

      it('should work with a simple where', async function() {
        await this.User.create({
          name: 'Foobar'
        });

        const user = await this.User.findOne({
          where: {
            name: 'Foobar'
          }
        });

        expect(user).to.be.ok;
      });

      it('should work with a where or', async function() {
        await this.User.create({
          name: 'Foobar'
        });

        const user = await this.User.findOne({
          where: this.sequelize.or({
            name: 'Foobar'
          }, {
            name: 'Lollerskates'
          })
        });

        expect(user).to.be.ok;
      });

      it('should work with bulkCreate and findAll', async function() {
        await this.User.bulkCreate([{
          name: 'Abc'
        }, {
          name: 'Bcd'
        }, {
          name: 'Cde'
        }]);

        const users = await this.User.findAll();
        users.forEach(user => {
          expect(['Abc', 'Bcd', 'Cde'].includes(user.get('name'))).to.be.true;
        });
      });

      it('should support renaming of sequelize method fields', async function() {
        const Test = this.sequelize.define('test', {
          someProperty: Sequelize.VIRTUAL // Since we specify the AS part as a part of the literal string, not with sequelize syntax, we have to tell sequelize about the field
        });

        await this.sequelize.sync({ force: true });
        await Test.create({});
        let findAttributes;
        if (dialect === 'mssql') {
          findAttributes = [
            Sequelize.literal('CAST(CASE WHEN EXISTS(SELECT 1) THEN 1 ELSE 0 END AS BIT) AS "someProperty"'),
            [Sequelize.literal('CAST(CASE WHEN EXISTS(SELECT 1) THEN 1 ELSE 0 END AS BIT)'), 'someProperty2']
          ];
        } else if (dialect === 'db2') {
          findAttributes = [
            Sequelize.literal('1 AS "someProperty"'),
            [Sequelize.literal('1'), 'someProperty2']
          ];
        } else if (dialect === 'oracle') {
          findAttributes = [
            Sequelize.literal('(CASE WHEN EXISTS(SELECT 1 FROM DUAL) THEN 1 ELSE 0 END) AS "someProperty"'),
            [Sequelize.literal('(CASE WHEN EXISTS(SELECT 1 FROM DUAL) THEN 1 ELSE 0 END)'), 'someProperty2']
          ];
        } else {
          findAttributes = [
            Sequelize.literal('EXISTS(SELECT 1) AS "someProperty"'),
            [Sequelize.literal('EXISTS(SELECT 1)'), 'someProperty2']
          ];
        }

        const tests = await Test.findAll({
          attributes: findAttributes
        });

        expect(tests[0].get('someProperty')).to.be.ok;
        expect(tests[0].get('someProperty2')).to.be.ok;
      });

      it('should sync foreign keys with custom field names', async function() {
        await this.sequelize.sync({ force: true });
        const attrs = this.Task.tableAttributes;
        expect(attrs.user_id.references.model).to.equal('users');
        expect(attrs.user_id.references.key).to.equal('userId');
      });

      it('should find the value of an attribute with a custom field name', async function() {
        await this.User.create({ name: 'test user' });
        const user = await this.User.findOne({ where: { name: 'test user' } });
        expect(user.name).to.equal('test user');
      });

      it('field names that are the same as property names should create, update, and read correctly', async function() {
        await this.Comment.create({
          notes: 'Foobar'
        });

        const comment0 = await this.Comment.findOne({
          limit: 1
        });

        expect(comment0.get('notes')).to.equal('Foobar');

        await comment0.update({
          notes: 'Barfoo'
        });

        const comment = await this.Comment.findOne({
          limit: 1
        });

        expect(comment.get('notes')).to.equal('Barfoo');
      });

      it('should work with a belongsTo association getter', async function() {
        const userId = Math.floor(Math.random() * 100000);

        const [user, task] = await Promise.all([this.User.create({
          id: userId
        }), this.Task.create({
          user_id: userId
        })]);

        const [userA, userB] = await Promise.all([user, task.getUser()]);
        expect(userA.get('id')).to.equal(userB.get('id'));
        expect(userA.get('id')).to.equal(userId);
        expect(userB.get('id')).to.equal(userId);
      });

      it('should work with paranoid instance.destroy()', async function() {
        const User = this.sequelize.define('User', {
          deletedAt: {
            type: DataTypes.DATE,
            field: 'deleted_at'
          }
        }, {
          timestamps: true,
          paranoid: true
        });

        await User.sync({ force: true });
        const user = await User.create();
        await user.destroy();
        this.clock.tick(1000);
        const users = await User.findAll();
        expect(users.length).to.equal(0);
      });

      it('should work with paranoid Model.destroy()', async function() {
        const User = this.sequelize.define('User', {
          deletedAt: {
            type: DataTypes.DATE,
            field: 'deleted_at'
          }
        }, {
          timestamps: true,
          paranoid: true
        });

        await User.sync({ force: true });
        const user = await User.create();
        await User.destroy({ where: { id: user.get('id') } });
        const users = await User.findAll();
        expect(users.length).to.equal(0);
      });

      it('should work with `belongsToMany` association `count`', async function() {
        const user = await this.User.create({
          name: 'John'
        });

        const commentCount = await user.countComments();
        await expect(commentCount).to.equal(0);
      });

      it('should work with `hasMany` association `count`', async function() {
        const user = await this.User.create({
          name: 'John'
        });

        const taskCount = await user.countTasks();
        await expect(taskCount).to.equal(0);
      });
    });
  });
});
