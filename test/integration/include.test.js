'use strict';

const chai = require('chai'),
  Sequelize = require('sequelize'),
  expect = chai.expect,
  Support = require('./support'),
  DataTypes = require('sequelize/lib/data-types'),
  _ = require('lodash'),
  dialect = Support.getTestDialect(),
  current = Support.sequelize,
  promiseProps = require('p-props');

const sortById = function(a, b) {
  return a.id < b.id ? -1 : 1;
};

describe(Support.getTestDialectTeaser('Include'), () => {
  describe('find', () => {
    it('should support an empty belongsTo include', async function() {
      const Company = this.sequelize.define('Company', {}),
        User = this.sequelize.define('User', {});

      User.belongsTo(Company, { as: 'Employer' });

      await this.sequelize.sync({ force: true });
      await User.create();

      const user = await User.findOne({
        include: [{ model: Company, as: 'Employer' }]
      });

      expect(user).to.be.ok;
    });

    it('should support a belongsTo association reference', async function() {
      const Company = this.sequelize.define('Company', {}),
        User = this.sequelize.define('User', {}),
        Employer = User.belongsTo(Company, { as: 'Employer' });

      await this.sequelize.sync({ force: true });
      await User.create();

      const user = await User.findOne({
        include: [Employer]
      });

      expect(user).to.be.ok;
    });

    it('should support to use associations with Sequelize.col', async function() {
      const Table1 = this.sequelize.define('Table1');
      const Table2 = this.sequelize.define('Table2');
      const Table3 = this.sequelize.define('Table3', { value: DataTypes.INTEGER });
      Table1.hasOne(Table2, { foreignKey: 'Table1Id' });
      Table2.hasMany(Table3, { as: 'Tables3', foreignKey: 'Table2Id' });

      await this.sequelize.sync({ force: true });
      const table1 = await Table1.create();

      const table2 = await Table2.create({
        Table1Id: table1.get('id')
      });

      await Table3.bulkCreate([
        {
          Table2Id: table2.get('id'),
          value: 5
        },
        {
          Table2Id: table2.get('id'),
          value: 7
        }
      ], {
        validate: true
      });

      const result = await Table1.findAll({
        raw: true,
        attributes: [
          [Sequelize.fn('SUM', Sequelize.col('Table2.Tables3.value')), 'sum']
        ],
        include: [
          {
            model: Table2,
            attributes: [],
            include: [
              {
                model: Table3,
                as: 'Tables3',
                attributes: []
              }
            ]
          }
        ]
      });

      expect(result.length).to.equal(1);
      expect(parseInt(result[0].sum, 10)).to.eq(12);
    });

    it('should support a belongsTo association reference with a where', async function() {
      const Company = this.sequelize.define('Company', { name: DataTypes.STRING }),
        User = this.sequelize.define('User', {}),
        Employer = User.belongsTo(Company, { as: 'Employer', foreignKey: 'employerId' });

      await this.sequelize.sync({ force: true });

      const company = await Company.create({
        name: 'CyberCorp'
      });

      await User.create({
        employerId: company.get('id')
      });

      const user = await User.findOne({
        include: [
          { association: Employer, where: { name: 'CyberCorp' } }
        ]
      });

      expect(user).to.be.ok;
    });

    it('should support a empty hasOne include', async function() {
      const Company = this.sequelize.define('Company', {}),
        Person = this.sequelize.define('Person', {});

      Company.hasOne(Person, { as: 'CEO' });

      await this.sequelize.sync({ force: true });
      await Company.create();

      const company = await Company.findOne({
        include: [{ model: Person, as: 'CEO' }]
      });

      expect(company).to.be.ok;
    });

    it('should support a hasOne association reference', async function() {
      const Company = this.sequelize.define('Company', {}),
        Person = this.sequelize.define('Person', {}),
        CEO = Company.hasOne(Person, { as: 'CEO' });

      await this.sequelize.sync({ force: true });
      await Company.create();

      const user = await Company.findOne({
        include: [CEO]
      });

      expect(user).to.be.ok;
    });

    it('should support including a belongsTo association rather than a model/as pair', async function() {
      const Company = this.sequelize.define('Company', {}),
        Person = this.sequelize.define('Person', {});

      Person.relation = {
        Employer: Person.belongsTo(Company, { as: 'employer' })
      };

      await this.sequelize.sync({ force: true });
      const [person0, company] = await Promise.all([Person.create(), Company.create()]);
      await person0.setEmployer(company);

      const person = await Person.findOne({
        include: [Person.relation.Employer]
      });

      expect(person).to.be.ok;
      expect(person.employer).to.be.ok;
    });

    it('should support a hasMany association reference', async function() {
      const User = this.sequelize.define('user', {}),
        Task = this.sequelize.define('task', {}),
        Tasks = User.hasMany(Task);

      Task.belongsTo(User);

      await this.sequelize.sync({ force: true });
      const user0 = await User.create();
      await user0.createTask();

      const user = await User.findOne({
        include: [Tasks]
      });

      expect(user).to.be.ok;
      expect(user.tasks).to.be.ok;
    });

    it('should support a hasMany association reference with a where condition', async function() {
      const User = this.sequelize.define('user', {}),
        Task = this.sequelize.define('task', { title: DataTypes.STRING }),
        Tasks = User.hasMany(Task);

      Task.belongsTo(User);

      await this.sequelize.sync({ force: true });
      const user0 = await User.create();

      await Promise.all([user0.createTask({
        title: 'trivial'
      }), user0.createTask({
        title: 'pursuit'
      })]);

      const user = await User.findOne({
        include: [
          { association: Tasks, where: { title: 'trivial' } }
        ]
      });

      expect(user).to.be.ok;
      expect(user.tasks).to.be.ok;
      expect(user.tasks.length).to.equal(1);
    });

    it('should support a belongsToMany association reference', async function() {
      const User = this.sequelize.define('user', {}),
        Group = this.sequelize.define('group', {}),
        Groups = User.belongsToMany(Group, { through: 'UserGroup' });

      Group.belongsToMany(User, { through: 'UserGroup' });

      await this.sequelize.sync({ force: true });
      const user0 = await User.create();
      await user0.createGroup();

      const user = await User.findOne({
        include: [Groups]
      });

      expect(user).to.be.ok;
      expect(user.groups).to.be.ok;
    });

    it('should support a simple nested belongsTo -> belongsTo include', async function() {
      const Task = this.sequelize.define('Task', {}),
        User = this.sequelize.define('User', {}),
        Group = this.sequelize.define('Group', {});

      Task.belongsTo(User);
      User.belongsTo(Group);

      await this.sequelize.sync({ force: true });

      const props0 = await promiseProps({
        task: Task.create(),
        user: User.create(),
        group: Group.create()
      });

      await Promise.all([props0.task.setUser(props0.user), props0.user.setGroup(props0.group)]);
      const props = props0;

      const task = await Task.findOne({
        where: {
          id: props.task.id
        },
        include: [
          { model: User, include: [
            { model: Group }
          ] }
        ]
      });

      expect(task.User).to.be.ok;
      expect(task.User.Group).to.be.ok;
    });

    it('should support a simple sibling set of belongsTo include', async function() {
      const Task = this.sequelize.define('Task', {}),
        User = this.sequelize.define('User', {}),
        Group = this.sequelize.define('Group', {});

      Task.belongsTo(User);
      Task.belongsTo(Group);

      await this.sequelize.sync({ force: true });

      const task0 = await Task.create({
        User: {},
        Group: {}
      }, {
        include: [User, Group]
      });

      const task = await Task.findOne({
        where: {
          id: task0.id
        },
        include: [
          { model: User },
          { model: Group }
        ]
      });

      expect(task.User).to.be.ok;
      expect(task.Group).to.be.ok;
    });

    it('should support a simple nested hasOne -> hasOne include', async function() {
      const Task = this.sequelize.define('Task', {}),
        User = this.sequelize.define('User', {}),
        Group = this.sequelize.define('Group', {});

      User.hasOne(Task);
      Group.hasOne(User);
      User.belongsTo(Group);

      await this.sequelize.sync({ force: true });

      const user = await User.create({
        Task: {},
        Group: {}
      }, {
        include: [Task, Group]
      });

      const group = await Group.findOne({
        where: {
          id: user.Group.id
        },
        include: [
          { model: User, include: [
            { model: Task }
          ] }
        ]
      });

      expect(group.User).to.be.ok;
      expect(group.User.Task).to.be.ok;
    });

    it('should support a simple nested hasMany -> belongsTo include', async function() {
      const Task = this.sequelize.define('Task', {}),
        User = this.sequelize.define('User', {}),
        Project = this.sequelize.define('Project', {});

      User.hasMany(Task);
      Task.belongsTo(Project);

      await this.sequelize.sync({ force: true });
      await Project.bulkCreate([{ id: 1 }, { id: 2 }]);

      const user0 = await User.create({
        Tasks: [
          { ProjectId: 1 },
          { ProjectId: 2 },
          { ProjectId: 1 },
          { ProjectId: 2 }
        ]
      }, {
        include: [Task]
      });

      const user = await User.findOne({
        where: {
          id: user0.id
        },
        include: [
          { model: Task, include: [
            { model: Project }
          ] }
        ]
      });

      expect(user.Tasks).to.be.ok;
      expect(user.Tasks.length).to.equal(4);

      user.Tasks.forEach(task => {
        expect(task.Project).to.be.ok;
      });
    });

    it('should support a simple nested belongsTo -> hasMany include', async function() {
      const Task = this.sequelize.define('Task', {}),
        Worker = this.sequelize.define('Worker', {}),
        Project = this.sequelize.define('Project', {});

      Worker.belongsTo(Project);
      Project.hasMany(Worker);
      Project.hasMany(Task);

      await this.sequelize.sync({ force: true });

      const project = await Project.create({
        Workers: [{}],
        Tasks: [{}, {}, {}, {}]
      }, {
        include: [Worker, Task]
      });

      const worker = await Worker.findOne({
        where: {
          id: project.Workers[0].id
        },
        include: [
          { model: Project, include: [
            { model: Task }
          ] }
        ]
      });

      expect(worker.Project).to.be.ok;
      expect(worker.Project.Tasks).to.be.ok;
      expect(worker.Project.Tasks.length).to.equal(4);
    });

    it('should support a simple nested hasMany to hasMany include', async function() {
      const User = this.sequelize.define('User', {}),
        Product = this.sequelize.define('Product', {
          title: DataTypes.STRING
        }),
        Tag = this.sequelize.define('Tag', {
          name: DataTypes.STRING
        });

      User.hasMany(Product);
      Product.belongsToMany(Tag, { through: 'product_tag' });
      Tag.belongsToMany(Product, { through: 'product_tag' });

      await this.sequelize.sync({ force: true });

      const [products, tags] = await Promise.all([
        User.create({
          id: 1,
          Products: [
            { title: 'Chair' },
            { title: 'Desk' },
            { title: 'Dress' },
            { title: 'Bed' }
          ]
        }, {
          include: [Product]
        }).then(() => {
          return Product.findAll({ order: [['id']] });
        }),
        Tag.bulkCreate([
          { name: 'A' },
          { name: 'B' },
          { name: 'C' }
        ]).then(() => {
          return Tag.findAll({ order: [['id']] });
        })
      ]);

      await Promise.all([
        products[0].setTags([tags[0], tags[2]]),
        products[1].setTags([tags[1]]),
        products[2].setTags([tags[0], tags[1], tags[2]])
      ]);

      const user = await User.findOne({
        where: {
          id: 1
        },
        include: [
          { model: Product, include: [
            { model: Tag }
          ] }
        ],
        order: [
          User.rawAttributes.id,
          [Product, 'id']
        ]
      });

      expect(user.Products.length).to.equal(4);
      expect(user.Products[0].Tags.length).to.equal(2);
      expect(user.Products[1].Tags.length).to.equal(1);
      expect(user.Products[2].Tags.length).to.equal(3);
      expect(user.Products[3].Tags.length).to.equal(0);
    });

    it('should support an include with multiple different association types', async function() {
      const User = this.sequelize.define('User', {}),
        Product = this.sequelize.define('Product', {
          title: DataTypes.STRING
        }),
        Tag = this.sequelize.define('Tag', {
          name: DataTypes.STRING
        }),
        Price = this.sequelize.define('Price', {
          value: DataTypes.FLOAT
        }),
        Group = this.sequelize.define('Group', {
          name: DataTypes.STRING
        }),
        GroupMember = this.sequelize.define('GroupMember', {

        }),
        Rank = this.sequelize.define('Rank', {
          name: DataTypes.STRING,
          canInvite: {
            type: DataTypes.INTEGER,
            defaultValue: 0
          },
          canRemove: {
            type: DataTypes.INTEGER,
            defaultValue: 0
          }
        });

      User.hasMany(Product);
      Product.belongsTo(User);

      Product.belongsToMany(Tag, { through: 'product_tag' });
      Tag.belongsToMany(Product, { through: 'product_tag' });
      Product.belongsTo(Tag, { as: 'Category' });

      Product.hasMany(Price);
      Price.belongsTo(Product);

      User.hasMany(GroupMember, { as: 'Memberships' });
      GroupMember.belongsTo(User);
      GroupMember.belongsTo(Rank);
      GroupMember.belongsTo(Group);
      Group.hasMany(GroupMember, { as: 'Memberships' });

      await this.sequelize.sync({ force: true });

      const [product1, product2, user0, tags] = await Promise.all([
        Product.create({
          id: 1,
          title: 'Chair',
          Prices: [{ value: 5 }, { value: 10 }]
        }, { include: [Price] }),
        Product.create({
          id: 2,
          title: 'Desk',
          Prices: [{ value: 5 }, { value: 10 }, { value: 15 }, { value: 20 }]
        }, { include: [Price] }),
        User.create({
          id: 1,
          Memberships: [
            { id: 1, Group: { name: 'Developers' }, Rank: { name: 'Admin', canInvite: 1, canRemove: 1 } },
            { id: 2, Group: { name: 'Designers' }, Rank: { name: 'Member', canInvite: 1, canRemove: 0 } }
          ]
        }, {
          include: { model: GroupMember, as: 'Memberships', include: [Group, Rank] }
        }),
        Tag.bulkCreate([
          { name: 'A' },
          { name: 'B' },
          { name: 'C' }
        ]).then(() => {
          return Tag.findAll();
        })
      ]);

      await Promise.all([
        user0.setProducts([product1, product2]),
        product1.setTags([tags[0], tags[2]]),
        product2.setTags([tags[1]]),
        product1.setCategory(tags[1])
      ]);

      const user = await User.findOne({
        where: { id: 1 },
        include: [
          { model: GroupMember, as: 'Memberships', include: [
            Group,
            Rank
          ] },
          { model: Product, include: [
            Tag,
            { model: Tag, as: 'Category' },
            Price
          ] }
        ]
      });

      user.Memberships.sort(sortById);
      expect(user.Memberships.length).to.equal(2);
      expect(user.Memberships[0].Group.name).to.equal('Developers');
      expect(user.Memberships[0].Rank.canRemove).to.equal(1);
      expect(user.Memberships[1].Group.name).to.equal('Designers');
      expect(user.Memberships[1].Rank.canRemove).to.equal(0);

      user.Products.sort(sortById);
      expect(user.Products.length).to.equal(2);
      expect(user.Products[0].Tags.length).to.equal(2);
      expect(user.Products[1].Tags.length).to.equal(1);
      expect(user.Products[0].Category).to.be.ok;
      expect(user.Products[1].Category).not.to.be.ok;

      expect(user.Products[0].Prices.length).to.equal(2);
      expect(user.Products[1].Prices.length).to.equal(4);
    });

    it('should support specifying attributes', async function() {
      const Project = this.sequelize.define('Project', {
        title: Sequelize.STRING
      });

      const Task = this.sequelize.define('Task', {
        title: Sequelize.STRING,
        description: Sequelize.TEXT
      });

      Project.hasMany(Task);
      Task.belongsTo(Project);

      await this.sequelize.sync({ force: true });

      await Task.create({
        title: 'FooBar',
        Project: { title: 'BarFoo' }
      }, {
        include: [Project]
      });

      const tasks = await Task.findAll({
        attributes: ['title'],
        include: [
          { model: Project, attributes: ['title'] }
        ]
      });

      expect(tasks[0].title).to.equal('FooBar');
      expect(tasks[0].Project.title).to.equal('BarFoo');

      expect(_.omit(tasks[0].get(), 'Project')).to.deep.equal({ title: 'FooBar' });
      expect(tasks[0].Project.get()).to.deep.equal({ title: 'BarFoo' });
    });

    it('should support Sequelize.literal and renaming of attributes in included model attributes', async function() {
      const Post = this.sequelize.define('Post', {});
      const PostComment = this.sequelize.define('PostComment', {
        someProperty: Sequelize.VIRTUAL, // Since we specify the AS part as a part of the literal string, not with sequelize syntax, we have to tell sequelize about the field
        comment_title: Sequelize.STRING
      });

      Post.hasMany(PostComment);

      await this.sequelize.sync({ force: true });
      const post = await Post.create({});

      await post.createPostComment({
        comment_title: 'WAT'
      });

      let findAttributes;
      if (dialect === 'mssql') {
        findAttributes = [
          Sequelize.literal('CAST(CASE WHEN EXISTS(SELECT 1) THEN 1 ELSE 0 END AS BIT) AS "PostComments.someProperty"'),
          [Sequelize.literal('CAST(CASE WHEN EXISTS(SELECT 1) THEN 1 ELSE 0 END AS BIT)'), 'someProperty2']
        ];
      } else if (dialect === 'db2') {
        findAttributes = [
          Sequelize.literal('EXISTS(SELECT 1 FROM SYSIBM.SYSDUMMY1) AS "PostComments.someProperty"'),
          [Sequelize.literal('EXISTS(SELECT 1 FROM SYSIBM.SYSDUMMY1)'), 'someProperty2']
        ];
      } else if (dialect === 'oracle') {
        findAttributes = [
          Sequelize.literal('(CASE WHEN EXISTS(SELECT 1 FROM DUAL) THEN 1 ELSE 0 END) AS "PostComments.someProperty"'),
          [Sequelize.literal('(CASE WHEN EXISTS(SELECT 1 FROM DUAL) THEN 1 ELSE 0 END)'), 'someProperty2']
        ];
      } else {
        findAttributes = [
          Sequelize.literal('EXISTS(SELECT 1) AS "PostComments.someProperty"'),
          [Sequelize.literal('EXISTS(SELECT 1)'), 'someProperty2']
        ];
      }
      findAttributes.push(['comment_title', 'commentTitle']);

      const posts = await Post.findAll({
        include: [
          {
            model: PostComment,
            attributes: findAttributes
          }
        ]
      });

      expect(posts[0].PostComments[0].get('someProperty')).to.be.ok;
      expect(posts[0].PostComments[0].get('someProperty2')).to.be.ok;
      expect(posts[0].PostComments[0].get('commentTitle')).to.equal('WAT');
    });

    it('should support self associated hasMany (with through) include', async function() {
      const Group = this.sequelize.define('Group', {
        name: DataTypes.STRING
      });

      Group.belongsToMany(Group, { through: 'groups_outsourcing_companies', as: 'OutsourcingCompanies' });

      await this.sequelize.sync({ force: true });

      await Group.bulkCreate([
        { name: 'SoccerMoms' },
        { name: 'Coca Cola' },
        { name: 'Dell' },
        { name: 'Pepsi' }
      ]);

      const groups = await Group.findAll();
      await groups[0].setOutsourcingCompanies(groups.slice(1));

      const group = await Group.findOne({
        where: {
          id: groups[0].id
        },
        include: [{ model: Group, as: 'OutsourcingCompanies' }]
      });

      expect(group.OutsourcingCompanies).to.have.length(3);
    });

    it('should support including date fields, with the correct timeszone', async function() {
      const User = this.sequelize.define('user', {
          dateField: Sequelize.DATE
        }, { timestamps: false }),
        Group = this.sequelize.define('group', {
          dateField: Sequelize.DATE
        }, { timestamps: false });

      User.belongsToMany(Group, { through: 'group_user' });
      Group.belongsToMany(User, { through: 'group_user' });

      await this.sequelize.sync({ force: true });

      const [user0, group] = await Promise.all([
        User.create({ dateField: Date.UTC(2014, 1, 20) }),
        Group.create({ dateField: Date.UTC(2014, 1, 20) })
      ]);

      await user0.addGroup(group);

      const user = await User.findOne({
        where: {
          id: user0.id
        },
        include: [Group]
      });

      expect(user.dateField.getTime()).to.equal(Date.UTC(2014, 1, 20));
      expect(user.groups[0].dateField.getTime()).to.equal(Date.UTC(2014, 1, 20));
    });

    it('should support include when retrieving associated objects', async function() {
      const User = this.sequelize.define('user', {
          name: DataTypes.STRING
        }),
        Group = this.sequelize.define('group', {
          name: DataTypes.STRING
        }),
        UserGroup = this.sequelize.define('user_group', {
          vip: DataTypes.INTEGER
        });

      User.hasMany(Group);
      Group.belongsTo(User);
      User.belongsToMany(Group, {
        through: UserGroup,
        as: 'Clubs'
      });
      Group.belongsToMany(User, {
        through: UserGroup,
        as: 'Members'
      });

      await this.sequelize.sync({ force: true });

      const [owner, member, group] = await Promise.all([
        User.create({ name: 'Owner' }),
        User.create({ name: 'Member' }),
        Group.create({ name: 'Group' })
      ]);

      await owner.addGroup(group);
      await group.addMember(member);

      const groups = await owner.getGroups({
        include: [{
          model: User,
          as: 'Members'
        }]
      });

      expect(groups.length).to.equal(1);
      expect(groups[0].Members[0].name).to.equal('Member');
    });
  });

  const createUsersAndItems = async function() {
    const User = this.sequelize.define('User', {}),
      Item = this.sequelize.define('Item', { 'test': DataTypes.STRING });

    User.hasOne(Item);
    Item.belongsTo(User);

    this.User = User;
    this.Item = Item;

    await this.sequelize.sync({ force: true });

    const [users, items] = await Promise.all([
      User.bulkCreate([{}, {}, {}]).then(() => {
        return User.findAll();
      }),
      Item.bulkCreate([
        { 'test': 'abc' },
        { 'test': 'def' },
        { 'test': 'ghi' }
      ]).then(() => {
        return Item.findAll();
      })
    ]);

    return Promise.all([
      users[0].setItem(items[0]),
      users[1].setItem(items[1]),
      users[2].setItem(items[2])
    ]);
  };

  describe('where', () => {
    beforeEach(async function() {
      await createUsersAndItems.bind(this)();
    });

    it('should support Sequelize.and()', async function() {
      const result = await this.User.findAll({
        include: [
          { model: this.Item, where: Sequelize.and({ test: 'def' }) }
        ]
      });

      expect(result.length).to.eql(1);
      expect(result[0].Item.test).to.eql('def');
    });

    it('should support Sequelize.or()', async function() {
      await expect(this.User.findAll({
        include: [
          { model: this.Item, where: Sequelize.or({
            test: 'def'
          }, {
            test: 'abc'
          }) }
        ]
      })).to.eventually.have.length(2);
    });
  });

  describe('findAndCountAll', () => {
    it('should include associations to findAndCountAll', async function() {
      await createUsersAndItems.bind(this)();

      const result = await this.User.findAndCountAll({
        include: [
          { model: this.Item, where: {
            test: 'def'
          } }
        ]
      });

      expect(result.count).to.eql(1);

      expect(result.rows.length).to.eql(1);
      expect(result.rows[0].Item.test).to.eql('def');
    });
  });

  describe('association getter', () => {
    it('should support getting an include on a N:M association getter', async function() {
      const Question = this.sequelize.define('Question', {}),
        Answer = this.sequelize.define('Answer', {}),
        Questionnaire = this.sequelize.define('Questionnaire', {});

      Question.belongsToMany(Answer, { through: 'question_answer' });
      Answer.belongsToMany(Question, { through: 'question_answer' });

      Questionnaire.hasMany(Question);
      Question.belongsTo(Questionnaire);

      await this.sequelize.sync({ force: true });
      const questionnaire = await Questionnaire.create();

      await questionnaire.getQuestions({
        include: Answer
      });
    });
  });

  describe('right join', () => {
    it('should support getting an include with a right join', async function() {
      const User = this.sequelize.define('user', {
          name: DataTypes.STRING
        }),
        Group = this.sequelize.define('group', {
          name: DataTypes.STRING
        });

      User.hasMany(Group);
      Group.belongsTo(User);

      await this.sequelize.sync({ force: true });

      await Promise.all([
        User.create({ name: 'User 1' }),
        User.create({ name: 'User 2' }),
        User.create({ name: 'User 3' }),
        Group.create({ name: 'A Group' })
      ]);

      const groups = await Group.findAll({
        include: [{
          model: User,
          right: true
        }]
      });

      if (current.dialect.supports['RIGHT JOIN']) {
        expect(groups.length).to.equal(3);
      } else {
        expect(groups.length).to.equal(1);
      }
    });

    it('should support getting an include through with a right join', async function() {
      const User = this.sequelize.define('user', {
          name: DataTypes.STRING
        }),
        Group = this.sequelize.define('group', {
          name: DataTypes.STRING
        }),
        UserGroup = this.sequelize.define('user_group', {
          vip: DataTypes.INTEGER
        });

      User.hasMany(Group);
      Group.belongsTo(User);
      User.belongsToMany(Group, {
        through: UserGroup,
        as: 'Clubs',
        constraints: false
      });
      Group.belongsToMany(User, {
        through: UserGroup,
        as: 'Members',
        constraints: false
      });

      await this.sequelize.sync({ force: true });

      const [member1, member2, group1, group2] = await Promise.all([
        User.create({ name: 'Member 1' }),
        User.create({ name: 'Member 2' }),
        Group.create({ name: 'Group 1' }),
        Group.create({ name: 'Group 2' })
      ]);

      await Promise.all([
        group1.addMember(member1),
        group1.addMember(member2),
        group2.addMember(member1)
      ]);

      await group2.destroy();

      const groups = await Group.findAll({
        include: [{
          model: User,
          as: 'Members',
          right: true
        }]
      });

      if (current.dialect.supports['RIGHT JOIN']) {
        expect(groups.length).to.equal(2);
      } else {
        expect(groups.length).to.equal(1);
      }
    });
  });

  describe('nested includes', () => {
    beforeEach(async function() {
      const Employee = this.sequelize.define('Employee', { 'name': DataTypes.STRING });
      const Team = this.sequelize.define('Team', { 'name': DataTypes.STRING });
      const Clearence = this.sequelize.define('Clearence', { 'level': DataTypes.INTEGER });

      Team.Members = Team.hasMany(Employee, { as: 'members' });
      Employee.Clearence = Employee.hasOne(Clearence, { as: 'clearence' });
      Clearence.Employee = Clearence.belongsTo(Employee, { as: 'employee' });

      this.Employee = Employee;
      this.Team = Team;
      this.Clearence = Clearence;

      await this.sequelize.sync({ force: true });

      const instances = await Promise.all([
        Team.create({ name: 'TeamA' }),
        Team.create({ name: 'TeamB' }),
        Employee.create({ name: 'John' }),
        Employee.create({ name: 'Jane' }),
        Employee.create({ name: 'Josh' }),
        Employee.create({ name: 'Jill' }),
        Clearence.create({ level: 3 }),
        Clearence.create({ level: 5 })
      ]);

      await Promise.all([
        instances[0].addMembers([instances[2], instances[3]]),
        instances[1].addMembers([instances[4], instances[5]]),
        instances[2].setClearence(instances[6]),
        instances[3].setClearence(instances[7])
      ]);
    });

    it('should not ripple grandchild required to top level find when required of child is set to false', async function() {
      const teams = await this.Team.findAll({
        include: [
          {
            association: this.Team.Members,
            required: false,
            include: [
              {
                association: this.Employee.Clearence,
                required: true
              }
            ]
          }
        ]
      });

      expect(teams).to.have.length(2);
    });

    it('should support eager loading associations using the name of the relation (string)', async function() {
      const team = await this.Team.findOne({
        where: {
          name: 'TeamA'
        },
        include: [
          {
            association: 'members',
            required: true
          }
        ]
      });

      expect(team.members).to.have.length(2);
    });

    it('should not ripple grandchild required to top level find when required of child is not given (implicitly false)', async function() {
      const teams = await this.Team.findAll({
        include: [
          {
            association: this.Team.Members,
            include: [
              {
                association: this.Employee.Clearence,
                required: true
              }
            ]
          }
        ]
      });

      expect(teams).to.have.length(2);
    });

    it('should ripple grandchild required to top level find when required of child is set to true as well', async function() {
      const teams = await this.Team.findAll({
        include: [
          {
            association: this.Team.Members,
            required: true,
            include: [
              {
                association: this.Employee.Clearence,
                required: true
              }
            ]
          }
        ]
      });

      expect(teams).to.have.length(1);
    });

  });
});
