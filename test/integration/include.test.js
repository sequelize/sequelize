'use strict';

var chai = require('chai')
  , Sequelize = require('../../index')
  , Promise = Sequelize.Promise
  , expect = chai.expect
  , Support = require(__dirname + '/support')
  , DataTypes = require(__dirname + '/../../lib/data-types')
  , datetime = require('chai-datetime')
  , async = require('async')
  , _ = require('lodash')
  , dialect = Support.getTestDialect();

chai.use(datetime);
chai.config.includeStack = true;

var sortById = function(a, b) {
  return a.id < b.id ? -1 : 1;
};

describe(Support.getTestDialectTeaser('Include'), function() {
  describe('find', function() {
    it('should support an empty belongsTo include', function() {
      var Company = this.sequelize.define('Company', {})
        , User = this.sequelize.define('User', {});

      User.belongsTo(Company, {as: 'Employer'});

      return this.sequelize.sync({force: true}).then(function() {
        return User.create();
      }).then(function() {
        return User.find({
          include: [{model: Company, as: 'Employer'}]
        }).then(function(user) {
          expect(user).to.be.ok;
        });
      });
    });

    it('should support a belongsTo association reference', function () {
      var Company = this.sequelize.define('Company', {})
        , User = this.sequelize.define('User', {})
        , Employer = User.belongsTo(Company, {as: 'Employer'});

      return this.sequelize.sync({force: true}).then(function() {
        return User.create();
      }).then(function () {
        return User.findOne({
          include: [Employer]
        }).then(function (user) {
          expect(user).to.be.ok;
        });
      });
    });

    it('should support a belongsTo association reference with a where', function () {
      var Company = this.sequelize.define('Company', {name: DataTypes.STRING})
        , User = this.sequelize.define('User', {})
        , Employer = User.belongsTo(Company, {as: 'Employer', foreignKey: 'employerId'});

      return this.sequelize.sync({force: true}).then(function() {
        return Company.create({
          name: 'CyberCorp'
        }).then(function (company) {
          return User.create({
            employerId: company.get('id')
          });
        });
      }).then(function () {
        return User.findOne({
          include: [
            {association: Employer, where: {name: 'CyberCorp'}}
          ]
        }).then(function (user) {
          expect(user).to.be.ok;
        });
      });
    });

    it('should support a empty hasOne include', function() {
      var Company = this.sequelize.define('Company', {})
        , Person = this.sequelize.define('Person', {});

      Company.hasOne(Person, {as: 'CEO'});

      return this.sequelize.sync({force: true}).then(function() {
        return Company.create().then(function() {
          return Company.find({
            include: [{model: Person, as: 'CEO'}]
          }).then(function(company) {
            expect(company).to.be.ok;
          });
        });
      });
    });

    it('should support a hasOne association reference', function () {
      var Company = this.sequelize.define('Company', {})
        , Person = this.sequelize.define('Person', {})
        , CEO = Company.hasOne(Person, {as: 'CEO'});

      return this.sequelize.sync({force: true}).then(function() {
        return Company.create();
      }).then(function () {
        return Company.find({
          include: [CEO]
        });
      }).then(function (user) {
        expect(user).to.be.ok;
      });
    });

    it('should support including a belongsTo association rather than a model/as pair', function() {
      var Company = this.sequelize.define('Company', {})
        , Person = this.sequelize.define('Person', {});

      Person.relation = {
        Employer: Person.belongsTo(Company, {as: 'employer'})
      };

      return this.sequelize.sync({force: true}).then(function() {
        return Promise.join(
          Person.create(),
          Company.create()
        ).spread(function(person, company) {
          return person.setEmployer(company);
        });
      }).then(function() {
        return Person.find({
          include: [Person.relation.Employer]
        }).then(function(person) {
          expect(person).to.be.ok;
          expect(person.employer).to.be.ok;
        });
      });
    });

    it('should support a hasMany association reference', function () {
      var User = this.sequelize.define('user', {})
        , Task = this.sequelize.define('task', {})
        , Tasks = User.hasMany(Task);

      Task.belongsTo(User);

      return this.sequelize.sync({force: true}).then(function () {
        return User.create().then(function (user) {
          return user.createTask();
        }).then(function () {
          return User.find({
            include: [Tasks]
          });
        }).then(function (user) {
          expect(user).to.be.ok;
          expect(user.tasks).to.be.ok;
        });
      });
    });

    it('should support a hasMany association reference with a where condition', function () {
      var User = this.sequelize.define('user', {})
        , Task = this.sequelize.define('task', {title: DataTypes.STRING})
        , Tasks = User.hasMany(Task);

      Task.belongsTo(User);

      return this.sequelize.sync({force: true}).then(function () {
        return User.create().then(function (user) {
          return Promise.join(
            user.createTask({
              title: 'trivial'
            }),
            user.createTask({
              title: 'pursuit'
            })
          );
        }).then(function () {
          return User.find({
            include: [
              {association: Tasks, where: {title: 'trivial'}}
            ]
          });
        }).then(function (user) {
          expect(user).to.be.ok;
          expect(user.tasks).to.be.ok;
          expect(user.tasks.length).to.equal(1);
        });
      });
    });

    it('should support a belongsToMany association reference', function () {
      var User = this.sequelize.define('user', {})
        , Group = this.sequelize.define('group', {})
        , Groups
        , Users;

      Groups = User.belongsToMany(Group);
      Users = Group.belongsToMany(User);

      return this.sequelize.sync({force: true}).then(function () {
        return User.create().then(function (user) {
          return user.createGroup();
        });
      }).then(function () {
        return User.find({
          include: [Groups]
        }).then(function (user) {
          expect(user).to.be.ok;
          expect(user.groups).to.be.ok;
        });
      });
    });

    it('should support a simple nested belongsTo -> belongsTo include', function() {
      var Task = this.sequelize.define('Task', {})
        , User = this.sequelize.define('User', {})
        , Group = this.sequelize.define('Group', {});

      Task.belongsTo(User);
      User.belongsTo(Group);

      return this.sequelize.sync({force: true}).then(function() {
        return Promise.props({
          task: Task.create(),
          user: User.create(),
          group: Group.create()
        }).then(function (props) {
          return Promise.join(
            props.task.setUser(props.user),
            props.user.setGroup(props.group)
          ).return(props);
        }).then(function (props) {
          return Task.findOne({
            where: {
              id: props.task.id
            },
            include: [
              {model: User, include: [
                {model: Group}
              ]}
            ]
          }).then(function(task) {
            expect(task.User).to.be.ok;
            expect(task.User.Group).to.be.ok;
          });
        });
      });
    });

    it('should support a simple sibling set of belongsTo include', function() {
      var Task = this.sequelize.define('Task', {})
        , User = this.sequelize.define('User', {})
        , Group = this.sequelize.define('Group', {});

      Task.belongsTo(User);
      Task.belongsTo(Group);

      return this.sequelize.sync({force: true}).then(function() {
        return Task.create({
          User: {},
          Group: {}
        }, {
          include: [User, Group]
        });
      }).then(function(task) {
        return Task.find({
          where: {
            id: task.id
          },
          include: [
            {model: User},
            {model: Group}
          ]
        });
      }).then(function(task) {
        expect(task.User).to.be.ok;
        expect(task.Group).to.be.ok;
      });
    });

    it('should support a simple nested hasOne -> hasOne include', function() {
      var Task = this.sequelize.define('Task', {})
        , User = this.sequelize.define('User', {})
        , Group = this.sequelize.define('Group', {});

      User.hasOne(Task);
      Group.hasOne(User);
      User.belongsTo(Group);

      return this.sequelize.sync({force: true}).then(function() {
        return User.create({
          Task: {},
          Group: {}
        }, {
          include: [Task, Group]
        });
      }).then(function(user) {
        return Group.find({
          where: {
            id: user.Group.id
          },
          include: [
            {model: User, include: [
              {model: Task}
            ]}
          ]
        });
      }).then(function(group) {
        expect(group.User).to.be.ok;
        expect(group.User.Task).to.be.ok;
      });
    });

    it('should support a simple nested hasMany -> belongsTo include', function() {
      var Task = this.sequelize.define('Task', {})
        , User = this.sequelize.define('User', {})
        , Project = this.sequelize.define('Project', {});

      User.hasMany(Task);
      Task.belongsTo(Project);

      return this.sequelize.sync({force: true}).then(function() {
        return Promise.all([
          Project.bulkCreate([{ id: 1 }, { id: 2 }]),
          User.create({
            Tasks: [
              {ProjectId: 1},
              {ProjectId: 2},
              {ProjectId: 1},
              {ProjectId: 2}
            ]
          }, {
            include: [Task]
          })
        ]);
      }).spread(function (projects, user) {
        return User.find({
          where: {
            id: user.id
          },
          include: [
            {model: Task, include: [
              {model: Project}
            ]}
          ]
        });
      }).then(function(user) {
        expect(user.Tasks).to.be.ok;
        expect(user.Tasks.length).to.equal(4);

        user.Tasks.forEach(function(task) {
          expect(task.Project).to.be.ok;
        });
      });
    });

    it('should support a simple nested belongsTo -> hasMany include', function() {
      var Task = this.sequelize.define('Task', {})
        , Worker = this.sequelize.define('Worker', {})
        , Project = this.sequelize.define('Project', {});

      Worker.belongsTo(Project);
      Project.hasMany(Worker);
      Project.hasMany(Task);

      return this.sequelize.sync({force: true}).then(function() {
        return Project.create({
          Workers: [{}],
          Tasks: [{}, {}, {}, {}]
        }, {
          include: [Worker, Task]
        });
      }).then(function (project) {
        return Worker.find({
          where: {
            id: project.Workers[0].id
          },
          include: [
            {model: Project, include: [
              {model: Task}
            ]}
          ]
        });
      }).then(function(worker) {
        expect(worker.Project).to.be.ok;
        expect(worker.Project.Tasks).to.be.ok;
        expect(worker.Project.Tasks.length).to.equal(4);
      });
    });

    it('should support a simple nested hasMany <-> hasMany include', function() {
      var User = this.sequelize.define('User', {})
        , Product = this.sequelize.define('Product', {
            title: DataTypes.STRING
          })
        , Tag = this.sequelize.define('Tag', {
            name: DataTypes.STRING
          });

      User.hasMany(Product);
      Product.hasMany(Tag);
      Tag.hasMany(Product);

      return this.sequelize.sync({force: true}).then(function() {
        return Promise.all([
          User.create({
            id: 1,
            Products: [
              {title: 'Chair'},
              {title: 'Desk'},
              {title: 'Dress'},
              {title: 'Bed'}
            ]
          }, {
            include: [Product]
          }).then(function() {
            return Product.findAll({order: [['id']]});
          }),
          Tag.bulkCreate([
            {name: 'A'},
            {name: 'B'},
            {name: 'C'}
          ]).then(function() {
            return Tag.findAll({order: [['id']]});
          })
        ]);
      }).spread(function (products, tags) {
        return Promise.all([
          products[0].setTags([tags[0], tags[2]]),
          products[1].setTags([tags[1]]),
          products[2].setTags([tags[0], tags[1], tags[2]])
        ]);
      }).then(function () {
        return User.find({
          where: {
            id: 1
          },
          include: [
            {model: Product, include: [
              {model: Tag}
            ]}
          ],
          order: [
            User.rawAttributes.id,
            [Product, 'id']
          ]
        });
      }).then(function(user) {
        expect(user.Products.length).to.equal(4);
        expect(user.Products[0].Tags.length).to.equal(2);
        expect(user.Products[1].Tags.length).to.equal(1);
        expect(user.Products[2].Tags.length).to.equal(3);
        expect(user.Products[3].Tags.length).to.equal(0);
      });
    });

    it('should support an include with multiple different association types', function() {
      var User = this.sequelize.define('User', {})
        , Product = this.sequelize.define('Product', {
            title: DataTypes.STRING
          })
        , Tag = this.sequelize.define('Tag', {
            name: DataTypes.STRING
          })
        , Price = this.sequelize.define('Price', {
            value: DataTypes.FLOAT
          })
        , Customer = this.sequelize.define('Customer', {
            name: DataTypes.STRING
        })
        , Group = this.sequelize.define('Group', {
            name: DataTypes.STRING
          })
        , GroupMember = this.sequelize.define('GroupMember', {

          })
        , Rank = this.sequelize.define('Rank', {
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

      Product.hasMany(Tag);
      Tag.hasMany(Product);
      Product.belongsTo(Tag, {as: 'Category'});

      Product.hasMany(Price);
      Price.belongsTo(Product);

      User.hasMany(GroupMember, {as: 'Memberships'});
      GroupMember.belongsTo(User);
      GroupMember.belongsTo(Rank);
      GroupMember.belongsTo(Group);
      Group.hasMany(GroupMember, {as: 'Memberships'});

      return this.sequelize.sync({force: true}).then(function() {
        return Promise.all([
          Product.create({
            id: 1,
            title: 'Chair',
            Prices: [{ value: 5 }, { value: 10 }  ]
          }, { include: [Price]}),
          Product.create({
            id: 2,
            title: 'Desk',
            Prices: [{ value: 5 }, { value: 10 }, { value: 15 }, { value: 20 }]
          }, { include: [Price]}),
          User.create({
            id: 1,
            Memberships: [
              { id: 1, Group: {name: 'Developers'}, Rank: {name: 'Admin', canInvite: 1, canRemove: 1}},
              { id: 2, Group: {name: 'Designers'}, Rank: {name: 'Member', canInvite: 1, canRemove: 0}}
            ]
          }, {
            include: { model: GroupMember, as: 'Memberships', include: [Group, Rank]}
          }),
          Tag.bulkCreate([
            {name: 'A'},
            {name: 'B'},
            {name: 'C'}
          ]).then(function() {
            return Tag.findAll();
          })
        ]);
      }).spread(function (product1, product2, user, tags) {
        return Promise.all([
          user.setProducts([product1, product2]),
          product1.setTags([tags[0], tags[2]]),
          product2.setTags([tags[1]]),
          product1.setCategory(tags[1])
        ]);
      }).then(function () {
        return User.find({
          where: {id: 1},
          include: [
            {model: GroupMember, as: 'Memberships', include: [
              Group,
              Rank
            ]},
            {model: Product, include: [
              Tag,
              {model: Tag, as: 'Category'},
              Price
            ]}
          ]
        });
      }).then(function(user) {
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
    });

    it('should support specifying attributes', function() {
      var Project = this.sequelize.define('Project', {
        title: Sequelize.STRING
      });

      var Task = this.sequelize.define('Task', {
        title: Sequelize.STRING,
        description: Sequelize.TEXT
      });

      Project.hasMany(Task);
      Task.belongsTo(Project);

      return this.sequelize.sync({force: true}).then(function() {
        return Task.create({
          title: 'FooBar',
          Project: {title: 'BarFoo'}
        }, {
          include: [Project]
        });
      }).then(function() {
        return Task.findAll({
          attributes: ['title'],
          include: [
            {model: Project, attributes: ['title']}
          ]
        });
      }).then(function(tasks) {
        expect(tasks[0].title).to.equal('FooBar');
        expect(tasks[0].Project.title).to.equal('BarFoo');

        expect(_.omit(tasks[0].get(), 'Project')).to.deep.equal({ title: 'FooBar' });
        expect(tasks[0].Project.get()).to.deep.equal({ title: 'BarFoo'});
      });
    });

    it('should support Sequelize.literal and renaming of attributes in included model attributes', function() {
      var Post = this.sequelize.define('Post', {});
      var PostComment = this.sequelize.define('PostComment', {
        someProperty: Sequelize.VIRTUAL, // Since we specify the AS part as a part of the literal string, not with sequelize syntax, we have to tell sequelize about the field
        comment_title: Sequelize.STRING
      });

      Post.hasMany(PostComment);

      return this.sequelize.sync({ force: true }).then(function() {
        return Post.create({});
      }).then(function(post) {
        return post.createPostComment({
          comment_title: 'WAT'
        });
      }).then(function() {
        var findAttributes;
        if (dialect === 'mssql') {
          findAttributes = [
            Sequelize.literal('CAST(CASE WHEN EXISTS(SELECT 1) THEN 1 ELSE 0 END AS BIT) AS "PostComments.someProperty"'),
            [Sequelize.literal('CAST(CASE WHEN EXISTS(SELECT 1) THEN 1 ELSE 0 END AS BIT)'), 'someProperty2']
          ];
        } else {
          findAttributes = [
            Sequelize.literal('EXISTS(SELECT 1) AS "PostComments.someProperty"'),
            [Sequelize.literal('EXISTS(SELECT 1)'), 'someProperty2']
          ];
        }
        findAttributes.push(['comment_title', 'commentTitle']);

        return Post.findAll({
          include: [
            {
              model: PostComment,
              attributes: findAttributes
            }
          ]
        });
      }).then(function(posts) {
        expect(posts[0].PostComments[0].get('someProperty')).to.be.ok;
        expect(posts[0].PostComments[0].get('someProperty2')).to.be.ok;
        expect(posts[0].PostComments[0].get('commentTitle')).to.equal('WAT');
      });
    });

    it('should support self associated hasMany (with through) include', function() {
      var Group = this.sequelize.define('Group', {
        name: DataTypes.STRING
      });

      Group.hasMany(Group, { through: 'groups_outsourcing_companies', as: 'OutsourcingCompanies'});

      return this.sequelize.sync({force: true}).bind({}).then(function() {
        return Group.bulkCreate([
          {name: 'SoccerMoms'},
          {name: 'Coca Cola'},
          {name: 'Dell'},
          {name: 'Pepsi'}
        ]);
      }).then(function() {
        return Group.findAll();
      }).then(function(groups) {
        this.groups = groups;
        return groups[0].setOutsourcingCompanies(groups.slice(1));
      }).then(function() {
        return Group.find({
          where: {
            id: this.groups[0].id
          },
          include: [{model: Group, as: 'OutsourcingCompanies'}]
        });
      }).then(function(group) {
        expect(group.OutsourcingCompanies).to.have.length(3);
      });
    });

    it('should support including date fields, with the correct timeszone', function() {
      var User = this.sequelize.define('user', {
          dateField: Sequelize.DATE
        }, {timestamps: false})
        , Group = this.sequelize.define('group', {
          dateField: Sequelize.DATE
        }, {timestamps: false});

      User.hasMany(Group);
      Group.hasMany(User);

      return this.sequelize.sync({ force: true }).bind({}).then(function() {
        return Promise.all([
          User.create({ dateField: Date.UTC(2014, 1, 20) }),
          Group.create({ dateField: Date.UTC(2014, 1, 20) })
          ]);
      }).spread(function(user, group) {
        this.user = user;
        return user.addGroup(group);
      }).then(function() {
        return User.find({
          where: {
            id: this.user.id
          },
          include: [Group]
        });
      }).then(function(user) {
        expect(user.dateField.getTime()).to.equal(Date.UTC(2014, 1, 20));
        expect(user.groups[0].dateField.getTime()).to.equal(Date.UTC(2014, 1, 20));
      });
    });

    it('should support include when retrieving associated objects', function() {
      var User = this.sequelize.define('user', {
          name: DataTypes.STRING
        })
        , Group = this.sequelize.define('group', {
          name: DataTypes.STRING
        })
        , UserGroup = this.sequelize.define('user_group', {
          vip: DataTypes.INTEGER
        });

      User.hasMany(Group);
      Group.belongsTo(User);
      User.hasMany(Group, {
        through: UserGroup,
        as: 'Clubs'
      });
      Group.hasMany(User, {
        through: UserGroup,
        as: 'Members'
      });

      return this.sequelize.sync({ force: true }).bind({}).then(function() {
        return Promise.all([
          User.create({ name: 'Owner' }),
          User.create({ name: 'Member' }),
          Group.create({ name: 'Group' })
        ]);
      }).spread(function (owner, member, group) {
        this.owner = owner;
        this.member = member;
        this.group = group;
        return owner.addGroup(group);
      }).then(function() {
        return this.group.addMember(this.member);
      }).then(function() {
        return this.owner.getGroups({
          include: [{
            model: User,
            as: 'Members'
          }]
        });
      }).then(function(groups) {
        expect(groups.length).to.equal(1);
        expect(groups[0].Members[0].name).to.equal('Member');
      });
    });
  });

  var createUsersAndItems = function () {
   var User = this.sequelize.define('User', {})
    , Item = this.sequelize.define('Item', {'test': DataTypes.STRING});

    User.hasOne(Item);
    Item.belongsTo(User);

    this.User = User;
    this.Item = Item;

    return this.sequelize.sync({ force: true }).then(function() {
      return Promise.all([
        User.bulkCreate([{}, {}, {}]).then(function() {
          return User.findAll();
        }),
        Item.bulkCreate([
          {'test': 'abc'},
          {'test': 'def'},
          {'test': 'ghi'}
        ]).then(function() {
          return Item.findAll();
        })
      ]);
    }).spread(function (users, items) {
      return Promise.all([
        users[0].setItem(items[0]),
        users[1].setItem(items[1]),
        users[2].setItem(items[2])
      ]);
    });
  };

  describe('where', function() {
    beforeEach(function () {
      return createUsersAndItems.bind(this)();
    });

    it('should support Sequelize.and()', function() {
      return this.User.findAll({
        include: [
          {model: this.Item, where: Sequelize.and({ test: 'def' })}
        ]
      }).then(function(result) {
        expect(result.length).to.eql(1);
        expect(result[0].Item.test).to.eql('def');
      });
    });

    it('should support Sequelize.or()', function() {
      return expect(this.User.findAll({
        include: [
          {model: this.Item, where: Sequelize.or({
            test: 'def'
          }, {
            test: 'abc'
          })}
        ]
      })).to.eventually.have.length(2);
    });
  });

  describe('findAndCountAll', function() {
    it('should include associations to findAndCountAll', function() {
      return createUsersAndItems.bind(this)().bind(this).then(function () {
        return this.User.findAndCountAll({
          include: [
            {model: this.Item, where: {
              test: 'def'
            }}
          ]
        });
      }).then(function(result) {
        expect(result.count).to.eql(1);

        expect(result.rows.length).to.eql(1);
        expect(result.rows[0].Item.test).to.eql('def');
      });
    });
  });

  describe('association getter', function() {
    it('should support getting an include on a N:M association getter', function() {
      var Question = this.sequelize.define('Question', {})
        , Answer = this.sequelize.define('Answer', {})
        , Questionnaire = this.sequelize.define('Questionnaire', {});

      Question.hasMany(Answer);
      Answer.hasMany(Question);

      Questionnaire.hasMany(Question);
      Question.belongsTo(Questionnaire);

      return this.sequelize.sync({force: true}).then(function() {
        return Questionnaire.create();
      }).then(function(questionnaire) {
        return questionnaire.getQuestions({
          include: Answer
        });
      });
    });
  });
});
