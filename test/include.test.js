/* jshint camelcase: false */
/* jshint expr: true */
var chai      = require('chai')
  , Sequelize = require('../index')
  , expect    = chai.expect
  , Support   = require(__dirname + '/support')
  , DataTypes = require(__dirname + "/../lib/data-types")
  , dialect   = Support.getTestDialect()
  , config    = require(__dirname + "/config/config")
  , sinon     = require('sinon')
  , datetime  = require('chai-datetime')
  , _         = require('lodash')
  , moment    = require('moment')
  , async     = require('async')

chai.use(datetime)
chai.Assertion.includeStack = true

describe(Support.getTestDialectTeaser("Include"), function () {
  describe('find', function () {
    it('should support a simple nested belongsTo -> belongsTo include', function (done) {
      var Task = this.sequelize.define('Task', {})
        , User = this.sequelize.define('User', {})
        , Group = this.sequelize.define('Group', {})

      Task.belongsTo(User)
      User.belongsTo(Group)

      this.sequelize.sync({force: true}).done(function () {
        async.auto({
          task: function (callback) {
            Task.create().done(callback)
          },
          user: function (callback) {
            User.create().done(callback)
          },
          group: function (callback) {
            Group.create().done(callback)
          },
          taskUser: ['task', 'user', function (callback, results) {
            results.task.setUser(results.user).done(callback)
          }],
          userGroup: ['user', 'group', function (callback, results) {
            results.user.setGroup(results.group).done(callback)
          }]
        }, function (err, results) {
          expect(err).not.to.be.ok

          Task.find({
            where: {
              id: results.task.id
            },
            include: [
              {model: User, include: [
                {model: Group}
              ]}
            ]
          }).done(function (err, task) {
            expect(err).not.to.be.ok
            expect(task.user).to.be.ok
            expect(task.user.group).to.be.ok
            done()
          })
        })
      })
    })

    it('should support a simple nested hasOne -> hasOne include', function (done) {
      var Task = this.sequelize.define('Task', {})
        , User = this.sequelize.define('User', {})
        , Group = this.sequelize.define('Group', {})

      User.hasOne(Task)
      Group.hasOne(User)

      this.sequelize.sync({force: true}).done(function () {
        async.auto({
          task: function (callback) {
            Task.create().done(callback)
          },
          user: function (callback) {
            User.create().done(callback)
          },
          group: function (callback) {
            Group.create().done(callback)
          },
          userTask: ['user', 'task', function (callback, results) {
            results.user.setTask(results.task).done(callback)
          }],
          groupUser: ['group', 'user', function (callback, results) {
            results.group.setUser(results.user).done(callback)
          }]
        }, function (err, results) {
          expect(err).not.to.be.ok

          Group.find({
            where: {
              id: results.group.id
            },
            include: [
              {model: User, include: [
                {model: Task}
              ]}
            ]
          }).done(function (err, group) {
            expect(err).not.to.be.ok
            expect(group.user).to.be.ok
            expect(group.user.task).to.be.ok
            done()
          })
        })
      })
    })

    it('should support a simple nested hasMany -> belongsTo include', function (done) {
      var Task = this.sequelize.define('Task', {})
        , User = this.sequelize.define('User', {})
        , Project = this.sequelize.define('Project', {})

      User.hasMany(Task)
      Task.belongsTo(Project)

      this.sequelize.sync({force: true}).done(function () {
        async.auto({
          user: function (callback) {
            User.create().done(callback)
          },
          projects: function (callback) {
            Project.bulkCreate([{}, {}]).done(function () {
              Project.findAll().done(callback)
            })
          },
          tasks: ['projects', function(callback, results) {
            Task.bulkCreate([
              {ProjectId: results.projects[0].id},
              {ProjectId: results.projects[1].id},
              {ProjectId: results.projects[0].id},
              {ProjectId: results.projects[1].id}
            ]).done(function () {
              Task.findAll().done(callback)
            })
          }],
          userTasks: ['user', 'tasks', function (callback, results) {
            results.user.setTasks(results.tasks).done(callback)
          }]
        }, function (err, results) {
          User.find({
            where: {
              id: results.user.id
            },
            include: [
              {model: Task, include: [
                {model: Project}
              ]}
            ]
          }).done(function (err, user) {
            expect(err).not.to.be.ok
            expect(user.tasks).to.be.ok
            expect(user.tasks.length).to.equal(4)

            user.tasks.forEach(function (task) {
              expect(task.project).to.be.ok
            })

            done()
          })
        })
      })
    })

    it('should support a simple nested belongsTo -> hasMany include', function (done) {
      var Task = this.sequelize.define('Task', {})
        , Worker = this.sequelize.define('Worker', {})
        , Project = this.sequelize.define('Project', {})

      Worker.belongsTo(Project)
      Project.hasMany(Task)

      this.sequelize.sync({force: true}).done(function () {
        async.auto({
          worker: function (callback) {
            Worker.create().done(callback)
          },
          project: function (callback) {
            Project.create().done(callback)
          },
          tasks: function(callback) {
            Task.bulkCreate([
              {},
              {},
              {},
              {}
            ]).done(function () {
              Task.findAll().done(callback)
            })
          },
          projectTasks: ['project', 'tasks', function (callback, results) {
            results.project.setTasks(results.tasks).done(callback)
          }],
          projectWorker: ['project', 'worker', function (callback, results) {
            results.worker.setProject(results.project).done(callback)
          }]
        }, function (err, results) {
          Worker.find({
            where: {
              id: results.worker.id
            },
            include: [
              {model: Project, include: [
                {model: Task}
              ]}
            ]
          }).done(function (err, worker) {
            expect(err).not.to.be.ok
            expect(worker.project).to.be.ok
            expect(worker.project.tasks).to.be.ok
            expect(worker.project.tasks.length).to.equal(4)

            done()
          })
        })
      })
    })

    it('should support a simple nested hasMany <-> hasMany include', function (done) {
      var User = this.sequelize.define('User', {})
        , Product = this.sequelize.define('Product', {
            title: DataTypes.STRING
          })
        , Tag = this.sequelize.define('Tag', {
            name: DataTypes.STRING
          })

      User.hasMany(Product)
      Product.hasMany(Tag)
      Tag.hasMany(Product)

      this.sequelize.sync({force: true}).done(function () {
        async.auto({
          user: function (callback) {
            User.create().done(callback)
          },
          products: function (callback) {
            Product.bulkCreate([
              {title: 'Chair'},
              {title: 'Desk'},
              {title: 'Dress'},
              {title: 'Bed'}
            ]).done(function () {
              Product.findAll().done(callback)
            })
          },
          tags: function(callback) {
            Tag.bulkCreate([
              {name: 'A'},
              {name: 'B'},
              {name: 'C'}
            ]).done(function () {
              Tag.findAll().done(callback)
            })
          },
          userProducts: ['user', 'products', function (callback, results) {
            results.user.setProducts(results.products).done(callback)
          }],
          productTags: ['products', 'tags', function (callback, results) {
            var chainer = new Sequelize.Utils.QueryChainer()

            chainer.add(results.products[0].setTags([results.tags[0], results.tags[2]]))
            chainer.add(results.products[1].setTags([results.tags[1]]))
            chainer.add(results.products[2].setTags([results.tags[0], results.tags[1], results.tags[2]]))

            chainer.run().done(callback)
          }]
        }, function (err, results) {
          expect(err).not.to.be.ok

          User.find({
            where: {
              id: results.user.id
            },
            include: [
              {model: Product, include: [
                {model: Tag}
              ]}
            ]
          }).done(function (err, user) {
            expect(err).not.to.be.ok            

            expect(user.products.length).to.equal(4)
            expect(user.products[0].tags.length).to.equal(2)
            expect(user.products[1].tags.length).to.equal(1)
            expect(user.products[2].tags.length).to.equal(3)
            expect(user.products[3].tags.length).to.equal(0)
            done()
          })
        })
      })
    })

    it('should support an include with multiple different association types', function (done) {
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
          })

      User.hasMany(Product)
      Product.belongsTo(User)

      Product.hasMany(Tag)
      Tag.hasMany(Product)
      Product.belongsTo(Tag, {as: 'Category'})

      Product.hasMany(Price)
      Price.belongsTo(Product)

      User.hasMany(GroupMember, {as: 'Memberships'})
      GroupMember.belongsTo(User)
      GroupMember.belongsTo(Rank)
      GroupMember.belongsTo(Group)
      Group.hasMany(GroupMember, {as: 'Memberships'})

      this.sequelize.sync({force: true}).done(function () {
        async.auto({
          user: function (callback) {
            User.create().done(callback)
          },
          groups: function(callback) {
            Group.bulkCreate([
              {name: 'Developers'},
              {name: 'Designers'}
            ]).done(function () {
              Group.findAll().done(callback)
            })
          },
          ranks: function(callback) {
            Rank.bulkCreate([
              {name: 'Admin', canInvite: 1, canRemove: 1},
              {name: 'Member', canInvite: 1}
            ]).done(function () {
              Rank.findAll().done(callback)
            })
          },
          memberships: ['user', 'groups', 'ranks', function (callback, results) {
            GroupMember.bulkCreate([
              {UserId: results.user.id, GroupId: results.groups[0].id, RankId: results.ranks[0].id},
              {UserId: results.user.id, GroupId: results.groups[1].id, RankId: results.ranks[1].id}
            ]).done(callback)
          }],
          products: function (callback) {
            Product.bulkCreate([
              {title: 'Chair'},
              {title: 'Desk'}
            ]).done(function () {
              Product.findAll().done(callback)
            })
          },
          tags: function(callback) {
            Tag.bulkCreate([
              {name: 'A'},
              {name: 'B'},
              {name: 'C'}
            ]).done(function () {
              Tag.findAll().done(callback)
            })
          },
          userProducts: ['user', 'products', function (callback, results) {
            results.user.setProducts(results.products).done(callback)
          }],
          productTags: ['products', 'tags', function (callback, results) {
            var chainer = new Sequelize.Utils.QueryChainer()

            chainer.add(results.products[0].setTags([results.tags[0], results.tags[2]]))
            chainer.add(results.products[1].setTags([results.tags[1]]))
            chainer.add(results.products[0].setCategory(results.tags[1]))

            chainer.run().done(callback)
          }],
          prices: ['products', function (callback, results) {
            Price.bulkCreate([
              {ProductId: results.products[0].id, value: 5},
              {ProductId: results.products[0].id, value: 10},
              {ProductId: results.products[1].id, value: 5},
              {ProductId: results.products[1].id, value: 10},
              {ProductId: results.products[1].id, value: 15},
              {ProductId: results.products[1].id, value: 20}
            ]).done(callback)
          }]
        }, function (err, results) {
          expect(err).not.to.be.ok

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
          }).done(function (err, user) {
            expect(user.memberships.length).to.equal(2)
            expect(user.memberships[0].group.name).to.equal('Developers')
            expect(user.memberships[0].rank.canRemove).to.equal(1)
            expect(user.memberships[1].group.name).to.equal('Designers')
            expect(user.memberships[1].rank.canRemove).to.equal(0)

            expect(user.products.length).to.equal(2)
            expect(user.products[0].tags.length).to.equal(2)
            expect(user.products[1].tags.length).to.equal(1)
            expect(user.products[0].category).to.be.ok
            expect(user.products[1].category).not.to.be.ok

            expect(user.products[0].prices.length).to.equal(2)
            expect(user.products[1].prices.length).to.equal(4)

            done()
          })
        })
      })
    })
  })

  describe('findAll', function () {
    it('should support an include with multiple different association types', function (done) {
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
          })

      User.hasMany(Product)
      Product.belongsTo(User)

      Product.hasMany(Tag)
      Tag.hasMany(Product)
      Product.belongsTo(Tag, {as: 'Category'})

      Product.hasMany(Price)
      Price.belongsTo(Product)

      User.hasMany(GroupMember, {as: 'Memberships'})
      GroupMember.belongsTo(User)
      GroupMember.belongsTo(Rank)
      GroupMember.belongsTo(Group)
      Group.hasMany(GroupMember, {as: 'Memberships'})

      this.sequelize.sync({force: true}).done(function () {
        var count = 4
          , i = -1

        async.auto({
          groups: function(callback) {
            Group.bulkCreate([
              {name: 'Developers'},
              {name: 'Designers'}
            ]).done(function () {
              Group.findAll().done(callback)
            })
          },
          ranks: function(callback) {
            Rank.bulkCreate([
              {name: 'Admin', canInvite: 1, canRemove: 1},
              {name: 'Member', canInvite: 1}
            ]).done(function () {
              Rank.findAll().done(callback)
            })
          },
          tags: function(callback) {
            Tag.bulkCreate([
              {name: 'A'},
              {name: 'B'},
              {name: 'C'}
            ]).done(function () {
              Tag.findAll().done(callback)
            })
          },
          loop: ['groups', 'ranks', 'tags', function (done, results) {
            var groups = results.groups
              , ranks = results.ranks
              , tags = results.tags

            async.whilst(
              function () { return i < count; },
              function (callback) {
                i++

                async.auto({
                  user: function (callback) {
                    User.create().done(callback)
                  },
                  memberships: ['user', function (callback, results) {
                    GroupMember.bulkCreate([
                      {UserId: results.user.id, GroupId: groups[0].id, RankId: ranks[0].id},
                      {UserId: results.user.id, GroupId: groups[1].id, RankId: ranks[1].id}
                    ]).done(callback)
                  }],
                  products: function (callback) {
                    Product.bulkCreate([
                      {title: 'Chair'},
                      {title: 'Desk'}
                    ]).done(function () {
                      Product.findAll().done(callback)
                    })
                  },
                  userProducts: ['user', 'products', function (callback, results) {
                    results.user.setProducts([
                      results.products[(i * 2)+0],
                      results.products[(i * 2)+1]
                    ]).done(callback)
                  }],
                  productTags: ['products', function (callback, results) {
                    var chainer = new Sequelize.Utils.QueryChainer()

                    chainer.add(results.products[(i * 2) + 0].setTags([
                      tags[0],
                      tags[2]
                    ]))
                    chainer.add(results.products[(i * 2) + 1].setTags([
                      tags[1]
                    ]))
                    chainer.add(results.products[(i * 2) + 0].setCategory(tags[1]))

                    chainer.run().done(callback)
                  }],
                  prices: ['products', function (callback, results) {
                    Price.bulkCreate([
                      {ProductId: results.products[(i * 2) + 0].id, value: 5},
                      {ProductId: results.products[(i * 2) + 0].id, value: 10},
                      {ProductId: results.products[(i * 2) + 1].id, value: 5},
                      {ProductId: results.products[(i * 2) + 1].id, value: 10},
                      {ProductId: results.products[(i * 2) + 1].id, value: 15},
                      {ProductId: results.products[(i * 2) + 1].id, value: 20}
                    ]).done(callback)
                  }]
                }, callback)
              },
              function (err) {
                expect(err).not.to.be.ok

                User.findAll({
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
                  ],
                  order: 'id ASC'
                }).done(function (err, users) {
                  expect(err).not.to.be.ok
                  users.forEach(function (user, i) {

                    var sortById = function(a, b) {
                      return a.id < b.id ? -1 : 1
                    }

                    user.memberships.sort(sortById)
                    expect(user.memberships.length).to.equal(2)
                    expect(user.memberships[0].group.name).to.equal('Developers')
                    expect(user.memberships[0].rank.canRemove).to.equal(1)
                    expect(user.memberships[1].group.name).to.equal('Designers')
                    expect(user.memberships[1].rank.canRemove).to.equal(0)

                    user.products.sort(sortById)
                    expect(user.products.length).to.equal(2)
                    expect(user.products[0].tags.length).to.equal(2)
                    expect(user.products[1].tags.length).to.equal(1)
                    expect(user.products[0].category).to.be.ok
                    expect(user.products[1].category).not.to.be.ok

                    expect(user.products[0].prices.length).to.equal(2)
                    expect(user.products[1].prices.length).to.equal(4)

                    done()
                  })
                })
              }
            )
          }]
        }, done)
      })
    })

    it('should support many levels of belongsTo', function (done) {
      var A = this.sequelize.define('A', {})
        , B = this.sequelize.define('B', {})
        , C = this.sequelize.define('C', {})
        , D = this.sequelize.define('D', {})
        , E = this.sequelize.define('E', {})
        , F = this.sequelize.define('F', {})
        , G = this.sequelize.define('G', {})
        , H = this.sequelize.define('H', {})

      A.belongsTo(B)
      B.belongsTo(C)
      C.belongsTo(D)
      D.belongsTo(E)
      E.belongsTo(F)
      F.belongsTo(G)
      G.belongsTo(H)

      var b, singles = [
        B,
        C,
        D,
        E,
        F,
        G,
        H
      ]

      this.sequelize.sync().done(function () {
        async.auto({
          as: function (callback) {
            A.bulkCreate([
              {},
              {},
              {},
              {},
              {},
              {},
              {},
              {}
            ]).done(function () {
              A.findAll().done(callback)
            })
          },
          singleChain: function (callback) {
            var previousInstance
              , previousModel

            async.eachSeries(singles, function (model, callback, i) {
              model.create({}).done(function (err, instance) {
                if (previousInstance) {
                  previousInstance["set"+model.name](instance).done(function () {
                    previousInstance = instance
                    callback()
                  })
                } else {
                  previousInstance = b = instance
                  callback()
                }
              })
            }, callback)
          },
          abs: ['as', 'singleChain', function (callback, results) {
            var chainer = new Sequelize.Utils.QueryChainer()

            results.as.forEach(function (a) {
              chainer.add(a.setB(b))
            })

            chainer.run().done(callback)
          }]
        }, function () {

          A.findAll({
            include: [
              {model: B, include: [
                {model: C, include: [
                  {model: D, include: [
                    {model: E, include: [
                      {model: F, include: [
                        {model: G, include: [
                          {model: H}
                        ]}
                      ]}
                    ]}
                  ]}
                ]}
              ]}
            ]
          }).done(function (err, as) {
            expect(err).not.to.be.ok
            expect(as.length).to.be.ok

            as.forEach(function (a) {
              expect(a.b.c.d.e.f.g.h).to.be.ok
            })
            done()
          })
        })
      })
    })
  })
})