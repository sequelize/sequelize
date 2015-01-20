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
    it('should support an empty belongsTo include', function(done) {
      var Company = this.sequelize.define('Company', {})
        , User = this.sequelize.define('User', {});

      User.belongsTo(Company, {as: 'Employer'});
      this.sequelize.sync({force: true}).done(function() {
        User.create().then(function() {
          User.find({
            include: [{model: Company, as: 'Employer'}]
          }).done(function(err, user) {
            expect(err).not.to.be.ok;
            expect(user).to.be.ok;
            done();
          });
        }, done);
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

    it('should support a empty hasOne include', function(done) {
      var Company = this.sequelize.define('Company', {})
        , Person = this.sequelize.define('Person', {});

      Company.hasOne(Person, {as: 'CEO'});
      this.sequelize.sync({force: true}).done(function() {
        Company.create().then(function() {
          Company.find({
            include: [{model: Person, as: 'CEO'}]
          }).done(function(err, company) {
            expect(err).not.to.be.ok;
            expect(company).to.be.ok;
            done();
          });
        }, done);
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

    it('should support a simple nested belongsTo -> belongsTo include', function(done) {
      var Task = this.sequelize.define('Task', {})
        , User = this.sequelize.define('User', {})
        , Group = this.sequelize.define('Group', {});

      Task.belongsTo(User);
      User.belongsTo(Group);

      this.sequelize.sync({force: true}).done(function() {
        async.auto({
          task: function(callback) {
            Task.create().done(callback);
          },
          user: function(callback) {
            User.create().done(callback);
          },
          group: function(callback) {
            Group.create().done(callback);
          },
          taskUser: ['task', 'user', function(callback, results) {
            results.task.setUser(results.user).done(callback);
          }],
          userGroup: ['user', 'group', function(callback, results) {
            results.user.setGroup(results.group).done(callback);
          }]
        }, function(err, results) {
          expect(err).not.to.be.ok;

          Task.find({
            where: {
              id: results.task.id
            },
            include: [
              {model: User, include: [
                {model: Group}
              ]}
            ]
          }).done(function(err, task) {
            expect(err).not.to.be.ok;
            expect(task.User).to.be.ok;
            expect(task.User.Group).to.be.ok;
            done();
          });
        });
      });
    });

    it('should support a simple sibling set of  belongsTo include', function(done) {
      var Task = this.sequelize.define('Task', {})
        , User = this.sequelize.define('User', {})
        , Group = this.sequelize.define('Group', {});

      Task.belongsTo(User);
      Task.belongsTo(Group);

      this.sequelize.sync({force: true}).done(function() {
        async.auto({
          task: function(callback) {
            Task.create().done(callback);
          },
          user: function(callback) {
            User.create().done(callback);
          },
          group: function(callback) {
            Group.create().done(callback);
          },
          taskUser: ['task', 'user', function(callback, results) {
            results.task.setUser(results.user).done(callback);
          }],
          taskGroup: ['task', 'group', function(callback, results) {
            results.task.setGroup(results.group).done(callback);
          }]
        }, function(err, results) {
          expect(err).not.to.be.ok;

          Task.find({
            where: {
              id: results.task.id
            },
            include: [
              {model: User},
              {model: Group}
            ]
          }).done(function(err, task) {
            expect(err).not.to.be.ok;
            expect(task.User).to.be.ok;
            expect(task.Group).to.be.ok;
            done();
          });
        });
      });
    });

    it('should support a simple nested hasOne -> hasOne include', function(done) {
      var Task = this.sequelize.define('Task', {})
        , User = this.sequelize.define('User', {})
        , Group = this.sequelize.define('Group', {});

      User.hasOne(Task);
      Group.hasOne(User);

      this.sequelize.sync({force: true}).done(function() {
        async.auto({
          task: function(callback) {
            Task.create().done(callback);
          },
          user: function(callback) {
            User.create().done(callback);
          },
          group: function(callback) {
            Group.create().done(callback);
          },
          userTask: ['user', 'task', function(callback, results) {
            results.user.setTask(results.task).done(callback);
          }],
          groupUser: ['group', 'user', function(callback, results) {
            results.group.setUser(results.user).done(callback);
          }]
        }, function(err, results) {
          expect(err).not.to.be.ok;

          Group.find({
            where: {
              id: results.group.id
            },
            include: [
              {model: User, include: [
                {model: Task}
              ]}
            ]
          }).done(function(err, group) {
            expect(err).not.to.be.ok;
            expect(group.User).to.be.ok;
            expect(group.User.Task).to.be.ok;
            done();
          });
        });
      });
    });

    it('should support a simple nested hasMany -> belongsTo include', function(done) {
      var Task = this.sequelize.define('Task', {})
        , User = this.sequelize.define('User', {})
        , Project = this.sequelize.define('Project', {});

      User.hasMany(Task);
      Task.belongsTo(Project);

      this.sequelize.sync({force: true}).done(function() {
        async.auto({
          user: function(callback) {
            User.create().done(callback);
          },
          projects: function(callback) {
            Project.bulkCreate([{}, {}]).done(function() {
              Project.findAll().done(callback);
            });
          },
          tasks: ['projects', function(callback, results) {
            Task.bulkCreate([
              {ProjectId: results.projects[0].id},
              {ProjectId: results.projects[1].id},
              {ProjectId: results.projects[0].id},
              {ProjectId: results.projects[1].id}
            ]).done(function() {
              Task.findAll().done(callback);
            });
          }],
          userTasks: ['user', 'tasks', function(callback, results) {
            results.user.setTasks(results.tasks).done(callback);
          }]
        }, function(err, results) {
          User.find({
            where: {
              id: results.user.id
            },
            include: [
              {model: Task, include: [
                {model: Project}
              ]}
            ]
          }).done(function(err, user) {
            expect(err).not.to.be.ok;
            expect(user.Tasks).to.be.ok;
            expect(user.Tasks.length).to.equal(4);

            user.Tasks.forEach(function(task) {
              expect(task.Project).to.be.ok;
            });

            done();
          });
        });
      });
    });

    it('should support a simple nested belongsTo -> hasMany include', function(done) {
      var Task = this.sequelize.define('Task', {})
        , Worker = this.sequelize.define('Worker', {})
        , Project = this.sequelize.define('Project', {});

      Worker.belongsTo(Project);
      Project.hasMany(Task);

      this.sequelize.sync({force: true}).done(function() {
        async.auto({
          worker: function(callback) {
            Worker.create().done(callback);
          },
          project: function(callback) {
            Project.create().done(callback);
          },
          tasks: function(callback) {
            Task.bulkCreate([
              {},
              {},
              {},
              {}
            ]).done(function() {
              Task.findAll().done(callback);
            });
          },
          projectTasks: ['project', 'tasks', function(callback, results) {
            results.project.setTasks(results.tasks).done(callback);
          }],
          projectWorker: ['project', 'worker', function(callback, results) {
            results.worker.setProject(results.project).done(callback);
          }]
        }, function(err, results) {
          Worker.find({
            where: {
              id: results.worker.id
            },
            include: [
              {model: Project, include: [
                {model: Task}
              ]}
            ]
          }).done(function(err, worker) {
            expect(err).not.to.be.ok;
            expect(worker.Project).to.be.ok;
            expect(worker.Project.Tasks).to.be.ok;
            expect(worker.Project.Tasks.length).to.equal(4);

            done();
          });
        });
      });
    });

    it('should support a simple nested hasMany <-> hasMany include', function(done) {
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

      this.sequelize.sync({force: true}).done(function() {
        async.auto({
          user: function(callback) {
            User.create().done(callback);
          },
          products: function(callback) {
            Product.bulkCreate([
              {title: 'Chair'},
              {title: 'Desk'},
              {title: 'Dress'},
              {title: 'Bed'}
            ]).done(function() {
              Product.findAll({order: [['id']]}).done(callback);
            });
          },
          tags: function(callback) {
            Tag.bulkCreate([
              {name: 'A'},
              {name: 'B'},
              {name: 'C'}
            ]).done(function() {
              Tag.findAll({order: [['id']]}).done(callback);
            });
          },
          userProducts: ['user', 'products', function(callback, results) {
            results.user.setProducts(results.products).done(callback);
          }],
          productTags: ['products', 'tags', function(callback, results) {
            var chainer = new Sequelize.Utils.QueryChainer();

            chainer.add(results.products[0].setTags([results.tags[0], results.tags[2]]));
            chainer.add(results.products[1].setTags([results.tags[1]]));
            chainer.add(results.products[2].setTags([results.tags[0], results.tags[1], results.tags[2]]));

            chainer.run().done(callback);
          }]
        }, function(err, results) {
          expect(err).not.to.be.ok;

          User.find({
            where: {
              id: results.user.id
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
          }).done(function(err, user) {
            expect(err).not.to.be.ok;

            expect(user.Products.length).to.equal(4);
            expect(user.Products[0].Tags.length).to.equal(2);
            expect(user.Products[1].Tags.length).to.equal(1);
            expect(user.Products[2].Tags.length).to.equal(3);
            expect(user.Products[3].Tags.length).to.equal(0);
            done();
          });
        });
      });
    });

    it('should support an include with multiple different association types', function(done) {
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

      this.sequelize.sync({force: true}).done(function() {
        async.auto({
          user: function(callback) {
            User.create().done(callback);
          },
          groups: function(callback) {
            Group.bulkCreate([
              {name: 'Developers'},
              {name: 'Designers'}
            ]).done(function() {
              Group.findAll().done(callback);
            });
          },
          ranks: function(callback) {
            Rank.bulkCreate([
              {name: 'Admin', canInvite: 1, canRemove: 1},
              {name: 'Member', canInvite: 1, canRemove: 0}
            ]).done(function() {
              Rank.findAll().done(callback);
            });
          },
          memberships: ['user', 'groups', 'ranks', function(callback, results) {
            GroupMember.bulkCreate([
              {UserId: results.user.id, GroupId: results.groups[0].id, RankId: results.ranks[0].id},
              {UserId: results.user.id, GroupId: results.groups[1].id, RankId: results.ranks[1].id}
            ]).done(callback);
          }],
          products: function(callback) {
            Product.bulkCreate([
              {title: 'Chair'},
              {title: 'Desk'}
            ]).done(function() {
              Product.findAll().done(callback);
            });
          },
          tags: function(callback) {
            Tag.bulkCreate([
              {name: 'A'},
              {name: 'B'},
              {name: 'C'}
            ]).done(function() {
              Tag.findAll().done(callback);
            });
          },
          userProducts: ['user', 'products', function(callback, results) {
            results.user.setProducts(results.products).done(callback);
          }],
          productTags: ['products', 'tags', function(callback, results) {
            var chainer = new Sequelize.Utils.QueryChainer();

            chainer.add(results.products[0].setTags([results.tags[0], results.tags[2]]));
            chainer.add(results.products[1].setTags([results.tags[1]]));
            chainer.add(results.products[0].setCategory(results.tags[1]));

            chainer.run().done(callback);
          }],
          prices: ['products', function(callback, results) {
            Price.bulkCreate([
              {ProductId: results.products[0].id, value: 5},
              {ProductId: results.products[0].id, value: 10},
              {ProductId: results.products[1].id, value: 5},
              {ProductId: results.products[1].id, value: 10},
              {ProductId: results.products[1].id, value: 15},
              {ProductId: results.products[1].id, value: 20}
            ]).done(callback);
          }]
        }, function(err, results) {
          expect(err).not.to.be.ok;

          User.find({
            where: {id: results.user.id},
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
          }).done(function(err, user) {
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

            done();
          });
        });
      });
    });

    it('should support specifying attributes', function(done) {
      var Project = this.sequelize.define('Project', {
        title: Sequelize.STRING
      });

      var Task = this.sequelize.define('Task', {
        title: Sequelize.STRING,
        description: Sequelize.TEXT
      });

      Project.hasMany(Task);
      Task.belongsTo(Project);

      this.sequelize.sync({force: true}).done(function() {
        Project.create({
          title: 'BarFoo'
        }).done(function(err, project) {
          Task.create({title: 'FooBar'}).done(function(err, task) {
            task.setProject(project).done(function() {
              Task.findAll({
                attributes: ['title'],
                include: [
                  {model: Project, attributes: ['title']}
                ]
              }).done(function(err, tasks) {
                expect(err).not.to.be.ok;
                expect(tasks[0].title).to.equal('FooBar');
                expect(tasks[0].Project.title).to.equal('BarFoo');

                expect(_.omit(tasks[0].get(), 'Project')).to.deep.equal({ title: 'FooBar' });
                expect(tasks[0].Project.get()).to.deep.equal({ title: 'BarFoo'});

                done();
              });
            });
          });
        });
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

    it('should support self associated hasMany (with through) include', function(done) {
      var Group = this.sequelize.define('Group', {
        name: DataTypes.STRING
      });

      Group.hasMany(Group, { through: 'groups_outsourcing_companies', as: 'OutsourcingCompanies'});

      this.sequelize.sync({force: true}).done(function(err) {
        expect(err).not.to.be.ok;
        Group.bulkCreate([
          {name: 'SoccerMoms'},
          {name: 'Coca Cola'},
          {name: 'Dell'},
          {name: 'Pepsi'}
        ]).done(function() {
          Group.findAll().done(function(err, groups) {
            groups[0].setOutsourcingCompanies(groups.slice(1)).done(function(err) {
              expect(err).not.to.be.ok;

              Group.find({
                where: {
                  id: groups[0].id
                },
                include: [{model: Group, as: 'OutsourcingCompanies'}]
              }).done(function(err, group) {
                expect(err).not.to.be.ok;
                expect(group.OutsourcingCompanies.length).to.equal(3);
                done();
              });
            });
          });
        });
      });
    });

    it('should support including date fields, with the correct timeszone', function(done) {
      var User = this.sequelize.define('user', {
          dateField: Sequelize.DATE
        }, {timestamps: false})
        , Group = this.sequelize.define('group', {
          dateField: Sequelize.DATE
        }, {timestamps: false});

      User.hasMany(Group);
      Group.hasMany(User);

      this.sequelize.sync().success(function() {
        User.create({ dateField: Date.UTC(2014, 1, 20) }).success(function(user) {
          Group.create({ dateField: Date.UTC(2014, 1, 20) }).success(function(group) {
            user.addGroup(group).success(function() {
              User.find({
                where: {
                  id: user.id
                },
                include: [Group]
              }).success(function(user) {
                expect(user.dateField.getTime()).to.equal(Date.UTC(2014, 1, 20));
                expect(user.groups[0].dateField.getTime()).to.equal(Date.UTC(2014, 1, 20));

                done();
              });
            });
          });
        });
      });
    });

    it('should support include when retrieving associated objects', function(done) {
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

      this.sequelize.sync().success(function() {
        User.create({ name: 'Owner' }).success(function(owner) {
          User.create({ name: 'Member' }).success(function(member) {
            Group.create({ name: 'Group' }).success(function(group) {
              owner.addGroup(group).success(function() {
                group.addMember(member).success(function() {
                  owner.getGroups({
                    include: [{
                      model: User,
                      as: 'Members'
                    }]
                  }).success(function(groups) {
                    expect(groups.length).to.equal(1);
                    expect(groups[0].Members[0].name).to.equal('Member');

                    done();
                  });
                });
              });
            });
          });
        });
      });
    });
  });

  describe('where', function() {
    it('should support Sequelize.and()', function(done) {
      var User = this.sequelize.define('User', {})
        , Item = this.sequelize.define('Item', {'test': DataTypes.STRING});

      User.hasOne(Item);
      Item.belongsTo(User);

      this.sequelize.sync().done(function() {
        async.auto({
          users: function(callback) {
            User.bulkCreate([{}, {}, {}]).done(function() {
              User.findAll().done(callback);
            });
          },
          items: function(callback) {
            Item.bulkCreate([
              {'test': 'abc'},
              {'test': 'def'},
              {'test': 'ghi'}
            ]).done(function() {
              Item.findAll().done(callback);
            });
          },
          associate: ['users', 'items', function(callback, results) {
            var chainer = new Sequelize.Utils.QueryChainer();

            var users = results.users;
            var items = results.items;

            chainer.add(users[0].setItem(items[0]));
            chainer.add(users[1].setItem(items[1]));
            chainer.add(users[2].setItem(items[2]));

            chainer.run().done(callback);
          }]
        }, function() {
          User.findAll({include: [
            {model: Item, where: Sequelize.and({
              test: 'def'
            })}
          ]}).done(function(err, result) {
            expect(err).not.to.be.ok;

            expect(result.length).to.eql(1);
            expect(result[0].Item.test).to.eql('def');
            done();
          });
        });
      });
    });

    it('should support Sequelize.or()', function(done) {
      var User = this.sequelize.define('User', {})
        , Item = this.sequelize.define('Item', {'test': DataTypes.STRING});

      User.hasOne(Item);
      Item.belongsTo(User);

      this.sequelize.sync().done(function() {
        async.auto({
          users: function(callback) {
            User.bulkCreate([{}, {}, {}]).done(function() {
              User.findAll().done(callback);
            });
          },
          items: function(callback) {
            Item.bulkCreate([
              {'test': 'abc'},
              {'test': 'def'},
              {'test': 'ghi'}
            ]).done(function() {
              Item.findAll().done(callback);
            });
          },
          associate: ['users', 'items', function(callback, results) {
            var chainer = new Sequelize.Utils.QueryChainer();

            var users = results.users;
            var items = results.items;

            chainer.add(users[0].setItem(items[0]));
            chainer.add(users[1].setItem(items[1]));
            chainer.add(users[2].setItem(items[2]));

            chainer.run().done(callback);
          }]
        }, function() {
          User.findAll({include: [
            {model: Item, where: Sequelize.or({
              test: 'def'
            }, {
              test: 'abc'
            })}
          ]}).done(function(err, result) {
            expect(err).not.to.be.ok;
            expect(result.length).to.eql(2);
            done();
          });
        });
      });
    });
  });

  describe('findAndCountAll', function() {
    it('should include associations to findAndCountAll', function(done) {
      var User = this.sequelize.define('User', {})
        , Item = this.sequelize.define('Item', {'test': DataTypes.STRING});

      User.hasOne(Item);
      Item.belongsTo(User);

      this.sequelize.sync().done(function() {
        async.auto({
          users: function(callback) {
            User.bulkCreate([{}, {}, {}]).done(function() {
              User.findAll().done(callback);
            });
          },
          items: function(callback) {
            Item.bulkCreate([
              {'test': 'abc'},
              {'test': 'def'},
              {'test': 'ghi'}
            ]).done(function() {
              Item.findAll().done(callback);
            });
          },
          associate: ['users', 'items', function(callback, results) {
            var chainer = new Sequelize.Utils.QueryChainer();

            var users = results.users;
            var items = results.items;

            chainer.add(users[0].setItem(items[0]));
            chainer.add(users[1].setItem(items[1]));
            chainer.add(users[2].setItem(items[2]));

            chainer.run().done(callback);
          }]
        }, function() {
          User.findAndCountAll({include: [
            {model: Item, where: {
              test: 'def'
            }}
          ]}).done(function(err, result) {
            expect(err).not.to.be.ok;
            expect(result.count).to.eql(1);

            expect(result.rows.length).to.eql(1);
            expect(result.rows[0].Item.test).to.eql('def');
            done();
          });
        });
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
