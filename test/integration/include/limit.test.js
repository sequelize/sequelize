'use strict';

const chai = require('chai'),
  Sequelize = require('../../../index'),
  expect = chai.expect,
  Support = require(__dirname + '/../support'),
  DataTypes = require(__dirname + '/../../../lib/data-types'),
  Promise = Sequelize.Promise;

describe(Support.getTestDialectTeaser('Include'), () => {
  describe('LIMIT', () => {

    let User = false;
    let Project = false;
    let Task = false;
    let Hobby = false;

    let Post = false;
    let Comment = false;

    /*
     * many-to-many associations:
     * Task <---> Project <---> User <---> Hobby
     *
     * one-to-many associations:
     * Post <+--> Comment
     */
    beforeEach(function () {
      Project = this.sequelize.define('Project', {
        name: {
          type: DataTypes.STRING,
          primaryKey: true
        }
      }, {timestamps: false});

      User = this.sequelize.define('User', {
        name: {
          type: DataTypes.STRING,
          primaryKey: true
        }
      }, {timestamps: false});

      Task = this.sequelize.define('Task', {
        name: {
          type: DataTypes.STRING,
          primaryKey: true
        }
      }, {timestamps: false});

      Hobby = this.sequelize.define('Hobby', {
        name: {
          type: DataTypes.STRING,
          primaryKey: true
        }
      }, {timestamps: false});

      User.belongsToMany(Project, {through: 'user_project'});
      Project.belongsToMany(User, {through: 'user_project'});

      Project.belongsToMany(Task, {through: 'task_project'});
      Task.belongsToMany(Project, {through: 'task_project'});

      User.belongsToMany(Hobby, {through: 'user_hobby'});
      Hobby.belongsToMany(User, {through: 'user_hobby'});

      Post = this.sequelize.define('Post', {
        name: {
          type: DataTypes.STRING,
          primaryKey: true
        }
      }, {timestamps: false});

      Comment = this.sequelize.define('Comment', {
        name: {
          type: DataTypes.STRING,
          primaryKey: true
        }
      }, {timestamps: false});

      Post.hasMany(Comment);
      Comment.belongsTo(Post);
    });

    it('supports many-to-many association with where clause', function () {
      return this.sequelize.sync({ force: true })
        .then(() => Promise.join(
          Project.bulkCreate([
            { name: 'alpha' },
            { name: 'bravo' },
            { name: 'charlie' }
          ]),
          User.bulkCreate([
            { name: 'Alice' },
            { name: 'Bob' }
          ])
        ))
        .spread((projects, users) => Promise.join(
          projects[0].addUser(users[0]),
          projects[1].addUser(users[1]),
          projects[2].addUser(users[0])
        ))
        .then(() => Project.findAll({
          include: [{
            model: User,
            where: {
              name: 'Alice'
            }
          }],
          order: ['name'],
          limit: 1,
          offset: 1
        }))
        .then(result => {
          expect(result.length).to.equal(1);
          expect(result[0].name).to.equal('charlie');
        });
    });

    it.skip('supports 2 levels of required many-to-many associations', function () {
      User.belongsToMany(Project, {through: 'user_project'});
      Project.belongsToMany(User, {through: 'user_project'});

      User.belongsToMany(Hobby, {through: 'user_hobby'});
      Hobby.belongsToMany(User, {through: 'user_hobby'});

      return this.sequelize.sync({ force: true })
        .then(() => Promise.join(
          Project.bulkCreate([
            { name: 'alpha' },
            { name: 'bravo' },
            { name: 'charlie' }
          ]),
          User.bulkCreate([
            { name: 'Alice' },
            { name: 'Bob' }
          ]),
          Hobby.bulkCreate([
            { name: 'archery' },
            { name: 'badminton' }
          ])
        ))
        .spread((projects, users, hobbies) => Promise.join(
          projects[0].addUser(users[0]),
          projects[1].addUser(users[1]),
          projects[2].addUser(users[0]),
          projects[0].addHobby(hobbies[0])
        ))
        .then(() => Project.findAll({
          include: [{
            model: User,
            required: true,
            include: [{
              model: Hobby,
              required: true
            }]
          }],
          order: ['name'],
          limit: 1,
          offset: 1
        }))
        .then(result => {
          expect(result.length).to.equal(1);
          expect(result[0].name).to.equal('charlie');
        });
    });

    it('supports required many-to-many association', function () {
      return this.sequelize.sync({ force: true })
        .then(() => Promise.join(
          Project.bulkCreate([
            { name: 'alpha' },
            { name: 'bravo' },
            { name: 'charlie' }
          ]),
          User.bulkCreate([
            { name: 'Alice' },
            { name: 'Bob' }
          ])
        ))
        .spread((projects, users) => Promise.join(
          projects[0].addUser(users[0]), // alpha
          projects[2].addUser(users[0]) // charlie
        ))
        .then(() => Project.findAll({
          include: [{
            model: User,
            required: true
          }],
          order: ['name'],
          limit: 1,
          offset: 1
        }))
        .then(result => {
          expect(result.length).to.equal(1);
          expect(result[0].name).to.equal('charlie');
        });
    });

    it('supports 2 required many-to-many association', function () {
      User.belongsToMany(Project, {through: 'user_project'});
      Project.belongsToMany(User, {through: 'user_project'});

      Project.belongsToMany(Task, {through: 'task_project'});
      Task.belongsToMany(Project, {through: 'task_project'});

      return this.sequelize.sync({ force: true })
        .then(() => Promise.join(
          Project.bulkCreate([
            { name: 'alpha' },
            { name: 'bravo' },
            { name: 'charlie' },
            { name: 'delta' },
          ]),
          User.bulkCreate([
            { name: 'Alice' },
            { name: 'Bob' },
            { name: 'David' }
          ]),
          Task.bulkCreate([
            { name: 'a' },
            { name: 'c' },
            { name: 'd' }
          ])
        ))
        .spread((projects, users, tasks) => Promise.join(
          projects[0].addUser(users[0]),
          projects[0].addTask(tasks[0]),
          projects[1].addUser(users[1]),
          projects[2].addTask(tasks[1]),
          projects[3].addUser(users[2]),
          projects[3].addTask(tasks[2])
        ))
        .then(() => Project.findAll({
          include: [{
            model: User,
            required: true
          }, {
            model: Task,
            required: true
          }],
          order: ['name'],
          limit: 1,
          offset: 1
        }))
        .then(result => {
          expect(result.length).to.equal(1);
          expect(result[0].name).to.equal('delta');
        });
    });

    it('supports required one-to-many association', function () {
      return this.sequelize.sync({ force: true })
        .then(() => Promise.join(
          Post.bulkCreate([
            { name: 'alpha' },
            { name: 'bravo' },
            { name: 'charlie' }
          ]),
          Comment.bulkCreate([
            { name: 'comment0' },
            { name: 'comment1' },
          ])
        ))
        .spread((posts, comments) => Promise.join(
          posts[0].addComment(comments[0]),
          posts[2].addComment(comments[1])
        ))
        .then(() => Post.findAll({
          include: [{
            model: Comment,
            required: true
          }],
          order: ['name'],
          limit: 1,
          offset: 1
        }))
        .then(result => {
          expect(result.length).to.equal(1);
          expect(result[0].name).to.equal('charlie');
        });
    });

    it('supports required one-to-many association with where clause', function () {
      return this.sequelize.sync({ force: true })
        .then(() => Promise.join(
          Post.bulkCreate([
            { name: 'alpha' },
            { name: 'bravo' },
            { name: 'charlie' }
          ]),
          Comment.bulkCreate([
            { name: 'comment0' },
            { name: 'comment1' },
          ])
        ))
        .spread((posts, comments) => Promise.join(
          posts[0].addComment(comments[0]),
          posts[2].addComment(comments[1])
        ))
        .then(() => Post.findAll({
          include: [{
            model: Comment,
            required: true,
            where: {
              name: {
                [this.sequelize.Op.like]: 'comment%'
              }
            }
          }],
          order: ['name'],
          limit: 1,
          offset: 1
        }))
        .then(result => {
          expect(result.length).to.equal(1);
          expect(result[0].name).to.equal('charlie');
        });
    });
  });
});
