'use strict';

const chai = require('chai'),
  expect = chai.expect,
  Support = require(__dirname + '/../support'),
  DataTypes = require(__dirname + '/../../../lib/data-types'),
  Sequelize = require('../../../index'),
  _ = require('lodash'),
  sinon = require('sinon'),
  Promise = Sequelize.Promise,
  current = Support.sequelize,
  dialect = Support.getTestDialect();

describe(Support.getTestDialectTeaser('BelongsToMany'), () => {
  describe('getAssociations', () => {
    beforeEach(function() {
      const self = this;

      this.User = this.sequelize.define('User', { username: DataTypes.STRING });
      this.Task = this.sequelize.define('Task', { title: DataTypes.STRING, active: DataTypes.BOOLEAN });

      this.User.belongsToMany(this.Task, { through: 'UserTasks' });
      this.Task.belongsToMany(this.User, { through: 'UserTasks' });

      return this.sequelize.sync({ force: true }).then(() => {
        return Promise.all([
          self.User.create({ username: 'John'}),
          self.Task.create({ title: 'Get rich', active: true}),
          self.Task.create({ title: 'Die trying', active: false})
        ]);
      }).spread((john, task1, task2) => {
        self.tasks = [task1, task2];
        self.user = john;
        return john.setTasks([task1, task2]);
      });
    });

    if (current.dialect.supports.transactions) {
      it('supports transactions', function() {
        return Support.prepareTransactionTest(this.sequelize).bind({}).then(function(sequelize) {
          this.sequelize = sequelize;
          this.Article = sequelize.define('Article', { 'title': DataTypes.STRING });
          this.Label = sequelize.define('Label', { 'text': DataTypes.STRING });

          this.Article.belongsToMany(this.Label, { through: 'ArticleLabels' });
          this.Label.belongsToMany(this.Article, { through: 'ArticleLabels' });

          return sequelize.sync({ force: true });
        }).then(function() {
          return Promise.all([
            this.Article.create({ title: 'foo' }),
            this.Label.create({ text: 'bar' }),
            this.sequelize.transaction()
          ]);
        }).spread(function(article, label, t) {
          this.t = t;
          return article.setLabels([label], { transaction: t });
        }).then(function() {
          return this.Article.all({ transaction: this.t });
        }).then(articles => {
          return articles[0].getLabels();
        }).then(function(labels) {
          expect(labels).to.have.length(0);
          return this.Article.all({ transaction: this.t });
        }).then(function(articles) {
          return articles[0].getLabels({ transaction: this.t });
        }).then(function(labels) {
          expect(labels).to.have.length(1);
          return this.t.rollback();
        });
      });
    }

    it('gets all associated objects with all fields', function() {
      return this.User.find({where: {username: 'John'}}).then(john => {
        return john.getTasks();
      }).then(tasks => {
        tasks[0].attributes.forEach(attr => {
          expect(tasks[0]).to.have.property(attr);
        });
      });
    });

    it('gets all associated objects when no options are passed', function() {
      return this.User.find({where: {username: 'John'}}).then(john => {
        return john.getTasks();
      }).then(tasks => {
        expect(tasks).to.have.length(2);
      });
    });

    it('only get objects that fulfill the options', function() {
      return this.User.find({where: {username: 'John'}}).then(john => {
        return john.getTasks({
          where: {
            active: true
          }
        });
      }).then(tasks => {
        expect(tasks).to.have.length(1);
      });
    });

    it('supports a where not in', function() {
      return this.User.find({
        where: {
          username: 'John'
        }
      }).then(john => {
        return john.getTasks({
          where: {
            title: {
              not: ['Get rich']
            }
          }
        });
      }).then(tasks => {
        expect(tasks).to.have.length(1);
      });
    });

    it('supports a where not in on the primary key', function() {
      const self = this;

      return this.User.find({
        where: {
          username: 'John'
        }
      }).then(john => {
        return john.getTasks({
          where: {
            id: {
              not: [self.tasks[0].get('id')]
            }
          }
        });
      }).then(tasks => {
        expect(tasks).to.have.length(1);
      });
    });

    it('only gets objects that fulfill options with a formatted value', function() {
      return this.User.find({where: {username: 'John'}}).then(john => {
        return john.getTasks({where: {active: true}});
      }).then(tasks => {
        expect(tasks).to.have.length(1);
      });
    });

    it('get associated objects with an eager load', function() {
      return this.User.find({where: {username: 'John'}, include: [this.Task]}).then(john => {
        expect(john.Tasks).to.have.length(2);
      });
    });

    it('get associated objects with an eager load with conditions but not required', function() {
      const Label = this.sequelize.define('Label', { 'title': DataTypes.STRING, 'isActive': DataTypes.BOOLEAN }),
        Task = this.Task,
        User = this.User;

      Task.hasMany(Label);
      Label.belongsTo(Task);

      return Label.sync({force: true}).then(() => {
        return User.find({
          where: { username: 'John'},
          include: [
            { model: Task, required: false, include: [
              { model: Label, required: false, where: { isActive: true } }
            ]}
          ]
        });
      }).then(john => {
        expect(john.Tasks).to.have.length(2);
      });
    });

    it('should support schemas', function() {
      const AcmeUser = this.sequelize.define('User', {
          username: DataTypes.STRING
        }).schema('acme', '_'),
        AcmeProject = this.sequelize.define('Project', {
          title: DataTypes.STRING,
          active: DataTypes.BOOLEAN
        }).schema('acme', '_'),
        AcmeProjectUsers = this.sequelize.define('ProjectUsers', {
          status: DataTypes.STRING,
          data: DataTypes.INTEGER
        }).schema('acme', '_');

      AcmeUser.belongsToMany(AcmeProject, {through: AcmeProjectUsers});
      AcmeProject.belongsToMany(AcmeUser, {through: AcmeProjectUsers});

      return this.sequelize.dropAllSchemas().then(() => {
        return this.sequelize.createSchema('acme');
      }).then(() => {
        return Promise.all([
          AcmeUser.sync({force: true}),
          AcmeProject.sync({force: true})
        ]);
      }).then(() => {
        return AcmeProjectUsers.sync({force: true});
      }).bind({}).then(() => {
        return AcmeUser.create();
      }).then(function(u) {
        this.u = u;
        return AcmeProject.create();
      }).then(function(p) {
        return this.u.addProject(p, { through: { status: 'active', data: 42 }});
      }).then(function() {
        return this.u.getProjects();
      }).then(projects => {
        expect(projects).to.have.length(1);
        const project = projects[0];
        expect(project.ProjectUsers).to.be.ok;
        expect(project.status).not.to.exist;
        expect(project.ProjectUsers.status).to.equal('active');
        return this.sequelize.dropSchema('acme').then(() => {
          return this.sequelize.showAllSchemas().then(schemas => {
            if (dialect === 'postgres' || dialect === 'mssql') {
              expect(schemas).to.be.empty;
            }
          });
        });
      });
    });

    it('supports custom primary keys and foreign keys', function() {
      const User = this.sequelize.define('User', {
        'id_user': {
          type: DataTypes.UUID,
          primaryKey: true,
          defaultValue: DataTypes.UUIDV4,
          allowNull: false
        }
      }, {
        tableName: 'tbl_user'
      });

      const Group = this.sequelize.define('Group', {
        'id_group': {
          type: DataTypes.UUID,
          allowNull: false,
          primaryKey: true,
          defaultValue: DataTypes.UUIDV4
        }
      }, {
        tableName: 'tbl_group'
      });

      const User_has_Group = this.sequelize.define('User_has_Group', {

      }, {
        tableName: 'tbl_user_has_group'
      });

      User.belongsToMany(Group, {as: 'groups', through: User_has_Group, foreignKey: 'id_user'});
      Group.belongsToMany(User, {as: 'users', through: User_has_Group, foreignKey: 'id_group'});

      return this.sequelize.sync({force: true}).then(() => {
        return Promise.join(
          User.create(),
          Group.create()
        ).spread((user, group) => {
          return user.addGroup(group);
        }).then(() => {
          return User.findOne({
            where: {}
          }).then(user => {
            return user.getGroups();
          });
        });
      });
    });

    it('supports primary key attributes with different field names', function() {
      const User = this.sequelize.define('User', {
        id: {
          type: DataTypes.UUID,
          allowNull: false,
          primaryKey: true,
          defaultValue: DataTypes.UUIDV4,
          field: 'user_id'
        }
      }, {
        tableName: 'tbl_user'
      });

      const Group = this.sequelize.define('Group', {
        id: {
          type: DataTypes.UUID,
          allowNull: false,
          primaryKey: true,
          defaultValue: DataTypes.UUIDV4,
          field: 'group_id'
        }
      }, {
        tableName: 'tbl_group'
      });

      const User_has_Group = this.sequelize.define('User_has_Group', {

      }, {
        tableName: 'tbl_user_has_group'
      });

      User.belongsToMany(Group, {through: User_has_Group});
      Group.belongsToMany(User, {through: User_has_Group});

      return this.sequelize.sync({force: true}).then(() => {
        return Promise.join(
          User.create(),
          Group.create()
        ).spread((user, group) => {
          return user.addGroup(group);
        }).then(() => {
          return Promise.join(
            User.findOne({
              where: {},
              include: [Group]
            }),
            User.findAll({
              include: [Group]
            })
          );
        });
      });
    });

    it('supports primary key attributes with different field names where parent include is required', function() {
      const User = this.sequelize.define('User', {
        id: {
          type: DataTypes.UUID,
          allowNull: false,
          primaryKey: true,
          defaultValue: DataTypes.UUIDV4,
          field: 'user_id'
        }
      }, {
        tableName: 'tbl_user'
      });

      const Company = this.sequelize.define('Company', {
        id: {
          type: DataTypes.UUID,
          allowNull: false,
          primaryKey: true,
          defaultValue: DataTypes.UUIDV4,
          field: 'company_id'
        }
      }, {
        tableName: 'tbl_company'
      });

      const Group = this.sequelize.define('Group', {
        id: {
          type: DataTypes.UUID,
          allowNull: false,
          primaryKey: true,
          defaultValue: DataTypes.UUIDV4,
          field: 'group_id'
        }
      }, {
        tableName: 'tbl_group'
      });

      const Company_has_Group = this.sequelize.define('Company_has_Group', {

      }, {
        tableName: 'tbl_company_has_group'
      });

      User.belongsTo(Company);
      Company.hasMany(User);
      Company.belongsToMany(Group, {through: Company_has_Group});
      Group.belongsToMany(Company, {through: Company_has_Group});

      return this.sequelize.sync({force: true}).then(() => {
        return Promise.join(
          User.create(),
          Group.create(),
          Company.create()
        ).spread((user, group, company) => {
          return Promise.join(
            user.setCompany(company),
            company.addGroup(group)
          );
        }).then(() => {
          return Promise.join(
            User.findOne({
              where: {},
              include: [
                {model: Company, include: [Group]}
              ]
            }),
            User.findAll({
              include: [
                {model: Company, include: [Group]}
              ]
            }),
            User.findOne({
              where: {},
              include: [
                {model: Company, required: true, include: [Group]}
              ]
            }),
            User.findAll({
              include: [
                {model: Company, required: true, include: [Group]}
              ]
            })
          );
        });
      });
    });
  });

  describe('countAssociations', () => {
    beforeEach(function() {
      const self = this;

      this.User = this.sequelize.define('User', {
        username: DataTypes.STRING
      });
      this.Task = this.sequelize.define('Task', {
        title: DataTypes.STRING,
        active: DataTypes.BOOLEAN
      });
      this.UserTask = this.sequelize.define('UserTask', {
        id: {
          type: DataTypes.INTEGER,
          primaryKey: true,
          autoIncrement: true
        },
        started: {
          type: DataTypes.BOOLEAN,
          defaultValue: false
        }
      });

      this.User.belongsToMany(this.Task, { through: this.UserTask });
      this.Task.belongsToMany(this.User, { through: this.UserTask });

      return this.sequelize.sync({ force: true }).then(() => {
        return Promise.all([
          self.User.create({ username: 'John'}),
          self.Task.create({ title: 'Get rich', active: true}),
          self.Task.create({ title: 'Die trying', active: false})
        ]);
      }).spread((john, task1, task2) => {
        self.tasks = [task1, task2];
        self.user = john;
        return john.setTasks([task1, task2]);
      });
    });

    it('should count all associations', function() {
      return expect(this.user.countTasks({})).to.eventually.equal(2);
    });

    it('should count filtered associations', function() {
      return expect(this.user.countTasks({
        where: {
          active: true
        }
      })).to.eventually.equal(1);
    });

    it('should count scoped associations', function() {
      this.User.belongsToMany(this.Task, {
        as: 'activeTasks',
        through: this.UserTask,
        scope: {
          active: true
        }
      });

      return expect(this.user.countActiveTasks({})).to.eventually.equal(1);
    });

    it('should count scoped through associations', function() {
      const user = this.user;

      this.User.belongsToMany(this.Task, {
        as: 'startedTasks',
        through: {
          model: this.UserTask,
          scope: {
            started: true
          }
        }
      });

      return Promise.join(
        this.Task.create().then(task => {
          return user.addTask(task, {
            through: { started: true }
          });
        }),
        this.Task.create().then(task => {
          return user.addTask(task, {
            through: { started: true }
          });
        })
      ).then(() => {
        return expect(user.countStartedTasks({})).to.eventually.equal(2);
      });
    });
  });

  describe('setAssociations', () => {
    it('clears associations when passing null to the set-method', function() {
      const User = this.sequelize.define('User', { username: DataTypes.STRING }),
        Task = this.sequelize.define('Task', { title: DataTypes.STRING });

      User.belongsToMany(Task, { through: 'UserTasks' });
      Task.belongsToMany(User, { through: 'UserTasks' });

      return this.sequelize.sync({ force: true }).then(() => {
        return Promise.all([
          User.create({ username: 'foo' }),
          Task.create({ title: 'task' })
        ]);
      }).bind({}).spread(function(user, task) {
        this.task = task;
        return task.setUsers([user]);
      }).then(function() {
        return this.task.getUsers();
      }).then(function(_users) {
        expect(_users).to.have.length(1);

        return this.task.setUsers(null);
      }).then(function() {
        return this.task.getUsers();
      }).then(_users => {
        expect(_users).to.have.length(0);
      });
    });

    it('should be able to set twice with custom primary keys', function() {
      const User = this.sequelize.define('User', { uid: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true }, username: DataTypes.STRING }),
        Task = this.sequelize.define('Task', { tid: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true }, title: DataTypes.STRING });

      User.belongsToMany(Task, { through: 'UserTasks' });
      Task.belongsToMany(User, { through: 'UserTasks' });

      return this.sequelize.sync({ force: true }).then(() => {
        return Promise.all([
          User.create({ username: 'foo' }),
          User.create({ username: 'bar' }),
          Task.create({ title: 'task' })
        ]);
      }).bind({}).spread(function(user1, user2, task) {
        this.task = task;
        this.user1 = user1;
        this.user2 = user2;
        return task.setUsers([user1]);
      }).then(function() {
        this.user2.user_has_task = {usertitle: 'Something'};
        return this.task.setUsers([this.user1, this.user2]);
      }).then(function() {
        return this.task.getUsers();
      }).then(_users => {
        expect(_users).to.have.length(2);
      });
    });

    it('joins an association with custom primary keys', function() {
      const Group = this.sequelize.define('group', {
          group_id: {type: DataTypes.INTEGER, primaryKey: true},
          name: DataTypes.STRING(64)
        }),
        Member = this.sequelize.define('member', {
          member_id: {type: DataTypes.INTEGER, primaryKey: true},
          email: DataTypes.STRING(64)
        });

      Group.belongsToMany(Member, {through: 'group_members', foreignKey: 'group_id', otherKey: 'member_id'});
      Member.belongsToMany(Group, {through: 'group_members', foreignKey: 'member_id', otherKey: 'group_id'});

      return this.sequelize.sync({ force: true }).then(() => {
        return Promise.all([
          Group.create({group_id: 1, name: 'Group1'}),
          Member.create({member_id: 10, email: 'team@sequelizejs.com'})
        ]);
      }).spread((group, member) => {
        return group.addMember(member).return (group);
      }).then(group => {
        return group.getMembers();
      }).then(members => {
        expect(members).to.be.instanceof(Array);
        expect(members).to.have.length(1);
        expect(members[0].member_id).to.equal(10);
        expect(members[0].email).to.equal('team@sequelizejs.com');
      });
    });

    it('supports passing the primary key instead of an object', function() {
      const User = this.sequelize.define('User', { username: DataTypes.STRING }),
        Task = this.sequelize.define('Task', { title: DataTypes.STRING });

      User.belongsToMany(Task, { through: 'UserTasks' });
      Task.belongsToMany(User, { through: 'UserTasks' });

      return this.sequelize.sync({ force: true }).then(() => {
        return Promise.all([
          User.create({ id: 12 }),
          Task.create({ id: 50, title: 'get started' }),
          Task.create({ id: 5, title: 'wat' })
        ]);
      }).bind({}).spread(function(user, task1, task2) {
        this.user = user;
        this.task2 = task2;
        return user.addTask(task1.id);
      }).then(function() {
        return this.user.setTasks([this.task2.id]);
      }).then(function() {
        return this.user.getTasks();
      }).then(tasks => {
        expect(tasks).to.have.length(1);
        expect(tasks[0].title).to.equal('wat');
      });
    });

    it('using scope to set associations', function() {
      const self = this;
      const ItemTag = self.sequelize.define('ItemTag', {
          id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
          tag_id: { type: DataTypes.INTEGER, unique: false },
          taggable: { type: DataTypes.STRING },
          taggable_id: { type: DataTypes.INTEGER, unique: false }
        }),
        Tag = self.sequelize.define('Tag', {
          id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
          name: DataTypes.STRING
        }),
        Comment = self.sequelize.define('Comment', {
          id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
          name: DataTypes.STRING
        }),
        Post = self.sequelize.define('Post', {
          id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
          name: DataTypes.STRING
        });

      Post.belongsToMany(Tag, {
        through: { model: ItemTag, unique: false, scope: { taggable: 'post' } },
        foreignKey: 'taggable_id'
      });

      Comment.belongsToMany(Tag, {
        through: { model: ItemTag, unique: false, scope: { taggable: 'comment' } },
        foreignKey: 'taggable_id'
      });

      return self.sequelize.sync({ force: true }).then(() => {
        return Promise.all([
          Post.create({ name: 'post1' }),
          Comment.create({ name: 'comment1' }),
          Tag.create({ name: 'tag1' })
        ]);
      }).bind({}).spread( (post, comment, tag) => {
        self.post = post;
        self.comment = comment;
        self.tag = tag;
        return self.post.setTags([self.tag]);
      }).then( () => {
        return self.comment.setTags([self.tag]);
      }).then( () => {
        return Promise.all([
          self.post.getTags(),
          self.comment.getTags()
        ]);
      }).spread( (postTags, commentTags) => {
        expect(postTags).to.have.length(1);
        expect(commentTags).to.have.length(1);
      });
    });

    it('updating association via set associations with scope', function() {
      const self = this;
      const ItemTag = this.sequelize.define('ItemTag', {
          id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
          tag_id: { type: DataTypes.INTEGER, unique: false },
          taggable: { type: DataTypes.STRING },
          taggable_id: { type: DataTypes.INTEGER, unique: false }
        }),
        Tag = this.sequelize.define('Tag', {
          id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
          name: DataTypes.STRING
        }),
        Comment = this.sequelize.define('Comment', {
          id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
          name: DataTypes.STRING
        }),
        Post = this.sequelize.define('Post', {
          id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
          name: DataTypes.STRING
        });

      Post.belongsToMany(Tag, {
        through: { model: ItemTag, unique: false, scope: { taggable: 'post' } },
        foreignKey: 'taggable_id'
      });

      Comment.belongsToMany(Tag, {
        through: { model: ItemTag, unique: false, scope: { taggable: 'comment' } },
        foreignKey: 'taggable_id'
      });

      return this.sequelize.sync({ force: true }).then( () => {
        return Promise.all([
          Post.create({ name: 'post1' }),
          Comment.create({ name: 'comment1' }),
          Tag.create({ name: 'tag1' }),
          Tag.create({ name: 'tag2' })
        ]);
      }).bind({}).spread( (post, comment, tag, secondTag) => {
        self.post = post;
        self.comment = comment;
        self.tag = tag;
        self.secondTag = secondTag;
        return self.post.setTags([self.tag, self.secondTag]);
      }).then( () => {
        return self.comment.setTags([self.tag, self.secondTag]);
      }).then( () => {
        return self.post.setTags([self.tag]);
      }).then( () => {
        return Promise.all([
          self.post.getTags(),
          self.comment.getTags()
        ]);
      }).spread( (postTags, commentTags) => {
        expect(postTags).to.have.length(1);
        expect(commentTags).to.have.length(2);
      });
    });
  });

  describe('createAssociations', () => {
    it('creates a new associated object', function() {
      const User = this.sequelize.define('User', { username: DataTypes.STRING }),
        Task = this.sequelize.define('Task', { title: DataTypes.STRING });

      User.belongsToMany(Task, { through: 'UserTasks' });
      Task.belongsToMany(User, { through: 'UserTasks' });

      return this.sequelize.sync({ force: true }).then(() => {
        return Task.create({ title: 'task' });
      }).bind({}).then(function(task) {
        this.task = task;
        return task.createUser({ username: 'foo' });
      }).then(function(createdUser) {
        expect(createdUser).to.be.instanceof(User);
        expect(createdUser.username).to.equal('foo');
        return this.task.getUsers();
      }).then(_users => {
        expect(_users).to.have.length(1);
      });
    });

    if (current.dialect.supports.transactions) {
      it('supports transactions', function() {
        return Support.prepareTransactionTest(this.sequelize).bind({}).then(function(sequelize) {
          this.User = sequelize.define('User', { username: DataTypes.STRING });
          this.Task = sequelize.define('Task', { title: DataTypes.STRING });

          this.User.belongsToMany(this.Task, { through: 'UserTasks' });
          this.Task.belongsToMany(this.User, { through: 'UserTasks' });

          this.sequelize = sequelize;
          return sequelize.sync({ force: true });
        }).then(function() {
          return Promise.all([
            this.Task.create({ title: 'task' }),
            this.sequelize.transaction()
          ]);
        }).spread(function(task, t) {
          this.task = task;
          this.t = t;
          return task.createUser({ username: 'foo' }, { transaction: t });
        }).then(function() {
          return this.task.getUsers();
        }).then(function(users) {
          expect(users).to.have.length(0);

          return this.task.getUsers({ transaction: this.t });
        }).then(function(users) {
          expect(users).to.have.length(1);
          return this.t.rollback();
        });
      });
    }

    it('supports setting through table attributes', function() {
      const User = this.sequelize.define('user', {}),
        Group = this.sequelize.define('group', {}),
        UserGroups = this.sequelize.define('user_groups', {
          isAdmin: Sequelize.BOOLEAN
        });

      User.belongsToMany(Group, { through: UserGroups });
      Group.belongsToMany(User, { through: UserGroups });

      return this.sequelize.sync({ force: true }).then(() => {
        return Group.create({});
      }).then(group => {
        return Promise.join(
          group.createUser({ id: 1 }, { through: {isAdmin: true }}),
          group.createUser({ id: 2 }, { through: {isAdmin: false }}),
          () => {
            return UserGroups.findAll();
          }
        );
      }).then(userGroups => {
        userGroups.sort((a, b) => {
          return a.userId < b.userId ? - 1 : 1;
        });
        expect(userGroups[0].userId).to.equal(1);
        expect(userGroups[0].isAdmin).to.be.ok;
        expect(userGroups[1].userId).to.equal(2);
        expect(userGroups[1].isAdmin).not.to.be.ok;
      });
    });

    it('supports using the field parameter', function() {
      const User = this.sequelize.define('User', { username: DataTypes.STRING }),
        Task = this.sequelize.define('Task', { title: DataTypes.STRING });

      User.belongsToMany(Task, { through: 'UserTasks' });
      Task.belongsToMany(User, { through: 'UserTasks' });

      return this.sequelize.sync({ force: true }).then(() => {
        return Task.create({ title: 'task' });
      }).bind({}).then(function(task) {
        this.task = task;
        return task.createUser({ username: 'foo' }, {fields: ['username']});
      }).then(function(createdUser) {
        expect(createdUser).to.be.instanceof(User);
        expect(createdUser.username).to.equal('foo');
        return this.task.getUsers();
      }).then(_users => {
        expect(_users).to.have.length(1);
      });
    });
  });

  describe('addAssociations', () => {
    it('supports both single instance and array', function() {
      const User = this.sequelize.define('User', { username: DataTypes.STRING }),
        Task = this.sequelize.define('Task', { title: DataTypes.STRING });

      User.belongsToMany(Task, { through: 'UserTasks' });
      Task.belongsToMany(User, { through: 'UserTasks' });

      return this.sequelize.sync({ force: true }).then(() => {
        return Promise.all([
          User.create({ id: 12 }),
          Task.create({ id: 50, title: 'get started' }),
          Task.create({ id: 52, title: 'get done' })
        ]);
      }).spread((user, task1, task2) => {
        return Promise.all([
          user.addTask(task1),
          user.addTask([task2])
        ]).return (user);
      }).then(user => {
        return user.getTasks();
      }).then(tasks => {
        expect(tasks).to.have.length(2);
        expect(_.find(tasks, item => { return item.title === 'get started'; })).to.be.ok;
        expect(_.find(tasks, item => { return item.title === 'get done'; })).to.be.ok;
      });
    });

    if (current.dialect.supports.transactions) {
      it('supports transactions', function() {
        return Support.prepareTransactionTest(this.sequelize).bind({}).then(function(sequelize) {
          this.User = sequelize.define('User', { username: DataTypes.STRING });
          this.Task = sequelize.define('Task', { title: DataTypes.STRING });

          this.User.belongsToMany(this.Task, { through: 'UserTasks' });
          this.Task.belongsToMany(this.User, { through: 'UserTasks' });

          this.sequelize = sequelize;
          return sequelize.sync({ force: true });
        }).then(function() {
          return Promise.all([
            this.User.create({ username: 'foo' }),
            this.Task.create({ title: 'task' }),
            this.sequelize.transaction()
          ]);
        }).spread(function(user, task, t) {
          this.task = task;
          this.user = user;
          this.t = t;
          return task.addUser(user, { transaction: t });
        }).then(function() {
          return this.task.hasUser(this.user);
        }).then(function(hasUser) {
          expect(hasUser).to.be.false;
          return this.task.hasUser(this.user, { transaction: this.t });
        }).then(function(hasUser) {
          expect(hasUser).to.be.true;
          return this.t.rollback();
        });
      });

      it('supports transactions when updating a through model', function() {
        return Support.prepareTransactionTest(this.sequelize).bind({}).then(function(sequelize) {
          this.User = sequelize.define('User', { username: DataTypes.STRING });
          this.Task = sequelize.define('Task', { title: DataTypes.STRING });

          this.UserTask = sequelize.define('UserTask', {
            status: Sequelize.STRING
          });

          this.User.belongsToMany(this.Task, { through: this.UserTask });
          this.Task.belongsToMany(this.User, { through: this.UserTask });
          this.sequelize = sequelize;
          return sequelize.sync({ force: true });
        }).then(function() {
          return Promise.all([
            this.User.create({ username: 'foo' }),
            this.Task.create({ title: 'task' }),
            this.sequelize.transaction({ isolationLevel: Sequelize.Transaction.ISOLATION_LEVELS.READ_COMMITTED })
          ]);
        }).spread(function(user, task, t) {
          this.task = task;
          this.user = user;
          this.t = t;
          return task.addUser(user, { through: {status: 'pending'} }); // Create without transaction, so the old value is accesible from outside the transaction
        }).then(function() {
          return this.task.addUser(this.user, { transaction: this.t, through: {status: 'completed'}}); // Add an already exisiting user in a transaction, updating a value in the join table
        }).then(function() {
          return Promise.all([
            this.user.getTasks(),
            this.user.getTasks({ transaction: this.t })
          ]);
        }).spread(function(tasks, transactionTasks) {
          expect(tasks[0].UserTask.status).to.equal('pending');
          expect(transactionTasks[0].UserTask.status).to.equal('completed');

          return this.t.rollback();
        });
      });
    }

    it('supports passing the primary key instead of an object', function() {
      const User = this.sequelize.define('User', { username: DataTypes.STRING }),
        Task = this.sequelize.define('Task', { title: DataTypes.STRING });

      User.belongsToMany(Task, { through: 'UserTasks' });
      Task.belongsToMany(User, { through: 'UserTasks' });

      return this.sequelize.sync({ force: true }).then(() => {
        return Promise.all([
          User.create({ id: 12 }),
          Task.create({ id: 50, title: 'get started' })
        ]);
      }).spread((user, task) => {
        return user.addTask(task.id).return (user);
      }).then(user => {
        return user.getTasks();
      }).then(tasks => {
        expect(tasks[0].title).to.equal('get started');
      });
    });


    it('should not pass indexes to the join table', function() {
      const User = this.sequelize.define(
        'User',
        { username: DataTypes.STRING },
        {
          indexes: [
            {
              name: 'username_unique',
              unique: true,
              method: 'BTREE',
              fields: ['username']
            }
          ]
        });
      const Task = this.sequelize.define(
        'Task',
        { title: DataTypes.STRING },
        {
          indexes: [
            {
              name: 'title_index',
              method: 'BTREE',
              fields: ['title']
            }
          ]
        });
      //create associations
      User.belongsToMany(Task, { through: 'UserTasks' });
      Task.belongsToMany(User, { through: 'UserTasks' });
      return this.sequelize.sync({ force: true });
    });
  });

  describe('addMultipleAssociations', () => {
    it('supports both single instance and array', function() {
      const User = this.sequelize.define('User', { username: DataTypes.STRING }),
        Task = this.sequelize.define('Task', { title: DataTypes.STRING });

      User.belongsToMany(Task, { through: 'UserTasks' });
      Task.belongsToMany(User, { through: 'UserTasks' });

      return this.sequelize.sync({ force: true }).then(() => {
        return Promise.all([
          User.create({ id: 12 }),
          Task.create({ id: 50, title: 'get started' }),
          Task.create({ id: 52, title: 'get done' })
        ]);
      }).spread((user, task1, task2) => {
        return Promise.all([
          user.addTasks(task1),
          user.addTasks([task2])
        ]).return (user);
      }).then(user => {
        return user.getTasks();
      }).then(tasks => {
        expect(tasks).to.have.length(2);
        expect(_.find(tasks, item => { return item.title === 'get started'; })).to.be.ok;
        expect(_.find(tasks, item => { return item.title === 'get done'; })).to.be.ok;
      });
    });

    it('adds associations without removing the current ones', function() {
      const User = this.sequelize.define('User', { username: DataTypes.STRING }),
        Task = this.sequelize.define('Task', { title: DataTypes.STRING });

      User.belongsToMany(Task, { through: 'UserTasks' });
      Task.belongsToMany(User, { through: 'UserTasks' });

      return this.sequelize.sync({ force: true }).then(() => {
        return User.bulkCreate([
          { username: 'foo '},
          { username: 'bar '},
          { username: 'baz '}
        ]).bind({}).then(() => {
          return Promise.all([
            Task.create({ title: 'task' }),
            User.findAll()
          ]);
        }).spread(function(task, users) {
          this.task = task;
          this.users = users;
          return task.setUsers([users[0]]);
        }).then(function() {
          return this.task.addUsers([this.users[1], this.users[2]]);
        }).then(function() {
          return this.task.getUsers();
        }).then(function(users) {
          expect(users).to.have.length(3);

          // Re-add user 0's object, this should be harmless
          // Re-add user 0's id, this should be harmless
          return Promise.all([
            expect(this.task.addUsers([this.users[0]])).not.to.be.rejected,
            expect(this.task.addUsers([this.users[0].id])).not.to.be.rejected
          ]);
        }).then(function() {
          return this.task.getUsers();
        }).then(users => {
          expect(users).to.have.length(3);
        });
      });
    });
  });

  describe('through model validations', () => {
    beforeEach(function() {
      const Project = this.sequelize.define('Project', {
        name: Sequelize.STRING
      });

      const Employee = this.sequelize.define('Employee', {
        name: Sequelize.STRING
      });

      const Participation = this.sequelize.define('Participation', {
        role: {
          type: Sequelize.STRING,
          allowNull: false,
          validate: {
            len: {
              args: [2, 50],
              msg: 'too bad'
            }
          }
        }
      });

      Project.belongsToMany(Employee, { as: 'Participants', through: Participation });
      Employee.belongsToMany(Project, { as: 'Participations', through: Participation });

      return this.sequelize.sync({ force: true }).bind(this).then(function() {
        return Promise.all([
          Project.create({ name: 'project 1' }),
          Employee.create({ name: 'employee 1' })
        ]).bind(this).spread(function(project, employee) {
          this.project = project;
          this.employee = employee;
        });
      });
    });

    it('runs on add', function() {
      return expect(this.project.addParticipant(this.employee, { through: {role: ''}})).to.be.rejected;
    });

    it('runs on set', function() {
      return expect(this.project.setParticipants([this.employee], { through: {role: ''}})).to.be.rejected;
    });

    it('runs on create', function() {
      return expect(this.project.createParticipant({ name: 'employee 2'}, { through: {role: ''}})).to.be.rejected;
    });
  });

  describe('optimizations using bulk create, destroy and update', () => {
    beforeEach(function() {
      this.User = this.sequelize.define('User', { username: DataTypes.STRING }, {timestamps: false});
      this.Task = this.sequelize.define('Task', { title: DataTypes.STRING }, {timestamps: false});

      this.User.belongsToMany(this.Task, { through: 'UserTasks' });
      this.Task.belongsToMany(this.User, { through: 'UserTasks' });

      return this.sequelize.sync({force: true});
    });

    it('uses one insert into statement', function() {
      const spy = sinon.spy();

      return Promise.all([
        this.User.create({ username: 'foo' }),
        this.Task.create({ id: 12, title: 'task1' }),
        this.Task.create({ id: 15, title: 'task2' })
      ]).spread((user, task1, task2) => {
        return user.setTasks([task1, task2], {
          logging: spy
        });
      }).then(() => {
        expect(spy.calledTwice).to.be.ok;
      });
    });

    it('uses one delete from statement', function() {
      const spy = sinon.spy();

      return Promise.all([
        this.User.create({ username: 'foo' }),
        this.Task.create({ title: 'task1' }),
        this.Task.create({ title: 'task2' })
      ]).spread((user, task1, task2) => {
        return user.setTasks([task1, task2]).return (user);
      }).then(user => {
        return user.setTasks(null, {
          logging: spy
        });
      }).then(() => {
        expect(spy.calledTwice).to.be.ok;
      });
    });
  }); // end optimization using bulk create, destroy and update

  describe('join table creation', () => {
    beforeEach(function() {
      this.User = this.sequelize.define('User',
        { username: DataTypes.STRING },
        { tableName: 'users'}
      );
      this.Task = this.sequelize.define('Task',
        { title: DataTypes.STRING },
        { tableName: 'tasks' }
      );

      this.User.belongsToMany(this.Task, { through: 'user_has_tasks' });
      this.Task.belongsToMany(this.User, { through: 'user_has_tasks' });

      return this.sequelize.sync({ force: true });
    });

    it('should work with non integer primary keys', function() {
      const Beacons = this.sequelize.define('Beacon', {
        id: {
          primaryKey: true,
          type: DataTypes.UUID,
          defaultValue: DataTypes.UUIDV4
        },
        name: {
          type: DataTypes.STRING
        }
      });

      // Usar not to clash with the beforEach definition
      const Users = this.sequelize.define('Usar', {
        name: {
          type: DataTypes.STRING
        }
      });

      Beacons.belongsToMany(Users, { through: 'UserBeacons' });
      Users.belongsToMany(Beacons, { through: 'UserBeacons' });

      return this.sequelize.sync({force: true});
    });

    it('makes join table non-paranoid by default', () => {
      const paranoidSequelize = Support.createSequelizeInstance({
          define: {
            paranoid: true
          }
        }),
        ParanoidUser = paranoidSequelize.define('ParanoidUser', {}),
        ParanoidTask = paranoidSequelize.define('ParanoidTask', {});

      ParanoidUser.belongsToMany(ParanoidTask, { through: 'UserTasks' });
      ParanoidTask.belongsToMany(ParanoidUser, { through: 'UserTasks' });

      expect(ParanoidUser.options.paranoid).to.be.ok;
      expect(ParanoidTask.options.paranoid).to.be.ok;

      _.forEach(ParanoidUser.associations, association => {
        expect(association.through.model.options.paranoid).not.to.be.ok;
      });
    });
  });

  describe('foreign keys', () => {
    it('should correctly generate underscored keys', function() {
      const User = this.sequelize.define('User', {

      }, {
        tableName: 'users',
        underscored: true,
        timestamps: false
      });

      const Place = this.sequelize.define('Place', {
        //fields
      }, {
        tableName: 'places',
        underscored: true,
        timestamps: false
      });

      User.belongsToMany(Place, { through: 'user_places' });
      Place.belongsToMany(User, { through: 'user_places' });

      const attributes = this.sequelize.model('user_places').rawAttributes;

      expect(attributes.place_id).to.be.ok;
      expect(attributes.user_id).to.be.ok;
    });

    it('should infer otherKey from paired BTM relationship with a through string defined', function() {
      const User = this.sequelize.define('User', {});
      const Place = this.sequelize.define('Place', {});

      const Places = User.belongsToMany(Place, { through: 'user_places', foreignKey: 'user_id' });
      const Users = Place.belongsToMany(User, { through: 'user_places', foreignKey: 'place_id' });

      expect(Places.foreignKey).to.equal('user_id');
      expect(Users.foreignKey).to.equal('place_id');

      expect(Places.otherKey).to.equal('place_id');
      expect(Users.otherKey).to.equal('user_id');
    });

    it('should infer otherKey from paired BTM relationship with a through model defined', function() {
      const User = this.sequelize.define('User', {});
      const Place = this.sequelize.define('User', {});
      const UserPlace = this.sequelize.define('UserPlace', {id: {primaryKey: true, type: DataTypes.INTEGER, autoIncrement: true}}, {timestamps: false});

      const Places = User.belongsToMany(Place, { through: UserPlace, foreignKey: 'user_id' });
      const Users = Place.belongsToMany(User, { through: UserPlace, foreignKey: 'place_id' });

      expect(Places.foreignKey).to.equal('user_id');
      expect(Users.foreignKey).to.equal('place_id');

      expect(Places.otherKey).to.equal('place_id');
      expect(Users.otherKey).to.equal('user_id');

      expect(Object.keys(UserPlace.rawAttributes).length).to.equal(3); // Defined primary key and two foreign keys
    });
  });

  describe('foreign key with fields specified', () => {
    beforeEach(function() {
      this.User = this.sequelize.define('User', { name: DataTypes.STRING });
      this.Project = this.sequelize.define('Project', { name: DataTypes.STRING });
      this.Puppy = this.sequelize.define('Puppy', { breed: DataTypes.STRING });

      // doubly linked has many
      this.User.belongsToMany(this.Project, {
        through: 'user_projects',
        as: 'Projects',
        foreignKey: {
          field: 'user_id',
          name: 'userId'
        },
        otherKey: {
          field: 'project_id',
          name: 'projectId'
        }
      });
      this.Project.belongsToMany(this.User, {
        through: 'user_projects',
        as: 'Users',
        foreignKey: {
          field: 'project_id',
          name: 'projectId'
        },
        otherKey: {
          field: 'user_id',
          name: 'userId'
        }
      });
    });

    it('should correctly get associations even after a child instance is deleted', function() {
      const self = this;
      const spy = sinon.spy();

      return this.sequelize.sync({force: true}).then(() => {
        return Promise.join(
          self.User.create({name: 'Matt'}),
          self.Project.create({name: 'Good Will Hunting'}),
          self.Project.create({name: 'The Departed'})
        );
      }).spread((user, project1, project2) => {
        return user.addProjects([project1, project2], {
          logging: spy
        }).return (user);
      }).then(user => {
        expect(spy).to.have.been.calledTwice;
        spy.reset();
        return Promise.join(
          user,
          user.getProjects({
            logging: spy
          })
        );
      }).spread((user, projects) => {
        expect(spy.calledOnce).to.be.ok;
        const project = projects[0];
        expect(project).to.be.ok;
        return project.destroy().return (user);
      }).then(user => {
        return self.User.findOne({
          where: { id: user.id},
          include: [{model: self.Project, as: 'Projects'}]
        });
      }).then(user => {
        const projects = user.Projects,
          project = projects[0];

        expect(project).to.be.ok;
      });
    });

    it('should correctly get associations when doubly linked', function() {
      const self = this;
      const spy = sinon.spy();
      return this.sequelize.sync({force: true}).then(() => {
        return Promise.all([
          self.User.create({name: 'Matt'}),
          self.Project.create({name: 'Good Will Hunting'})
        ]);
      }).spread((user, project) => {
        self.user = user;
        self.project = project;
        return user.addProject(project, { logging: spy }).return (user);
      }).then(user => {
        expect(spy.calledTwice).to.be.ok; // Once for SELECT, once for INSERT
        spy.reset();
        return user.getProjects({
          logging: spy
        });
      }).then(projects => {
        const project = projects[0];
        expect(spy.calledOnce).to.be.ok;
        spy.reset();

        expect(project).to.be.ok;
        return self.user.removeProject(project, {
          logging: spy
        }).return (project);
      }).then(() => {
        expect(spy).to.have.been.calledOnce;
      });
    });

    it('should be able to handle nested includes properly', function() {
      const self = this;
      this.Group = this.sequelize.define('Group', { groupName: DataTypes.STRING});

      this.Group.belongsToMany(this.User, {
        through: 'group_users',
        as: 'Users',
        foreignKey: {
          field: 'group_id',
          name: 'groupId'
        },
        otherKey: {
          field: 'user_id',
          name: 'userId'
        }
      });
      this.User.belongsToMany(this.Group, {
        through: 'group_users',
        as: 'Groups',
        foreignKey: {
          field: 'user_id',
          name: 'userId'
        },
        otherKey: {
          field: 'group_id',
          name: 'groupId'
        }
      });

      return this.sequelize.sync({force: true}).then(() => {
        return Promise.join(
          self.Group.create({groupName: 'The Illuminati'}),
          self.User.create({name: 'Matt'}),
          self.Project.create({name: 'Good Will Hunting'})
        );
      }).spread((group, user, project) => {
        return user.addProject(project).then(() => {
          return group.addUser(user).return (group);
        });
      }).then(group => {
        // get the group and include both the users in the group and their project's
        return self.Group.findAll({
          where: {id: group.id},
          include: [
            {
              model: self.User,
              as: 'Users',
              include: [
                { model: self.Project, as: 'Projects' }
              ]
            }
          ]
        });
      }).then(groups => {
        const group = groups[0];
        expect(group).to.be.ok;

        const user = group.Users[0];
        expect(user).to.be.ok;

        const project = user.Projects[0];
        expect(project).to.be.ok;
        expect(project.name).to.equal('Good Will Hunting');
      });
    });
  });


  describe('primary key handling for join table', () => {
    beforeEach(function() {
      this.User = this.sequelize.define('User',
        { username: DataTypes.STRING },
        { tableName: 'users'}
      );
      this.Task = this.sequelize.define('Task',
        { title: DataTypes.STRING },
        { tableName: 'tasks' }
      );
    });

    it('removes the primary key if it was added by sequelize', function() {
      this.UserTasks = this.sequelize.define('usertasks', {});

      this.User.belongsToMany(this.Task, { through: this.UserTasks });
      this.Task.belongsToMany(this.User, { through: this.UserTasks });

      expect(Object.keys(this.UserTasks.primaryKeys).sort()).to.deep.equal(['TaskId', 'UserId']);
    });

    it('keeps the primary key if it was added by the user', function() {
      let fk;

      this.UserTasks = this.sequelize.define('usertasks', {
        id: {
          type: Sequelize.INTEGER,
          autoincrement: true,
          primaryKey: true
        }
      });
      this.UserTasks2 = this.sequelize.define('usertasks2', {
        userTasksId: {
          type: Sequelize.INTEGER,
          autoincrement: true,
          primaryKey: true
        }
      });

      this.User.belongsToMany(this.Task, { through: this.UserTasks });
      this.Task.belongsToMany(this.User, { through: this.UserTasks });

      this.User.belongsToMany(this.Task, { through: this.UserTasks2 });
      this.Task.belongsToMany(this.User, { through: this.UserTasks2 });

      expect(Object.keys(this.UserTasks.primaryKeys)).to.deep.equal(['id']);
      expect(Object.keys(this.UserTasks2.primaryKeys)).to.deep.equal(['userTasksId']);

      _.each([this.UserTasks, this.UserTasks2], model => {
        fk = Object.keys(model.options.uniqueKeys)[0];
        expect(model.options.uniqueKeys[fk].fields.sort()).to.deep.equal(['TaskId', 'UserId']);
      });
    });

    describe('without sync', () => {
      beforeEach(function() {
        const self = this;

        return self.sequelize.queryInterface.createTable('users', { id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true }, username: DataTypes.STRING, createdAt: DataTypes.DATE, updatedAt: DataTypes.DATE }).then(() => {
          return self.sequelize.queryInterface.createTable('tasks', { id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true }, title: DataTypes.STRING, createdAt: DataTypes.DATE, updatedAt: DataTypes.DATE });
        }).then(() => {
          return self.sequelize.queryInterface.createTable('users_tasks', { TaskId: DataTypes.INTEGER, UserId: DataTypes.INTEGER, createdAt: DataTypes.DATE, updatedAt: DataTypes.DATE });
        });
      });

      it('removes all associations', function() {
        this.UsersTasks = this.sequelize.define('UsersTasks', {}, { tableName: 'users_tasks' });

        this.User.belongsToMany(this.Task, { through: this.UsersTasks });
        this.Task.belongsToMany(this.User, { through: this.UsersTasks });

        expect(Object.keys(this.UsersTasks.primaryKeys).sort()).to.deep.equal(['TaskId', 'UserId']);

        return Promise.all([
          this.User.create({username: 'foo'}),
          this.Task.create({title: 'foo'})
        ]).spread((user, task) => {
          return user.addTask(task).return (user);
        }).then(user => {
          return user.setTasks(null);
        }).then(result => {
          expect(result).to.be.ok;
        });
      });
    });
  });

  describe('through', () => {
    beforeEach(function() {
      this.User = this.sequelize.define('User', {});
      this.Project = this.sequelize.define('Project', {});
      this.UserProjects = this.sequelize.define('UserProjects', {
        status: DataTypes.STRING,
        data: DataTypes.INTEGER
      });

      this.User.belongsToMany(this.Project, { through: this.UserProjects });
      this.Project.belongsToMany(this.User, { through: this.UserProjects });

      return this.sequelize.sync();
    });

    describe('fetching from join table', () => {
      it('should contain the data from the join table on .UserProjects a DAO', function() {
        return Promise.all([
          this.User.create(),
          this.Project.create()
        ]).spread((user, project) => {
          return user.addProject(project, { through: { status: 'active', data: 42 }}).return (user);
        }).then(user => {
          return user.getProjects();
        }).then(projects => {
          const project = projects[0];

          expect(project.UserProjects).to.be.ok;
          expect(project.status).not.to.exist;
          expect(project.UserProjects.status).to.equal('active');
          expect(project.UserProjects.data).to.equal(42);
        });
      });

      it('should be able to limit the join table attributes returned', function() {
        return Promise.all([
          this.User.create(),
          this.Project.create()
        ]).spread((user, project) => {
          return user.addProject(project, { through: { status: 'active', data: 42 }}).return (user);
        }).then(user => {
          return user.getProjects({ joinTableAttributes: ['status']});
        }).then(projects => {
          const project = projects[0];

          expect(project.UserProjects).to.be.ok;
          expect(project.status).not.to.exist;
          expect(project.UserProjects.status).to.equal('active');
          expect(project.UserProjects.data).not.to.exist;
        });
      });
    });

    describe('inserting in join table', () => {
      describe('add', () => {
        it('should insert data provided on the object into the join table', function() {
          return Promise.all([
            this.User.create(),
            this.Project.create()
          ]).bind({ UserProjects: this.UserProjects }).spread(function(u, p) {
            this.u = u;
            this.p = p;
            p.UserProjects = { status: 'active' };

            return u.addProject(p);
          }).then(function() {
            return this.UserProjects.find({ where: { UserId: this.u.id, ProjectId: this.p.id }});
          }).then(up => {
            expect(up.status).to.equal('active');
          });
        });

        it('should insert data provided as a second argument into the join table', function() {
          return Promise.all([
            this.User.create(),
            this.Project.create()
          ]).bind({ UserProjects: this.UserProjects }).spread(function(u, p) {
            this.u = u;
            this.p = p;

            return u.addProject(p, { through: { status: 'active' }});
          }).then(function() {
            return this.UserProjects.findOne({ where: { UserId: this.u.id, ProjectId: this.p.id }});
          }).then(up => {
            expect(up.status).to.equal('active');
          });
        });

        it('should be able to add twice (second call result in UPDATE call) without any attributes (and timestamps off) on the through model', function() {
          const Worker = this.sequelize.define('Worker', {}, {timestamps: false}),
            Task = this.sequelize.define('Task', {}, {timestamps: false}),
            WorkerTasks = this.sequelize.define('WorkerTasks', {}, {timestamps: false});

          Worker.belongsToMany(Task, { through: WorkerTasks });
          Task.belongsToMany(Worker, { through: WorkerTasks });

          return this.sequelize.sync({force: true}).bind({}).then(() => {
            return Worker.create({id: 1337});
          }).then(function(worker) {
            this.worker = worker;
            return Task.create({id: 7331});
          }).then(function() {
            return this.worker.addTask(this.task);
          }).then(function() {
            return this.worker.addTask(this.task);
          });
        });

        it('should be able to add twice (second call result in UPDATE call) with custom primary keys and without any attributes (and timestamps off) on the through model', function() {
          const Worker = this.sequelize.define('Worker', {
              id: {
                type: DataTypes.INTEGER,
                allowNull: false,
                primaryKey: true,
                autoIncrement: true
              }
            }, {timestamps: false}),
            Task = this.sequelize.define('Task', {
              id: {
                type: DataTypes.INTEGER,
                allowNull: false,
                primaryKey: true,
                autoIncrement: true
              }
            }, {timestamps: false}),
            WorkerTasks = this.sequelize.define('WorkerTasks', {
              id: {
                type: DataTypes.INTEGER,
                allowNull: false,
                primaryKey: true,
                autoIncrement: true
              }
            }, {timestamps: false});

          Worker.belongsToMany(Task, { through: WorkerTasks });
          Task.belongsToMany(Worker, { through: WorkerTasks });

          return this.sequelize.sync({force: true}).bind({}).then(() => {
            return Worker.create({id: 1337});
          }).then(function(worker) {
            this.worker = worker;
            return Task.create({id: 7331});
          }).then(function(task) {
            this.task = task;
            return this.worker.addTask(this.task);
          }).then(function() {
            return this.worker.addTask(this.task);
          });
        });
      });

      describe('set', () => {
        it('should be able to combine properties on the associated objects, and default values', function() {
          const self = this;

          return Promise.all([
            this.User.create(),
            this.Project.bulkCreate([{}, {}]).then(() => {
              return self.Project.findAll();
            })
          ]).bind({}).spread(function(user, projects) {
            this.user = user;
            this.p1 = projects[0];
            this.p2 = projects[1];

            this.p1.UserProjects = { status: 'inactive' };

            return user.setProjects([this.p1, this.p2], { through: { status: 'active' }});
          }).then(function() {
            return Promise.all([
              self.UserProjects.findOne({ where: { UserId: this.user.id, ProjectId: this.p1.id }}),
              self.UserProjects.findOne({ where: { UserId: this.user.id, ProjectId: this.p2.id }})
            ]);
          }).spread((up1, up2) => {
            expect(up1.status).to.equal('inactive');
            expect(up2.status).to.equal('active');
          });
        });

        it('should be able to set twice (second call result in UPDATE calls) without any attributes (and timestamps off) on the through model', function() {
          const Worker = this.sequelize.define('Worker', {}, {timestamps: false}),
            Task = this.sequelize.define('Task', {}, {timestamps: false}),
            WorkerTasks = this.sequelize.define('WorkerTasks', {}, {timestamps: false});

          Worker.belongsToMany(Task, { through: WorkerTasks });
          Task.belongsToMany(Worker, { through: WorkerTasks });

          return this.sequelize.sync({force: true}).then(() => {
            return Promise.all([
              Worker.create(),
              Task.bulkCreate([{}, {}]).then(() => {
                return Task.findAll();
              })
            ]);
          }).spread((worker, tasks) => {
            return worker.setTasks(tasks).return ([worker, tasks]);
          }).spread((worker, tasks) => {
            return worker.setTasks(tasks);
          });
        });
      });

      describe('query with through.where', () => {
        it('should support query the through model', function() {
          return this.User.create().then(user => {
            return Promise.all([
              user.createProject({}, { through: { status: 'active', data: 1 }}),
              user.createProject({}, { through: { status: 'inactive', data: 2 }}),
              user.createProject({}, { through: { status: 'inactive', data: 3 }})
            ]).then(() => {
              return Promise.all([
                user.getProjects({ through: { where: { status: 'active' } } }),
                user.countProjects({ through: { where: { status: 'inactive' } } })
              ]);
            });
          }).spread((activeProjects, inactiveProjectCount) => {
            expect(activeProjects).to.have.lengthOf(1);
            expect(inactiveProjectCount).to.eql(2);
          });
        });
      });
    });

    describe('removing from the join table', () => {
      it('should remove a single entry without any attributes (and timestamps off) on the through model', function() {
        const Worker = this.sequelize.define('Worker', {}, {timestamps: false}),
          Task = this.sequelize.define('Task', {}, {timestamps: false}),
          WorkerTasks = this.sequelize.define('WorkerTasks', {}, {timestamps: false});

        Worker.belongsToMany(Task, { through: WorkerTasks });
        Task.belongsToMany(Worker, { through: WorkerTasks });

        // Test setup
        return this.sequelize.sync({force: true}).then(() => {
          return Sequelize.Promise.all([
            Worker.create({}),
            Task.bulkCreate([{}, {}, {}]).then(() => {
              return Task.findAll();
            })
          ]);
        }).spread((worker, tasks) => {
          // Set all tasks, then remove one task by instance, then remove one task by id, then return all tasks
          return worker.setTasks(tasks).then(() => {
            return worker.removeTask(tasks[0]);
          }).then(() => {
            return worker.removeTask(tasks[1].id);
          }).then(() => {
            return worker.getTasks();
          });
        }).then(tasks => {
          expect(tasks.length).to.equal(1);
        });
      });

      it('should remove multiple entries without any attributes (and timestamps off) on the through model', function() {
        const Worker = this.sequelize.define('Worker', {}, {timestamps: false}),
          Task = this.sequelize.define('Task', {}, {timestamps: false}),
          WorkerTasks = this.sequelize.define('WorkerTasks', {}, {timestamps: false});

        Worker.belongsToMany(Task, { through: WorkerTasks });
        Task.belongsToMany(Worker, { through: WorkerTasks });

        // Test setup
        return this.sequelize.sync({force: true}).then(() => {
          return Sequelize.Promise.all([
            Worker.create({}),
            Task.bulkCreate([{}, {}, {}, {}, {}]).then(() => {
              return Task.findAll();
            })
          ]);
        }).spread((worker, tasks) => {
          // Set all tasks, then remove two tasks by instance, then remove two tasks by id, then return all tasks
          return worker.setTasks(tasks).then(() => {
            return worker.removeTasks([tasks[0], tasks[1]]);
          }).then(() => {
            return worker.removeTasks([tasks[2].id, tasks[3].id]);
          }).then(() => {
            return worker.getTasks();
          });
        }).then(tasks => {
          expect(tasks.length).to.equal(1);
        });
      });
    });
  });

  describe('belongsTo and hasMany at once', () => {
    beforeEach(function() {
      this.A = this.sequelize.define('a', { name: Sequelize.STRING });
      this.B = this.sequelize.define('b', { name: Sequelize.STRING });
    });

    describe('source belongs to target', () => {
      beforeEach(function() {
        this.A.belongsTo(this.B, { as: 'relation1' });
        this.A.belongsToMany(this.B, { as: 'relation2', through: 'AB' });
        this.B.belongsToMany(this.A, { as: 'relation2', through: 'AB' });

        return this.sequelize.sync({ force: true });
      });

      it('correctly uses bId in A', function() {
        const self = this;

        const a1 = this.A.build({ name: 'a1' }),
          b1 = this.B.build({ name: 'b1' });

        return a1
          .save()
          .then(() => { return b1.save(); })
          .then(() => { return a1.setRelation1(b1); })
          .then(() => { return self.A.findOne({ where: { name: 'a1' } }); })
          .then(a => {
            expect(a.relation1Id).to.be.eq(b1.id);
          });
      });
    });

    describe('target belongs to source', () => {
      beforeEach(function() {
        this.B.belongsTo(this.A, { as: 'relation1' });
        this.A.belongsToMany(this.B, { as: 'relation2', through: 'AB' });
        this.B.belongsToMany(this.A, { as: 'relation2', through: 'AB' });

        return this.sequelize.sync({ force: true });
      });

      it('correctly uses bId in A', function() {
        const self = this;

        const a1 = this.A.build({ name: 'a1' }),
          b1 = this.B.build({ name: 'b1' });

        return a1
          .save()
          .then(() => { return b1.save(); })
          .then(() => { return b1.setRelation1(a1); })
          .then(() => { return self.B.findOne({ where: { name: 'b1' } }); })
          .then(b => {
            expect(b.relation1Id).to.be.eq(a1.id);
          });
      });
    });
  });

  describe('alias', () => {
    it('creates the join table when through is a string', function() {
      const self = this,
        User = this.sequelize.define('User', {}),
        Group = this.sequelize.define('Group', {});

      User.belongsToMany(Group, { as: 'MyGroups', through: 'group_user'});
      Group.belongsToMany(User, { as: 'MyUsers', through: 'group_user'});

      return this.sequelize.sync({force: true}).then(() => {
        return self.sequelize.getQueryInterface().showAllTables();
      }).then(result => {
        if (dialect === 'mssql' /* current.dialect.supports.schemas */) {
          result = _.map(result, 'tableName');
        }

        expect(result.indexOf('group_user')).not.to.equal(-1);
      });
    });

    it('creates the join table when through is a model', function() {
      const self = this,
        User = this.sequelize.define('User', {}),
        Group = this.sequelize.define('Group', {}),
        UserGroup = this.sequelize.define('GroupUser', {}, {tableName: 'user_groups'});

      User.belongsToMany(Group, { as: 'MyGroups', through: UserGroup});
      Group.belongsToMany(User, { as: 'MyUsers', through: UserGroup});

      return this.sequelize.sync({force: true}).then(() => {
        return self.sequelize.getQueryInterface().showAllTables();
      }).then(result => {
        if (dialect === 'mssql' /* current.dialect.supports.schemas */) {
          result = _.map(result, 'tableName');
        }

        expect(result.indexOf('user_groups')).not.to.equal(-1);
      });
    });

    it('correctly identifies its counterpart when through is a string', function() {
      const User = this.sequelize.define('User', {}),
        Group = this.sequelize.define('Group', {});

      User.belongsToMany(Group, { as: 'MyGroups', through: 'group_user'});
      Group.belongsToMany(User, { as: 'MyUsers', through: 'group_user'});

      expect(Group.associations.MyUsers.through.model === User.associations.MyGroups.through.model);
      expect(Group.associations.MyUsers.through.model.rawAttributes.UserId).to.exist;
      expect(Group.associations.MyUsers.through.model.rawAttributes.GroupId).to.exist;
    });

    it('correctly identifies its counterpart when through is a model', function() {
      const User = this.sequelize.define('User', {}),
        Group = this.sequelize.define('Group', {}),
        UserGroup = this.sequelize.define('GroupUser', {}, {tableName: 'user_groups'});

      User.belongsToMany(Group, { as: 'MyGroups', through: UserGroup});
      Group.belongsToMany(User, { as: 'MyUsers', through: UserGroup});

      expect(Group.associations.MyUsers.through.model === User.associations.MyGroups.through.model);

      expect(Group.associations.MyUsers.through.model.rawAttributes.UserId).to.exist;
      expect(Group.associations.MyUsers.through.model.rawAttributes.GroupId).to.exist;
    });
  });

  describe('multiple hasMany', () => {
    beforeEach(function() {
      this.User = this.sequelize.define('user', { name: Sequelize.STRING });
      this.Project = this.sequelize.define('project', { projectName: Sequelize.STRING });
    });

    describe('project has owners and users and owners and users have projects', () => {
      beforeEach(function() {
        this.Project.belongsToMany(this.User, { as: 'owners', through: 'projectOwners'});
        this.Project.belongsToMany(this.User, { as: 'users', through: 'projectUsers'});

        this.User.belongsToMany(this.Project, { as: 'ownedProjects', through: 'projectOwners'});
        this.User.belongsToMany(this.Project, { as: 'memberProjects', through: 'projectUsers'});

        return this.sequelize.sync({ force: true });
      });

      it('correctly sets user and owner', function() {
        const p1 = this.Project.build({ projectName: 'p1' }),
          u1 = this.User.build({ name: 'u1' }),
          u2 = this.User.build({ name: 'u2' });

        return p1
          .save()
          .then(() => { return u1.save(); })
          .then(() => { return u2.save(); })
          .then(() => { return p1.setUsers([u1]); })
          .then(() => { return p1.setOwners([u2]); });
      });
    });
  });

  describe('Foreign key constraints', () => {
    beforeEach(function() {
      this.Task = this.sequelize.define('task', { title: DataTypes.STRING });
      this.User = this.sequelize.define('user', { username: DataTypes.STRING });
      this.UserTasks = this.sequelize.define('tasksusers', { userId: DataTypes.INTEGER, taskId: DataTypes.INTEGER });
    });

    it('can cascade deletes both ways by default', function() {
      const self = this;

      this.User.belongsToMany(this.Task, { through: 'tasksusers' });
      this.Task.belongsToMany(this.User, { through: 'tasksusers' });

      return this.sequelize.sync({ force: true }).bind({}).then(() => {
        return Promise.all([
          self.User.create({ id: 67, username: 'foo' }),
          self.Task.create({ id: 52, title: 'task' }),
          self.User.create({ id: 89, username: 'bar' }),
          self.Task.create({ id: 42, title: 'kast' })
        ]);
      }).spread(function(user1, task1, user2, task2) {
        this.user1 = user1;
        this.task1 = task1;
        this.user2 = user2;
        this.task2 = task2;
        return Promise.all([
          user1.setTasks([task1]),
          task2.setUsers([user2])
        ]);
      }).then(function() {
        return Promise.all([
          this.user1.destroy(),
          this.task2.destroy()
        ]);
      }).then(function() {
        return Promise.all([
          self.sequelize.model('tasksusers').findAll({ where: { userId: this.user1.id }}),
          self.sequelize.model('tasksusers').findAll({ where: { taskId: this.task2.id }}),
          self.User.findOne({
            where: self.sequelize.or({ username: 'Franz Joseph' }),
            include: [{
              model: self.Task,
              where: {
                title: {
                  $ne: 'task'
                }
              }
            }]
          })
        ]);
      }).spread((tu1, tu2) => {
        expect(tu1).to.have.length(0);
        expect(tu2).to.have.length(0);
      });
    });

    if (current.dialect.supports.constraints.restrict) {

      it('can restrict deletes both ways', function() {
        const self = this;

        this.User.belongsToMany(this.Task, { onDelete: 'RESTRICT', through: 'tasksusers' });
        this.Task.belongsToMany(this.User, { onDelete: 'RESTRICT', through: 'tasksusers' });

        return this.sequelize.sync({ force: true }).bind({}).then(() => {
          return Promise.all([
            self.User.create({ id: 67, username: 'foo' }),
            self.Task.create({ id: 52, title: 'task' }),
            self.User.create({ id: 89, username: 'bar' }),
            self.Task.create({ id: 42, title: 'kast' })
          ]);
        }).spread(function(user1, task1, user2, task2) {
          this.user1 = user1;
          this.task1 = task1;
          this.user2 = user2;
          this.task2 = task2;
          return Promise.all([
            user1.setTasks([task1]),
            task2.setUsers([user2])
          ]);
        }).then(function() {
          return Promise.all([
            expect(this.user1.destroy()).to.have.been.rejectedWith(self.sequelize.ForeignKeyConstraintError), // Fails because of RESTRICT constraint
            expect(this.task2.destroy()).to.have.been.rejectedWith(self.sequelize.ForeignKeyConstraintError)
          ]);
        });
      });

      it('can cascade and restrict deletes', function() {
        const self = this;

        self.User.belongsToMany(self.Task, { onDelete: 'RESTRICT', through: 'tasksusers' });
        self.Task.belongsToMany(self.User, { onDelete: 'CASCADE', through: 'tasksusers' });

        return this.sequelize.sync({ force: true }).bind({}).then(() => {
          return Sequelize.Promise.join(
            self.User.create({ id: 67, username: 'foo' }),
            self.Task.create({ id: 52, title: 'task' }),
            self.User.create({ id: 89, username: 'bar' }),
            self.Task.create({ id: 42, title: 'kast' })
          );
        }).spread(function(user1, task1, user2, task2) {
          this.user1 = user1;
          this.task1 = task1;
          this.user2 = user2;
          this.task2 = task2;
          return Sequelize.Promise.join(
            user1.setTasks([task1]),
            task2.setUsers([user2])
          );
        }).then(function() {
          return Sequelize.Promise.join(
            expect(this.user1.destroy()).to.have.been.rejectedWith(self.sequelize.ForeignKeyConstraintError), // Fails because of RESTRICT constraint
            this.task2.destroy()
          );
        }).then(function() {
          return self.sequelize.model('tasksusers').findAll({ where: { taskId: this.task2.id }});
        }).then(usertasks => {
          // This should not exist because deletes cascade
          expect(usertasks).to.have.length(0);
        });
      });

    }

    it('should be possible to remove all constraints', function() {
      const self = this;

      this.User.belongsToMany(this.Task, { constraints: false, through: 'tasksusers' });
      this.Task.belongsToMany(this.User, { constraints: false, through: 'tasksusers' });

      return this.sequelize.sync({ force: true }).bind({}).then(() => {
        return Promise.all([
          self.User.create({ id: 67, username: 'foo' }),
          self.Task.create({ id: 52, title: 'task' }),
          self.User.create({ id: 89, username: 'bar' }),
          self.Task.create({ id: 42, title: 'kast' })
        ]);
      }).spread(function(user1, task1, user2, task2) {
        this.user1 = user1;
        this.task1 = task1;
        this.user2 = user2;
        this.task2 = task2;
        return Promise.all([
          user1.setTasks([task1]),
          task2.setUsers([user2])
        ]);
      }).then(function() {
        return Promise.all([
          this.user1.destroy(),
          this.task2.destroy()
        ]);
      }).then(function() {
        return Promise.all([
          self.sequelize.model('tasksusers').findAll({ where: { userId: this.user1.id }}),
          self.sequelize.model('tasksusers').findAll({ where: { taskId: this.task2.id }})
        ]);
      }).spread((ut1, ut2) => {
        expect(ut1).to.have.length(1);
        expect(ut2).to.have.length(1);
      });
    });

    it('create custom unique identifier', function() {
      this.UserTasksLong = this.sequelize.define('table_user_task_with_very_long_name', {
        id_user_very_long_field: {
          type: DataTypes.INTEGER(1)
        },
        id_task_very_long_field: {
          type: DataTypes.INTEGER(1)
        }
      },
      { tableName: 'table_user_task_with_very_long_name' }
      );
      this.User.belongsToMany(this.Task, {
        as: 'MyTasks',
        through: this.UserTasksLong,
        foreignKey: 'id_user_very_long_field'
      });
      this.Task.belongsToMany(this.User, {
        as: 'MyUsers',
        through: this.UserTasksLong,
        foreignKey: 'id_task_very_long_field',
        uniqueKey: 'custom_user_group_unique'
      });

      return this.sequelize.sync({ force: true }).then(() => {
        expect(this.Task.associations.MyUsers.through.model.rawAttributes.id_user_very_long_field.unique).to.equal('custom_user_group_unique');
        expect(this.Task.associations.MyUsers.through.model.rawAttributes.id_task_very_long_field.unique).to.equal('custom_user_group_unique');
      });
    });
  });

  describe('Association options', () => {
    describe('allows the user to provide an attribute definition object as foreignKey', () => {
      it('works when taking a column directly from the object', function() {
        const Project = this.sequelize.define('project', {}),
          User = this.sequelize.define('user', {
            uid: {
              type: Sequelize.INTEGER,
              primaryKey: true
            }
          });

        const UserProjects = User.belongsToMany(Project, { foreignKey: { name: 'user_id', defaultValue: 42 }, through: 'UserProjects' });
        expect(UserProjects.through.model.rawAttributes.user_id).to.be.ok;
        expect(UserProjects.through.model.rawAttributes.user_id.references.model).to.equal(User.getTableName());
        expect(UserProjects.through.model.rawAttributes.user_id.references.key).to.equal('uid');
        expect(UserProjects.through.model.rawAttributes.user_id.defaultValue).to.equal(42);
      });
    });

    it('should throw an error if foreignKey and as result in a name clash', function() {
      const User = this.sequelize.define('user', {
        user: Sequelize.INTEGER
      });

      expect(User.belongsToMany.bind(User, User, { as: 'user', through: 'UserUser' })).to
        .throw ('Naming collision between attribute \'user\' and association \'user\' on model user. To remedy this, change either foreignKey or as in your association definition');
    });
  });

  describe('selfAssociations', () => {
    it('should work with self reference', function() {
      const User = this.sequelize.define('User', {
          name: Sequelize.STRING(100)
        }),
        Follow = this.sequelize.define('Follow'),
        self = this;

      User.belongsToMany(User, { through: Follow, as: 'User' });
      User.belongsToMany(User, { through: Follow, as: 'Fan' });

      return this.sequelize.sync({ force: true })
        .then(() => {
          return self.sequelize.Promise.all([
            User.create({ name: 'Khsama' }),
            User.create({ name: 'Vivek' }),
            User.create({ name: 'Satya' })
          ]);
        })
        .then(users => {
          return self.sequelize.Promise.all([
            users[0].addFan(users[1]),
            users[1].addUser(users[2]),
            users[2].addFan(users[0])
          ]);
        });
    });

    it('should work with custom self reference', function() {
      const User = this.sequelize.define('User', {
          name: Sequelize.STRING(100)
        }),
        UserFollowers = this.sequelize.define('UserFollower'),
        self = this;

      User.belongsToMany(User, {
        as: {
          singular: 'Follower',
          plural: 'Followers'
        },
        through: UserFollowers
      });

      User.belongsToMany(User, {
        as: {
          singular: 'Invitee',
          plural: 'Invitees'
        },
        foreignKey: 'InviteeId',
        through: 'Invites'
      });

      return this.sequelize.sync({ force: true })
        .then(() => {
          return self.sequelize.Promise.all([
            User.create({ name: 'Jalrangi' }),
            User.create({ name: 'Sargrahi' })
          ]);
        })
        .then(users => {
          return self.sequelize.Promise.all([
            users[0].addFollower(users[1]),
            users[1].addFollower(users[0]),
            users[0].addInvitee(users[1]),
            users[1].addInvitee(users[0])
          ]);
        });
    });

    it('should setup correct foreign keys', function() {
      /* camcelCase */
      let Person = this.sequelize.define('Person'),
        PersonChildren = this.sequelize.define('PersonChildren'),
        Children;

      Children = Person.belongsToMany(Person, { as: 'Children', through: PersonChildren});

      expect(Children.foreignKey).to.equal('PersonId');
      expect(Children.otherKey).to.equal('ChildId');
      expect(PersonChildren.rawAttributes[Children.foreignKey]).to.be.ok;
      expect(PersonChildren.rawAttributes[Children.otherKey]).to.be.ok;

      /* underscored */
      Person = this.sequelize.define('Person', {}, {underscored: true});
      PersonChildren = this.sequelize.define('PersonChildren', {}, {underscored: true});
      Children = Person.belongsToMany(Person, { as: 'Children', through: PersonChildren});

      expect(Children.foreignKey).to.equal('person_id');
      expect(Children.otherKey).to.equal('child_id');
      expect(PersonChildren.rawAttributes[Children.foreignKey]).to.be.ok;
      expect(PersonChildren.rawAttributes[Children.otherKey]).to.be.ok;
    });
  });
});
