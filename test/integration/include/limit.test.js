'use strict';

const chai = require('chai'),
  Sequelize = require('sequelize'),
  expect = chai.expect,
  Support = require('../support'),
  DataTypes = require('sequelize/lib/data-types'),
  Op = Sequelize.Op;

describe(Support.getTestDialectTeaser('Include'), () => {

  describe('LIMIT', () => {
    /*
     * shortcut for building simple {name: 'foo'} seed data
     */
    function build(...args) {
      return args.map(arg => ({ name: arg }));
    }

    /*
     * association overview
     * [Task]N---N[Project]N---N[User]N---N[Hobby]
     *                            1
     *                            |
     *                            |
     *                            |
     *                            N
     *            [Comment]N---1[Post]N---N[Tag]N---1[Color]
     *                            1
     *                            |
     *                            |
     *                            |
     *                            N
     *                        [Footnote]
     */
    beforeEach(function() {
      this.Project = this.sequelize.define('Project', {
        name: {
          type: DataTypes.STRING,
          primaryKey: true
        }
      }, { timestamps: false });

      this.User = this.sequelize.define('User', {
        name: {
          type: DataTypes.STRING,
          primaryKey: true
        }
      }, { timestamps: false });

      this.Task = this.sequelize.define('Task', {
        name: {
          type: DataTypes.STRING,
          primaryKey: true
        }
      }, { timestamps: false });

      this.Hobby = this.sequelize.define('Hobby', {
        name: {
          type: DataTypes.STRING,
          primaryKey: true
        }
      }, { timestamps: false });

      this.User.belongsToMany(this.Project, { through: 'user_project' });
      this.Project.belongsToMany(this.User, { through: 'user_project' });

      this.Project.belongsToMany(this.Task, { through: 'task_project' });
      this.Task.belongsToMany(this.Project, { through: 'task_project' });

      this.User.belongsToMany(this.Hobby, { through: 'user_hobby' });
      this.Hobby.belongsToMany(this.User, { through: 'user_hobby' });

      this.Post = this.sequelize.define('Post', {
        name: {
          type: DataTypes.STRING,
          primaryKey: true
        }
      }, { timestamps: false });

      this.Comment = this.sequelize.define('Comment', {
        name: {
          type: DataTypes.STRING,
          primaryKey: true
        }
      }, { timestamps: false });

      this.Tag = this.sequelize.define('Tag', {
        name: {
          type: DataTypes.STRING,
          primaryKey: true
        }
      }, { timestamps: false });

      this.Color = this.sequelize.define('Color', {
        name: {
          type: DataTypes.STRING,
          primaryKey: true
        }
      }, { timestamps: false });

      this.Footnote = this.sequelize.define('Footnote', {
        name: {
          type: DataTypes.STRING,
          primaryKey: true
        }
      }, { timestamps: false });

      this.Post.hasMany(this.Comment);
      this.Comment.belongsTo(this.Post);

      this.Post.belongsToMany(this.Tag, { through: 'post_tag' });
      this.Tag.belongsToMany(this.Post, { through: 'post_tag' });

      this.Post.hasMany(this.Footnote);
      this.Footnote.belongsTo(this.Post);

      this.User.hasMany(this.Post);
      this.Post.belongsTo(this.User);

      this.Tag.belongsTo(this.Color);
      this.Color.hasMany(this.Tag);
    });

    /*
     * many-to-many
     */
    it('supports many-to-many association with where clause', async function() {
      await this.sequelize.sync({ force: true });

      const [projects, users] = await Promise.all([
        this.Project.bulkCreate(build('alpha', 'bravo', 'charlie')),
        this.User.bulkCreate(build('Alice', 'Bob'))
      ]);

      await Promise.all([
        projects[0].addUser(users[0]),
        projects[1].addUser(users[1]),
        projects[2].addUser(users[0])
      ]);

      const result = await this.Project.findAll({
        include: [{
          model: this.User,
          where: {
            name: 'Alice'
          }
        }],
        order: ['name'],
        limit: 1,
        offset: 1
      });

      expect(result.length).to.equal(1);
      expect(result[0].name).to.equal('charlie');
    });

    it('supports 2 levels of required many-to-many associations', async function() {
      await this.sequelize.sync({ force: true });

      const [projects, users, hobbies] = await Promise.all([
        this.Project.bulkCreate(build('alpha', 'bravo', 'charlie')),
        this.User.bulkCreate(build('Alice', 'Bob')),
        this.Hobby.bulkCreate(build('archery', 'badminton'))
      ]);

      await Promise.all([
        projects[0].addUser(users[0]),
        projects[1].addUser(users[1]),
        projects[2].addUser(users[0]),
        users[0].addHobby(hobbies[0])
      ]);

      const result = await this.Project.findAll({
        include: [{
          model: this.User,
          required: true,
          include: [{
            model: this.Hobby,
            required: true
          }]
        }],
        order: ['name'],
        limit: 1,
        offset: 1
      });

      expect(result.length).to.equal(1);
      expect(result[0].name).to.equal('charlie');
    });

    it('supports 2 levels of required many-to-many associations with where clause', async function() {
      await this.sequelize.sync({ force: true });

      const [projects, users, hobbies] = await Promise.all([
        this.Project.bulkCreate(build('alpha', 'bravo', 'charlie')),
        this.User.bulkCreate(build('Alice', 'Bob')),
        this.Hobby.bulkCreate(build('archery', 'badminton'))
      ]);

      await Promise.all([
        projects[0].addUser(users[0]),
        projects[1].addUser(users[1]),
        projects[2].addUser(users[0]),
        users[0].addHobby(hobbies[0]),
        users[1].addHobby(hobbies[1])
      ]);

      const result = await this.Project.findAll({
        include: [{
          model: this.User,
          required: true,
          include: [{
            model: this.Hobby,
            where: {
              name: 'archery'
            }
          }]
        }],
        order: ['name'],
        limit: 1,
        offset: 1
      });

      expect(result.length).to.equal(1);
      expect(result[0].name).to.equal('charlie');
    });

    it('supports 2 levels of required many-to-many associations with through.where clause', async function() {
      await this.sequelize.sync({ force: true });

      const [projects, users, hobbies] = await Promise.all([
        this.Project.bulkCreate(build('alpha', 'bravo', 'charlie')),
        this.User.bulkCreate(build('Alice', 'Bob')),
        this.Hobby.bulkCreate(build('archery', 'badminton'))
      ]);

      await Promise.all([
        projects[0].addUser(users[0]),
        projects[1].addUser(users[1]),
        projects[2].addUser(users[0]),
        users[0].addHobby(hobbies[0]),
        users[1].addHobby(hobbies[1])
      ]);

      const result = await this.Project.findAll({
        include: [{
          model: this.User,
          required: true,
          include: [{
            model: this.Hobby,
            required: true,
            through: {
              where: {
                HobbyName: 'archery'
              }
            }
          }]
        }],
        order: ['name'],
        limit: 1,
        offset: 1
      });

      expect(result.length).to.equal(1);
      expect(result[0].name).to.equal('charlie');
    });

    it('supports 3 levels of required many-to-many associations with where clause', async function() {
      await this.sequelize.sync({ force: true });

      const [tasks, projects, users, hobbies] = await Promise.all([
        this.Task.bulkCreate(build('alpha', 'bravo', 'charlie')),
        this.Project.bulkCreate(build('alpha', 'bravo', 'charlie')),
        this.User.bulkCreate(build('Alice', 'Bob', 'Charlotte')),
        this.Hobby.bulkCreate(build('archery', 'badminton'))
      ]);

      await Promise.all([
        tasks[0].addProject(projects[0]),
        tasks[1].addProject(projects[1]),
        tasks[2].addProject(projects[2]),
        projects[0].addUser(users[0]),
        projects[1].addUser(users[1]),
        projects[2].addUser(users[0]),
        users[0].addHobby(hobbies[0]),
        users[1].addHobby(hobbies[1])
      ]);

      const result = await this.Task.findAll({
        include: [{
          model: this.Project,
          required: true,
          include: [{
            model: this.User,
            required: true,
            include: [{
              model: this.Hobby,
              where: {
                name: 'archery'
              }
            }]
          }]
        }],
        order: ['name'],
        limit: 1,
        offset: 1
      });

      expect(result.length).to.equal(1);
      expect(result[0].name).to.equal('charlie');
    });

    it('supports required many-to-many association', async function() {
      await this.sequelize.sync({ force: true });

      const [projects, users] = await Promise.all([
        this.Project.bulkCreate(build('alpha', 'bravo', 'charlie')),
        this.User.bulkCreate(build('Alice', 'Bob'))
      ]);

      await Promise.all([// alpha
        projects[0].addUser(users[0]), // charlie
        projects[2].addUser(users[0])]);

      const result = await this.Project.findAll({
        include: [{
          model: this.User,
          required: true
        }],
        order: ['name'],
        limit: 1,
        offset: 1
      });

      expect(result.length).to.equal(1);
      expect(result[0].name).to.equal('charlie');
    });

    it('supports 2 required many-to-many association', async function() {
      await this.sequelize.sync({ force: true });

      const [projects, users, tasks] = await Promise.all([
        this.Project.bulkCreate(build('alpha', 'bravo', 'charlie', 'delta')),
        this.User.bulkCreate(build('Alice', 'Bob', 'David')),
        this.Task.bulkCreate(build('a', 'c', 'd'))
      ]);

      await Promise.all([
        projects[0].addUser(users[0]),
        projects[0].addTask(tasks[0]),
        projects[1].addUser(users[1]),
        projects[2].addTask(tasks[1]),
        projects[3].addUser(users[2]),
        projects[3].addTask(tasks[2])
      ]);

      const result = await this.Project.findAll({
        include: [{
          model: this.User,
          required: true
        }, {
          model: this.Task,
          required: true
        }],
        order: ['name'],
        limit: 1,
        offset: 1
      });

      expect(result.length).to.equal(1);
      expect(result[0].name).to.equal('delta');
    });

    /*
     * one-to-many
     */
    it('supports required one-to-many association', async function() {
      await this.sequelize.sync({ force: true });

      const [posts, comments] = await Promise.all([
        this.Post.bulkCreate(build('alpha', 'bravo', 'charlie')),
        this.Comment.bulkCreate(build('comment0', 'comment1'))
      ]);

      await Promise.all([posts[0].addComment(comments[0]), posts[2].addComment(comments[1])]);

      const result = await this.Post.findAll({
        include: [{
          model: this.Comment,
          required: true
        }],
        order: ['name'],
        limit: 1,
        offset: 1
      });

      expect(result.length).to.equal(1);
      expect(result[0].name).to.equal('charlie');
    });

    it('supports required one-to-many association with where clause', async function() {
      await this.sequelize.sync({ force: true });

      const [posts, comments] = await Promise.all([
        this.Post.bulkCreate(build('alpha', 'bravo', 'charlie')),
        this.Comment.bulkCreate(build('comment0', 'comment1', 'comment2'))
      ]);

      await Promise.all([
        posts[0].addComment(comments[0]),
        posts[1].addComment(comments[1]),
        posts[2].addComment(comments[2])
      ]);

      const result = await this.Post.findAll({
        include: [{
          model: this.Comment,
          required: true,
          where: {
            [Op.or]: [{
              name: 'comment0'
            }, {
              name: 'comment2'
            }]
          }
        }],
        order: ['name'],
        limit: 1,
        offset: 1
      });

      expect(result.length).to.equal(1);
      expect(result[0].name).to.equal('charlie');
    });

    it('supports required one-to-many association with where clause (findOne)', async function() {
      await this.sequelize.sync({ force: true });

      const [posts, comments] = await Promise.all([
        this.Post.bulkCreate(build('alpha', 'bravo', 'charlie')),
        this.Comment.bulkCreate(build('comment0', 'comment1', 'comment2'))
      ]);

      await Promise.all([
        posts[0].addComment(comments[0]),
        posts[1].addComment(comments[1]),
        posts[2].addComment(comments[2])
      ]);

      const post = await this.Post.findOne({
        include: [{
          model: this.Comment,
          required: true,
          where: {
            name: 'comment2'
          }
        }]
      });

      expect(post.name).to.equal('charlie');
    });

    it('supports 2 levels of required one-to-many associations', async function() {
      await this.sequelize.sync({ force: true });

      const [users, posts, comments] = await Promise.all([
        this.User.bulkCreate(build('Alice', 'Bob', 'Charlotte', 'David')),
        this.Post.bulkCreate(build('post0', 'post1', 'post2')),
        this.Comment.bulkCreate(build('comment0', 'comment1', 'comment2'))
      ]);

      await Promise.all([
        users[0].addPost(posts[0]),
        users[1].addPost(posts[1]),
        users[3].addPost(posts[2]),
        posts[0].addComment(comments[0]),
        posts[2].addComment(comments[2])
      ]);

      const result = await this.User.findAll({
        include: [{
          model: this.Post,
          required: true,
          include: [{
            model: this.Comment,
            required: true
          }]
        }],
        order: ['name'],
        limit: 1,
        offset: 1
      });

      expect(result.length).to.equal(1);
      expect(result[0].name).to.equal('David');
    });

    /*
     * mixed many-to-many, one-to-many and many-to-one
     */
    it('supports required one-to-many association with nested required many-to-many association', async function() {
      await this.sequelize.sync({ force: true });

      const [users, posts, tags] = await Promise.all([
        this.User.bulkCreate(build('Alice', 'Bob', 'Charlotte', 'David')),
        this.Post.bulkCreate(build('alpha', 'charlie', 'delta')),
        this.Tag.bulkCreate(build('atag', 'btag', 'dtag'))
      ]);

      await Promise.all([
        users[0].addPost(posts[0]),
        users[2].addPost(posts[1]),
        users[3].addPost(posts[2]),
        posts[0].addTag([tags[0]]),
        posts[2].addTag([tags[2]])
      ]);

      const result = await this.User.findAll({
        include: [{
          model: this.Post,
          required: true,
          include: [{
            model: this.Tag,
            required: true
          }]
        }],
        order: ['name'],
        limit: 1,
        offset: 1
      });

      expect(result.length).to.equal(1);
      expect(result[0].name).to.equal('David');
    });

    it('supports required many-to-many association with nested required one-to-many association', async function() {
      await this.sequelize.sync({ force: true });

      const [projects, users, posts] = await Promise.all([
        this.Project.bulkCreate(build('alpha', 'bravo', 'charlie', 'delta')),
        this.User.bulkCreate(build('Alice', 'Bob', 'David')),
        this.Post.bulkCreate(build('post0', 'post1', 'post2'))
      ]);

      await Promise.all([
        projects[0].addUser(users[0]),
        projects[1].addUser(users[1]),
        projects[3].addUser(users[2]),
        users[0].addPost([posts[0]]),
        users[2].addPost([posts[2]])
      ]);

      const result = await this.Project.findAll({
        include: [{
          model: this.User,
          required: true,
          include: [{
            model: this.Post,
            required: true,
            duplicating: true
          }]
        }],
        order: ['name'],
        limit: 1,
        offset: 1
      });

      expect(result.length).to.equal(1);
      expect(result[0].name).to.equal('delta');
    });

    it('supports required many-to-one association with nested many-to-many association with where clause', async function() {
      await this.sequelize.sync({ force: true });

      const [posts, users, hobbies] = await Promise.all([
        this.Post.bulkCreate(build('post0', 'post1', 'post2', 'post3')),
        this.User.bulkCreate(build('Alice', 'Bob', 'Charlotte', 'David')),
        this.Hobby.bulkCreate(build('archery', 'badminton'))
      ]);

      await Promise.all([
        posts[0].setUser(users[0]),
        posts[1].setUser(users[1]),
        posts[3].setUser(users[3]),
        users[0].addHobby(hobbies[0]),
        users[1].addHobby(hobbies[1]),
        users[3].addHobby(hobbies[0])
      ]);

      const result = await this.Post.findAll({
        include: [{
          model: this.User,
          required: true,
          include: [{
            model: this.Hobby,
            where: {
              name: 'archery'
            }
          }]
        }],
        order: ['name'],
        limit: 1,
        offset: 1
      });

      expect(result.length).to.equal(1);
      expect(result[0].name).to.equal('post3');
    });

    it('supports required many-to-one association with nested many-to-many association with through.where clause', async function() {
      await this.sequelize.sync({ force: true });

      const [posts, users, hobbies] = await Promise.all([
        this.Post.bulkCreate(build('post0', 'post1', 'post2', 'post3')),
        this.User.bulkCreate(build('Alice', 'Bob', 'Charlotte', 'David')),
        this.Hobby.bulkCreate(build('archery', 'badminton'))
      ]);

      await Promise.all([
        posts[0].setUser(users[0]),
        posts[1].setUser(users[1]),
        posts[3].setUser(users[3]),
        users[0].addHobby(hobbies[0]),
        users[1].addHobby(hobbies[1]),
        users[3].addHobby(hobbies[0])
      ]);

      const result = await this.Post.findAll({
        include: [{
          model: this.User,
          required: true,
          include: [{
            model: this.Hobby,
            required: true,
            through: {
              where: {
                HobbyName: 'archery'
              }
            }
          }]
        }],
        order: ['name'],
        limit: 1,
        offset: 1
      });

      expect(result.length).to.equal(1);
      expect(result[0].name).to.equal('post3');
    });

    it('supports required many-to-one association with multiple nested associations with where clause', async function() {
      await this.sequelize.sync({ force: true });

      const [comments, posts, users, tags] = await Promise.all([
        this.Comment.bulkCreate(build('comment0', 'comment1', 'comment2', 'comment3', 'comment4', 'comment5')),
        this.Post.bulkCreate(build('post0', 'post1', 'post2', 'post3', 'post4')),
        this.User.bulkCreate(build('Alice', 'Bob')),
        this.Tag.bulkCreate(build('tag0', 'tag1'))
      ]);

      await Promise.all([
        comments[0].setPost(posts[0]),
        comments[1].setPost(posts[1]),
        comments[3].setPost(posts[2]),
        comments[4].setPost(posts[3]),
        comments[5].setPost(posts[4]),
        posts[0].addTag(tags[0]),
        posts[3].addTag(tags[0]),
        posts[4].addTag(tags[0]),
        posts[1].addTag(tags[1]),
        posts[0].setUser(users[0]),
        posts[2].setUser(users[0]),
        posts[4].setUser(users[0]),
        posts[1].setUser(users[1])
      ]);

      const result = await this.Comment.findAll({
        include: [{
          model: this.Post,
          required: true,
          include: [{
            model: this.User,
            where: {
              name: 'Alice'
            }
          }, {
            model: this.Tag,
            where: {
              name: 'tag0'
            }
          }]
        }],
        order: ['name'],
        limit: 1,
        offset: 1
      });

      expect(result.length).to.equal(1);
      expect(result[0].name).to.equal('comment5');
    });

    it('supports required many-to-one association with nested one-to-many association with where clause', async function() {
      await this.sequelize.sync({ force: true });

      const [comments, posts, footnotes] = await Promise.all([
        this.Comment.bulkCreate(build('comment0', 'comment1', 'comment2')),
        this.Post.bulkCreate(build('post0', 'post1', 'post2')),
        this.Footnote.bulkCreate(build('footnote0', 'footnote1', 'footnote2'))
      ]);

      await Promise.all([
        comments[0].setPost(posts[0]),
        comments[1].setPost(posts[1]),
        comments[2].setPost(posts[2]),
        posts[0].addFootnote(footnotes[0]),
        posts[1].addFootnote(footnotes[1]),
        posts[2].addFootnote(footnotes[2])
      ]);

      const result = await this.Comment.findAll({
        include: [{
          model: this.Post,
          required: true,
          include: [{
            model: this.Footnote,
            where: {
              [Op.or]: [{
                name: 'footnote0'
              }, {
                name: 'footnote2'
              }]
            }
          }]
        }],
        order: ['name'],
        limit: 1,
        offset: 1
      });

      expect(result.length).to.equal(1);
      expect(result[0].name).to.equal('comment2');
    });
  });
});
